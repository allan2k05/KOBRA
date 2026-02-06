/**
 * Rendered on top of the game canvas during every match.
 * Three numbers that judges stare at:
 *   1. Off-chain state updates (live counter, ticks up smoothly)
 *   2. What it would cost on-chain (red, ticks up with it)
 *   3. What you actually paid ($0.00, cyan, always zero)
 *
 * Plus a pulsing LIVE badge while the session is active.
 * The counter animates frame-by-frame — it never jumps.
 */

'use client'
import { useState, useEffect, useRef } from 'react'
import { formatGasComparison } from '../lib/gasOracle'

interface Props {
    stateCount: number
    matchActive: boolean
}

export function LiveGameOverlay({ stateCount, matchActive }: Props) {
    const [display, setDisplay] = useState(0)
    const animRef = useRef<number>(0)

    // Smooth animated counter — increments one per frame until caught up
    useEffect(() => {
        const step = () => {
            setDisplay(prev => {
                if (prev >= stateCount) return prev
                return prev + 1
            })
            animRef.current = requestAnimationFrame(step)
        }
        animRef.current = requestAnimationFrame(step)
        return () => cancelAnimationFrame(animRef.current)
    }, [stateCount])

    const { wouldCostUSD, actuallyPaidUSD } = formatGasComparison(display)

    return (
        <div className="absolute top-4 right-4 z-20
                    bg-black/85 backdrop-blur-md
                    border border-gray-800 rounded-2xl
                    p-5 w-72 shadow-2xl">

            {/* LIVE badge */}
            {matchActive && (
                <div className="flex items-center gap-2 mb-4">
                    <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse shadow-lg shadow-green-400/40" />
                    <span className="text-xs text-green-400 font-mono tracking-widest uppercase font-semibold">
                        Live · State Channel Active
                    </span>
                </div>
            )}

            {/* Three stat blocks in a row */}
            <div className="grid grid-cols-3 gap-2 text-center">

                {/* Off-chain state count */}
                <div className="bg-gray-900/60 rounded-xl p-3">
                    <div className="text-2xl font-bold text-green-400 font-mono tabular-nums">
                        {display.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500 mt-1 uppercase tracking-wider">States</div>
                </div>

                {/* Would-have-cost oracle — THE number judges remember */}
                <div className="bg-gray-900/60 rounded-xl p-3">
                    <div className="text-2xl font-bold text-red-400 font-mono tabular-nums">
                        {wouldCostUSD}
                    </div>
                    <div className="text-xs text-gray-500 mt-1 uppercase tracking-wider">On-chain</div>
                </div>

                {/* Actual cost — always zero */}
                <div className="bg-gray-900/60 rounded-xl p-3">
                    <div className="text-2xl font-bold text-cyan-400 font-mono">
                        {actuallyPaidUSD}
                    </div>
                    <div className="text-xs text-gray-500 mt-1 uppercase tracking-wider">Paid</div>
                </div>
            </div>

            {/* Small label under the grid */}
            <div className="mt-3 text-center text-xs text-gray-600 font-mono">
                Every tick is signed by ClearNode
            </div>
        </div>
    )
}
