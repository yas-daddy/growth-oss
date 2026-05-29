import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AI_MODEL_FAST, AI_MODEL_SMART, callAIText, callAITool } from "../_shared/ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ---- Frame image helpers ----

function frameImages(frameUrls: string[]) {
  return frameUrls.map((url: string) => ({
    type: "image_url" as const,
    image_url: { url },
  }));
}

// ---- Rule bucket helpers ----

const PERSON_KEYWORDS = ["young", "under 25", "under-25", "person", "age", "demographic", "child"];
const VISUAL_KEYWORDS = ["18+", "gambleaware", "gambling", "responsible", "logo", "visible"];

function categoriseRules(rules: { id: string; label: string; description: string }[]) {
  const personRules: typeof rules = [];
  const visualRules: typeof rules = [];
  const contentRules: typeof rules = [];

  for (const r of rules) {
    const text = `${r.label} ${r.description}`.toLowerCase();
    if (PERSON_KEYWORDS.some((k) => text.includes(k))) {
      personRules.push(r);
    } else if (VISUAL_KEYWORDS.some((k) => text.includes(k))) {
      visualRules.push(r);
    } else {
      contentRules.push(r);
    }
  }

  return { personRules, visualRules, contentRules };
}

function fmtRules(rules: { id: string; label: string; description: string }[]) {
  return rules
    .map((r, i) => `Rule ${i + 1} (id: ${r.id}): "${r.label}" — ${r.description}`)
    .join("\n");
}

// ---- Tool schemas ----

const complianceTool = (name: string, desc: string) => ({
  type: "function" as const,
  function: {
    name,
    description: desc,
    parameters: {
      type: "object",
      properties: {
        results: {
          type: "array",
          items: {
            type: "object",
            properties: {
              rule_id: { type: "string", description: "The rule UUID" },
              status: {
                type: "string",
                enum: ["pass", "warning", "fail"],
                description: "pass = clearly compliant, warning = potentially problematic / needs human review, fail = clearly non-compliant",
              },
              reason: { type: "string", description: "Brief explanation" },
              excerpt: { type: "string", description: "Relevant detail or timestamp info" },
              timestamps: {
                type: "array",
                description: "For video content: second ranges where the issue is visible. Required for non-pass results on video.",
                items: {
                  type: "object",
                  properties: {
                    start: { type: "number", description: "Start time in seconds" },
                    end: { type: "number", description: "End time in seconds" },
                  },
                  required: ["start", "end"],
                  additionalProperties: false,
                },
              },
            },
            required: ["rule_id", "status", "reason"],
            additionalProperties: false,
          },
        },
      },
      required: ["results"],
      additionalProperties: false,
    },
  },
});

// ---- 3-pass video analysis ----

async function analyseVideoMultiPass(
  frameUrls: string[],
  videoDuration: number,
  rules: { id: string; label: string; description: string }[]
) {
  const { personRules, visualRules, contentRules } = categoriseRules(rules);
  const frames = frameImages(frameUrls);
  const frameCount = frames.length;

  const passes: Promise<any>[] = [];

  if (personRules.length > 0) {
    const sysPrompt = `You are a gambling advertising compliance officer specialising in age appearance analysis.

Examine every frame of this video advertisement carefully. The video is ${videoDuration}s long and ${frameCount} frames have been extracted at regular intervals.

For each person visible in any frame, estimate their apparent age. Flag any person who appears to be under 25 years old. Report the frame numbers/approximate timestamps where young-looking persons appear.

For each non-pass result, you MUST return a "timestamps" array with {start, end} second ranges where the issue is visible in the video. Calculate approximate seconds from the frame positions (frames are evenly spaced across the video duration).

Use three statuses:
- "pass" — clearly compliant, no issues
- "warning" — potentially problematic, needs human review (e.g. borderline age appearance)
- "fail" — clearly non-compliant

Rules to check:
${fmtRules(personRules)}

Call the person_age_check tool with your findings.`;

    passes.push(
      callAITool(AI_MODEL_SMART, [
        { role: "system", content: sysPrompt },
        { role: "user", content: [{ type: "text", text: `Analyse these ${frameCount} frames from a ${videoDuration}s video ad for person/age compliance.` }, ...frames] },
      ], [complianceTool("person_age_check", "Return person & age compliance results")], "person_age_check")
        .catch((e) => {
          console.error("Pass 1 (persons) failed:", e);
          return { results: personRules.map((r) => ({ rule_id: r.id, passed: false, reason: `Analysis failed: ${e.message}` })) };
        })
    );
  }

  if (visualRules.length > 0) {
    const sysPrompt = `You are a gambling advertising compliance officer specialising in responsible gambling messaging visibility.

Check every frame of this video advertisement for visible '18+' and 'GambleAware' (or equivalent responsible gambling) messaging. The video is ${videoDuration}s long and ${frameCount} frames have been extracted at regular intervals.

The messaging MUST be visible throughout the entire video. Report which frames show it and which don't. If any frames are missing the required messaging, the check fails.

For each non-pass result, you MUST return a "timestamps" array with {start, end} second ranges where the issue is visible (e.g. where messaging is missing). Calculate approximate seconds from the frame positions.

Use three statuses:
- "pass" — clearly compliant, no issues
- "warning" — potentially problematic, needs human review (e.g. messaging partially obscured)
- "fail" — clearly non-compliant

Rules to check:
${fmtRules(visualRules)}

Call the visual_compliance_check tool with your findings.`;

    passes.push(
      callAITool(AI_MODEL_SMART, [
        { role: "system", content: sysPrompt },
        { role: "user", content: [{ type: "text", text: `Check these ${frameCount} frames from a ${videoDuration}s video ad for 18+/GambleAware visibility.` }, ...frames] },
      ], [complianceTool("visual_compliance_check", "Return visual messaging compliance results")], "visual_compliance_check")
        .catch((e) => {
          console.error("Pass 2 (visual) failed:", e);
          return { results: visualRules.map((r) => ({ rule_id: r.id, passed: false, reason: `Analysis failed: ${e.message}` })) };
        })
    );
  }

  if (contentRules.length > 0) {
    const sysPrompt = `You are a gambling advertising compliance officer specialising in content and claims analysis.

Describe the full narrative of this video advertisement. The video is ${videoDuration}s long and ${frameCount} frames have been extracted at regular intervals.

List ALL claims made, any text/captions shown on screen, and the overall tone. Then check the content against each of the rules below. Be strict but fair.

For each non-pass result, you MUST return a "timestamps" array with {start, end} second ranges where the problematic content appears. Calculate approximate seconds from the frame positions.

Use three statuses:
- "pass" — clearly compliant, no issues
- "warning" — potentially problematic, needs human review (e.g. ambiguous claims)
- "fail" — clearly non-compliant

Rules to check:
${fmtRules(contentRules)}

Call the content_compliance_check tool with your findings.`;

    passes.push(
      callAITool(AI_MODEL_FAST, [
        { role: "system", content: sysPrompt },
        { role: "user", content: [{ type: "text", text: `Analyse the content and claims in these ${frameCount} frames from a ${videoDuration}s video ad.` }, ...frames] },
      ], [complianceTool("content_compliance_check", "Return content/claims compliance results")], "content_compliance_check")
        .catch((e) => {
          console.error("Pass 3 (content) failed:", e);
          return { results: contentRules.map((r) => ({ rule_id: r.id, passed: false, reason: `Analysis failed: ${e.message}` })) };
        })
    );
  }

  const passResults = await Promise.all(passes);
  const allResults: any[] = [];
  for (const pr of passResults) {
    if (pr?.results) allResults.push(...pr.results);
  }
  return allResults;
}

// ---- AI name generation ----

async function generateAIName(
  contentType: string,
  content: any,
  fileUrl: string | null,
  frameUrls: string[] | null
): Promise<string> {
  try {
    const messages: any[] = [
      {
        role: "system",
        content: "You generate short descriptive names (max 6 words) for marketing content. Reply with ONLY the name, no quotes or explanation.",
      },
    ];

    if (contentType === "email") {
      const summary = [content?.subject, content?.body?.slice(0, 100)].filter(Boolean).join(" — ");
      messages.push({ role: "user", content: `Name this email: ${summary}` });
    } else if (contentType === "image" && fileUrl) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: "Name this advertising image in max 6 words." },
          { type: "image_url", image_url: { url: fileUrl } },
        ],
      });
    } else if (contentType === "video" && frameUrls?.length) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: "Name this video advertisement in max 6 words." },
          { type: "image_url", image_url: { url: frameUrls[0] } },
        ],
      });
    } else {
      return "";
    }

    const name = await callAIText(AI_MODEL_FAST, messages, { maxTokens: 50 });
    return name.replace(/^["']|["']$/g, "");
  } catch (e) {
    console.error("AI name generation failed:", e);
    return "";
  }
}

// ---- Thumbnail helpers ----

async function resolveVideoThumbnail(
  supabase: any,
  frameDataUrl: string
): Promise<string | null> {
  try {
    // Convert data URL to bytes
    const base64 = frameDataUrl.split(",")[1];
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const path = `thumbnails/${crypto.randomUUID()}.jpg`;

    const { error } = await supabase.storage
      .from("compliance-uploads")
      .upload(path, bytes, { contentType: "image/jpeg" });

    if (error) {
      console.error("Thumbnail upload failed:", error);
      return null;
    }
    return path;
  } catch (e) {
    console.error("Thumbnail upload error:", e);
    return null;
  }
}

function extractStoragePath(signedUrl: string): string | null {
  try {
    const url = new URL(signedUrl);
    const match = url.pathname.match(/compliance-uploads\/(.+?)(?:\?|$)/);
    if (match) return match[1];
    // Try from query-based signed URLs
    const pathSegments = url.pathname.split("/compliance-uploads/");
    if (pathSegments.length > 1) return pathSegments[1].split("?")[0];
    return null;
  } catch {
    return null;
  }
}

// ---- Main handler ----

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { content_type, content, rules, file_url, frame_urls, video_duration, thumbnail_path: clientThumbnailPath } = await req.json();

    let results: any[];

    if (content_type === "video" && frame_urls?.length) {
      results = await analyseVideoMultiPass(frame_urls, video_duration || frame_urls.length, rules);
    } else {
      const rulesDescription = rules
        .map((r: any, i: number) => `Rule ${i + 1} (id: ${r.id}): "${r.label}" — ${r.description}`)
        .join("\n");

      const systemPrompt = `You are a gambling advertising compliance officer. You must analyse the provided content against UK gambling advertising regulations and the specific rules below.

For each rule, determine its compliance status using three levels:
- "pass" — clearly compliant, no issues
- "warning" — potentially problematic, needs human review (e.g. ambiguous wording, borderline claims)
- "fail" — clearly non-compliant

Provide a brief reason explaining your assessment. If a rule fails or warns for email content, identify the specific excerpt that is problematic.

Rules to check:
${rulesDescription}

You MUST call the compliance_report tool with your structured findings. Be strict but fair. If you cannot determine compliance for a visual rule from text-only content, mark it as passed with a note that visual review is recommended.`;

      const messages: any[] = [{ role: "system", content: systemPrompt }];

      if (content_type === "email") {
        const emailContent = [
          content.subject ? `Subject Line: ${content.subject}` : "",
          content.body ? `Email Body:\n${content.body}` : "",
          content.terms ? `Terms & Conditions / Offer Terms:\n${content.terms}` : "",
        ].filter(Boolean).join("\n\n");

        if (content.header_image_url) {
          messages.push({
            role: "user",
            content: [
              { type: "text", text: `Please check this email for compliance:\n\n${emailContent}\n\nThe header image is attached below.` },
              { type: "image_url", image_url: { url: content.header_image_url } },
            ],
          });
        } else {
          messages.push({ role: "user", content: `Please check this email for compliance:\n\n${emailContent}` });
        }
      } else if (content_type === "image") {
        messages.push({
          role: "user",
          content: [
            { type: "text", text: "Please check this advertising image for compliance with gambling regulations." },
            { type: "image_url", image_url: { url: file_url } },
          ],
        });
      }

      const isTextOnly = content_type === "email" && !content?.header_image_url;
      const model = isTextOnly ? AI_MODEL_FAST : AI_MODEL_SMART;

      const aiResult = await callAITool(
        model, messages,
        [complianceTool("compliance_report", "Return the compliance check results for each rule.")],
        "compliance_report"
      );
      results = aiResult.results || [];
    }

    const hasAnyFail = results.some((r: any) => r.status === "fail");
    const hasAnyWarning = results.some((r: any) => r.status === "warning");
    const overallStatus = hasAnyFail ? "fail" : hasAnyWarning ? "warning" : "pass";

    // Generate AI name (fire-and-forget style, but we await it)
    const aiName = await generateAIName(content_type, content, file_url, frame_urls);

    // Resolve thumbnail path
    let thumbnailPath: string | null = clientThumbnailPath || null;

    if (!thumbnailPath) {
      if (content_type === "image" && file_url) {
        thumbnailPath = extractStoragePath(file_url);
      } else if (content_type === "video" && frame_urls?.length) {
        thumbnailPath = await resolveVideoThumbnail(supabase, frame_urls[0]);
      } else if (content_type === "email" && content?.header_image_url) {
        thumbnailPath = extractStoragePath(content.header_image_url);
      }
    }

    const inputData =
      content_type === "email"
        ? content
        : { file_url, frame_count: frame_urls?.length, video_duration };

    const { data: insertedCheck } = await supabase.from("compliance_checks").insert({
      user_id: user.id,
      content_type,
      input_data: inputData,
      results,
      overall_status: overallStatus,
      ai_name: aiName || null,
      thumbnail_path: thumbnailPath,
    }).select('id').single();

    return new Response(
      JSON.stringify({ id: insertedCheck?.id, results, overall_status: overallStatus }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("compliance-check error:", e);
    const status = e.status || 500;
    const msg = e instanceof Error ? e.message : "Unknown error";

    if (status === 429) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (status === 402) {
      return new Response(
        JSON.stringify({ error: "AI credits exhausted. Please top up your workspace." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
