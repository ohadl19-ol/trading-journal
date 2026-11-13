import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildSetupLink, consumeSetupLink, loadAppToken } from '@/lib/appToken'

const store = new Map<string, string>()
let replaced: string | null
beforeEach(() => {
  store.clear()
  replaced = null
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  })
  vi.stubGlobal('window', { history: { replaceState: (_s: unknown, _t: string, url: string) => void (replaced = url) } })
})

const SERVER = 'https://script.google.com/macros/s/AKfyTESTONLY_abc-123/exec'

describe('קישור הגדרה למכשיר נוסף', () => {
  it('הקוד נמצא רק אחרי # (לא נשלח לשרת)', () => {
    const link = buildSetupLink('https://example.github.io/trading-journal/#old', 'tok-123', SERVER)
    const [base, frag] = link.split('#')
    expect(base).toBe('https://example.github.io/trading-journal/')
    expect(base).not.toContain('tok-123')
    expect(frag).toContain('setup=tok-123')
  })

  it('נקלט, נשמר, ונמחק מיד מהכתובת', () => {
    const frag = buildSetupLink('https://x/app/', 'tok-123', SERVER).split('#')[1]
    expect(consumeSetupLink({ hash: '#' + frag, pathname: '/app/', search: '' })).toBe(true)
    expect(loadAppToken()).toBe('tok-123')
    expect(replaced).toBe('/app/')
    expect(JSON.parse(store.get('tj_settings')!).webAppUrl).toBe(SERVER)
  })

  it('לא דורס כתובת שרת קיימת, ומתעלם מכתובת שאינה של Apps Script', () => {
    store.set('tj_settings', JSON.stringify({ webAppUrl: 'https://script.google.com/macros/s/EXISTING/exec' }))
    consumeSetupLink({ hash: '#setup=t1&server=' + encodeURIComponent(SERVER), pathname: '/', search: '' })
    expect(JSON.parse(store.get('tj_settings')!).webAppUrl).toContain('EXISTING')
    store.clear()
    consumeSetupLink({ hash: '#setup=t2&server=' + encodeURIComponent('https://evil.example/exec'), pathname: '/', search: '' })
    expect(store.get('tj_settings')).toBeUndefined()
    expect(loadAppToken()).toBe('t2')
  })

  it('בלי קישור הגדרה — לא עושה כלום', () => {
    expect(consumeSetupLink({ hash: '', pathname: '/', search: '' })).toBe(false)
    expect(replaced).toBeNull()
  })
})
