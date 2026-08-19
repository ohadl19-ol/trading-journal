import type { DateRangeFilter, Position } from '@/types'

/** כל השנים שבהן יש עסקאות בפועל (לפי תאריך פתיחה), ממוינות */
export function getAvailableYears(positions: Position[]): number[] {
  const years = new Set(positions.map((p) => new Date(p.openDate).getFullYear()))
  return Array.from(years).sort((a, b) => a - b)
}

function startOfWeek(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay() // 0 = ראשון
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - day)
  return date
}

function endOfWeek(d: Date): Date {
  const start = startOfWeek(d)
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  return end
}

/** גבולות התאריכים (from/to) שמייצג פילטר נתון. from=null אומר "מההתחלה" (פילטר 'all'). */
export function computeDateBounds(filter: DateRangeFilter): { from: Date | null; to: Date | null } {
  const now = new Date()

  let from: Date | null = null
  let to: Date | null = null

  switch (filter.preset) {
    case 'all':
      return { from: null, to: null }
    case 'week':
      from = startOfWeek(now)
      to = endOfWeek(now)
      break
    case 'month':
      from = new Date(now.getFullYear(), now.getMonth(), 1)
      to = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      break
    case 'lastMonth':
      from = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      to = new Date(now.getFullYear(), now.getMonth(), 1)
      break
    case 'year':
      from = new Date(now.getFullYear(), 0, 1)
      to = new Date(now.getFullYear() + 1, 0, 1)
      break
    case 'monthYear':
      if (filter.month !== undefined && filter.year !== undefined) {
        from = new Date(filter.year, filter.month, 1)
        to = new Date(filter.year, filter.month + 1, 1)
      }
      break
    case 'yearSpecific':
      if (filter.year !== undefined) {
        from = new Date(filter.year, 0, 1)
        to = new Date(filter.year + 1, 0, 1)
      }
      break
    case 'custom':
      from = filter.from ? new Date(filter.from) : null
      to = filter.to ? new Date(filter.to) : null
      if (to) to.setHours(23, 59, 59, 999)
      break
  }

  return { from, to }
}

export function filterPositionsByDate(positions: Position[], filter: DateRangeFilter): Position[] {
  if (filter.preset === 'all') return positions
  const { from, to } = computeDateBounds(filter)

  return positions.filter((p) => {
    const openDate = new Date(p.openDate)
    if (from && openDate < from) return false
    if (to && openDate >= to && filter.preset !== 'custom') return false
    if (to && filter.preset === 'custom' && openDate > to) return false
    return true
  })
}
