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

/**
 * שווי חשבון לתקופה מסוננת: "הון התחלתי" של הכרטיס הוא ה-equity בפועל בתחילת
 * התקופה (הון התחלתי כללי + כל הרווח/הפסד הממומש שנצבר *לפני* התקופה), ורווח/הפסד
 * ואחוזים מחושבים רק על העסקאות שבתוך התקופה המסוננת. כשאין גבול תחתון (rangeFrom
 * null, כלומר פילטר "הכול") מתנהג בדיוק כמו computeEquitySummary.
 */
export function computeEquitySummaryForRange(
  allPositions: Position[],
  initialCapital: number,
  filteredPositions: Position[],
  rangeFrom: Date | null,
): EquitySummary {
  if (!rangeFrom) {
    return computeEquitySummary(allPositions, initialCapital)
  }

  const closedBeforeRange = allPositions.filter(
    (p) => p.status === 'סגורה' && p.closeDate && new Date(p.closeDate) < rangeFrom,
  )
  const periodStartCapital = initialCapital + closedBeforeRange.reduce((sum, p) => sum + p.realizedPnl, 0)

  const closedInPeriod = filteredPositions.filter((p) => p.status === 'סגורה')
  const openInPeriod = filteredPositions.filter((p) => p.status !== 'סגורה')

  const totalRealizedPnl = closedInPeriod.reduce((sum, p) => sum + p.realizedPnl, 0)

  let unrealizedPnl = 0
  let openPositionsWithPrice = 0
  let openPositionsMissingPrice = 0
  for (const p of openInPeriod) {
    if (p.currentPrice !== null && p.currentPrice !== undefined) {
      unrealizedPnl += p.currentShares * (p.currentPrice - p.avgEntryPrice)
      openPositionsWithPrice += 1
    } else {
      openPositionsMissingPrice += 1
    }
  }

  const currentEquity = periodStartCapital + totalRealizedPnl + unrealizedPnl
  const pnlPercentage = periodStartCapital !== 0 ? (currentEquity - periodStartCapital) / periodStartCapital : 0

  return {
    initialCapital: periodStartCapital,
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

export type EquityCurveRange = { type: 'all' } | { type: 'year'; year: number } | { type: 'quarter'; year: number; quarter: 1 | 2 | 3 | 4 }

export interface YearQuarterOption {
  year: number
  quarter: 1 | 2 | 3 | 4
}

/** רשימת השנים והרבעונים הקיימים בפועל בהיסטוריית העסקאות הסגורות, ממוינים כרונולוגית */
export function getAvailableYearsAndQuarters(positions: Position[]): { years: number[]; quarters: YearQuarterOption[] } {
  const closedTrades = positions.filter((p) => p.status === 'סגורה' && p.closeDate)
  const yearSet = new Set<number>()
  const quarterSet = new Set<string>()
  for (const p of closedTrades) {
    const d = new Date(p.closeDate!)
    const year = d.getFullYear()
    const quarter = (Math.floor(d.getMonth() / 3) + 1) as 1 | 2 | 3 | 4
    yearSet.add(year)
    quarterSet.add(`${year}-${quarter}`)
  }
  const years = Array.from(yearSet).sort((a, b) => a - b)
  const quarters = Array.from(quarterSet)
    .map((k) => {
      const [year, quarter] = k.split('-').map(Number)
      return { year, quarter: quarter as 1 | 2 | 3 | 4 }
    })
    .sort((a, b) => a.year - b.year || a.quarter - b.quarter)
  return { years, quarters }
}

/**
 * עקומת הון לתקופה נבחרת (שנה / רבעון / הכול). נקודת ההתחלה של העקומה היא ה-equity
 * שהיה בפועל בתחילת התקופה (הון התחלתי + כל הרווח/הפסד שנצבר בעסקאות שנסגרו *לפני*
 * התקופה) — כך שהעקומה מציגה את התנועה האמיתית בתוך התקופה, לא מתחילה תמיד מ-0.
 */
export function computeEquityCurveForRange(
  allPositions: Position[],
  initialCapital: number,
  range: EquityCurveRange,
): EquityPoint[] {
  const closedTrades = allPositions
    .filter((p) => p.status === 'סגורה' && p.closeDate)
    .sort((a, b) => new Date(a.closeDate!).getTime() - new Date(b.closeDate!).getTime())

  function inRange(dateStr: string): boolean {
    if (range.type === 'all') return true
    const d = new Date(dateStr)
    if (range.type === 'year') return d.getFullYear() === range.year
    const quarter = Math.floor(d.getMonth() / 3) + 1
    return d.getFullYear() === range.year && quarter === range.quarter
  }

  function isBeforeRange(dateStr: string): boolean {
    if (range.type === 'all') return false
    const d = new Date(dateStr)
    if (range.type === 'year') return d.getFullYear() < range.year
    const quarter = Math.floor(d.getMonth() / 3) + 1
    return d.getFullYear() < range.year || (d.getFullYear() === range.year && quarter < range.quarter)
  }

  let baseline = initialCapital
  for (const p of closedTrades) {
    if (isBeforeRange(p.closeDate!)) baseline += p.realizedPnl
  }

  let running = baseline
  const points: EquityPoint[] = [{ date: '', equity: baseline, tradeSymbol: '', tradePnl: 0 }]
  for (const p of closedTrades) {
    if (!inRange(p.closeDate!)) continue
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

export interface HoldingTimeResult {
  avgHoldHoursWin: number | null
  avgHoldHoursLoss: number | null
  avgHoldHoursAll: number | null
}

/**
 * זמן החזקה ממוצע (בשעות) לעסקאות סגורות — בנפרד למנצחות ומפסידות. עוזר לזהות
 * טעות נפוצה: החזקת הפסדים זמן ארוך יותר מרווחים.
 */
export function computeHoldingTime(positions: Position[]): HoldingTimeResult {
  const closedTrades = positions.filter((p) => p.status === 'סגורה' && p.closeDate && p.openDate)

  const hoursFor = (p: Position) =>
    (new Date(p.closeDate!).getTime() - new Date(p.openDate).getTime()) / (1000 * 60 * 60)

  const winHours = closedTrades.filter((p) => p.realizedPnl >= 0).map(hoursFor)
  const lossHours = closedTrades.filter((p) => p.realizedPnl < 0).map(hoursFor)
  const allHours = closedTrades.map(hoursFor)

  const avg = (arr: number[]) => (arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : null)

  return {
    avgHoldHoursWin: avg(winHours),
    avgHoldHoursLoss: avg(lossHours),
    avgHoldHoursAll: avg(allHours),
  }
}

/** מעצב שעות למחרוזת קריאה: שעות אם פחות מיום, ימים+שעות אם יותר */
export function formatHoldingTime(hours: number | null): string {
  if (hours === null) return '—'
  if (hours < 24) return `${hours.toFixed(1)} שעות`
  const days = Math.floor(hours / 24)
  const rem = Math.round(hours % 24)
  return rem > 0 ? `${days} ימים ${rem} שעות` : `${days} ימים`
}

/** אחוז הצלחה בהשוואה בין עסקאות שבהן פעלת לפי התוכנית לבין כאלה שבהן סטית ממנה */
export interface FollowedPlanStats {
  followedCount: number
  followedWinRate: number | null
  notFollowedCount: number
  notFollowedWinRate: number | null
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
  tagBreakdown: PatternBreakdown[]
  followedPlanStats: FollowedPlanStats
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

  // תגית יכולה להופיע בכמה עסקאות שונות (ובכל עסקה יכולות להיות כמה תגיות יחד) — כל
  // עסקה תורמת לכל תגית שסומנה עליה בנפרד, כדי לראות אילו טעויות/תנאים חוזרים הכי הרבה
  const tagMap = new Map<string, PatternBreakdown>()
  for (const p of closedTrades) {
    for (const tag of p.tags ?? []) {
      const entry = tagMap.get(tag) || { name: tag, pnl: 0, count: 0 }
      entry.pnl += p.realizedPnl
      entry.count += 1
      tagMap.set(tag, entry)
    }
  }

  const winRateOf = (trades: Position[]) => {
    const decided = trades.filter((p) => p.winLoss === 'WIN' || p.winLoss === 'LOSS')
    if (decided.length === 0) return null
    return decided.filter((p) => p.winLoss === 'WIN').length / decided.length
  }
  const followedTrades = closedTrades.filter((p) => p.followedPlan === true)
  const notFollowedTrades = closedTrades.filter((p) => p.followedPlan === false)
  const followedPlanStats: FollowedPlanStats = {
    followedCount: followedTrades.length,
    followedWinRate: winRateOf(followedTrades),
    notFollowedCount: notFollowedTrades.length,
    notFollowedWinRate: winRateOf(notFollowedTrades),
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
    tagBreakdown: Array.from(tagMap.values()).sort((a, b) => b.pnl - a.pnl),
    followedPlanStats,
    closedTrades,
  }
}
