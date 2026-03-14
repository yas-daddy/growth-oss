

# Documentation / Feature Guide Pages

## Overview
Create a public-facing documentation section accessible from the landing page that explains every GrowthOS feature, how to set it up, and how to troubleshoot common issues. This will be a new `/docs` route with a sidebar navigation and individual feature articles.

## Architecture

- **New route**: `/docs` and `/docs/:slug` — public pages (no auth required)
- **New page**: `src/pages/Docs.tsx` — documentation hub with sidebar navigation and content rendering
- **Navigation**: Add "Docs" link to the landing page nav bar and footer
- **Content**: All documentation defined as structured data within the component (no CMS needed)

## Documentation Sections

Each section will cover: what it does, how to use it, setup requirements, and troubleshooting.

1. **Getting Started** — Creating an organisation, inviting team members, onboarding flow
2. **Connecting Partners** — How to connect Meta Ads, Apple Search Ads, Moloco, AppsFlyer, Mixpanel, Google Play, App Store, Trustpilot, Google Search Console; where to find API keys; troubleshooting connection errors
3. **Dashboards & KPIs** — Configurable dashboards, creating/editing dashboards, KPI cards, custom widgets
4. **Weekly & Monthly Trackers** — What they track, how metrics are calculated, conversion event dependency
5. **Projections** — How projections are calculated, EOM estimates, dependency on conversion events
6. **Launch Ads** — Meta ad creation workflow, media library, creative uploads, campaign/adset selection, troubleshooting API errors
7. **Campaign Performance** — Viewing campaign data across platforms, date filtering
8. **Creative Analysis** — AI-powered creative performance insights, fatigue detection
9. **Keyword Analysis** — Apple Search Ads keyword performance, AI recommendations, bid management
10. **Audience Analysis** — Meta demographic breakdowns, setup requirements
11. **Automation Rules** — Apple bid rules and Meta rules, creating/editing rules, execution history
12. **Competitor Ads** — Meta Ad Library search, setup
13. **App Ratings & Reviews** — Review monitoring across App Store, Google Play, Trustpilot; AI response suggestions; auto-response rules
14. **Compliance Checker** — Setting up compliance rules, running checks on creatives
15. **Conversion Events** — Defining primary/secondary events, how they affect CPA and tracker calculations
16. **CPA Targets** — Setting thresholds for the CPA thermometer
17. **AI Training** — Customising AI prompts for review responses and insights
18. **Users & Permissions** — Roles (admin, user, affiliate), inviting users, org-level access
19. **Affiliate Management** — Adding affiliates, generating tracking links, revenue tracking

## Implementation Details

- Single `Docs.tsx` page component with slug-based content routing
- Sidebar listing all doc sections with active state highlighting
- Each doc article rendered from a structured array with title, content (as JSX), and optional subsections
- Responsive layout: sidebar collapses on mobile into a dropdown/accordion
- Consistent styling with the rest of the landing page (public, no auth)
- Back-to-top and previous/next navigation between articles

## File Changes

| File | Change |
|------|--------|
| `src/pages/Docs.tsx` | **Create** — Full documentation page with all feature guides |
| `src/App.tsx` | Add `/docs` and `/docs/:slug` routes |
| `src/pages/LandingPage.tsx` | Add "Docs" link to nav bar and footer |

