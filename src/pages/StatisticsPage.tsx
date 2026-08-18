import * as React from 'react'
import { TrendingUp, TrendingDown, Percent, Target, Award, AlertTriangle, Wallet, ArrowDownRight, Flame } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DateRangeFilterBar } from '@/components/DateRangeFilterBar'
import { EquityCurveChart } from '@/components/EquityCurveChart'
import { MonthlyHeatmap } from '@/components/MonthlyHeatmap'
import {
  computeStatistics,
  computeEquitySummary,
  computeEquityCurve,
  computeDrawdown,
  computeStreaks,
  computeMonthlyPnl,
} from '@/lib/statistics'
import { formatCurrency, formatPercentage } from '@/lib/calculations'
import { filterPositionsByDate } from '@/lib/dateFilter'
import type { DateRangeFilter, Position } from '@/types'
import { cn } from '@/lib/utils'

interface StatisticsPageProps {
  positions: Position[]
  initialCapital: number
  filter: DateRangeFilter
  onFilterChange: (filter: DateRangeFilter) => void
}

export function StatisticsPage({ positions, initialCapital, filter, onFilterChange }: StatisticsPageProps) {
  const filtered = React.useMemo(() => filterPositionsByDate(positions, filter), [positions, filter])
  const stats = React.useMemo(() => computeStatistics(filtered, initialCapital), [filtered, initialCapital])
  // שווי החשבון האמיתי מחושב תמיד על כל ההיסטוריה (לא מסונן), כולל רווח/הפסד לא ממומש
  const equity = React.useMemo(() => computeEquitySummary(positions, initialCapital), [positions, initialCapital])
  // עקומת הון, Drawdown וסטריקים תמיד על כל ההיסטוריה (אותה הגיון כמו כרטיסי ההון)
  const equityCurve = React.useMemo(() => computeEquityCurve(positions, initialCapital), [positions, initialCapital])
  const drawdown = React.useMemo(() => computeDrawdown(equityCurve), [equityCurve])
  const streaks = React.useMemo(() => computeStreaks(positions), [positions])
  const monthlyPnl = React.useMemo(() => computeMonthlyPnl(positions), [positions])

  const maxPatternAbs = Math.max(1, ...stats.patternBreakdown.map((p) => Math.abs(p.pnl)))
  const maxCategoryAbs = Math.max(1, ...stats.categoryBreakdown.map((p) => Math.abs(p.pnl)))

  return (
    <div className="space-y-4">
      <DateRangeFilterBar filter={filter} onFilterChange={onFilterChange} />

      <div className="rounded-xl border border-border bg-surface p-3 text-xs text-text-muted">
        כרטיסי ההון למעלה (הון התחלתי / רווח־הפסד ממומש / לא ממומש / שווי נוכחי / אחוזים) משקפים תמיד את
        <b className="text-text"> מצב החשבון האמיתי על פני כל ההיסטוריה</b>, ללא קשר לסינון ביומן. שאר הכרטיסים
        (אחוז הצלחה, תוחלת, פילוחים) מכבדים את הסינון הפעיל.
        {equity.openPositionsMissingPrice > 0 && (
          <span className="mt-1 block text-warn">
            ⚠️ יש {equity.openPositionsMissingPrice} פוזיציות פתוחות בלי מחיר נוכחי מעודכן — הרווח/הפסד הלא ממומש
            שלהן לא נכלל בחישוב. עדכן מחיר נוכחי בכרטיס העסקה ביומן (עריכת פרטים).
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="הון התחלתי"
          value={`$${formatCurrency(equity.initialCapital)}`}
        />
        <StatCard
          icon={equity.totalRealizedPnl >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          label="רווח/הפסד ממומש כולל"
          value={`${equity.totalRealizedPnl >= 0 ? '+' : ''}$${formatCurrency(equity.totalRealizedPnl)}`}
          valueClass={equity.totalRealizedPnl >= 0 ? 'text-win' : 'text-loss'}
        />
        <StatCard
          icon={<Wallet className="h-4 w-4" />}
          label="רווח/הפסד לא ממומש (פתוח)"
          value={
            equity.openPositionsWithPrice === 0 && equity.openPositionsMissingPrice === 0
              ? '—'
              : `${equity.unrealizedPnl >= 0 ? '+' : ''}$${formatCurrency(equity.unrealizedPnl)}`
          }
          valueClass={equity.unrealizedPnl >= 0 ? 'text-win' : 'text-loss'}
        />
        <StatCard
          icon={<Award className="h-4 w-4" />}
          label="שווי נוכחי"
          value={`$${formatCurrency(equity.currentEquity)}`}
        />
        <StatCard
          icon={<Percent className="h-4 w-4" />}
          label="רווח/הפסד באחוזים"
          value={formatPercentage(equity.pnlPercentage * 100)}
          valueClass={equity.pnlPercentage >= 0 ? 'text-win' : 'text-loss'}
        />
        <StatCard label="עסקאות מנצחות" value={stats.winCount.toString()} valueClass="text-win" />
        <StatCard label="עסקאות מפסידות" value={stats.lossCount.toString()} valueClass="text-loss" />
        <StatCard label="אחוז מנצחות" value={formatPercentage(stats.winRate * 100)} />
        <StatCard label="אחוז מפסידות" value={formatPercentage(stats.lossRate * 100)} />
        <StatCard label="ממוצע רווח לעסקה מנצחת" value={`$${formatCurrency(stats.avgWin)}`} valueClass="text-win" />
        <StatCard label="ממוצע הפסד לעסקה מפסידה" value={`$${formatCurrency(stats.avgLoss)}`} valueClass="text-loss" />
        <StatCard
          icon={<Target className="h-4 w-4" />}
          label="תוחלת לעסקה"
          value={`$${formatCurrency(stats.expectancy)}`}
          valueClass={stats.expectancy >= 0 ? 'text-win' : 'text-loss'}
        />
        <StatCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="עסקאות סגורות"
          value={stats.closedTrades.length.toString()}
        />
        <StatCard
          icon={<ArrowDownRight className="h-4 w-4" />}
          label="Max Drawdown"
          value={`-$${formatCurrency(drawdown.maxDrawdown)} (${formatPercentage(drawdown.maxDrawdownPercentage * 100)})`}
          valueClass={drawdown.maxDrawdown > 0 ? 'text-loss' : undefined}
        />
        <StatCard
          icon={<Flame className="h-4 w-4" />}
          label="רצף נוכחי"
          value={
            streaks.currentStreak === 0
              ? '—'
              : `${Math.abs(streaks.currentStreak)} ${streaks.currentStreak > 0 ? 'ניצחונות ברצף' : 'הפסדים ברצף'}`
          }
          valueClass={streaks.currentStreak > 0 ? 'text-win' : streaks.currentStreak < 0 ? 'text-loss' : undefined}
        />
        <StatCard
          label="רצפים ארוכים ביותר"
          value={`${streaks.longestWinStreak} WIN / ${streaks.longestLossStreak} LOSS`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>עקומת הון</CardTitle>
        </CardHeader>
        <CardContent>
          <EquityCurveChart points={equityCurve} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>רווח/הפסד חודשי</CardTitle>
        </CardHeader>
        <CardContent>
          <MonthlyHeatmap monthly={monthlyPnl} />
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
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  valueClass,
}: {
  icon?: React.ReactNode
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-1.5 text-xs text-text-muted">
          {icon}
          {label}
        </div>
        <div className={cn('mt-1 text-xl font-bold num-tabular', valueClass)}>{value}</div>
      </CardContent>
    </Card>
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
