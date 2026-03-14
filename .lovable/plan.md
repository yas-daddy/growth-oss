

# Revised Plan: Multi-Tenant B2B SaaS Revamp

## Summary

Transform the single-tenant GrowthOS into a multi-tenant B2B app where customers sign up, create organizations, connect their own providers (OAuth or API keys), pick conversion events for CPA tracking, and select weekly tracker metrics. Keep all analysis, ad launcher, review manager, automation, and compliance features. Remove only: Football Ads, Push Notifications, Canvas Scheduler, Brand Score, and betting-specific metric calculations.

---

## What to Keep

| Feature | Pages/Components |
|---------|-----------------|
| Auth, profiles, user roles | Auth.tsx, useAuth, useUserRole |
| Configurable dashboards | DashboardPage, ConfigurableDashboard, report_definitions, dashboard_configs |
| Campaign Performance | CampaignPerformance.tsx |
| Weekly/Monthly Tracker | WeeklyTracker, MonthlyTracker (rework to be metric-agnostic) |
| Creative Analysis | CreativeAnalysis, creative components |
| Keyword Analysis | KeywordAnalysis, keyword components |
| Audience Analysis | AudienceAnalysis |
| Top Ads | TopAds |
| Launch Ads (Meta + Moloco) | LaunchAds, ad components |
| Automation Rules | AutomationRules |
| Recommendations | Recommendations |
| Compliance Checker | ComplianceChecker |
| Review Manager | AppRatings, review components (App Store, Google Play, Trustpilot) |
| Competitor Ads | CompetitorAds |
| Projections | Projections |
| Affiliates | AffiliateSettings, AffiliateDetail |
| Settings (most) | Settings hub, Connections, AI, Auto-responses, CPA, Compliance, Appearance, Security, Users |
| All UI components | shadcn/ui library |
| Theme system, layout | DashboardLayout, AppSidebar (reworked) |

## What to Remove

| Feature | Why |
|---------|-----|
| Football Ads page + components + edge functions | Experimental, betting-specific |
| Push Notifications page + Braze integration | User requested removal |
| Canvas Scheduler (Email Campaigns) | User requested removal |
| Brand Score / Brand Visibility | Experimental |
| Betting-specific DB functions | All `get_report_*` functions referencing FTDs, STDs, HVPs, deposits, withdrawals |
| Betting-specific tables | `daily_funnel_metrics`, `daily_revenue_metrics`, `daily_nps_metrics`, `user_ftd_dates`, `user_identity_map`, `weekly_brand_scores`, `football_*`, `push_notification_schedules`, `email_campaign_*`, `range_metrics_cache` |
| Stakemate branding | Logo, hardcoded name |

---

## Implementation Phases

### Phase 1: Multi-Tenant Data Model

Create new tables via migration:

- **`organizations`** -- `id`, `name`, `slug`, `created_by` (user_id), `created_at`
- **`organization_members`** -- `id`, `org_id`, `user_id`, `role` (owner/admin/member), `created_at`
- **`provider_connections`** -- `id`, `org_id`, `provider_type` (enum: meta_ads, apple_search_ads, moloco, appsflyer, mixpanel, google_play, app_store, trustpilot, google_search_console, typeform), `auth_method` (oauth/api_key), `credentials` (jsonb, encrypted), `status` (connected/disconnected/error), `connected_at`, `last_synced_at`
- **`conversion_events`** -- `id`, `org_id`, `event_name`, `event_label`, `is_primary` (boolean), `source_provider` -- lets users define which events from their analytics provider represent conversions for CPA calculation
- **`tracker_metric_config`** -- `id`, `org_id`, `metric_key`, `metric_label`, `display_order`, `is_visible`, `data_source`

Add `org_id` column to all existing data tables that are being kept (e.g., `daily_ad_spend`, `meta_campaigns`, `meta_ads`, `apple_campaigns`, `app_store_reviews`, etc.) so data is tenant-isolated.

RLS policies on all new tables scoped by org membership. Existing tables get new RLS policies filtering by org_id.

### Phase 2: Organization Context + Onboarding

- Create `useOrganization` React context that resolves the current user's org from `organization_members`
- Build post-signup onboarding flow (3 steps):
  1. Create Organization (name)
  2. Connect Providers (show available integrations)
  3. Configure Conversion Events (pick which events = conversions for CPA)
- All data-fetching hooks get updated to filter by `org_id` from context
- Update `profiles` table to track `onboarding_completed`

### Phase 3: Provider Connections Settings Page

Replace current "API Connections" page with a "Partners" page:

**Supported providers with connection method:**

| Provider | Method | What user provides |
|----------|--------|-------------------|
| Meta Ads | OAuth | Connect button triggers OAuth flow via edge function |
| Apple Search Ads | API Key | Client ID, Team ID, Key ID, Private Key |
| Moloco | API Key | API Key, Ad Account ID |
| AppsFlyer | API Key | API Token, App IDs |
| Mixpanel | API Key | Project ID, API Secret |
| App Store Reviews | API Key | Key ID, Issuer ID, Private Key, App ID |
| Google Play Reviews | API Key | Service Account JSON, Package Name |
| Trustpilot | API Key | API Key, API Secret, Business Unit ID |
| Google Search Console | API Key | Service Account JSON, Site URL |

Each provider card shows: logo, name, description, connection status, "Connect" / "Disconnect" button, and setup instructions (link to provider docs, field descriptions).

Credentials stored in `provider_connections` as encrypted JSONB. Edge functions decrypt at runtime.

**Meta OAuth flow:** Edge function handles redirect to Facebook OAuth URL, callback exchanges code for tokens, stores in `provider_connections`.

### Phase 4: Conversion Events Settings

New settings page: "Conversion Events"
- Users define named events (e.g., "Purchase", "Signup", "Subscription Start")
- Mark one as primary (used for CPA calculations)
- Events are matched against data from connected analytics providers (AppsFlyer events, Mixpanel events)
- Replace all hardcoded FTD/STD references in report functions with the org's primary conversion event

### Phase 5: Rework Weekly/Monthly Tracker

- Replace hardcoded betting columns (FTDs, STDs, HVPs, deposits) with dynamic metric selection
- `tracker_metric_config` lets each org choose which metrics appear
- Available metrics are derived from connected providers (spend, installs, conversion events, CPA, ratings, etc.)
- Recalculation edge functions become generic: they query the org's connected providers and selected conversion events

### Phase 6: Rework Dashboard Report Functions

- All `get_report_*` DB functions need to accept `org_id` parameter
- Replace FTD-specific functions with generic conversion-event-based versions
- `get_report_blended_cpa` becomes: total spend / total primary conversion events (per org)
- Keep the `report_definitions` / `dashboard_configs` pattern but add `org_id` to both tables
- Seed default reports on org creation

### Phase 7: Update Edge Functions for Per-Tenant Credentials

- All sync edge functions (meta-sync-campaigns, apple-sync-campaigns, appsflyer-sync, etc.) updated to:
  1. Accept `org_id` in request
  2. Fetch that org's credentials from `provider_connections`
  3. Use those credentials for API calls
  4. Store results with `org_id`
- Review response edge functions (app-store-respond, google-play-respond, trustpilot-respond) similarly updated
- Remove global secrets dependency; all credentials come from `provider_connections`

### Phase 8: Cleanup

**Delete pages:** FootballAds, PushNotifications, EmailCampaigns, EmailCampaignDetail, BrandVisibility, BrandScoreSettings

**Delete components:** `football-ads/*`, `email/*`, push-related components

**Delete hooks:** useFootballFixtures, useFootballTeams, useFootballTeamScores, useGeneratedAds, usePushNotifications, useEmailCampaigns, useBrandScore, useBrandScoreHistory, useBrandScoreExplanations, useNPSMetrics, useBettingUsers, useSearchConsoleMetrics (if Brand Score only), useChannelWeights (if brand score only)

**Delete edge functions:** generate-football-ad, fetch-football-fixtures, fetch-betting-odds, schedule-match-push, cancel-match-push, generate-push-copy, schedule-email-broadcast, cancel-email-broadcast, generate-email-copy, calculate-brand-scores, calculate-nps-metrics, populate-funnel-metrics, populate-revenue-metrics, populate-user-ftd-dates

**Drop tables via migration:** football_fixtures, football_teams, football_team_scores, generated_football_ads, push_notification_schedules, email_campaign_schedules, email_campaign_settings, weekly_brand_scores, daily_nps_metrics, daily_revenue_metrics, daily_funnel_metrics, user_ftd_dates, user_identity_map, range_metrics_cache

**Drop DB functions:** All betting-specific `get_report_*` functions (they'll be replaced by generic versions in Phase 6)

**Update sidebar:** Remove Football Ads, Push Notifications, Canvas Scheduler, Brand Score entries. Remove Stakemate logo/branding, make app name configurable per org.

### Phase 9: Update Auth + Signup Flow

- Keep existing email/password auth
- After signup, auto-create profile and redirect to onboarding
- Invitation system stays (for adding team members to an org)
- Remove affiliate-specific role logic (or keep if affiliates are still relevant in multi-tenant context)

---

## Execution Order

Given the size, I recommend implementing in this order:
1. **Phase 8 (Cleanup)** first -- remove dead code to reduce noise
2. **Phase 1 (Data Model)** -- foundation for everything else
3. **Phase 2 (Org Context + Onboarding)** -- makes the app multi-tenant
4. **Phase 3 (Provider Connections)** -- core B2B feature
5. **Phase 4 (Conversion Events)** -- replaces hardcoded FTD logic
6. **Phase 5-6 (Trackers + Reports)** -- make dashboards work with new model
7. **Phase 7 (Edge Functions)** -- per-tenant data sync
8. **Phase 9 (Auth polish)** -- final onboarding flow

