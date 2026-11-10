import { useLivePricesContext } from '@/hooks/useLivePrices'
import type { LiveQuote } from '@/lib/livePrice'
import { lastClosedSessionDate, timeAgo } from '@/lib/marketHours'
import { cn } from '@/lib/utils'

/** אחרי כמה זמן ציטוט "חי" נחשב לא עדכני בזמן שהשוק פתוח */
const STALE_MS = 12 * 60 * 1000

/**
 * שורת עדכניות מתחת למחיר:
 * - מחיר חי: "עודכן לפני 2 דקות" (או "סגירה · לפני X" מחוץ לשעות המסחר)
 * - אין מחיר חי: "מחיר סגירה 7.11.2026" (הערך מעמודת "מחיר נוכחי" ביומן)
 * - אין חיבור / ציטוט ישן: "מחיר לא עדכני"
 */
export function PriceFreshness({ quote, hasSheetPrice, className }: { quote: LiveQuote | null; hasSheetPrice: boolean; className?: string }) {
  const { error, marketOpen, now } = useLivePricesContext()

  if (quote) {
    const at = quote.quoteTime ?? quote.fetchedAt
    const stale = !!error || (marketOpen && now.getTime() - new Date(quote.fetchedAt).getTime() > STALE_MS)
    return (
      <span className={cn('text-[11px]', stale ? 'text-warn' : 'text-text-muted', className)} title={`מקור: ${quote.source}`}>
        {quote.isMarketOpen ? `עודכן ${timeAgo(at, now)}` : `מחיר סגירה · ${timeAgo(at, now)}`}
        {stale && ' · מחיר לא עדכני'}
      </span>
    )
  }
  if (hasSheetPrice) {
    return (
      <span className={cn('text-[11px] text-text-muted', className)}>
        מחיר סגירה {lastClosedSessionDate(now)}
        {error && <span className="text-warn"> · מחיר לא עדכני</span>}
      </span>
    )
  }
  return <span className={cn('text-[11px] text-warn', className)}>אין מחיר · מחיר לא עדכני</span>
}
