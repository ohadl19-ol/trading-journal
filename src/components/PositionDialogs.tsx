import * as React from 'react'
import { Dialog } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { CATEGORY_OPTIONS, OUTCOME_OPTIONS, PATTERN_OPTIONS, type Position } from '@/types'
import type {
  AddSharesInput,
  CloseInput,
  TrimInput,
  UpdatePositionInput,
} from '@/hooks/useTradingData'

type DialogMode = 'add' | 'trim' | 'close' | 'chart' | 'edit' | 'delete' | null

interface PositionDialogsProps {
  position: Position | null
  mode: DialogMode
  onClose: () => void
  onAddShares: (input: AddSharesInput) => Promise<void>
  onTrim: (input: TrimInput) => Promise<void>
  onCloseTrade: (input: CloseInput) => Promise<void>
  onUpdate: (input: UpdatePositionInput) => Promise<void>
  onDelete: (tradeId: string) => Promise<void>
}

export function PositionDialogs({
  position,
  mode,
  onClose,
  onAddShares,
  onTrim,
  onCloseTrade,
  onUpdate,
  onDelete,
}: PositionDialogsProps) {
  const { toast } = useToast()
  const [submitting, setSubmitting] = React.useState(false)

  // מצב חיזוק
  const [addPrice, setAddPrice] = React.useState('')
  const [addQty, setAddQty] = React.useState('')
  const [addNotes, setAddNotes] = React.useState('')

  // מצב מכירה חלקית
  const [trimPrice, setTrimPrice] = React.useState('')
  const [trimQty, setTrimQty] = React.useState('')
  const [trimNotes, setTrimNotes] = React.useState('')

  // מצב סגירה
  const [closePrice, setClosePrice] = React.useState('')
  const [outcome, setOutcome] = React.useState('')
  const [category, setCategory] = React.useState('')
  const [closeNotes, setCloseNotes] = React.useState('')

  // מצב קישור צ'ארט
  const [chartUrl, setChartUrl] = React.useState(position?.chartUrl ?? '')

  // מצב עריכת פרטים
  const [editPattern, setEditPattern] = React.useState(position?.pattern ?? '')
  const [editReason, setEditReason] = React.useState(position?.setupReason ?? '')
  const [editNotes, setEditNotes] = React.useState(position?.notes ?? '')
  const [editCurrentPrice, setEditCurrentPrice] = React.useState(
    position?.currentPrice != null ? String(position.currentPrice) : '',
  )

  React.useEffect(() => {
    if (position && mode === 'chart') setChartUrl(position.chartUrl ?? '')
    if (position && mode === 'edit') {
      setEditPattern(position.pattern ?? '')
      setEditReason(position.setupReason ?? '')
      setEditNotes(position.notes ?? '')
      setEditCurrentPrice(position.currentPrice != null ? String(position.currentPrice) : '')
    }
    if (mode === 'add') {
      setAddPrice('')
      setAddQty('')
      setAddNotes('')
    }
    if (mode === 'trim') {
      setTrimPrice('')
      setTrimQty('')
      setTrimNotes('')
    }
    if (mode === 'close') {
      setClosePrice('')
      setOutcome('')
      setCategory('')
      setCloseNotes('')
    }
  }, [position, mode])

  if (!position || !mode) return null

  async function run(fn: () => Promise<void>, successMessage: string) {
    setSubmitting(true)
    try {
      await fn()
      toast(successMessage)
      onClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'שגיאה בביצוע הפעולה', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (mode === 'add') {
    const priceNum = parseFloat(addPrice) || 0
    const qtyNum = parseFloat(addQty) || 0
    const valid = priceNum > 0 && qtyNum > 0
    return (
      <Dialog open onClose={onClose} title={`חיזוק פוזיציה — ${position.symbol}`}>
        <div className="space-y-3">
          <div>
            <Label>מחיר</Label>
            <Input type="number" value={addPrice} onChange={(e) => setAddPrice(e.target.value)} />
          </div>
          <div>
            <Label>כמות מניות</Label>
            <Input type="number" value={addQty} onChange={(e) => setAddQty(e.target.value)} />
          </div>
          <div>
            <Label>הערה</Label>
            <Textarea value={addNotes} onChange={(e) => setAddNotes(e.target.value)} rows={2} />
          </div>
          <Button
            className="w-full"
            disabled={!valid || submitting}
            onClick={() =>
              run(
                () =>
                  onAddShares({
                    tradeId: position.tradeId,
                    price: priceNum,
                    shares: qtyNum,
                    notes: addNotes,
                  }),
                'בוצע חיזוק',
              )
            }
          >
            {submitting ? 'שולח...' : 'אישור חיזוק'}
          </Button>
        </div>
      </Dialog>
    )
  }

  if (mode === 'trim') {
    const priceNum = parseFloat(trimPrice) || 0
    const qtyNum = parseFloat(trimQty) || 0
    const valid = priceNum > 0 && qtyNum > 0 && qtyNum < position.currentShares
    return (
      <Dialog
        open
        onClose={onClose}
        title={`מכירה חלקית — ${position.symbol}`}
        description={`כמות נוכחית: ${position.currentShares.toLocaleString('he-IL')} מניות`}
      >
        <div className="space-y-3">
          <div>
            <Label>מחיר</Label>
            <Input type="number" value={trimPrice} onChange={(e) => setTrimPrice(e.target.value)} />
          </div>
          <div>
            <Label>כמות מניות (חייבת להיות קטנה מהכמות הנוכחית)</Label>
            <Input type="number" value={trimQty} onChange={(e) => setTrimQty(e.target.value)} />
          </div>
          <div>
            <Label>הערה</Label>
            <Textarea value={trimNotes} onChange={(e) => setTrimNotes(e.target.value)} rows={2} />
          </div>
          <Button
            className="w-full"
            disabled={!valid || submitting}
            onClick={() =>
              run(
                () =>
                  onTrim({
                    tradeId: position.tradeId,
                    price: priceNum,
                    shares: qtyNum,
                    notes: trimNotes,
                  }),
                'בוצעה מכירה חלקית',
              )
            }
          >
            {submitting ? 'שולח...' : 'אישור מכירה חלקית'}
          </Button>
        </div>
      </Dialog>
    )
  }

  if (mode === 'close') {
    const priceNum = parseFloat(closePrice) || 0
    const valid = priceNum > 0 && outcome !== ''
    return (
      <Dialog
        open
        onClose={onClose}
        title={`סגירת עסקה — ${position.symbol}`}
        description={`כמות לסגירה: ${position.currentShares.toLocaleString('he-IL')} מניות`}
      >
        <div className="space-y-3">
          <div>
            <Label>מחיר סגירה</Label>
            <Input type="number" value={closePrice} onChange={(e) => setClosePrice(e.target.value)} />
          </div>
          <div>
            <Label>תוצאה (Outcome) *</Label>
            <Select value={outcome} onChange={(e) => setOutcome(e.target.value)}>
              <option value="">בחר...</option>
              {OUTCOME_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>קטגוריה/תגית</Label>
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">ללא</option>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>הערה</Label>
            <Textarea value={closeNotes} onChange={(e) => setCloseNotes(e.target.value)} rows={2} />
          </div>
          <Button
            variant="destructive"
            className="w-full"
            disabled={!valid || submitting}
            onClick={() =>
              run(
                () =>
                  onCloseTrade({
                    tradeId: position.tradeId,
                    price: priceNum,
                    outcome: outcome as CloseInput['outcome'],
                    category,
                    notes: closeNotes,
                  }),
                'העסקה נסגרה',
              )
            }
          >
            {submitting ? 'שולח...' : 'אישור סגירת עסקה'}
          </Button>
        </div>
      </Dialog>
    )
  }

  if (mode === 'chart') {
    return (
      <Dialog open onClose={onClose} title={`קישור צ'ארט — ${position.symbol}`}>
        <div className="space-y-3">
          <div>
            <Label>קישור צ'ארט מ-TradingView</Label>
            <Input value={chartUrl} onChange={(e) => setChartUrl(e.target.value)} placeholder="https://..." />
          </div>
          <Button
            className="w-full"
            disabled={submitting}
            onClick={() =>
              run(() => onUpdate({ tradeId: position.tradeId, chartUrl }), 'קישור הצ׳ארט נשמר')
            }
          >
            {submitting ? 'שומר...' : 'שמור קישור'}
          </Button>
        </div>
      </Dialog>
    )
  }

  if (mode === 'delete') {
    return (
      <Dialog
        open
        onClose={onClose}
        title={`מחיקת עסקה — ${position.symbol}`}
        description="פעולה זו תמחק לצמיתות את הפוזיציה ואת כל הפעולות שלה, גם מהאפליקציה וגם מהגיליון בגוגל דרייב. לא ניתן לבטל."
      >
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            ביטול
          </Button>
          <Button
            variant="destructive"
            disabled={submitting}
            onClick={() => run(() => onDelete(position.tradeId), 'העסקה נמחקה')}
          >
            {submitting ? 'מוחק...' : 'מחק לצמיתות'}
          </Button>
        </div>
      </Dialog>
    )
  }

  if (mode === 'edit') {
    return (
      <Dialog open onClose={onClose} title={`עריכת פרטים — ${position.symbol}`}>
        <div className="space-y-3">
          <div>
            <Label>סוג הגרף (Pattern)</Label>
            <Select value={editPattern} onChange={(e) => setEditPattern(e.target.value)}>
              {PATTERN_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>סיבת כניסה / סטאפ</Label>
            <Textarea value={editReason} onChange={(e) => setEditReason(e.target.value)} rows={2} />
          </div>
          <div>
            <Label>הערות</Label>
            <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={2} />
          </div>
          {position.status !== 'סגורה' && (
            <div>
              <Label>מחיר נוכחי בשוק (לחישוב רווח/הפסד לא ממומש)</Label>
              <Input
                type="number"
                value={editCurrentPrice}
                onChange={(e) => setEditCurrentPrice(e.target.value)}
                placeholder="לדוגמה 328.50"
              />
            </div>
          )}
          <Button
            className="w-full"
            disabled={submitting}
            onClick={() =>
              run(
                () =>
                  onUpdate({
                    tradeId: position.tradeId,
                    pattern: editPattern,
                    setupReason: editReason,
                    notes: editNotes,
                    currentPrice: editCurrentPrice === '' ? null : parseFloat(editCurrentPrice),
                  }),
                'הפרטים עודכנו',
              )
            }
          >
            {submitting ? 'שומר...' : 'שמור שינויים'}
          </Button>
        </div>
      </Dialog>
    )
  }

  return null
}
