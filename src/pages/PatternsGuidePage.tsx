import { Card, CardContent } from '@/components/ui/card'
import { PatternDiagram } from '@/components/PatternDiagram'
import { PATTERN_INFO } from '@/lib/patternInfo'

export function PatternsGuidePage() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-surface p-4 text-sm text-text-muted">
        מדריך מהיר לכל סוגי הגרפים (Pattern) שאפשר לבחור בטאב <b className="text-text">מחשבון</b> וביומן העסקאות.
        הדיאגרמות הן סכמטיות בלבד להמחשת הצורה הכללית — לא תחליף לניתוח צ׳ארט אמיתי.
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {PATTERN_INFO.map((p) => (
          <Card key={p.name}>
            <CardContent className="space-y-3 p-4">
              <div>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-base font-bold text-text">{p.name}</h3>
                  <span className="text-sm text-text-muted">— {p.short}</span>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-surface-2 px-2 py-1">
                <PatternDiagram pattern={p.name} />
              </div>
              <p className="text-sm leading-relaxed text-text">{p.description}</p>
              {p.tips.length > 0 && (
                <ul className="space-y-1 border-t border-border pt-2 text-xs text-text-muted">
                  {p.tips.map((tip) => (
                    <li key={tip} className="flex gap-1.5">
                      <span className="text-accent">•</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
