import type { Execution, Position, WatchlistItem } from '@/types'

export interface GetDataResponse {
  trades: Position[]
  executions: Execution[]
  watchlist: WatchlistItem[]
}

export type ActionPayload =
  | { action: 'open'; [key: string]: unknown }
  | { action: 'add'; [key: string]: unknown }
  | { action: 'trim'; [key: string]: unknown }
  | { action: 'close'; [key: string]: unknown }
  | { action: 'update'; [key: string]: unknown }
  | { action: 'delete'; [key: string]: unknown }
  | { action: 'watchlistAdd'; [key: string]: unknown }
  | { action: 'watchlistUpdate'; [key: string]: unknown }
  | { action: 'watchlistDelete'; [key: string]: unknown }

/**
 * שולח פעולה (POST) אל ה-Google Apps Script Web App.
 * משתמשים ב-Content-Type: text/plain כדי להימנע מ-CORS preflight,
 * ה-Apps Script קורא את e.postData.contents ומפענח JSON בעצמו.
 */
export async function postAction(webAppUrl: string, payload: ActionPayload): Promise<void> {
  if (!webAppUrl) throw new Error('לא הוגדרה כתובת Web App. עבור להגדרות והזן כתובת.')

  const res = await fetch(webAppUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    throw new Error(`שגיאה בשליחת הפעולה לשרת (${res.status})`)
  }

  const data = await res.json().catch(() => null)
  if (data && data.status && data.status !== 'ok') {
    throw new Error(data.message || 'הפעולה נכשלה בשרת')
  }
}

/** משיכת כל הנתונים (GET) מה-Web App */
export async function fetchData(webAppUrl: string): Promise<GetDataResponse> {
  if (!webAppUrl) throw new Error('לא הוגדרה כתובת Web App. עבור להגדרות והזן כתובת.')

  const res = await fetch(webAppUrl, { method: 'GET' })
  if (!res.ok) {
    throw new Error(`שגיאה במשיכת נתונים מהשרת (${res.status})`)
  }
  const data = await res.json()
  return {
    trades: data.trades ?? [],
    executions: data.executions ?? [],
    watchlist: data.watchlist ?? [],
  }
}

/** בדיקת חיבור פשוטה */
export async function testConnection(webAppUrl: string): Promise<boolean> {
  try {
    await fetchData(webAppUrl)
    return true
  } catch {
    return false
  }
}
