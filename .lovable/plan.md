

# Meta OAuth "Connect with Facebook" Flow

## Problem
Currently users must manually create a Meta App, generate system user tokens, and paste credentials. This is error-prone and requires technical knowledge.

## Solution
Use the existing GrowthOS Meta App (META_APP_ID and META_APP_SECRET are already stored as secrets) to provide a "Connect with Facebook" OAuth flow. Users click a button, authorize via Facebook Login, and GrowthOS automatically retrieves their ad accounts and stores credentials.

## How It Works

```text
User clicks "Connect with Facebook"
        │
        ▼
Redirected to Facebook Login (OAuth)
        │
        ▼
User approves permissions (ads_read, ads_management)
        │
        ▼
Facebook redirects back with auth code
        │
        ▼
Edge function exchanges code for long-lived token
        │
        ▼
Edge function fetches user's ad accounts
        │
        ▼
User selects which ad account to use
        │
        ▼
Credentials saved to provider_connections
```

## File Changes

| File | Change |
|------|--------|
| `supabase/functions/meta-oauth-callback/index.ts` | **Create** — Exchange auth code for long-lived token, fetch available ad accounts, return them to the client |
| `supabase/functions/meta-oauth-save/index.ts` | **Create** — Save selected ad account + token to provider_connections |
| `src/pages/settings/ConnectionsSettings.tsx` | **Edit** — Replace manual Meta Ads fields with "Connect with Facebook" button + ad account selector dialog |

## Technical Details

### Edge Function: `meta-oauth-callback`
- Receives the `code` from Facebook OAuth redirect
- Uses META_APP_ID and META_APP_SECRET (already in secrets) to exchange for a short-lived token
- Exchanges short-lived token for a long-lived token (60-day expiry)
- Fetches the user's ad accounts via `GET /me/adaccounts`
- Returns the token + list of ad accounts to the frontend

### Edge Function: `meta-oauth-save`
- Receives the selected ad account ID + long-lived token
- Also fetches page ID and Instagram actor ID for the selected account
- Saves everything to `provider_connections` via the existing upsert pattern

### Frontend Changes
- For Meta Ads only: show a "Connect with Facebook" button that opens a popup/redirect to Facebook Login
- OAuth redirect URL points back to the app with a code parameter
- On return, call `meta-oauth-callback` to exchange the code
- Show a dialog listing available ad accounts for the user to pick
- On selection, call `meta-oauth-save` to persist
- Keep manual "Advanced" option for users who prefer system user tokens

### Facebook OAuth URL
```
https://www.facebook.com/v21.0/dialog/oauth
  ?client_id={META_APP_ID}
  &redirect_uri={window.location.origin}/settings/connections?meta_callback=1
  &scope=ads_read,ads_management,pages_read_engagement
  &response_type=code
```

The META_APP_ID is needed client-side for the OAuth URL. Since it's a public app ID (not a secret), it will be fetched via a small edge function or embedded as a non-secret config value.

