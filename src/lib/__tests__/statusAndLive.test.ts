import { describe, expect, it } from 'vitest'
import type { Position } from '@/types'
import { computeEquitySummary, computeStatistics, computeStreaks } from '@/lib/statistics'
import { computeAccountComparison, rangeBounds } from '@/lib/compareStats'
import { isCanceledPosition, isOpenPosition, isPendingPosition, parseOrderExpiry } from '@/lib/calculations'
import { computeLiveMetrics, originalStopFor, type LiveQuote } from '@/lib/livePrice'
import { isUsMarketOpen, lastClosedSessionDate, timeAgo } from '@/lib/marketHours'

const base = (o: Partial<Position>): Position =>
  ({
    tradeId: 'T', symbol: 'X', status: 'פתוחה', openDate: '2026-11-09T14:30:00.000Z', closeDate: null,
    avgEntryPrice: 10, currentShares: 0, originalShares: 0, stopLoss: 9, targetPrice: null, riskAmount: 10,
    realizedPnl: 0, realizedR: null, winLoss: '', followedPlan: null, tags: [], currentPrice: null,
    target2R: null, target3R: null, setupReason: '', notes: '', ...o,
  }) as Position

// מצב יומן הדמו כפי שהוא היום
const VTRS = base({
  tradeId: 'T-vtrs', symbol: 'VTRS', status: 'פתוחה', avgEntryPrice: 20.11, currentShares: 21, originalShares: 21,
  stopLoss: 18.58, targetPrice: 22.69, target2R: 22.69, target3R: 24.06, currentPrice: 20.49, realizedPnl: -1.5,
})
const AER = base({
  tradeId: 'T-aer', symbol: 'AER', status: 'בוטלה', avgEntryPrice: 176.58, originalShares: 1, stopLoss: 160.96,
  targetPrice: 207.82, currentPrice: 175.07, winLoss: 'LOSS', realizedPnl: -15.62,
  setupReason: 'פריצה לשיא סגירה של 20 יום. קנייה מותנית ב־176.58, בתוקף עד 12.11.2026',
})
const MHK = base({ tradeId: 'T-mhk', symbol: 'MHK', status: 'בוטלה', avgEntryPrice: 158.78, originalShares: 2, currentPrice: 156.63 })
const PENDING = base({ tradeId: 'T-p', symbol: 'ABC', status: 'ממתינה לכניסה', currentPrice: 50, avgEntryPrice: 51 })
const CLOSED = base({
  tradeId: 'T-c', symbol: 'CLS', status: 'סגורה', closeDate: '2026-11-05T20:00:00.000Z', realizedPnl: 30, realizedR: 1.5, winLoss: 'WIN',
})
const ALL = [VTRS, AER, MHK, PENDING, CLOSED]

describe('סטאטוסים', () => {
  it('רק "פתוחה" / "פתוחה חלקית" נחשבות פתוחות', () => {
    expect(ALL.filter(isOpenPosition).map((p) => p.symbol)).toEqual(['VTRS'])
    expect(isOpenPosition(base({ status: 'פתוחה חלקית' }))).toBe(true)
    expect(isCanceledPosition(AER)).toBe(true)
    expect(isPendingPosition(AER)).toBe(false)
    expect(isOpenPosition(base({ status: 'משהו לא מוכר' as Position['status'] }))).toBe(false)
  })

  it('בוטלה לא נכללת בשום סטטיסטיקה (גם אם יש לה WIN/LOSS או רווח/הפסד)', () => {
    const s = computeStatistics(ALL, 3000)
    expect(s.closedTrades.map((p) => p.symbol)).toEqual(['CLS'])
    expect(s.winCount + s.lossCount).toBe(1)
    expect(s.winRate).toBe(1)
    expect(s.totalRealizedPnl).toBe(30)
    expect(computeStreaks(ALL).longestLossStreak).toBe(0)

    const { from, to } = rangeBounds('2026-10-11', '2026-11-09')
    const c = computeAccountComparison(ALL, 3000, from, to)
    expect(c.closedCount).toBe(1)
    expect(c.totalPnl).toBe(30)
    expect(c.avgR).toBe(1.5)
  })

  it('השווי כולל רק את הפוזיציה הפתוחה — לא ממתינות ולא בוטלות', () => {
    const e = computeEquitySummary(ALL, 3000)
    expect(e.openPositionsWithPrice).toBe(1)
    expect(e.unrealizedPnl).toBeCloseTo((20.49 - 20.11) * 21, 6)
    expect(e.currentEquity).toBeCloseTo(3000 + 30 + 7.98, 6)
  })

  it('תאריך תוקף מתוך סיבת הכניסה', () => {
    expect(parseOrderExpiry(AER.setupReason)).toBe('12.11.2026')
    expect(parseOrderExpiry('בלי תוקף')).toBeNull()
  })
})

describe('חישובים מהמחיר החי (VTRS)', () => {
  const quote = (price: number, previousClose = 20.2): LiveQuote => ({
    price, previousClose, quoteTime: '2026-11-10T15:00:00.000Z', isMarketOpen: true, source: 'test', fetchedAt: '2026-11-10T15:00:00.000Z',
  })
  const now = new Date('2026-11-10T15:01:00.000Z')

  it('הסטופ המקורי משוחזר מהיעדים 2R/3R', () => {
    expect(originalStopFor(VTRS)).toBeCloseTo(18.58, 6)
    // גם אחרי טריילינג של הסטופ — ה-R עדיין מחושב מול הסטופ המקורי
    expect(originalStopFor({ ...VTRS, stopLoss: 20 })).toBeCloseTo(18.58, 6)
  })

  it('רווח לא ממומש, אחוז, R, מרחק מהסטופ ויומי', () => {
    const m = computeLiveMetrics(VTRS, quote(20.49), now)
    expect(m.source).toBe('live')
    expect(m.unrealized).toBeCloseTo(7.98, 6)
    expect(m.pctFromEntry).toBeCloseTo(1.8896, 3)
    expect(m.currentR).toBeCloseTo(0.38 / 1.53, 6) // 0.25R
    expect(m.stopDistancePct).toBeCloseTo(((20.49 - 18.58) / 20.49) * 100, 6)
    expect(m.dailyPnl).toBeCloseTo((20.49 - 20.2) * 21, 6)
    expect(m.nearStop).toBe(false)
    expect(m.hitTarget).toBe(false)
  })

  it('אם נכנסו היום — היומי מחושב מול מחיר הכניסה', () => {
    const m = computeLiveMetrics({ ...VTRS, openDate: '2026-11-10T14:30:00.000Z' }, quote(20.49), now)
    expect(m.dailyPnl).toBeCloseTo((20.49 - 20.11) * 21, 6)
  })

  it('סימון אדום ליד/מתחת לסטופ, ירוק ביעד', () => {
    expect(computeLiveMetrics(VTRS, quote(18.7), now).nearStop).toBe(true) // פחות מ-1% מעל 18.58
    expect(computeLiveMetrics(VTRS, quote(18.4), now).nearStop).toBe(true) // מתחת
    expect(computeLiveMetrics(VTRS, quote(18.9), now).nearStop).toBe(false)
    expect(computeLiveMetrics(VTRS, quote(22.69), now).hitTarget).toBe(true)
  })

  it('בלי מחיר חי — משתמשים במחיר מהיומן (עמודה AC), בלי יומי', () => {
    const m = computeLiveMetrics(VTRS, null, now)
    expect(m.source).toBe('sheet')
    expect(m.price).toBe(20.49)
    expect(m.dailyPnl).toBeNull()
  })
})

describe('שעות מסחר', () => {
  it('חורף (אחרי מעבר שעון בארה"ב): 16:30–23:00 שעון ישראל', () => {
    expect(isUsMarketOpen(new Date('2026-11-10T14:29:00Z'))).toBe(false) // 16:29 בישראל
    expect(isUsMarketOpen(new Date('2026-11-10T14:30:00Z'))).toBe(true) // 16:30
    expect(isUsMarketOpen(new Date('2026-11-10T20:59:00Z'))).toBe(true) // 22:59
    expect(isUsMarketOpen(new Date('2026-11-10T21:00:00Z'))).toBe(false) // 23:00
  })
  it('קיץ, ושבוע שבו רק ארה"ב עברה לשעון קיץ', () => {
    expect(isUsMarketOpen(new Date('2026-07-15T13:30:00Z'))).toBe(true)
    expect(isUsMarketOpen(new Date('2026-07-15T13:29:00Z'))).toBe(false)
    // 10.3.2026: ארה"ב כבר בשעון קיץ, ישראל עוד לא — המסחר נפתח ב-15:30 שעון ישראל
    expect(isUsMarketOpen(new Date('2026-03-10T13:30:00Z'))).toBe(true)
  })
  it('סוף שבוע סגור', () => {
    expect(isUsMarketOpen(new Date('2026-11-14T16:00:00Z'))).toBe(false)
  })
  it('תאריך הסגירה האחרונה', () => {
    expect(lastClosedSessionDate(new Date('2026-11-10T14:00:00Z'))).toBe('9.11.2026') // שלישי בבוקר בניו יורק
    expect(lastClosedSessionDate(new Date('2026-11-10T21:30:00Z'))).toBe('10.11.2026') // אחרי הסגירה
    expect(lastClosedSessionDate(new Date('2026-11-14T12:00:00Z'))).toBe('13.11.2026') // שבת → שישי
    expect(lastClosedSessionDate(new Date('2026-11-16T12:00:00Z'))).toBe('13.11.2026') // שני בבוקר → שישי
  })
  it('"לפני X דקות"', () => {
    const now = new Date('2026-11-10T15:10:00Z')
    expect(timeAgo('2026-11-10T15:08:00Z', now)).toBe('לפני 2 דקות')
    expect(timeAgo('2026-11-10T15:09:40Z', now)).toBe('עכשיו')
  })
})
