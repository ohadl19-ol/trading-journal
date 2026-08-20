import * as React from 'react'
import { Calculator, BookOpen, BarChart3, Settings as SettingsIcon, LineChart, BookMarked, Eye, NotebookPen, LayoutDashboard } from 'lucide-react'
import { Tabs } from '@/components/ui/tabs'
import { ToastProvider } from '@/components/ui/toast'
import { DashboardPage } from '@/pages/DashboardPage'
import { CalculatorPage } from '@/pages/CalculatorPage'
import { JournalPage } from '@/pages/JournalPage'
import { StatisticsPage } from '@/pages/StatisticsPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { PatternsGuidePage } from '@/pages/PatternsGuidePage'
import { WatchlistPage } from '@/pages/WatchlistPage'
import { NotesPage } from '@/pages/NotesPage'
import { useTradingData } from '@/hooks/useTradingData'
import { loadSettings, saveSettings } from '@/lib/storage'
import { computeEquitySummary, computeEquityCurve } from '@/lib/statistics'
import { formatCurrency } from '@/lib/calculations'
import { Sparkline } from '@/components/Sparkline'
import { getStoredTheme, applyTheme, type Theme } from '@/lib/theme'
import type { AppSettings, DateRangeFilter } from '@/types'

type TabValue = 'dashboard' | 'calculator' | 'journal' | 'statistics' | 'patterns' | 'watchlist' | 'notes' | 'settings'

function AppShell() {
  const [tab, setTab] = React.useState<TabValue>('dashboard')
  const [settings, setSettings] = React.useState<AppSettings>(() => loadSettings())
  const [filter, setFilter] = React.useState<DateRangeFilter>({ preset: 'month' })
  const [theme, setTheme] = React.useState<Theme>(() => getStoredTheme())

  React.useEffect(() => applyTheme(theme), [theme])

  const {
    positions,
    executions,
    watchlist,
    notes,
    loading,
    syncError,
    refresh,
    openTrade,
    addShares,
    trimPosition,
    closeTrade,
    updatePosition,
    toggleFavorite,
    deletePosition,
    addToWatchlist,
    updateWatchlistItem,
    deleteFromWatchlist,
    saveNotes,
  } = useTradingData(settings)

  const currentEquity = React.useMemo(
    () => computeEquitySummary(positions, settings.initialCapital).currentEquity,
    [positions, settings.initialCapital],
  )
  // נקודות אחרונות בעקומת ההון, למגמת שווי זעירה בהדר (לא תחליף לעקומה המלאה בעמוד סטטיסטיקה)
  const equitySparkline = React.useMemo(() => {
    const curve = computeEquityCurve(positions, settings.initialCapital)
    return curve.slice(-20).map((p) => p.equity)
  }, [positions, settings.initialCapital])

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
          <div
            className={`flex items-center gap-3 ${settings.webAppUrl && !syncError ? 'mr-auto' : ''}`}
          >
            {equitySparkline.length >= 2 && (
              <button
                onClick={() => setTab('dashboard')}
                className="hidden items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 hover:bg-surface-2 sm:flex"
                title="שווי חשבון נוכחי — למעבר לדשבורד"
              >
                <span className="num-tabular text-sm font-semibold text-text">
                  ${formatCurrency(currentEquity)}
                </span>
                <Sparkline values={equitySparkline} />
              </button>
            )}
            <button
              onClick={() => setTab('settings')}
              className={`flex h-9 w-9 items-center justify-center rounded-lg border border-border text-text-muted hover:text-text ${tab === 'settings' ? 'bg-accent/15 text-accent' : ''}`}
              title="הגדרות"
            >
              <SettingsIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-4 px-4 py-6">
        <Tabs
          value={tab}
          onChange={(v) => setTab(v as TabValue)}
          tabs={[
            { value: 'dashboard', label: 'דשבורד', icon: <LayoutDashboard className="h-4 w-4" /> },
            { value: 'calculator', label: 'מחשבון', icon: <Calculator className="h-4 w-4" /> },
            { value: 'journal', label: 'יומן עסקאות', icon: <BookOpen className="h-4 w-4" /> },
            { value: 'statistics', label: 'סטטיסטיקה', icon: <BarChart3 className="h-4 w-4" /> },
            { value: 'patterns', label: 'מדריך תבניות', icon: <BookMarked className="h-4 w-4" /> },
            { value: 'watchlist', label: 'רשימת מעקב', icon: <Eye className="h-4 w-4" /> },
            { value: 'notes', label: 'הערות וכללים', icon: <NotebookPen className="h-4 w-4" /> },
          ]}
        />

        {tab === 'dashboard' && (
          <DashboardPage
            positions={positions}
            initialCapital={settings.initialCapital}
            loading={loading}
            onNavigate={(t) => setTab(t)}
          />
        )}
        {tab === 'calculator' && (
          <CalculatorPage settings={settings} onOpenTrade={openTrade} currentEquity={currentEquity} />
        )}
        {tab === 'journal' && (
          <JournalPage
            positions={positions}
            executions={executions}
            loading={loading}
            webAppUrl={settings.webAppUrl}
            onRefresh={refresh}
            onAddShares={addShares}
            onTrim={trimPosition}
            onCloseTrade={closeTrade}
            onUpdate={updatePosition}
            onDelete={deletePosition}
            onToggleFavorite={toggleFavorite}
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
        {tab === 'watchlist' && (
          <WatchlistPage
            watchlist={watchlist}
            onAdd={addToWatchlist}
            onUpdate={updateWatchlistItem}
            onDelete={deleteFromWatchlist}
          />
        )}
        {tab === 'notes' && <NotesPage notes={notes} onSave={saveNotes} />}
        {tab === 'settings' && (
          <SettingsPage
            settings={settings}
            onSave={handleSaveSettings}
            positions={positions}
            executions={executions}
            theme={theme}
            onThemeChange={setTheme}
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
