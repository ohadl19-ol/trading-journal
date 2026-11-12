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
      if (prop === 'getA1Notation') return () => 'C2'
      if (prop === 'setFormula') {
        return () => {
          log.push(`formula:${id}`)
          return proxy
        }
      }
      if (prop === 'appendRow' || prop === 'setValues' || prop === 'setValue' || prop === 'deleteRow') {
        return (...args: unknown[]) => {
          log.push(`write:${id}`)
          if (prop === 'appendRow') appended.push(JSON.stringify(args))
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
let appended: string[]
let mails: number
let triggers: string[]
/** שעה מדומה בניו יורק לבדיקות שעות המסחר: [יום בשבוע 1=שני..7=ראשון, שעה, דקה] */
let nyClock: [number, number, number]
let fetchedUrls: string[]
/** מה ש-Twelve Data המדומה מחזיר */
let quoteResponse: unknown

function load(overrideIds?: { real: string; demo: string }) {
  opened = []
  writes = []
  props = new Map()
  fetchedUrls = []
  appended = []
  mails = 0
  triggers = []
  nyClock = [2, 11, 0]
  const cacheStore = new Map<string, string>()
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
    CacheService: {
      getScriptCache: () => ({
        get: (k: string) => cacheStore.get(k) ?? null,
        put: (k: string, v: string) => void cacheStore.set(k, v),
      }),
    },
    ContentService: {
      MimeType: { JSON: 'json', JAVASCRIPT: 'js' },
      createTextOutput: (text: string) => ({ text, setMimeType() { return this } }),
    },
    Utilities: {
      getUuid: () => 'uuid-1234-5678',
      base64Encode: () => '',
      formatDate: (_d: Date, _tz: string, fmt: string) =>
        String(fmt === 'u' ? nyClock[0] : fmt === 'HH' ? nyClock[1] : nyClock[2]),
    },
    MailApp: { sendEmail: () => void (mails += 1) },
    ScriptApp: {
      getProjectTriggers: () => triggers.map((h) => ({ getHandlerFunction: () => h })),
      deleteTrigger: (t: { getHandlerFunction: () => string }) => {
        triggers = triggers.filter((h) => h !== t.getHandlerFunction())
      },
      newTrigger: (h: string) => {
        const b = { timeBased: () => b, everyMinutes: () => b, create: () => void triggers.push(h) }
        return b
      },
    },
    Session: { getActiveUser: () => ({ getEmail: () => 'x@example.com' }) },
    UrlFetchApp: {
      fetch: (url: string) => {
        fetchedUrls.push(url)
        return { getContentText: () => JSON.stringify(quoteResponse) }
      },
    },
    console,
  }
  vm.createContext(ctx)
  vm.runInContext(SOURCE, ctx)
  if (overrideIds) vm.runInContext(`SHEET_IDS_ = ${JSON.stringify(overrideIds)};`, ctx)
  const post = (body: Record<string, unknown>) =>
    JSON.parse((ctx.doPost as (e: unknown) => { text: string })({ postData: { contents: JSON.stringify(body) } }).text)
  const get = (parameter: Record<string, string>) =>
    JSON.parse((ctx.doGet as (e: unknown) => { text: string })({ parameter }).text)
  const run = (fn: string) => (ctx[fn] as () => unknown)()
  return { post, get, run, ctx }
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

describe('שרת: מחירים חיים ועמודת "מחיר נוכחי"', () => {
  it('scope=quotes לא פותח ולא כותב לשום גיליון, ומשתמש במטמון', () => {
    const api = load()
    props.set('twelveDataApiKey', 'k')
    quoteResponse = {
      VTRS: { symbol: 'VTRS', close: '20.49', previous_close: '20.20', timestamp: 1794326400, is_market_open: true },
      AAPL: { symbol: 'AAPL', close: '230.10', previous_close: '228.00', timestamp: 1794326400, is_market_open: true },
    }
    const res = api.get({ mode: 'demo', sheetId: DEMO, scope: 'quotes', symbols: 'VTRS,aapl,VTRS' })
    expect(res.quotes.VTRS.price).toBe(20.49)
    expect(res.quotes.VTRS.previousClose).toBe(20.2)
    expect(res.quotes.AAPL.price).toBe(230.1)
    expect(opened).toEqual([])
    expect(writes).toEqual([])
    expect(fetchedUrls).toHaveLength(1)

    // קריאה שנייה — מהמטמון, בלי לפנות שוב לספק
    api.get({ mode: 'demo', sheetId: DEMO, scope: 'quotes', symbols: 'VTRS' })
    expect(fetchedUrls).toHaveLength(1)
  })

  it('סימול שנכשל מדווח כשגיאה ולא מפיל את השאר', () => {
    const api = load()
    props.set('twelveDataApiKey', 'k')
    quoteResponse = { VTRS: { close: '20.49', previous_close: '20.2', timestamp: 1 }, ZZZZ: { status: 'error', message: 'not found' } }
    const res = api.get({ mode: 'real', sheetId: REAL, scope: 'quotes', symbols: 'VTRS,ZZZZ' })
    expect(res.quotes.VTRS.price).toBe(20.49)
    expect(res.errors.ZZZZ).toBe('not found')
  })

  it('פתיחת עסקה בדמו לא כותבת נוסחת GOOGLEFINANCE לעמודה AC', () => {
    const api = load()
    const res = api.post({ action: 'open', mode: 'demo', sheetId: DEMO, symbol: 'VTRS', entryPrice: 20, stopLoss: 19, shares: 1, riskAmount: 1 })
    expect(res.status).toBe('ok')
    expect(writes).not.toContain(`formula:${DEMO}`)
  })

  it('ביקורת: ביומן האמיתי הנוסחה כן נכתבת (כמו קודם) — כלומר הבדיקה שלמעלה באמת בודקת משהו', () => {
    const api = load()
    api.post({ action: 'open', mode: 'real', sheetId: REAL, symbol: 'VTRS', entryPrice: 20, stopLoss: 19, shares: 1, riskAmount: 1 })
    expect(writes).toContain(`formula:${REAL}`)
  })

})

// ==================== אבטחה: קוד גישה ====================
const TOKEN = 'test-token-0123456789abcdef0123456789abcdef'

describe('שרת: קוד גישה (מצב סופי — REQUIRE_TOKEN=true)', () => {
  let api: ReturnType<typeof load>
  beforeEach(() => {
    api = load()
    props.set('APP_TOKEN', TOKEN)
    props.set('REQUIRE_TOKEN', 'true')
  })

  it('POST בלי קוד — נדחה לפני כל גישה לגיליון, בלי כתיבה ובלי מייל', () => {
    const res = api.post({ action: 'delete', mode: 'real', sheetId: REAL, tradeId: 'T-1' })
    expect(res.status).toBe('error')
    expect(res.message).toMatch(/קוד גישה/)
    expect(opened).toEqual([])
    expect(writes).toEqual([])
    expect(mails).toBe(0)
  })

  it('POST עם קוד שגוי — נדחה', () => {
    const res = api.post({ action: 'getData', mode: 'real', sheetId: REAL, token: TOKEN.slice(0, -1) + 'x' })
    expect(res.status).toBe('error')
    expect(opened).toEqual([])
  })

  it('POST עם הקוד הנכון — עובד, ומחזיר את הגיליון שממנו קרא', () => {
    const res = api.post({ action: 'getData', mode: 'demo', sheetId: DEMO, token: TOKEN })
    expect(res.status).toBe('ok')
    expect(res.result.mode).toBe('demo')
    expect(res.result.sheetId).toBe(DEMO)
    expect(new Set(opened)).toEqual(new Set([DEMO]))
  })

  it('GET בלי קוד — נדחה (גם עם mode ו-sheetId, וגם scope)', () => {
    expect(api.get({ mode: 'real', sheetId: REAL }).status).toBe('error')
    expect(api.get({ scope: 'summary' }).status).toBe('error')
    expect(api.get({ mode: 'demo', sheetId: DEMO, scope: 'quotes', symbols: 'VTRS' }).status).toBe('error')
    expect(opened).toEqual([])
    expect(fetchedUrls).toEqual([])
  })

  it('קוד חובה אבל לא הוגדר בשרת — הכול נדחה (נכשל "סגור")', () => {
    props.delete('APP_TOKEN')
    expect(api.post({ action: 'getData', mode: 'real', sheetId: REAL, token: 'anything' }).status).toBe('error')
    expect(api.post({ action: 'getData', mode: 'real', sheetId: REAL }).status).toBe('error')
    expect(opened).toEqual([])
  })

  it('יומן השינויים לא שומר את קוד הגישה', () => {
    const res = api.post({ action: 'saveNotes', mode: 'demo', sheetId: DEMO, token: TOKEN, generalNotes: 'x', tradingRules: 'y' })
    expect(res.status).toBe('ok')
    expect(appended.length).toBeGreaterThan(0)
    expect(appended.join('\n')).not.toContain(TOKEN)
  })
})

describe('שרת: תקופת מעבר (REQUIRE_TOKEN לא מוגדר)', () => {
  it('בלי קוד — עדיין מתקבל (כדי שהגרסה הקודמת של האתר לא תישבר), קוד שגוי — נדחה', () => {
    const api = load()
    props.set('APP_TOKEN', TOKEN)
    expect(api.post({ action: 'getData', mode: 'demo', sheetId: DEMO }).status).toBe('ok')
    expect(api.get({ mode: 'demo', sheetId: DEMO }).sheetId).toBe(DEMO)
    expect(api.post({ action: 'getData', mode: 'demo', sheetId: DEMO, token: 'wrong' }).status).toBe('error')
  })
})

describe('שרת: דלתות אחוריות סגורות', () => {
  let api: ReturnType<typeof load>
  beforeEach(() => {
    api = load()
  })

  it('scope בלי mode ו-sheetId — לא נופל ליומן האמיתי', () => {
    for (const scope of ['summary', 'trades', 'capitalFlows']) {
      expect(api.get({ scope }).status).toBe('error')
    }
    expect(opened).toEqual([])
  })

  it('scope לא מוכר — שגיאה, לא "כל הנתונים"', () => {
    const res = api.get({ mode: 'real', sheetId: REAL, scope: 'whatever' })
    expect(res.status).toBe('error')
    expect(res.trades).toBeUndefined()
    expect(opened).toEqual([])
  })

  it('callback (JSONP) — מתעלמים ממנו, התשובה JSON רגיל', () => {
    const raw = (api.ctx.doGet as (e: unknown) => { text: string })({ parameter: { callback: 'steal', scope: 'summary' } }).text
    expect(raw.startsWith('steal(')).toBe(false)
    expect(() => JSON.parse(raw)).not.toThrow()
  })

  it('setApiKey לא קיים יותר בשרת — המפתח לא משתנה', () => {
    props.set('twelveDataApiKey', 'original')
    const res = api.post({ action: 'setApiKey', mode: 'real', sheetId: REAL, apiKey: 'attacker' })
    expect(res.status).toBe('error')
    expect(props.get('twelveDataApiKey')).toBe('original')
  })

  it('תמונות צ׳ארט: רק כתובות TradingView — השרת לא מושך כתובות אחרות', () => {
    const res = api.post({
      action: 'fetchChartImages', mode: 'demo', sheetId: DEMO,
      charts: [
        { tradeId: 'a', symbol: 'X', chartUrl: 'http://169.254.169.254/latest' },
        { tradeId: 'b', symbol: 'Y', chartUrl: 'https://evil.example/tradingview.com' },
        { tradeId: 'c', symbol: 'Z', chartUrl: 'https://tradingview.com.evil.example/x' },
      ],
    })
    expect(res.status).toBe('ok')
    expect(res.result.images.every((i: { error?: string }) => !!i.error)).toBe(true)
    expect(fetchedUrls).toEqual([])
  })

  it('קריאה לא מריצה בדיקות התראה ולא כותבת', () => {
    let alertRuns = 0
    vm.runInContext('checkWatchlistAlerts_ = function () { __alert(); }; checkStopLossAlerts_ = function () { __alert(); };', Object.assign(api.ctx, { __alert: () => void (alertRuns += 1) }))
    api.get({ mode: 'real', sheetId: REAL })
    api.post({ action: 'getData', mode: 'real', sheetId: REAL })
    api.post({ action: 'quotes', mode: 'real', sheetId: REAL, symbols: 'VTRS' })
    expect(alertRuns).toBe(0)
    expect(writes).toEqual([])
    expect(mails).toBe(0)
  })
})

describe('שרת: התראות מטריגר זמן', () => {
  it('בשעות המסחר — רץ על היומן האמיתי בלבד', () => {
    const api = load()
    nyClock = [2, 11, 0]
    api.run('runAlertChecks')
    expect(new Set(opened)).toEqual(new Set([REAL]))
  })

  it('מחוץ לשעות המסחר (ובסוף שבוע) — לא עושה כלום', () => {
    const api = load()
    nyClock = [2, 17, 0]
    api.run('runAlertChecks')
    nyClock = [6, 11, 0]
    api.run('runAlertChecks')
    nyClock = [2, 9, 29]
    api.run('runAlertChecks')
    expect(opened).toEqual([])
  })

  it('התקנת הטריגר לא יוצרת כפילויות', () => {
    const api = load()
    api.run('installAlertTrigger')
    api.run('installAlertTrigger')
    expect(triggers).toEqual(['runAlertChecks'])
    api.run('removeAlertTriggers')
    expect(triggers).toEqual([])
  })
})
