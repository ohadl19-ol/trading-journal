import * as React from 'react'
import type { AppSettings, Execution, OutcomeType, PatternType, Position } from '@/types'
import { fetchData, postAction } from '@/lib/api'
import {
  loadLocalExecutions,
  loadLocalPositions,
  saveLocalExecutions,
  saveLocalPositions,
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
}

export interface UpdatePositionInput {
  tradeId: string
  pattern?: string
  setupReason?: string
  notes?: string
  chartUrl?: string
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
      persistLocal(recalced, data.executions)
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
      const openDate = nowIso()

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
        setupReason: input.setupReason,
        chartUrl: input.chartUrl,
      })
      await refresh()
    },
    [positions, executions, persistLocal, settings.webAppUrl, refresh],
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
      })
      await refresh()
    },
    [positions, executions, persistLocal, settings.webAppUrl, refresh],
  )

  const trimPosition = React.useCallback(
    async (input: TrimInput) => {
      const pos = positions.find((p) => p.tradeId === input.tradeId)
      if (!pos) throw new Error('פוזיציה לא נמצאה')
      if (input.shares >= pos.currentShares) {
        throw new Error('למכירה חלקית הכמות חייבת להיות קטנה מהכמות הנוכחית')
      }

      const pnlInAction = input.shares * (input.price - pos.avgEntryPrice)
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
      })
      await refresh()
    },
    [positions, executions, persistLocal, settings.webAppUrl, refresh],
  )

  const closeTrade = React.useCallback(
    async (input: CloseInput) => {
      const pos = positions.find((p) => p.tradeId === input.tradeId)
      if (!pos) throw new Error('פוזיציה לא נמצאה')

      const pnlInAction = pos.currentShares * (input.price - pos.avgEntryPrice)
      const totalRealizedPnl = pos.realizedPnl + pnlInAction
      const realizedR = pos.riskAmount > 0 ? totalRealizedPnl / pos.riskAmount : null
      const timestamp = nowIso()

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
      })
      await refresh()
    },
    [positions, executions, persistLocal, settings.webAppUrl, settings.initialCapital, refresh],
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
      })
      await refresh()
    },
    [positions, executions, persistLocal, settings.webAppUrl, refresh],
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

  return {
    positions,
    executions,
    loading,
    syncError,
    refresh,
    openTrade,
    addShares,
    trimPosition,
    closeTrade,
    updatePosition,
    deletePosition,
  }
}
