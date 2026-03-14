

# Fix Settings Access & Add "Connect APIs" Banner

## Problem Analysis

1. **Settings inaccessible**: The sidebar hides Settings behind `adminOnly: true`, which checks `useUserRole()` → `user_roles` table. But onboarding only creates an `organization_members` entry with role `owner` — it never inserts into `user_roles`. So new users default to `'viewer'` and can't see Settings.

2. **No guidance when APIs aren't connected**: Pages like Launch Ads, Review Manager, etc. show empty states with no indication that APIs need connecting.

## Plan

### 1. Fix Settings visibility in sidebar
- Change the Settings nav item from `adminOnly` to visible for all authenticated non-affiliate users (or at minimum org owners/admins)
- Use `useOrganization().isOrgAdmin` instead of the legacy `user_roles`-based `isAdmin` check
- Also update the Settings page itself: admin-only sections (Users & Permissions, Syncs) remain gated, but connections/appearance/security are accessible to all org members

### 2. Auto-assign `user_roles` admin role during onboarding
- When creating an org in `Onboarding.tsx`, also insert into `user_roles` with `role: 'admin'` so existing admin-gated features (RLS policies, ad management) work correctly for org creators

### 3. Create a reusable `ConnectProvidersAlert` component
- A dismissible banner component: "Connect your platforms to start seeing data" with a CTA linking to `/settings/connections`
- Uses `useProviderConnections()` to check if any providers are connected
- Shows only when no providers have `status: 'connected'`

### 4. Add the banner to key pages
- Pages to update: `LaunchAds`, `AppRatings`, `CampaignPerformance`, `CreativeAnalysis`, `KeywordAnalysis`, `AutomationRules`, `CompetitorAds`, `WeeklyTracker`, `MonthlyTracker`
- Place at the top of each page, above existing content

### Files to create/edit
- **Create**: `src/components/ConnectProvidersAlert.tsx`
- **Edit**: `src/components/layout/AppSidebar.tsx` (remove `adminOnly` on Settings)
- **Edit**: `src/pages/Onboarding.tsx` (add `user_roles` insert after org creation)
- **Edit**: ~9 page files to add the banner component

