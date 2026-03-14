

# Landing Page for GrowthOS

## Overview
Create a public marketing landing page at the root route (`/`) that sells GrowthOS by highlighting its key USPs and walking prospects through the setup process. The current `Index.tsx` (auth redirect logic) will move to a separate route, and the landing page will be the new default.

## Route Changes
- **New file**: `src/pages/LandingPage.tsx` — the public marketing page
- **`src/pages/Index.tsx`**: Keep as-is but mount at `/app` (or inline the redirect logic into `DashboardLayout`)
- **`src/App.tsx`**: Route `/` to `LandingPage`, move Index redirect logic to `/app`

## Landing Page Sections

1. **Hero** — Bold headline ("Grow smarter, not harder"), subheadline explaining the all-in-one growth platform, primary CTA ("Get Started" links to `/auth`), secondary CTA ("Book a Demo")
2. **Logo bar** — "Integrates with" strip showing partner logos (Meta, Apple Search Ads, Moloco, AppsFlyer, Mixpanel, Trustpilot)
3. **USP Feature Cards** (3-column grid):
   - **Central Tracking** — Unified dashboard across all ad platforms and affiliates, weekly/monthly trackers, custom KPIs
   - **Launch & Manage Ads** — Create and manage Meta, Apple, Moloco campaigns from one place
   - **AI Automation & Optimisation** — Automated rules, budget recommendations, creative fatigue detection, keyword analysis
4. **How It Works** — 4-step numbered walkthrough:
   1. Create your organization
   2. Connect your ad platforms & data sources
   3. Define your conversion events
   4. Start tracking, launching, and optimising
5. **Social Proof / Stats** — Placeholder metrics ("Track 9+ platforms", "AI-powered automation", "Multi-tenant ready")
6. **CTA Banner** — Final call-to-action block with "Start Free" button
7. **Footer** — Minimal with copyright

## Design Approach
- Fully responsive, dark hero section with gradient, light content sections
- Uses existing Tailwind theme colors and shadcn/ui components (Button, Card, Badge)
- No new dependencies needed
- Lucide icons for feature illustrations
- Smooth scroll animations via CSS `animate-` classes already in the project

## Technical Notes
- Landing page is public (no auth required)
- If user is already authenticated, show a "Go to Dashboard" button in the nav instead of "Sign In"
- Uses `useAuth` to check login state but does not require it
- The existing redirect logic in `Index.tsx` moves to a new `/app` catch-all or is embedded into the `DashboardLayout` component

