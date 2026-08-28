import * as React from 'react'

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * רשת ביטחון: בלי זה, כל שגיאת JavaScript לא-צפויה באיזשהו מקום בעץ הרינדור מפילה
 * את כל האפליקציה למסך שחור ריק לגמרי, בלי שום רמז למה — בדיוק מה שקרה כשעסקאות
 * ישנות בקאש המקומי לא הכילו שדה חדש שקוד חדש הניח שתמיד קיים. מכאן והלאה שגיאה
 * כזו תציג הודעה ברורה + כפתור לרענון, במקום מסך שחור חסר הסבר.
 */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('שגיאה לא צפויה באפליקציה:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg p-6 text-center">
          <div className="max-w-md space-y-3">
            <h1 className="text-lg font-bold text-text">משהו השתבש</h1>
            <p className="text-sm text-text-muted">
              קרתה שגיאה לא צפויה והאפליקציה לא הצליחה להמשיך לטעון. לרוב רענון פשוט פותר את זה — אם זה
              חוזר, כדאי לנקות את נתוני האתר (הגדרות הדפדפן) ולנסות שוב.
            </p>
            <p className="rounded-lg bg-surface-2 p-2 text-left text-xs text-text-muted" dir="ltr">
              {this.state.error.message}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-fg hover:brightness-110"
            >
              רענן את הדף
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
