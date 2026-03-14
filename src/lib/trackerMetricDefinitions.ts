/**
 * Shared metric definitions for Weekly and Monthly trackers.
 * Each metric knows how to extract its value from a generic metrics record,
 * how to format it, which section it belongs to, and whether to invert colors.
 */

export type MetricFormat = 'number' | 'currency' | 'currency_decimal' | 'percent' | 'multiplier' | 'rating';

export interface TrackerMetricDefinition {
  key: string;
  label: string;
  section: string;
  format: MetricFormat;
  getValue: (m: Record<string, any>) => number;
  invertColors?: boolean;
  isBold?: boolean;
  displayOrder?: number;
}

// Helper formatters used by tracker pages
export function formatMetricValue(value: number, format: MetricFormat): string {
  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(value);
    case 'currency_decimal':
      return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
    case 'number':
      return new Intl.NumberFormat('en-GB').format(Math.round(value));
    case 'percent':
      return `${(value * 100).toFixed(1)}%`;
    case 'multiplier':
      return `${value.toFixed(2)}x`;
    case 'rating':
      return value > 0 ? value.toFixed(2) : '-';
    default:
      return value.toLocaleString();
  }
}

export const DEFAULT_TRACKER_METRICS: TrackerMetricDefinition[] = [
  // Funnel Metrics
  { key: 'total_installs', label: 'Total Installs', section: 'Funnel Metrics', format: 'number', getValue: (m) => m.total_installs },
  { key: 'total_signups', label: 'Total Signups', section: 'Funnel Metrics', format: 'number', getValue: (m) => m.total_signups },
  { key: 'total_ftds', label: 'Total FTDs', section: 'Funnel Metrics', format: 'number', getValue: (m) => m.total_ftds },
  { key: 'total_stds', label: 'Total STDs', section: 'Funnel Metrics', format: 'number', getValue: (m) => m.total_stds },
  { key: 'total_hvps', label: 'Total HVPs', section: 'Funnel Metrics', format: 'number', getValue: (m) => m.total_hvps ?? 0 },

  // Conversion Rates
  { key: 'cvr_install_to_signup', label: 'Install → Signup', section: 'Conversion Rates', format: 'percent', getValue: (m) => m.cvr_install_to_signup },
  { key: 'cvr_signup_to_ftd', label: 'Signup → FTD', section: 'Conversion Rates', format: 'percent', getValue: (m) => m.cvr_signup_to_ftd },
  { key: 'cvr_ftd_to_std', label: 'FTD → STD', section: 'Conversion Rates', format: 'percent', getValue: (m) => m.cvr_ftd_to_std },
  { key: 'cvr_install_to_std', label: 'Install → STD', section: 'Conversion Rates', format: 'percent', getValue: (m) => m.cvr_install_to_std },

  // Spend
  { key: 'total_ad_spend', label: 'Total Ad Spend', section: 'Spend', format: 'currency', getValue: (m) => m.total_ad_spend },
  { key: 'total_affiliate_spend', label: 'Total Affiliate Spend', section: 'Spend', format: 'currency', getValue: (m) => m.total_affiliate_spend },
  { key: 'total_spend', label: 'Total Spend', section: 'Spend', format: 'currency', getValue: (m) => m.total_spend, isBold: true },

  // Cost Metrics
  { key: 'blended_cac', label: 'Blended CAC', section: 'Cost Metrics', format: 'currency_decimal', getValue: (m) => m.blended_cac, invertColors: true },
  { key: 'blended_cpa', label: 'Blended CPA', section: 'Cost Metrics', format: 'currency_decimal', getValue: (m) => m.blended_cpa, invertColors: true },
  { key: 'cost_per_hvp', label: 'Blended Cost / HVP', section: 'Cost Metrics', format: 'currency_decimal', getValue: (m) => m.cost_per_hvp ?? 0, invertColors: true },

  // Revenue
  { key: 'ftd_cohort_deposits', label: 'FTD Cohort Deposits', section: 'Revenue', format: 'currency', getValue: (m) => m.ftd_cohort_deposits },
  { key: 'avg_deposit_per_ftd', label: 'Avg Deposit / FTD', section: 'Revenue', format: 'currency', getValue: (m) => m.avg_deposit_per_ftd },
  { key: 'ad_spend_per_1k_deposit', label: 'Ad Spend / £1k Deposit', section: 'Revenue', format: 'currency', getValue: (m) => m.ad_spend_per_1k_deposit, invertColors: true },
  { key: 'net_deposits_new_users', label: 'Net Deposits (AF LTV)', section: 'Revenue', format: 'currency', getValue: (m) => m.net_deposits_new_users },
  { key: 'new_users_net_deposits', label: 'New Users Net Deposits', section: 'Revenue', format: 'currency', getValue: (m) => m.new_users_net_deposits, isBold: true },
  { key: 'roas', label: 'ROAS', section: 'Revenue', format: 'multiplier', getValue: (m) => m.roas },

  // Ratings
  { key: 'avg_rating', label: 'Avg Rating (Weighted)', section: 'Ratings', format: 'rating', getValue: (m) => m.avg_rating },
];

/**
 * Group metrics by section, preserving order within each section.
 */
export function groupMetricsBySection(metrics: TrackerMetricDefinition[]): { section: string; metrics: TrackerMetricDefinition[] }[] {
  const groups: { section: string; metrics: TrackerMetricDefinition[] }[] = [];
  const seen = new Set<string>();

  for (const m of metrics) {
    if (!seen.has(m.section)) {
      seen.add(m.section);
      groups.push({ section: m.section, metrics: [] });
    }
    groups.find(g => g.section === m.section)!.metrics.push(m);
  }

  return groups;
}
