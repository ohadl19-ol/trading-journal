import * as React from 'react'
import { Calculator as CalcIcon, Send, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { calculatePosition, formatCurrency, formatPercentage, percentageColorClass, rrColorClass } from '@/lib/calculations'
import { PATTERN_OPTIONS } from '@/types'
import type { AppSettings } from '@/types'
import type { OpenTradeInput } from '@/hooks/useTradingData'
import { useToast } from '@/components/ui/toast'
import { cn, combineDateTimeToIso } from '@/lib/utils'

interface CalculatorPageProps {
  settings: AppSettings
  onOpenTrade: (input: OpenTradeInput) => Promise<void>
  /** שווי החשבון הנוכחי המחושב בפועל (הון התחלתי + רווח/הפסד ממומש + לא ממומש) */
  currentEquity: number
}

export function CalculatorPage({ settings, onOpenTrade, currentEquity }: CalculatorPageProps) {
  const { toast } = useToast()
  const [symbol, setSymbol] = React.useState('')
  const [pattern, setPattern] = React.useState<string>('')
  const [riskAmount, setRiskAmount] = React.useState(settings.defaultRiskAmount.toString())
  const [entryPrice, setEntryPrice] = React.useState('')
  const [stopLoss, setStopLoss] = React.useState('')
  const [targetPrice, setTargetPrice] = React.useState('')
  const [targetPriceTouched, setTargetPriceTouched] = React.useState(false)
  const [accountBalance, setAccountBalance] = React.useState(() =>
    (currentEquity || settings.defaultAccountBalance).toString(),
  )
  const [accountBalanceTouched, setAccountBalanceTouched] = React.useState(false)
  const [setupReason, setSetupReason] = React.useState('')
  const [chartUrl, setChartUrl] = React.useState('')
  const [entryDate, setEntryDate] = React.useState('')
  const [entryTime, setEntryTime] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)

  // כשהשווי הנוכחי המחושב מתעדכן (למשל אחרי טעינת נתונים מהשרת) ועדיין לא ערכת ידנית
  // את השדה בעצמך, ממלאים אותו אוטומטית עם השווי המעודכן
  React.useEffect(() => {
    if (!accountBalanceTouched && currentEquity) {
      setAccountBalance(currentEquity.toString())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEquity])

  const riskAmountNum = parseFloat(riskAmount) || 0
  const entryPriceNum = parseFloat(entryPrice) || 0
  const stopLossNum = parseFloat(stopLoss) || 0
  const targetPriceNum = targetPrice ? parseFloat(targetPrice) : null
  const accountBalanceNum = accountBalance ? parseFloat(accountBalance) : null

  // מרחק הסטופ מהכניסה באחוזים — מוצג מיד ברגע שיש מחיר כניסה וסטופ תקינים,
  // גם לפני שממלאים את שאר השדות, כדי לתת פידבק מהיר על גודל הסיכון היחסי
  const stopPct =
    entryPriceNum > 0 && stopLossNum > 0 && entryPriceNum > stopLossNum
      ? ((entryPriceNum - stopLossNum) / entryPriceNum) * 100
      : null

  // הצעת יעד ברירת מחדל של 2R, כדי שיחס R/R לא יישאר ריק אם לא הוזן יעד ידני
  const suggestedTarget2R =
    entryPriceNum > 0 && stopLossNum > 0 && entryPriceNum > stopLossNum
      ? entryPriceNum + 2 * (entryPriceNum - stopLossNum)
      : null

  React.useEffect(() => {
    if (!targetPriceTouched && suggestedTarget2R !== null) {
      setTargetPrice(suggestedTarget2R.toFixed(2))
    }
    if (!targetPriceTouched && suggestedTarget2R === null) {
      setTargetPrice('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestedTarget2R, targetPriceTouched])

  const isValid =
    symbol.trim().length > 0 &&
    pattern.trim().length > 0 &&
    riskAmountNum > 0 &&
    entryPriceNum > 0 &&
    stopLossNum > 0 &&
    entryPriceNum > stopLossNum

  const result = isValid
    ? calculatePosition({
        riskAmount: riskAmountNum,
        entryPrice: entryPriceNum,
        stopLoss: stopLossNum,
        targetPrice: targetPriceNum,
        accountBalance: accountBalanceNum,
      })
    : null

  async function handleSubmit() {
    if (!result) return
    setSubmitting(true)
    try {
      await onOpenTrade({
        symbol,
        pattern,
        riskAmount: riskAmountNum,
        entryPrice: entryPriceNum,
        stopLoss: stopLossNum,
        targetPrice: targetPriceNum,
        accountBalance: accountBalanceNum,
        setupReason,
        chartUrl,
        openDate: combineDateTimeToIso(entryDate, entryTime),
      })
      toast('העסקה נרשמה')
      setSymbol('')
      setPattern('')
      setEntryPrice('')
      setStopLoss('')
      setTargetPrice('')
      setTargetPriceTouched(false)
      setSetupReason('')
      setChartUrl('')
      setEntryDate('')
      setEntryTime('')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'שגיאה ברישום העסקה', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalcIcon className="h-5 w-5 text-accent" />
            מחשבון גודל פוזיציה
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>סימול (Ticker) *</Label>
              <Input
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder="AAPL"
              />
            </div>
            <div>
              <Label>סוג הגרף (Pattern) *</Label>
              <Select value={pattern} onChange={(e) => setPattern(e.target.value)}>
                <option value="">בחר...</option>
                {PATTERN_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>סכום סיכון ($) *</Label>
              <Input type="number" value={riskAmount} onChange={(e) => setRiskAmount(e.target.value)} />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <Label className="mb-0">יתרת חשבון ($)</Label>
                {currentEquity > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setAccountBalance(currentEquity.toString())
                      setAccountBalanceTouched(false)
                    }}
                    className="flex items-center gap-1 text-xs text-accent hover:underline"
                    title="עדכן ליתרה הנוכחית המחושבת מהיומן"
                  >
                    <RefreshCw className="h-3 w-3" />
                    שווי נוכחי: ${formatCurrency(currentEquity)}
                  </button>
                )}
              </div>
              <Input
                type="number"
                value={accountBalance}
                onChange={(e) => {
                  setAccountBalance(e.target.value)
                  setAccountBalanceTouched(true)
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>מחיר כניסה ($) *</Label>
              <Input type="number" value={entryPrice} onChange={(e) => setEntryPrice(e.target.value)} />
            </div>
            <div>
              <Label>סטופ לוס ($) *</Label>
              <Input type="number" value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <Label className="mb-0">מחיר יעד ($)</Label>
                {targetPriceTouched && suggestedTarget2R !== null && (
                  <button
                    type="button"
                    onClick={() => setTargetPriceTouched(false)}
                    className="text-xs text-accent hover:underline"
                    title="חזור להצעת 2R אוטומטית"
                  >
                    איפוס ל-2R
                  </button>
                )}
              </div>
              <Input
                type="number"
                value={targetPrice}
                onChange={(e) => {
                  setTargetPrice(e.target.value)
                  setTargetPriceTouched(true)
                }}
              />
              {!targetPriceTouched && suggestedTarget2R !== null && (
                <p className="mt-1 text-[11px] text-text-muted">מולא אוטומטית לפי יעד 2R — ניתן לערוך</p>
              )}
            </div>
          </div>

          {entryPriceNum > 0 && stopLossNum > 0 && entryPriceNum <= stopLossNum && (
            <p className="text-sm text-loss">מחיר הכניסה חייב להיות גבוה ממחיר הסטופ לוס</p>
          )}

          {stopPct !== null && (
            <div
              className={cn(
                'flex items-center justify-between rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm',
                percentageColorClass(stopPct),
              )}
            >
              <span>מרחק הסטופ מהכניסה</span>
              <span className="num-tabular font-semibold">{formatPercentage(stopPct)}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>תאריך כניסה</Label>
              <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
            </div>
            <div>
              <Label>שעת כניסה</Label>
              <Input type="time" value={entryTime} onChange={(e) => setEntryTime(e.target.value)} />
            </div>
          </div>
          <p className="-mt-2 text-xs text-text-muted">
            השאר ריק כדי להשתמש ברגע הנוכחי (עדכון אוטומטי בזמן לחיצה על "ביצוע עסקה")
          </p>

          <div>
            <Label>סיבת כניסה / סטאפ</Label>
            <Textarea value={setupReason} onChange={(e) => setSetupReason(e.target.value)} rows={2} />
          </div>

          <div>
            <Label>קישור צ'ארט מ-TradingView</Label>
            <Input value={chartUrl} onChange={(e) => setChartUrl(e.target.value)} placeholder="https://..." />
          </div>

          <Button className="w-full" disabled={!isValid || submitting} onClick={handleSubmit}>
            <CalcIcon className="h-4 w-4" />
            חשב פוזיציה
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>תוצאות החישוב</CardTitle>
        </CardHeader>
        <CardContent>
          {!result ? (
            <div className="flex h-64 items-center justify-center text-center text-text-muted">
              מלא את כל השדות הנדרשים כדי לראות תוצאות
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <ResultTile label="מספר מניות" value={result.shares.toLocaleString('he-IL')} />
                <ResultTile label="גודל פוזיציה" value={`$${formatCurrency(result.positionSize)}`} />
                <ResultTile
                  label="% פוזיציה מהחשבון"
                  value={formatPercentage(result.accountPercentage)}
                  className={percentageColorClass(result.accountPercentage)}
                />
                <ResultTile
                  label="% סיכון מהחשבון"
                  value={formatPercentage(result.riskPercentage)}
                  className={percentageColorClass(result.riskPercentage)}
                />
                <ResultTile
                  label="% מרחק סטופ מהכניסה"
                  value={formatPercentage(result.stopLossPercentage)}
                  className={percentageColorClass(result.stopLossPercentage)}
                />
                <ResultTile
                  label="יחס R/R"
                  value={result.riskRewardRatio !== null ? `${formatCurrency(result.riskRewardRatio)}` : '—'}
                  className={rrColorClass(result.riskRewardRatio)}
                />
                <ResultTile label="סכום סיכון" value={`$${formatCurrency(riskAmountNum)}`} />
                <ResultTile label="יעד 2R" value={`$${formatCurrency(result.price2R)}`} />
                <ResultTile label="יעד 3R" value={`$${formatCurrency(result.price3R)}`} />
                <ResultTile label="יעד 4R" value={`$${formatCurrency(result.price4R)}`} />
              </div>

              <Button
                variant="success"
                className="w-full"
                disabled={!isValid || submitting}
                onClick={handleSubmit}
              >
                <Send className="h-4 w-4" />
                {submitting ? 'שולח...' : 'ביצוע עסקה'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ResultTile({
  label,
  value,
  className,
}: {
  label: string
  value: string
  className?: string
}) {
  return (
    <div className="rounded-lg border border-border bg-surface-2 p-3">
      <div className="text-xs text-text-muted">{label}</div>
      <div className={cn('mt-1 text-lg font-semibold num-tabular', className)}>{value}</div>
    </div>
  )
}
