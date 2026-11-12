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

/**
 * קישור הגדרה למכשיר נוסף: כתובת האפליקציה עם הקוד בחלק שאחרי # (fragment).
 * החלק הזה לא נשלח לאף שרת (גם לא ל-GitHub Pages) — הדפדפן קורא אותו מקומית.
 */
export function buildSetupLink(appUrl: string, token: string, webAppUrl: string): string {
  const params = new URLSearchParams({ setup: token.trim(), server: webAppUrl.trim() })
  return `${appUrl.split('#')[0]}#${params.toString()}`
}

/**
 * בפתיחת האפליקציה: אם הכתובת מכילה קישור הגדרה — שומרים את הקוד (וכתובת השרת, אם חסרה)
 * ומוחקים אותו מיד מהכתובת, כדי שלא יישאר בשורת הכתובת או בהיסטוריה.
 * מחזיר true אם נקלט קוד.
 */
export function consumeSetupLink(loc: Pick<Location, 'hash' | 'pathname' | 'search'> = window.location): boolean {
  if (!loc.hash || !loc.hash.includes('setup=')) return false
  const params = new URLSearchParams(loc.hash.slice(1))
  const token = params.get('setup')?.trim()
  const server = params.get('server')?.trim()
  try {
    window.history.replaceState(null, '', loc.pathname + loc.search)
  } catch {
    // לא קריטי
  }
  if (!token) return false
  saveAppToken(token)
  if (server && /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(server)) {
    try {
      const raw = localStorage.getItem('tj_settings')
      const settings = raw ? JSON.parse(raw) : {}
      if (!settings.webAppUrl) localStorage.setItem('tj_settings', JSON.stringify({ ...settings, webAppUrl: server }))
    } catch {
      // לא קריטי — אפשר להזין כתובת ידנית
    }
  }
  return true
}
