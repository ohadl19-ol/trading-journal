import * as React from 'react'
import { RefreshCw } from 'lucide-react'
import { PositionCard } from '@/components/PositionCard'
import { PositionDialogs } from '@/components/PositionDialogs'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { filterPositionsByDate } from '@/lib/dateFilter'
import { PATTERN_OPTIONS, type DateRangeFilter, type Execution, type Position } from '@/types'
import type {
  AddSharesInput,
  CloseInput,
  TrimInput,
  UpdatePositionInput,
} from '@/hooks/useTradingData'

interface JournalPageProps {
  positions: Position[]
  executions: Execution[]
  loading: boolean
  onRefresh: () => void
  onAddShares: (input: AddSharesInput) => Promise<void>
  onTrim: (input: TrimInput) => Promise<void>
  onCloseTrade: (input: CloseInput) => Promise<void>
  onUpdate: (input: UpdatePositionInput) => Promise<void>
  onDelete: (tradeId: string) => Promise<void>
  filter: DateRangeFilter
  onFilterChange: (filter: DateRangeFilter) => void
}

const PRESETS: { value: DateRangeFilter['preset']; label: string }[] = [
  { value: 'week', label: 'שבוע נוכחי' },
  { value: 'month', label: 'חודש נוכחי' },
  { value: 'year', label: 'שנה נוכחית' },
  { value: 'all', label: 'הכול' },
  { value: 'custom', label: 'טווח מותאם' },
  { value: 'monthYear', label: 'חודש+שנה ספציפי' },
]

const MONTH_NAMES = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
]

export function JournalPage({
  positions,
  executions,
  loading,
  onRefresh,
  onAddShares,
  onTrim,
  onCloseTrade,
  onUpdate,
  onDelete,
  filter,
  onFilterChange,
}: JournalPageProps) {
  const [symbolFilter, setSymbolFilter] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState('')
  const [patternFilter, setPatternFilter] = React.useState('')

  const [dialogState, setDialogState] = React.useState<{
    position: Position | null
    mode: 'add' | 'trim' | 'close' | 'chart' | 'edit' | 'delete' | null
  }>({ position: null, mode: null })

  const dateFiltered = React.useMemo(() => filterPositionsByDate(positions, filter), [positions, filter])

  const fullyFiltered = React.useMemo(() => {
    return dateFiltered.filter((p) => {
      if (symbolFilter && !p.symbol.toLowerCase().includes(symbolFilter.toLowerCase())) return false
      if (statusFilter && p.status !== statusFilter) return false
      if (patternFilter && p.pattern !== patternFilter) return false
      return true
    })
  }, [dateFiltered, symbolFilter, statusFilter, patternFilter])

  const sorted = React.useMemo(
    () => [...fullyFiltered].sort((a, b) => new Date(b.openDate).getTime() - new Date(a.openDate).getTime()),
    [fullyFiltered],
  )

  const executionsByTrade = React.useMemo(() => {
    const map = new Map<string, Execution[]>()
    for (const e of executions) {
      const list = map.get(e.tradeId) || []
      list.push(e)
      map.set(e.tradeId, list)
    }
    for (const list of map.values()) {
      list.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    }
    return map
  }, [executions])

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.value}
              onClick={() => onFilterChange({ ...filter, preset: p.value })}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                filter.preset === p.value
                  ? 'bg-accent text-accent-fg'
                  : 'bg-surface-2 text-text-muted hover:text-text'
              }`}
            >
              {p.label}
            </button>
          ))}
          <Button size="sm" variant="ghost" onClick={onRefresh} disabled={loading} className="mr-auto">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            רענן
          </Button>
        </div>

        {filter.preset === 'custom' && (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:w-96">
            <div>
              <label className="mb-1 block text-xs text-text-muted">מתאריך</label>
              <Input
                type="date"
                value={filter.from ?? ''}
                onChange={(e) => onFilterChange({ ...filter, from: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-text-muted">עד תאריך</label>
              <Input
                type="date"
                value={filter.to ?? ''}
                onChange={(e) => onFilterChange({ ...filter, to: e.target.value })}
              />
            </div>
          </div>
        )}

        {filter.preset === 'monthYear' && (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:w-96">
            <div>
              <label className="mb-1 block text-xs text-text-muted">חודש</label>
              <Select
                value={filter.month ?? ''}
                onChange={(e) => onFilterChange({ ...filter, month: Number(e.target.value) })}
              >
                <option value="">בחר...</option>
                {MONTH_NAMES.map((m, i) => (
                  <option key={m} value={i}>
                    {m}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-text-muted">שנה</label>
              <Input
                type="number"
                value={filter.year ?? ''}
                onChange={(e) => onFilterChange({ ...filter, year: Number(e.target.value) })}
              />
            </div>
          </div>
        )}

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input
            placeholder="חיפוש לפי סימול..."
            value={symbolFilter}
            onChange={(e) => setSymbolFilter(e.target.value)}
          />
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">כל הסטאטוסים</option>
            <option value="פתוחה">פתוחה</option>
            <option value="פתוחה חלקית">פתוחה חלקית</option>
            <option value="סגורה">סגורה</option>
          </Select>
          <Select value={patternFilter} onChange={(e) => setPatternFilter(e.target.value)}>
            <option value="">כל סוגי הגרף</option>
            {PATTERN_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="space-y-3">
        {sorted.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center text-text-muted">
            אין עסקאות התואמות את הסינון
          </div>
        )}
        {sorted.map((position) => (
          <PositionCard
            key={position.tradeId}
            position={position}
            executions={executionsByTrade.get(position.tradeId) ?? []}
            onAddShares={() => setDialogState({ position, mode: 'add' })}
            onTrim={() => setDialogState({ position, mode: 'trim' })}
            onClose={() => setDialogState({ position, mode: 'close' })}
            onEditChart={() => setDialogState({ position, mode: 'chart' })}
            onEditDetails={() => setDialogState({ position, mode: 'edit' })}
            onDelete={() => setDialogState({ position, mode: 'delete' })}
          />
        ))}
      </div>

      <PositionDialogs
        position={dialogState.position}
        mode={dialogState.mode}
        onClose={() => setDialogState({ position: null, mode: null })}
        onAddShares={onAddShares}
        onTrim={onTrim}
        onCloseTrade={onCloseTrade}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />
    </div>
  )
}
