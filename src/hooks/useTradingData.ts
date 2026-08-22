import * as React from 'react'
import type { AlertDirection, AppSettings, Execution, OutcomeType, PatternType, Position, WatchlistItem } from '@/types'
import { fetchData, postAction, type GeneralNotes } from '@/lib/api'
import {
  loadLocalExecutions,
  loadLocalNotes,
  loadLocalPositions,
  loadLocalWatchlist,
  saveLocalExecutions,
  saveLocalNotes,
  saveLocalPositions,
  saveLocalWatchlist,
} from '@/lib/storage'
import { generateId, nowIso } from '@/lib/utils'
import { calculatePosition } from '@/lib/calculations'

export interface OpenTradeInput {
  symbol: string
  pattern: PatternType | string
  riskAmount: number
  entryPrice: number
  stopLoss: number
  targetPrice: number | null
  accountBalance: number | null
  setupReason: string
  chartUrl: string
  /** תאריך+שעת כניסה מדויקים (ISO). אם לא סופק, נעשה שימוש ברגע הנוכחי */
  openDate?: string
}

export interface AddSharesInput {
  tradeId: string
  price: number
  shares: number
  notes: string
}

export interface TrimInput {
  tradeId: string
  price: number
  shares: number
  notes: string
}

export interface CloseInput {
  tradeId: string
  price: number
  outcome: OutcomeType
  category: string
  notes: string
  /** תאריך+שעת סגירה מדויקים (ISO). אם לא סופק, נעשה שימוש ברגע הנוכחי */
  closeDate?: string
}

export interface UpdatePositionInput {
  tradeId: string
  pattern?: string
  setupReason?: string
  notes?: string
  chartUrl?: string
  currentPrice?: number | null
  stopLoss?: number
  isFavorite?: boolean
}

export interface AddWatchlistInput {
  symbol: string
  targetPrice: number | null
  alertDirection: AlertDirection
  notes: string
  listName: string
  plannedEntryPrice?: number | null
  plannedStopLoss?: number | null
  plannedTargetPrice?: number | null
  plannedRiskAmount?: number | null
  plannedShares?: number | null
  plannedPattern?: string
}

export interface UpdateWatchlistInput {
  watchId: string
  targetPrice?: number | null
  alertDirection?: AlertDirection
  notes?: string
  listName?: string
  plannedEntryPrice?: number | null
  plannedStopLoss?: number | null
  plannedTargetPrice?: number | null
  plannedRiskAmount?: number | null
  plannedShares?: number | null
  plannedPattern?: string
}

function recalcEquity(positions: Position[], initialCapital: number): Position[] {
  const sorted = [...positions].sort((a, b) => {
    const da = a.closeDate || a.openDate
    const db = b.closeDate || b.openDate
    return new Date(da).getTime() - new Date(db).getTime()
  })
  let running = initialCapital
  const equityByTradeId = new Map<string, number>()
  for (const p of sorted) {
    if (p.status === 'סגורה') {
      running += p.realizedPnl
      equityByTradeId.set(p.tradeId, running)
    }
  }
  return positions.map((p) =>
    equityByTradeId.has(p.tradeId) ? { ...p, equity: equityByTradeId.get(p.tradeId)! } : p,
  )
}

export function useTradingData(settings: AppSettings) {
  const [positions, setPositions] = React.useState<Position[]>(() => loadLocalPositions())
  const [executions, setExecutions] = React.useState<Execution[]>(() => loadLocalExecutions())
  const [watchlist, setWatchlist] = React.useState<WatchlistItem[]>(() => loadLocalWatchlist())
  const [notes, setNotes] = React.useState<GeneralNotes>(() => loadLocalNotes())
  const [loading, setLoading] = React.useState(false)
  const [syncError, setSyncError] = React.useState<string | null>(null)

  const persistLocal = React.useCallback((pos: Position[], exec: Execution[]) => {
    saveLocalPositions(pos)
    saveLocalExecutions(exec)
  }, [])

  const refresh = React.useCallback(async () => {
    if (!settings.webAppUrl) return
    setLoading(true)
    setSyncError(null)
    try {
      const data = await fetchData(settings.webAppUrl)
      const recalced = recalcEquity(data.trades, settings.initialCapital)
      setPositions(recalced)
      setExecutions(data.executions)
      setWatchlist(data.watchlist)
      setNotes(data.notes)
      persistLocal(recalced, data.executions)
      saveLocalWatchlist(data.watchlist)
      saveLocalNotes(data.notes)
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'שגיאה לא ידועה בסנכרון')
    } finally {
      setLoading(false)
    }
  }, [settings.webAppUrl, settings.initialCapital, persistLocal])

  React.useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.webAppUrl])

  const openTrade = React.useCallback(
    async (input: OpenTradeInput) => {
      const calc = calculatePosition({
        riskAmount: input.riskAmount,
        entryPrice: input.entryPrice,
        stopLoss: input.stopLoss,
        targetPrice: input.targetPrice,
        accountBalance: input.accountBalance,
      })

      const tradeId = generateId('T')
      const execId = generateId('E')
      const openDate = input.openDate || nowIso()

      const newPosition: Position = {
        tradeId,
        openDate,
        symbol: input.symbol.toUpperCase(),
        status: 'פתוחה',
        pattern: input.pattern,
        avgEntryPrice: input.entryPrice,
        currentShares: calc.shares,
        originalShares: calc.shares,
        stopLoss: input.stopLoss,
        targetPrice: input.targetPrice,
        riskAmount: input.riskAmount,
        currentPositionSize: calc.positionSize,
        accountPercentage: calc.accountPercentage,
        riskPercentage: calc.riskPercentage,
        plannedRR: calc.riskRewardRatio,
        target2R: calc.price2R,
        target3R: calc.price3R,
        target4R: calc.price4R,
        accountBalance: input.accountBalance,
        realizedPnl: 0,
        realizedR: null,
        outcome: '',
        winLoss: '',
        category: '',
        closeDate: null,
        setupReason: input.setupReason,
        chartUrl: input.chartUrl,
        notes: '',
        equity: null,
        currentPrice: null,
        accruedCommission: settings.commissionPerAction,
        isFavorite: false,
      }

      const newExecution: Execution = {
        execId,
        tradeId,
        timestamp: openDate,
        symbol: newPosition.symbol,
        actionType: 'כניסה',
        price: input.entryPrice,
        shares: calc.shares,
        amount: calc.positionSize,
        realizedPnlInAction: 0,
        notes: input.setupReason,
      }

      const nextPositions = [newPosition, ...positions]
      const nextExecutions = [newExecution, ...executions]
      setPositions(nextPositions)
      setExecutions(nextExecutions)
      persistLocal(nextPositions, nextExecutions)

      await postAction(settings.webAppUrl, {
        action: 'open',
        tradeId,
        openDate,
        symbol: newPosition.symbol,
        pattern: input.pattern,
        entryPrice: input.entryPrice,
        stopLoss: input.stopLoss,
        targetPrice: input.targetPrice,
        riskAmount: input.riskAmount,
        accountBalance: input.accountBalance,
        shares: calc.shares,
        positionSize: calc.positionSize,
        accountPercentage: calc.accountPercentage,
        riskPercentage: calc.riskPercentage,
        plannedRR: calc.riskRewardRatio,
        target2R: calc.price2R,
        target3R: calc.price3R,
        target4R: calc.price4R,
        setupReason: input.setupReason,
        chartUrl: input.chartUrl,
        commissionPerAction: settings.commissionPerAction,
      })
      await refresh()
    },
    [positions, executions, persistLocal, settings.webAppUrl, settings.commissionPerAction, refresh],
  )

  const addShares = React.useCallback(
    async (input: AddSharesInput) => {
      const pos = positions.find((p) => p.tradeId === input.tradeId)
      if (!pos) throw new Error('פוזיציה לא נמצאה')

      const newShares = pos.currentShares + input.shares
      const newAvg =
        (pos.currentShares * pos.avgEntryPrice + input.shares * input.price) / newShares
      const timestamp = nowIso()

      const updatedPosition: Position = {
        ...pos,
        currentShares: newShares,
        originalShares: pos.originalShares + input.shares,
        avgEntryPrice: newAvg,
        currentPositionSize: newShares * newAvg,
        accruedCommission: pos.accruedCommission + settings.commissionPerAction,
      }
      const newExecution: Execution = {
        execId: generateId('E'),
        tradeId: pos.tradeId,
        timestamp,
        symbol: pos.symbol,
        actionType: 'חיזוק',
        price: input.price,
        shares: input.shares,
        amount: input.shares * input.price,
        realizedPnlInAction: 0,
        notes: input.notes,
      }

      const nextPositions = positions.map((p) => (p.tradeId === pos.tradeId ? updatedPosition : p))
      const nextExecutions = [newExecution, ...executions]
      setPositions(nextPositions)
      setExecutions(nextExecutions)
      persistLocal(nextPositions, nextExecutions)

      await postAction(settings.webAppUrl, {
        action: 'add',
        tradeId: pos.tradeId,
        price: input.price,
        shares: input.shares,
        notes: input.notes,
        timestamp,
        commissionPerAction: settings.commissionPerAction,
      })
      await refresh()
    },
    [positions, executions, persistLocal, settings.webAppUrl, settings.commissionPerAction, refresh],
  )

  const trimPosition = React.useCallback(
    async (input: TrimInput) => {
      const pos = positions.find((p) => p.tradeId === input.tradeId)
      if (!pos) throw new Error('פוזיציה לא נמצאה')
      if (input.shares >= pos.currentShares) {
        throw new Error('למכירה חלקית הכמות חייבת להיות קטנה מהכמות הנוכחית')
      }

      // מכירה חלקית מנכה רק את העמלה של הפעולה הזו עצמה; העמלה שנצברה מהכניסה/חיזוקים
      // נשארת ל"עמלות שנצברו" ותסולק במלואה בסגירה הסופית
      const pnlInAction = input.shares * (input.price - pos.avgEntryPrice) - settings.commissionPerAction
      const timestamp = nowIso()

      const updatedPosition: Position = {
        ...pos,
        currentShares: pos.currentShares - input.shares,
        realizedPnl: pos.realizedPnl + pnlInAction,
        status: 'פתוחה חלקית',
        currentPositionSize: (pos.currentShares - input.shares) * pos.avgEntryPrice,
      }
      const newExecution: Execution = {
        execId: generateId('E'),
        tradeId: pos.tradeId,
        timestamp,
        symbol: pos.symbol,
        actionType: 'מכירה חלקית',
        price: input.price,
        shares: input.shares,
        amount: input.shares * input.price,
        realizedPnlInAction: pnlInAction,
        notes: input.notes,
      }

      const nextPositions = positions.map((p) => (p.tradeId === pos.tradeId ? updatedPosition : p))
      const nextExecutions = [newExecution, ...executions]
      setPositions(nextPositions)
      setExecutions(nextExecutions)
      persistLocal(nextPositions, nextExecutions)

      await postAction(settings.webAppUrl, {
        action: 'trim',
        tradeId: pos.tradeId,
        price: input.price,
        shares: input.shares,
        notes: input.notes,
        timestamp,
        commissionPerAction: settings.commissionPerAction,
      })
      await refresh()
    },
    [positions, executions, persistLocal, settings.webAppUrl, settings.commissionPerAction, refresh],
  )

  const closeTrade = React.useCallback(
    async (input: CloseInput) => {
      const pos = positions.find((p) => p.tradeId === input.tradeId)
      if (!pos) throw new Error('פוזיציה לא נמצאה')

      // הסגירה הסופית מסלקת גם את העמלה של פעולת הסגירה עצמה וגם את כל העמלות שנצברו
      // מהכניסה ומכל חיזוק לאורך חיי הפוזיציה (ולא סולקו עדיין ע"י מכירות חלקיות)
      const pnlInAction =
        pos.currentShares * (input.price - pos.avgEntryPrice) - settings.commissionPerAction - pos.accruedCommission
      const totalRealizedPnl = pos.realizedPnl + pnlInAction
      const realizedR = pos.riskAmount > 0 ? totalRealizedPnl / pos.riskAmount : null
      const timestamp = input.closeDate || nowIso()

      const updatedPosition: Position = {
        ...pos,
        currentShares: 0,
        realizedPnl: totalRealizedPnl,
        realizedR,
        status: 'סגורה',
        winLoss: totalRealizedPnl >= 0 ? 'WIN' : 'LOSS',
        outcome: input.outcome,
        category: input.category,
        closeDate: timestamp,
        currentPositionSize: 0,
        notes: input.notes ? `${pos.notes ? pos.notes + ' | ' : ''}${input.notes}` : pos.notes,
        accruedCommission: 0,
      }
      const newExecution: Execution = {
        execId: generateId('E'),
        tradeId: pos.tradeId,
        timestamp,
        symbol: pos.symbol,
        actionType: 'סגירה',
        price: input.price,
        shares: pos.currentShares,
        amount: pos.currentShares * input.price,
        realizedPnlInAction: pnlInAction,
        notes: input.notes,
      }

      let nextPositions = positions.map((p) => (p.tradeId === pos.tradeId ? updatedPosition : p))
      nextPositions = recalcEquity(nextPositions, settings.initialCapital)
      const nextExecutions = [newExecution, ...executions]
      setPositions(nextPositions)
      setExecutions(nextExecutions)
      persistLocal(nextPositions, nextExecutions)

      await postAction(settings.webAppUrl, {
        action: 'close',
        tradeId: pos.tradeId,
        price: input.price,
        outcome: input.outcome,
        category: input.category,
        notes: input.notes,
        timestamp,
        commissionPerAction: settings.commissionPerAction,
      })
      await refresh()
    },
    [positions, executions, persistLocal, settings.webAppUrl, settings.initialCapital, settings.commissionPerAction, refresh],
  )

  const updatePosition = React.useCallback(
    async (input: UpdatePositionInput) => {
      const pos = positions.find((p) => p.tradeId === input.tradeId)
      if (!pos) throw new Error('פוזיציה לא נמצאה')

      const updatedPosition: Position = {
        ...pos,
        pattern: input.pattern ?? pos.pattern,
        setupReason: input.setupReason ?? pos.setupReason,
        notes: input.notes ?? pos.notes,
        chartUrl: input.chartUrl ?? pos.chartUrl,
        currentPrice: input.currentPrice !== undefined ? input.currentPrice : pos.currentPrice,
        stopLoss: input.stopLoss ?? pos.stopLoss,
        isFavorite: input.isFavorite ?? pos.isFavorite,
      }

      const nextPositions = positions.map((p) => (p.tradeId === pos.tradeId ? updatedPosition : p))
      setPositions(nextPositions)
      persistLocal(nextPositions, executions)

      await postAction(settings.webAppUrl, {
        action: 'update',
        tradeId: pos.tradeId,
        pattern: input.pattern,
        setupReason: input.setupReason,
        notes: input.notes,
        chartUrl: input.chartUrl,
        currentPrice: input.currentPrice,
        stopLoss: input.stopLoss,
        isFavorite: input.isFavorite,
      })
      await refresh()
    },
    [positions, executions, persistLocal, settings.webAppUrl, refresh],
  )

  const toggleFavorite = React.useCallback(
    async (tradeId: string) => {
      const pos = positions.find((p) => p.tradeId === tradeId)
      if (!pos) throw new Error('פוזיציה לא נמצאה')
      await updatePosition({ tradeId, isFavorite: !pos.isFavorite })
    },
    [positions, updatePosition],
  )

  const deletePosition = React.useCallback(
    async (tradeId: string) => {
      const pos = positions.find((p) => p.tradeId === tradeId)
      if (!pos) throw new Error('פוזיציה לא נמצאה')

      const nextPositions = positions.filter((p) => p.tradeId !== tradeId)
      const nextExecutions = executions.filter((e) => e.tradeId !== tradeId)
      setPositions(nextPositions)
      setExecutions(nextExecutions)
      persistLocal(nextPositions, nextExecutions)

      await postAction(settings.webAppUrl, { action: 'delete', tradeId })
      await refresh()
    },
    [positions, executions, persistLocal, settings.webAppUrl, refresh],
  )

  const persistWatchlist = React.useCallback((wl: WatchlistItem[]) => {
    saveLocalWatchlist(wl)
  }, [])

  const addToWatchlist = React.useCallback(
    async (input: AddWatchlistInput) => {
      const watchId = generateId('W')
      const addedDate = nowIso()

      const newItem: WatchlistItem = {
        watchId,
        symbol: input.symbol.toUpperCase(),
        addedDate,
        targetPrice: input.targetPrice,
        alertDirection: input.alertDirection,
        notes: input.notes,
        currentPrice: null,
        alertTriggered: false,
        alertTriggeredDate: null,
        listName: input.listName,
        plannedEntryPrice: input.plannedEntryPrice ?? null,
        plannedStopLoss: input.plannedStopLoss ?? null,
        plannedTargetPrice: input.plannedTargetPrice ?? null,
        plannedRiskAmount: input.plannedRiskAmount ?? null,
        plannedShares: input.plannedShares ?? null,
        plannedPattern: input.plannedPattern ?? '',
      }

      const next = [newItem, ...watchlist]
      setWatchlist(next)
      persistWatchlist(next)

      await postAction(settings.webAppUrl, {
        action: 'watchlistAdd',
        watchId,
        symbol: newItem.symbol,
        addedDate,
        targetPrice: input.targetPrice,
        alertDirection: input.alertDirection,
        notes: input.notes,
        listName: input.listName,
        plannedEntryPrice: input.plannedEntryPrice,
        plannedStopLoss: input.plannedStopLoss,
        plannedTargetPrice: input.plannedTargetPrice,
        plannedRiskAmount: input.plannedRiskAmount,
        plannedPattern: input.plannedPattern,
      })
      await refresh()
    },
    [watchlist, persistWatchlist, settings.webAppUrl, refresh],
  )

  const updateWatchlistItem = React.useCallback(
    async (input: UpdateWatchlistInput) => {
      const item = watchlist.find((w) => w.watchId === input.watchId)
      if (!item) throw new Error('פריט מעקב לא נמצא')

      const updated: WatchlistItem = {
        ...item,
        targetPrice: input.targetPrice !== undefined ? input.targetPrice : item.targetPrice,
        alertDirection: input.alertDirection ?? item.alertDirection,
        notes: input.notes !== undefined ? input.notes : item.notes,
        listName: input.listName ?? item.listName,
        plannedEntryPrice: input.plannedEntryPrice !== undefined ? input.plannedEntryPrice : item.plannedEntryPrice,
        plannedStopLoss: input.plannedStopLoss !== undefined ? input.plannedStopLoss : item.plannedStopLoss,
        plannedTargetPrice:
          input.plannedTargetPrice !== undefined ? input.plannedTargetPrice : item.plannedTargetPrice,
        plannedRiskAmount: input.plannedRiskAmount !== undefined ? input.plannedRiskAmount : item.plannedRiskAmount,
        plannedShares: input.plannedShares !== undefined ? input.plannedShares : item.plannedShares,
        plannedPattern: input.plannedPattern ?? item.plannedPattern,
        // שינוי יעד/כיוון מאפס את מצב ההתראה בצד הלקוח, בדיוק כמו בשרת
        alertTriggered:
          input.targetPrice !== undefined || input.alertDirection !== undefined ? false : item.alertTriggered,
        alertTriggeredDate:
          input.targetPrice !== undefined || input.alertDirection !== undefined ? null : item.alertTriggeredDate,
      }

      const next = watchlist.map((w) => (w.watchId === input.watchId ? updated : w))
      setWatchlist(next)
      persistWatchlist(next)

      await postAction(settings.webAppUrl, {
        action: 'watchlistUpdate',
        watchId: input.watchId,
        targetPrice: input.targetPrice,
        alertDirection: input.alertDirection,
        notes: input.notes,
        listName: input.listName,
        plannedEntryPrice: input.plannedEntryPrice,
        plannedStopLoss: input.plannedStopLoss,
        plannedTargetPrice: input.plannedTargetPrice,
        plannedRiskAmount: input.plannedRiskAmount,
        plannedShares: input.plannedShares,
        plannedPattern: input.plannedPattern,
      })
      await refresh()
    },
    [watchlist, persistWatchlist, settings.webAppUrl, refresh],
  )

  const deleteFromWatchlist = React.useCallback(
    async (watchId: string) => {
      const next = watchlist.filter((w) => w.watchId !== watchId)
      setWatchlist(next)
      persistWatchlist(next)

      await postAction(settings.webAppUrl, { action: 'watchlistDelete', watchId })
      await refresh()
    },
    [watchlist, persistWatchlist, settings.webAppUrl, refresh],
  )

  const saveNotes = React.useCallback(
    async (input: GeneralNotes) => {
      setNotes(input)
      saveLocalNotes(input)

      await postAction(settings.webAppUrl, {
        action: 'saveNotes',
        generalNotes: input.generalNotes,
        tradingRules: input.tradingRules,
      })
    },
    [settings.webAppUrl],
  )

  return {
    positions,
    executions,
    watchlist,
    notes,
    loading,
    syncError,
    refresh,
    openTrade,
    addShares,
    trimPosition,
    closeTrade,
    updatePosition,
    toggleFavorite,
    deletePosition,
    addToWatchlist,
    updateWatchlistItem,
    deleteFromWatchlist,
    saveNotes,
  }
}
