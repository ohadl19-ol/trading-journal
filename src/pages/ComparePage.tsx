import * as React from 'react'
import { RefreshCw } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { fetchData } from '@/lib/api'
import { MODE_LABEL, resolveSheetTarget, type AccountMode } from '@/lib/accountMode'
import { computeAccountComparison, defaultCompareRange, rangeBounds, type AccountComparisonStats } from '@/lib/compareStats'
import { formatCurrency, formatPercentage } from '@/lib/calculations'
import { loadSettings } from '@/lib/storage'
import { cn } from '@/lib/utils'
import type { Position } from '@/types'

interface ComparePageProps {
  webAppUrl: string
}

type AccountState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ok'; positions: Position[] }

const MODES: AccountMode[] = ['real', 'demo']

/**
 * השוואה בין החשבון האמיתי לחשבון הדמו. כל חשבון נקרא בנפרד מהגיליון שלו בלבד
 * (בקשת GET נפרדת עם המזהה שלו). אם קריאה אחת נכשלת — מוצגת שגיאה בעמודה שלה,
 * בלי להחליף אותה בנתונים מהגיליון השני.
 */
export function ComparePage({ webAppUrl }: ComparePageProps) {
  const [range, setRange] = React.useState(() => defaultCompareRange())
  const [accounts, setAccounts] = React.useState<Record<AccountMode, AccountState>>({
    real: { status: 'loading' },
    demo: { status: 'loading' },
  })

  const load = React.useCallback(async () => {
    setAccounts({ real: { status: 'loading' }, demo: { status: 'loading' } })
    await Promise.all(
      MODES.map(async (mode) => {
        let next: AccountState
        try {
          const data = await fetchData(webAppUrl, resolveSheetTarget(mode))
          next = { status: 'ok', positions: data.trades }
        } catch (err) {
          next = { status: 'error', message: err instanceof Error ? err.message : 'שגיאה בטעינה' }
        }
        setAccounts((prev) => ({ ...prev, [mode]: next }))
      }),
    )
  }, [webAppUrl])

  React.useEffect(() => {
    load()
  }, [load])

  const capital: Record<AccountMode, number> = {
    real: loadSettings('real').initialCapital,
    demo: loadSettings('demo').initialCapital,
  }

  const validRange = range.from && range.to && range.from <= range.to
  const stats: Partial<Record<AccountMode, AccountComparisonStats>> = {}
  if (validRange) {
    const { from, to } = rangeBounds(range.from, range.to)
    for (const mode of MODES) {
      const acc = accounts[mode]
      if (acc.status === 'ok') stats[mode] = computeAccountComparison(acc.positions, capital[mode], from, to)
    }
  }

  const signed = (v: number | null, fmt: (n: number) => string) =>
    v === null ? '—' : `${v > 0 ? '+' : ''}${fmt(v)}`
  const money = (n: number) => `$${formatCurrency(n)}`
  const tone = (v: number | null | undefined) =>
    v === null || v === undefined || v === 0 ? '' : v > 0 ? 'text-win' : 'text-loss'

  const rows: { label: string; hint?: string; render: (s: AccountComparisonStats) => React.ReactNode }[] = [
    { label: 'עסקאות סגורות', render: (s) => s.closedCount },
    {
      label: 'אחוז הצלחה',
      render: (s) => (s.winRate === null ? '—' : `${formatPercentage(s.winRate * 100, 1)} (${s.winCount}/${s.winCount + s.lossCount})`),
    },
    {
      label: 'רווח ממוצע ביחס לסיכון',
      hint: 'R ממוצע לעסקה',
      render: (s) => <span className={tone(s.avgR)}>{signed(s.avgR, (n) => `${n.toFixed(2)}R`)}</span>,
    },
    { label: 'רווח ממוצע לעסקה', render: (s) => <span className={tone(s.avgPnl)}>{signed(s.avgPnl, money)}</span> },
    {
      label: 'תוחלת לעסקה',
      hint: 'הצלחה × רווח ממוצע − כישלון × הפסד ממוצע',
      render: (s) => (
        <span className={tone(s.expectancy)}>
          {signed(s.expectancy, money)}
          {s.expectancyR !== null && <span className="text-xs text-text-muted"> · {signed(s.expectancyR, (n) => `${n.toFixed(2)}R`)}</span>}
        </span>
      ),
    },
    { label: 'רווח/הפסד מצטבר', render: (s) => <span className={cn('font-semibold', tone(s.totalPnl))}>{signed(s.totalPnl, money)}</span> },
    {
      label: 'ירידה מקסימלית מהשיא',
      render: (s) =>
        s.maxDrawdown > 0 ? (
          <span className="text-loss">
            -{money(s.maxDrawdown)} <span className="text-xs">({formatPercentage(s.maxDrawdownPct * 100, 1)})</span>
          </span>
        ) : (
          '—'
        ),
    },
    { label: 'רצף הפסדים ארוך ביותר', render: (s) => s.longestLossStreak },
    {
      label: 'פעלתי לפי התוכנית',
      render: (s) =>
        s.followedPlanRate === null ? (
          '—'
        ) : (
          <>
            {formatPercentage(s.followedPlanRate * 100, 0)}{' '}
            <span className="text-xs text-text-muted">
              ({s.followedPlanCount}/{s.closedCount}, סומנו {s.planMarkedCount})
            </span>
          </>
        ),
    },
  ]

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>השוואה: חשבון אמיתי מול דמו</CardTitle>
          <CardDescription>
            לפי תאריך סגירה. רק עסקאות סגורות נספרות. עסקאות פתוחות וממתינות לכניסה לא משפיעות.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div>
            <Label>מתאריך</Label>
            <Input type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
          </div>
          <div>
            <Label>עד תאריך</Label>
            <Input type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
          </div>
          <Button variant="secondary" onClick={() => setRange(defaultCompareRange())}>
            30 הימים האחרונים
          </Button>
          <Button variant="outline" onClick={load}>
            <RefreshCw className="h-4 w-4" />
            רענון
          </Button>
          {!validRange && <span className="text-sm text-loss">טווח התאריכים לא תקין</span>}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-border text-text-muted">
                <th className="px-4 py-3 text-right font-medium">מדד</th>
                {MODES.map((mode) => (
                  <th
                    key={mode}
                    className={cn('px-4 py-3 text-right font-semibold', mode === 'demo' ? 'text-demo' : 'text-text')}
                  >
                    {MODE_LABEL[mode]}
                    <div className="text-[11px] font-normal text-text-muted">הון התחלתי ${formatCurrency(capital[mode], 0)}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5 text-text-muted">
                    {row.label}
                    {row.hint && <div className="text-[11px]">{row.hint}</div>}
                  </td>
                  {MODES.map((mode) => {
                    const acc = accounts[mode]
                    const s = stats[mode]
                    return (
                      <td key={mode} className="num-tabular px-4 py-2.5 text-text">
                        {acc.status === 'loading' ? (
                          <span className="inline-block h-4 w-16 animate-pulse rounded bg-surface-2" />
                        ) : acc.status === 'error' ? (
                          <span className="text-xs text-loss">שגיאה</span>
                        ) : s ? (
                          row.render(s)
                        ) : (
                          '—'
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {MODES.map((mode) => {
        const acc = accounts[mode]
        return acc.status === 'error' ? (
          <p key={mode} className="rounded-lg bg-loss-bg px-3 py-2 text-sm text-loss">
            {MODE_LABEL[mode]}: {acc.message}
          </p>
        ) : null
      })}
    </div>
  )
}
