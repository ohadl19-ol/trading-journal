import * as React from 'react'
import { Wifi, Save, Download, Sun, Moon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { testConnection } from '@/lib/api'
import { buildSetupLink, loadAppToken, saveAppToken } from '@/lib/appToken'
import { MODE_LABEL, type AccountMode, type SheetTarget } from '@/lib/accountMode'
import { exportBackupCsv } from '@/lib/csvExport'
import { loadTradingViewLayoutId, parseTradingViewLayoutId, saveTradingViewLayoutId } from '@/lib/tradingview'
import type { Theme } from '@/lib/theme'
import type { AppSettings, Execution, Position } from '@/types'

interface SettingsPageProps {
  mode: AccountMode
  sheetTarget: SheetTarget | null
  settings: AppSettings
  onSave: (settings: AppSettings) => void
  positions: Position[]
  executions: Execution[]
  theme: Theme
  onThemeChange: (theme: Theme) => void
}

export function SettingsPage({ mode, sheetTarget, settings, onSave, positions, executions, theme, onThemeChange }: SettingsPageProps) {
  const { toast } = useToast()
  const [form, setForm] = React.useState<AppSettings>(settings)
  const [testing, setTesting] = React.useState(false)
  const [tvLayout, setTvLayout] = React.useState(() => loadTradingViewLayoutId())
  const [appToken, setAppToken] = React.useState(() => loadAppToken())
  const [showToken, setShowToken] = React.useState(false)
  const [qr, setQr] = React.useState<string | null>(null)

  async function showDeviceQr() {
    const saved = loadAppToken()
    if (!saved || !settings.webAppUrl) {
      toast('קודם הזן ושמור את כתובת השרת ואת קוד הגישה', 'error')
      return
    }
    const link = buildSetupLink(window.location.href, saved, settings.webAppUrl)
    // הספרייה נטענת רק כשמבקשים QR, כדי לא להכביד על טעינת האפליקציה
    const QRCode = (await import('qrcode')).default
    setQr(await QRCode.toDataURL(link, { margin: 1, width: 240 }))
  }
  const tvLayoutId = parseTradingViewLayoutId(tvLayout)

  function handleExport() {
    if (positions.length === 0) {
      toast('אין נתונים לייצוא', 'error')
      return
    }
    exportBackupCsv(positions, executions)
    toast('קובצי הגיבוי הורדו')
  }

  React.useEffect(() => setForm(settings), [settings])

  function handleSave() {
    if (tvLayout.trim() && !tvLayoutId) {
      toast('כתובת הפריסה ב-TradingView לא תקינה. הדבק כתובת שמתחילה ב-tradingview.com/chart/', 'error')
      return
    }
    saveTradingViewLayoutId(tvLayoutId)
    saveAppToken(appToken)
    onSave(form)
    toast('ההגדרות נשמרו')
  }

  async function handleTest() {
    setTesting(true)
    // הבדיקה משתמשת בקוד שמוזן כרגע בשדה, גם לפני "שמור הגדרות"
    const savedToken = loadAppToken()
    saveAppToken(appToken)
    try {
      const ok = sheetTarget ? await testConnection(form.webAppUrl, sheetTarget) : false
      toast(ok ? 'החיבור תקין ✅' : 'החיבור נכשל, בדוק את הכתובת ואת קוד הגישה', ok ? 'success' : 'error')
    } finally {
      saveAppToken(savedToken)
      setTesting(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>מראה</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-text">מצב תצוגה</div>
              <div className="text-xs text-text-muted">כהה או בהיר</div>
            </div>
            <div className="flex gap-1 rounded-lg bg-surface-2 p-1">
              <button
                onClick={() => onThemeChange('dark')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  theme === 'dark' ? 'bg-accent text-accent-fg' : 'text-text-muted hover:text-text'
                }`}
              >
                <Moon className="h-3.5 w-3.5" />
                כהה
              </button>
              <button
                onClick={() => onThemeChange('light')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  theme === 'light' ? 'bg-accent text-accent-fg' : 'text-text-muted hover:text-text'
                }`}
              >
                <Sun className="h-3.5 w-3.5" />
                בהיר
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>חיבור לגיליון (Google Apps Script)</CardTitle>
          <CardDescription>
            הדבק כאן את כתובת ה-Web App שקיבלת מ-Google Apps Script לאחר הפריסה.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>כתובת Web App URL</Label>
            <Input
              value={form.webAppUrl}
              onChange={(e) => setForm({ ...form, webAppUrl: e.target.value })}
              placeholder="https://script.google.com/macros/s/.../exec"
            />
          </div>
          <div>
            <Label>קוד גישה לשרת</Label>
            <div className="flex gap-2">
              <Input
                dir="ltr"
                type={showToken ? 'text' : 'password'}
                autoComplete="off"
                value={appToken}
                onChange={(e) => setAppToken(e.target.value)}
                placeholder="הקוד שהגדרת ב-Script Properties (APP_TOKEN)"
              />
              <Button variant="outline" type="button" onClick={() => setShowToken((v) => !v)}>
                {showToken ? 'הסתר' : 'הצג'}
              </Button>
            </div>
            <p className="mt-1 text-xs text-text-muted">
              נשמר רק בדפדפן הזה. בלי הקוד הנכון השרת לא יקרא ולא יכתוב כלום.
            </p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <div className="text-sm font-medium text-text">חיבור טלפון או מכשיר נוסף</div>
            <p className="text-xs text-text-muted">
              סרוק את הקוד במצלמה של הטלפון — האפליקציה תיפתח מחוברת, בלי להקליד כלום.
            </p>
            {qr ? (
              <div className="mt-2 flex flex-col items-center gap-2">
                <img src={qr} alt="קוד QR לחיבור מכשיר" className="rounded-md bg-white p-1" width={240} height={240} />
                <p className="text-center text-xs text-warn">הקוד הזה הוא המפתח לשרת — אל תצלם ואל תשתף אותו.</p>
                <Button size="sm" variant="outline" type="button" onClick={() => setQr(null)}>
                  הסתר
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="secondary" type="button" className="mt-2" onClick={showDeviceQr}>
                הצג קוד QR
              </Button>
            )}
          </div>
          <Button variant="secondary" onClick={handleTest} disabled={testing || !form.webAppUrl}>
            <Wifi className="h-4 w-4" />
            {testing ? 'בודק...' : 'בדוק חיבור'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ערכי ברירת מחדל · {MODE_LABEL[mode]}</CardTitle>
          <CardDescription>
            {mode === 'demo'
              ? 'הערכים כאן חלים על חשבון הדמו בלבד. ברירת המחדל להון ההתחלתי היא 3,000$.'
              : 'הערכים כאן חלים על החשבון האמיתי בלבד. לחשבון הדמו יש ערכים נפרדים.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="rounded-lg bg-accent/10 px-3 py-2 text-xs text-accent">
            הערכים בכרטיס הזה נשמרים גם בצד השרת (הגיליון) — מגדירים אותם פעם אחת כאן, וזה
            יחול אוטומטית בכל מכשיר/דפדפן אחר שמחובר לאותו גיליון, בלי להזין שוב בכל מקום.
          </p>
          <div>
            <Label>הון התחלתי ($)</Label>
            <Input
              type="number"
              value={form.initialCapital}
              onChange={(e) => setForm({ ...form, initialCapital: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label>סכום סיכון ברירת מחדל ($)</Label>
            <Input
              type="number"
              value={form.defaultRiskAmount}
              onChange={(e) => setForm({ ...form, defaultRiskAmount: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label>עמלה קבועה לפעולה ($)</Label>
            <Input
              type="number"
              value={form.commissionPerAction}
              onChange={(e) => setForm({ ...form, commissionPerAction: Number(e.target.value) })}
            />
            <p className="mt-1 text-xs text-text-muted">
              מנוכה אוטומטית על כל פעולת קנייה/מכירה בנפרד — כניסה, חיזוק, מכירה חלקית וסגירה (0 = בלי עמלה).
              למשל אם הברוקר גובה 1.50$ לפעולה, עסקת כניסה+סגירה פשוטה תעלה בסך הכול 3$.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>TradingView</CardTitle>
          <CardDescription>
            לחיצה על "גרף חי" פותחת את מסך הגרפים של TradingView עם המניה. כדי שייפתח עם הפריסה
            שלך (אינדיקטורים, טווחי זמן), פתח את הגרף שלך ב-TradingView, העתק את הכתובת מהדפדפן
            והדבק אותה כאן.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          <Label>כתובת הפריסה שלי (אופציונלי)</Label>
          <Input
            dir="ltr"
            value={tvLayout}
            onChange={(e) => setTvLayout(e.target.value)}
            placeholder="https://www.tradingview.com/chart/AbCd1234/"
          />
          {tvLayoutId && <p className="text-xs text-text-muted">מזהה פריסה: {tvLayoutId}</p>}
        </CardContent>
      </Card>

      <Button className="w-full" onClick={handleSave}>
        <Save className="h-4 w-4" />
        שמור הגדרות
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>גיבוי נתונים</CardTitle>
          <CardDescription>
            הורדת כל הפוזיציות והפעולות כקובצי CSV לגיבוי מקומי עצמאי, בנוסף לגיליון בגוגל דרייב.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="secondary" onClick={handleExport}>
            <Download className="h-4 w-4" />
            ייצוא כ-CSV ({positions.length} עסקאות)
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
