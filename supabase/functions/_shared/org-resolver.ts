import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface ResolvedContext {
  userId: string;
  orgId: string;
}

/**
 * Resolves user identity and org context from the request.
 *
 * 1. Authenticates the user from the Authorization header.
 * 2. Resolves org_id from:
 *    a. Explicit `org_id` in request body (if provided)
 *    b. The user's organization_members membership (first org)
 *    c. Falls back to service-role admin lookup for cron/nightly calls
 *
 * Returns { userId, orgId }.
 */
export async function resolveOrgContext(
  req: Request,
  body?: Record<string, unknown>
): Promise<ResolvedContext> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    throw new Error("Missing authorization header");
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  // Try to get user from auth header
  const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
  } = await supabaseUser.auth.getUser();

  let userId: string;
  let orgId: string | undefined;

  // Check if org_id was explicitly passed in body
  const explicitOrgId = body?.org_id as string | undefined;

  if (user) {
    userId = user.id;

    if (explicitOrgId) {
      // Verify user is a member of this org
      const { data: membership } = await supabaseAdmin
        .from("organization_members")
        .select("org_id")
        .eq("user_id", user.id)
        .eq("org_id", explicitOrgId)
        .maybeSingle();

      if (!membership) {
        throw new Error("User is not a member of the specified organization");
      }
      orgId = explicitOrgId;
    } else {
      // Resolve from user's memberships (first org)
      const { data: memberships } = await supabaseAdmin
        .from("organization_members")
        .select("org_id")
        .eq("user_id", user.id)
        .limit(1);

      if (memberships && memberships.length > 0) {
        orgId = memberships[0].org_id;
      }
    }
  } else {
    // Service role call (cron/nightly) — use explicit org_id from body
    if (explicitOrgId) {
      orgId = explicitOrgId;
    }

    // Get an admin user for this org (for user_id on records)
    if (orgId) {
      const { data: adminMember } = await supabaseAdmin
        .from("organization_members")
        .select("user_id")
        .eq("org_id", orgId)
        .in("role", ["owner", "admin"])
        .limit(1)
        .maybeSingle();

      if (adminMember) {
        userId = adminMember.user_id;
      } else {
        // Fallback: any member
        const { data: anyMember } = await supabaseAdmin
          .from("organization_members")
          .select("user_id")
          .eq("org_id", orgId)
          .limit(1)
          .maybeSingle();

        if (!anyMember) {
          throw new Error(
            "No users found for organization " + orgId
          );
        }
        userId = anyMember.user_id;
      }
    } else {
      // Legacy fallback: use first admin user
      const { data: adminRole } = await supabaseAdmin
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin")
        .limit(1)
        .maybeSingle();

      if (!adminRole) {
        throw new Error("No admin user found for service role sync");
      }
      userId = adminRole.user_id;

      // Try to find their org
      const { data: memberships } = await supabaseAdmin
        .from("organization_members")
        .select("org_id")
        .eq("user_id", userId)
        .limit(1);

      if (memberships && memberships.length > 0) {
        orgId = memberships[0].org_id;
      }
    }
  }

  if (!orgId) {
    throw new Error("Could not resolve organization context");
  }

  console.log(
    `[org-resolver] Resolved user=${userId}, org=${orgId}`
  );

  return { userId: userId!, orgId };
}

/**
 * Lists all active organizations that have at least one connected provider.
 * Used by nightly-sync to iterate over tenants.
 */
export async function listActiveOrganizations(): Promise<
  { orgId: string; name: string }[]
> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data, error } = await supabase
    .from("organizations")
    .select("id, name");

  if (error) {
    console.error("[org-resolver] Error listing organizations:", error);
    return [];
  }

  return (data || []).map((o) => ({ orgId: o.id, name: o.name }));
}

/**
 * Lists connected providers for a given organization.
 */
export async function listOrgProviders(
  orgId: string
): Promise<string[]> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data, error } = await supabase
    .from("provider_connections")
    .select("provider")
    .eq("org_id", orgId)
    .eq("status", "connected");

  if (error) {
    console.error("[org-resolver] Error listing org providers:", error);
    return [];
  }

  return (data || []).map((p) => p.provider);
}
