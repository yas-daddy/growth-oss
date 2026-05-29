# GrowthOS

> **An open-source marketing command centre for mobile app growth — built on Supabase, automated with AI agents.**

GrowthOS unifies acquisition, spend, and conversion data from your growth stack into a single source of truth, then layers AI agents on top to automate the repetitive analytical work: performance reporting, bid adjustments, creative-fatigue checks, review responses, and pre-launch compliance.

It started life as an internal tool for a mobile app growth team and is open-sourced here so others don't have to build the same plumbing from scratch. Take the whole thing, fork the parts you need, or just read the code to see how a real growth-analytics platform fits together.

**Live demo:** [growth-os.kerad.me](http://growos.tech) · **Talk:** [3 Powerful AI-Driven Growth Strategies (Business of Apps London, 2026)](https://www.businessofapps.com/video/3-powerful-ai-driven-growth-strategies-to-implement-in-2026/)

---

## Why we're sharing this

Most growth teams rebuild the same infrastructure over and over: pipelines to pull Meta/Apple/AppsFlyer/Mixpanel data, a warehouse to unify it, dashboards on top, and a thin layer of automation for the boring decisions. That plumbing takes months and rarely gets shared.

GrowthOS is that plumbing, working end-to-end, released under the MIT license. The goal is knowledge-sharing: a reference for how to architect a Supabase-backed analytics product with AI agents and a dozen ad-platform integrations — and a head start for anyone building something similar. Use it however you want.

## What this is (and isn't)

**This is** a complete, real-world codebase: a React frontend, a Supabase backend (Postgres + Auth + ~50 edge functions), and ~100 tables modelling growth data. It's the best kind of reference — one that actually ran in production.

**This isn't** a turnkey SaaS you point at your business and switch on. The value comes from the integrations, and each (Meta, Apple Search Ads, AppsFlyer, etc.) needs its own account and API credentials. The data model and some defaults also carry their origins in the **mobile app / performance-marketing** space (e.g. installs, FTDs, app-store reviews). Expect to adapt, not just deploy.

**Best suited for:**
- Growth/marketing engineers who want a reference architecture for unified analytics + AI agents
- Mobile app growth teams who can adopt large parts of it directly
- Anyone who wants a running skeleton to fork and reshape

You can have the app running locally with **realistic demo data and zero integrations** in about 15 minutes — see the [Quickstart](#quickstart-demo-data-no-integrations) below.

## Features

- **Unified data layer** — pulls acquisition, spend, and conversion data from Meta Ads, Apple Search Ads, AppsFlyer, Mixpanel, Moloco, and more into one Supabase-backed source of truth
- **AI agents** — analyse data, surface insights, and execute actions via API (OpenAI by default; any OpenAI-compatible provider works)
- **Configurable dashboards** — build views over spend, channels, funnel, revenue, and cohorts
- **Workflow automation** — pre-built templates for common growth tasks (below)
- **Review analyser** — extracts themes from App Store / Play Store / Trustpilot reviews and drafts responses

## Automated workflows

| Workflow | What it does |
|---|---|
| Weekly performance reporting | Auto-generates a structured weekly report from connected ad platforms |
| Keyword bid adjustment | Surfaces bid recommendations based on performance thresholds |
| Creative fatigue analysis | Flags creatives showing performance decay |
| User review response generation | Drafts contextual replies to App Store / Play Store / Trustpilot reviews |
| Pre-launch ad compliance checks | Validates new creatives (incl. video, via vision models) against compliance rules |
| CRM campaign scheduling | Manages CRM campaign cadence and segmentation |

## Tech stack

- **Frontend:** Vite, React 18, TypeScript, Tailwind CSS, shadcn-ui (Radix UI primitives)
- **State & data:** TanStack Query, react-hook-form, Zod
- **Backend:** Supabase (Postgres, Auth, Edge Functions on Deno)
- **AI:** OpenAI-compatible chat completions (configurable provider)
- **Charts:** Recharts · **Templating:** LiquidJS · **UI:** Sonner, Lucide, date-fns

## Quickstart (demo data, no integrations)

This gets you a running app with realistic synthetic data and **no ad-platform credentials**. You'll need [Node.js 18+](https://nodejs.org), the [Supabase CLI](https://supabase.com/docs/guides/cli), and a free [Supabase](https://supabase.com) project.

```bash
# 1. Clone and install
git clone https://github.com/yas-daddy/growth-oss.git
cd growth-oss
npm install
```

**2. Create a Supabase project** at [supabase.com](https://supabase.com). From **Project Settings → API**, copy the Project URL, Project ID (the ref), and the anon key.

```bash
# 3. Point the frontend at your project
cp .env.example .env
# edit .env with your VITE_SUPABASE_URL, VITE_SUPABASE_PROJECT_ID, VITE_SUPABASE_PUBLISHABLE_KEY
```

```bash
# 4. Apply the database schema
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

```bash
# 5. Run the app
npm run dev          # http://localhost:8080
```

**6. Create your account** in the app and complete onboarding (this creates your organization).

**7. Load the demo data.** Open your Supabase dashboard → **SQL Editor**, paste the contents of [`supabase/seed.sql`](supabase/seed.sql), and run it. It keys off your new account and fills the dashboards with ~90 days of spend, reviews, and AI recommendations.

Refresh the app — the spend/channel dashboards, App Ratings, and Recommendations pages are now populated. No Meta/Apple/AppsFlyer accounts required.

> The AI agent features (review drafting, compliance checks, recommendations generation) additionally need an `OPENAI_API_KEY` — see below. The demo seed pre-fills example recommendations so the Recommendations page isn't empty without one.

## Going further: integrations & AI

Everything beyond the demo is **opt-in**. Add only what you need.

| Capability | Requires | Optional? |
|---|---|---|
| Browse dashboards with demo data | Supabase only | — (this is the quickstart) |
| AI agents (review replies, compliance, recommendations) | `OPENAI_API_KEY` (or any OpenAI-compatible endpoint) | Optional |
| Email invites | `RESEND_API_KEY` | Optional |
| Live Meta Ads data | Meta Business app + tokens | Optional |
| Live Apple Search Ads / App Store data | Apple API keys | Optional |
| Live AppsFlyer / Mixpanel / Moloco / Google Play / Trustpilot | Each platform's API credentials | Optional |

Edge functions read these from **Supabase secrets** (`supabase secrets set KEY=value`), not the frontend `.env`. Deploy them with `supabase functions deploy`. The full secret list, per integration, plus how to swap the AI provider, is in [`docs/SELF_HOSTING.md`](docs/SELF_HOSTING.md).

## Project structure

```
src/
  components/      UI built on shadcn-ui + Radix primitives
  hooks/           data-fetching and app logic (TanStack Query)
  pages/           top-level routes (dashboards, settings, auth, etc.)
  integrations/    generated Supabase client + types
  lib/             shared utilities
supabase/
  functions/       Deno edge functions (platform syncs, AI agents, webhooks)
    _shared/ai.ts  single AI client used by all AI functions
  migrations/      database schema history
  seed.sql         demo data for the quickstart
docs/
  SELF_HOSTING.md  full backend + integrations setup
```

## Contributing

Contributions are welcome. See [`CONTRIBUTING.md`](CONTRIBUTING.md) for environment setup, conventions, and how to open a pull request.

## License

Released under the [MIT License](LICENSE) — use it however you want.
