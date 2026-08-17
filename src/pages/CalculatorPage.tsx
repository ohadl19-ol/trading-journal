import * as React from 'react'
import { Calculator as CalcIcon, Send } from 'lucide-react'
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
import { cn } from '@/lib/utils'

interface CalculatorPageProps {
  settings: AppSettings
  onOpenTrade: (input: OpenTradeInput) => Promise<void>
}

export function CalculatorPage({ settings, onOpenTrade }: CalculatorPageProps) {
  const { toast } = useToast()
  const [symbol, setSymbol] = React.useState('')
  const [pattern, setPattern] = React.useState<string>('')
  const [riskAmount, setRiskAmount] = React.useState(settings.defaultRiskAmount.toString())
  const [entryPrice, setEntryPrice] = React.useState('')
  const [stopLoss, setStopLoss] = React.useState('')
  const [targetPrice, setTargetPrice] = React.useState('')
  const [accountBalance, setAccountBalance] = React.useState(settings.defaultAccountBalance.toString())
  const [setupReason, setSetupReason] = React.useState('')
  const [chartUrl, setChartUrl] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)

  const riskAmountNum = parseFloat(riskAmount) || 0
  const entryPriceNum = parseFloat(entryPrice) || 0
  const stopLossNum = parseFloat(stopLoss) || 0
  const targetPriceNum = targetPrice ? parseFloat(targetPrice) : null
  const accountBalanceNum = accountBalance ? parseFloat(accountBalance) : null

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
      })
      toast('העסקה נרשמה')
      setSymbol('')
      setPattern('')
      setEntryPrice('')
      setStopLoss('')
      setTargetPrice('')
      setSetupReason('')
      setChartUrl('')
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
              <Label>יתרת חשבון ($)</Label>
              <Input
                type="number"
                value={accountBalance}
                onChange={(e) => setAccountBalance(e.target.value)}
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
              <Label>מחיר יעד ($)</Label>
              <Input type="number" value={targetPrice} onChange={(e) => setTargetPrice(e.target.value)} />
            </div>
          </div>

          {entryPriceNum > 0 && stopLossNum > 0 && entryPriceNum <= stopLossNum && (
            <p className="text-sm text-loss">מחיר הכניסה חייב להיות גבוה ממחיר הסטופ לוס</p>
          )}

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
                  label="יחס R/R"
                  value={result.riskRewardRatio !== null ? `${formatCurrency(result.riskRewardRatio)}` : '—'}
                  className={rrColorClass(result.riskRewardRatio)}
                />
                <ResultTile label="סכום סיכון" value={`$${formatCurrency(riskAmountNum)}`} />
                <ResultTile label="יעד 2R" value={`$${formatCurrency(result.price2R)}`} />
                <ResultTile label="יעד 3R" value={`$${formatCurrency(result.price3R)}`} />
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
