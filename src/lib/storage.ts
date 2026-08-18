import type { AppSettings, Execution, Position } from '@/types'

const KEYS = {
  settings: 'tj_settings',
  positions: 'tj_positions',
  executions: 'tj_executions',
} as const

export const DEFAULT_SETTINGS: AppSettings = {
  webAppUrl: '',
  initialCapital: 4455.21,
  defaultAccountBalance: 4455.21,
  defaultRiskAmount: 50,
  commissionPerAction: 0,
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(KEYS.settings)
    if (!raw) return DEFAULT_SETTINGS
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: AppSettings) {
  localStorage.setItem(KEYS.settings, JSON.stringify(settings))
}

export function loadLocalPositions(): Position[] {
  try {
    const raw = localStorage.getItem(KEYS.positions)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveLocalPositions(positions: Position[]) {
  localStorage.setItem(KEYS.positions, JSON.stringify(positions))
}

export function loadLocalExecutions(): Execution[] {
  try {
    const raw = localStorage.getItem(KEYS.executions)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveLocalExecutions(executions: Execution[]) {
  localStorage.setItem(KEYS.executions, JSON.stringify(executions))
}
