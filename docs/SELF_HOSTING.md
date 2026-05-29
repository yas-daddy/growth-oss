# Self-hosting GrowthOS

This guide walks through standing up your own GrowthOS instance: the Supabase backend, the database schema, the edge functions, and the secrets each integration needs.

GrowthOS has two halves:

- **Frontend** — a Vite/React app that reads three public `VITE_*` values from `.env`.
- **Backend** — a Supabase project (Postgres + Auth + edge functions). Edge functions hold all the privileged integration credentials as Supabase secrets.

> **What's actually required?** Only a Supabase project. Everything else is opt-in:
> the AI agent features need `OPENAI_API_KEY` (or any OpenAI-compatible endpoint), and
> each live data integration (Meta, Apple, AppsFlyer, …) needs its own credentials.
> To explore the app with synthetic data and **no integrations at all**, follow the
> [Quickstart in the README](../README.md#quickstart-demo-data-no-integrations) and load
> [`supabase/seed.sql`](../supabase/seed.sql) (see [Load demo data](#load-demo-data-optional) below).

## 1. Create a Supabase project

1. Sign up at [supabase.com](https://supabase.com) and create a new project.
2. From **Project Settings → API**, copy the **Project URL**, **Project ID** (the ref in the URL), and the **anon/public key**.
3. Put those into your frontend `.env`:

   ```bash
   cp .env.example .env
   ```

   ```env
   VITE_SUPABASE_URL="https://<your-ref>.supabase.co"
   VITE_SUPABASE_PROJECT_ID="<your-ref>"
   VITE_SUPABASE_PUBLISHABLE_KEY="<your-anon-key>"
   ```

> The anon key is safe to expose in the browser — row-level security (RLS) policies in the migrations are what protect your data. Never put the `service_role` key in the frontend.

## 2. Apply the database schema

Install the [Supabase CLI](https://supabase.com/docs/guides/cli), then link and push the migrations in `supabase/migrations`:

```bash
supabase login
supabase link --project-ref <your-ref>
supabase db push
```

This creates all tables, RLS policies, and the `handle_new_user()` trigger that provisions a profile and role on signup.

## 3. Deploy the edge functions

The functions in `supabase/functions` handle platform syncs, the AI agents, and webhooks.

```bash
supabase functions deploy
```

Supabase automatically injects `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` into every function — you do **not** set those yourself.

## 4. Set integration secrets

Set secrets with:

```bash
supabase secrets set KEY=value
```

Only set the secrets for the integrations you actually want to enable. Everything is optional except the AI key if you want the AI features.

### AI features (required for the AI agents)

| Secret | Notes |
|---|---|
| `OPENAI_API_KEY` | **Required for AI features.** Your OpenAI API key. |
| `OPENAI_BASE_URL` | Optional. Defaults to `https://api.openai.com/v1`. Point this at any OpenAI-compatible endpoint (Azure OpenAI, a proxy, a local model, another provider's compatible gateway). |
| `OPENAI_MODEL_FAST` | Optional. Cheap/fast model for text + structured tool calls. Defaults to `gpt-4o-mini`. |
| `OPENAI_MODEL_SMART` | Optional. Stronger model for vision and complex reasoning (used by the compliance checker). Defaults to `gpt-4o`. |

See [Swapping the AI provider](#swapping-the-ai-provider) if you'd rather use a non-OpenAI model.

### Email (invites & notifications)

| Secret | Notes |
|---|---|
| `RESEND_API_KEY` | [Resend](https://resend.com) API key, used by `send-invite-email`. |

### Meta Ads

| Secret | Notes |
|---|---|
| `META_ACCESS_TOKEN` | Business access token with `ads_read` and `ads_management`. |
| `META_AD_ACCOUNT_ID` | Ad account ID. |
| `META_APP_ID`, `META_APP_SECRET` | For the OAuth flow. |
| `META_PAGE_ID`, `META_INSTAGRAM_ACTOR_ID` | For creating ads/posts. |

### Apple Search Ads

| Secret | Notes |
|---|---|
| `APPLE_ADS_CLIENT_ID`, `APPLE_ADS_KEY_ID`, `APPLE_ADS_TEAM_ID`, `APPLE_ADS_ORG_ID`, `APPLE_ADS_PRIVATE_KEY` | Apple Search Ads API credentials. |

### App Store Connect (reviews & analytics)

| Secret | Notes |
|---|---|
| `APP_STORE_APP_ID`, `APP_STORE_ISSUER_ID`, `APP_STORE_KEY_ID`, `APP_STORE_PRIVATE_KEY` | App Store Connect API key. |

### Google Play (reviews & analytics)

| Secret | Notes |
|---|---|
| `GOOGLE_PLAY_PACKAGE_NAME` | Your app's package name. |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | Service account JSON (as a string). |

### Google Search Console

| Secret | Notes |
|---|---|
| `GOOGLE_SEARCH_CONSOLE_SITE_URL` | Verified property URL. |
| `GOOGLE_SEARCH_CONSOLE_SERVICE_ACCOUNT_JSON` | Service account JSON (as a string). |

### AppsFlyer

| Secret | Notes |
|---|---|
| `APPSFLYER_API_TOKEN` | AppsFlyer V2 API token. |
| `APPSFLYER_IOS_APP_ID` | iOS app ID. |
| `ONELINK_SUBDOMAIN` | Your AppsFlyer OneLink subdomain (used by `generate-onelink`). |
| `ONELINK_TEMPLATE_ID` | Your OneLink template ID. |

### Moloco

| Secret | Notes |
|---|---|
| `MOLOCO_API_KEY`, `MOLOCO_AD_ACCOUNT_ID` | Moloco API credentials. |

### Trustpilot

| Secret | Notes |
|---|---|
| `TRUSTPILOT_API_KEY`, `TRUSTPILOT_API_SECRET`, `TRUSTPILOT_BUSINESS_UNIT_ID`, `TRUSTPILOT_BUSINESS_USER_ID` | Trustpilot API credentials. |

> Some integrations also support storing per-organization credentials in the database (see `supabase/functions/_shared/tenant-credentials.ts`); the environment secrets above act as the default/fallback.

## 5. Run the frontend

```bash
npm install
npm run dev
```

Visit [http://localhost:8080](http://localhost:8080), create an account, and complete onboarding to create your organization.

## Load demo data (optional)

To explore the dashboards without wiring up any integration, load the demo seed **after** you've created your account and completed onboarding:

- **Supabase Dashboard → SQL Editor** → paste the contents of [`supabase/seed.sql`](../supabase/seed.sql) → **Run**, or
- `psql "$DATABASE_URL" -f supabase/seed.sql`

It keys off your first registered user and their organization, promotes that user to `admin`, and inserts ~90 days of ad spend, a set of reviews, and example AI recommendations. It's safe to re-run (it clears its own `demo-*` rows first). It covers the spend/channel dashboards, App Ratings, and Recommendations; funnel/revenue/keyword/creative pages may stay sparse until you connect real data.

## Swapping the AI provider

All seven AI functions go through a single shared client at `supabase/functions/_shared/ai.ts`, which POSTs to an OpenAI-compatible `/chat/completions` endpoint. You usually don't need to touch any function code:

- **Use a different OpenAI-compatible provider** (Azure OpenAI, OpenRouter, a local model, a proxy) — set `OPENAI_BASE_URL` to its base URL and `OPENAI_API_KEY` to the matching key. Override `OPENAI_MODEL_FAST` / `OPENAI_MODEL_SMART` with that provider's model names.
- **Use Anthropic (Claude)** — Claude's Messages API is *not* OpenAI-compatible, so either point `OPENAI_BASE_URL` at an OpenAI-compatible Claude proxy/gateway, or adapt the request/response mapping in `_shared/ai.ts` (the only file that builds the HTTP request).

The functions reference two model tiers — `AI_MODEL_FAST` (text + structured tool calls) and `AI_MODEL_SMART` (vision and complex reasoning, used by the compliance checker) — both defined in `_shared/ai.ts`.

## Troubleshooting

- **Signups fail with a trigger error** — make sure `supabase db push` succeeded so `handle_new_user()` exists.
- **AI features return "OPENAI_API_KEY is not configured"** — set the `OPENAI_API_KEY` secret on the project (`supabase secrets set OPENAI_API_KEY=...`).
- **AI features return a 402** — your AI provider account is out of credit/quota.
- **A sync returns 401/403** — the integration's token is missing, expired, or lacks the required scopes.
