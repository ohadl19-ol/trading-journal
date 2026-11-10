import * as React from 'react'
import {
  AlertOctagon,
  ArrowLeftCircle,
  Award,
  ExternalLink,
  ClipboardCopy,
  RefreshCw,
  Download,
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
import { formatCurrency, formatNumber, formatPercentage, isOpenPosition, isPendingPosition, parseOrderExpiry } from '@/lib/calculations'
import { useLivePricesContext } from '@/hooks/useLivePrices'
import { computeLiveMetrics } from '@/lib/livePrice'
import { PriceFreshness } from '@/components/LivePrice'
import { tradingViewSymbolUrl, tradingViewWatchlistFile, uniqueSymbols } from '@/lib/tradingview'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import type { Position } from '@/types'
import { cn } from '@/lib/utils'

interface DashboardPageProps {
  positions: Position[]
  initialCapital: number
  loading: boolean
  isDemo?: boolean
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

export function DashboardPage({ positions, initialCapital, loading, isDemo = false, onNavigate }: DashboardPageProps) {
  const { toast } = useToast()
  const live = useLivePricesContext()
  // לחישובי שווי בלבד: פוזיציות פתוחות עם המחיר החי (אם יש). לא נכתב לשום מקום.
  const positionsWithLive = React.useMemo(
    () =>
      positions.map((p) => {
        const q = isOpenPosition(p) ? live.quotes[p.symbol.toUpperCase()] : undefined
        return q ? { ...p, currentPrice: q.price } : p
      }),
    [positions, live.quotes],
  )
  const equity = React.useMemo(() => computeEquitySummary(positionsWithLive, initialCapital), [positionsWithLive, initialCapital])
  const equityCurve = React.useMemo(() => computeEquityCurve(positions, initialCapital), [positions, initialCapital])
  const streaks = React.useMemo(() => computeStreaks(positions), [positions])
  const stats = React.useMemo(() => computeStatistics(positions, initialCapital), [positions, initialCapital])

  const today = React.useMemo(() => pnlSince(positions, startOfDay(new Date())), [positions])
  const week = React.useMemo(() => pnlSince(positions, startOfWeek(new Date())), [positions])

  const openPositions = React.useMemo(
    () =>
      [...positions]
        .filter(isOpenPosition)
        .sort((a, b) => new Date(b.openDate).getTime() - new Date(a.openDate).getTime()),
    [positions],
  )
  const pendingPositions = React.useMemo(
    () =>
      positions
        .filter(isPendingPosition)
        .sort((a, b) => new Date(b.openDate).getTime() - new Date(a.openDate).getTime()),
    [positions],
  )
  const metricsById = React.useMemo(
    () => new Map(openPositions.map((p) => [p.tradeId, computeLiveMetrics(p, live.quotes[p.symbol.toUpperCase()], live.now)])),
    [openPositions, live.quotes, live.now],
  )
  const breachedPositions = React.useMemo(
    () => openPositions.filter((p) => metricsById.get(p.tradeId)?.nearStop),
    [openPositions, metricsById],
  )
  const totalUnrealized = React.useMemo(
    () => openPositions.reduce((sum, p) => sum + (metricsById.get(p.tradeId)?.unrealized ?? 0), 0),
    [openPositions, metricsById],
  )
  const totalDaily = React.useMemo(() => {
    const vals = openPositions.map((p) => metricsById.get(p.tradeId)?.dailyPnl).filter((v): v is number => v != null)
    return vals.length ? vals.reduce((a, b) => a + b, 0) : null
  }, [openPositions, metricsById])
  const tone = (v: number | null | undefined) => (v == null || v === 0 ? undefined : v > 0 ? 'text-win' : 'text-loss')

  const [detailPosition, setDetailPosition] = React.useState<Position | null>(null)

  const showSkeleton = loading && positions.length === 0

  return (
    <div className="space-y-4">
      {breachedPositions.length > 0 && (
        <Card className="border-loss ring-1 ring-loss/40">
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center gap-2 font-medium text-loss">
              <AlertOctagon className="h-4 w-4 shrink-0" />
              {breachedPositions.length} פוזיציות פתוחות קרובות לסטופ או מתחתיו — כדאי לבדוק (תצוגה בלבד, שום דבר לא נסגר אוטומטית)
            </div>
            <div className="flex flex-wrap gap-2">
              {breachedPositions.map((p) => (
                <button
                  key={p.tradeId}
                  onClick={() => onNavigate('journal')}
                  className="rounded-full bg-loss-bg px-3 py-1 text-xs font-medium text-loss hover:brightness-110"
                >
                  {p.symbol} · ${formatCurrency(metricsById.get(p.tradeId)?.price)} · סטופ ${formatCurrency(p.stopLoss)}
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
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle>פוזיציות פתוחות ({openPositions.length})</CardTitle>
          <div className="flex items-center gap-3">
            {openPositions.length > 0 && (
              <span className="text-[11px] text-text-muted">
                {live.error ? (
                  <span className="text-warn">מחיר לא עדכני</span>
                ) : live.marketOpen ? (
                  'המסחר פתוח · רענון כל 3 דקות'
                ) : (
                  'המסחר סגור · מחיר סגירה'
                )}
              </span>
            )}
            {openPositions.length > 0 && (
              <Button size="sm" variant="outline" onClick={() => live.refresh()} disabled={live.loading} data-testid="refresh-prices">
                <RefreshCw className={cn('h-3.5 w-3.5', live.loading && 'animate-spin')} />
                רענן מחירים
              </Button>
            )}
            <button
              onClick={() => onNavigate('journal')}
              className="flex items-center gap-1 text-xs font-medium text-accent hover:underline"
            >
              כל היומן <ArrowLeftCircle className="h-3.5 w-3.5" />
            </button>
          </div>
        </CardHeader>
        {!showSkeleton && openPositions.length > 0 && (
          <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-1 pb-0 pt-0 text-xs text-text-muted">
            <span>
              רווח/הפסד יומי (מול סגירת אתמול):{' '}
              <b className={totalDaily == null ? 'text-text' : totalDaily >= 0 ? 'text-win' : 'text-loss'}>
                {totalDaily == null ? '—' : `${totalDaily >= 0 ? '+' : ''}$${formatCurrency(totalDaily)}`}
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
            openPositions.map((p) => {
              const m = metricsById.get(p.tradeId)!
              const quote = live.quotes[p.symbol.toUpperCase()] ?? null
              const signed = (v: number | null, fmt: (n: number) => string) => (v == null ? '—' : `${v >= 0 ? '+' : ''}${fmt(v)}`)
              return (
                <button
                  key={p.tradeId}
                  onClick={() => setDetailPosition(p)}
                  data-testid="open-row"
                  className={cn(
                    'w-full rounded-lg border bg-surface-2 px-3 py-2 text-right hover:bg-surface',
                    m.nearStop ? 'border-loss bg-loss-bg/40' : m.hitTarget ? 'border-win bg-win-bg/40' : 'border-border',
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-text">{p.symbol}</span>
                      {m.nearStop && <Badge variant="loss">{m.price != null && m.price <= p.stopLoss ? 'מתחת לסטופ' : 'קרוב לסטופ'}</Badge>}
                      {!m.nearStop && m.hitTarget && <Badge variant="win">הגיע ליעד</Badge>}
                      <span className="num-tabular text-sm font-semibold text-text">${formatCurrency(m.price)}</span>
                      <PriceFreshness quote={quote} hasSheetPrice={p.currentPrice != null} />
                    </div>
                    <span className={cn('num-tabular text-sm font-semibold', m.unrealized == null ? 'text-text-muted' : m.unrealized >= 0 ? 'text-win' : 'text-loss')}>
                      {signed(m.unrealized, (n) => `$${formatCurrency(n)}`)}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-text-muted">
                    <span>{formatNumber(p.currentShares)} מניות · כניסה ${formatCurrency(p.avgEntryPrice)}</span>
                    <span className={tone(m.pctFromEntry)}>מהכניסה {signed(m.pctFromEntry, (n) => formatPercentage(n))}</span>
                    <span className={tone(m.currentR)}>{signed(m.currentR, (n) => `${n.toFixed(2)}R`)}</span>
                    <span className={m.nearStop ? 'text-loss' : undefined}>
                      מהסטופ {m.stopDistancePct == null ? '—' : formatPercentage(m.stopDistancePct)}
                    </span>
                    <span className={tone(m.dailyPnl)}>יומי {signed(m.dailyPnl, (n) => `$${formatCurrency(n)}`)}</span>
                  </div>
                </button>
              )
            })
          )}
        </CardContent>
      </Card>

      {pendingPositions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>הוראות ממתינות ({pendingPositions.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-text-muted">פקודות שעוד לא בוצעו. לא נכללות בשווי, ברווח/הפסד ובסטטיסטיקה.</p>
            {pendingPositions.map((p) => {
              const expiry = parseOrderExpiry(p.setupReason) ?? parseOrderExpiry(p.notes)
              return (
                <button
                  key={p.tradeId}
                  onClick={() => setDetailPosition(p)}
                  className="w-full rounded-lg border border-dashed border-border bg-surface-2 px-3 py-2 text-right hover:bg-surface"
                  data-testid="pending-row"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-text">{p.symbol}</span>
                    <Badge variant="pending">{p.status}</Badge>
                    {expiry && <span className="text-xs text-text-muted">בתוקף עד {expiry}</span>}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-text-muted">
                    <span>כניסה מותנית <b className="text-text">${formatCurrency(p.avgEntryPrice)}</b></span>
                    <span>סטופ <b className="text-text">${formatCurrency(p.stopLoss)}</b></span>
                    <span>יעד <b className="text-text">{p.targetPrice ? `$${formatCurrency(p.targetPrice)}` : '—'}</b></span>
                    <span>כמות <b className="text-text">{formatNumber(p.originalShares)}</b></span>
                  </div>
                </button>
              )
            })}
          </CardContent>
        </Card>
      )}

      {(openPositions.length > 0 || pendingPositions.length > 0) && (() => {
        const symbols = uniqueSymbols([...openPositions, ...pendingPositions].map((p) => p.symbol))
        const listName = isDemo ? 'מסחר דמו' : 'פוזיציות פתוחות'
        return (
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="text-sm">
                <div className="font-medium text-text">רשימה ל-TradingView: {listName}</div>
                <div className="text-xs text-text-muted">
                  {symbols.join(', ')} · פתוחות וממתינות לכניסה
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(symbols.join(','))
                      toast(`הועתקו ${symbols.length} סימולים. ב-TradingView: + ברשימה ← הדבק`)
                    } catch {
                      toast('לא הצלחתי להעתיק. נסה את הורדת הקובץ', 'error')
                    }
                  }}
                >
                  <ClipboardCopy className="h-3.5 w-3.5" />
                  העתק סימולים
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const blob = new Blob([tradingViewWatchlistFile(listName, symbols)], { type: 'text/plain;charset=utf-8' })
                    const a = document.createElement('a')
                    a.href = URL.createObjectURL(blob)
                    a.download = `${listName}.txt`
                    a.click()
                    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
                  }}
                >
                  <Download className="h-3.5 w-3.5" />
                  קובץ לייבוא
                </Button>
              </div>
            </CardContent>
          </Card>
        )
      })()}

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
        <Dialog
          open={!!detailPosition}
          onClose={() => setDetailPosition(null)}
          title={detailPosition.symbol}
          description={isPendingPosition(detailPosition) ? 'ממתינה לכניסה — פקודה שעוד לא בוצעה, ללא רווח/הפסד' : 'פרטי הפוזיציה הפתוחה'}
        >
          <div className="space-y-4">
            {detailPosition.setupReason && (
              <div>
                <div className="text-[11px] text-text-muted">סיבת כניסה</div>
                <p className="mt-0.5 text-sm text-text">💡 {detailPosition.setupReason}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {(() => {
                if (!isOpenPosition(detailPosition)) return null
                const m = computeLiveMetrics(detailPosition, live.quotes[detailPosition.symbol.toUpperCase()], live.now)
                if (m.price == null) return null
                const sg = (v: number | null, f: (n: number) => string) => (v == null ? '—' : `${v >= 0 ? '+' : ''}${f(v)}`)
                return (
                  <>
                    <InlineField label="מחיר נוכחי" value={`$${formatCurrency(m.price)}`} />
                    <InlineField label="רווח/הפסד לא ממומש" value={sg(m.unrealized, (n) => `$${formatCurrency(n)}`)} className={tone(m.unrealized)} />
                    <InlineField label="שינוי מהכניסה" value={sg(m.pctFromEntry, (n) => formatPercentage(n))} className={tone(m.pctFromEntry)} />
                    <InlineField label="R נוכחי" value={sg(m.currentR, (n) => `${n.toFixed(2)}R`)} className={tone(m.currentR)} />
                    <InlineField label="מרחק מהסטופ" value={m.stopDistancePct == null ? '—' : formatPercentage(m.stopDistancePct)} className={m.nearStop ? 'text-loss' : undefined} />
                    <InlineField label="רווח/הפסד יומי" value={sg(m.dailyPnl, (n) => `$${formatCurrency(n)}`)} className={tone(m.dailyPnl)} />
                  </>
                )
              })()}
              <InlineField label="מחיר כניסה" value={`$${formatCurrency(detailPosition.avgEntryPrice)}`} />
              <InlineField
                label={isPendingPosition(detailPosition) ? 'כמות מתוכננת' : 'כמות מניות'}
                value={String(isPendingPosition(detailPosition) ? detailPosition.originalShares : detailPosition.currentShares)}
              />
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

