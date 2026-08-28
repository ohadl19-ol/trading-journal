import type { AppSettings, Execution, Position, WatchlistItem } from '@/types'
import type { GeneralNotes } from '@/lib/api'

const KEYS = {
  settings: 'tj_settings',
  positions: 'tj_positions',
  executions: 'tj_executions',
  watchlist: 'tj_watchlist',
  notes: 'tj_notes',
} as const

const DEFAULT_NOTES: GeneralNotes = { generalNotes: '', tradingRules: '' }

export const DEFAULT_SETTINGS: AppSettings = {
  webAppUrl: '',
  initialCapital: 4455.21,
  defaultAccountBalance: 4455.21,
  defaultRiskAmount: 50,
  commissionPerAction: 0,
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(KEYS.settings)
    if (!raw) return DEFAULT_SETTINGS
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: AppSettings) {
  localStorage.setItem(KEYS.settings, JSON.stringify(settings))
}

export function loadLocalPositions(): Position[] {
  try {
    const raw = localStorage.getItem(KEYS.positions)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Position[]
    // עסקאות שנשמרו בקאש המקומי לפני שהוספנו שדות חדשים (tags/followedPlan/tradeReview)
    // לא יכילו אותם בכלל בפועל (למרות שה-cast למעלה "מבטיח" ל-TS שכן) — בלי ה-??
    // כאן, קוד שמניח שהם תמיד קיימים (כמו position.tags.length) יקרוס עם מסך שחור
    // עוד לפני שהריענון מהשרת מספיק לרוץ
    return parsed.map((p) => ({
      ...p,
      tags: p.tags ?? [],
      followedPlan: p.followedPlan ?? null,
      tradeReview: p.tradeReview ?? '',
    }))
  } catch {
    return []
  }
}

export function saveLocalPositions(positions: Position[]) {
  localStorage.setItem(KEYS.positions, JSON.stringify(positions))
}

export function loadLocalExecutions(): Execution[] {
  try {
    const raw = localStorage.getItem(KEYS.executions)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveLocalExecutions(executions: Execution[]) {
  localStorage.setItem(KEYS.executions, JSON.stringify(executions))
}

export function loadLocalWatchlist(): WatchlistItem[] {
  try {
    const raw = localStorage.getItem(KEYS.watchlist)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveLocalWatchlist(watchlist: WatchlistItem[]) {
  localStorage.setItem(KEYS.watchlist, JSON.stringify(watchlist))
}

export function loadLocalNotes(): GeneralNotes {
  try {
    const raw = localStorage.getItem(KEYS.notes)
    return raw ? { ...DEFAULT_NOTES, ...JSON.parse(raw) } : DEFAULT_NOTES
  } catch {
    return DEFAULT_NOTES
  }
}

export function saveLocalNotes(notes: GeneralNotes) {
  localStorage.setItem(KEYS.notes, JSON.stringify(notes))
}
