
# Revised Plan: Multi-Tenant B2B SaaS Revamp

## Phase 8: Cleanup ✅ DONE

Completed:
- Deleted pages: FootballAds, PushNotifications, EmailCampaigns, EmailCampaignDetail, BrandVisibility, BrandScoreSettings, PushSettings, RatingWeightsSettings
- Deleted components: football-ads/*, email/*
- Deleted hooks: useFootballFixtures, useFootballTeams, useFootballTeamScores, useGeneratedAds, usePushNotifications, useEmailCampaigns, useBrandScore, useBrandScoreHistory, useBrandScoreExplanations, useNPSMetrics, useBettingUsers, useChannelWeights, useFunnelData, useUserIdentityMap, useReferralSignups, useAdTemplates
- Deleted edge functions: generate-football-ad, fetch-football-fixtures, fetch-betting-odds, schedule-match-push, cancel-match-push, generate-push-copy, schedule-email-broadcast, cancel-email-broadcast, generate-email-copy, calculate-brand-scores, calculate-nps-metrics, populate-funnel-metrics, populate-revenue-metrics, populate-user-ftd-dates
- Dropped tables: football_fixtures, football_teams, football_team_scores, generated_football_ads, push_notification_schedules, email_campaign_schedules, email_campaign_settings, weekly_brand_scores, daily_nps_metrics, daily_revenue_metrics, daily_funnel_metrics, user_ftd_dates, user_identity_map, range_metrics_cache, channel_weights, brand_score_explanations
- Dropped 30+ betting-specific DB functions
- Updated App.tsx routes, AppSidebar nav, Settings page, usePageVisitTracker, useSyncFunctionLogs
- Removed Stakemate logo/branding, removed Beta badge
- Cast remaining RPC calls to `any` for type safety until generic replacements are built

## Remaining Phases

### Phase 1: Multi-Tenant Data Model ✅ DONE
- Created tables: organizations, organization_members, provider_connections, conversion_events, tracker_metric_config
- Created enums: org_role, provider_type, auth_method, connection_status
- Created security definer functions: is_org_member, is_org_admin, get_user_org_ids
- RLS policies scoped by org membership on all new tables
- Added onboarding_completed to profiles
- Note: org_id on existing data tables deferred to Phase 6 (when report functions are reworked)

### Phase 2: Organization Context + Onboarding ✅ DONE
- Created useOrganization React context (resolves user's org from organization_members)
- Built 3-step onboarding flow: Create Org → Select Providers → Define Conversion Events
- Updated Index.tsx to redirect to /onboarding if not completed
- Wrapped App with OrganizationProvider
- Added /onboarding route to App.tsx

### Phase 3: Provider Connections Settings Page ✅ DONE
- Created useProviderConnections hook (CRUD for provider_connections table)
- Rewrote ConnectionsSettings as "Partners" page with per-provider connect/disconnect dialogs
- 9 providers with field definitions, instructions, and docs links
- Settings hub updated to show "Partners" instead of "API Connections"

### Phase 4: Conversion Events Settings ✅ DONE
- Created useConversionEvents hook (CRUD with primary event management)
- Built ConversionEventsSettings page with create/edit/delete/set-primary
- Added route and Settings hub entry

### Phase 5: Rework Weekly/Monthly Tracker ✅ DONE
- Created shared `src/lib/trackerMetricDefinitions.ts` with data-driven metric definitions (key, label, section, format, getValue, invertColors)
- Created `src/hooks/useTrackerMetricConfig.tsx` hook to fetch org-specific `tracker_metric_config` rows, with fallback to defaults
- Refactored WeeklyTracker and MonthlyTracker to render table rows dynamically from metric definitions
- CSV export also driven by the same metric definitions
- Orgs can customize visible metrics and labels via `tracker_metric_config` table

### Phase 6: Rework Dashboard Report Functions ✅ DONE
- Added org_id (FK to organizations) to report_definitions and dashboard_configs
- Added unique constraints: (org_id, slug) and (org_id, dashboard_slug)
- Replaced admin-only RLS with org-scoped policies (is_org_admin for writes, is_org_member for reads)
- Created generic conversion-event-aware RPC functions:
  - get_report_conversions(p_start_date, p_end_date, p_event_name)
  - get_report_blended_cpa_generic(p_start_date, p_end_date, p_event_name)
  - get_report_cpa_excl_affiliates_generic(p_start_date, p_end_date, p_event_name)
  - get_report_conversions_by_channel(p_start_date, p_end_date, p_event_name)
  - get_report_cpa_by_channel_generic(p_start_date, p_end_date, p_event_name)
- Updated useDashboardConfig to filter by org_id, pass org_id on create
- Updated useReportDefinitions to filter by org_id
- Updated useReport to pass eventName from config to generic RPC functions
- ReportConfig now supports eventName override for conversion-event-aware functions

### Phase 7: Update Edge Functions for Per-Tenant Credentials ✅ DONE
- Created `_shared/tenant-credentials.ts`: resolves credentials from `provider_connections` table with env-var fallback per provider
- Created `_shared/org-resolver.ts`: resolves user identity and org context from request (supports both interactive and cron/service-role calls)
- Updated core sync functions to use tenant credentials: meta-sync-campaigns, meta-sync-ads, apple-sync-campaigns, moloco-sync-campaigns, appsflyer-sync, mixpanel-sync
- Updated meta-sync-rules, meta-get-account-id to use tenant credentials
- Updated useMetaCampaigns hook to pass org_id to edge functions
- Remaining non-sync Meta/Moloco functions (meta-create-ad, meta-pause-ad, meta-list-media, etc.) still use env fallback but are resolved via the same shared helpers pattern; to be updated incrementally
- `updateLastSyncedAt` and `markProviderError` helpers maintain provider connection status after syncs

### Phase 9: Auth + Signup Flow Polish ✅ DONE
- Reworked Auth.tsx: sign-in is default mode; sign-up only available via "Have an invitation?" link (invite-only system)
- Added invitation deep-link support: `/auth?invite=true&email=...` pre-fills email and opens signup mode
- Added forgot password flow with `resetPasswordForEmail` redirecting to `/reset-password`
- Created ResetPassword.tsx page: handles PASSWORD_RECOVERY event, password update with confirmation
- Graceful error handling for "Signup not allowed" trigger rejection (shows "Invitation Required" message)
- Updated send-invite-email edge function: signup URL now includes `?invite=true&email=` params; rebranded from Stakemate to GrowthOS
- Added `/reset-password` route to App.tsx
