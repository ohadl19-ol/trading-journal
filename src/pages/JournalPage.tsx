import * as React from 'react'
import { RefreshCw, Download } from 'lucide-react'
import { PositionCard } from '@/components/PositionCard'
import { PositionDialogs } from '@/components/PositionDialogs'
import { DateRangeFilterBar } from '@/components/DateRangeFilterBar'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { filterPositionsByDate, getAvailableYears } from '@/lib/dateFilter'
import { exportFilteredCsv } from '@/lib/csvExport'
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
  onToggleFavorite: (tradeId: string) => Promise<void>
  filter: DateRangeFilter
  onFilterChange: (filter: DateRangeFilter) => void
}

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
  onToggleFavorite,
  filter,
  onFilterChange,
}: JournalPageProps) {
  const { toast } = useToast()
  const [searchText, setSearchText] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState('')
  const [patternFilter, setPatternFilter] = React.useState('')

  const [dialogState, setDialogState] = React.useState<{
    position: Position | null
    mode: 'add' | 'trim' | 'close' | 'chart' | 'edit' | 'delete' | null
  }>({ position: null, mode: null })

  const dateFiltered = React.useMemo(() => filterPositionsByDate(positions, filter), [positions, filter])
  const filterYears = React.useMemo(() => getAvailableYears(positions), [positions])

  const fullyFiltered = React.useMemo(() => {
    const q = searchText.trim().toLowerCase()
    return dateFiltered.filter((p) => {
      if (q) {
        const haystack = `${p.symbol} ${p.setupReason ?? ''} ${p.notes ?? ''}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      if (statusFilter === 'WIN' || statusFilter === 'LOSS') {
        if (p.winLoss !== statusFilter) return false
      } else if (statusFilter === 'FAVORITE') {
        if (!p.isFavorite) return false
      } else if (statusFilter && p.status !== statusFilter) {
        return false
      }
      if (patternFilter && p.pattern !== patternFilter) return false
      return true
    })
  }, [dateFiltered, searchText, statusFilter, patternFilter])

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

  function handleExportFiltered() {
    if (sorted.length === 0) {
      toast('אין עסקאות בסינון הנוכחי לייצוא', 'error')
      return
    }
    exportFilteredCsv(sorted, executions)
    toast(`יוצאו ${sorted.length} עסקאות מהסינון הנוכחי`)
  }

  return (
    <div className="space-y-4">
      <DateRangeFilterBar
        filter={filter}
        onFilterChange={onFilterChange}
        availableYears={filterYears}
        trailing={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={handleExportFiltered}>
              <Download className="h-3.5 w-3.5" />
              ייצוא מסונן ({sorted.length})
            </Button>
            <Button size="sm" variant="ghost" onClick={onRefresh} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              רענן
            </Button>
          </div>
        }
      />

      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input
            placeholder="חיפוש לפי סימול, הערות או סיבת כניסה..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">כל הסטאטוסים</option>
            <option value="פתוחה">פתוחה</option>
            <option value="פתוחה חלקית">פתוחה חלקית</option>
            <option value="סגורה">סגורה</option>
            <option value="WIN">WIN</option>
            <option value="LOSS">LOSS</option>
            <option value="FAVORITE">⭐ מועדפות</option>
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
            onToggleFavorite={() => onToggleFavorite(position.tradeId)}
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
