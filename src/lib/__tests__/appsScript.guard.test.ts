/**
 * הגנות צד-שרת: קוד ה-Apps Script עצמו (google-apps-script.gs) נטען לסביבה מבודדת (node:vm)
 * עם SpreadsheetApp מדומה. בודקים איזה גיליון נפתח בכל בקשה — בלי לגעת באף גיליון אמיתי.
 */
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { beforeEach, describe, expect, it } from 'vitest'

const SOURCE = readFileSync(new URL('../../../google-apps-script.gs', import.meta.url), 'utf8')
const REAL = '1szzRyKfEZ-4CCgyWsr4NDzLJK_G-kDVpzB62EwYvA30'
const DEMO = '1GEaDNScc-dqNFi4YyuuB16juPBE-y3XXon1Wq7MpPBs'

/** אובייקט "גיליון" גנרי: כל מתודה מחזירה אותו, מלבד כמה שמחזירות ערכים */
function fakeSheet(log: string[], id: string): unknown {
  const handler: ProxyHandler<object> = {
    get(_t, prop) {
      if (prop === 'getLastRow') return () => 1
      if (prop === 'getLastColumn') return () => 36
      if (prop === 'getValues') return () => [[]]
      if (prop === 'getValue') return () => ''
      if (prop === 'getId') return () => id
      if (prop === 'appendRow' || prop === 'setValues' || prop === 'setValue' || prop === 'deleteRow') {
        return () => {
          log.push(`write:${id}`)
          return proxy
        }
      }
      return () => proxy
    },
  }
  const proxy: unknown = new Proxy({}, handler)
  return proxy
}

let opened: string[]
let writes: string[]
let props: Map<string, string>

function load(overrideIds?: { real: string; demo: string }) {
  opened = []
  writes = []
  props = new Map()
  const ctx: Record<string, unknown> = {
    SpreadsheetApp: {
      openById: (id: string) => {
        opened.push(id)
        return fakeSheet(writes, id)
      },
      getActiveSpreadsheet: () => {
        throw new Error('getActiveSpreadsheet must never be used')
      },
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k: string) => (props.has(k) ? props.get(k)! : null),
        setProperty: (k: string, v: string) => void props.set(k, v),
      }),
    },
    CacheService: { getScriptCache: () => ({ get: () => null, put: () => {} }) },
    ContentService: {
      MimeType: { JSON: 'json', JAVASCRIPT: 'js' },
      createTextOutput: (text: string) => ({ text, setMimeType() { return this } }),
    },
    Utilities: { getUuid: () => 'uuid-1234-5678' },
    MailApp: { sendEmail: () => {} },
    Session: { getActiveUser: () => ({ getEmail: () => 'x@example.com' }) },
    UrlFetchApp: { fetch: () => { throw new Error('no network in tests') } },
    console,
  }
  vm.createContext(ctx)
  vm.runInContext(SOURCE, ctx)
  if (overrideIds) vm.runInContext(`SHEET_IDS_ = ${JSON.stringify(overrideIds)};`, ctx)
  const post = (body: Record<string, unknown>) =>
    JSON.parse((ctx.doPost as (e: unknown) => { text: string })({ postData: { contents: JSON.stringify(body) } }).text)
  const get = (parameter: Record<string, string>) =>
    JSON.parse((ctx.doGet as (e: unknown) => { text: string })({ parameter }).text)
  return { post, get }
}

describe('שרת: אין כתיבה של עסקת דמו לגיליון האמיתי', () => {
  let api: ReturnType<typeof load>
  beforeEach(() => {
    api = load()
  })

  it('בקשה במצב דמו פותחת וכותבת רק לגיליון הדמו', () => {
    const res = api.post({ action: 'saveNotes', mode: 'demo', sheetId: DEMO, generalNotes: 'x', tradingRules: 'y' })
    expect(res.status).toBe('ok')
    expect(opened.length).toBeGreaterThan(0)
    expect(new Set(opened)).toEqual(new Set([DEMO]))
    expect(writes.every((w) => w === `write:${DEMO}`)).toBe(true)
  })

  it('תגית "דמו" בכתיבה ליומן האמיתי — נחסמת, ושום גיליון לא נפתח', () => {
    const res = api.post({ action: 'update', mode: 'real', sheetId: REAL, tradeId: 'T-1', tags: ['סווינג', 'דמו'] })
    expect(res.status).toBe('error')
    expect(res.message).toMatch(/דמו/)
    expect(opened).toEqual([])
  })

  it('מצב דמו עם המזהה האמיתי — נחסם', () => {
    const res = api.post({ action: 'open', mode: 'demo', sheetId: REAL, symbol: 'VTRS' })
    expect(res.status).toBe('error')
    expect(opened).toEqual([])
  })

  it('מצב אמיתי עם מזהה הדמו — נחסם', () => {
    const res = api.post({ action: 'open', mode: 'real', sheetId: DEMO, symbol: 'VTRS' })
    expect(res.status).toBe('error')
    expect(opened).toEqual([])
  })

  it('הגדרות הדמו נשמרות בנפרד ולא דורסות את הון החשבון האמיתי', () => {
    props.set('initialCapital', '4455')
    const res = api.post({ action: 'updateSettings', mode: 'demo', sheetId: DEMO, initialCapital: 3000 })
    expect(res.status).toBe('ok')
    expect(props.get('initialCapital')).toBe('4455')
    expect(props.get('demo_initialCapital')).toBe('3000')
  })
})

describe('שרת: אין מעבר אוטומטי מגיליון לגיליון', () => {
  let api: ReturnType<typeof load>
  beforeEach(() => {
    api = load()
  })

  it('POST בלי מזהה גיליון — שגיאה, ושום גיליון לא נפתח (לא "הגיליון הפעיל")', () => {
    const res = api.post({ action: 'open', symbol: 'VTRS' })
    expect(res.status).toBe('error')
    expect(opened).toEqual([])
  })

  it('POST עם mode בלי sheetId — שגיאה', () => {
    expect(api.post({ action: 'open', mode: 'demo', symbol: 'VTRS' }).status).toBe('error')
    expect(opened).toEqual([])
  })

  it('GET מלא של האפליקציה בלי מזהה — שגיאה, לא נפילה ליומן האמיתי', () => {
    const res = api.get({})
    expect(res.status).toBe('error')
    expect(opened).toEqual([])
  })

  it('GET במצב דמו קורא רק מגיליון הדמו ומחזיר את המזהה שלו', () => {
    const res = api.get({ mode: 'demo', sheetId: DEMO })
    expect(res.mode).toBe('demo')
    expect(res.sheetId).toBe(DEMO)
    expect(new Set(opened)).toEqual(new Set([DEMO]))
  })

  it('מזהה גיליון לא מוכר — נחסם', () => {
    expect(api.post({ action: 'open', mode: 'demo', sheetId: 'some-other-sheet' }).status).toBe('error')
    expect(opened).toEqual([])
  })
})

describe('שרת: הגדרת מזהים שגויה', () => {
  it('שני מזהים זהים — שום בקשה לא מתבצעת', () => {
    const api = load({ real: DEMO, demo: DEMO })
    const res = api.post({ action: 'saveNotes', mode: 'demo', sheetId: DEMO, generalNotes: 'x' })
    expect(res.status).toBe('error')
    expect(res.message).toMatch(/זהים/)
    expect(opened).toEqual([])
  })

  it('מזהה חסר — שום בקשה לא מתבצעת', () => {
    const api = load({ real: REAL, demo: '' })
    expect(api.post({ action: 'saveNotes', mode: 'real', sheetId: REAL }).status).toBe('error')
    expect(api.get({ mode: 'real', sheetId: REAL }).status).toBe('error')
    expect(opened).toEqual([])
  })
})
