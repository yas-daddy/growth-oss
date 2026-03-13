import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as jose from 'https://deno.land/x/jose@v5.2.0/index.ts';
import { startSyncLog, completeSyncLog } from "../_shared/sync-logger.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const APPLE_AUTH_URL = 'https://appleid.apple.com/auth/oauth2/token';
const APPLE_ADS_API_URL = 'https://api.searchads.apple.com/api/v5';

function normalizePemKey(key: string): string {
  let normalized = key.replace(/\\n/g, '\n').trim();
  normalized = normalized
    .replace(/-----BEGIN [A-Z ]+-----/g, '')
    .replace(/-----END [A-Z ]+-----/g, '')
    .replace(/\s/g, '');
  const pemKey = `-----BEGIN PRIVATE KEY-----\n${normalized}\n-----END PRIVATE KEY-----`;
  return pemKey;
}

async function generateClientSecret(): Promise<string> {
  const clientId = Deno.env.get('APPLE_ADS_CLIENT_ID')!;
  const teamId = Deno.env.get('APPLE_ADS_TEAM_ID')!;
  const keyId = Deno.env.get('APPLE_ADS_KEY_ID')!;
  const rawPrivateKey = Deno.env.get('APPLE_ADS_PRIVATE_KEY')!;

  const privateKeyPem = normalizePemKey(rawPrivateKey);
  const privateKey = await jose.importPKCS8(privateKeyPem, 'ES256');

  const now = Math.floor(Date.now() / 1000);
  const exp = now + 86400 * 180;

  const jwt = await new jose.SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: keyId })
    .setIssuer(teamId)
    .setSubject(clientId)
    .setAudience('https://appleid.apple.com')
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(privateKey);

  return jwt;
}

async function getAccessToken(): Promise<string> {
  const clientId = Deno.env.get('APPLE_ADS_CLIENT_ID')!;
  const clientSecret = await generateClientSecret();

  const response = await fetch(APPLE_AUTH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'searchadsorg',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get Apple access token: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data.access_token;
}

// Fetch all ad groups for all campaigns
async function fetchAdGroups(accessToken: string, orgId: string, campaignIds: string[]): Promise<any[]> {
  const allAdGroups: any[] = [];
  
  for (const campaignId of campaignIds) {
    try {
      const response = await fetch(`${APPLE_ADS_API_URL}/campaigns/${campaignId}/adgroups`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-AP-Context': `orgId=${orgId}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const adGroups = data.data || [];
        adGroups.forEach((ag: any) => {
          ag._campaignId = campaignId;
        });
        allAdGroups.push(...adGroups);
      }
    } catch (err) {
      console.error(`Error fetching ad groups for campaign ${campaignId}:`, err);
    }
  }
  
  console.log(`Fetched ${allAdGroups.length} ad groups total`);
  return allAdGroups;
}

// Fetch targeting keywords for an ad group
async function fetchKeywords(accessToken: string, orgId: string, campaignId: string, adGroupId: string): Promise<any[]> {
  try {
    const response = await fetch(
      `${APPLE_ADS_API_URL}/campaigns/${campaignId}/adgroups/${adGroupId}/targetingkeywords`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-AP-Context': `orgId=${orgId}`,
        },
      }
    );

    if (response.ok) {
      const data = await response.json();
      return data.data || [];
    }
  } catch (err) {
    console.error(`Error fetching keywords for adgroup ${adGroupId}:`, err);
  }
  return [];
}

// Fetch keyword reports with daily granularity
async function fetchKeywordReports(accessToken: string, orgId: string, campaignId: string, startDateStr: string, endDateStr: string): Promise<any[]> {
  const requestBody = {
    startTime: startDateStr,
    endTime: endDateStr,
    granularity: 'DAILY',
    selector: {
      orderBy: [{ field: 'localSpend', sortOrder: 'DESCENDING' }],
    },
    returnRowTotals: true,
    returnGrandTotals: false,
  };

  try {
    const response = await fetch(`${APPLE_ADS_API_URL}/reports/campaigns/${campaignId}/keywords`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-AP-Context': `orgId=${orgId}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (response.ok) {
      const data = await response.json();
      return data.data?.reportingDataResponse?.row || [];
    }
  } catch (err) {
    console.error(`Error fetching keyword reports for campaign ${campaignId}:`, err);
  }
  return [];
}

// Fetch Search Terms Report for a campaign with daily granularity
async function fetchSearchTermsReportDaily(
  accessToken: string, 
  orgId: string, 
  campaignId: string, 
  startDateStr: string, 
  endDateStr: string
): Promise<any[]> {
  // Apple Search Terms API only supports returnRowTotals OR granularity, not both
  // We need daily granularity for storing per-day metrics
  const requestBody = {
    startTime: startDateStr,
    endTime: endDateStr,
    granularity: 'DAILY',
    selector: {
      orderBy: [{ field: 'impressions', sortOrder: 'DESCENDING' }],
    },
    returnRowTotals: false,
    returnGrandTotals: false,
  };

  try {
    const response = await fetch(`${APPLE_ADS_API_URL}/reports/campaigns/${campaignId}/searchterms`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-AP-Context': `orgId=${orgId}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (response.ok) {
      const data = await response.json();
      const rows = data.data?.reportingDataResponse?.row || [];
      return rows;
    } else {
      const errorText = await response.text();
      console.log(`Search terms report error for campaign ${campaignId}: ${response.status} ${errorText.slice(0, 200)}`);
    }
  } catch (err) {
    console.error(`Error fetching search terms for campaign ${campaignId}:`, err);
  }
  return [];
}

// Create an impression share custom report
async function createImpressionShareReport(accessToken: string, orgId: string, startDateStr: string, endDateStr: string): Promise<string | null> {
  const requestBody = {
    name: `imp_share_${Date.now()}`,
    startTime: startDateStr,
    endTime: endDateStr,
    granularity: 'DAILY',
  };

  try {
    const response = await fetch(`${APPLE_ADS_API_URL}/custom-reports`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-AP-Context': `orgId=${orgId}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (response.ok) {
      const data = await response.json();
      const reportId = data.data?.id;
      console.log(`Created impression share report with ID: ${reportId}`);
      return reportId?.toString() || null;
    } else {
      const errorText = await response.text();
      console.log(`Failed to create impression share report: ${response.status} ${errorText.slice(0, 300)}`);
    }
  } catch (err) {
    console.error('Error creating impression share report:', err);
  }
  return null;
}

// Poll for impression share report completion and download
async function fetchImpressionShareReport(accessToken: string, orgId: string, reportId: string): Promise<any[]> {
  // Increased timeout: 30 attempts × 6s = 180 seconds (was 15 × 4s = 60s)
  const maxAttempts = 30;
  const delayMs = 6000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(`${APPLE_ADS_API_URL}/custom-reports/${reportId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-AP-Context': `orgId=${orgId}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const state = data.data?.state;
        
        if (state === 'COMPLETED') {
          const downloadUri = data.data?.downloadUri;
          if (downloadUri) {
            // Download the report - it's CSV format
            const reportResponse = await fetch(downloadUri);
            if (reportResponse.ok) {
              const csvText = await reportResponse.text();
              const rows = parseCsvToObjects(csvText);
              console.log(`Downloaded impression share report with ${rows.length} rows`);
              return rows;
            }
          }
          return [];
        } else if (state === 'FAILED') {
          console.log(`Impression share report failed`);
          return [];
        }
        
        // Still processing, wait and retry
        console.log(`Impression share report state: ${state}, waiting...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else {
        const errorText = await response.text();
        console.log(`Error fetching report status: ${response.status} ${errorText.slice(0, 200)}`);
        return [];
      }
    } catch (err) {
      console.error('Error polling impression share report:', err);
      return [];
    }
  }
  
  console.log('Impression share report timed out waiting for completion');
  return [];
}

// Simple CSV parser for impression share reports
function parseCsvToObjects(csvText: string): any[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const results: any[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    // Handle quoted CSV values properly
    const values = parseCSVLine(lines[i]);
    const obj: any = {};
    headers.forEach((header, idx) => {
      // Remove surrounding quotes from values
      let value = values[idx] || '';
      value = value.replace(/^"|"$/g, '').trim();
      obj[header] = value;
    });
    results.push(obj);
  }
  
  return results;
}

// Parse a CSV line handling quoted values
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"' && (i === 0 || line[i-1] !== '\\')) {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  
  return values;
}

// Parse impression share range string (e.g., "RANGE_0_10" -> { low: 0, high: 10 })
function parseImpressionShareRange(rangeStr: string | undefined): { low: number | null; high: number | null } {
  if (!rangeStr) return { low: null, high: null };
  
  // Handle patterns like "RANGE_0_10", "RANGE_11_20", etc.
  const match = rangeStr.match(/RANGE_(\d+)_(\d+)/i);
  if (match) {
    return { low: parseInt(match[1], 10), high: parseInt(match[2], 10) };
  }
  
  // Handle numeric ranges directly if different format
  const numMatch = rangeStr.match(/(\d+)[-_](\d+)/);
  if (numMatch) {
    return { low: parseInt(numMatch[1], 10), high: parseInt(numMatch[2], 10) };
  }
  
  return { low: null, high: null };
}

// Parse rank value (1-5 or ">5" -> 6, also handles word format: ONE, TWO, etc.)
function parseRank(rankValue: string | number | undefined): number | null {
  if (rankValue === undefined || rankValue === null || rankValue === '') return null;
  
  if (typeof rankValue === 'number') return rankValue;
  
  const rankStr = rankValue.toString().toUpperCase().trim();
  
  // Handle word format from CSV: ONE, TWO, THREE, FOUR, FIVE
  const wordToNum: Record<string, number> = {
    'ONE': 1, 'TWO': 2, 'THREE': 3, 'FOUR': 4, 'FIVE': 5,
    'ABOVE_FIVE': 6, 'ABOVE FIVE': 6, '>5': 6
  };
  if (wordToNum[rankStr]) return wordToNum[rankStr];
  
  if (rankStr === 'RANK_ABOVE_5') return 6;
  
  const match = rankStr.match(/RANK_(\d+)/i);
  if (match) return parseInt(match[1], 10);
  
  const numValue = parseInt(rankStr, 10);
  return isNaN(numValue) ? null : numValue;
}

// Parse search popularity (1-5)
function parseSearchPopularity(popValue: string | number | undefined): number | null {
  if (popValue === undefined || popValue === null) return null;
  
  if (typeof popValue === 'number') return popValue;
  
  const match = popValue.match(/POPULARITY_(\d+)/i);
  if (match) return parseInt(match[1], 10);
  
  const numValue = parseInt(popValue, 10);
  return isNaN(numValue) ? null : numValue;
}

// Batch upsert helper to avoid memory limits
async function batchUpsert(supabase: any, table: string, data: any[], conflictColumns: string, batchSize = 50) {
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    const { error } = await supabase.from(table).upsert(batch, { onConflict: conflictColumns });
    if (error) {
      console.error(`Error upserting batch to ${table}:`, error);
      throw error;
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const syncLog = await startSyncLog('apple-sync-keywords');
  
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      await completeSyncLog(syncLog?.id || null, false, 'Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse optional request body for backfill parameters
    let requestBody: { backfillSearchTermsStart?: string; backfillSearchTermsEnd?: string } = {};
    try {
      const text = await req.text();
      if (text) {
        requestBody = JSON.parse(text);
      }
    } catch {
      // No body or invalid JSON is fine, use defaults
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const orgId = Deno.env.get('APPLE_ADS_ORG_ID')!;

    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);
    
    // Authenticate user
    let userId: string;
    const supabaseAnon = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await supabaseAnon.auth.getUser();
    if (user) {
      const { data: userRole } = await supabaseService
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (!userRole) {
        return new Response(
          JSON.stringify({ error: 'Admin access required' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      userId = user.id;
    } else {
      const { data: adminRole } = await supabaseService
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin')
        .limit(1)
        .maybeSingle();
      
      if (!adminRole) {
        return new Response(
          JSON.stringify({ error: 'No admin user found' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      userId = adminRole.user_id;
    }

    console.log(`Syncing Apple keywords for user: ${userId}`);

    const accessToken = await getAccessToken();

    // Get campaigns from database
    const { data: campaigns } = await supabaseService
      .from('apple_campaigns')
      .select('campaign_id, campaign_name');

    if (!campaigns || campaigns.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No campaigns found. Sync campaigns first.', totalKeywords: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const campaignIds = campaigns.map(c => c.campaign_id);
    const campaignNameMap = new Map(campaigns.map(c => [c.campaign_id, c.campaign_name]));

    // Fetch ad groups
    const adGroups = await fetchAdGroups(accessToken, orgId, campaignIds);
    const adGroupMap = new Map<string, { name: string; campaignId: string }>();
    adGroups.forEach(ag => {
      adGroupMap.set(ag.id.toString(), { name: ag.name, campaignId: ag._campaignId });
    });

    // Fetch all keywords
    const allKeywords: any[] = [];
    for (const ag of adGroups) {
      const keywords = await fetchKeywords(accessToken, orgId, ag._campaignId, ag.id.toString());
      keywords.forEach(kw => {
        kw._adGroupId = ag.id.toString();
        kw._adGroupName = ag.name;
        kw._campaignId = ag._campaignId;
        kw._campaignName = campaignNameMap.get(ag._campaignId) || 'Unknown';
      });
      allKeywords.push(...keywords);
    }

    console.log(`Fetched ${allKeywords.length} keywords`);

    // Calculate date range - incremental sync with 7-day overlap
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 1); // Yesterday
    
    let startDate = new Date();
    startDate.setDate(startDate.getDate() - 30); // Default to 30 days for first sync
    
    const { data: latestSync } = await supabaseService
      .from('daily_apple_keyword_spend')
      .select('date')
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (latestSync?.date) {
      // Start from 7 days before latest synced date (overlap for delayed attributions)
      const latestDate = new Date(latestSync.date);
      latestDate.setDate(latestDate.getDate() - 7);
      
      // Only use incremental if it would reduce the range
      if (latestDate > startDate) {
        startDate = latestDate;
        console.log(`Incremental sync: starting from ${startDate.toISOString().split('T')[0]} (7-day overlap)`);
      }
    } else {
      console.log('Full sync: no previous data found, fetching 30 days');
    }
    
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // Fetch keyword reports for each campaign
    const allReports: any[] = [];
    for (const campaignId of campaignIds) {
      const reports = await fetchKeywordReports(accessToken, orgId, campaignId, startDateStr, endDateStr);
      reports.forEach(r => {
        r._campaignId = campaignId;
        r._campaignName = campaignNameMap.get(campaignId) || 'Unknown';
      });
      allReports.push(...reports);
    }

    console.log(`Fetched ${allReports.length} keyword report rows`);

    // Step 1: Fetch Search Terms Reports with daily granularity
    // These link search terms to keywordIds AND provide daily metrics
    const searchTermToKeyword = new Map<string, string>(); // searchTermText (lowercase) -> keywordId
    const searchTermDailyData: any[] = []; // Daily search term records to upsert
    
    // Check for backfill mode - allows fetching a specific date range for search terms
    const backfillSearchTermsStart = requestBody?.backfillSearchTermsStart;
    const backfillSearchTermsEnd = requestBody?.backfillSearchTermsEnd;
    
    let searchTermStartDateStr: string;
    let searchTermEndDateStr: string;
    
    if (backfillSearchTermsStart && backfillSearchTermsEnd) {
      // Backfill mode: use provided date range
      searchTermStartDateStr = backfillSearchTermsStart;
      searchTermEndDateStr = backfillSearchTermsEnd;
      console.log(`Search terms BACKFILL mode: fetching ${searchTermStartDateStr} to ${searchTermEndDateStr}`);
    } else {
      // Normal mode: calculate independent date range for search terms
      let searchTermStartDate = new Date();
      searchTermStartDate.setDate(searchTermStartDate.getDate() - 30); // Default to 30 days for first sync
      
      const { data: latestSearchTermSync } = await supabaseService
        .from('apple_search_terms')
        .select('date')
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (latestSearchTermSync?.date) {
        const latestSTDate = new Date(latestSearchTermSync.date);
        latestSTDate.setDate(latestSTDate.getDate() - 7);
        
        if (latestSTDate > searchTermStartDate) {
          searchTermStartDate = latestSTDate;
          console.log(`Search terms incremental sync: starting from ${searchTermStartDate.toISOString().split('T')[0]} (7-day overlap)`);
        }
      } else {
        console.log('Search terms full sync: no previous data found, fetching 30 days');
      }
      
      searchTermStartDateStr = searchTermStartDate.toISOString().split('T')[0];
      searchTermEndDateStr = endDateStr;
      console.log(`Fetching search terms reports from ${searchTermStartDateStr} to ${searchTermEndDateStr}...`);
    }
    
    for (const campaignId of campaignIds) {
      try {
        const searchTermsRows = await fetchSearchTermsReportDaily(accessToken, orgId, campaignId, searchTermStartDateStr, endDateStr);
        
        for (const row of searchTermsRows) {
          const keywordId = row.metadata?.keywordId?.toString();
          const searchTermText = row.metadata?.searchTermText;
          const searchTermSource = row.metadata?.searchTermSource; // AUTO or TARGETED
          const matchType = row.metadata?.matchType; // AUTO, BROAD, EXACT
          
          if (keywordId && searchTermText) {
            // Build keywordId mapping
            searchTermToKeyword.set(searchTermText.toLowerCase(), keywordId);
            
            // Process daily granularity data
            const granularityData = row.granularity || [];
            for (const dayData of granularityData) {
              const date = dayData.date;
              if (!date) continue;
              
              searchTermDailyData.push({
                user_id: userId,
                keyword_id: keywordId,
                search_term_text: searchTermText,
                search_term_source: searchTermSource,
                match_type: matchType,
                date,
                spend: parseFloat(dayData.localSpend?.amount || '0'),
                impressions: dayData.impressions || 0,
                taps: dayData.taps || 0,
                installs: dayData.tapInstalls || dayData.totalInstalls || dayData.installs || 0,
                synced_at: new Date().toISOString(),
              });
            }
          }
        }
      } catch (err) {
        console.error(`Error fetching search terms for campaign ${campaignId}:`, err);
      }
    }
    console.log(`Built search term to keyword mapping for ${searchTermToKeyword.size} search terms`);
    console.log(`Collected ${searchTermDailyData.length} daily search term records`);
    
    // Step 2: Fetch impression share data via custom reports API
    // Note: This is rate-limited to 10 reports per 24 hours
    // This returns data at search term level, which we'll map to keywords using the mapping above
    const impressionShareByKeyword = new Map<string, { 
      shareLow: number | null; 
      shareHigh: number | null; 
      rank: number | null; 
      popularity: number | null;
      impressions: number; // For weighted averaging if needed
    }>();
    
    try {
      // Use search term date range for impression share (same date range for consistency)
      const reportId = await createImpressionShareReport(accessToken, orgId, searchTermStartDateStr, endDateStr);
      if (reportId) {
        const impShareData = await fetchImpressionShareReport(accessToken, orgId, reportId);
        
        // Log sample row to debug field names
        if (impShareData.length > 0) {
          console.log('Impression share sample row:', JSON.stringify(impShareData[0]));
        }
        
        for (const row of impShareData) {
          // Custom reports return data at search term level
          const searchTerm = (row.searchTerm || row.search_term || row.SearchTerm || row['Search Term'])?.toLowerCase();
          if (!searchTerm) continue;

          // Look up the keywordId for this search term using our mapping
          const keywordId = searchTermToKeyword.get(searchTerm);
          if (!keywordId) {
            // Fallback: Try exact match with keyword text from the keyword metadata
            continue;
          }

          // Parse impression share - API returns decimals (0.81 = 81%), convert to integer percentages for DB
          const shareLowRaw = parseFloat(row.lowImpressionShare || row.low_impression_share || row.LowImpressionShare || row['Low Impression Share'] || '');
          const shareHighRaw = parseFloat(row.highImpressionShare || row.high_impression_share || row.HighImpressionShare || row['High Impression Share'] || '');
          const shareLow = !isNaN(shareLowRaw) ? Math.round(shareLowRaw * 100) : null;
          const shareHigh = !isNaN(shareHighRaw) ? Math.round(shareHighRaw * 100) : null;
          const rank = parseRank(row.rank || row.Rank);
          const popularity = parseSearchPopularity(row.searchPopularity || row.search_popularity || row.SearchPopularity || row['Search Popularity']);
          const impressions = parseInt(row.impressions || row.Impressions || '0', 10) || 0;

          if (shareLow !== null || shareHigh !== null || rank !== null || popularity !== null) {
            const existing = impressionShareByKeyword.get(keywordId);
            
            // If we already have data for this keyword, keep the one with most impressions (most representative)
            if (!existing || impressions > existing.impressions) {
              impressionShareByKeyword.set(keywordId, {
                shareLow,
                shareHigh,
                rank,
                popularity,
                impressions,
              });
            }
          }
        }
        console.log(`Mapped impression share data to ${impressionShareByKeyword.size} keywords via keywordId`);
      }
    } catch (impShareErr) {
      console.error('Error fetching impression share data:', impShareErr);
      // Continue without impression share data - don't fail the entire sync
    }

    // Track whether impression share fetch succeeded
    // This prevents overwriting existing DB values with nulls when API fails
    const impressionShareFetchSucceeded = impressionShareByKeyword.size > 0;
    console.log(`Impression share fetch ${impressionShareFetchSucceeded ? 'succeeded' : 'failed or returned no data'} - ${impressionShareByKeyword.size} keywords mapped`);

    // Upsert search term daily data first (from searchTermDailyData collected earlier)
    // Only enrich with impression share data if we successfully fetched it
    const enrichedSearchTermData = searchTermDailyData.map(st => {
      const record: any = { ...st };
      
      // Only add impression share fields if we successfully fetched data
      // This prevents overwriting existing values with nulls on upsert
      if (impressionShareFetchSucceeded) {
        const impShareData = impressionShareByKeyword.get(st.keyword_id);
        record.impression_share_low = impShareData?.shareLow ?? null;
        record.impression_share_high = impShareData?.shareHigh ?? null;
        record.impression_rank = impShareData?.rank ?? null;
        record.search_popularity = impShareData?.popularity ?? null;
      }
      
      return record;
    });
    
    if (enrichedSearchTermData.length > 0) {
      try {
        await batchUpsert(supabaseService, 'apple_search_terms', enrichedSearchTermData, 'keyword_id,search_term_text,date');
        console.log(`Upserted ${enrichedSearchTermData.length} search term records`);
      } catch (searchTermError) {
        console.error('Error upserting search term data:', searchTermError);
        // Don't fail the entire sync if search terms fail
      }
    }

    // Log sample report structure to debug installs field
    if (allReports.length > 0) {
      const sample = allReports[0];
      console.log('Sample report structure:', JSON.stringify({
        metadata: sample.metadata,
        totalFields: sample.total ? Object.keys(sample.total) : [],
        total: sample.total,
        granularityFields: sample.granularity?.[0] ? Object.keys(sample.granularity[0]) : [],
        granularitySample: sample.granularity?.[0],
      }, null, 2));
    }

    // Build keyword metadata map
    const keywordMetaMap = new Map<string, any>();
    allKeywords.forEach(kw => {
      keywordMetaMap.set(kw.id.toString(), kw);
    });

    // Process daily spend records
    const dailySpendData: any[] = [];
    const keywordAggregates = new Map<string, any>();

    for (const report of allReports) {
      const keywordId = report.metadata?.keywordId?.toString();
      if (!keywordId) continue;

      const keywordMeta = keywordMetaMap.get(keywordId) || {};
      const keywordText = keywordMeta.text || report.metadata?.keyword || 'Unknown';
      const matchType = keywordMeta.matchType || report.metadata?.matchType || 'UNKNOWN';
      // Look up impression share by keywordId (mapped from search terms)
      const impShareData = impressionShareByKeyword.get(keywordId);

      const granularityData = report.granularity || [];
      
      for (const dayData of granularityData) {
        const date = dayData.date;
        if (!date) continue;

        const spend = parseFloat(dayData.localSpend?.amount || '0');
        const impressions = dayData.impressions || 0;
        const taps = dayData.taps || 0;
        // Apple API uses tapInstalls or totalInstalls for daily install metrics
        const installs = dayData.tapInstalls || dayData.totalInstalls || dayData.installs || 0;

        const dailyRecord: any = {
          user_id: userId,
          keyword_id: keywordId,
          keyword_text: keywordText,
          match_type: matchType,
          campaign_id: report._campaignId,
          campaign_name: report._campaignName,
          date,
          spend,
          impressions,
          taps,
          installs,
          synced_at: new Date().toISOString(),
        };
        
        // Only include impression share fields if we successfully fetched data
        // This prevents overwriting existing values with nulls on upsert
        if (impressionShareFetchSucceeded) {
          dailyRecord.impression_share_low = impShareData?.shareLow ?? null;
          dailyRecord.impression_share_high = impShareData?.shareHigh ?? null;
          dailyRecord.impression_rank = impShareData?.rank ?? null;
          dailyRecord.search_popularity = impShareData?.popularity ?? null;
        }
        
        dailySpendData.push(dailyRecord);
      }

      // Aggregate totals
      const totalMetrics = report.total || {};
      const baseAggregate: any = {
        keyword_text: keywordText,
        match_type: matchType,
        campaign_id: report._campaignId,
        campaign_name: report._campaignName,
        adgroup_id: keywordMeta._adGroupId,
        adgroup_name: keywordMeta._adGroupName,
        bid_amount: keywordMeta.bidAmount?.amount || 0,
        status: keywordMeta.status,
        spend: 0,
        impressions: 0,
        taps: 0,
        installs: 0,
      };
      
      // Only include impression share in aggregate if we successfully fetched data
      if (impressionShareFetchSucceeded) {
        baseAggregate.impression_share_low = impShareData?.shareLow ?? null;
        baseAggregate.impression_share_high = impShareData?.shareHigh ?? null;
        baseAggregate.impression_rank = impShareData?.rank ?? null;
        baseAggregate.search_popularity = impShareData?.popularity ?? null;
      }
      
      const existing = keywordAggregates.get(keywordId) || baseAggregate;

      existing.spend += parseFloat(totalMetrics.localSpend?.amount || '0');
      existing.impressions += totalMetrics.impressions || 0;
      existing.taps += totalMetrics.taps || 0;
      // Apple API uses totalInstalls or tapInstalls
      existing.installs += totalMetrics.totalInstalls || totalMetrics.tapInstalls || 0;

      keywordAggregates.set(keywordId, existing);
    }

    // Upsert daily spend in batches
    if (dailySpendData.length > 0) {
      try {
        await batchUpsert(supabaseService, 'daily_apple_keyword_spend', dailySpendData, 'keyword_id,date');
        console.log(`Upserted ${dailySpendData.length} daily keyword records`);
      } catch (dailyError) {
        console.error('Error upserting daily keyword spend:', dailyError);
      }
    }

    // Prepare aggregate keyword data
    const keywordData = Array.from(keywordAggregates.entries()).map(([keywordId, agg]) => {
      const record: any = {
        user_id: userId,
        keyword_id: keywordId,
        keyword_text: agg.keyword_text,
        match_type: agg.match_type,
        status: agg.status,
        campaign_id: agg.campaign_id,
        campaign_name: agg.campaign_name,
        adgroup_id: agg.adgroup_id,
        adgroup_name: agg.adgroup_name,
        bid_amount: parseFloat(agg.bid_amount) || 0,
        impressions: agg.impressions,
        taps: agg.taps,
        installs: agg.installs,
        spend: agg.spend,
        avg_cpa: agg.installs > 0 ? agg.spend / agg.installs : null,
        avg_cpt: agg.taps > 0 ? agg.spend / agg.taps : null,
        ttr: agg.impressions > 0 ? (agg.taps / agg.impressions) * 100 : null,
        synced_at: new Date().toISOString(),
      };
      
      // Only include impression share if we successfully fetched data
      if (impressionShareFetchSucceeded) {
        record.impression_share_low = agg.impression_share_low;
        record.impression_share_high = agg.impression_share_high;
        record.impression_rank = agg.impression_rank;
        record.search_popularity = agg.search_popularity;
      }
      
      return record;
    });

    // Upsert keywords in batches - conflict on keyword_id only (unique constraint)
    if (keywordData.length > 0) {
      try {
        await batchUpsert(supabaseService, 'apple_keywords', keywordData, 'keyword_id');
      } catch (upsertError: any) {
        console.error('Error upserting keywords:', upsertError);
        throw new Error(`Failed to save keywords: ${upsertError.message}`);
      }
    }

    const result = {
      success: true,
      totalKeywords: keywordData.length,
      totalDailyRecords: dailySpendData.length,
      totalSpend: keywordData.reduce((sum, k) => sum + k.spend, 0),
      totalInstalls: keywordData.reduce((sum, k) => sum + k.installs, 0),
      impressionShareSynced: impressionShareFetchSucceeded,
      impressionShareKeywords: impressionShareByKeyword.size,
      syncedAt: new Date().toISOString(),
    };

    console.log('Keyword sync completed:', result);
    await completeSyncLog(syncLog?.id || null, true);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error syncing Apple keywords:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    await completeSyncLog(syncLog?.id || null, false, message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
