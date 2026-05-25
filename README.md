# GrowthOS

> **Marketing command centre for acquisition performance analytics.**

GrowthOS is an open-source platform that unifies growth data and automates routine marketing workflows using AI agents. It's the open-source release of an internal tool built at [Stakemate](https://stakemate.com), where it serves as the daily command centre for growth, executive, finance, and product teams.

**Live demo:** [growth-os.kerad.me](http://growth-os.kerad.me)

**Talk:** [3 Powerful AI-Driven Growth Strategies (Business of Apps London, 2026)](https://www.businessofapps.com/video/3-powerful-ai-driven-growth-strategies-to-implement-in-2026/)

---

## Why GrowthOS

Growth teams spend a disproportionate amount of time on repetitive analytical work: pulling performance reports, checking creative fatigue, adjusting bids, responding to user reviews, running compliance checks before launch. Most of this is pattern-matching, not strategy.

GrowthOS automates these workflows. AI agents operate on top of a unified data layer and take action via APIs, so growth teams can focus on the work that actually requires human judgement.

## Features

- **Unified data layer** — pulls acquisition, spend, and conversion data from Meta Ads, AppsFlyer, Mixpanel, and other growth tools into a single Supabase-backed source of truth
- **AI agents** — analyse data, surface insights, and execute actions via API
- **Workflow automation** — pre-built templates for common growth tasks (see below)
- **Multi-team interface** — designed so growth, exec, finance, and product can all work from the same data
- **Review analyser** — extracts themes from user reviews to surface product and growth signals

## Automated workflows

The open-source version includes templates for:

| Workflow | What it does |
|---|---|
| Weekly performance reporting | Auto-generates a structured weekly report from connected ad platforms |
| Keyword bid adjustment | Surfaces bid recommendations based on performance thresholds |
| Creative fatigue analysis | Flags creatives showing performance decay |
| User review response generation | Drafts contextual replies to App Store / Play Store reviews |
| Pre-launch ad compliance checks | Validates new creatives against compliance rules before launch |
| CRM campaign scheduling | Manages CRM campaign cadence and segmentation |

## Tech stack

- **Frontend:** Vite, React 18, TypeScript, Tailwind CSS, shadcn-ui (Radix UI primitives)
- **State & data:** TanStack Query, react-hook-form, Zod
- **Backend:** Supabase (Postgres, Auth, Edge Functions)
- **Templating:** LiquidJS (used for agent prompt templates)
- **Charts:** Recharts
- **UI utilities:** Sonner (toasts), Lucide (icons), date-fns

## Getting started

### Prerequisites

- Node.js 18 or higher
- npm, pnpm, or Bun
- A Supabase project ([free tier works](https://supabase.com))
- API credentials for the integrations you want to enable

### Installation

```bash
