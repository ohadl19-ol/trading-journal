import * as React from 'react'
import { Calculator, BookOpen, BarChart3, Settings as SettingsIcon, LineChart, BookMarked, Sun, Moon } from 'lucide-react'
import { Tabs } from '@/components/ui/tabs'
import { ToastProvider } from '@/components/ui/toast'
import { CalculatorPage } from '@/pages/CalculatorPage'
import { JournalPage } from '@/pages/JournalPage'
import { StatisticsPage } from '@/pages/StatisticsPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { PatternsGuidePage } from '@/pages/PatternsGuidePage'
import { useTradingData } from '@/hooks/useTradingData'
import { loadSettings, saveSettings } from '@/lib/storage'
import { computeEquitySummary } from '@/lib/statistics'
import { getStoredTheme, applyTheme, type Theme } from '@/lib/theme'
import type { AppSettings, DateRangeFilter } from '@/types'

type TabValue = 'calculator' | 'journal' | 'statistics' | 'patterns' | 'settings'

function AppShell() {
  const [tab, setTab] = React.useState<TabValue>('calculator')
  const [settings, setSettings] = React.useState<AppSettings>(() => loadSettings())
  const [filter, setFilter] = React.useState<DateRangeFilter>({ preset: 'month' })
  const [theme, setTheme] = React.useState<Theme>(() => getStoredTheme())

  React.useEffect(() => applyTheme(theme), [theme])

  const {
    positions,
    executions,
    loading,
    syncError,
    refresh,
    openTrade,
    addShares,
    trimPosition,
    closeTrade,
    updatePosition,
    deletePosition,
  } = useTradingData(settings)

  const currentEquity = React.useMemo(
    () => computeEquitySummary(positions, settings.initialCapital).currentEquity,
    [positions, settings.initialCapital],
  )

  function handleSaveSettings(next: AppSettings) {
    setSettings(next)
    saveSettings(next)
  }

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent">
            <LineChart className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold">יומן מסחר</h1>
            <p className="text-xs text-text-muted">ניהול פוזיציות וסטטיסטיקה מסונכרנים עם Google Sheets</p>
          </div>
          {!settings.webAppUrl && (
            <span className="mr-auto rounded-full bg-warn-bg px-3 py-1 text-xs text-warn">
              יש להגדיר חיבור לגיליון בהגדרות
            </span>
          )}
          {syncError && (
            <span className="mr-auto rounded-full bg-loss-bg px-3 py-1 text-xs text-loss">
              {syncError}
            </span>
          )}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className={`flex h-9 w-9 items-center justify-center rounded-lg border border-border text-text-muted hover:text-text ${settings.webAppUrl && !syncError ? 'mr-auto' : ''}`}
            title={theme === 'dark' ? 'עבור למצב בהיר' : 'עבור למצב כהה'}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-4 px-4 py-6">
        <Tabs
          value={tab}
          onChange={(v) => setTab(v as TabValue)}
          tabs={[
            { value: 'calculator', label: 'מחשבון', icon: <Calculator className="h-4 w-4" /> },
            { value: 'journal', label: 'יומן עסקאות', icon: <BookOpen className="h-4 w-4" /> },
            { value: 'statistics', label: 'סטטיסטיקה', icon: <BarChart3 className="h-4 w-4" /> },
            { value: 'patterns', label: 'מדריך תבניות', icon: <BookMarked className="h-4 w-4" /> },
            { value: 'settings', label: 'הגדרות', icon: <SettingsIcon className="h-4 w-4" /> },
          ]}
        />

        {tab === 'calculator' && (
          <CalculatorPage settings={settings} onOpenTrade={openTrade} currentEquity={currentEquity} />
        )}
        {tab === 'journal' && (
          <JournalPage
            positions={positions}
            executions={executions}
            loading={loading}
            onRefresh={refresh}
            onAddShares={addShares}
            onTrim={trimPosition}
            onCloseTrade={closeTrade}
            onUpdate={updatePosition}
            onDelete={deletePosition}
            filter={filter}
            onFilterChange={setFilter}
          />
        )}
        {tab === 'statistics' && (
          <StatisticsPage
            positions={positions}
            initialCapital={settings.initialCapital}
            filter={filter}
            onFilterChange={setFilter}
          />
        )}
        {tab === 'patterns' && <PatternsGuidePage />}
        {tab === 'settings' && (
          <SettingsPage
            settings={settings}
            onSave={handleSaveSettings}
            positions={positions}
            executions={executions}
          />
        )}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <AppShell />
    </ToastProvider>
  )
}
