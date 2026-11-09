import type { Position } from '@/types'
import { computeDrawdown, computeStreaks, type EquityPoint } from '@/lib/statistics'

export interface AccountComparisonStats {
  closedCount: number
  winCount: number
  lossCount: number
  /** 0..1, מתוך עסקאות שהוכרעו (WIN/LOSS) */
  winRate: number | null
  /** ממוצע R ממומש (רווח ביחס לסיכון) */
  avgR: number | null
  /** כמה עסקאות נכנסו לממוצע ה-R (לעסקאות בלי סכום סיכון אין R) */
  rCount: number
  avgPnl: number | null
  /** תוחלת $ לעסקה: אחוז הצלחה × רווח ממוצע − אחוז כישלון × הפסד ממוצע */
  expectancy: number | null
  /** תוחלת ב-R */
  expectancyR: number | null
  totalPnl: number
  /** ירידה מקסימלית מהשיא בתוך התקופה ($, מספר חיובי) */
  maxDrawdown: number
  maxDrawdownPct: number
  longestLossStreak: number
  /** 0..1 — עסקאות שסומנו "פעלתי לפי התוכנית" מתוך כל העסקאות הסגורות בתקופה */
  followedPlanRate: number | null
  followedPlanCount: number
  /** כמה עסקאות סומנו בכלל (כן/לא) */
  planMarkedCount: number
  /** הון בתחילת התקופה (הון התחלתי + רווח/הפסד שנצבר לפני התקופה) */
  periodStartEquity: number
}

function rOf(p: Position): number | null {
  if (p.realizedR !== null && p.realizedR !== undefined && Number.isFinite(p.realizedR)) return p.realizedR
  return p.riskAmount > 0 ? p.realizedPnl / p.riskAmount : null
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

/**
 * מדדי השוואה לחשבון אחד בתקופה [from, to) לפי תאריך סגירה. רק עסקאות סגורות נספרות —
 * עסקאות פתוחות וממתינות לכניסה לא משפיעות על אף מדד.
 */
export function computeAccountComparison(
  positions: Position[],
  initialCapital: number,
  from: Date,
  to: Date,
): AccountComparisonStats {
  const closedAll = positions
    .filter((p) => p.status === 'סגורה' && p.closeDate)
    .sort((a, b) => new Date(a.closeDate!).getTime() - new Date(b.closeDate!).getTime())

  const before = closedAll.filter((p) => new Date(p.closeDate!) < from)
  const inPeriod = closedAll.filter((p) => {
    const d = new Date(p.closeDate!)
    return d >= from && d < to
  })

  const periodStartEquity = initialCapital + before.reduce((s, p) => s + p.realizedPnl, 0)

  const wins = inPeriod.filter((p) => p.winLoss === 'WIN' || (!p.winLoss && p.realizedPnl > 0))
  const losses = inPeriod.filter((p) => p.winLoss === 'LOSS' || (!p.winLoss && p.realizedPnl < 0))
  const decided = wins.length + losses.length
  const winRate = decided ? wins.length / decided : null
  const lossRate = decided ? losses.length / decided : null

  const rs = inPeriod.map(rOf).filter((r): r is number => r !== null)
  const winRs = wins.map(rOf).filter((r): r is number => r !== null)
  const lossRs = losses.map(rOf).filter((r): r is number => r !== null)

  const avgWin = avg(wins.map((p) => p.realizedPnl))
  const avgLoss = avg(losses.map((p) => -p.realizedPnl))
  const expectancy =
    winRate === null || lossRate === null ? null : winRate * (avgWin ?? 0) - lossRate * (avgLoss ?? 0)
  const avgWinR = avg(winRs)
  const avgLossR = avg(lossRs.map((r) => -r))
  const expectancyR =
    winRate === null || lossRate === null || rs.length === 0
      ? null
      : winRate * (avgWinR ?? 0) - lossRate * (avgLossR ?? 0)

  let running = periodStartEquity
  const curve: EquityPoint[] = [{ date: '', equity: running, tradeSymbol: '', tradePnl: 0 }]
  for (const p of inPeriod) {
    running += p.realizedPnl
    curve.push({ date: p.closeDate!, equity: running, tradeSymbol: p.symbol, tradePnl: p.realizedPnl })
  }
  const dd = computeDrawdown(curve)

  const followed = inPeriod.filter((p) => p.followedPlan === true).length
  const marked = inPeriod.filter((p) => p.followedPlan === true || p.followedPlan === false).length

  return {
    closedCount: inPeriod.length,
    winCount: wins.length,
    lossCount: losses.length,
    winRate,
    avgR: avg(rs),
    rCount: rs.length,
    avgPnl: avg(inPeriod.map((p) => p.realizedPnl)),
    expectancy,
    expectancyR,
    totalPnl: inPeriod.reduce((s, p) => s + p.realizedPnl, 0),
    maxDrawdown: dd.maxDrawdown,
    maxDrawdownPct: dd.maxDrawdownPercentage,
    longestLossStreak: computeStreaks(inPeriod).longestLossStreak,
    followedPlanRate: inPeriod.length ? followed / inPeriod.length : null,
    followedPlanCount: followed,
    planMarkedCount: marked,
    periodStartEquity,
  }
}

/** ברירת מחדל: 30 הימים האחרונים, כולל היום */
export function defaultCompareRange(now = new Date()): { from: string; to: string } {
  const to = new Date(now)
  const from = new Date(now)
  from.setDate(from.getDate() - 29)
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { from: iso(from), to: iso(to) }
}

/** ממיר טווח תאריכים מקומי (yyyy-mm-dd, כולל שני הקצוות) לגבולות [from, to) */
export function rangeBounds(fromStr: string, toStr: string): { from: Date; to: Date } {
  const [fy, fm, fd] = fromStr.split('-').map(Number)
  const [ty, tm, td] = toStr.split('-').map(Number)
  return { from: new Date(fy, fm - 1, fd), to: new Date(ty, tm - 1, td + 1) }
}
