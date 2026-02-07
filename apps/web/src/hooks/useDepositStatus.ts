/**
 * Tracks LI.FI deposit lifecycle — integrates with widget events.
 *
 * States:
 *   idle        → waiting for user action
 *   routing     → route selected, execution starting
 *   executing   → on-chain txs in progress
 *   completed   → bridge/swap finished, funds arrived at escrow
 *   failed      → execution error (user can retry)
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { useWidgetEvents, WidgetEvent } from '@lifi/widget'
import type { Route, Process } from '@lifi/sdk'

export type DepositPhase = 'idle' | 'routing' | 'executing' | 'completed' | 'failed'

export interface DepositState {
    phase: DepositPhase
    txHash: string | null
    route: Route | null
    /** Human-readable status line */
    statusMessage: string
    /** USD value being bridged */
    fromAmountUSD: string
    /** Estimated gas cost in USD */
    gasCostUSD: string
    /** Error detail when phase === 'failed' */
    error: string | null
    /** Number of retry attempts */
    retryCount: number
}

const INITIAL_STATE: DepositState = {
    phase: 'idle',
    txHash: null,
    route: null,
    statusMessage: 'Select source token & amount',
    fromAmountUSD: '',
    gasCostUSD: '',
    error: null,
    retryCount: 0,
}

export function useDepositStatus() {
    const [state, setState] = useState<DepositState>(INITIAL_STATE)
    const emitter = useWidgetEvents()
    const retryRef = useRef(0)

    // ── Route selected ──
    useEffect(() => {
        const handler = ({ route }: { route: Route; routes: Route[] }) => {
            const gasCost = route.steps.reduce((sum, step) => {
                const est = step.estimate
                return sum + Number(est.gasCosts?.reduce((g: number, c: any) => g + Number(c.amountUSD || 0), 0) || 0)
            }, 0)
            setState(prev => ({
                ...prev,
                phase: 'routing',
                route,
                statusMessage: `Route via ${route.steps.map(s => s.toolDetails.name).join(' → ')}`,
                fromAmountUSD: route.fromAmountUSD || '',
                gasCostUSD: gasCost.toFixed(2),
                error: null,
            }))
        }
        emitter.on(WidgetEvent.RouteSelected, handler)
        return () => { emitter.off(WidgetEvent.RouteSelected, handler) }
    }, [emitter])

    // ── Execution started ──
    useEffect(() => {
        const handler = (route: Route) => {
            setState(prev => ({
                ...prev,
                phase: 'executing',
                route,
                statusMessage: 'Transaction submitted — bridging in progress…',
                error: null,
            }))
        }
        emitter.on(WidgetEvent.RouteExecutionStarted, handler)
        return () => { emitter.off(WidgetEvent.RouteExecutionStarted, handler) }
    }, [emitter])

    // ── Execution update (progress) ──
    useEffect(() => {
        const handler = ({ route, process }: { route: Route; process: Process }) => {
            const hash = (process as any).txHash || (process as any).transactionHash || null
            setState(prev => ({
                ...prev,
                phase: 'executing',
                route,
                txHash: hash || prev.txHash,
                statusMessage: process.message || 'Processing…',
            }))
        }
        emitter.on(WidgetEvent.RouteExecutionUpdated, handler)
        return () => { emitter.off(WidgetEvent.RouteExecutionUpdated, handler) }
    }, [emitter])

    // ── Execution completed ──
    useEffect(() => {
        const handler = (route: Route) => {
            setState(prev => ({
                ...prev,
                phase: 'completed',
                route,
                statusMessage: 'Deposit confirmed ✓',
                error: null,
            }))
        }
        emitter.on(WidgetEvent.RouteExecutionCompleted, handler)
        return () => { emitter.off(WidgetEvent.RouteExecutionCompleted, handler) }
    }, [emitter])

    // ── Execution failed ──
    useEffect(() => {
        const handler = ({ route, process }: { route: Route; process: Process }) => {
            const errorMsg = process.message || 'Transaction failed'
            // Classify error
            let userMessage = errorMsg
            if (errorMsg.toLowerCase().includes('slippage')) {
                userMessage = 'Slippage exceeded — try increasing slippage tolerance or reducing amount.'
            } else if (errorMsg.toLowerCase().includes('insufficient') || errorMsg.toLowerCase().includes('balance')) {
                userMessage = 'Insufficient balance for this transaction.'
            } else if (errorMsg.toLowerCase().includes('rejected') || errorMsg.toLowerCase().includes('denied')) {
                userMessage = 'Transaction rejected in wallet.'
            } else if (errorMsg.toLowerCase().includes('gas')) {
                userMessage = 'Not enough gas to complete the transaction.'
            } else if (errorMsg.toLowerCase().includes('timeout')) {
                userMessage = 'Bridge transaction timed out — funds are safe, check your wallet.'
            }
            retryRef.current += 1
            setState(prev => ({
                ...prev,
                phase: 'failed',
                route,
                statusMessage: 'Transaction failed',
                error: userMessage,
                retryCount: retryRef.current,
            }))
        }
        emitter.on(WidgetEvent.RouteExecutionFailed, handler)
        return () => { emitter.off(WidgetEvent.RouteExecutionFailed, handler) }
    }, [emitter])

    // ── High value-loss warning ──
    useEffect(() => {
        const handler = (update: any) => {
            if (Number(update.valueLoss) > 5) {
                setState(prev => ({
                    ...prev,
                    statusMessage: `⚠ High value loss: ${Number(update.valueLoss).toFixed(1)}% — consider a different route`,
                }))
            }
        }
        emitter.on(WidgetEvent.RouteHighValueLoss, handler)
        return () => { emitter.off(WidgetEvent.RouteHighValueLoss, handler) }
    }, [emitter])

    const reset = useCallback(() => {
        retryRef.current = 0
        setState(INITIAL_STATE)
    }, [])

    const markDeposited = useCallback((hash: string) => {
        setState(prev => ({
            ...prev,
            phase: 'completed',
            txHash: hash,
            statusMessage: 'Deposit confirmed ✓',
        }))
    }, [])

    return { ...state, reset, markDeposited }
}
