import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { startSyncLog, completeSyncLog } from "../_shared/sync-logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generate JWT for App Store Connect API
async function generateAppStoreJWT(
  keyId: string,
  issuerId: string,
  privateKey: string
): Promise<string> {
  const header = {
    alg: "ES256",
    kid: keyId,
    typ: "JWT",
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: issuerId,
    iat: now,
    exp: now + 20 * 60, // 20 minutes
    aud: "appstoreconnect-v1",
  };

  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const signingInput = `${headerB64}.${payloadB64}`;

  const pemContents = privateKey
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  
  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    encoder.encode(signingInput)
  );

  const signatureArray = new Uint8Array(signature);
  const signatureB64 = btoa(String.fromCharCode(...signatureArray))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${signingInput}.${signatureB64}`;
}

// Helper to decompress gzip data
async function decompressGzip(data: ArrayBuffer): Promise<string> {
  const ds = new DecompressionStream("gzip");
  const writer = ds.writable.getWriter();
  writer.write(data);
  writer.close();
  
  const reader = ds.readable.getReader();
  const chunks: Uint8Array[] = [];
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  
  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  
  return new TextDecoder().decode(result);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let logId: string | null = null;
  
  try {
    console.log("Starting App Store Analytics sync...");

    const keyId = Deno.env.get("APP_STORE_KEY_ID");
    const issuerId = Deno.env.get("APP_STORE_ISSUER_ID");
    const privateKey = Deno.env.get("APP_STORE_PRIVATE_KEY");
    const appId = Deno.env.get("APP_STORE_APP_ID");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!keyId || !issuerId || !privateKey || !appId) {
      console.error("Missing App Store Connect credentials");
      return new Response(
        JSON.stringify({ error: "Missing App Store Connect credentials" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase credentials" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Start sync log
    const syncLog = await startSyncLog('appstore-analytics-sync');
    logId = syncLog?.id ?? null;
    
    const jwt = await generateAppStoreJWT(keyId, issuerId, privateKey);
    console.log("Generated App Store Connect JWT");

    // Step 1: Get or create analytics report request
    // First check for existing ongoing request for this app
    let reportRequestId: string | null = null;
    
    const listRequestsUrl = `https://api.appstoreconnect.apple.com/v1/apps/${appId}/analyticsReportRequests?filter[accessType]=ONGOING`;
    const listResponse = await fetch(listRequestsUrl, {
      headers: { Authorization: `Bearer ${jwt}` },
    });

    if (listResponse.ok) {
      const listData = await listResponse.json();
      const existingRequest = listData.data?.find((r: any) => 
        r.attributes?.accessType === "ONGOING"
      );
      if (existingRequest) {
        reportRequestId = existingRequest.id;
        console.log(`Found existing report request: ${reportRequestId}`);
      }
    } else {
      console.log(`List requests returned ${listResponse.status}, will try to create new one`);
    }

    // Create new request if none exists
    if (!reportRequestId) {
      console.log("Creating new analytics report request...");
      // The correct endpoint is /v1/analyticsReportRequests with app relationship in body
      const createResponse = await fetch(
        `https://api.appstoreconnect.apple.com/v1/analyticsReportRequests`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${jwt}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            data: {
              type: "analyticsReportRequests",
              attributes: {
                accessType: "ONGOING",
              },
              relationships: {
                app: {
                  data: {
                    type: "apps",
                    id: appId,
                  },
                },
              },
            },
          }),
        }
      );

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        console.error(`Failed to create report request: ${errorText}`);
        // If it's a conflict error (request already exists), try to list again
        if (createResponse.status === 409) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              message: "Analytics report request already in progress. Please try again later." 
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        throw new Error(`Failed to create analytics report request: ${errorText}`);
      }

      const createData = await createResponse.json();
      reportRequestId = createData.data.id;
      console.log(`Created new report request: ${reportRequestId}`);
    }

    // Step 2: Get available reports
    const reportsUrl = `https://api.appstoreconnect.apple.com/v1/analyticsReportRequests/${reportRequestId}/reports`;
    const reportsResponse = await fetch(reportsUrl, {
      headers: { Authorization: `Bearer ${jwt}` },
    });

    if (!reportsResponse.ok) {
      const errorText = await reportsResponse.text();
      console.error(`Failed to get reports: ${errorText}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Analytics reports not yet available. Please try again later.",
          details: errorText,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const reportsData = await reportsResponse.json();
    const reports = reportsData.data || [];
    
    // Look for App Store Discovery report (contains source type breakdown)
    const discoveryReport = reports.find((r: any) => 
      r.attributes?.category === "APP_STORE_ENGAGEMENT" || 
      r.attributes?.name?.includes("Download")
    );

    if (!discoveryReport) {
      console.log("No download/discovery report available yet");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Analytics reports are being prepared. Data will be available after 24-48 hours.",
          availableReports: reports.map((r: any) => r.attributes?.name),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found discovery report: ${discoveryReport.attributes?.name}`);

    // Step 3: Get report instances (for daily granularity)
    const instancesUrl = `https://api.appstoreconnect.apple.com/v1/analyticsReports/${discoveryReport.id}/instances?filter[granularity]=DAILY&limit=30`;
    const instancesResponse = await fetch(instancesUrl, {
      headers: { Authorization: `Bearer ${jwt}` },
    });

    if (!instancesResponse.ok) {
      const errorText = await instancesResponse.text();
      console.error(`Failed to get report instances: ${errorText}`);
      throw new Error(`Failed to get report instances: ${errorText}`);
    }

    const instancesData = await instancesResponse.json();
    const instances = instancesData.data || [];

    console.log(`Found ${instances.length} report instances`);

    const metricsToUpsert: any[] = [];

    // Step 4: Process each instance (day)
    for (const instance of instances.slice(0, 30)) { // Limit to last 30 days
      const segmentsUrl = `https://api.appstoreconnect.apple.com/v1/analyticsReportInstances/${instance.id}/segments`;
      const segmentsResponse = await fetch(segmentsUrl, {
        headers: { Authorization: `Bearer ${jwt}` },
      });

      if (!segmentsResponse.ok) continue;

      const segmentsData = await segmentsResponse.json();
      const segments = segmentsData.data || [];

      for (const segment of segments) {
        const downloadUrl = segment.attributes?.url;
        if (!downloadUrl) continue;

        try {
          const dataResponse = await fetch(downloadUrl);
          if (!dataResponse.ok) continue;

          const contentType = dataResponse.headers.get("content-type") || "";
          let csvContent: string;

          if (contentType.includes("gzip") || downloadUrl.endsWith(".gz")) {
            const buffer = await dataResponse.arrayBuffer();
            csvContent = await decompressGzip(buffer);
          } else {
            csvContent = await dataResponse.text();
          }

          // Parse CSV and extract source type metrics
          const lines = csvContent.split("\n");
          const headers = lines[0]?.split("\t") || [];
          
          // Log headers for debugging
          console.log(`CSV Headers: ${JSON.stringify(headers)}`);
          if (lines.length > 1) {
            console.log(`Sample row: ${lines[1]}`);
          }
          
          const dateIndex = headers.findIndex(h => h.toLowerCase().includes("date"));
          const sourceTypeIndex = headers.findIndex(h => h.toLowerCase() === "source type");
          // "Counts" column has the actual download numbers, not "Download Type"
          const countsIndex = headers.findIndex(h => h.toLowerCase() === "counts");
          const downloadTypeIndex = headers.findIndex(h => h.toLowerCase() === "download type");
          
          console.log(`Column indices - date: ${dateIndex}, sourceType: ${sourceTypeIndex}, counts: ${countsIndex}, downloadType: ${downloadTypeIndex}`);

          for (let i = 1; i < lines.length; i++) {
            const cols = lines[i]?.split("\t");
            if (!cols || cols.length < 3) continue;

            const date = dateIndex >= 0 ? cols[dateIndex] : instance.attributes?.processingDate;
            const sourceType = sourceTypeIndex >= 0 ? cols[sourceTypeIndex]?.toLowerCase().replace(/\s+/g, "_") : "unknown";
            const downloadType = downloadTypeIndex >= 0 ? cols[downloadTypeIndex]?.toLowerCase() : "";
            const counts = countsIndex >= 0 ? parseInt(cols[countsIndex]) || 0 : 0;
            
            // Determine if this is a first-time download or redownload based on Download Type column
            const isFirstTime = downloadType.includes("first");
            const isRedownload = downloadType.includes("redownload");

            // Filter for organic sources (App Store search/browse)
            if (sourceType.includes("app_store") || sourceType.includes("browse") || sourceType.includes("search")) {
              metricsToUpsert.push({
                date,
                source_type: sourceType,
                downloads: counts,
                first_time_downloads: isFirstTime ? counts : 0,
                redownloads: isRedownload ? counts : 0,
                synced_at: new Date().toISOString(),
              });
            }
          }
        } catch (parseError) {
          console.error(`Error parsing segment data:`, parseError);
          continue;
        }
      }
    }

    console.log(`Prepared ${metricsToUpsert.length} organic metrics records (before deduplication)`);

    // Deduplicate by date+source_type, summing values for duplicates
    const deduped = new Map<string, any>();
    for (const metric of metricsToUpsert) {
      const key = `${metric.date}|${metric.source_type}`;
      if (deduped.has(key)) {
        const existing = deduped.get(key);
        existing.downloads += metric.downloads;
        existing.first_time_downloads = 
          (existing.first_time_downloads || 0) + (metric.first_time_downloads || 0);
        existing.redownloads = 
          (existing.redownloads || 0) + (metric.redownloads || 0);
      } else {
        deduped.set(key, { ...metric });
      }
    }
    const uniqueMetrics = Array.from(deduped.values());

    console.log(`After deduplication: ${uniqueMetrics.length} unique records`);

    // Upsert metrics
    if (uniqueMetrics.length > 0) {
      const batchSize = 50;
      for (let i = 0; i < uniqueMetrics.length; i += batchSize) {
        const batch = uniqueMetrics.slice(i, i + batchSize);
        const { error: upsertError } = await supabase
          .from("appstore_organic_metrics")
          .upsert(batch, { onConflict: "date,source_type" });

        if (upsertError) {
          console.error(`Upsert error:`, upsertError);
        }
      }
    }

    console.log("App Store Analytics sync completed");

    // Complete sync log
    await completeSyncLog(logId, true);

    return new Response(
      JSON.stringify({
        success: true,
        metricsCount: uniqueMetrics.length,
        message: `Synced ${uniqueMetrics.length} organic install metrics (deduplicated from ${metricsToUpsert.length} raw records)`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error syncing App Store Analytics:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    
    // Complete sync log with error
    await completeSyncLog(logId, false, errorMessage);
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
