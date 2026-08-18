import { formatCurrency } from '@/lib/calculations'
import type { MonthlyPnl } from '@/lib/statistics'
import { cn } from '@/lib/utils'

interface MonthlyHeatmapProps {
  monthly: MonthlyPnl[]
  onMonthClick?: (year: number, month: number) => void
}

const MONTH_LABELS = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ', 'יול', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ']

export function MonthlyHeatmap({ monthly, onMonthClick }: MonthlyHeatmapProps) {
  if (monthly.length === 0) {
    return <p className="text-sm text-text-muted">אין עדיין עסקאות סגורות להצגה</p>
  }

  const years = Array.from(new Set(monthly.map((m) => m.year))).sort((a, b) => a - b)
  const maxAbs = Math.max(1, ...monthly.map((m) => Math.abs(m.pnl)))
  const byKey = new Map(monthly.map((m) => [`${m.year}-${m.month}`, m]))

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-separate border-spacing-1 text-xs">
        <thead>
          <tr>
            <th className="w-12 text-right text-text-muted"></th>
            {MONTH_LABELS.map((m) => (
              <th key={m} className="p-1 text-center font-normal text-text-muted">
                {m}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {years.map((year) => (
            <tr key={year}>
              <td className="pl-2 text-right font-medium text-text-muted">{year}</td>
              {MONTH_LABELS.map((_, monthIdx) => {
                const cell = byKey.get(`${year}-${monthIdx}`)
                if (!cell) {
                  return (
                    <td key={monthIdx} className="rounded-md bg-surface-2/40 p-2 text-center text-text-muted">
                      —
                    </td>
                  )
                }
                const intensity = Math.min(1, Math.abs(cell.pnl) / maxAbs)
                const opacity = 0.15 + intensity * 0.75
                const isWin = cell.pnl >= 0
                return (
                  <td
                    key={monthIdx}
                    className={cn('rounded-md p-0 text-center num-tabular', onMonthClick && 'cursor-pointer')}
                    style={{
                      backgroundColor: isWin
                        ? `color-mix(in srgb, var(--color-win) ${opacity * 100}%, transparent)`
                        : `color-mix(in srgb, var(--color-loss) ${opacity * 100}%, transparent)`,
                    }}
                    title={`${cell.count} עסקאות — לחץ לפירוט`}
                    onClick={() => onMonthClick?.(year, monthIdx)}
                  >
                    <div
                      className={cn(
                        'w-full rounded-md p-2 font-medium transition-transform hover:scale-105',
                        intensity > 0.45 ? 'text-white' : isWin ? 'text-win' : 'text-loss',
                      )}
                    >
                      {cell.pnl >= 0 ? '+' : ''}
                      {formatCurrency(cell.pnl)}
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
