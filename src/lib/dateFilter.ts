import type { DateRangeFilter, Position } from '@/types'

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

export function filterPositionsByDate(positions: Position[], filter: DateRangeFilter): Position[] {
  const now = new Date()

  let from: Date | null = null
  let to: Date | null = null

  switch (filter.preset) {
    case 'all':
      return positions
    case 'week':
      from = startOfWeek(now)
      to = endOfWeek(now)
      break
    case 'month':
      from = new Date(now.getFullYear(), now.getMonth(), 1)
      to = new Date(now.getFullYear(), now.getMonth() + 1, 1)
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
    case 'custom':
      from = filter.from ? new Date(filter.from) : null
      to = filter.to ? new Date(filter.to) : null
      if (to) to.setHours(23, 59, 59, 999)
      break
  }

  return positions.filter((p) => {
    const openDate = new Date(p.openDate)
    if (from && openDate < from) return false
    if (to && openDate >= to && filter.preset !== 'custom') return false
    if (to && filter.preset === 'custom' && openDate > to) return false
    return true
  })
}
