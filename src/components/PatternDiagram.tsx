import type { ReactNode } from 'react'

interface PatternDiagramProps {
  pattern: string
}

const STROKE = '#60a5fa' // accent, קבוע כדי לשמור על ניגודיות בשני מצבי התצוגה
const MUTED = '#5b6b7b'
const WIN = '#22c55e'
const LOSS = '#ef4444'

// כל דיאגרמה מצוירת ב-viewBox קבוע 0 0 240 100 כדי לשמור על יחס אחיד בכל הכרטיסים
const VB = '0 0 240 100'

function Frame({ children }: { children: ReactNode }) {
  return (
    <svg viewBox={VB} className="h-24 w-full" preserveAspectRatio="none">
      {children}
    </svg>
  )
}

export function PatternDiagram({ pattern }: PatternDiagramProps) {
  switch (pattern) {
    case 'Breakout':
      return (
        <Frame>
          <line x1="10" y1="35" x2="150" y2="35" stroke={MUTED} strokeDasharray="4 3" strokeWidth="1.5" />
          <polyline
            points="10,70 40,55 70,60 100,45 130,50 150,35 165,20 195,15 225,10"
            fill="none"
            stroke={STROKE}
            strokeWidth="2.5"
          />
          <circle cx="150" cy="35" r="3.5" fill={WIN} />
        </Frame>
      )
    case 'Breakout + Retest':
      return (
        <Frame>
          <line x1="10" y1="45" x2="230" y2="45" stroke={MUTED} strokeDasharray="4 3" strokeWidth="1.5" />
          <polyline
            points="10,75 40,60 70,65 100,45 120,25 140,45 160,42 185,20 210,15 230,10"
            fill="none"
            stroke={STROKE}
            strokeWidth="2.5"
          />
          <circle cx="100" cy="45" r="3.5" fill={WIN} />
          <circle cx="140" cy="45" r="3.5" fill={WIN} />
        </Frame>
      )
    case 'Bull Flag':
      return (
        <Frame>
          <polyline points="10,85 30,60 50,40 65,18" fill="none" stroke={STROKE} strokeWidth="2.5" />
          <polyline
            points="65,18 90,28 110,22 130,34 150,28 165,38"
            fill="none"
            stroke={MUTED}
            strokeWidth="2"
          />
          <polyline points="165,38 190,25 210,14 230,6" fill="none" stroke={STROKE} strokeWidth="2.5" />
          <circle cx="165" cy="38" r="3.5" fill={WIN} />
        </Frame>
      )
    case 'Cup with Handle':
      return (
        <Frame>
          <path
            d="M15,25 C15,25 45,85 110,85 C175,85 200,25 200,25"
            fill="none"
            stroke={STROKE}
            strokeWidth="2.5"
          />
          <polyline points="200,25 210,20 218,32 226,18 234,8" fill="none" stroke={STROKE} strokeWidth="2.5" />
          <circle cx="218" cy="32" r="3.5" fill={WIN} />
        </Frame>
      )
    case 'VCP':
      return (
        <Frame>
          <polyline
            points="10,80 35,35 55,50 75,25 90,38 105,20 118,30 130,16 140,24 150,14"
            fill="none"
            stroke={STROKE}
            strokeWidth="2.5"
          />
          <polyline points="150,14 175,10 205,4 230,-2" fill="none" stroke={STROKE} strokeWidth="2.5" opacity="0.9" />
          <circle cx="55" cy="50" r="2.5" fill={MUTED} />
          <circle cx="90" cy="38" r="2.5" fill={MUTED} />
          <circle cx="118" cy="30" r="2.5" fill={MUTED} />
          <circle cx="140" cy="24" r="3.5" fill={WIN} />
        </Frame>
      )
    case 'LPS':
      return (
        <Frame>
          <path d="M10,80 Q60,20 230,45" fill="none" stroke={MUTED} strokeDasharray="4 3" strokeWidth="1.5" />
          <polyline
            points="10,60 40,45 70,50 100,38 130,42 150,40 165,42"
            fill="none"
            stroke={STROKE}
            strokeWidth="2.5"
          />
          <polyline points="165,42 190,25 210,14 230,6" fill="none" stroke={STROKE} strokeWidth="2.5" />
          <circle cx="165" cy="42" r="3.5" fill={WIN} />
        </Frame>
      )
    case 'Inside Candle': {
      const candle = (x: number, top: number, bottom: number, color: string) => (
        <line key={x} x1={x} y1={top} x2={x} y2={bottom} stroke={color} strokeWidth="10" strokeLinecap="round" />
      )
      return (
        <Frame>
          {candle(70, 15, 85, MUTED)}
          {candle(120, 35, 65, STROKE)}
          {candle(170, 42, 58, WIN)}
        </Frame>
      )
    }
    case 'FOMO / No Setup':
      return (
        <Frame>
          <polyline
            points="10,85 40,80 70,70 95,55 115,35 130,15 145,5"
            fill="none"
            stroke={LOSS}
            strokeWidth="2.5"
          />
          <circle cx="145" cy="5" r="3.5" fill={LOSS} />
          <polyline points="145,5 175,20 205,45 230,60" fill="none" stroke={LOSS} strokeWidth="2.5" strokeDasharray="3 3" />
        </Frame>
      )
    default:
      return (
        <Frame>
          <polyline
            points="10,55 40,45 70,60 100,40 130,55 160,42 190,58 220,45"
            fill="none"
            stroke={MUTED}
            strokeWidth="2"
          />
        </Frame>
      )
  }
}
