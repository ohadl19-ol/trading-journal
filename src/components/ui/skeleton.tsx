import * as React from 'react'
import { cn } from '@/lib/utils'

/** בלוק סקלטון עם אנימציית פעימה עדינה, לשימוש בזמן טעינה ראשונית (לפני שיש נתונים מקומיים) */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-lg bg-surface-2', className)} {...props} />
}

/** שלד של כרטיס עסקה ביומן, באותם ממדים בערך כמו PositionCard האמיתי */
export function PositionCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <Skeleton className="h-16 w-16 shrink-0" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** שלד של כרטיס סטטיסטיקה קטן (StatCard) */
export function StatCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-2 h-6 w-24" />
    </div>
  )
}
