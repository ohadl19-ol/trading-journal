import * as React from 'react'
import { TrendingUp, TrendingDown, Percent, Target, Award, AlertTriangle, Wallet, ArrowDownRight, Flame, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { DateRangeFilterBar } from '@/components/DateRangeFilterBar'
import { EquityCurveChart } from '@/components/EquityCurveChart'
import { MonthlyHeatmap } from '@/components/MonthlyHeatmap'
import { Select } from '@/components/ui/select'
import { StatTile } from '@/components/ui/labeled-value'
import {
  computeStatistics,
  computeEquitySummaryForRange,
  computeEquityCurveForRange,
  computeDrawdown,
  computeStreaks,
  computeMonthlyPnl,
  computeHoldingTime,
  formatHoldingTime,
  getAvailableYearsAndQuarters,
  type EquityCurveRange,
} from '@/lib/statistics'
import { formatCurrency, formatPercentage } from '@/lib/calculations'
import { filterPositionsByDate, computeDateBounds, getAvailableYears } from '@/lib/dateFilter'
import { tradingViewSymbolUrl } from '@/lib/tradingview'
import type { DateRangeFilter, Position } from '@/types'
import { cn } from '@/lib/utils'

interface StatisticsPageProps {
  positions: Position[]
  initialCapital: number
  filter: DateRangeFilter
  onFilterChange: (filter: DateRangeFilter) => void
}

const QUARTER_LABELS = { 1: 'רבעון 1 (ינו-מרץ)', 2: 'רבעון 2 (אפר-יונ)', 3: 'רבעון 3 (יול-ספט)', 4: 'רבעון 4 (אוק-דצמ)' } as const

export function StatisticsPage({ positions, initialCapital, filter, onFilterChange }: StatisticsPageProps) {
  const filtered = React.useMemo(() => filterPositionsByDate(positions, filter), [positions, filter])
  const stats = React.useMemo(() => computeStatistics(filtered, initialCapital), [filtered, initialCapital])
  // כשהפילטר הוא "הכול" — שווי החשבון מחושב על כל ההיסטוריה. כשנבחרה תקופה ספציפית
  // (שנה/חודש/טווח מותאם) — כרטיסי ההון מציגים רק את אותה תקופה: הון בתחילתה + מה שקרה בתוכה.
  const rangeFrom = React.useMemo(() => computeDateBounds(filter).from, [filter])
  const equity = React.useMemo(
    () => computeEquitySummaryForRange(positions, initialCapital, filtered, rangeFrom),
    [positions, initialCapital, filtered, rangeFrom],
  )
  const drawdownFull = React.useMemo(
    () => computeEquityCurveForRange(positions, initialCapital, { type: 'all' }),
    [positions, initialCapital],
  )
  const drawdown = React.useMemo(() => computeDrawdown(drawdownFull), [drawdownFull])
  const streaks = React.useMemo(() => computeStreaks(positions), [positions])
  const monthlyPnl = React.useMemo(() => computeMonthlyPnl(positions), [positions])
  const holdingTime = React.useMemo(() => computeHoldingTime(positions), [positions])
  const filterYears = React.useMemo(() => getAvailableYears(positions), [positions])

  // דריל-דאון: לחיצה על חודש במפת החום מציגה את כל העסקאות שנסגרו באותו חודש
  const [drilldownMonth, setDrilldownMonth] = React.useState<{ year: number; month: number } | null>(null)
  const drilldownTrades = React.useMemo(() => {
    if (!drilldownMonth) return []
    return positions.filter((p) => {
      if (p.status !== 'סגורה' || !p.closeDate) return false
      const d = new Date(p.closeDate)
      return d.getFullYear() === drilldownMonth.year && d.getMonth() === drilldownMonth.month
    })
  }, [positions, drilldownMonth])
  const MONTH_NAMES_FULL = [
    'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
    'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
  ]

  // בורר תקופה עצמאי לעקומת ההון בלבד: הכול / שנה ספציפית / רבעון ספציפי
  const { years, quarters } = React.useMemo(() => getAvailableYearsAndQuarters(positions), [positions])
  const [curveMode, setCurveMode] = React.useState<'all' | 'year' | 'quarter'>('all')
  const [curveYear, setCurveYear] = React.useState<number | null>(null)
  const [curveQuarter, setCurveQuarter] = React.useState<{ year: number; quarter: 1 | 2 | 3 | 4 } | null>(null)

  const curveRange: EquityCurveRange = React.useMemo(() => {
    if (curveMode === 'year' && curveYear !== null) return { type: 'year', year: curveYear }
    if (curveMode === 'quarter' && curveQuarter !== null) return { type: 'quarter', ...curveQuarter }
    return { type: 'all' }
  }, [curveMode, curveYear, curveQuarter])

  const equityCurve = React.useMemo(
    () => computeEquityCurveForRange(positions, initialCapital, curveRange),
    [positions, initialCapital, curveRange],
  )

  const maxPatternAbs = Math.max(1, ...stats.patternBreakdown.map((p) => Math.abs(p.pnl)))
  const maxCategoryAbs = Math.max(1, ...stats.categoryBreakdown.map((p) => Math.abs(p.pnl)))

  return (
    <div className="space-y-4">
      <DateRangeFilterBar filter={filter} onFilterChange={onFilterChange} availableYears={filterYears} />

      <div className="rounded-xl border border-border bg-surface p-3 text-xs text-text-muted">
        כרטיסי ההון למעלה (הון התחלתי / רווח־הפסד ממומש / לא ממומש / שווי נוכחי / אחוזים) מכבדים את הסינון הפעיל:
        {filter.preset === 'all' ? (
          <>
            {' '}כרגע מוצג <b className="text-text">מצב החשבון האמיתי על פני כל ההיסטוריה</b>.
          </>
        ) : (
          <>
            {' '}כרגע מוצגים רק נתוני התקופה הנבחרת — <b className="text-text">הון התחלתי הוא שווי החשבון בפועל
            בתחילת התקופה</b> (הון התחלתי כללי + כל מה שנצבר לפני התקופה), והרווח/הפסד מחושב רק על עסקאות בתוך
            התקופה. בחר "הכול" כדי לחזור לתצוגת כל ההיסטוריה.
          </>
        )}
        {equity.openPositionsMissingPrice > 0 && (
          <span className="mt-1 block text-warn">
            ⚠️ יש {equity.openPositionsMissingPrice} פוזיציות פתוחות בלי מחיר עדכני — בד״כ זה מתעדכן אוטומטית מהגיליון
            תוך כמה דקות; אם סימול לא נתמך, אפשר להזין מחיר ידני חד-פעמי בכרטיס העסקה ביומן (עריכת פרטים).
          </span>
        )}
      </div>

      <StatSection title="הון וביצועים">
        <StatTile
          icon={<TrendingUp className="h-4 w-4" />}
          label="הון התחלתי"
          value={`$${formatCurrency(equity.initialCapital)}`}
        />
        <StatTile
          icon={equity.totalRealizedPnl >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          label="רווח/הפסד ממומש כולל"
          value={`${equity.totalRealizedPnl >= 0 ? '+' : ''}$${formatCurrency(equity.totalRealizedPnl)}`}
          valueClass={equity.totalRealizedPnl >= 0 ? 'text-win' : 'text-loss'}
        />
        <StatTile
          icon={<Wallet className="h-4 w-4" />}
          label="רווח/הפסד לא ממומש (פתוח)"
          value={
            equity.openPositionsWithPrice === 0 && equity.openPositionsMissingPrice === 0
              ? '—'
              : `${equity.unrealizedPnl >= 0 ? '+' : ''}$${formatCurrency(equity.unrealizedPnl)}`
          }
          valueClass={equity.unrealizedPnl >= 0 ? 'text-win' : 'text-loss'}
        />
        <StatTile
          icon={<Award className="h-4 w-4" />}
          label="שווי נוכחי"
          value={`$${formatCurrency(equity.currentEquity)}`}
        />
        <StatTile
          icon={<Percent className="h-4 w-4" />}
          label="רווח/הפסד באחוזים"
          value={formatPercentage(equity.pnlPercentage * 100)}
          valueClass={equity.pnlPercentage >= 0 ? 'text-win' : 'text-loss'}
        />
      </StatSection>

      <StatSection title="הצלחה והפסד">
        <StatTile label="עסקאות מנצחות" value={stats.winCount.toString()} valueClass="text-win" />
        <StatTile label="עסקאות מפסידות" value={stats.lossCount.toString()} valueClass="text-loss" />
        <StatTile label="אחוז מנצחות" value={formatPercentage(stats.winRate * 100)} />
        <StatTile label="אחוז מפסידות" value={formatPercentage(stats.lossRate * 100)} />
        <StatTile label="ממוצע רווח לעסקה מנצחת" value={`$${formatCurrency(stats.avgWin)}`} valueClass="text-win" />
        <StatTile label="ממוצע הפסד לעסקה מפסידה" value={`$${formatCurrency(stats.avgLoss)}`} valueClass="text-loss" />
        <StatTile
          icon={<Target className="h-4 w-4" />}
          label="תוחלת לעסקה"
          value={`$${formatCurrency(stats.expectancy)}`}
          valueClass={stats.expectancy >= 0 ? 'text-win' : 'text-loss'}
        />
        <StatTile
          icon={<AlertTriangle className="h-4 w-4" />}
          label="עסקאות סגורות"
          value={stats.closedTrades.length.toString()}
        />
      </StatSection>

      <StatSection title="סיכון">
        <StatTile
          icon={<ArrowDownRight className="h-4 w-4" />}
          label="Max Drawdown"
          value={`-$${formatCurrency(drawdown.maxDrawdown)} (${formatPercentage(drawdown.maxDrawdownPercentage * 100)})`}
          valueClass={drawdown.maxDrawdown > 0 ? 'text-loss' : undefined}
        />
        <StatTile
          icon={<Flame className="h-4 w-4" />}
          label="רצף נוכחי"
          value={
            streaks.currentStreak === 0
              ? '—'
              : `${Math.abs(streaks.currentStreak)} ${streaks.currentStreak > 0 ? 'ניצחונות ברצף' : 'הפסדים ברצף'}`
          }
          valueClass={streaks.currentStreak > 0 ? 'text-win' : streaks.currentStreak < 0 ? 'text-loss' : undefined}
        />
        <StatTile
          label="רצפים ארוכים ביותר"
          value={`${streaks.longestWinStreak} WIN / ${streaks.longestLossStreak} LOSS`}
        />
      </StatSection>

      <StatSection title="התנהגות ותזמון">
        <StatTile
          icon={<Clock className="h-4 w-4" />}
          label="זמן החזקה ממוצע — מנצחות"
          value={formatHoldingTime(holdingTime.avgHoldHoursWin)}
          valueClass="text-win"
        />
        <StatTile
          icon={<Clock className="h-4 w-4" />}
          label="זמן החזקה ממוצע — מפסידות"
          value={formatHoldingTime(holdingTime.avgHoldHoursLoss)}
          valueClass="text-loss"
        />
      </StatSection>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <CardTitle>עקומת הון</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1 rounded-lg bg-surface-2 p-1">
              {(['all', 'year', 'quarter'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setCurveMode(m)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    curveMode === m ? 'bg-accent text-accent-fg' : 'text-text-muted hover:text-text'
                  }`}
                >
                  {m === 'all' ? 'הכול' : m === 'year' ? 'לפי שנה' : 'לפי רבעון'}
                </button>
              ))}
            </div>
            {curveMode === 'year' && (
              <Select
                className="w-32"
                value={curveYear ?? ''}
                onChange={(e) => setCurveYear(Number(e.target.value))}
              >
                <option value="">בחר שנה...</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
            )}
            {curveMode === 'quarter' && (
              <Select
                className="w-48"
                value={curveQuarter ? `${curveQuarter.year}-${curveQuarter.quarter}` : ''}
                onChange={(e) => {
                  const [y, q] = e.target.value.split('-').map(Number)
                  setCurveQuarter(e.target.value ? { year: y, quarter: q as 1 | 2 | 3 | 4 } : null)
                }}
              >
                <option value="">בחר רבעון...</option>
                {quarters.map((q) => (
                  <option key={`${q.year}-${q.quarter}`} value={`${q.year}-${q.quarter}`}>
                    {q.year} — {QUARTER_LABELS[q.quarter]}
                  </option>
                ))}
              </Select>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {(curveMode === 'year' && curveYear === null) || (curveMode === 'quarter' && curveQuarter === null) ? (
            <p className="py-8 text-center text-sm text-text-muted">בחר {curveMode === 'year' ? 'שנה' : 'רבעון'} להצגה</p>
          ) : (
            <EquityCurveChart points={equityCurve} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>רווח/הפסד חודשי</CardTitle>
        </CardHeader>
        <CardContent>
          <MonthlyHeatmap monthly={monthlyPnl} onMonthClick={(year, month) => setDrilldownMonth({ year, month })} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>פילוח לפי סוג הגרף (Pattern)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.patternBreakdown.length === 0 && (
              <p className="text-sm text-text-muted">אין נתונים בטווח הנבחר</p>
            )}
            {stats.patternBreakdown.map((p) => (
              <BreakdownRow key={p.name} name={p.name} pnl={p.pnl} count={p.count} maxAbs={maxPatternAbs} />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>פילוח לפי קטגוריה/תגית</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.categoryBreakdown.length === 0 && (
              <p className="text-sm text-text-muted">אין נתונים בטווח הנבחר</p>
            )}
            {stats.categoryBreakdown.map((c) => (
              <BreakdownRow key={c.name} name={c.name} pnl={c.pnl} count={c.count} maxAbs={maxCategoryAbs} />
            ))}
          </CardContent>
        </Card>
      </div>

      {drilldownMonth && (
        <Dialog
          open
          onClose={() => setDrilldownMonth(null)}
          title={`עסקאות שנסגרו — ${MONTH_NAMES_FULL[drilldownMonth.month]} ${drilldownMonth.year}`}
          description={`${drilldownTrades.length} עסקאות`}
        >
          <div className="space-y-2">
            {drilldownTrades.length === 0 && (
              <p className="text-sm text-text-muted">אין עסקאות סגורות בחודש זה</p>
            )}
            {[...drilldownTrades]
              .sort((a, b) => new Date(a.closeDate!).getTime() - new Date(b.closeDate!).getTime())
              .map((t) => (
                <div
                  key={t.tradeId}
                  className="flex items-center justify-between rounded-lg border border-border bg-surface-2 p-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-text">{t.symbol}</span>
                      <a
                        href={tradingViewSymbolUrl(t.symbol)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-accent hover:bg-accent/10"
                        title={`פתח את הגרף החי של ${t.symbol} ב-TradingView`}
                      >
                        <TrendingUp className="h-3 w-3" />
                        גרף חי
                      </a>
                      <Badge variant={t.winLoss === 'WIN' ? 'win' : 'loss'}>{t.winLoss}</Badge>
                    </div>
                    <div className="mt-0.5 text-xs text-text-muted">
                      {t.pattern} · נסגר {new Date(t.closeDate!).toLocaleDateString('he-IL')}
                    </div>
                  </div>
                  <div className={cn('num-tabular font-medium', t.realizedPnl >= 0 ? 'text-win' : 'text-loss')}>
                    {t.realizedPnl >= 0 ? '+' : ''}${formatCurrency(t.realizedPnl)}
                  </div>
                </div>
              ))}
          </div>
        </Dialog>
      )}
    </div>
  )
}

function StatSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-text-muted">{title}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{children}</div>
    </div>
  )
}

function BreakdownRow({
  name,
  pnl,
  count,
  maxAbs,
}: {
  name: string
  pnl: number
  count: number
  maxAbs: number
}) {
  const widthPct = Math.min(100, (Math.abs(pnl) / maxAbs) * 100)
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-text">
          {name} <span className="text-text-muted">({count})</span>
        </span>
        <span className={cn('num-tabular font-medium', pnl >= 0 ? 'text-win' : 'text-loss')}>
          {pnl >= 0 ? '+' : ''}${formatCurrency(pnl)}
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div
          className={cn('h-full rounded-full', pnl >= 0 ? 'bg-win' : 'bg-loss')}
          style={{ width: `${widthPct}%` }}
        />
      </div>
    </div>
  )
}
