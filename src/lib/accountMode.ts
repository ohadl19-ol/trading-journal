/**
 * מצב חשבון: "אמיתי" מול "דמו".
 * ------------------------------------------------------------
 * כל המצבים עובדים מול אותו Web App, אבל כל בקשה נושאת במפורש את mode ואת sheetId,
 * והשרת פותח רק את הגיליון שתואם להם. אין כאן (וגם לא בשרת) שום נפילה אוטומטית
 * לגיליון השני: אם משהו חסר או לא תקין — זורקים שגיאה לפני שיוצאת בקשה כלשהי.
 */

export type AccountMode = 'real' | 'demo'

export const SHEET_IDS: Record<AccountMode, string> = {
  real: '1szzRyKfEZ-4CCgyWsr4NDzLJK_G-kDVpzB62EwYvA30',
  demo: '1GEaDNScc-dqNFi4YyuuB16juPBE-y3XXon1Wq7MpPBs',
}

export const DEMO_TAG = 'דמו'
export const DEMO_DEFAULT_INITIAL_CAPITAL = 3000

export const MODE_LABEL: Record<AccountMode, string> = {
  real: 'חשבון אמיתי',
  demo: 'חשבון דמו',
}

export interface SheetTarget {
  mode: AccountMode
  sheetId: string
}

export class SheetGuardError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SheetGuardError'
  }
}

/**
 * מחזיר את היעד (mode + sheetId) למצב הנתון, אחרי בדיקת תקינות של שני המזהים.
 * זורק SheetGuardError אם מזהה חסר או ששני המזהים זהים.
 */
export function resolveSheetTarget(mode: AccountMode, ids: Record<AccountMode, string> = SHEET_IDS): SheetTarget {
  if (mode !== 'real' && mode !== 'demo') {
    throw new SheetGuardError('מצב חשבון לא מוכר. לא בוצעה שום פעולה.')
  }
  const real = (ids.real ?? '').trim()
  const demo = (ids.demo ?? '').trim()
  if (!real) throw new SheetGuardError('מזהה הגיליון האמיתי חסר. האפליקציה לא תקרא ולא תכתוב כלום.')
  if (!demo) throw new SheetGuardError('מזהה גיליון הדמו חסר. האפליקציה לא תקרא ולא תכתוב כלום.')
  if (real === demo) {
    throw new SheetGuardError('מזהה הגיליון האמיתי ומזהה גיליון הדמו זהים. האפליקציה לא תקרא ולא תכתוב כלום.')
  }
  return { mode, sheetId: mode === 'real' ? real : demo }
}

/**
 * בדיקה לפני כל שליחה: היעד חייב להיות בדיוק אחד משני היעדים הידועים (mode תואם ל-sheetId).
 * מגן גם מפני יעד "מפוברק" או כזה שנבנה ממצב אחד ונשלח עם מזהה של המצב השני.
 */
export function assertValidTarget(target: SheetTarget | null | undefined, ids: Record<AccountMode, string> = SHEET_IDS): SheetTarget {
  if (!target) throw new SheetGuardError('לא נבחר גיליון. לא בוצעה שום פעולה.')
  const expected = resolveSheetTarget(target.mode, ids)
  if (!target.sheetId) throw new SheetGuardError('חסר מזהה גיליון. לא בוצעה שום פעולה.')
  if (target.sheetId !== expected.sheetId) {
    throw new SheetGuardError(`מזהה הגיליון לא תואם ל${MODE_LABEL[target.mode]}. הפעולה נחסמה.`)
  }
  return expected
}

export function hasDemoTag(tags: unknown): boolean {
  if (tags === undefined || tags === null) return false
  const list = Array.isArray(tags) ? tags : String(tags).split(',')
  return list.some((t) => String(t).trim() === DEMO_TAG)
}

// ==== שמירת הבחירה בדפדפן ====

const MODE_KEY = 'tj_account_mode'

export function loadAccountMode(): AccountMode {
  try {
    return localStorage.getItem(MODE_KEY) === 'demo' ? 'demo' : 'real'
  } catch {
    return 'real'
  }
}

export function saveAccountMode(mode: AccountMode) {
  try {
    localStorage.setItem(MODE_KEY, mode)
  } catch {
    // אין גישה לאחסון — הבחירה פשוט לא תישמר בין רענונים
  }
}

/** מפתח localStorage לפי מצב: היומן האמיתי שומר על המפתחות הקיימים, הדמו מקבל קידומת */
export function storageKeyFor(mode: AccountMode, baseKey: string): string {
  return mode === 'demo' ? baseKey.replace(/^tj_/, 'tj_demo_') : baseKey
}
