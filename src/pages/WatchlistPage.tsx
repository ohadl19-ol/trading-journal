import * as React from 'react'
import { Plus, Trash2, Bell, BellRing, TrendingUp, TrendingDown, Pencil, Send, Bookmark, ArrowUp, ArrowDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { formatCurrency, formatNumber, percentageColorClass } from '@/lib/calculations'
import { tradingViewSymbolUrl } from '@/lib/tradingview'
import { cn } from '@/lib/utils'
import { DEFAULT_WATCHLIST_NAMES, DEFAULT_WATCHLIST_NAME } from '@/lib/watchlist'
import { PatternSelect } from '@/components/PatternSelect'
import { InlineField } from '@/components/ui/labeled-value'
import type { AlertDirection, WatchlistItem } from '@/types'
import type { AddWatchlistInput, UpdateWatchlistInput } from '@/hooks/useTradingData'

interface WatchlistPageProps {
  watchlist: WatchlistItem[]
  onAdd: (input: AddWatchlistInput) => Promise<void>
  onUpdate: (input: UpdateWatchlistInput) => Promise<void>
  onDelete: (watchId: string) => Promise<void>
  /** "בצע כניסה לעסקה" על פריט עם תוכנית שמורה — מעביר למחשבון עם השדות ממולאים */
  onOpenTradeFromPlan: (item: WatchlistItem) => void
}

export function WatchlistPage({ watchlist, onAdd, onUpdate, onDelete, onOpenTradeFromPlan }: WatchlistPageProps) {
  const { toast } = useToast()
  const [symbol, setSymbol] = React.useState('')
  const [targetPrice, setTargetPrice] = React.useState('')
  const [direction, setDirection] = React.useState<AlertDirection>('above')
  const [notes, setNotes] = React.useState('')
  const [pattern, setPattern] = React.useState('')
  const [showMoreOptions, setShowMoreOptions] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [editItem, setEditItem] = React.useState<WatchlistItem | null>(null)

  // כל שמות הרשימות הקיימות בפועל (השתיים המובנות + כל רשימה מותאמת אישית שהמשתמש כבר יצר)
  const allListNames = React.useMemo(() => {
    const custom = watchlist.map((w) => w.listName || DEFAULT_WATCHLIST_NAME)
    return Array.from(new Set([...DEFAULT_WATCHLIST_NAMES, ...custom]))
  }, [watchlist])
  const [activeList, setActiveList] = React.useState<string>(DEFAULT_WATCHLIST_NAME)

  const isValid = symbol.trim().length > 0
  const itemsInActiveList = React.useMemo(
    () =>
      watchlist
        .filter((w) => (w.listName || DEFAULT_WATCHLIST_NAME) === activeList)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [watchlist, activeList],
  )

  // מזיזים מניה מעלה/מטה בתוך הרשימה הפעילה: מחליפים את מיקומה במערך הממוין ואז ממספרים
  // מחדש את כל הרשימה ברצף (0,1,2...) — כך שגם פריטים ישנים עם "סדר תצוגה" זהה (0, ברירת
  // מחדל) מקבלים ערכים שונים ומובחנים בפעם הראשונה שמזיזים אותם, ולא נתקעים בטעות
  async function handleMove(item: WatchlistItem, direction: 'up' | 'down') {
    const index = itemsInActiveList.findIndex((w) => w.watchId === item.watchId)
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= itemsInActiveList.length) return

    const reordered = [...itemsInActiveList]
    ;[reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]]

    try {
      await Promise.all(reordered.map((w, i) => onUpdate({ watchId: w.watchId, sortOrder: i })))
    } catch (err) {
      toast(err instanceof Error ? err.message : 'שגיאה בשינוי הסדר', 'error')
    }
  }

  async function handleAdd() {
    setSubmitting(true)
    try {
      await onAdd({
        symbol: symbol.trim(),
        targetPrice: targetPrice === '' ? null : parseFloat(targetPrice),
        alertDirection: direction,
        notes,
        listName: activeList,
        plannedPattern: pattern,
      })
      toast(`${symbol.toUpperCase()} נוסף ל"${activeList}"`)
      setSymbol('')
      setTargetPrice('')
      setDirection('above')
      setNotes('')
      setPattern('')
      setShowMoreOptions(false)
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
      <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-surface p-1">
        {allListNames.map((name) => {
          const count = watchlist.filter((w) => (w.listName || DEFAULT_WATCHLIST_NAME) === name).length
          return (
            <button
              key={name}
              onClick={() => setActiveList(name)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                activeList === name
                  ? 'bg-accent text-accent-fg'
                  : 'text-text-muted hover:bg-surface-2 hover:text-text',
              )}
            >
              {name}
              <span className={cn('num-tabular text-xs', activeList === name ? 'opacity-80' : 'text-text-muted')}>
                ({count})
              </span>
            </button>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>הוספת מניה למעקב — "{activeList}"</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Label>סימול *</Label>
              <Input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="AAPL" />
            </div>
            <Button disabled={!isValid || submitting} onClick={handleAdd}>
              <Plus className="h-4 w-4" />
              {submitting ? 'מוסיף...' : 'הוסף למעקב'}
            </Button>
          </div>

          <button
            type="button"
            onClick={() => setShowMoreOptions((v) => !v)}
            className="mt-2 text-xs font-medium text-accent hover:underline"
          >
            {showMoreOptions ? 'הסתר עוד אפשרויות' : 'עוד אפשרויות (תבנית, יעד להתראה, הערות)'}
          </button>

          {showMoreOptions && (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <Label>סוג הגרף (Pattern)</Label>
                <PatternSelect value={pattern} onChange={setPattern} />
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
              <div className="sm:col-span-3">
                <Label>הערות</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="למה אתה עוקב אחרי המניה הזו..." />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        {itemsInActiveList.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center text-text-muted">
            אין עדיין מניות ב"{activeList}"
          </div>
        )}
        {itemsInActiveList.map((item, index) => (
          <WatchlistCard
            key={item.watchId}
            item={item}
            onEdit={() => setEditItem(item)}
            onDelete={() => handleDelete(item.watchId, item.symbol)}
            onOpenTrade={() => onOpenTradeFromPlan(item)}
            onMoveUp={index > 0 ? () => handleMove(item, 'up') : undefined}
            onMoveDown={index < itemsInActiveList.length - 1 ? () => handleMove(item, 'down') : undefined}
          />
        ))}
      </div>

      {editItem && (
        <EditWatchlistDialog
          item={editItem}
          allListNames={allListNames}
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
  onOpenTrade,
  onMoveUp,
  onMoveDown,
}: {
  item: WatchlistItem
  onEdit: () => void
  onDelete: () => void
  onOpenTrade: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
}) {
  const hasTarget = item.targetPrice !== null
  const distancePct =
    hasTarget && item.currentPrice !== null
      ? ((item.currentPrice - item.targetPrice!) / item.targetPrice!) * 100
      : null
  const hasPlan = item.plannedEntryPrice !== null && item.plannedStopLoss !== null
  const planStopPct =
    hasPlan && item.plannedEntryPrice! > item.plannedStopLoss!
      ? ((item.plannedEntryPrice! - item.plannedStopLoss!) / item.plannedEntryPrice!) * 100
      : null

  return (
    <Card className={cn('flex', item.alertTriggered && 'border-warn ring-1 ring-warn/40')}>
      <div className="flex shrink-0 flex-col justify-center gap-0.5 border-l border-border px-1.5">
        <button
          onClick={onMoveUp}
          disabled={!onMoveUp}
          className="rounded-md p-1 text-text-muted hover:bg-surface-2 hover:text-text disabled:pointer-events-none disabled:opacity-20"
          title="הזז למעלה"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
        <button
          onClick={onMoveDown}
          disabled={!onMoveDown}
          className="rounded-md p-1 text-text-muted hover:bg-surface-2 hover:text-text disabled:pointer-events-none disabled:opacity-20"
          title="הזז למטה"
        >
          <ArrowDown className="h-4 w-4" />
        </button>
      </div>
      <CardContent className="flex-1 p-4">
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

        <div className="flex items-center gap-2 border-t border-border pt-3 text-sm">
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

        {hasPlan && (
          <div className="mt-2 grid grid-cols-2 gap-2 rounded-lg border border-accent/30 bg-accent/5 p-3 text-sm sm:grid-cols-5">
            <div className="col-span-2 flex items-center gap-1.5 text-xs font-medium text-accent sm:col-span-5">
              <Bookmark className="h-3.5 w-3.5" />
              תוכנית מסחר שמורה{item.plannedPattern && ` · ${item.plannedPattern}`}
            </div>
            <InlineField label="כניסה" value={`$${formatCurrency(item.plannedEntryPrice)}`} />
            <InlineField
              label="סטופ"
              value={`$${formatCurrency(item.plannedStopLoss)}${planStopPct !== null ? ` (-${planStopPct.toFixed(1)}%)` : ''}`}
              className={percentageColorClass(planStopPct)}
            />
            <InlineField
              label="יעד"
              value={item.plannedTargetPrice !== null ? `$${formatCurrency(item.plannedTargetPrice)}` : '—'}
            />
            <InlineField
              label="כמות מניות"
              value={item.plannedShares !== null ? formatNumber(item.plannedShares) : '—'}
            />
            <InlineField
              label="סיכון"
              value={item.plannedRiskAmount !== null ? `$${formatCurrency(item.plannedRiskAmount)}` : '—'}
            />
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          {hasPlan ? (
            <Button size="sm" variant="success" onClick={onOpenTrade}>
              <Send className="h-3.5 w-3.5" />
              בצע כניסה לעסקה
            </Button>
          ) : (
            <span />
          )}
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
  allListNames,
  onClose,
  onSave,
}: {
  item: WatchlistItem
  allListNames: string[]
  onClose: () => void
  onSave: (input: UpdateWatchlistInput) => Promise<void>
}) {
  const [targetPrice, setTargetPrice] = React.useState(item.targetPrice != null ? String(item.targetPrice) : '')
  const [direction, setDirection] = React.useState<AlertDirection>(item.alertDirection)
  const [notes, setNotes] = React.useState(item.notes)
  const currentList = item.listName || DEFAULT_WATCHLIST_NAME
  const [listName, setListName] = React.useState(currentList)
  const [customListName, setCustomListName] = React.useState('')
  const [planEntry, setPlanEntry] = React.useState(item.plannedEntryPrice != null ? String(item.plannedEntryPrice) : '')
  const [planStop, setPlanStop] = React.useState(item.plannedStopLoss != null ? String(item.plannedStopLoss) : '')
  const [planTarget, setPlanTarget] = React.useState(
    item.plannedTargetPrice != null ? String(item.plannedTargetPrice) : '',
  )
  const [planRisk, setPlanRisk] = React.useState(item.plannedRiskAmount != null ? String(item.plannedRiskAmount) : '')
  const [planShares, setPlanShares] = React.useState(item.plannedShares != null ? String(item.plannedShares) : '')
  const [planPattern, setPlanPattern] = React.useState(item.plannedPattern)
  const [submitting, setSubmitting] = React.useState(false)

  async function handleSave() {
    const finalListName = listName === '__custom__' ? customListName.trim() : listName
    setSubmitting(true)
    try {
      await onSave({
        watchId: item.watchId,
        targetPrice: targetPrice === '' ? null : parseFloat(targetPrice),
        alertDirection: direction,
        notes,
        listName: finalListName || currentList,
        plannedEntryPrice: planEntry === '' ? null : parseFloat(planEntry),
        plannedStopLoss: planStop === '' ? null : parseFloat(planStop),
        plannedTargetPrice: planTarget === '' ? null : parseFloat(planTarget),
        plannedRiskAmount: planRisk === '' ? null : parseFloat(planRisk),
        plannedShares: planShares === '' ? null : parseInt(planShares, 10),
        plannedPattern: planPattern,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open onClose={onClose} title={`עריכת מעקב — ${item.symbol}`}>
      <div className="space-y-3">
        <div>
          <Label>רשימה</Label>
          <Select value={listName} onChange={(e) => setListName(e.target.value)}>
            {allListNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
            <option value="__custom__">רשימה אחרת...</option>
          </Select>
          {listName === '__custom__' && (
            <Input
              className="mt-2"
              value={customListName}
              onChange={(e) => setCustomListName(e.target.value)}
              placeholder="שם רשימה חדשה"
            />
          )}
        </div>
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

        <div className="border-t border-border pt-3">
          <div className="mb-2 flex items-center gap-1.5 text-sm font-medium text-text">
            <Bookmark className="h-3.5 w-3.5 text-accent" />
            תוכנית מסחר (אופציונלי)
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>מחיר כניסה מתוכנן</Label>
              <Input type="number" value={planEntry} onChange={(e) => setPlanEntry(e.target.value)} />
            </div>
            <div>
              <Label>סטופ לוס מתוכנן</Label>
              <Input type="number" value={planStop} onChange={(e) => setPlanStop(e.target.value)} />
            </div>
            <div>
              <Label>יעד מתוכנן</Label>
              <Input type="number" value={planTarget} onChange={(e) => setPlanTarget(e.target.value)} />
            </div>
            <div>
              <Label>כמות מניות</Label>
              <Input type="number" value={planShares} onChange={(e) => setPlanShares(e.target.value)} />
            </div>
            <div>
              <Label>סכום סיכון מתוכנן ($, אופציונלי — לתיעוד בלבד)</Label>
              <Input type="number" value={planRisk} onChange={(e) => setPlanRisk(e.target.value)} />
            </div>
          </div>
          <p className="mt-1 text-[11px] text-text-muted">
            אם תמלא "כמות מניות" — היא זו שתיקבע בביצוע העסקה בפועל, לא סכום הסיכון.
          </p>
          <div className="mt-3">
            <Label>סוג הגרף (Pattern)</Label>
            <PatternSelect value={planPattern} onChange={setPlanPattern} />
          </div>
        </div>

        <Button className="w-full" disabled={submitting} onClick={handleSave}>
          {submitting ? 'שומר...' : 'שמור שינויים'}
        </Button>
      </div>
    </Dialog>
  )
}
