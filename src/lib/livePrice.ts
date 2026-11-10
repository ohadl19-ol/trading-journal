import type { Position } from '@/types'
import { nyDateKey } from '@/lib/marketHours'

/** ציטוט מחיר שהגיע מספק המחירים (דרך השרת). מוצג באפליקציה בלבד — לא נכתב לגיליון. */
export interface LiveQuote {
  price: number
  previousClose: number | null
  quoteTime: string | null
  isMarketOpen: boolean
  source: string
  /** מתי האפליקציה קיבלה את הציטוט */
  fetchedAt: string
}

export type PriceSource = 'live' | 'sheet' | 'none'

export interface LiveMetrics {
  price: number | null
  source: PriceSource
  /** רווח/הפסד לא ממומש: (מחיר − כניסה ממוצעת) × כמות נוכחית */
  unrealized: number | null
  /** % שינוי מהכניסה */
  pctFromEntry: number | null
  /** R נוכחי: (מחיר − כניסה) ÷ (כניסה − סטופ מקורי) */
  currentR: number | null
  /** מרחק מהסטופ הנוכחי ב-% (שלילי = מתחת לסטופ) */
  stopDistancePct: number | null
  /** רווח/הפסד יומי מול סגירת אתמול (או מול הכניסה, אם נכנסו היום) */
  dailyPnl: number | null
  /** קרוב לסטופ (פחות מ-1% מעליו) או מתחתיו */
  nearStop: boolean
  /** המחיר הגיע ליעד */
  hitTarget: boolean
}

/**
 * הסטופ המקורי בזמן הכניסה, גם אם הסטופ עודכן מאז (טריילינג). היעדים 2R/3R נקבעים בפתיחה
 * ולא משתנים, ולכן 3R − 2R = הסיכון המקורי למניה, ומהם אפשר לשחזר את הסטופ המקורי.
 * אם אין יעדים — משתמשים בסטופ הנוכחי.
 */
export function originalStopFor(p: Pick<Position, 'target2R' | 'target3R' | 'stopLoss'>): number {
  const t2 = p.target2R
  const t3 = p.target3R
  if (t2 != null && t3 != null && Number.isFinite(t2) && Number.isFinite(t3) && t3 > t2) {
    const r = t3 - t2
    const plannedEntry = t2 - 2 * r
    return plannedEntry - r
  }
  return p.stopLoss
}

export function computeLiveMetrics(p: Position, quote: LiveQuote | null | undefined, now = new Date()): LiveMetrics {
  const price = quote ? quote.price : p.currentPrice
  const source: PriceSource = quote ? 'live' : p.currentPrice != null ? 'sheet' : 'none'
  if (price == null || !Number.isFinite(price)) {
    return { price: null, source: 'none', unrealized: null, pctFromEntry: null, currentR: null, stopDistancePct: null, dailyPnl: null, nearStop: false, hitTarget: false }
  }

  const entry = p.avgEntryPrice
  const unrealized = (price - entry) * p.currentShares
  const pctFromEntry = entry > 0 ? ((price - entry) / entry) * 100 : null
  const risk = entry - originalStopFor(p)
  const currentR = risk > 0 ? (price - entry) / risk : null
  const stopDistancePct = p.stopLoss > 0 && price > 0 ? ((price - p.stopLoss) / price) * 100 : null

  let dailyPnl: number | null = null
  if (quote && quote.previousClose != null) {
    const openedToday = nyDateKey(new Date(p.openDate)) === nyDateKey(now)
    const base = openedToday ? entry : quote.previousClose
    dailyPnl = (price - base) * p.currentShares
  }

  return {
    price,
    source,
    unrealized,
    pctFromEntry,
    currentR,
    stopDistancePct,
    dailyPnl,
    nearStop: p.stopLoss > 0 && price <= p.stopLoss * 1.01,
    hitTarget: p.targetPrice != null && p.targetPrice > 0 && price >= p.targetPrice,
  }
}
