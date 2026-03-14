

# Fix User Access & Add Super Admin System

## Root Cause
1. The `handle_new_user` trigger function exists but the **trigger itself was never created**, so no profile or role gets assigned on signup
2. The `user_roles` RLS policy requires admin to insert — chicken-and-egg problem for new org creators
3. No super admin concept exists yet

## Plan

### 1. Database Migrations

**a) Create missing triggers on auth.users:**
- `on_auth_user_created` → calls `handle_new_user()` (creates profile, assigns role from invitation)
- `on_auth_user_login` → calls `handle_user_login()` (updates last_login_at)

**b) Add `super_admin` to the `app_role` enum:**
- `ALTER TYPE app_role ADD VALUE 'super_admin';`

**c) Add `is_super_admin()` security definer function:**
- Checks if user has `super_admin` role in `user_roles`

**d) Fix `user_roles` RLS to allow org owners to self-assign:**
- Add policy: users can insert their own role if they are an org owner (using `is_org_admin` function) OR if they are super_admin
- This fixes the onboarding chicken-and-egg problem

**e) Seed your current user** with a profile, org, org membership, and `super_admin` + `admin` roles (via service-role insert)

### 2. Update `useUserRole` Hook
- Add `isSuperAdmin` derived from roles containing `super_admin`
- Super admins bypass all permission checks

### 3. Update `useOrganization` Hook / Context
- For super admins: fetch ALL organizations, allow switching between them
- Store selected org in state (localStorage for persistence)
- Add `switchOrganization(orgId)` method to context

### 4. Org Selector in Sidebar Header
- Only visible to super admins
- Dropdown showing all organizations
- Selecting switches the active org context

### 5. Update Settings Page
- Show "Users & Permissions" to org admins (not just `user_roles` admins) — use `isOrgAdmin` from org context
- Add new "Super Admin" section (only for super admins) with:
  - **Platform Management** — upload icons for partner APIs, manage CMS content
  - **API Keys & OAuth** — manage global secrets/credentials
  - **All Organizations** — view/manage all orgs

### 6. Update `UserManagement.tsx`
- Allow access for org admins (not just `user_roles` admin check)
- Scope user list to current organization's members

### 7. Create Super Admin Settings Pages
- `src/pages/settings/PlatformManagement.tsx` — upload/manage partner API icons
- `src/pages/settings/GlobalAPIKeys.tsx` — manage OAuth and API key configurations
- Add routes in `App.tsx`

### Files to Create/Edit
- **DB Migration**: Create triggers, add super_admin role, fix RLS
- **DB Insert**: Seed your user profile + roles + org
- **Edit**: `src/hooks/useUserRole.tsx` — add `isSuperAdmin`
- **Edit**: `src/hooks/useOrganization.tsx` — add org switching for super admins
- **Edit**: `src/components/layout/AppSidebar.tsx` — add org selector
- **Edit**: `src/pages/Settings.tsx` — conditionally show admin/super-admin sections
- **Edit**: `src/pages/UserManagement.tsx` — use org-based admin check
- **Create**: `src/pages/settings/PlatformManagement.tsx`
- **Create**: `src/pages/settings/GlobalAPIKeys.tsx`
- **Edit**: `src/App.tsx` — add new routes

