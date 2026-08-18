import * as React from 'react'
import { Save, Lightbulb, ClipboardList } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import type { GeneralNotes } from '@/lib/api'

interface NotesPageProps {
  notes: GeneralNotes
  onSave: (notes: GeneralNotes) => Promise<void>
}

export function NotesPage({ notes, onSave }: NotesPageProps) {
  const { toast } = useToast()
  const [generalNotes, setGeneralNotes] = React.useState(notes.generalNotes)
  const [tradingRules, setTradingRules] = React.useState(notes.tradingRules)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    setGeneralNotes(notes.generalNotes)
    setTradingRules(notes.tradingRules)
  }, [notes])

  async function handleSave() {
    setSaving(true)
    try {
      await onSave({ generalNotes, tradingRules })
      toast('נשמר בהצלחה')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'שגיאה בשמירה', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-accent" />
            הערות כלליות
          </CardTitle>
          <CardDescription>
            תובנות ולקחים כלליים מהמסחר שלך — לדוגמה: "לפעמים יש פריצת דמה שפורצת ואז יורדת, צריך להיזהר מזה".
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={generalNotes}
            onChange={(e) => setGeneralNotes(e.target.value)}
            rows={10}
            placeholder="כתוב כאן תובנות, דפוסים שזיהית, טעויות חוזרות..."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-accent" />
            כללי מסחר (תוכנית מסחר)
          </CardTitle>
          <CardDescription>
            הכללים הקבועים שלך לכניסה וניהול עסקאות — לדוגמה: "R/R מינימלי של 2", "לא נכנס אם המניה כבר עלתה מעל 10% היום".
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={tradingRules}
            onChange={(e) => setTradingRules(e.target.value)}
            rows={10}
            placeholder="כתוב כאן את כללי המסחר הקבועים שלך..."
          />
        </CardContent>
      </Card>

      <Button className="w-full" disabled={saving} onClick={handleSave}>
        <Save className="h-4 w-4" />
        {saving ? 'שומר...' : 'שמור'}
      </Button>
    </div>
  )
}
