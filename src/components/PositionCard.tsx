import * as React from 'react'
import { ChevronDown, ExternalLink, Image as ImageIcon, Link as LinkIcon, PlusCircle, MinusCircle, XCircle, Pencil } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatNumber, rrColorClass } from '@/lib/calculations'
import type { Execution, Position } from '@/types'
import { cn } from '@/lib/utils'

interface PositionCardProps {
  position: Position
  executions: Execution[]
  onAddShares: () => void
  onTrim: () => void
  onClose: () => void
  onEditChart: () => void
  onEditDetails: () => void
}

const statusVariant = {
  פתוחה: 'accent',
  'פתוחה חלקית': 'warn',
  סגורה: 'default',
} as const

export function PositionCard({
  position,
  executions,
  onAddShares,
  onTrim,
  onClose,
  onEditChart,
  onEditDetails,
}: PositionCardProps) {
  const [expanded, setExpanded] = React.useState(false)
  const isOpen = position.status !== 'סגורה'
  const pnlPositive = position.realizedPnl >= 0

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            {position.chartUrl ? (
              <a
                href={position.chartUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative block h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-2"
                title="פתח צ'ארט"
              >
                <img
                  src={position.chartUrl}
                  alt="צ'ארט"
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    ;(e.target as HTMLImageElement).style.display = 'none'
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                  <ExternalLink className="h-5 w-5 text-white" />
                </div>
              </a>
            ) : (
              <button
                onClick={onEditChart}
                className="flex h-16 w-16 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border bg-surface-2 text-text-muted hover:text-text"
              >
                <ImageIcon className="h-5 w-5" />
                <span className="text-[10px]">הוסף קישור</span>
              </button>
            )}

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-lg font-bold">{position.symbol}</span>
                <Badge variant={statusVariant[position.status]}>{position.status}</Badge>
                {position.winLoss && (
                  <Badge variant={position.winLoss === 'WIN' ? 'win' : 'loss'}>
                    {position.winLoss}
                  </Badge>
                )}
              </div>
              <div className="mt-0.5 text-sm text-text-muted">
                {position.pattern} · נפתח{' '}
                {new Date(position.openDate).toLocaleDateString('he-IL')}
                {position.closeDate &&
                  ` · נסגר ${new Date(position.closeDate).toLocaleDateString('he-IL')}`}
              </div>
            </div>
          </div>

          <div className="text-right sm:text-left">
            <div
              className={cn(
                'text-xl font-bold num-tabular',
                position.realizedPnl !== 0 ? (pnlPositive ? 'text-win' : 'text-loss') : 'text-text-muted',
              )}
            >
              {position.realizedPnl !== 0 && (pnlPositive ? '+' : '')}
              ${formatCurrency(position.realizedPnl)}
            </div>
            {position.realizedR !== null && (
              <div className="text-xs text-text-muted">{formatCurrency(position.realizedR)}R</div>
            )}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4 lg:grid-cols-6">
          <Field label="מחיר ממוצע" value={`$${formatCurrency(position.avgEntryPrice)}`} />
          <Field label="כמות נוכחית" value={formatNumber(position.currentShares)} />
          <Field label="סטופ" value={`$${formatCurrency(position.stopLoss)}`} />
          <Field label="יעד" value={position.targetPrice ? `$${formatCurrency(position.targetPrice)}` : '—'} />
          <Field
            label="R/R מתוכנן"
            value={position.plannedRR !== null ? formatCurrency(position.plannedRR) : '—'}
            className={rrColorClass(position.plannedRR)}
          />
          <Field
            label="2R / 3R"
            value={
              position.target2R && position.target3R
                ? `$${formatCurrency(position.target2R)} / $${formatCurrency(position.target3R)}`
                : '—'
            }
          />
        </div>

        {isOpen && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={onAddShares}>
              <PlusCircle className="h-3.5 w-3.5" />
              חיזוק
            </Button>
            <Button size="sm" variant="secondary" onClick={onTrim}>
              <MinusCircle className="h-3.5 w-3.5" />
              מכירה חלקית
            </Button>
            <Button size="sm" variant="destructive" onClick={onClose}>
              <XCircle className="h-3.5 w-3.5" />
              סגירת עסקה
            </Button>
            <Button size="sm" variant="outline" onClick={onEditChart}>
              <LinkIcon className="h-3.5 w-3.5" />
              {position.chartUrl ? 'עריכת קישור צ׳ארט' : 'הוסף קישור צ׳ארט'}
            </Button>
            <Button size="sm" variant="ghost" onClick={onEditDetails}>
              <Pencil className="h-3.5 w-3.5" />
              עריכת פרטים
            </Button>
          </div>
        )}
        {!isOpen && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={onEditChart}>
              <LinkIcon className="h-3.5 w-3.5" />
              {position.chartUrl ? 'עריכת קישור צ׳ארט' : 'הוסף קישור צ׳ארט'}
            </Button>
            <Button size="sm" variant="ghost" onClick={onEditDetails}>
              <Pencil className="h-3.5 w-3.5" />
              עריכת פרטים
            </Button>
          </div>
        )}

        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg py-1.5 text-xs text-text-muted hover:bg-surface-2 hover:text-text"
        >
          <ChevronDown className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')} />
          {expanded ? 'הסתר פעולות' : `הצג פעולות (${executions.length})`}
        </button>

        {expanded && (
          <div className="mt-2 space-y-1.5 rounded-lg border border-border bg-surface-2 p-2">
            {executions.length === 0 && (
              <div className="p-2 text-center text-sm text-text-muted">אין פעולות</div>
            )}
            {executions.map((exec) => (
              <div
                key={exec.execId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="default">{exec.actionType}</Badge>
                  <span className="text-text-muted">
                    {new Date(exec.timestamp).toLocaleString('he-IL')}
                  </span>
                </div>
                <div className="flex items-center gap-3 num-tabular">
                  <span>{formatNumber(exec.shares)} מניות</span>
                  <span>${formatCurrency(exec.price)}</span>
                  {exec.realizedPnlInAction !== 0 && (
                    <span className={exec.realizedPnlInAction > 0 ? 'text-win' : 'text-loss'}>
                      {exec.realizedPnlInAction > 0 ? '+' : ''}${formatCurrency(exec.realizedPnlInAction)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {(position.setupReason || position.notes) && (
          <div className="mt-2 space-y-1 text-sm text-text-muted">
            {position.setupReason && <p>💡 {position.setupReason}</p>}
            {position.notes && <p>📝 {position.notes}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function Field({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <div className="text-[11px] text-text-muted">{label}</div>
      <div className={cn('font-medium num-tabular', className)}>{value}</div>
    </div>
  )
}
