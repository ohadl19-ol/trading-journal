import * as React from 'react'
import { Wifi, Save, Download } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { testConnection } from '@/lib/api'
import { exportBackupCsv } from '@/lib/csvExport'
import type { AppSettings, Execution, Position } from '@/types'

interface SettingsPageProps {
  settings: AppSettings
  onSave: (settings: AppSettings) => void
  positions: Position[]
  executions: Execution[]
}

export function SettingsPage({ settings, onSave, positions, executions }: SettingsPageProps) {
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
          <div>
            <Label>הון התחלתי ($)</Label>
            <Input
              type="number"
              value={form.initialCapital}
              onChange={(e) => setForm({ ...form, initialCapital: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label>יתרת חשבון ברירת מחדל ($)</Label>
            <Input
              type="number"
              value={form.defaultAccountBalance}
              onChange={(e) => setForm({ ...form, defaultAccountBalance: Number(e.target.value) })}
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
            <Label>עמלה קבועה לעסקה ($)</Label>
            <Input
              type="number"
              value={form.commissionPerTrade}
              onChange={(e) => setForm({ ...form, commissionPerTrade: Number(e.target.value) })}
            />
            <p className="mt-1 text-xs text-text-muted">
              מנוכה אוטומטית מהרווח/הפסד בכל מכירה חלקית וסגירת עסקה (0 = בלי עמלה).
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
