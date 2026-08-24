// ==== רשימות ערכים קבועות ====

export const PATTERN_OPTIONS = [
  'VCP – התכווצות תנודתיות',
  'Cup with Handle – ספל עם ידית',
  'Cup without Handle – ספל ללא ידית',
  'Double Bottom – תחתית כפולה',
  'Flat Base – בסיס שטוח',
  'Saucer with Handle – צלחת עם ידית',
  'Base on Base – בסיס על בסיס',
  'Ascending Base – בסיס עולה',
  'High Tight Flag – דגל גבוה והדוק',
  'Launch Pad – משטח שיגור',
  'Gapper – פער פתיחה משמעותי',
  'Wyckoff – LPS/BUEC',
  'Wyckoff – SOS/JAC Breakout',
  'ללא תבנית ברורה',
] as const
export type PatternType = (typeof PATTERN_OPTIONS)[number]

export const OUTCOME_OPTIONS = ['Success', 'Failure', 'Throwback', 'Shakeout'] as const
export type OutcomeType = (typeof OUTCOME_OPTIONS)[number]

export const CATEGORY_OPTIONS = [
  'עסקה מושלמת',
  'עסקה כישלון',
  'סטופ קצר / החמצה',
  'ניהול טוב',
  'כניסה מוקדמת',
  'רדיפה / FOMO',
] as const

export type PositionStatus = 'פתוחה' | 'פתוחה חלקית' | 'סגורה'
export type WinLoss = 'WIN' | 'LOSS' | ''

export const ACTION_TYPES = ['כניסה', 'חיזוק', 'מכירה חלקית', 'סגירה'] as const
export type ActionType = (typeof ACTION_TYPES)[number]

// ==== לשונית "פוזיציות" ====
export interface Position {
  tradeId: string // מזהה עסקה
  openDate: string // תאריך פתיחה (ISO)
  symbol: string // סימול
  status: PositionStatus // סטאטוס
  pattern: PatternType | string // סוג הגרף (Pattern)
  avgEntryPrice: number // מחיר כניסה ממוצע
  currentShares: number // כמות מניות נוכחית
  originalShares: number // כמות מניות מקורית
  stopLoss: number // מחיר סטופ לוס
  targetPrice: number | null // מחיר יעד
  riskAmount: number // סכום סיכון $
  currentPositionSize: number // גודל פוזיציה נוכחי $
  accountPercentage: number | null // % פוזיציה מהחשבון
  riskPercentage: number | null // % סיכון מהחשבון
  plannedRR: number | null // יחס R/R מתוכנן
  target2R: number | null // יעד 2R
  target3R: number | null // יעד 3R
  target4R: number | null // יעד 4R
  accountBalance: number | null // יתרת חשבון
  realizedPnl: number // רווח/הפסד ממומש $
  realizedR: number | null // R ממומש
  outcome: OutcomeType | '' // תוצאה (Outcome)
  winLoss: WinLoss // WIN/LOSS
  category: string // קטגוריה/תגית
  closeDate: string | null // תאריך סגירה
  setupReason: string // סיבת כניסה/סטאפ
  chartUrl: string // קישור צ'ארט הפוזיציה
  notes: string // הערות
  equity: number | null // שווי מצטבר (equity)
  currentPrice: number | null // מחיר נוכחי (עדכון ידני, לחישוב רווח/הפסד לא ממומש בפוזיציה פתוחה)
  accruedCommission: number // עמלות שנצברו וטרם נוכו (מהכניסה + כל חיזוק), מסולקות במלואן בסגירה הסופית
  isFavorite: boolean // עסקה מסומנת בכוכבית ללמידה/סקירה
}

// ==== לשונית "פעולות" ====
export interface Execution {
  execId: string // מזהה פעולה
  tradeId: string // מזהה עסקה
  timestamp: string // תאריך ושעה (ISO)
  symbol: string // סימול
  actionType: ActionType // סוג פעולה
  price: number // מחיר
  shares: number // כמות מניות
  amount: number // סכום $
  realizedPnlInAction: number // רווח/הפסד ממומש בפעולה $
  notes: string // הערות
}

// ==== לשונית "רשימת מעקב" ====
export type AlertDirection = 'above' | 'below'

export interface WatchlistItem {
  watchId: string // מזהה מעקב
  symbol: string // סימול
  addedDate: string // תאריך הוספה (ISO)
  targetPrice: number | null // מחיר יעד להתראה
  alertDirection: AlertDirection // מעל / מתחת ליעד
  notes: string // הערות
  currentPrice: number | null // מחיר נוכחי (חי, מ-GOOGLEFINANCE)
  alertTriggered: boolean // האם ההתראה כבר הופעלה
  alertTriggeredDate: string | null // מתי ההתראה הופעלה
  listName: string // לאיזו רשימת מעקב הפריט שייך (למשל "הרשימה שלי" / "מעקב שבועי")
  sortOrder: number // סדר תצוגה ידני בתוך הרשימה (מספר קטן יותר = מוצג קודם) — נקבע ע"י המשתמש עם חצי העברה
  // תוכנית מסחר שמורה (נשמרה מהמחשבון בלי לבצע כניסה בפועל) — כשקיימת, אפשר לפתוח
  // אותה שוב במחשבון, לערוך ואז לבצע כניסה אמיתית לעסקה
  plannedEntryPrice: number | null
  plannedStopLoss: number | null
  plannedTargetPrice: number | null
  plannedRiskAmount: number | null
  plannedShares: number | null // כמות מניות מדויקת שהוחלט מראש להיכנס בה (עוקף חישוב לפי סיכון $)
  plannedPattern: string
}

// ==== הגדרות ====
export interface AppSettings {
  webAppUrl: string
  initialCapital: number
  defaultAccountBalance: number
  defaultRiskAmount: number
  /** עמלה קבועה ($) לכל פעולת קנייה/מכירה בודדת (כניסה, חיזוק, מכירה חלקית, סגירה) */
  commissionPerAction: number
}

export interface CalculatorResult {
  shares: number
  positionSize: number
  accountPercentage: number | null
  riskPercentage: number | null
  riskRewardRatio: number | null
  price2R: number
  price3R: number
  price4R: number
  stopLossPercentage: number | null
}

export interface DateRangeFilter {
  preset: 'week' | 'month' | 'lastMonth' | 'year' | 'all' | 'custom' | 'monthYear' | 'yearSpecific'
  from?: string
  to?: string
  month?: number // 0-11
  year?: number
}
