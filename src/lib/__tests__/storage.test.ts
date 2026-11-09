/** הפרדת המטמון וההגדרות בין חשבון אמיתי לדמו (localStorage מדומה) */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadLocalPositions, loadSettings, saveLocalPositions, saveSettings } from '@/lib/storage'
import { loadAccountMode, saveAccountMode } from '@/lib/accountMode'
import type { Position } from '@/types'

function memoryStorage() {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => Array.from(m.keys())[i] ?? null,
    get length() {
      return m.size
    },
    _map: m,
  }
}

let store: ReturnType<typeof memoryStorage>
beforeEach(() => {
  store = memoryStorage()
  vi.stubGlobal('localStorage', store)
})

const pos = (id: string) => ({ tradeId: id, tags: [], followedPlan: null, tradeReview: '' }) as unknown as Position

describe('הפרדת מטמון מקומי', () => {
  it('עסקאות הדמו נשמרות במפתח נפרד ולא נראות במצב אמיתי', () => {
    saveLocalPositions([pos('T-REAL')], 'real')
    saveLocalPositions([pos('T-DEMO')], 'demo')
    expect(loadLocalPositions('real').map((p) => p.tradeId)).toEqual(['T-REAL'])
    expect(loadLocalPositions('demo').map((p) => p.tradeId)).toEqual(['T-DEMO'])
    expect(store.getItem('tj_positions')).toContain('T-REAL')
    expect(store.getItem('tj_positions')).not.toContain('T-DEMO')
  })

  it('מטמון דמו ריק לא "נופל" למטמון האמיתי', () => {
    saveLocalPositions([pos('T-REAL')], 'real')
    expect(loadLocalPositions('demo')).toEqual([])
  })
})

describe('הגדרות לפי חשבון', () => {
  it('לדמו הון התחלתי 3,000$ כברירת מחדל, וכתובת השרת משותפת', () => {
    saveSettings({ webAppUrl: 'https://x/exec', initialCapital: 4455, defaultAccountBalance: 4455, defaultRiskAmount: 50, commissionPerAction: 1 }, 'real')
    const demo = loadSettings('demo')
    expect(demo.initialCapital).toBe(3000)
    expect(demo.webAppUrl).toBe('https://x/exec')
  })

  it('שינוי הון הדמו לא משנה את הון החשבון האמיתי', () => {
    saveSettings({ webAppUrl: 'https://x/exec', initialCapital: 4455, defaultAccountBalance: 4455, defaultRiskAmount: 50, commissionPerAction: 0 }, 'real')
    saveSettings({ ...loadSettings('demo'), initialCapital: 5000 }, 'demo')
    expect(loadSettings('demo').initialCapital).toBe(5000)
    expect(loadSettings('real').initialCapital).toBe(4455)
  })

  it('בחירת המצב נשמרת בדפדפן', () => {
    expect(loadAccountMode()).toBe('real')
    saveAccountMode('demo')
    expect(loadAccountMode()).toBe('demo')
  })
})
