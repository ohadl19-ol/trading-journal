import type { CalculatorResult, Position } from '@/types'

export interface CalculatorInput {
  riskAmount: number
  entryPrice: number
  stopLoss: number
  targetPrice?: number | null
  accountBalance?: number | null
}

/** חישוב גודל פוזיציה לפי סכום סיכון, מחיר כניסה וסטופ לוס */
export function calculatePosition(input: CalculatorInput): CalculatorResult {
  const { riskAmount, entryPrice, stopLoss, targetPrice, accountBalance } = input

  const riskPerShare = entryPrice - stopLoss
  const shares = riskPerShare > 0 ? Math.floor(riskAmount / riskPerShare) : 0
  const positionSize = shares * entryPrice

  const accountPercentage =
    accountBalance && accountBalance > 0 ? (positionSize / accountBalance) * 100 : null
  const riskPercentage =
    accountBalance && accountBalance > 0 ? (riskAmount / accountBalance) * 100 : null

  const riskRewardRatio =
    targetPrice && targetPrice > 0 && riskPerShare > 0
      ? (targetPrice - entryPrice) / riskPerShare
      : null

  const price2R = entryPrice + 2 * riskPerShare
  const price3R = entryPrice + 3 * riskPerShare
  const price4R = entryPrice + 4 * riskPerShare

  const stopLossPercentage =
    entryPrice > 0 && riskPerShare > 0 ? (riskPerShare / entryPrice) * 100 : null

  return {
    shares,
    positionSize,
    accountPercentage,
    riskPercentage,
    riskRewardRatio,
    price2R,
    price3R,
    price4R,
    stopLossPercentage,
  }
}

/** צביעת אחוז פוזיציה/סיכון מהחשבון, וגם אחוז מרחק הסטופ מהכניסה (אותם ספי 5%/10%) */
export function percentageColorClass(pct: number | null): string {
  if (pct === null) return ''
  if (pct > 10) return 'text-loss'
  if (pct >= 5) return 'text-warn'
  return 'text-win'
}

/** צביעת יחס R/R */
export function rrColorClass(rr: number | null): string {
  if (rr === null) return ''
  if (rr >= 2) return 'text-win'
  if (rr >= 1) return 'text-warn'
  return 'text-loss'
}

/**
 * גוזר את סכום הסיכון ($) שצריך להזין כדי ש-calculatePosition יחשב בדיוק את כמות המניות
 * המבוקשת (shares = floor(riskAmount / riskPerShare)). מוסיף באפר זעיר של סנט אחד כדי
 * להימנע ממקרה גבולי של שגיאת נקודה צפה (floor שמוריד מניה שלמה בטעות), בלי סיכון
 * לגלוש למניה נוספת (זה ידרוש באפר בגודל riskPerShare שלם, לא סנט בודד).
 */
export function riskAmountForExactShares(entryPrice: number, stopLoss: number, shares: number): number | null {
  const riskPerShare = entryPrice - stopLoss
  if (riskPerShare <= 0 || shares <= 0) return null
  return Math.round(shares * riskPerShare * 100) / 100 + 0.01
}

/** האם המחיר הנוכחי של פוזיציה פתוחה חצה (ירד עד/מתחת ל)- הסטופ לוס שלה */
export function isStopLossBreached(position: Position): boolean {
  return position.status !== 'סגורה' && position.currentPrice != null && position.currentPrice <= position.stopLoss
}

export function formatCurrency(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return value.toLocaleString('he-IL', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return value.toLocaleString('he-IL')
}

export function formatPercentage(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return `${value.toLocaleString('he-IL', { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`
}
