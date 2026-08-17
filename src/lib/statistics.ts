import type { Position } from '@/types'

export interface PatternBreakdown {
  name: string
  pnl: number
  count: number
}

export interface EquitySummary {
  initialCapital: number
  totalRealizedPnl: number
  unrealizedPnl: number
  currentEquity: number
  pnlPercentage: number
  openPositionsWithPrice: number
  openPositionsMissingPrice: number
}

/**
 * שווי חשבון אמיתי כרגע: תמיד מחושב על כל ההיסטוריה (לא מושפע מסינון התאריכים
 * ביומן), כי "שווי נוכחי" הוא מצב אמיתי של החשבון ולא מדד ביצועים לתקופה.
 * כולל גם רווח/הפסד לא ממומש מפוזיציות פתוחות שעודכן להן מחיר נוכחי.
 */
export function computeEquitySummary(allPositions: Position[], initialCapital: number): EquitySummary {
  const closedTrades = allPositions.filter((p) => p.status === 'סגורה')
  const openTrades = allPositions.filter((p) => p.status !== 'סגורה')

  const totalRealizedPnl = closedTrades.reduce((sum, p) => sum + p.realizedPnl, 0)

  let unrealizedPnl = 0
  let openPositionsWithPrice = 0
  let openPositionsMissingPrice = 0
  for (const p of openTrades) {
    if (p.currentPrice !== null && p.currentPrice !== undefined) {
      unrealizedPnl += p.currentShares * (p.currentPrice - p.avgEntryPrice)
      openPositionsWithPrice += 1
    } else {
      openPositionsMissingPrice += 1
    }
  }

  const currentEquity = initialCapital + totalRealizedPnl + unrealizedPnl
  const pnlPercentage = initialCapital !== 0 ? (currentEquity - initialCapital) / initialCapital : 0

  return {
    initialCapital,
    totalRealizedPnl,
    unrealizedPnl,
    currentEquity,
    pnlPercentage,
    openPositionsWithPrice,
    openPositionsMissingPrice,
  }
}

export interface StatsResult {
  initialCapital: number
  totalRealizedPnl: number
  currentEquity: number
  pnlPercentage: number
  winCount: number
  lossCount: number
  winRate: number
  lossRate: number
  avgWin: number
  avgLoss: number
  expectancy: number
  patternBreakdown: PatternBreakdown[]
  categoryBreakdown: PatternBreakdown[]
  closedTrades: Position[]
}

/** מחשב את כל מדדי הסטטיסטיקה מתוך עסקאות סגורות בלבד, זהה ללוגיקת הנוסחאות בגיליון */
export function computeStatistics(positions: Position[], initialCapital: number): StatsResult {
  const closedTrades = positions.filter((p) => p.status === 'סגורה')

  const totalRealizedPnl = closedTrades.reduce((sum, p) => sum + p.realizedPnl, 0)
  const currentEquity = initialCapital + totalRealizedPnl
  const pnlPercentage = initialCapital !== 0 ? (currentEquity - initialCapital) / initialCapital : 0

  const winCount = closedTrades.filter((p) => p.winLoss === 'WIN').length
  const lossCount = closedTrades.filter((p) => p.winLoss === 'LOSS').length
  const totalDecided = winCount + lossCount

  const winRate = totalDecided > 0 ? winCount / totalDecided : 0
  const lossRate = totalDecided > 0 ? lossCount / totalDecided : 0

  const winningTrades = closedTrades.filter((p) => p.realizedPnl > 0)
  const losingTrades = closedTrades.filter((p) => p.realizedPnl < 0)

  const avgWin =
    winningTrades.length > 0
      ? winningTrades.reduce((s, p) => s + p.realizedPnl, 0) / winningTrades.length
      : 0
  const avgLoss =
    losingTrades.length > 0
      ? -(losingTrades.reduce((s, p) => s + p.realizedPnl, 0) / losingTrades.length)
      : 0

  const expectancy = winRate * avgWin - lossRate * avgLoss

  const patternMap = new Map<string, PatternBreakdown>()
  for (const p of closedTrades) {
    const key = p.pattern || 'לא צוין'
    const entry = patternMap.get(key) || { name: key, pnl: 0, count: 0 }
    entry.pnl += p.realizedPnl
    entry.count += 1
    patternMap.set(key, entry)
  }

  const categoryMap = new Map<string, PatternBreakdown>()
  for (const p of closedTrades) {
    const key = p.category || 'ללא קטגוריה'
    const entry = categoryMap.get(key) || { name: key, pnl: 0, count: 0 }
    entry.pnl += p.realizedPnl
    entry.count += 1
    categoryMap.set(key, entry)
  }

  return {
    initialCapital,
    totalRealizedPnl,
    currentEquity,
    pnlPercentage,
    winCount,
    lossCount,
    winRate,
    lossRate,
    avgWin,
    avgLoss,
    expectancy,
    patternBreakdown: Array.from(patternMap.values()).sort((a, b) => b.pnl - a.pnl),
    categoryBreakdown: Array.from(categoryMap.values()).sort((a, b) => b.pnl - a.pnl),
    closedTrades,
  }
}
