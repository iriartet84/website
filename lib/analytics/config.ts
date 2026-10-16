// Settings for the first-party analytics (see lib/analytics/ingest.ts and
// /admin/analytics). Plain constants: change them here and redeploy.

// Days, hours and "today" on the dashboard are counted in this time zone.
export const ANALYTICS_TIME_ZONE = 'Europe/Paris'

// Events older than this are deleted automatically (a small share of
// incoming requests runs the cleanup) and can be purged sooner from the
// dashboard. 13 months matches the CNIL's guidance for audience measurement.
export const RETENTION_DAYS = 395

// A visitor's next event starts a new session after this much inactivity.
export const SESSION_GAP_MINUTES = 30

// Name of the cookie that the "Exclude this browser" switch on
// /admin/analytics sets. It holds no identifier, only "1".
export const OPT_OUT_COOKIE = 'pf_analytics_optout'

// ---- Portfolio Interest: which research theme a page or click belongs to.
// A theme matches when any of its `categories` equals the paper/project
// category (case-insensitive) of the page viewed or the card clicked, or
// when the page path / click target / click label contains one of its
// `keywords` (lower-case). Edit freely; nothing else depends on the ids.
export type InterestTheme = {
  id: string
  label: string
  categories: string[]
  keywords: string[]
}

export const INTEREST_THEMES: InterestTheme[] = [
  {
    id: 'macro',
    label: 'Macroeconomics',
    categories: ['Macroeconomics', 'Forecasting'],
    keywords: ['macroeconomics', 'macro-', 'nowcast', 'inflation', 'monetary'],
  },
  {
    id: 'commodities',
    label: 'Commodities & Energy',
    categories: ['Commodity Research', 'Commodities', 'Energy'],
    keywords: ['commodity', 'commodities', 'oil', 'gas', 'gold', 'energy'],
  },
  {
    id: 'markets',
    label: 'Financial Markets',
    categories: ['Financial Markets', 'Equity Research'],
    keywords: ['financial-markets', 'financial markets', 'equity', 'yield', 'term-structure'],
  },
  {
    id: 'em',
    label: 'Emerging Markets & Sovereign Risk',
    categories: ['Emerging Markets', 'Emerging Markets & Sovereign Risk', 'Sovereign Risk'],
    keywords: ['emerging-markets', 'emerging markets', 'sovereign', 'spread', 'latin-america'],
  },
  {
    id: 'geopolitics',
    label: 'Geopolitical Risk',
    categories: ['Geopolitical Risk'],
    keywords: ['geopolitical', 'geopolitics', 'sanction'],
  },
]
