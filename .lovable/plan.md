

# Replace External Doc Links with Inline Setup Guides

## What Changes

Replace the `docsUrl` external link and short `instructions` string on each provider with a detailed `setupGuide` — an array of step-by-step instructions rendered as a numbered blog-style guide inside the connect dialog.

## Approach

### 1. Update the `ProviderDef` interface
- Remove `docsUrl` field
- Replace `instructions` (single string) with `setupGuide: string[]` — each entry is one numbered step
- Remove the external link button from the provider card row

### 2. Write detailed step-by-step guides for each provider

Each guide will be plain-language, non-technical, telling the user exactly where to click:

- **Meta Ads** — Navigate to Business Settings, create System User, generate long-lived token with `ads_read` + `ads_management`, copy Ad Account ID
- **Apple Search Ads** — Go to searchads.apple.com, Settings > API, create API certificate, download private key, copy Client ID / Team ID / Key ID / Org ID
- **Moloco** — Log into Moloco dashboard, Settings, copy API Key and Ad Account ID, find Platform ID
- **AppsFlyer** — Dashboard > Settings > API Access, copy V2 token, note your App ID
- **Mixpanel** — Project Settings, copy Project ID and API Secret
- **App Store Connect** — Users and Access > Integrations > App Store Connect API, create key, download .p8, note Key ID / Issuer ID / App ID
- **Google Play Console** — Google Cloud Console, create Service Account, grant access in Play Console, download JSON key, note package name
- **Trustpilot** — Business portal > Integrations > API, copy API key/secret/Business Unit ID, note login credentials
- **Google Search Console** — Google Cloud Console, create Service Account, add as user in Search Console, download JSON, note site URL

### 3. Update the Connect Dialog UI
- Show the steps as a numbered list with nice typography above the form fields
- Use an expandable/collapsible section so the guide doesn't overwhelm users who already know what to do
- Style: subtle background, numbered steps with `text-sm`, collapsible via a "How to get these credentials" toggle

### 4. Remove external link button
- Remove the `ExternalLink` icon button from each provider card since the guide is now inline

### Files to edit
- `src/pages/settings/ConnectionsSettings.tsx` — all changes in this single file

