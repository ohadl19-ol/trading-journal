import * as React from 'react'
import { Wifi, Save, Download, Sun, Moon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { testConnection } from '@/lib/api'
import { exportBackupCsv } from '@/lib/csvExport'
import type { Theme } from '@/lib/theme'
import type { AppSettings, Execution, Position } from '@/types'

interface SettingsPageProps {
  settings: AppSettings
  onSave: (settings: AppSettings) => void
  positions: Position[]
  executions: Execution[]
  theme: Theme
  onThemeChange: (theme: Theme) => void
}

export function SettingsPage({ settings, onSave, positions, executions, theme, onThemeChange }: SettingsPageProps) {
  const { toast } = useToast()
  const [form, setForm] = React.useState<AppSettings>(settings)
  const [testing, setTesting] = React.useState(false)

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
    onSave(form)
    toast('ההגדרות נשמרו')
  }

  async function handleTest() {
    setTesting(true)
    try {
      const ok = await testConnection(form.webAppUrl)
      toast(ok ? 'החיבור תקין ✅' : 'החיבור נכשל, בדוק את הכתובת', ok ? 'success' : 'error')
    } finally {
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
          <Button variant="secondary" onClick={handleTest} disabled={testing || !form.webAppUrl}>
            <Wifi className="h-4 w-4" />
            {testing ? 'בודק...' : 'בדוק חיבור'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ערכי ברירת מחדל</CardTitle>
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
