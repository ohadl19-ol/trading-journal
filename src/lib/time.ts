/** השעה/דקה הנוכחיות לפי שעון ישראל (Asia/Jerusalem), ללא תלות באזור הזמן של המכשיר */
export function getIsraelHourMinute(): { hour: number; minute: number; label: string } {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('he-IL', {
    timeZone: 'Asia/Jerusalem',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0')
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0')
  const label = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
  return { hour, minute, label }
}
