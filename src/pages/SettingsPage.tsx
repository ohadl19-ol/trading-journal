import * as React from 'react'
import { Wifi, Save } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { testConnection } from '@/lib/api'
import type { AppSettings } from '@/types'

interface SettingsPageProps {
  settings: AppSettings
  onSave: (settings: AppSettings) => void
}

export function SettingsPage({ settings, onSave }: SettingsPageProps) {
  const { toast } = useToast()
  const [form, setForm] = React.useState<AppSettings>(settings)
  const [testing, setTesting] = React.useState(false)

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
        </CardContent>
      </Card>

      <Button className="w-full" onClick={handleSave}>
        <Save className="h-4 w-4" />
        שמור הגדרות
      </Button>
    </div>
  )
}
