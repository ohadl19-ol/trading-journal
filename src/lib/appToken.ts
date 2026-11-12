/**
 * קוד הגישה לשרת (Apps Script). נשמר רק בדפדפן הזה, משותף לחשבון האמיתי ולדמו,
 * ונשלח בגוף בקשת POST — לא בכתובת, כדי שלא יישאר ביומנים או בהיסטוריה.
 */
const KEY = 'tj_app_token'

export function loadAppToken(): string {
  try {
    return localStorage.getItem(KEY) ?? ''
  } catch {
    return ''
  }
}

export function saveAppToken(token: string) {
  try {
    const t = token.trim()
    if (t) localStorage.setItem(KEY, t)
    else localStorage.removeItem(KEY)
  } catch {
    // אין גישה לאחסון — הקוד לא יישמר
  }
}
