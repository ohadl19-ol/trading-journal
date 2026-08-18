import * as React from 'react'
import { Plus, Trash2, Bell, BellRing, TrendingUp, TrendingDown, Pencil } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { formatCurrency } from '@/lib/calculations'
import { tradingViewSymbolUrl } from '@/lib/tradingview'
import { cn } from '@/lib/utils'
import type { AlertDirection, WatchlistItem } from '@/types'
import type { AddWatchlistInput, UpdateWatchlistInput } from '@/hooks/useTradingData'

interface WatchlistPageProps {
  watchlist: WatchlistItem[]
  onAdd: (input: AddWatchlistInput) => Promise<void>
  onUpdate: (input: UpdateWatchlistInput) => Promise<void>
  onDelete: (watchId: string) => Promise<void>
}

export function WatchlistPage({ watchlist, onAdd, onUpdate, onDelete }: WatchlistPageProps) {
  const { toast } = useToast()
  const [symbol, setSymbol] = React.useState('')
  const [targetPrice, setTargetPrice] = React.useState('')
  const [direction, setDirection] = React.useState<AlertDirection>('above')
  const [notes, setNotes] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [editItem, setEditItem] = React.useState<WatchlistItem | null>(null)

  const isValid = symbol.trim().length > 0

  async function handleAdd() {
    setSubmitting(true)
    try {
      await onAdd({
        symbol: symbol.trim(),
        targetPrice: targetPrice === '' ? null : parseFloat(targetPrice),
        alertDirection: direction,
        notes,
      })
      toast(`${symbol.toUpperCase()} נוסף לרשימת המעקב`)
      setSymbol('')
      setTargetPrice('')
      setDirection('above')
      setNotes('')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'שגיאה בהוספה לרשימת המעקב', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(watchId: string, sym: string) {
    try {
      await onDelete(watchId)
      toast(`${sym} הוסר מרשימת המעקב`)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'שגיאה במחיקה', 'error')
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>הוספת מניה למעקב</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div>
              <Label>סימול *</Label>
              <Input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="AAPL" />
            </div>
            <div>
              <Label>מחיר יעד להתראה</Label>
              <Input
                type="number"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                placeholder="לדוגמה 150.00"
              />
            </div>
            <div>
              <Label>כיוון ההתראה</Label>
              <Select value={direction} onChange={(e) => setDirection(e.target.value as AlertDirection)}>
                <option value="above">מגיע מעל היעד</option>
                <option value="below">יורד מתחת ליעד</option>
              </Select>
            </div>
            <div className="flex items-end">
              <Button className="w-full" disabled={!isValid || submitting} onClick={handleAdd}>
                <Plus className="h-4 w-4" />
                {submitting ? 'מוסיף...' : 'הוסף למעקב'}
              </Button>
            </div>
          </div>
          <div className="mt-3">
            <Label>הערות</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="למה אתה עוקב אחרי המניה הזו..." />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {watchlist.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center text-text-muted">
            אין עדיין מניות ברשימת המעקב
          </div>
        )}
        {watchlist.map((item) => (
          <WatchlistCard
            key={item.watchId}
            item={item}
            onEdit={() => setEditItem(item)}
            onDelete={() => handleDelete(item.watchId, item.symbol)}
          />
        ))}
      </div>

      {editItem && (
        <EditWatchlistDialog
          item={editItem}
          onClose={() => setEditItem(null)}
          onSave={async (input) => {
            await onUpdate(input)
            toast('פריט המעקב עודכן')
            setEditItem(null)
          }}
        />
      )}
    </div>
  )
}

function WatchlistCard({
  item,
  onEdit,
  onDelete,
}: {
  item: WatchlistItem
  onEdit: () => void
  onDelete: () => void
}) {
  const hasTarget = item.targetPrice !== null
  const distancePct =
    hasTarget && item.currentPrice !== null
      ? ((item.currentPrice - item.targetPrice!) / item.targetPrice!) * 100
      : null

  return (
    <Card className={item.alertTriggered ? 'border-warn ring-1 ring-warn/40' : undefined}>
      <CardContent className="p-4">
        {item.alertTriggered && (
          <div className="mb-3 flex items-center gap-2 rounded-lg bg-warn-bg px-3 py-2 text-sm font-medium text-warn">
            <BellRing className="h-4 w-4 shrink-0" />
            ההתראה הופעלה{item.alertTriggeredDate && ` — ${new Date(item.alertTriggeredDate).toLocaleString('he-IL')}`}
          </div>
        )}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-bold">{item.symbol}</span>
              <a
                href={tradingViewSymbolUrl(item.symbol)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-accent hover:bg-accent/10"
                title={`פתח את הגרף החי של ${item.symbol} ב-TradingView`}
              >
                <TrendingUp className="h-3 w-3" />
                גרף חי
              </a>
            </div>
            <div className="mt-0.5 text-xs text-text-muted">
              נוסף {new Date(item.addedDate).toLocaleDateString('he-IL')}
            </div>
            {item.notes && <p className="mt-1.5 text-sm text-text">{item.notes}</p>}
          </div>

          <div className="text-right sm:text-left">
            <div className="text-xl font-bold num-tabular">
              {item.currentPrice !== null ? `$${formatCurrency(item.currentPrice)}` : '—'}
            </div>
            <div className="text-xs text-text-muted">מחיר נוכחי</div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <div className="flex items-center gap-2 text-sm">
            <Bell className="h-3.5 w-3.5 text-text-muted" />
            {hasTarget ? (
              <span className="flex items-center gap-1">
                {item.alertDirection === 'above' ? (
                  <TrendingUp className="h-3.5 w-3.5 text-win" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5 text-loss" />
                )}
                יעד: ${formatCurrency(item.targetPrice!)}
                {distancePct !== null && (
                  <span className={cn('num-tabular text-xs', distancePct >= 0 ? 'text-win' : 'text-loss')}>
                    ({distancePct >= 0 ? '+' : ''}
                    {distancePct.toFixed(1)}%)
                  </span>
                )}
              </span>
            ) : (
              <span className="text-text-muted">בלי יעד התראה</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" />
              עריכה
            </Button>
            <Button size="sm" variant="ghost" className="text-loss hover:bg-loss-bg" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" />
              הסר
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function EditWatchlistDialog({
  item,
  onClose,
  onSave,
}: {
  item: WatchlistItem
  onClose: () => void
  onSave: (input: UpdateWatchlistInput) => Promise<void>
}) {
  const [targetPrice, setTargetPrice] = React.useState(item.targetPrice != null ? String(item.targetPrice) : '')
  const [direction, setDirection] = React.useState<AlertDirection>(item.alertDirection)
  const [notes, setNotes] = React.useState(item.notes)
  const [submitting, setSubmitting] = React.useState(false)

  async function handleSave() {
    setSubmitting(true)
    try {
      await onSave({
        watchId: item.watchId,
        targetPrice: targetPrice === '' ? null : parseFloat(targetPrice),
        alertDirection: direction,
        notes,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open onClose={onClose} title={`עריכת מעקב — ${item.symbol}`}>
      <div className="space-y-3">
        <div>
          <Label>מחיר יעד להתראה</Label>
          <Input type="number" value={targetPrice} onChange={(e) => setTargetPrice(e.target.value)} />
        </div>
        <div>
          <Label>כיוון ההתראה</Label>
          <Select value={direction} onChange={(e) => setDirection(e.target.value as AlertDirection)}>
            <option value="above">מגיע מעל היעד</option>
            <option value="below">יורד מתחת ליעד</option>
          </Select>
        </div>
        <div>
          <Label>הערות</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        </div>
        <Button className="w-full" disabled={submitting} onClick={handleSave}>
          {submitting ? 'שומר...' : 'שמור שינויים'}
        </Button>
      </div>
    </Dialog>
  )
}
