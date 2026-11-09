import * as React from 'react'
import { Calculator, BookOpen, BarChart3, Settings as SettingsIcon, LineChart, BookMarked, Eye, NotebookPen, LayoutDashboard, GitCompareArrows, FlaskConical } from 'lucide-react'
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
import { ComparePage } from '@/pages/ComparePage'
import { loadAccountMode, saveAccountMode, MODE_LABEL, type AccountMode } from '@/lib/accountMode'
import { cn } from '@/lib/utils'
import { Dialog } from '@/components/ui/dialog'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { useTradingData } from '@/hooks/useTradingData'
import { loadSettings, saveSettings } from '@/lib/storage'
import { computeEquitySummary, computeEquityCurve } from '@/lib/statistics'
import { formatCurrency } from '@/lib/calculations'
import { Sparkline } from '@/components/Sparkline'
import { getStoredTheme, applyTheme, type Theme } from '@/lib/theme'
import type { AppSettings, DateRangeFilter, WatchlistItem } from '@/types'

type TabValue = 'dashboard' | 'calculator' | 'journal' | 'statistics' | 'compare' | 'watchlist' | 'notes' | 'settings'

interface AppShellProps {
  mode: AccountMode
  onModeChange: (mode: AccountMode) => void
  tab: TabValue
  setTab: (tab: TabValue) => void
}

/** מתג בולט בין החשבון האמיתי לחשבון הדמו */
function AccountModeSwitch({ mode, onChange }: { mode: AccountMode; onChange: (m: AccountMode) => void }) {
  return (
    <div role="radiogroup" aria-label="בחירת חשבון" className="flex shrink-0 gap-1 rounded-xl border border-border bg-surface-2 p-1">
      {(['real', 'demo'] as const).map((m) => (
        <button
          key={m}
          role="radio"
          aria-checked={mode === m}
          data-testid={`mode-${m}`}
          onClick={() => mode !== m && onChange(m)}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors',
            mode === m
              ? m === 'demo'
                ? 'bg-demo-strong text-demo-fg'
                : 'bg-accent text-accent-fg'
              : 'text-text-muted hover:text-text',
          )}
        >
          {m === 'demo' ? <FlaskConical className="h-4 w-4" /> : <LineChart className="h-4 w-4" />}
          {MODE_LABEL[m]}
        </button>
      ))}
    </div>
  )
}

function AppShell({ mode, onModeChange, tab, setTab }: AppShellProps) {
  const isDemo = mode === 'demo'
  const [settings, setSettings] = React.useState<AppSettings>(() => loadSettings(mode))
  const [filter, setFilter] = React.useState<DateRangeFilter>({ preset: 'month' })
  const [theme, setTheme] = React.useState<Theme>(() => getStoredTheme())
  // תוכנית מסחר שמורה שנבחרה ברשימת המעקב ("בצע כניסה לעסקה") — ממלאת את המחשבון בטאב הבא שייפתח
  const [calculatorPrefill, setCalculatorPrefill] = React.useState<WatchlistItem | null>(null)
  // מדריך תבניות עבר מטאב קבוע לחלונית עזרה, כדי לפנות מקום בשורת הטאבים לדברים שנצפים לעיתים קרובות יותר
  const [showPatternsGuide, setShowPatternsGuide] = React.useState(false)

  React.useEffect(() => applyTheme(theme), [theme])

  const {
    target: sheetTarget,
    positions,
    executions,
    watchlist,
    notes,
    loading,
    syncError,
    remoteSettings,
    updateRemoteSettings,
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
  } = useTradingData(settings, mode)

  // "הון התחלתי" וההגדרות הדומות לו מסונכרנות מול השרת כדי שיוגדרו פעם אחת ויחולו על כל
  // מכשיר: אם השרת כבר מכיר ערך לשדה מסוים — הוא גובר על המקומי; אם השרת עוד לא מכיר
  // אף ערך (גיליון חדש שמעולם לא סונכרן) — דוחפים את הערכים המקומיים הנוכחיים אליו פעם
  // אחת, כדי שהם יהפכו למקור האמת מכאן והלאה, בלי לדרוס בטעות ערך אמיתי בברירת מחדל.
  React.useEffect(() => {
    if (!remoteSettings) return
    const hasAnyServerValue =
      remoteSettings.initialCapital != null ||
      remoteSettings.defaultAccountBalance != null ||
      remoteSettings.defaultRiskAmount != null ||
      remoteSettings.commissionPerAction != null

    if (hasAnyServerValue) {
      setSettings((prev) => {
        const merged: AppSettings = {
          ...prev,
          initialCapital: remoteSettings.initialCapital ?? prev.initialCapital,
          defaultAccountBalance: remoteSettings.defaultAccountBalance ?? prev.defaultAccountBalance,
          defaultRiskAmount: remoteSettings.defaultRiskAmount ?? prev.defaultRiskAmount,
          commissionPerAction: remoteSettings.commissionPerAction ?? prev.commissionPerAction,
        }
        saveSettings(merged, mode)
        return merged
      })
    } else {
      updateRemoteSettings({
        initialCapital: settings.initialCapital,
        defaultAccountBalance: settings.defaultAccountBalance,
        defaultRiskAmount: settings.defaultRiskAmount,
        commissionPerAction: settings.commissionPerAction,
      }).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteSettings])

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
    saveSettings(next, mode)
    if (next.webAppUrl) {
      updateRemoteSettings({
        initialCapital: next.initialCapital,
        defaultAccountBalance: next.defaultAccountBalance,
        defaultRiskAmount: next.defaultRiskAmount,
        commissionPerAction: next.commissionPerAction,
      }).catch(() => {})
    }
  }

  return (
    <div className={cn('min-h-screen bg-bg', isDemo && 'border-x-4 border-demo-strong')}>
      {isDemo && (
        <div
          role="status"
          data-testid="demo-banner"
          className="demo-stripe sticky top-0 z-40 px-4 py-2 text-center text-sm font-bold text-demo-fg shadow-md"
        >
          <FlaskConical className="ml-1.5 inline h-4 w-4 align-[-2px]" />
          מצב דמו · כל הנתונים, הכתיבות והסטטיסטיקות כאן הם מגיליון הדמו בלבד
        </div>
      )}
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-4">
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-xl',
              isDemo ? 'bg-demo-strong text-demo-fg' : 'bg-accent/15 text-accent',
            )}
          >
            {isDemo ? <FlaskConical className="h-5 w-5" /> : <LineChart className="h-5 w-5" />}
          </div>
          <div>
            <h1 className="text-lg font-bold">
              יומן מסחר{isDemo && <span className="mr-1.5 text-demo"> · דמו</span>}
            </h1>
            <p className="text-xs text-text-muted">ניהול פוזיציות וסטטיסטיקה מסונכרנים עם Google Sheets</p>
          </div>
          <AccountModeSwitch mode={mode} onChange={onModeChange} />
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
              onClick={() => setShowPatternsGuide(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-text-muted hover:text-text"
              title="מדריך תבניות"
            >
              <BookMarked className="h-4 w-4" />
            </button>
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

      {showPatternsGuide && (
        <Dialog open onClose={() => setShowPatternsGuide(false)} title="מדריך תבניות" className="max-w-3xl">
          <PatternsGuidePage />
        </Dialog>
      )}

      <main className="mx-auto max-w-6xl space-y-4 px-4 py-6">
        <Tabs
          value={tab}
          onChange={(v) => setTab(v as TabValue)}
          tabs={[
            { value: 'dashboard', label: 'דשבורד', icon: <LayoutDashboard className="h-4 w-4" /> },
            { value: 'calculator', label: 'מחשבון', icon: <Calculator className="h-4 w-4" /> },
            { value: 'journal', label: 'יומן עסקאות', icon: <BookOpen className="h-4 w-4" /> },
            { value: 'statistics', label: 'סטטיסטיקה', icon: <BarChart3 className="h-4 w-4" /> },
            { value: 'compare', label: 'השוואה', icon: <GitCompareArrows className="h-4 w-4" /> },
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
          <CalculatorPage
            settings={settings}
            onOpenTrade={openTrade}
            onSaveToWatchlist={addToWatchlist}
            onDeleteWatchlistItem={deleteFromWatchlist}
            currentEquity={currentEquity}
            prefill={calculatorPrefill}
            onPrefillConsumed={() => setCalculatorPrefill(null)}
          />
        )}
        {tab === 'journal' && (
          <JournalPage
            positions={positions}
            executions={executions}
            loading={loading}
            webAppUrl={settings.webAppUrl}
            sheetTarget={sheetTarget}
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
        {tab === 'compare' && <ComparePage webAppUrl={settings.webAppUrl} />}
        {tab === 'watchlist' && (
          <WatchlistPage
            watchlist={watchlist}
            onAdd={addToWatchlist}
            onUpdate={updateWatchlistItem}
            onDelete={deleteFromWatchlist}
            onOpenTradeFromPlan={(item) => {
              setCalculatorPrefill(item)
              setTab('calculator')
            }}
          />
        )}
        {tab === 'notes' && <NotesPage notes={notes} onSave={saveNotes} />}
        {tab === 'settings' && (
          <SettingsPage
            mode={mode}
            sheetTarget={sheetTarget}
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
  const [mode, setMode] = React.useState<AccountMode>(() => loadAccountMode())
  const [tab, setTab] = React.useState<TabValue>('dashboard')

  function handleModeChange(next: AccountMode) {
    saveAccountMode(next)
    setMode(next)
  }

  return (
    <ErrorBoundary>
      <ToastProvider>
        {/* key={mode}: מעבר מצב מרכיב מחדש את כל המסך — אין state, מטמון או פעולה בתהליך
            שעוברים ממצב אחד לשני */}
        <AppShell key={mode} mode={mode} onModeChange={handleModeChange} tab={tab} setTab={setTab} />
      </ToastProvider>
    </ErrorBoundary>
  )
}
