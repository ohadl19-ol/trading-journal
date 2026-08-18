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

export interface EquityPoint {
  date: string // תאריך סגירה (ISO)
  equity: number
  tradeSymbol: string
  tradePnl: number
}

export interface DrawdownResult {
  maxDrawdown: number // $ (מספר חיובי = גודל הירידה)
  maxDrawdownPercentage: number
  currentDrawdown: number
  peakEquity: number
}

export interface StreakResult {
  currentStreak: number // חיובי = רצף מנצח, שלילי = רצף מפסיד
  longestWinStreak: number
  longestLossStreak: number
}

export interface MonthlyPnl {
  year: number
  month: number // 0-11
  pnl: number
  count: number
}

/**
 * עקומת הון כרונולוגית: כל נקודה היא ה-equity המצטבר מיד אחרי סגירת עסקה,
 * ממוינת לפי תאריך סגירה. נקודת הפתיחה היא ההון ההתחלתי עצמו.
 */
export function computeEquityCurve(allPositions: Position[], initialCapital: number): EquityPoint[] {
  const closedTrades = allPositions
    .filter((p) => p.status === 'סגורה' && p.closeDate)
    .sort((a, b) => new Date(a.closeDate!).getTime() - new Date(b.closeDate!).getTime())

  let running = initialCapital
  const points: EquityPoint[] = [{ date: '', equity: initialCapital, tradeSymbol: '', tradePnl: 0 }]
  for (const p of closedTrades) {
    running += p.realizedPnl
    points.push({ date: p.closeDate!, equity: running, tradeSymbol: p.symbol, tradePnl: p.realizedPnl })
  }
  return points
}

/** Max Drawdown: הירידה המצטברת הגדולה ביותר מפסגה (peak) לשפל (trough) לאורך העקומה */
export function computeDrawdown(equityCurve: EquityPoint[]): DrawdownResult {
  let peak = equityCurve.length > 0 ? equityCurve[0].equity : 0
  let maxDrawdown = 0
  let maxDrawdownPercentage = 0

  for (const point of equityCurve) {
    if (point.equity > peak) peak = point.equity
    const dd = peak - point.equity
    if (dd > maxDrawdown) {
      maxDrawdown = dd
      maxDrawdownPercentage = peak !== 0 ? dd / peak : 0
    }
  }

  const lastEquity = equityCurve.length > 0 ? equityCurve[equityCurve.length - 1].equity : 0
  const currentDrawdown = peak - lastEquity

  return { maxDrawdown, maxDrawdownPercentage, currentDrawdown, peakEquity: peak }
}

/** רצפי ניצחון/הפסד רצופים, לפי סדר סגירה כרונולוגי */
export function computeStreaks(positions: Position[]): StreakResult {
  const closedTrades = positions
    .filter((p) => p.status === 'סגורה' && p.closeDate)
    .sort((a, b) => new Date(a.closeDate!).getTime() - new Date(b.closeDate!).getTime())

  let currentStreak = 0
  let longestWinStreak = 0
  let longestLossStreak = 0
  let runWin = 0
  let runLoss = 0

  for (const p of closedTrades) {
    const isWin = p.realizedPnl >= 0
    if (isWin) {
      runWin += 1
      runLoss = 0
      currentStreak = runWin
    } else {
      runLoss += 1
      runWin = 0
      currentStreak = -runLoss
    }
    longestWinStreak = Math.max(longestWinStreak, runWin)
    longestLossStreak = Math.max(longestLossStreak, runLoss)
  }

  return { currentStreak, longestWinStreak, longestLossStreak }
}

/** פילוח רווח/הפסד לפי חודש-שנה, לפי תאריך סגירה (לשימוש במפת חום חודשית) */
export function computeMonthlyPnl(positions: Position[]): MonthlyPnl[] {
  const map = new Map<string, MonthlyPnl>()
  for (const p of positions) {
    if (p.status !== 'סגורה' || !p.closeDate) continue
    const d = new Date(p.closeDate)
    const year = d.getFullYear()
    const month = d.getMonth()
    const key = `${year}-${month}`
    const entry = map.get(key) || { year, month, pnl: 0, count: 0 }
    entry.pnl += p.realizedPnl
    entry.count += 1
    map.set(key, entry)
  }
  return Array.from(map.values()).sort((a, b) => (a.year - b.year) || (a.month - b.month))
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
