import * as React from 'react'
import {
  AlertOctagon,
  ArrowLeftCircle,
  Award,
  ExternalLink,
  Flame,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatCardSkeleton } from '@/components/ui/skeleton'
import { StatTile, InlineField } from '@/components/ui/labeled-value'
import { Dialog } from '@/components/ui/dialog'
import { EquityCurveChart } from '@/components/EquityCurveChart'
import { computeEquitySummary, computeEquityCurve, computeStreaks, computeStatistics } from '@/lib/statistics'
import { formatCurrency, formatPercentage, isStopLossBreached } from '@/lib/calculations'
import { tradingViewSymbolUrl } from '@/lib/tradingview'
import type { Position } from '@/types'
import { cn } from '@/lib/utils'

interface DashboardPageProps {
  positions: Position[]
  initialCapital: number
  loading: boolean
  onNavigate: (tab: 'journal' | 'statistics') => void
}

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function startOfWeek(d: Date): Date {
  const x = startOfDay(d)
  x.setDate(x.getDate() - x.getDay())
  return x
}

function pnlSince(positions: Position[], since: Date): { pnl: number; count: number } {
  const trades = positions.filter((p) => p.status === 'סגורה' && p.closeDate && new Date(p.closeDate) >= since)
  return { pnl: trades.reduce((s, p) => s + p.realizedPnl, 0), count: trades.length }
}

export function DashboardPage({ positions, initialCapital, loading, onNavigate }: DashboardPageProps) {
  const equity = React.useMemo(() => computeEquitySummary(positions, initialCapital), [positions, initialCapital])
  const equityCurve = React.useMemo(() => computeEquityCurve(positions, initialCapital), [positions, initialCapital])
  const streaks = React.useMemo(() => computeStreaks(positions), [positions])
  const stats = React.useMemo(() => computeStatistics(positions, initialCapital), [positions, initialCapital])

  const today = React.useMemo(() => pnlSince(positions, startOfDay(new Date())), [positions])
  const week = React.useMemo(() => pnlSince(positions, startOfWeek(new Date())), [positions])

  const openPositions = React.useMemo(
    () =>
      [...positions]
        .filter((p) => p.status !== 'סגורה')
        .sort((a, b) => new Date(b.openDate).getTime() - new Date(a.openDate).getTime()),
    [positions],
  )
  const breachedPositions = React.useMemo(() => openPositions.filter(isStopLossBreached), [openPositions])
  const totalUnrealized = React.useMemo(
    () =>
      openPositions.reduce(
        (sum, p) => (p.currentPrice != null ? sum + p.currentShares * (p.currentPrice - p.avgEntryPrice) : sum),
        0,
      ),
    [openPositions],
  )

  const [detailPosition, setDetailPosition] = React.useState<Position | null>(null)

  const showSkeleton = loading && positions.length === 0

  return (
    <div className="space-y-4">
      {breachedPositions.length > 0 && (
        <Card className="border-loss ring-1 ring-loss/40">
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center gap-2 font-medium text-loss">
              <AlertOctagon className="h-4 w-4 shrink-0" />
              {breachedPositions.length} פוזיציות פתוחות חצו את הסטופ לוס — כדאי לבדוק
            </div>
            <div className="flex flex-wrap gap-2">
              {breachedPositions.map((p) => (
                <button
                  key={p.tradeId}
                  onClick={() => onNavigate('journal')}
                  className="rounded-full bg-loss-bg px-3 py-1 text-xs font-medium text-loss hover:brightness-110"
                >
                  {p.symbol} · ${formatCurrency(p.currentPrice)} מתחת לסטופ ${formatCurrency(p.stopLoss)}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {showSkeleton ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatTile icon={<Award className="h-4 w-4" />} label="שווי נוכחי" value={`$${formatCurrency(equity.currentEquity)}`} />
            <StatTile
              icon={today.pnl >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              label={`רווח/הפסד היום${today.count > 0 ? ` (${today.count})` : ''}`}
              value={today.count > 0 ? `${today.pnl >= 0 ? '+' : ''}$${formatCurrency(today.pnl)}` : '—'}
              valueClass={today.count > 0 ? (today.pnl >= 0 ? 'text-win' : 'text-loss') : undefined}
            />
            <StatTile
              icon={week.pnl >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              label={`רווח/הפסד השבוע${week.count > 0 ? ` (${week.count})` : ''}`}
              value={week.count > 0 ? `${week.pnl >= 0 ? '+' : ''}$${formatCurrency(week.pnl)}` : '—'}
              valueClass={week.count > 0 ? (week.pnl >= 0 ? 'text-win' : 'text-loss') : undefined}
            />
            <StatTile
              icon={<Flame className="h-4 w-4" />}
              label="רצף נוכחי"
              value={streaks.currentStreak === 0 ? '—' : `${Math.abs(streaks.currentStreak)} ${streaks.currentStreak > 0 ? 'ניצחונות' : 'הפסדים'}`}
              valueClass={streaks.currentStreak > 0 ? 'text-win' : streaks.currentStreak < 0 ? 'text-loss' : undefined}
            />
          </>
        )}
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <CardTitle>עקומת הון</CardTitle>
          <button
            onClick={() => onNavigate('statistics')}
            className="flex items-center gap-1 text-xs font-medium text-accent hover:underline"
          >
            סטטיסטיקה מלאה <ArrowLeftCircle className="h-3.5 w-3.5" />
          </button>
        </CardHeader>
        <CardContent>
          {showSkeleton ? (
            <div className="h-64 animate-pulse rounded-lg bg-surface-2" />
          ) : (
            <EquityCurveChart points={equityCurve} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <CardTitle>פוזיציות פתוחות ({openPositions.length})</CardTitle>
          <button
            onClick={() => onNavigate('journal')}
            className="flex items-center gap-1 text-xs font-medium text-accent hover:underline"
          >
            כל היומן <ArrowLeftCircle className="h-3.5 w-3.5" />
          </button>
        </CardHeader>
        {!showSkeleton && openPositions.length > 0 && (
          <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-1 pb-0 pt-0 text-xs text-text-muted">
            <span>
              רווח/הפסד יומי:{' '}
              <b className={today.count > 0 ? (today.pnl >= 0 ? 'text-win' : 'text-loss') : 'text-text'}>
                {today.count > 0 ? `${today.pnl >= 0 ? '+' : ''}$${formatCurrency(today.pnl)}` : '—'}
              </b>
            </span>
            <span>
              רווח/הפסד לא ממומש:{' '}
              <b className={totalUnrealized >= 0 ? 'text-win' : 'text-loss'}>
                {totalUnrealized >= 0 ? '+' : ''}${formatCurrency(totalUnrealized)}
              </b>
            </span>
          </CardContent>
        )}
        <CardContent className="space-y-2">
          {showSkeleton ? (
            Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-surface-2" />)
          ) : openPositions.length === 0 ? (
            <p className="py-4 text-center text-sm text-text-muted">אין כרגע פוזיציות פתוחות</p>
          ) : (
            openPositions.slice(0, 6).map((p) => {
              const unrealized = p.currentPrice != null ? p.currentShares * (p.currentPrice - p.avgEntryPrice) : null
              const unrealizedPct = p.currentPrice != null && p.avgEntryPrice > 0 ? ((p.currentPrice - p.avgEntryPrice) / p.avgEntryPrice) * 100 : null
              const breached = isStopLossBreached(p)
              return (
                <button
                  key={p.tradeId}
                  onClick={() => setDetailPosition(p)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-lg border border-border bg-surface-2 px-3 py-2 text-right hover:bg-surface',
                    breached && 'border-loss/50',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-text">{p.symbol}</span>
                    {breached && <Badge variant="loss">סטופ נחצה</Badge>}
                    <span className="text-xs text-text-muted">
                      {p.currentShares} מניות · ${formatCurrency(p.avgEntryPrice)}
                      {p.currentPrice != null && <> ← ${formatCurrency(p.currentPrice)}</>}
                    </span>
                  </div>
                  <span className="flex items-center gap-2">
                    {unrealizedPct !== null && (
                      <span className={cn('num-tabular text-xs', unrealizedPct >= 0 ? 'text-win' : 'text-loss')}>
                        ({unrealizedPct >= 0 ? '+' : ''}{formatPercentage(unrealizedPct)})
                      </span>
                    )}
                    <span className={cn('num-tabular text-sm font-medium', unrealized === null ? 'text-text-muted' : unrealized >= 0 ? 'text-win' : 'text-loss')}>
                      {unrealized === null ? '—' : `${unrealized >= 0 ? '+' : ''}$${formatCurrency(unrealized)}`}
                    </span>
                  </span>
                </button>
              )
            })
          )}
        </CardContent>
      </Card>

      {!showSkeleton && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4 text-sm text-text-muted">
            <span className="flex items-center gap-1.5">
              <Wallet className="h-4 w-4" /> {stats.closedTrades.length} עסקאות סגורות סה"כ
            </span>
            <span>אחוז הצלחה: <b className="text-text">{formatPercentage(stats.winRate * 100)}</b></span>
            <span>
              תוחלת לעסקה:{' '}
              <b className={stats.expectancy >= 0 ? 'text-win' : 'text-loss'}>${formatCurrency(stats.expectancy)}</b>
            </span>
          </CardContent>
        </Card>
      )}

      {detailPosition && (
        <Dialog open={!!detailPosition} onClose={() => setDetailPosition(null)} title={detailPosition.symbol} description="פרטי הפוזיציה הפתוחה">
          <div className="space-y-4">
            {detailPosition.setupReason && (
              <div>
                <div className="text-[11px] text-text-muted">סיבת כניסה</div>
                <p className="mt-0.5 text-sm text-text">💡 {detailPosition.setupReason}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {detailPosition.currentPrice != null && (
                <InlineField label="מחיר נוכחי" value={`$${formatCurrency(detailPosition.currentPrice)}`} />
              )}
              {detailPosition.currentPrice != null && (
                <InlineField
                  label="רווח/הפסד לא ממומש"
                  value={(() => {
                    const unrealized = detailPosition.currentShares * (detailPosition.currentPrice! - detailPosition.avgEntryPrice)
                    return `${unrealized >= 0 ? '+' : ''}$${formatCurrency(unrealized)}`
                  })()}
                  className={
                    detailPosition.currentShares * (detailPosition.currentPrice - detailPosition.avgEntryPrice) >= 0
                      ? 'text-win'
                      : 'text-loss'
                  }
                />
              )}
              <InlineField label="מחיר כניסה" value={`$${formatCurrency(detailPosition.avgEntryPrice)}`} />
              <InlineField label="כמות מניות" value={String(detailPosition.currentShares)} />
              <InlineField label="סטופ לוס" value={`$${formatCurrency(detailPosition.stopLoss)}`} />
              <InlineField label="סכום בסיכון" value={`$${formatCurrency(detailPosition.riskAmount)}`} />
              {detailPosition.targetPrice != null && (
                <InlineField label="מחיר יעד" value={`$${formatCurrency(detailPosition.targetPrice)}`} />
              )}
              {detailPosition.plannedRR != null && (
                <InlineField label="יחס R/R מתוכנן" value={detailPosition.plannedRR.toFixed(2)} />
              )}
            </div>
            {detailPosition.notes && (
              <div>
                <div className="text-[11px] text-text-muted">הערות</div>
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-text">{detailPosition.notes}</p>
              </div>
            )}
            <a
              href={tradingViewSymbolUrl(detailPosition.symbol)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm font-medium text-text hover:bg-surface"
            >
              פתח ב-TradingView <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </Dialog>
      )}
    </div>
  )
}

