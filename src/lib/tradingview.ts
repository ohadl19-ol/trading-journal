const LAYOUT_KEY = 'tj_tv_layout'

/**
 * מזהה פריסת גרף שמורה ב-TradingView (החלק שאחרי /chart/ בכתובת, למשל "AbCd1234").
 * כשמוגדר — הקישור פותח את הפריסה של המשתמש (אינדיקטורים, טווחי זמן, ציורים) עם הסימול.
 * מקבל גם כתובת מלאה ומחלץ ממנה את המזהה.
 */
export function parseTradingViewLayoutId(input: string): string {
  const s = input.trim()
  if (!s) return ''
  const m = /tradingview\.com\/chart\/([A-Za-z0-9]+)/.exec(s)
  if (m) return m[1]
  return /^[A-Za-z0-9]+$/.test(s) ? s : ''
}

export function loadTradingViewLayoutId(): string {
  try {
    return localStorage.getItem(LAYOUT_KEY) ?? ''
  } catch {
    return ''
  }
}

export function saveTradingViewLayoutId(id: string) {
  try {
    if (id) localStorage.setItem(LAYOUT_KEY, id)
    else localStorage.removeItem(LAYOUT_KEY)
  } catch {
    // אין גישה לאחסון — הקישור פשוט ייפתח בלי פריסה שמורה
  }
}

/** קישור לגרף החי של הסימול במסך הגרפים של TradingView (Supercharts), בפריסה השמורה אם הוגדרה */
export function tradingViewSymbolUrl(symbol: string): string {
  const sym = encodeURIComponent(symbol.trim().toUpperCase())
  const layout = loadTradingViewLayoutId()
  return `https://www.tradingview.com/chart/${layout ? `${layout}/` : ''}?symbol=${sym}`
}

/** סימולים ייחודיים, בסדר הופעה */
export function uniqueSymbols(symbols: string[]): string[] {
  return Array.from(new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean)))
}

/**
 * קובץ רשימת מעקב לייבוא ב-TradingView ("Import list"): שורה אחת, סימולים מופרדים בפסיק,
 * עם כותרת מקטע בתחילתה כדי שהרשימה תהיה מסודרת.
 */
export function tradingViewWatchlistFile(sectionTitle: string, symbols: string[]): string {
  return [`###${sectionTitle}`, ...uniqueSymbols(symbols)].join(',')
}
