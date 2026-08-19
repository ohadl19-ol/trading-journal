import type { CalculatorResult } from '@/types'

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

  return {
    shares,
    positionSize,
    accountPercentage,
    riskPercentage,
    riskRewardRatio,
    price2R,
    price3R,
    price4R,
  }
}

/** צביעת אחוז פוזיציה/סיכון מהחשבון */
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
