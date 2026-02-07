/**
 * LiveYellowTicker — Real-time Yellow Network state channel counter.
 *
 * Shows during active gameplay so judges can SEE every signed
 * state update ticking up live. Pulses green on each new state.
 */
'use client'
import { useEffect, useRef, useState } from 'react'

interface Props {
    stateCount: number
    connected: boolean
}

export function LiveYellowTicker({ stateCount, connected }: Props) {
    const prevCount = useRef(stateCount)
    const [pulse, setPulse] = useState(false)

    // Pulse animation on every new state update
    useEffect(() => {
        if (stateCount > prevCount.current) {
            setPulse(true)
            const t = setTimeout(() => setPulse(false), 200)
            prevCount.current = stateCount
            return () => clearTimeout(t)
        }
    }, [stateCount])

    return (
        <div className="flex items-center gap-3 bg-black/90 border border-green-500/30 rounded-xl px-4 py-2.5 backdrop-blur-sm shadow-lg shadow-green-500/10">
            {/* Live dot */}
            <div className="relative flex items-center justify-center">
                <div className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-green-400' : 'bg-gray-600'}`} />
                {connected && (
                    <div className="absolute w-2.5 h-2.5 rounded-full bg-green-400 animate-ping opacity-75" />
                )}
            </div>

            {/* Label + Count */}
            <div className="font-mono text-xs leading-tight">
                <div className="text-gray-500 uppercase tracking-widest" style={{ fontSize: '9px' }}>
                    Yellow State Channel
                </div>
                <div className="flex items-baseline gap-1.5">
                    <span
                        className={`text-lg font-bold tabular-nums transition-all duration-150 ${
                            pulse ? 'text-green-300 scale-110' : 'text-green-400'
                        }`}
                        style={{ transformOrigin: 'left center' }}
                    >
                        {stateCount}
                    </span>
                    <span className="text-gray-600 text-xs">states signed</span>
                </div>
            </div>

            {/* Visual activity bar */}
            <div className="flex gap-0.5 items-end h-4 ml-2">
                {Array.from({ length: 6 }).map((_, i) => {
                    const active = connected && stateCount > 0
                    const height = active
                        ? `${40 + Math.sin((Date.now() / 300) + i * 1.2) * 30 + 30}%`
                        : '20%'
                    return (
                        <div
                            key={i}
                            className={`w-1 rounded-full transition-all duration-300 ${
                                active ? 'bg-green-400/60' : 'bg-gray-700'
                            }`}
                            style={{ height, minHeight: '3px' }}
                        />
                    )
                })}
            </div>
        </div>
    )
}
