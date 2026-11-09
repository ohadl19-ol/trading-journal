import { describe, expect, it } from 'vitest'
import { computeAccountComparison, defaultCompareRange, rangeBounds } from '@/lib/compareStats'
import { computeEquitySummary } from '@/lib/statistics'
import { isOpenPosition, isPendingPosition } from '@/lib/calculations'
import type { Position } from '@/types'

const p = (o: Partial<Position>): Position =>
  ({
    tradeId: 'T', symbol: 'X', status: 'סגורה', openDate: '2026-10-01T10:00:00Z', closeDate: '2026-10-20T10:00:00Z',
    avgEntryPrice: 10, currentShares: 0, originalShares: 10, stopLoss: 9, riskAmount: 10, realizedPnl: 0,
    realizedR: null, winLoss: '', followedPlan: null, tags: [], currentPrice: null, ...o,
  }) as Position

describe('השוואה', () => {
  const trades = [
    p({ tradeId: 'a', realizedPnl: 20, realizedR: 2, winLoss: 'WIN', followedPlan: true, closeDate: '2026-10-10T10:00:00Z' }),
    p({ tradeId: 'b', realizedPnl: -10, realizedR: -1, winLoss: 'LOSS', followedPlan: false, closeDate: '2026-10-11T10:00:00Z' }),
    p({ tradeId: 'c', realizedPnl: -10, realizedR: -1, winLoss: 'LOSS', followedPlan: true, closeDate: '2026-10-12T10:00:00Z' }),
    p({ tradeId: 'd', realizedPnl: 30, realizedR: 3, winLoss: 'WIN', closeDate: '2026-10-13T10:00:00Z' }),
    // ממתינה לכניסה — לא נספרת בשום מדד
    p({ tradeId: 'VTRS', status: 'ממתינה לכניסה', closeDate: null, currentPrice: 19.91, avgEntryPrice: 19.95 }),
  ]
  const { from, to } = rangeBounds('2026-10-01', '2026-10-31')
  const s = computeAccountComparison(trades, 3000, from, to)

  it('מחשב את המדדים', () => {
    expect(s.closedCount).toBe(4)
    expect(s.winRate).toBe(0.5)
    expect(s.avgR).toBe(0.75)
    expect(s.avgPnl).toBe(7.5)
    expect(s.expectancy).toBe(0.5 * 25 - 0.5 * 10)
    expect(s.totalPnl).toBe(30)
    expect(s.maxDrawdown).toBe(20) // 3020 → 3000
    expect(s.longestLossStreak).toBe(2)
    expect(s.followedPlanRate).toBe(0.5)
    expect(s.planMarkedCount).toBe(3)
  })

  it('ברירת המחדל היא 30 הימים האחרונים', () => {
    const r = defaultCompareRange(new Date(2026, 10, 9))
    expect(r).toEqual({ from: '2026-10-11', to: '2026-11-09' })
  })
})

describe('ממתינה לכניסה', () => {
  const pending = p({ status: 'ממתינה לכניסה', closeDate: null, currentShares: 0, currentPrice: 19.91, avgEntryPrice: 19.95 })
  it('לא פתוחה ולא סגורה', () => {
    expect(isPendingPosition(pending)).toBe(true)
    expect(isOpenPosition(pending)).toBe(false)
  })
  it('לא משפיעה על השווי ולא נספרת כפוזיציה פתוחה בלי מחיר', () => {
    const e = computeEquitySummary([pending], 3000)
    expect(e.currentEquity).toBe(3000)
    expect(e.unrealizedPnl).toBe(0)
    expect(e.openPositionsWithPrice + e.openPositionsMissingPrice).toBe(0)
  })
})
