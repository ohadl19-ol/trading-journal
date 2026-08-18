import type { Execution, Position, WatchlistItem } from '@/types'

export interface GeneralNotes {
  generalNotes: string
  tradingRules: string
}

export interface GetDataResponse {
  trades: Position[]
  executions: Execution[]
  watchlist: WatchlistItem[]
  notes: GeneralNotes
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
  | { action: 'saveNotes'; [key: string]: unknown }
  | { action: 'fetchChartImages'; charts: { tradeId: string; symbol: string; chartUrl: string }[] }

export interface ChartImageResult {
  tradeId: string
  symbol: string
  base64?: string
  contentType?: string
  error?: string
}

export interface FetchChartImagesResponse {
  images: ChartImageResult[]
  truncated: boolean
  totalRequested: number
  limit: number
}

/**
 * שולח פעולה (POST) אל ה-Google Apps Script Web App.
 * משתמשים ב-Content-Type: text/plain כדי להימנע מ-CORS preflight,
 * ה-Apps Script קורא את e.postData.contents ומפענח JSON בעצמו.
 */
export async function postAction(webAppUrl: string, payload: ActionPayload): Promise<void> {
  await postActionWithResult(webAppUrl, payload)
}

/** כמו postAction, אבל מחזיר גם את ה-result שהשרת שלח בחזרה (לפעולות שמחזירות נתונים) */
export async function postActionWithResult<T = unknown>(webAppUrl: string, payload: ActionPayload): Promise<T> {
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
  return data?.result as T
}

/** מושך תמונות צ'ארט אמיתיות (לא רק קישורים) עבור עסקאות עם קישור צ'ארט, דרך ה-Backend */
export async function fetchChartImages(
  webAppUrl: string,
  charts: { tradeId: string; symbol: string; chartUrl: string }[],
): Promise<FetchChartImagesResponse> {
  return postActionWithResult<FetchChartImagesResponse>(webAppUrl, { action: 'fetchChartImages', charts })
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
    notes: data.notes ?? { generalNotes: '', tradingRules: '' },
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
