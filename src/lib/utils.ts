import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function nowIso(): string {
  return new Date().toISOString()
}

/**
 * ממיר תאריך (YYYY-MM-DD) ושעה (HH:MM) שהוזנו ידנית לזמן ISO. שדות ריקים
 * מתמלאים מהרגע הנוכחי — כך שאם המשתמש לא נגע באף שדה, מתקבל הזמן הנוכחי
 * המדויק בדיוק כמו קודם, ואם שינה רק אחד מהשניים, השני משלים מה"עכשיו".
 */
export function combineDateTimeToIso(dateStr: string, timeStr: string): string {
  if (!dateStr && !timeStr) return nowIso()
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const datePart = dateStr || `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const timePart = timeStr || `${pad(now.getHours())}:${pad(now.getMinutes())}`
  const combined = new Date(`${datePart}T${timePart}:00`)
  return Number.isNaN(combined.getTime()) ? nowIso() : combined.toISOString()
}
