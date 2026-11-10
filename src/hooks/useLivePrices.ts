import * as React from 'react'
import { fetchQuotes } from '@/lib/api'
import type { SheetTarget } from '@/lib/accountMode'
import type { LiveQuote } from '@/lib/livePrice'
import { isUsMarketOpen } from '@/lib/marketHours'

/** בשעות המסחר: רענון כל 3 דקות (בתוך הטווח 1–5 שביקשת, ושומר על המכסה החינמית של ספק המחירים) */
export const MARKET_REFRESH_MS = 3 * 60 * 1000
/** מחוץ לשעות המסחר המחיר לא משתנה (מחיר סגירה) — בדיקה נדירה רק כדי לתפוס את פתיחת המסחר */
const OFF_HOURS_REFRESH_MS = 15 * 60 * 1000

export interface LivePricesState {
  quotes: Record<string, LiveQuote>
  errors: Record<string, string>
  /** הודעת שגיאה כללית (אין חיבור / שרת ישן) */
  error: string | null
  loading: boolean
  lastAttemptAt: string | null
  marketOpen: boolean
  refresh: () => void
  /** "עכשיו" שמתעדכן כל 30 שניות, כדי ש"לפני X דקות" יתקדם על המסך */
  now: Date
}

export function useLivePrices(webAppUrl: string, target: SheetTarget | null, symbols: string[]): LivePricesState {
  const key = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))].sort().join(',')
  const [quotes, setQuotes] = React.useState<Record<string, LiveQuote>>({})
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [lastAttemptAt, setLastAttemptAt] = React.useState<string | null>(null)
  const [now, setNow] = React.useState(() => new Date())
  const inFlight = React.useRef(false)

  const load = React.useCallback(async () => {
    if (!webAppUrl || !target || !key || inFlight.current) return
    inFlight.current = true
    setLoading(true)
    try {
      const res = await fetchQuotes(webAppUrl, target, key.split(','))
      const stamped: Record<string, LiveQuote> = {}
      for (const [sym, q] of Object.entries(res.quotes)) stamped[sym] = { ...q, fetchedAt: res.fetchedAt }
      // סימול שנכשל הפעם שומר על הציטוט הקודם שלו (מסומן לפי זמנו), ולא נעלם
      setQuotes((prev) => ({ ...prev, ...stamped }))
      setErrors(res.errors)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'אין חיבור לספק המחירים')
    } finally {
      inFlight.current = false
      setLoading(false)
      setLastAttemptAt(new Date().toISOString())
    }
  }, [webAppUrl, target, key])

  // טעינה ראשונה + רענון תקופתי לפי שעות המסחר; עוצר כשהלשונית מוסתרת וממשיך כשחוזרים אליה
  React.useEffect(() => {
    if (!key) return
    load()
    let timer: ReturnType<typeof setTimeout>
    const schedule = () => {
      timer = setTimeout(() => {
        if (document.visibilityState === 'visible') load()
        schedule()
      }, isUsMarketOpen() ? MARKET_REFRESH_MS : OFF_HOURS_REFRESH_MS)
    }
    schedule()
    const onVisible = () => {
      if (document.visibilityState === 'visible') load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [key, load])

  React.useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])

  return { quotes, errors, error, loading, lastAttemptAt, marketOpen: isUsMarketOpen(now), refresh: load, now }
}

const EMPTY: LivePricesState = {
  quotes: {},
  errors: {},
  error: null,
  loading: false,
  lastAttemptAt: null,
  marketOpen: false,
  refresh: () => {},
  now: new Date(),
}

export const LivePricesContext = React.createContext<LivePricesState>(EMPTY)

export function useLivePricesContext(): LivePricesState {
  return React.useContext(LivePricesContext)
}

/** ציטוט חי לסימול, או null אם אין (אז מוצג המחיר מהיומן כ"מחיר סגירה") */
export function useLiveQuote(symbol: string): LiveQuote | null {
  const { quotes } = useLivePricesContext()
  return quotes[symbol.trim().toUpperCase()] ?? null
}
