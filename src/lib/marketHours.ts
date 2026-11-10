/**
 * שעות המסחר בארה"ב (NYSE/Nasdaq): ימים א׳–ה׳ בשבוע האמריקאי (שני–שישי), 9:30–16:00 שעון ניו יורק.
 * החישוב נעשה לפי אזור הזמן של ניו יורק, ולכן מעבר שעון (בארה"ב ובישראל, שלא תמיד באותו שבוע)
 * מטופל אוטומטית: בדרך כלל זה 16:30–23:00 שעון ישראל. חגים אמריקאיים לא מזוהים — ביום חג
 * האפליקציה פשוט תקבל מהספק את מחיר הסגירה האחרון.
 */

interface NyParts {
  year: number
  month: number // 1-12
  day: number
  weekday: number // 0 = ראשון ... 6 = שבת
  minutes: number // דקות מחצות
}

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

function nyParts(now: Date): NyParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    weekday: WEEKDAYS[get('weekday')] ?? 0,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  }
}

const OPEN_MIN = 9 * 60 + 30
const CLOSE_MIN = 16 * 60

export function isUsMarketOpen(now = new Date()): boolean {
  const p = nyParts(now)
  return p.weekday >= 1 && p.weekday <= 5 && p.minutes >= OPEN_MIN && p.minutes < CLOSE_MIN
}

/**
 * תאריך יום המסחר האחרון שכבר נסגר (בשעון ניו יורק), בפורמט d.m.yyyy.
 * משמש לתיוג המחיר מעמודת "מחיר נוכחי" ביומן, שמתעדכנת בלילה במחיר הסגירה.
 */
export function lastClosedSessionDate(now = new Date()): string {
  const p = nyParts(now)
  // מתחילים מהיום בניו יורק; אם עוד לא נסגר המסחר היום (או שזה סוף שבוע) — הולכים אחורה
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day))
  const closedToday = p.weekday >= 1 && p.weekday <= 5 && p.minutes >= CLOSE_MIN
  if (!closedToday) d.setUTCDate(d.getUTCDate() - 1)
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() - 1)
  return `${d.getUTCDate()}.${d.getUTCMonth() + 1}.${d.getUTCFullYear()}`
}

/** "לפני 2 דקות" / "לפני שעה" / "לפני 3 ימים" */
export function timeAgo(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return ''
  const diffMin = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60000))
  if (diffMin < 1) return 'עכשיו'
  if (diffMin === 1) return 'לפני דקה'
  if (diffMin < 60) return `לפני ${diffMin} דקות`
  const h = Math.round(diffMin / 60)
  if (h === 1) return 'לפני שעה'
  if (h < 24) return `לפני ${h} שעות`
  const days = Math.round(h / 24)
  return days === 1 ? 'לפני יום' : `לפני ${days} ימים`
}

/** מפתח תאריך (yyyy-mm-dd) של רגע נתון בשעון ניו יורק — להשוואה "האם זה אותו יום מסחר" */
export function nyDateKey(date: Date): string {
  const p = nyParts(date)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}
