import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { PATTERN_OPTIONS } from '@/types'

interface PatternSelectProps {
  value: string
  onChange: (value: string) => void
}

/**
 * בורר "סוג הגרף (Pattern)": רשימת התבניות הקבועה, ובבחירת "אחר" נפתח שדה טקסט חופשי
 * להזנת שם תבנית משלך. ה-value שמוחזק כאן הוא תמיד הערך הסופי שנשמר בפועל (שם התבנית
 * מהרשימה, או הטקסט החופשי שהוקלד) — אין state כפול, כדי שזה יתנהג זהה בכל מקום שמשתמש בזה.
 */
export function PatternSelect({ value, onChange }: PatternSelectProps) {
  const isCustom = value === 'אחר' || (value !== '' && !(PATTERN_OPTIONS as readonly string[]).includes(value))

  return (
    <div>
      <Select value={isCustom ? 'אחר' : value} onChange={(e) => onChange(e.target.value)}>
        <option value="">בחר...</option>
        {PATTERN_OPTIONS.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </Select>
      {isCustom && (
        <Input
          className="mt-2"
          value={value === 'אחר' ? '' : value}
          onChange={(e) => onChange(e.target.value === '' ? 'אחר' : e.target.value)}
          placeholder="הקלד סוג תבנית..."
        />
      )}
    </div>
  )
}
