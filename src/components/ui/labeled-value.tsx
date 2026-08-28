import * as React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/** תווית קטנה + ערך מודגש בשורה, בלי מסגרת — לשימוש בתוך רשתות שדות (כרטיס עסקה, תוכנית מעקב) */
export function InlineField({
  label,
  value,
  className,
}: {
  label: string
  value: string
  className?: string
}) {
  return (
    <div>
      <div className="text-[11px] text-text-muted">{label}</div>
      <div className={cn('font-medium num-tabular', className)}>{value}</div>
    </div>
  )
}

/** כרטיס נפרד עם תווית ואייקון למעלה, ערך גדול למטה — לשימוש בשורות "מבט מהיר" (דשבורד, סטטיסטיקה) */
export function StatTile({
  icon,
  label,
  value,
  valueClass,
}: {
  icon?: React.ReactNode
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-1.5 text-xs text-text-muted">
          {icon}
          {label}
        </div>
        <div className={cn('mt-1 text-xl font-bold num-tabular', valueClass)}>{value}</div>
      </CardContent>
    </Card>
  )
}
