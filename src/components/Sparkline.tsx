import { cn } from '@/lib/utils'

interface SparklineProps {
  values: number[]
  width?: number
  height?: number
  className?: string
}

/** קו מגמה זעיר וללא אינטראקציה — לשימוש בהדר/כרטיסים קומפקטיים, לא תחליף לעקומת ההון המלאה */
export function Sparkline({ values, width = 72, height = 24, className }: SparklineProps) {
  if (values.length < 2) return null

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const pad = 2

  const xFor = (i: number) => pad + (i / (values.length - 1)) * (width - 2 * pad)
  const yFor = (v: number) => pad + (1 - (v - min) / range) * (height - 2 * pad)

  const path = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${xFor(i)},${yFor(v)}`).join(' ')
  const trendUp = values[values.length - 1] >= values[0]

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={cn('shrink-0', className)}>
      <path
        d={path}
        fill="none"
        stroke={trendUp ? 'var(--color-win)' : 'var(--color-loss)'}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
