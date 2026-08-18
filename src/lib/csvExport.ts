import type { Execution, Position } from '@/types'

function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(escapeCsvField).join(',')]
  for (const row of rows) {
    lines.push(row.map(escapeCsvField).join(','))
  }
  // BOM כדי ש-Excel יזהה נכון קידוד UTF-8 ועברית
  return '﻿' + lines.join('\r\n')
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

const POSITIONS_HEADERS = [
  'מזהה עסקה', 'תאריך פתיחה', 'סימול', 'סטאטוס', 'סוג הגרף', 'מחיר כניסה ממוצע',
  'כמות מניות נוכחית', 'כמות מניות מקורית', 'מחיר סטופ לוס', 'מחיר יעד', 'סכום סיכון $',
  'גודל פוזיציה נוכחי $', '% פוזיציה מהחשבון', '% סיכון מהחשבון', 'יחס R/R מתוכנן',
  'יעד 2R', 'יעד 3R', 'יתרת חשבון', 'רווח/הפסד ממומש $', 'R ממומש', 'תוצאה', 'WIN/LOSS',
  'קטגוריה/תגית', 'תאריך סגירה', 'סיבת כניסה/סטאפ', 'קישור צ׳ארט', 'הערות',
  'שווי מצטבר', 'מחיר נוכחי', 'עמלות שנצברו', 'מועדף',
]

function positionToRow(p: Position): unknown[] {
  return [
    p.tradeId, p.openDate, p.symbol, p.status, p.pattern, p.avgEntryPrice,
    p.currentShares, p.originalShares, p.stopLoss, p.targetPrice, p.riskAmount,
    p.currentPositionSize, p.accountPercentage, p.riskPercentage, p.plannedRR,
    p.target2R, p.target3R, p.accountBalance, p.realizedPnl, p.realizedR, p.outcome,
    p.winLoss, p.category, p.closeDate, p.setupReason, p.chartUrl, p.notes, p.equity,
    p.currentPrice, p.accruedCommission, p.isFavorite,
  ]
}

const EXECUTIONS_HEADERS = [
  'מזהה פעולה', 'מזהה עסקה', 'תאריך ושעה', 'סימול', 'סוג פעולה', 'מחיר',
  'כמות מניות', 'סכום $', 'רווח/הפסד ממומש בפעולה $', 'הערות',
]

function executionToRow(e: Execution): unknown[] {
  return [
    e.execId, e.tradeId, e.timestamp, e.symbol, e.actionType, e.price,
    e.shares, e.amount, e.realizedPnlInAction, e.notes,
  ]
}

/** בונה את תוכן ה-CSV של הפוזיציות כמחרוזת (לשימוש חוזר, למשל בארזת ZIP) */
export function buildPositionsCsv(positions: Position[]): string {
  return toCsv(POSITIONS_HEADERS, positions.map(positionToRow))
}

/** בונה את תוכן ה-CSV של הפעולות כמחרוזת */
export function buildExecutionsCsv(executions: Execution[]): string {
  return toCsv(EXECUTIONS_HEADERS, executions.map(executionToRow))
}

/** מייצא את כל הפוזיציות והפעולות לקובץ CSV אחד לגיבוי מקומי עצמאי */
export function exportBackupCsv(positions: Position[], executions: Execution[]) {
  exportPositionsCsv(positions, executions, 'יומן-מסחר')
}

/**
 * מייצא רק את הפוזיציות שמוצגות כרגע (אחרי סינון) + הפעולות שלהן — כדי לאפשר
 * הורדה קלה של תת-קבוצה ספציפית (למשל "כל מה שהרווחתי בחודש שעבר") להעברה
 * לניתוח חיצוני (כמו ChatGPT).
 */
export function exportFilteredCsv(filteredPositions: Position[], allExecutions: Execution[]) {
  const tradeIds = new Set(filteredPositions.map((p) => p.tradeId))
  const filteredExecutions = allExecutions.filter((e) => tradeIds.has(e.tradeId))
  exportPositionsCsv(filteredPositions, filteredExecutions, 'יומן-מסחר-מסונן')
}

function exportPositionsCsv(positions: Position[], executions: Execution[], filePrefix: string) {
  const date = new Date().toISOString().slice(0, 10)

  downloadCsv(`${filePrefix}-פוזיציות-${date}.csv`, buildPositionsCsv(positions))
  downloadCsv(`${filePrefix}-פעולות-${date}.csv`, buildExecutionsCsv(executions))
}
