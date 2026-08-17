import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import type { DateRangeFilter } from '@/types'

interface DateRangeFilterBarProps {
  filter: DateRangeFilter
  onFilterChange: (filter: DateRangeFilter) => void
  /** תוכן נוסף (למשל כפתור רענון) שמוצג בקצה שורת הפריסטים */
  trailing?: React.ReactNode
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

export function DateRangeFilterBar({ filter, onFilterChange, trailing }: DateRangeFilterBarProps) {
  return (
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
        {trailing && <div className="mr-auto">{trailing}</div>}
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
    </div>
  )
}
