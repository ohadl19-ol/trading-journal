import type { AppSettings, Execution, Position, WatchlistItem } from '@/types'
import type { GeneralNotes } from '@/lib/api'
import { DEMO_DEFAULT_INITIAL_CAPITAL, storageKeyFor, type AccountMode } from '@/lib/accountMode'

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

export const DEMO_DEFAULT_SETTINGS: Omit<AppSettings, 'webAppUrl'> = {
  initialCapital: DEMO_DEFAULT_INITIAL_CAPITAL,
  defaultAccountBalance: DEMO_DEFAULT_INITIAL_CAPITAL,
  defaultRiskAmount: 30,
  commissionPerAction: 0,
}

function readJson<T>(key: string): Partial<T> {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as Partial<T>) : {}
  } catch {
    return {}
  }
}

/**
 * הגדרות לפי מצב. כתובת ה-Web App משותפת לשני המצבים (אותו שרת), אבל הון התחלתי,
 * סיכון ועמלה נפרדים לגמרי — לדמו ברירת מחדל של 3,000$.
 */
export function loadSettings(mode: AccountMode): AppSettings {
  const real = { ...DEFAULT_SETTINGS, ...readJson<AppSettings>(KEYS.settings) }
  if (mode === 'real') return real
  const { webAppUrl: _ignored, ...demoStored } = readJson<AppSettings>(storageKeyFor('demo', KEYS.settings))
  return { ...DEMO_DEFAULT_SETTINGS, ...demoStored, webAppUrl: real.webAppUrl }
}

export function saveSettings(settings: AppSettings, mode: AccountMode) {
  if (mode === 'real') {
    localStorage.setItem(KEYS.settings, JSON.stringify(settings))
    return
  }
  const { webAppUrl, ...numeric } = settings
  localStorage.setItem(storageKeyFor('demo', KEYS.settings), JSON.stringify(numeric))
  const real = { ...DEFAULT_SETTINGS, ...readJson<AppSettings>(KEYS.settings), webAppUrl }
  localStorage.setItem(KEYS.settings, JSON.stringify(real))
}

export function loadLocalPositions(mode: AccountMode): Position[] {
  try {
    const raw = localStorage.getItem(storageKeyFor(mode, KEYS.positions))
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

export function saveLocalPositions(positions: Position[], mode: AccountMode) {
  localStorage.setItem(storageKeyFor(mode, KEYS.positions), JSON.stringify(positions))
}

export function loadLocalExecutions(mode: AccountMode): Execution[] {
  try {
    const raw = localStorage.getItem(storageKeyFor(mode, KEYS.executions))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveLocalExecutions(executions: Execution[], mode: AccountMode) {
  localStorage.setItem(storageKeyFor(mode, KEYS.executions), JSON.stringify(executions))
}

export function loadLocalWatchlist(mode: AccountMode): WatchlistItem[] {
  try {
    const raw = localStorage.getItem(storageKeyFor(mode, KEYS.watchlist))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveLocalWatchlist(watchlist: WatchlistItem[], mode: AccountMode) {
  localStorage.setItem(storageKeyFor(mode, KEYS.watchlist), JSON.stringify(watchlist))
}

export function loadLocalNotes(mode: AccountMode): GeneralNotes {
  try {
    const raw = localStorage.getItem(storageKeyFor(mode, KEYS.notes))
    return raw ? { ...DEFAULT_NOTES, ...JSON.parse(raw) } : DEFAULT_NOTES
  } catch {
    return DEFAULT_NOTES
  }
}

export function saveLocalNotes(notes: GeneralNotes, mode: AccountMode) {
  localStorage.setItem(storageKeyFor(mode, KEYS.notes), JSON.stringify(notes))
}
