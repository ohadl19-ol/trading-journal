import * as React from 'react'
import { Table as TableIcon, LineChart as LineChartIcon } from 'lucide-react'
import { formatCurrency } from '@/lib/calculations'
import type { EquityPoint } from '@/lib/statistics'
import { cn } from '@/lib/utils'

interface EquityCurveChartProps {
  points: EquityPoint[]
}

const WIDTH = 800
const HEIGHT = 260
const PAD_X = 16
const PAD_TOP = 16
const PAD_BOTTOM = 28

export function EquityCurveChart({ points }: EquityCurveChartProps) {
  const [hoverIndex, setHoverIndex] = React.useState<number | null>(null)
  const [view, setView] = React.useState<'chart' | 'table'>('chart')
  const svgRef = React.useRef<SVGSVGElement>(null)

  if (points.length < 2) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-text-muted">
        אין מספיק עסקאות סגורות כדי לצייר עקומת הון
      </div>
    )
  }

  const values = points.map((p) => p.equity)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const yPad = range * 0.1

  const xFor = (i: number) => PAD_X + (i / (points.length - 1)) * (WIDTH - 2 * PAD_X)
  const yFor = (v: number) =>
    PAD_TOP + (1 - (v - (min - yPad)) / (range + 2 * yPad)) * (HEIGHT - PAD_TOP - PAD_BOTTOM)

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xFor(i)},${yFor(p.equity)}`).join(' ')
  const baseline = points[0].equity
  const areaPath = `${linePath} L${xFor(points.length - 1)},${yFor(min - yPad)} L${xFor(0)},${yFor(min - yPad)} Z`

  function handleMove(e: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const relX = ((e.clientX - rect.left) / rect.width) * WIDTH
    const i = Math.round(((relX - PAD_X) / (WIDTH - 2 * PAD_X)) * (points.length - 1))
    setHoverIndex(Math.max(0, Math.min(points.length - 1, i)))
  }

  const hover = hoverIndex !== null ? points[hoverIndex] : null

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-text-muted">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 rounded-full bg-accent" /> שווי הון
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-px w-4 border-t border-dashed border-text-muted" /> הון התחלתי
          </span>
        </div>
        <button
          onClick={() => setView(view === 'chart' ? 'table' : 'chart')}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-text-muted hover:bg-surface-2 hover:text-text"
        >
          {view === 'chart' ? (
            <>
              <TableIcon className="h-3.5 w-3.5" /> תצוגת טבלה
            </>
          ) : (
            <>
              <LineChartIcon className="h-3.5 w-3.5" /> תצוגת גרף
            </>
          )}
        </button>
      </div>

      {view === 'table' ? (
        <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-surface-2 text-text-muted">
              <tr>
                <th className="p-2 text-right">תאריך סגירה</th>
                <th className="p-2 text-right">סימול</th>
                <th className="p-2 text-right">רווח/הפסד</th>
                <th className="p-2 text-right">שווי הון</th>
              </tr>
            </thead>
            <tbody>
              {points.slice(1).map((p, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="p-2 num-tabular">{new Date(p.date).toLocaleDateString('he-IL')}</td>
                  <td className="p-2">{p.tradeSymbol}</td>
                  <td className={cn('p-2 num-tabular', p.tradePnl >= 0 ? 'text-win' : 'text-loss')}>
                    {p.tradePnl >= 0 ? '+' : ''}${formatCurrency(p.tradePnl)}
                  </td>
                  <td className="p-2 num-tabular">${formatCurrency(p.equity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="h-64 w-full touch-none"
            preserveAspectRatio="none"
            onPointerMove={handleMove}
            onPointerLeave={() => setHoverIndex(null)}
          >
            <defs>
              <linearGradient id="equity-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.28" />
                <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
              </linearGradient>
            </defs>

            <line
              x1={PAD_X}
              x2={WIDTH - PAD_X}
              y1={yFor(baseline)}
              y2={yFor(baseline)}
              stroke="var(--color-text-muted)"
              strokeDasharray="4 4"
              strokeWidth="1"
            />

            <path d={areaPath} fill="url(#equity-fill)" />
            <path d={linePath} fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinejoin="round" />

            {hover && (
              <>
                <line
                  x1={xFor(hoverIndex!)}
                  x2={xFor(hoverIndex!)}
                  y1={PAD_TOP}
                  y2={HEIGHT - PAD_BOTTOM}
                  stroke="var(--color-text-muted)"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <circle
                  cx={xFor(hoverIndex!)}
                  cy={yFor(hover.equity)}
                  r="4"
                  fill={hover.tradePnl >= 0 ? 'var(--color-win)' : 'var(--color-loss)'}
                  stroke="var(--color-surface)"
                  strokeWidth="2"
                />
              </>
            )}
          </svg>

          {hover && (
            <div
              className="pointer-events-none absolute top-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-lg"
              style={{
                left: `${(xFor(hoverIndex!) / WIDTH) * 100}%`,
                transform: `translateX(${hoverIndex! > points.length / 2 ? '-105%' : '5%'})`,
              }}
            >
              {hoverIndex === 0 ? (
                <div className="font-medium text-text">הון התחלתי: ${formatCurrency(hover.equity)}</div>
              ) : (
                <>
                  <div className="text-text-muted">{new Date(hover.date).toLocaleDateString('he-IL')}</div>
                  <div className="font-medium text-text">
                    {hover.tradeSymbol}{' '}
                    <span className={hover.tradePnl >= 0 ? 'text-win' : 'text-loss'}>
                      ({hover.tradePnl >= 0 ? '+' : ''}${formatCurrency(hover.tradePnl)})
                    </span>
                  </div>
                  <div className="num-tabular text-text">שווי: ${formatCurrency(hover.equity)}</div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
