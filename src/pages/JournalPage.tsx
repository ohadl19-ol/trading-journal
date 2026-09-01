import * as React from 'react'
import { RefreshCw, Download, Images, Star, ArrowUpDown } from 'lucide-react'
import { PositionCard } from '@/components/PositionCard'
import { PositionCardSkeleton } from '@/components/ui/skeleton'
import { PositionDialogs } from '@/components/PositionDialogs'
import { DateRangeFilterBar } from '@/components/DateRangeFilterBar'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { filterPositionsByDate, getAvailableYears } from '@/lib/dateFilter'
import { exportFilteredCsv } from '@/lib/csvExport'
import { exportFilteredZip } from '@/lib/zipExport'
import { ALL_TRADE_TAGS, PATTERN_OPTIONS, type DateRangeFilter, type Execution, type Position } from '@/types'

type SortMode = 'date-desc' | 'date-asc' | 'pnl-desc' | 'pnl-asc'

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'date-desc', label: 'תאריך: חדש → ישן' },
  { value: 'date-asc', label: 'תאריך: ישן → חדש' },
  { value: 'pnl-desc', label: 'רווח/הפסד: הכי גבוה → הכי נמוך' },
  { value: 'pnl-asc', label: 'רווח/הפסד: הכי נמוך → הכי גבוה' },
]
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
  webAppUrl: string
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
  webAppUrl,
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
  const [outcomeFilter, setOutcomeFilter] = React.useState('')
  const [tagFilter, setTagFilter] = React.useState('')
  const [followedPlanFilter, setFollowedPlanFilter] = React.useState('')
  const [favoriteOnly, setFavoriteOnly] = React.useState(false)
  const [showMoreFilters, setShowMoreFilters] = React.useState(false)
  const [sortMode, setSortMode] = React.useState<SortMode>('date-desc')
  const [exportingZip, setExportingZip] = React.useState(false)

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
        const haystack = `${p.symbol} ${p.setupReason ?? ''} ${p.notes ?? ''} ${(p.tags ?? []).join(' ')} ${p.tradeReview ?? ''}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      if (statusFilter && p.status !== statusFilter) return false
      if (outcomeFilter && p.winLoss !== outcomeFilter) return false
      if (patternFilter && p.pattern !== patternFilter) return false
      if (tagFilter && !(p.tags ?? []).includes(tagFilter)) return false
      if (followedPlanFilter === 'yes' && p.followedPlan !== true) return false
      if (followedPlanFilter === 'no' && p.followedPlan !== false) return false
      if (favoriteOnly && !p.isFavorite) return false
      return true
    })
  }, [dateFiltered, searchText, statusFilter, outcomeFilter, patternFilter, tagFilter, followedPlanFilter, favoriteOnly])

  const sorted = React.useMemo(() => {
    const arr = [...fullyFiltered]
    switch (sortMode) {
      case 'date-asc':
        return arr.sort((a, b) => new Date(a.openDate).getTime() - new Date(b.openDate).getTime())
      case 'pnl-desc':
        return arr.sort((a, b) => b.realizedPnl - a.realizedPnl)
      case 'pnl-asc':
        return arr.sort((a, b) => a.realizedPnl - b.realizedPnl)
      default:
        return arr.sort((a, b) => new Date(b.openDate).getTime() - new Date(a.openDate).getTime())
    }
  }, [fullyFiltered, sortMode])

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

  async function handleExportZip() {
    if (sorted.length === 0) {
      toast('אין עסקאות בסינון הנוכחי לייצוא', 'error')
      return
    }
    setExportingZip(true)
    try {
      const result = await exportFilteredZip(webAppUrl, sorted, executions)
      if (result.imagesIncluded === 0 && result.imagesFailed === 0) {
        toast(`יוצא ZIP עם ${sorted.length} עסקאות (בלי תמונות — אין קישורי צ׳ארט בסינון)`)
      } else {
        toast(
          `יוצא ZIP: ${result.imagesIncluded} תמונות נכללו` +
            (result.imagesFailed > 0 ? `, ${result.imagesFailed} נכשלו` : '') +
            (result.truncated ? ` (הוגבל ל-15 תמונות, צמצם את הסינון לקבלת יותר)` : ''),
        )
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'שגיאה בייצוא ה-ZIP', 'error')
    } finally {
      setExportingZip(false)
    }
  }

  return (
    <div className="space-y-4">
      <DateRangeFilterBar
        filter={filter}
        onFilterChange={onFilterChange}
        availableYears={filterYears}
        trailing={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <ArrowUpDown className="h-3.5 w-3.5 text-text-muted" />
              <Select
                className="h-9 w-56 py-0"
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
            <Button size="sm" variant="ghost" onClick={handleExportFiltered}>
              <Download className="h-3.5 w-3.5" />
              ייצוא מסונן ({sorted.length})
            </Button>
            <Button size="sm" variant="ghost" onClick={handleExportZip} disabled={exportingZip}>
              <Images className="h-3.5 w-3.5" />
              {exportingZip ? 'מייצא...' : 'ייצוא עם תמונות (ZIP)'}
            </Button>
            <Button size="sm" variant="ghost" onClick={onRefresh} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              רענן
            </Button>
          </div>
        }
      />

      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            className="lg:col-span-2"
            placeholder="חיפוש לפי סימול, הערות, תגיות..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">כל הסטטוסים</option>
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

        <button
          type="button"
          onClick={() => setShowMoreFilters((v) => !v)}
          className="mt-3 text-xs font-medium text-accent hover:underline"
        >
          {showMoreFilters ? 'הסתר סינונים נוספים' : 'עוד סינונים (תוצאה, תגית, משמעת, מועדפות)'}
        </button>

        {showMoreFilters && (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Select value={outcomeFilter} onChange={(e) => setOutcomeFilter(e.target.value)}>
              <option value="">כל התוצאות</option>
              <option value="WIN">WIN</option>
              <option value="LOSS">LOSS</option>
            </Select>
            <Select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
              <option value="">כל התגיות</option>
              {ALL_TRADE_TAGS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
            <Select value={followedPlanFilter} onChange={(e) => setFollowedPlanFilter(e.target.value)}>
              <option value="">פעלתי לפי התוכנית: הכל</option>
              <option value="yes">✔ פעלתי לפי התוכנית</option>
              <option value="no">✘ סטיתי מהתוכנית</option>
            </Select>
            <button
              type="button"
              onClick={() => setFavoriteOnly((v) => !v)}
              className={cn(
                'flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                favoriteOnly
                  ? 'border-warn bg-warn-bg text-warn'
                  : 'border-border text-text-muted hover:text-text',
              )}
            >
              <Star className="h-4 w-4" fill={favoriteOnly ? 'currentColor' : 'none'} />
              רק מועדפות
            </button>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {loading && positions.length === 0 ? (
          Array.from({ length: 4 }).map((_, i) => <PositionCardSkeleton key={i} />)
        ) : (
          <>
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
          </>
        )}
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
