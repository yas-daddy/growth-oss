import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Mapping from provider_type enum to the env-var credential keys used by legacy edge functions.
 * When tenant-level credentials are not found, the helper falls back to these env vars.
 */
const ENV_FALLBACK_MAP: Record<string, Record<string, string>> = {
  meta_ads: {
    access_token: "META_ACCESS_TOKEN",
    ad_account_id: "META_AD_ACCOUNT_ID",
    app_id: "META_APP_ID",
    app_secret: "META_APP_SECRET",
    page_id: "META_PAGE_ID",
    instagram_actor_id: "META_INSTAGRAM_ACTOR_ID",
  },
  apple_search_ads: {
    client_id: "APPLE_ADS_CLIENT_ID",
    team_id: "APPLE_ADS_TEAM_ID",
    key_id: "APPLE_ADS_KEY_ID",
    private_key: "APPLE_ADS_PRIVATE_KEY",
    org_id_apple: "APPLE_ADS_ORG_ID",
  },
  moloco: {
    api_key: "MOLOCO_API_KEY",
    ad_account_id: "MOLOCO_AD_ACCOUNT_ID",
  },
  appsflyer: {
    api_token: "APPSFLYER_API_TOKEN",
    ios_app_id: "APPSFLYER_IOS_APP_ID",
    android_app_id: "APPSFLYER_ANDROID_APP_ID",
  },
  mixpanel: {
    project_id: "MIXPANEL_PROJECT_ID",
    api_secret: "MIXPANEL_API_SECRET",
  },
  app_store: {
    key_id: "APP_STORE_KEY_ID",
    issuer_id: "APP_STORE_ISSUER_ID",
    private_key: "APP_STORE_PRIVATE_KEY",
    app_id: "APP_STORE_APP_ID",
  },
  google_play: {
    service_account_json: "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON",
    package_name: "GOOGLE_PLAY_PACKAGE_NAME",
  },
  trustpilot: {
    api_key: "TRUSTPILOT_API_KEY",
    api_secret: "TRUSTPILOT_API_SECRET",
    business_unit_id: "TRUSTPILOT_BUSINESS_UNIT_ID",
    username: "TRUSTPILOT_BUSINESS_USER_ID",
  },
  google_search_console: {
    service_account_json: "GOOGLE_SEARCH_CONSOLE_SERVICE_ACCOUNT_JSON",
    site_url: "GOOGLE_SEARCH_CONSOLE_SITE_URL",
  },
};

export interface TenantCredentials {
  /** The resolved credentials as a key-value map */
  credentials: Record<string, string>;
  /** Whether the credentials came from the provider_connections table (true) or env fallback (false) */
  fromTenant: boolean;
  /** The org_id these credentials belong to (null if env fallback) */
  orgId: string | null;
}

/**
 * Resolves credentials for a given provider.
 *
 * 1. If `orgId` is provided, queries provider_connections for that org's credentials.
 * 2. Falls back to environment variables using ENV_FALLBACK_MAP.
 * 3. Throws if no credentials are found at all.
 */
export async function getTenantCredentials(
  provider: string,
  orgId?: string | null
): Promise<TenantCredentials> {
  // Try tenant-level credentials first
  if (orgId) {
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const { data, error } = await supabase
        .from("provider_connections")
        .select("credentials")
        .eq("org_id", orgId)
        .eq("provider", provider)
        .eq("status", "connected")
        .maybeSingle();

      if (!error && data?.credentials && typeof data.credentials === "object") {
        const creds = data.credentials as Record<string, string>;
        // Verify at least one key has a non-empty value
        const hasValues = Object.values(creds).some(
          (v) => v !== null && v !== undefined && v !== ""
        );
        if (hasValues) {
          console.log(
            `[tenant-credentials] Using tenant credentials for ${provider} (org: ${orgId})`
          );
          return { credentials: creds, fromTenant: true, orgId };
        }
      }
    } catch (err) {
      console.error(
        `[tenant-credentials] Error fetching tenant credentials:`,
        err
      );
    }
  }

  // Fall back to environment variables
  const envMap = ENV_FALLBACK_MAP[provider];
  if (!envMap) {
    throw new Error(
      `[tenant-credentials] Unknown provider: ${provider}. No env fallback available.`
    );
  }

  const credentials: Record<string, string> = {};
  for (const [credKey, envVar] of Object.entries(envMap)) {
    const value = Deno.env.get(envVar);
    if (value) {
      credentials[credKey] = value;
    }
  }

  if (Object.keys(credentials).length === 0) {
    throw new Error(
      `[tenant-credentials] No credentials found for provider ${provider} (checked org ${orgId ?? "none"} and env vars)`
    );
  }

  console.log(
    `[tenant-credentials] Using env fallback for ${provider} (${Object.keys(credentials).length} keys)`
  );
  return { credentials, fromTenant: false, orgId: null };
}

/**
 * Helper to update last_synced_at on a provider connection after a successful sync.
 */
export async function updateLastSyncedAt(
  orgId: string,
  provider: string
): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    await supabase
      .from("provider_connections")
      .update({
        last_synced_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("org_id", orgId)
      .eq("provider", provider);
  } catch (err) {
    console.error(
      `[tenant-credentials] Error updating last_synced_at:`,
      err
    );
  }
}

/**
 * Helper to mark a provider connection as errored.
 */
export async function markProviderError(
  orgId: string,
  provider: string,
  errorMessage: string
): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    await supabase
      .from("provider_connections")
      .update({
        status: "error",
        error_message: errorMessage.substring(0, 500),
        updated_at: new Date().toISOString(),
      })
      .eq("org_id", orgId)
      .eq("provider", provider);
  } catch (err) {
    console.error(
      `[tenant-credentials] Error marking provider error:`,
      err
    );
  }
}
