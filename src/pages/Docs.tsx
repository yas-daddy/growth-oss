import { useState, useEffect, useRef } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import gosLogo from '@/assets/gos-logo.png';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BookOpen,
  BarChart3,
  Rocket,
  Brain,
  Plug,
  LayoutDashboard,
  CalendarDays,
  TrendingUp,
  Megaphone,
  LineChart,
  Palette,
  Search,
  Users,
  Zap,
  Eye,
  Star,
  ShieldCheck,
  SlidersHorizontal,
  Target,
  Sparkles,
  UserCog,
  Handshake,
  Menu,
  X,
} from 'lucide-react';

/* ─── Article data ─── */
interface DocArticle {
  slug: string;
  title: string;
  icon: React.ElementType;
  content: React.ReactNode;
}

const articles: DocArticle[] = [
  {
    slug: 'getting-started',
    title: 'Getting Started',
    icon: BookOpen,
    content: (
      <>
        <h2 className="text-2xl font-bold mb-4">Getting Started with GrowthOS</h2>
        <p className="text-muted-foreground mb-6 leading-relaxed">GrowthOS is an all-in-one growth platform that consolidates ad management, analytics, reviews, and AI-powered automation into a single dashboard. Here's how to get up and running.</p>

        <h3 className="text-lg font-semibold mt-8 mb-3">1. Create Your Account</h3>
        <p className="text-muted-foreground mb-4 leading-relaxed">Visit the sign-up page and create your account with an email and password. You'll receive a verification email — click the link to activate your account.</p>

        <h3 className="text-lg font-semibold mt-8 mb-3">2. Create or Join an Organisation</h3>
        <p className="text-muted-foreground mb-4 leading-relaxed">After your first sign-in you'll be guided through the onboarding flow. Create a new organisation (your workspace) or accept an invitation to join an existing one. All data — dashboards, campaigns, settings — is scoped to the organisation level, so team members see the same data.</p>

        <h3 className="text-lg font-semibold mt-8 mb-3">3. Invite Your Team</h3>
        <p className="text-muted-foreground mb-4 leading-relaxed">Navigate to <strong>Settings → Users</strong> and invite team members by email. You can assign roles: <em>Admin</em> (full access including settings), <em>User</em> (read/write on dashboards & campaigns), or <em>Affiliate</em> (limited to affiliate-specific views).</p>

        <h3 className="text-lg font-semibold mt-8 mb-3">4. Connect Your Platforms</h3>
        <p className="text-muted-foreground mb-4 leading-relaxed">Head to <strong>Settings → Connections</strong> and add API keys for the platforms you use. See the <em>Connecting Partners</em> guide for step-by-step instructions for each platform.</p>

        <h3 className="text-lg font-semibold mt-8 mb-3">5. Define Conversion Events</h3>
        <p className="text-muted-foreground mb-4 leading-relaxed">Go to <strong>Settings → Conversion Events</strong> and define your primary conversion event (e.g. <code className="bg-muted px-1.5 py-0.5 rounded text-sm">af_purchase</code>) and any secondary events. These events power CPA calculations, tracker pages, and projections.</p>

        <h3 className="text-lg font-semibold mt-8 mb-3">Troubleshooting</h3>
        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
          <li><strong>Verification email not arriving?</strong> Check your spam folder. If still missing, try signing up again with the same email.</li>
          <li><strong>Can't see data after connecting?</strong> Data syncs run periodically. Trigger a manual sync from <strong>Settings → Syncs</strong> or wait up to 15 minutes.</li>
          <li><strong>Wrong organisation?</strong> Use the organisation switcher in the sidebar to select the correct workspace.</li>
        </ul>
      </>
    ),
  },
  {
    slug: 'connecting-partners',
    title: 'Connecting Partners',
    icon: Plug,
    content: (
      <>
        <h2 className="text-2xl font-bold mb-4">Connecting Partners</h2>
        <p className="text-muted-foreground mb-6 leading-relaxed">GrowthOS integrates with 9+ platforms. Each connection requires an API key or credentials that you configure once in <strong>Settings → Connections</strong>.</p>

        <h3 className="text-lg font-semibold mt-8 mb-3">Supported Platforms</h3>
        <div className="grid sm:grid-cols-2 gap-4 mb-8">
          {[
            { name: 'Meta Ads', desc: 'Requires a Meta Business access token with ads_read and ads_management permissions.' },
            { name: 'Apple Search Ads', desc: 'Generate an API key from the Apple Search Ads dashboard under Settings → API.' },
            { name: 'Moloco', desc: 'Provide your Moloco API key and Ad Account ID from the Moloco console.' },
            { name: 'AppsFlyer', desc: 'Use your AppsFlyer API token (V2) found under Integration → API Access.' },
            { name: 'Mixpanel', desc: 'Create a service account in Mixpanel project settings and provide the credentials.' },
            { name: 'Google Play Console', desc: 'Create a service account with Play Console access and upload the JSON key.' },
            { name: 'App Store Connect', desc: 'Generate an API key in App Store Connect → Users and Access → Keys.' },
            { name: 'Trustpilot', desc: 'Provide your Trustpilot Business API key and Business Unit ID.' },
            { name: 'Google Search Console', desc: 'Provide a service account JSON key with read access to your Search Console property.' },
          ].map((p) => (
            <div key={p.name} className="border border-border rounded-lg p-4">
              <h4 className="font-semibold mb-1">{p.name}</h4>
              <p className="text-sm text-muted-foreground">{p.desc}</p>
            </div>
          ))}
        </div>

        <h3 className="text-lg font-semibold mt-8 mb-3">How to Add a Connection</h3>
        <ol className="list-decimal pl-6 space-y-2 text-muted-foreground mb-6">
          <li>Navigate to <strong>Settings → Connections</strong>.</li>
          <li>Click the provider card for the platform you want to connect.</li>
          <li>Enter the required API key or credentials.</li>
          <li>Click <strong>Save</strong>. GrowthOS will validate the credentials and start an initial sync.</li>
        </ol>

        <h3 className="text-lg font-semibold mt-8 mb-3">Troubleshooting</h3>
        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
          <li><strong>Invalid credentials error:</strong> Double-check the API key. Some platforms require specific scopes or roles — refer to the platform's docs.</li>
          <li><strong>Data not appearing:</strong> After saving credentials, an initial sync is triggered. Check <strong>Settings → Syncs</strong> for the sync status and any error logs.</li>
          <li><strong>Token expired:</strong> Some platforms issue short-lived tokens. Re-enter fresh credentials if your sync starts failing.</li>
        </ul>
      </>
    ),
  },
  {
    slug: 'dashboards',
    title: 'Dashboards & KPIs',
    icon: LayoutDashboard,
    content: (
      <>
        <h2 className="text-2xl font-bold mb-4">Dashboards & KPIs</h2>
        <p className="text-muted-foreground mb-6 leading-relaxed">GrowthOS ships with default dashboards (Revenue, Channels, Affiliates, Funnel) and lets you create unlimited custom dashboards tailored to your workflow.</p>

        <h3 className="text-lg font-semibold mt-8 mb-3">What It Does</h3>
        <p className="text-muted-foreground mb-4 leading-relaxed">Each dashboard is a collection of <em>reports</em> — visual widgets that pull data from your connected platforms. Reports include charts, tables, KPI cards, and funnels. You can mix and match reports across dashboards.</p>

        <h3 className="text-lg font-semibold mt-8 mb-3">Creating a Dashboard</h3>
        <ol className="list-decimal pl-6 space-y-2 text-muted-foreground mb-6">
          <li>Click <strong>Manage Dashboards</strong> in the sidebar or from the dashboard options menu.</li>
          <li>Click <strong>Create Dashboard</strong> and give it a name, icon, and optional description.</li>
          <li>Add reports by clicking <strong>Edit</strong> on the dashboard and selecting from the available report catalogue.</li>
          <li>Reorder reports by dragging them into position.</li>
        </ol>

        <h3 className="text-lg font-semibold mt-8 mb-3">KPI Cards</h3>
        <p className="text-muted-foreground mb-4 leading-relaxed">KPI cards sit at the top of dashboards and show key metrics like total spend, installs, CPA, and revenue. They automatically compare to the previous period and show percentage change.</p>

        <h3 className="text-lg font-semibold mt-8 mb-3">Troubleshooting</h3>
        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
          <li><strong>Dashboard shows no data:</strong> Ensure you have at least one platform connected and synced. Check the date range filter.</li>
          <li><strong>Can't delete a dashboard:</strong> Default system dashboards cannot be deleted. Custom dashboards can be removed from the Manage Dashboards dialog.</li>
        </ul>
      </>
    ),
  },
  {
    slug: 'trackers',
    title: 'Weekly & Monthly Trackers',
    icon: CalendarDays,
    content: (
      <>
        <h2 className="text-2xl font-bold mb-4">Weekly & Monthly Trackers</h2>
        <p className="text-muted-foreground mb-6 leading-relaxed">Trackers give you a spreadsheet-style view of your key metrics over time, broken down by week or month.</p>

        <h3 className="text-lg font-semibold mt-8 mb-3">What They Track</h3>
        <p className="text-muted-foreground mb-4 leading-relaxed">By default, trackers display spend, installs/conversions, CPA, revenue, and ROI across all connected platforms. The metrics are configurable — you can add or remove columns to match your reporting needs.</p>

        <h3 className="text-lg font-semibold mt-8 mb-3">How Metrics Are Calculated</h3>
        <p className="text-muted-foreground mb-4 leading-relaxed">Tracker metrics aggregate daily data from your synced platforms. CPA is calculated using your primary conversion event (set in <strong>Settings → Conversion Events</strong>). If no primary event is set, CPA columns will show zero.</p>

        <h3 className="text-lg font-semibold mt-8 mb-3">Configuring Columns</h3>
        <ol className="list-decimal pl-6 space-y-2 text-muted-foreground mb-6">
          <li>Open the Weekly or Monthly tracker page.</li>
          <li>Click the <strong>Configure</strong> button.</li>
          <li>Toggle metrics on/off and reorder them as needed.</li>
          <li>Changes are saved per-organisation so all team members see the same layout.</li>
        </ol>

        <h3 className="text-lg font-semibold mt-8 mb-3">Troubleshooting</h3>
        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
          <li><strong>CPA shows as 0:</strong> Make sure you've defined a primary conversion event in Settings → Conversion Events.</li>
          <li><strong>Missing weeks/months:</strong> Data only appears for periods where sync data exists. Check your sync logs for gaps.</li>
        </ul>
      </>
    ),
  },
  {
    slug: 'projections',
    title: 'Projections',
    icon: TrendingUp,
    content: (
      <>
        <h2 className="text-2xl font-bold mb-4">Projections</h2>
        <p className="text-muted-foreground mb-6 leading-relaxed">The Projections page forecasts your end-of-month performance based on current spend velocity and conversion rates.</p>

        <h3 className="text-lg font-semibold mt-8 mb-3">How Projections Work</h3>
        <p className="text-muted-foreground mb-4 leading-relaxed">GrowthOS looks at your spend and conversions so far this month, calculates daily averages, and extrapolates to the end of the month. It also factors in budget limits set per platform.</p>

        <h3 className="text-lg font-semibold mt-8 mb-3">Setup Requirements</h3>
        <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-6">
          <li>At least one connected ad platform with active sync data.</li>
          <li>A primary conversion event defined in <strong>Settings → Conversion Events</strong>.</li>
          <li>Optionally, platform budgets set in the settings to improve accuracy of projections.</li>
        </ul>

        <h3 className="text-lg font-semibold mt-8 mb-3">Troubleshooting</h3>
        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
          <li><strong>Projections seem inaccurate:</strong> Projections are based on the current month's data. Early in the month, small sample sizes can cause volatility.</li>
          <li><strong>No projection shown:</strong> Ensure you have synced data for the current month and a primary conversion event configured.</li>
        </ul>
      </>
    ),
  },
  {
    slug: 'launch-ads',
    title: 'Launch Ads',
    icon: Rocket,
    content: (
      <>
        <h2 className="text-2xl font-bold mb-4">Launch Ads</h2>
        <p className="text-muted-foreground mb-6 leading-relaxed">Create and launch ads on Meta and Moloco directly from GrowthOS — no need to switch between platform UIs.</p>

        <h3 className="text-lg font-semibold mt-8 mb-3">Meta Ad Creation Workflow</h3>
        <ol className="list-decimal pl-6 space-y-2 text-muted-foreground mb-6">
          <li><strong>Select a campaign and ad sets</strong> — GrowthOS fetches your existing campaigns and ad sets from Meta.</li>
          <li><strong>Upload or select media</strong> — Use the Media Library to upload images/videos or pick from previously uploaded assets.</li>
          <li><strong>Fill in ad copy</strong> — Enter primary text, headline(s), description, destination URL, and call-to-action. You can set defaults in <strong>Settings → Ad Platforms</strong> to speed this up.</li>
          <li><strong>Review & Launch</strong> — Preview your ad, then click Launch. GrowthOS will create the ad across all selected ad sets.</li>
        </ol>

        <h3 className="text-lg font-semibold mt-8 mb-3">Moloco Ad Creation</h3>
        <p className="text-muted-foreground mb-4 leading-relaxed">For Moloco, the workflow involves selecting a campaign, uploading creatives, selecting a tracking link, and attaching the creative group to an ad group.</p>

        <h3 className="text-lg font-semibold mt-8 mb-3">Ad Launch History</h3>
        <p className="text-muted-foreground mb-4 leading-relaxed">Every launch attempt is recorded in the launch history panel. You can review past launches, see which ad sets were targeted, and check for any errors.</p>

        <h3 className="text-lg font-semibold mt-8 mb-3">Troubleshooting</h3>
        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
          <li><strong>Campaign list is empty:</strong> Ensure your Meta or Moloco API key has the correct permissions and has been synced recently.</li>
          <li><strong>Launch failed with API error:</strong> Check the error message in the launch history. Common issues include expired tokens, insufficient permissions, or invalid media formats.</li>
          <li><strong>Media upload fails:</strong> Ensure the file is under the size limit (images: 30 MB, videos: 4 GB for Meta). Supported formats: JPG, PNG, MP4, MOV.</li>
        </ul>
      </>
    ),
  },
  {
    slug: 'campaign-performance',
    title: 'Campaign Performance',
    icon: LineChart,
    content: (
      <>
        <h2 className="text-2xl font-bold mb-4">Campaign Performance</h2>
        <p className="text-muted-foreground mb-6 leading-relaxed">View and compare campaign performance across all connected platforms in a single unified table.</p>

        <h3 className="text-lg font-semibold mt-8 mb-3">What It Shows</h3>
        <p className="text-muted-foreground mb-4 leading-relaxed">The Campaign Performance page pulls data from Meta Ads, Apple Search Ads, Moloco, and AppsFlyer. It displays metrics like spend, impressions, clicks, installs, CPA, and revenue in a sortable, filterable table.</p>

        <h3 className="text-lg font-semibold mt-8 mb-3">Filtering & Date Ranges</h3>
        <p className="text-muted-foreground mb-4 leading-relaxed">Use the date range filter to narrow results to a specific period. You can also filter by platform, campaign status, or search by campaign name.</p>

        <h3 className="text-lg font-semibold mt-8 mb-3">Troubleshooting</h3>
        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
          <li><strong>No campaigns listed:</strong> Check that at least one ad platform is connected and synced.</li>
          <li><strong>Metrics seem stale:</strong> Data refreshes on each sync cycle. Trigger a manual sync from Settings → Syncs.</li>
        </ul>
      </>
    ),
  },
  {
    slug: 'creative-analysis',
    title: 'Creative Analysis',
    icon: Palette,
    content: (
      <>
        <h2 className="text-2xl font-bold mb-4">Creative Analysis</h2>
        <p className="text-muted-foreground mb-6 leading-relaxed">Understand which creatives are performing best and which are showing signs of fatigue — powered by AI.</p>

        <h3 className="text-lg font-semibold mt-8 mb-3">What It Does</h3>
        <p className="text-muted-foreground mb-4 leading-relaxed">The Creative Analysis page shows performance metrics for individual ads/creatives from Meta and Moloco. It includes spend, impressions, CTR, CPA, and conversion data per creative.</p>

        <h3 className="text-lg font-semibold mt-8 mb-3">AI Creative Fatigue Detection</h3>
        <p className="text-muted-foreground mb-4 leading-relaxed">GrowthOS uses AI to analyse creative performance trends and predict when a creative is approaching fatigue. It provides a fatigue status (healthy, warning, fatigued), a confidence score, and a recommended action (e.g. "Replace within 5 days").</p>

        <h3 className="text-lg font-semibold mt-8 mb-3">Setup Requirements</h3>
        <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-6">
          <li>Meta Ads or Moloco connected with daily ad-level spend data syncing.</li>
          <li>At least 7 days of creative data for meaningful fatigue analysis.</li>
        </ul>

        <h3 className="text-lg font-semibold mt-8 mb-3">Troubleshooting</h3>
        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
          <li><strong>No fatigue predictions:</strong> Ensure you have enough historical data (7+ days). The AI analysis runs on-demand when you click "Analyse".</li>
          <li><strong>Creative list is empty:</strong> Check that Meta or Moloco sync is running and includes ad-level data.</li>
        </ul>
      </>
    ),
  },
  {
    slug: 'keyword-analysis',
    title: 'Keyword Analysis',
    icon: Search,
    content: (
      <>
        <h2 className="text-2xl font-bold mb-4">Keyword Analysis</h2>
        <p className="text-muted-foreground mb-6 leading-relaxed">Monitor Apple Search Ads keyword performance, manage bids, and get AI-powered recommendations to optimise your keyword strategy.</p>

        <h3 className="text-lg font-semibold mt-8 mb-3">What It Shows</h3>
        <p className="text-muted-foreground mb-4 leading-relaxed">A comprehensive table of all your Apple Search Ads keywords with metrics including impressions, taps, installs, CPA, tap-through rate, impression share, and search popularity. Includes search term breakdowns to see which actual search queries triggered your ads.</p>

        <h3 className="text-lg font-semibold mt-8 mb-3">AI Keyword Recommendations</h3>
        <p className="text-muted-foreground mb-4 leading-relaxed">GrowthOS AI analyses your keyword performance and provides recommendations: bid increases for high-performing keywords, bid decreases for underperformers, and alerts for keywords with declining impression share.</p>

        <h3 className="text-lg font-semibold mt-8 mb-3">Bid Management</h3>
        <p className="text-muted-foreground mb-4 leading-relaxed">Adjust keyword bids directly from GrowthOS. Click the bid amount on any keyword to edit it. Changes are sent to Apple Search Ads via the API.</p>

        <h3 className="text-lg font-semibold mt-8 mb-3">Setup Requirements</h3>
        <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-6">
          <li>Apple Search Ads API credentials connected.</li>
          <li>Keyword sync enabled and running.</li>
        </ul>

        <h3 className="text-lg font-semibold mt-8 mb-3">Troubleshooting</h3>
        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
          <li><strong>No keywords displayed:</strong> Verify your Apple Search Ads connection is active and the keyword sync has completed at least once.</li>
          <li><strong>Bid update failed:</strong> Check that your Apple API key has campaign management permissions, not just read-only access.</li>
        </ul>
      </>
    ),
  },
  {
    slug: 'audience-analysis',
    title: 'Audience Analysis',
    icon: Users,
    content: (
      <>
        <h2 className="text-2xl font-bold mb-4">Audience Analysis</h2>
        <p className="text-muted-foreground mb-6 leading-relaxed">Understand your audience demographics across Meta campaigns — age, gender, country, and platform breakdowns.</p>

        <h3 className="text-lg font-semibold mt-8 mb-3">What It Shows</h3>
        <p className="text-muted-foreground mb-4 leading-relaxed">The Audience Analysis page fetches demographic data from Meta Ads, showing how your ad spend and performance breaks down by age range, gender, country, and device. Visualisations include bar charts and tables.</p>

        <h3 className="text-lg font-semibold mt-8 mb-3">Setup Requirements</h3>
        <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-6">
          <li>Meta Ads connected with a valid access token.</li>
          <li>Active campaigns with demographic data available.</li>
        </ul>

        <h3 className="text-lg font-semibold mt-8 mb-3">Troubleshooting</h3>
        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
          <li><strong>No demographic data:</strong> Meta requires campaigns to have sufficient impressions before demographic breakdowns are available. Very new or low-spend campaigns may not have data yet.</li>
        </ul>
      </>
    ),
  },
  {
    slug: 'automation-rules',
    title: 'Automation Rules',
    icon: Zap,
    content: (
      <>
        <h2 className="text-2xl font-bold mb-4">Automation Rules</h2>
        <p className="text-muted-foreground mb-6 leading-relaxed">Set up automated rules to manage keyword bids (Apple Search Ads) and ad rules (Meta) without manual intervention.</p>

        <h3 className="text-lg font-semibold mt-8 mb-3">Apple Keyword Automation</h3>
        <p className="text-muted-foreground mb-4 leading-relaxed">Create rules that automatically adjust Apple Search Ads keyword bids based on conditions like CPA thresholds, impression share, or install volume. Rules run on a configurable schedule (daily, weekly) and can target specific keywords or keyword groups.</p>

        <h3 className="text-lg font-semibold mt-8 mb-3">Meta Ad Rules</h3>
        <p className="text-muted-foreground mb-4 leading-relaxed">Create and manage Meta automated rules that can pause underperforming ads, adjust budgets, or send notifications based on performance conditions. These rules are created via the Meta API and managed from within GrowthOS.</p>

        <h3 className="text-lg font-semibold mt-8 mb-3">Execution History</h3>
        <p className="text-muted-foreground mb-4 leading-relaxed">Every rule execution is logged. View the history to see which rules ran, what actions were taken, and whether any errors occurred.</p>

        <h3 className="text-lg font-semibold mt-8 mb-3">Creating a Rule</h3>
        <ol className="list-decimal pl-6 space-y-2 text-muted-foreground mb-6">
          <li>Navigate to <strong>Automation Rules</strong>.</li>
          <li>Choose Apple or Meta tab.</li>
          <li>Click <strong>Create Rule</strong>.</li>
          <li>Define conditions (e.g. "If CPA &gt; $50 and impressions &gt; 1000").</li>
          <li>Set the action (e.g. "Decrease bid by 10%").</li>
          <li>Set the frequency and save.</li>
        </ol>

        <h3 className="text-lg font-semibold mt-8 mb-3">Troubleshooting</h3>
        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
          <li><strong>Rule not executing:</strong> Check that the rule is set to Active. Also verify that the schedule frequency allows it to run (e.g. daily rules only run once per day).</li>
          <li><strong>Unexpected bid changes:</strong> Review the rule conditions carefully. A rule with loose conditions may match more keywords than intended.</li>
        </ul>
      </>
    ),
  },
  {
    slug: 'competitor-ads',
    title: 'Competitor Ads',
    icon: Eye,
    content: (
      <>
        <h2 className="text-2xl font-bold mb-4">Competitor Ads</h2>
        <p className="text-muted-foreground mb-6 leading-relaxed">Search Meta's Ad Library to see what ads your competitors are running — directly from GrowthOS.</p>

        <h3 className="text-lg font-semibold mt-8 mb-3">What It Does</h3>
        <p className="text-muted-foreground mb-4 leading-relaxed">Enter a competitor's name or page ID and GrowthOS will query the Meta Ad Library API to return their currently active ads. You can view creative assets, ad copy, and when the ad started running.</p>

        <h3 className="text-lg font-semibold mt-8 mb-3">Setup Requirements</h3>
        <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-6">
          <li>A valid Meta access token connected in Settings → Connections.</li>
        </ul>

        <h3 className="text-lg font-semibold mt-8 mb-3">Troubleshooting</h3>
        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
          <li><strong>No results found:</strong> The Meta Ad Library may not return results for all advertisers. Try searching by the exact page name.</li>
          <li><strong>API errors:</strong> Ensure your Meta token is valid and not expired.</li>
        </ul>
      </>
    ),
  },
  {
    slug: 'app-ratings',
    title: 'App Ratings & Reviews',
    icon: Star,
    content: (
      <>
        <h2 className="text-2xl font-bold mb-4">App Ratings & Reviews</h2>
        <p className="text-muted-foreground mb-6 leading-relaxed">Monitor and respond to app reviews across App Store, Google Play, and Trustpilot — with AI-powered response suggestions.</p>

        <h3 className="text-lg font-semibold mt-8 mb-3">What It Does</h3>
        <p className="text-muted-foreground mb-4 leading-relaxed">The Ratings page aggregates reviews from all connected review platforms. You can filter by star rating, platform, date, and response status. Each review shows the author, rating, text, and any existing developer response.</p>

        <h3 className="text-lg font-semibold mt-8 mb-3">AI Response Suggestions</h3>
        <p className="text-muted-foreground mb-4 leading-relaxed">Click <strong>Suggest Response</strong> on any review and GrowthOS AI will generate a contextual reply. You can edit the suggestion before posting. The AI uses your custom prompts from <strong>Settings → AI Training</strong> to match your brand voice.</p>

        <h3 className="text-lg font-semibold mt-8 mb-3">Auto-Response Rules</h3>
        <p className="text-muted-foreground mb-4 leading-relaxed">Enable auto-responses in <strong>Settings → Auto Responses</strong>. You can configure a star rating threshold (e.g. auto-respond to 4★ and 5★ reviews) per platform. Reviews below the threshold go into a manual review queue.</p>

        <h3 className="text-lg font-semibold mt-8 mb-3">Setup Requirements</h3>
        <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-6">
          <li>At least one review platform connected (App Store Connect, Google Play Console, or Trustpilot).</li>
          <li>For posting responses: the API credentials must have write/respond permissions.</li>
        </ul>

        <h3 className="text-lg font-semibold mt-8 mb-3">Troubleshooting</h3>
        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
          <li><strong>Reviews not syncing:</strong> Check sync status in Settings → Syncs. Some platforms have rate limits that may delay syncs.</li>
          <li><strong>Response posting failed:</strong> Verify that your API key has write permissions. App Store Connect keys require the "Customer Reviews" role.</li>
          <li><strong>AI suggestions seem off-brand:</strong> Customise the AI prompt in Settings → AI Training to better match your tone and guidelines.</li>
        </ul>
      </>
    ),
  },
  {
    slug: 'compliance',
    title: 'Compliance Checker',
    icon: ShieldCheck,
    content: (
      <>
        <h2 className="text-2xl font-bold mb-4">Compliance Checker</h2>
        <p className="text-muted-foreground mb-6 leading-relaxed">Check your ad creatives against your compliance rules before they go live. Catch regulatory issues early.</p>

        <h3 className="text-lg font-semibold mt-8 mb-3">What It Does</h3>
        <p className="text-muted-foreground mb-4 leading-relaxed">The Compliance Checker uses AI to analyse ad copy, images, and videos against a set of rules you define. It returns a pass/fail result for each rule along with detailed explanations.</p>

        <h3 className="text-lg font-semibold mt-8 mb-3">Setting Up Compliance Rules</h3>
        <ol className="list-decimal pl-6 space-y-2 text-muted-foreground mb-6">
          <li>Navigate to <strong>Settings → Compliance</strong>.</li>
          <li>Click <strong>Add Rule</strong>.</li>
          <li>Enter a label (e.g. "No misleading claims") and a description of what the rule checks for.</li>
          <li>Select which content types the rule applies to (text, image, video).</li>
          <li>Enable the rule and save.</li>
        </ol>

        <h3 className="text-lg font-semibold mt-8 mb-3">Running a Check</h3>
        <ol className="list-decimal pl-6 space-y-2 text-muted-foreground mb-6">
          <li>Go to the <strong>Compliance</strong> page.</li>
          <li>Choose the content type (text, image, or video).</li>
          <li>Enter or upload your creative content.</li>
          <li>Click <strong>Run Check</strong>. Results appear within seconds.</li>
        </ol>

        <h3 className="text-lg font-semibold mt-8 mb-3">Troubleshooting</h3>
        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
          <li><strong>"No compliance rules configured":</strong> Add rules in Settings → Compliance before running checks.</li>
          <li><strong>Check returns unexpected results:</strong> Review your rule descriptions — the AI interprets them literally. Be specific about what constitutes a violation.</li>
        </ul>
      </>
    ),
  },
  {
    slug: 'conversion-events',
    title: 'Conversion Events',
    icon: SlidersHorizontal,
    content: (
      <>
        <h2 className="text-2xl font-bold mb-4">Conversion Events</h2>
        <p className="text-muted-foreground mb-6 leading-relaxed">Conversion events are the foundation of CPA calculations, tracker metrics, and projections in GrowthOS.</p>

        <h3 className="text-lg font-semibold mt-8 mb-3">What They Are</h3>
        <p className="text-muted-foreground mb-4 leading-relaxed">A conversion event maps a business action (e.g. purchase, registration, first deposit) to a specific event name from your analytics provider (e.g. <code className="bg-muted px-1.5 py-0.5 rounded text-sm">af_purchase</code> from AppsFlyer). One event should be marked as <strong>primary</strong> — this is used for CPA calculations across the platform.</p>

        <h3 className="text-lg font-semibold mt-8 mb-3">How to Configure</h3>
        <ol className="list-decimal pl-6 space-y-2 text-muted-foreground mb-6">
          <li>Go to <strong>Settings → Conversion Events</strong>.</li>
          <li>Click <strong>Add Event</strong>.</li>
          <li>Enter the event name (must match exactly what your analytics provider sends).</li>
          <li>Give it a human-readable label.</li>
          <li>Select the source provider (e.g. AppsFlyer).</li>
          <li>Toggle <strong>Primary</strong> if this is your main conversion metric.</li>
        </ol>

        <h3 className="text-lg font-semibold mt-8 mb-3">Impact on Other Features</h3>
        <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-6">
          <li><strong>Trackers:</strong> Weekly/monthly trackers use conversion events to calculate CPA and conversion counts.</li>
          <li><strong>Projections:</strong> End-of-month projections rely on the primary conversion event rate.</li>
          <li><strong>KPI Cards:</strong> Dashboard KPIs reference conversion events for cost-per-conversion metrics.</li>
        </ul>

        <h3 className="text-lg font-semibold mt-8 mb-3">Troubleshooting</h3>
        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
          <li><strong>CPA shows 0 everywhere:</strong> You likely haven't set a primary conversion event, or the event name doesn't match what your provider sends.</li>
          <li><strong>Event count seems wrong:</strong> Verify the event name matches exactly (case-sensitive) with your analytics provider.</li>
        </ul>
      </>
    ),
  },
  {
    slug: 'cpa-targets',
    title: 'CPA Targets',
    icon: Target,
    content: (
      <>
        <h2 className="text-2xl font-bold mb-4">CPA Targets</h2>
        <p className="text-muted-foreground mb-6 leading-relaxed">Set CPA thresholds to visualise performance with colour-coded indicators across dashboards and trackers.</p>

        <h3 className="text-lg font-semibold mt-8 mb-3">What It Does</h3>
        <p className="text-muted-foreground mb-4 leading-relaxed">The CPA target settings define your target CPA and thresholds for green (good), orange (warning), and red (over target) indicators. These colours appear on KPI cards, tracker rows, and campaign tables to give you instant visual feedback.</p>

        <h3 className="text-lg font-semibold mt-8 mb-3">How to Configure</h3>
        <ol className="list-decimal pl-6 space-y-2 text-muted-foreground mb-6">
          <li>Navigate to <strong>Settings → CPA Targets</strong>.</li>
          <li>Set your <strong>Target CPA</strong> (the ideal cost per conversion).</li>
          <li>Set the <strong>Green threshold</strong> (percentage below target that's "good").</li>
          <li>Set the <strong>Orange threshold</strong> (percentage above target that triggers a warning).</li>
          <li>Anything above the orange threshold shows as red.</li>
        </ol>

        <h3 className="text-lg font-semibold mt-8 mb-3">Troubleshooting</h3>
        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
          <li><strong>All CPAs showing as grey/neutral:</strong> CPA targets may not be configured. Set them in Settings → CPA Targets.</li>
          <li><strong>Colours seem wrong:</strong> Double-check your threshold percentages. A green threshold of 80% means CPAs up to 80% of your target are green.</li>
        </ul>
      </>
    ),
  },
  {
    slug: 'ai-training',
    title: 'AI Training',
    icon: Sparkles,
    content: (
      <>
        <h2 className="text-2xl font-bold mb-4">AI Training</h2>
        <p className="text-muted-foreground mb-6 leading-relaxed">Customise the AI prompts that power review responses, analysis insights, and email copy to match your brand voice.</p>

        <h3 className="text-lg font-semibold mt-8 mb-3">What It Does</h3>
        <p className="text-muted-foreground mb-4 leading-relaxed">GrowthOS AI uses customisable system prompts to generate responses and insights. By editing these prompts, you can control the tone, style, and content guidelines the AI follows. Each organisation starts with empty prompts that you can fill in.</p>

        <h3 className="text-lg font-semibold mt-8 mb-3">Available Prompts</h3>
        <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-6">
          <li><strong>Review Response Prompt:</strong> Controls how the AI writes responses to app reviews. Include your brand name, tone guidelines, and any phrases to include/avoid.</li>
          <li><strong>Review Analysis Prompt:</strong> Controls how the AI analyses review sentiment and trends.</li>
          <li><strong>Email Copy Prompt:</strong> Guides the AI when generating email copy suggestions.</li>
        </ul>

        <h3 className="text-lg font-semibold mt-8 mb-3">How to Configure</h3>
        <ol className="list-decimal pl-6 space-y-2 text-muted-foreground mb-6">
          <li>Go to <strong>Settings → AI</strong>.</li>
          <li>Edit any of the prompt fields.</li>
          <li>Click <strong>Save</strong>.</li>
          <li>The updated prompts take effect immediately for all AI operations in your organisation.</li>
        </ol>

        <h3 className="text-lg font-semibold mt-8 mb-3">Important Notes</h3>
        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
          <li>AI training data is stored per-organisation. Each organisation starts with a blank slate.</li>
          <li>Only organisation admins can edit AI training prompts.</li>
          <li>Changes apply to all team members in the organisation immediately.</li>
        </ul>
      </>
    ),
  },
  {
    slug: 'users-permissions',
    title: 'Users & Permissions',
    icon: UserCog,
    content: (
      <>
        <h2 className="text-2xl font-bold mb-4">Users & Permissions</h2>
        <p className="text-muted-foreground mb-6 leading-relaxed">Manage who has access to your GrowthOS organisation and what they can do.</p>

        <h3 className="text-lg font-semibold mt-8 mb-3">Roles</h3>
        <div className="grid sm:grid-cols-3 gap-4 mb-6">
          <div className="border border-border rounded-lg p-4">
            <h4 className="font-semibold mb-1">Admin</h4>
            <p className="text-sm text-muted-foreground">Full access to all features, settings, user management, and data.</p>
          </div>
          <div className="border border-border rounded-lg p-4">
            <h4 className="font-semibold mb-1">User</h4>
            <p className="text-sm text-muted-foreground">Access to dashboards, campaigns, analytics, and reviews. Cannot modify settings or manage users.</p>
          </div>
          <div className="border border-border rounded-lg p-4">
            <h4 className="font-semibold mb-1">Affiliate</h4>
            <p className="text-sm text-muted-foreground">Limited view restricted to affiliate-specific data and link generation.</p>
          </div>
        </div>

        <h3 className="text-lg font-semibold mt-8 mb-3">Inviting Users</h3>
        <ol className="list-decimal pl-6 space-y-2 text-muted-foreground mb-6">
          <li>Go to <strong>Settings → Users</strong>.</li>
          <li>Click <strong>Invite User</strong>.</li>
          <li>Enter the email address and select a role.</li>
          <li>The invitee receives an email with a link to join your organisation.</li>
        </ol>

        <h3 className="text-lg font-semibold mt-8 mb-3">Troubleshooting</h3>
        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
          <li><strong>Invite email not received:</strong> Ask the user to check their spam folder. Invitations expire after 7 days.</li>
          <li><strong>User can't access settings:</strong> They may be assigned the "User" role, which doesn't include settings access. An admin needs to change their role.</li>
        </ul>
      </>
    ),
  },
  {
    slug: 'affiliate-management',
    title: 'Affiliate Management',
    icon: Handshake,
    content: (
      <>
        <h2 className="text-2xl font-bold mb-4">Affiliate Management</h2>
        <p className="text-muted-foreground mb-6 leading-relaxed">Track affiliate performance, generate tracking links, and manage CPA payouts — all within GrowthOS.</p>

        <h3 className="text-lg font-semibold mt-8 mb-3">What It Does</h3>
        <p className="text-muted-foreground mb-4 leading-relaxed">The affiliate management system lets you onboard affiliates, set per-affiliate CPA rates and monthly caps, generate unique tracking links, and monitor daily performance (FTDs, spend, revenue).</p>

        <h3 className="text-lg font-semibold mt-8 mb-3">Adding an Affiliate</h3>
        <ol className="list-decimal pl-6 space-y-2 text-muted-foreground mb-6">
          <li>Go to <strong>Settings → Affiliates</strong>.</li>
          <li>Click <strong>Add Affiliate</strong>.</li>
          <li>Enter the affiliate name, channel, CPA rate, and optional monthly cap.</li>
          <li>Save. The affiliate appears in your affiliate list.</li>
        </ol>

        <h3 className="text-lg font-semibold mt-8 mb-3">Generating Tracking Links</h3>
        <p className="text-muted-foreground mb-4 leading-relaxed">On the affiliate detail page, click <strong>Generate Link</strong>. Enter a campaign name and GrowthOS will create a unique tracking URL (via AppsFlyer OneLink if configured). Share this link with the affiliate.</p>

        <h3 className="text-lg font-semibold mt-8 mb-3">Revenue Tracking</h3>
        <p className="text-muted-foreground mb-4 leading-relaxed">Daily affiliate spend is tracked automatically based on FTD counts × the affiliate's CPA rate. View daily, weekly, and monthly breakdowns on the affiliate detail page and the Affiliates dashboard.</p>

        <h3 className="text-lg font-semibold mt-8 mb-3">Troubleshooting</h3>
        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
          <li><strong>Tracking link generation fails:</strong> Ensure your AppsFlyer OneLink credentials are configured in Settings → Connections.</li>
          <li><strong>FTD count is 0:</strong> Verify that the affiliate's attributed installs are being synced from AppsFlyer. Check sync logs for errors.</li>
        </ul>
      </>
    ),
  },
];

/* ─── Component ─── */
export default function Docs() {
  const { slug } = useParams<{ slug?: string }>();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const activeSlug = slug || articles[0].slug;
  const activeIndex = articles.findIndex((a) => a.slug === activeSlug);
  const article = articles[activeIndex] ?? articles[0];
  const prev = activeIndex > 0 ? articles[activeIndex - 1] : null;
  const next = activeIndex < articles.length - 1 ? articles[activeIndex + 1] : null;

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    setMobileOpen(false);
  }, [activeSlug]);

  const SidebarNav = () => (
    <nav className="space-y-1">
      {articles.map((a) => {
        const Icon = a.icon;
        const isActive = a.slug === activeSlug;
        return (
          <Link
            key={a.slug}
            to={`/docs/${a.slug}`}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
              isActive
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{a.title}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto max-w-7xl flex items-center justify-between px-4 sm:px-6 h-14">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2">
              <img src={gosLogo} alt="GrowthOS" className="h-7 w-7 rounded-lg" />
              <span className="text-lg font-bold gradient-text">GrowthOS</span>
            </Link>
            <span className="text-muted-foreground/60">/</span>
            <span className="text-sm font-medium text-muted-foreground">Docs</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
              <Link to="/">Home</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/auth">Get Started</Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="sm:hidden"
              onClick={() => setMobileOpen((o) => !o)}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 mx-auto max-w-7xl w-full flex">
        {/* Desktop sidebar */}
        <aside className="hidden sm:block w-64 shrink-0 border-r border-border/50">
          <ScrollArea className="h-[calc(100vh-3.5rem)] py-6 px-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-3 px-3">
              Feature Guides
            </p>
            <SidebarNav />
          </ScrollArea>
        </aside>

        {/* Mobile sidebar */}
        {mobileOpen && (
          <div className="fixed inset-0 z-40 bg-background/95 backdrop-blur-sm sm:hidden pt-14">
            <ScrollArea className="h-full p-4">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-3 px-3">
                Feature Guides
              </p>
              <SidebarNav />
            </ScrollArea>
          </div>
        )}

        {/* Content */}
        <main ref={contentRef} className="flex-1 overflow-y-auto h-[calc(100vh-3.5rem)]">
          <article className="max-w-3xl mx-auto px-4 sm:px-8 py-10 sm:py-14">
            <div className="flex items-center gap-2 mb-2">
              <article.icon className="h-5 w-5 text-primary" />
              <Badge variant="outline" className="text-[10px]">
                Feature Guide
              </Badge>
            </div>
            {article.content}

            {/* Prev / Next */}
            <div className="mt-16 pt-8 border-t border-border flex items-center justify-between gap-4">
              {prev ? (
                <Button variant="ghost" size="sm" asChild>
                  <Link to={`/docs/${prev.slug}`} className="flex items-center gap-1.5">
                    <ArrowLeft className="h-4 w-4" />
                    {prev.title}
                  </Link>
                </Button>
              ) : (
                <span />
              )}
              {next ? (
                <Button variant="ghost" size="sm" asChild>
                  <Link to={`/docs/${next.slug}`} className="flex items-center gap-1.5">
                    {next.title}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              ) : (
                <span />
              )}
            </div>
          </article>

          {/* Back to top */}
          <div className="sticky bottom-4 flex justify-end px-4 sm:px-8 pointer-events-none">
            <Button
              variant="outline"
              size="icon"
              className="pointer-events-auto shadow-lg"
              onClick={() => contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          </div>
        </main>
      </div>
    </div>
  );
}
