// Event vocabulary shared by the browser tracker (components/
// analytics-tracker.tsx), the collection endpoint (app/api/analytics) and
// the dashboard. No imports, so the tracker stays tiny.

export const EVENT_TYPES = ['pageview', 'click', 'scroll', 'engagement'] as const
export type EventType = (typeof EVENT_TYPES)[number]

// Stable click identifiers. The tracker derives one from the link itself
// (lib/analytics/classify-link.ts) unless the element carries an explicit
// data-track="…" attribute. Anything else is rejected by the server.
export const CLICK_NAMES = {
  nav: 'Navigation link',
  cta: 'Call to action',
  paper_open: 'Opened a paper',
  project_open: 'Opened a project',
  research_theme_open: 'Opened a research theme',
  cv_download: 'Downloaded the CV',
  file_download: 'Downloaded a file',
  outbound: 'External link',
  contact_email: 'Email link',
  contact_phone: 'Phone link',
  contact_copy: 'Copied contact details',
  whatsapp: 'WhatsApp link',
  button: 'Button',
} as const
export type ClickName = keyof typeof CLICK_NAMES

export const EVENT_NAMES = {
  pageview: ['pageview'],
  click: Object.keys(CLICK_NAMES) as ClickName[],
  scroll: ['scroll_depth'],
  engagement: ['page_engagement'],
} as const satisfies Record<EventType, readonly string[]>

export const SCROLL_MILESTONES = [25, 50, 75, 90] as const

export const DEVICES = ['desktop', 'mobile', 'tablet'] as const
export type Device = (typeof DEVICES)[number]

export const CHANNELS = ['direct', 'search', 'social', 'email', 'referral', 'unknown'] as const
export type Channel = (typeof CHANNELS)[number]

// Clicks that count as "meaningful interactions" on the dashboard (plain
// navigation does too, but a generic button press does not).
export const MEANINGFUL_CLICKS: ClickName[] = [
  'paper_open',
  'project_open',
  'research_theme_open',
  'cv_download',
  'file_download',
  'outbound',
  'contact_email',
  'contact_phone',
  'contact_copy',
  'whatsapp',
  'cta',
]

// Limits enforced by the server (and respected by the tracker).
export const MAX_EVENTS_PER_REQUEST = 20
export const MAX_BODY_BYTES = 8 * 1024
export const MAX_ENGAGEMENT_MS = 30 * 60 * 1000
