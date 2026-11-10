import type { Execution, Position, WatchlistItem } from '@/types'
import { assertValidTarget, hasDemoTag, SheetGuardError, type SheetTarget } from '@/lib/accountMode'

export interface GeneralNotes {
  generalNotes: string
  tradingRules: string
}

/** הגדרות ששמורות בצד השרת (PropertiesService) ומסונכרנות בין כל המכשירים. שדה = null
 * אומר שהוא מעולם לא הוגדר בשרת (למשל גיליון חדש) — במקרה כזה הצד-לקוח לא דורס את הערך
 * המקומי שלו איתו, אלא דוחף את הערך המקומי הנוכחי לשרת כדי שהוא יהפוך למקור האמת מעכשיו. */
export interface RemoteSettings {
  initialCapital: number | null
  defaultAccountBalance: number | null
  defaultRiskAmount: number | null
  commissionPerAction: number | null
}

export interface GetDataResponse {
  trades: Position[]
  executions: Execution[]
  watchlist: WatchlistItem[]
  notes: GeneralNotes
  settings: RemoteSettings
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
  | { action: 'updateSettings'; [key: string]: unknown }
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

// יעדים (Web App + גיליון) שהשרת כבר אישר בקריאה שהוא באמת מגיש. כתיבה מותרת רק אליהם:
// שרת ישן שמתעלם מ-sheetId היה כותב תמיד ליומן האמיתי — כך זה לא יכול לקרות.
const verifiedTargets = new Set<string>()
const targetKey = (webAppUrl: string, t: SheetTarget) => `${webAppUrl}|${t.mode}|${t.sheetId}`

/** לשימוש בבדיקות בלבד */
export function __resetVerifiedTargets() {
  verifiedTargets.clear()
}

/**
 * שולח פעולה (POST) אל ה-Google Apps Script Web App.
 * משתמשים ב-Content-Type: text/plain כדי להימנע מ-CORS preflight,
 * ה-Apps Script קורא את e.postData.contents ומפענח JSON בעצמו.
 */
export async function postAction(webAppUrl: string, target: SheetTarget, payload: ActionPayload): Promise<void> {
  await postActionWithResult(webAppUrl, target, payload)
}

/** כמו postAction, אבל מחזיר גם את ה-result שהשרת שלח בחזרה (לפעולות שמחזירות נתונים) */
export async function postActionWithResult<T = unknown>(
  webAppUrl: string,
  target: SheetTarget,
  payload: ActionPayload,
): Promise<T> {
  if (!webAppUrl) throw new Error('לא הוגדרה כתובת Web App. עבור להגדרות והזן כתובת.')
  const t = assertValidTarget(target)
  if (t.mode === 'real' && hasDemoTag((payload as { tags?: unknown }).tags)) {
    throw new SheetGuardError('נחסם: ניסיון לכתוב עסקה עם תגית "דמו" ליומן האמיתי.')
  }
  if (!verifiedTargets.has(targetKey(webAppUrl, t))) {
    throw new SheetGuardError(
      'השרת עוד לא אישר שהוא מחובר לגיליון הנכון, ולכן הכתיבה נחסמה. רענן את הנתונים, ואם זה חוזר — פרוס את הגרסה החדשה של הסקריפט.',
    )
  }

  const res = await fetch(webAppUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ ...payload, mode: t.mode, sheetId: t.sheetId }),
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
  target: SheetTarget,
  charts: { tradeId: string; symbol: string; chartUrl: string }[],
): Promise<FetchChartImagesResponse> {
  return postActionWithResult<FetchChartImagesResponse>(webAppUrl, target, { action: 'fetchChartImages', charts })
}

/** משיכת כל הנתונים (GET) מה-Web App, מהגיליון של היעד בלבד */
export async function fetchData(webAppUrl: string, target: SheetTarget): Promise<GetDataResponse> {
  if (!webAppUrl) throw new Error('לא הוגדרה כתובת Web App. עבור להגדרות והזן כתובת.')
  const t = assertValidTarget(target)

  const url = new URL(webAppUrl)
  url.searchParams.set('mode', t.mode)
  url.searchParams.set('sheetId', t.sheetId)
  const res = await fetch(url.toString(), { method: 'GET' })
  if (!res.ok) {
    throw new Error(`שגיאה במשיכת נתונים מהשרת (${res.status})`)
  }
  const data = await res.json()
  if (data && data.status === 'error') {
    throw new Error(data.message || 'השרת החזיר שגיאה')
  }
  // השרת חייב להחזיר במפורש את הגיליון שממנו קרא. שרת ישן (שלא מכיר מצב דמו) לא מחזיר —
  // ואז אסור להציג את הנתונים, כי הם מהגיליון האמיתי ולא מזה שביקשנו
  if (data?.sheetId !== t.sheetId || data?.mode !== t.mode) {
    verifiedTargets.delete(targetKey(webAppUrl, t))
    throw new SheetGuardError(
      'השרת לא אישר שהנתונים הגיעו מהגיליון המבוקש (ייתכן שהסקריפט עוד לא עודכן לגרסה שתומכת במצב דמו). לא מוצג ולא נכתב כלום.',
    )
  }
  verifiedTargets.add(targetKey(webAppUrl, t))
  return {
    trades: data.trades ?? [],
    executions: data.executions ?? [],
    watchlist: data.watchlist ?? [],
    notes: data.notes ?? { generalNotes: '', tradingRules: '' },
    settings: data.settings ?? {
      initialCapital: null,
      defaultAccountBalance: null,
      defaultRiskAmount: null,
      commissionPerAction: null,
    },
  }
}

/** בדיקת חיבור פשוטה */
export async function testConnection(webAppUrl: string, target: SheetTarget): Promise<boolean> {
  try {
    await fetchData(webAppUrl, target)
    return true
  } catch {
    return false
  }
}

export interface QuotesResponse {
  quotes: Record<string, Omit<import('@/lib/livePrice').LiveQuote, 'fetchedAt'>>
  errors: Record<string, string>
  fetchedAt: string
}

/**
 * מחירים עדכניים לסימולים (קריאה בלבד). השרת לא נוגע באף גיליון בבקשה הזו, והמחירים
 * מוצגים באפליקציה בלבד — לא נכתבים לגיליון.
 */
export async function fetchQuotes(webAppUrl: string, target: SheetTarget, symbols: string[]): Promise<QuotesResponse> {
  if (!webAppUrl) throw new Error('לא הוגדרה כתובת Web App.')
  const t = assertValidTarget(target)
  const url = new URL(webAppUrl)
  url.searchParams.set('mode', t.mode)
  url.searchParams.set('sheetId', t.sheetId)
  url.searchParams.set('scope', 'quotes')
  url.searchParams.set('symbols', symbols.join(','))
  const res = await fetch(url.toString(), { method: 'GET' })
  if (!res.ok) throw new Error(`שגיאה במשיכת מחירים (${res.status})`)
  const data = await res.json()
  if (data?.status === 'error') throw new Error(data.message || 'שגיאה במשיכת מחירים')
  if (!data || typeof data.quotes !== 'object') {
    throw new Error('השרת לא מחזיר מחירים חיים (ייתכן שהסקריפט עוד לא עודכן לגרסה האחרונה)')
  }
  return { quotes: data.quotes ?? {}, errors: data.errors ?? {}, fetchedAt: data.fetchedAt ?? new Date().toISOString() }
}
