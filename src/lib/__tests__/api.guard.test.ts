/**
 * הגנות צד-לקוח: אין כתיבה של עסקת דמו לגיליון האמיתי, ואין מעבר אוטומטי מגיליון לגיליון.
 * כל הרשת מדומה (fetch mock) — הבדיקות לא נוגעות באף גיליון אמיתי.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { __resetVerifiedTargets, fetchData, fetchQuotes, postAction } from '@/lib/api'
import { saveAppToken } from '@/lib/appToken'
import { assertValidTarget, resolveSheetTarget, SHEET_IDS, SheetGuardError } from '@/lib/accountMode'

const URL_ = 'https://script.google.com/macros/s/TEST/exec'
const REAL = SHEET_IDS.real
const DEMO = SHEET_IDS.demo

type Call = { url: string; method: string; body: Record<string, unknown> | null }
let calls: Call[]
/** מה השרת המדומה מחזיר ל-GET: כברירת מחדל — שרת תקין שמחזיר את מה שביקשו */
let serverEcho: (mode: string | null, sheetId: string | null) => Record<string, unknown>

function okJson(data: unknown) {
  return { ok: true, status: 200, json: async () => data } as Response
}

beforeEach(() => {
  __resetVerifiedTargets()
  calls = []
  serverEcho = (mode, sheetId) => ({ mode, sheetId, trades: [], executions: [], watchlist: [] })
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      const body = init?.body ? JSON.parse(String(init.body)) : null
      calls.push({ url: input, method, body })
      // שרת מדומה: getData מחזיר את מה ש-serverEcho מחליט; שגיאה מוחזרת כמו שהיא
      if (body?.action === 'getData') {
        const echo = serverEcho((body.mode as string) ?? null, (body.sheetId as string) ?? null)
        return okJson(echo.status === 'error' ? echo : { status: 'ok', result: echo })
      }
      return okJson({ status: 'ok', result: {} })
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const allSentSheetIds = () => calls.map((c) => (c.body?.sheetId as string | undefined) ?? new URL(c.url).searchParams.get('sheetId'))

describe('אין כתיבה של עסקת דמו לגיליון האמיתי', () => {
  it('במצב דמו, קריאה וכתיבה נשלחות עם מזהה גיליון הדמו בלבד', async () => {
    const demo = resolveSheetTarget('demo')
    await fetchData(URL_, demo)
    await postAction(URL_, demo, { action: 'update', tradeId: 'T-1', tags: ['דמו'] })

    expect(calls).toHaveLength(2)
    expect(allSentSheetIds()).toEqual([DEMO, DEMO])
    expect(calls[1].body).toMatchObject({ mode: 'demo', sheetId: DEMO })
    expect(allSentSheetIds()).not.toContain(REAL)
  })

  it('כתיבה עם תגית "דמו" במצב אמיתי נחסמת לפני שליחה', async () => {
    const real = resolveSheetTarget('real')
    await fetchData(URL_, real)
    calls = []
    await expect(postAction(URL_, real, { action: 'update', tradeId: 'T-1', tags: ['סווינג', 'דמו'] })).rejects.toThrow(
      SheetGuardError,
    )
    // גם כשהתגיות מגיעות כמחרוזת אחת
    await expect(postAction(URL_, real, { action: 'update', tradeId: 'T-1', tags: 'סווינג, דמו' })).rejects.toThrow(
      SheetGuardError,
    )
    expect(calls).toHaveLength(0)
  })

  it('יעד "מפוברק" (מצב דמו עם המזהה האמיתי, או ההפך) נחסם', async () => {
    await expect(postAction(URL_, { mode: 'demo', sheetId: REAL }, { action: 'delete', tradeId: 'T-1' })).rejects.toThrow(
      SheetGuardError,
    )
    await expect(postAction(URL_, { mode: 'real', sheetId: DEMO }, { action: 'delete', tradeId: 'T-1' })).rejects.toThrow(
      SheetGuardError,
    )
    await expect(fetchData(URL_, { mode: 'demo', sheetId: REAL })).rejects.toThrow(SheetGuardError)
    expect(calls).toHaveLength(0)
  })

  it('שרת ישן שמתעלם מ-sheetId: הנתונים לא מוצגים והכתיבה במצב דמו נחסמת', async () => {
    // שרת שלא מכיר מצב דמו מחזיר תמיד את היומן האמיתי, בלי mode/sheetId
    serverEcho = () => ({ trades: [{ tradeId: 'T-REAL' }], executions: [] })
    const demo = resolveSheetTarget('demo')

    await expect(fetchData(URL_, demo)).rejects.toThrow(SheetGuardError)
    await expect(postAction(URL_, demo, { action: 'open', tradeId: 'T-2', symbol: 'VTRS' })).rejects.toThrow(
      SheetGuardError,
    )
    // רק הקריאה יצאה; שום פעולת כתיבה לא נשלחה
    expect(calls.map((c) => c.body?.action)).toEqual(['getData'])
  })

  it('שרת שמחזיר את הגיליון האמיתי כשביקשו דמו — נדחה', async () => {
    serverEcho = () => ({ mode: 'real', sheetId: REAL, trades: [] })
    await expect(fetchData(URL_, resolveSheetTarget('demo'))).rejects.toThrow(SheetGuardError)
  })

  it('כתיבה לפני שהשרת אישר את הגיליון — נחסמת', async () => {
    await expect(
      postAction(URL_, resolveSheetTarget('demo'), { action: 'open', tradeId: 'T-3', symbol: 'VTRS' }),
    ).rejects.toThrow(SheetGuardError)
    expect(calls).toHaveLength(0)
  })
})

describe('אין מעבר אוטומטי מגיליון אחד לשני', () => {
  it('כשקריאת הדמו נכשלת — אין ניסיון חוזר מול הגיליון האמיתי', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        calls.push({ url: input, method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : null })
        throw new TypeError('network down')
      }),
    )
    await expect(fetchData(URL_, resolveSheetTarget('demo'))).rejects.toThrow()
    expect(calls).toHaveLength(1)
    expect(allSentSheetIds()).toEqual([DEMO])
  })

  it('כשהשרת מחזיר שגיאה לדמו — אין נפילה לאמיתי', async () => {
    serverEcho = () => ({ status: 'error', message: 'גיליון הדמו לא נגיש' })
    await expect(fetchData(URL_, resolveSheetTarget('demo'))).rejects.toThrow('גיליון הדמו לא נגיש')
    expect(allSentSheetIds()).toEqual([DEMO])
  })

  it('אישור של גיליון הדמו לא מאשר כתיבה לגיליון האמיתי (ולהפך)', async () => {
    await fetchData(URL_, resolveSheetTarget('demo'))
    await expect(postAction(URL_, resolveSheetTarget('real'), { action: 'delete', tradeId: 'T-1' })).rejects.toThrow(
      SheetGuardError,
    )
    __resetVerifiedTargets()
    await fetchData(URL_, resolveSheetTarget('real'))
    await expect(postAction(URL_, resolveSheetTarget('demo'), { action: 'delete', tradeId: 'T-1' })).rejects.toThrow(
      SheetGuardError,
    )
    expect(calls.filter((c) => c.body?.action === 'delete')).toHaveLength(0)
  })
})

describe('תקינות המזהים', () => {
  it('מזהה חסר — שגיאה ברורה, בלי לבחור את הגיליון השני', () => {
    expect(() => resolveSheetTarget('demo', { real: REAL, demo: '' })).toThrow(/מזהה גיליון הדמו חסר/)
    expect(() => resolveSheetTarget('real', { real: REAL, demo: '' })).toThrow(/מזהה גיליון הדמו חסר/)
    expect(() => resolveSheetTarget('real', { real: '  ', demo: DEMO })).toThrow(/מזהה הגיליון האמיתי חסר/)
  })

  it('שני מזהים זהים — שגיאה', () => {
    expect(() => resolveSheetTarget('demo', { real: DEMO, demo: DEMO })).toThrow(/זהים/)
    expect(() => assertValidTarget({ mode: 'real', sheetId: REAL }, { real: REAL, demo: REAL })).toThrow(/זהים/)
  })

  it('המזהים המוגדרים באפליקציה שונים זה מזה ותואמים לשרת', async () => {
    expect(REAL).not.toBe(DEMO)
    const { readFileSync } = await import('node:fs')
    const gs = readFileSync(new URL('../../../google-apps-script.gs', import.meta.url), 'utf8')
    expect(gs).toContain(`real: '${REAL}'`)
    expect(gs).toContain(`demo: '${DEMO}'`)
  })
})

describe('קוד גישה', () => {
  const store = new Map<string, string>()
  beforeEach(() => {
    store.clear()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    })
  })

  it('נשלח בגוף בקשת POST בכל קריאה וכתיבה — ואף פעם לא בכתובת', async () => {
    saveAppToken('secret-token-123')
    const demo = resolveSheetTarget('demo')
    await fetchData(URL_, demo)
    await postAction(URL_, demo, { action: 'saveNotes', generalNotes: 'x' })
    await fetchQuotes(URL_, demo, ['VTRS']).catch(() => {})
    expect(calls.length).toBe(3)
    for (const c of calls) {
      expect(c.method).toBe('POST')
      expect(c.body?.token).toBe('secret-token-123')
      expect(c.url).not.toContain('secret-token-123')
      expect(c.url).toBe(URL_)
    }
  })

  it('בלי קוד שמור — לא נשלח שדה token בכלל', async () => {
    await fetchData(URL_, resolveSheetTarget('demo'))
    expect(calls[0].body && 'token' in calls[0].body).toBe(false)
  })

  it('שגיאת קוד מהשרת מוצגת כמו שהיא, בלי ניסיון חוזר ובלי מעבר לגיליון אחר', async () => {
    serverEcho = () => ({ status: 'error', message: 'קוד הגישה שגוי. לא בוצעה שום פעולה.' })
    await expect(fetchData(URL_, resolveSheetTarget('real'))).rejects.toThrow('קוד הגישה שגוי')
    expect(calls).toHaveLength(1)
  })
})
