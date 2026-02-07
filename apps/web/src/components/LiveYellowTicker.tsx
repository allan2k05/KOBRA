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
        <div className="flex items-center gap-5 bg-black/90 border-2 border-green-500/40 rounded-2xl px-8 py-5 backdrop-blur-sm shadow-2xl shadow-green-500/20">
            {/* Live dot */}
            <div className="relative flex items-center justify-center">
                <div className={`w-4 h-4 rounded-full ${connected ? 'bg-green-400' : 'bg-gray-600'}`} />
                {connected && (
                    <div className="absolute w-4 h-4 rounded-full bg-green-400 animate-ping opacity-75" />
                )}
            </div>

            {/* Label + Count */}
            <div className="font-mono leading-tight">
                <div className="text-gray-400 uppercase tracking-widest text-xs font-semibold mb-1">
                    Yellow State Channel
                </div>
                <div className="flex items-baseline gap-2.5">
                    <span
                        className={`text-4xl font-bold tabular-nums transition-all duration-150 ${
                            pulse ? 'text-green-300 scale-110' : 'text-green-400'
                        }`}
                        style={{ transformOrigin: 'left center' }}
                    >
                        {stateCount}
                    </span>
                    <span className="text-gray-500 text-base font-medium">states signed</span>
                </div>
            </div>

            {/* Visual activity bar */}
            <div className="flex gap-1 items-end h-8 ml-3">
                {Array.from({ length: 6 }).map((_, i) => {
                    const active = connected && stateCount > 0
                    const height = active
                        ? `${40 + Math.sin((Date.now() / 300) + i * 1.2) * 30 + 30}%`
                        : '20%'
                    return (
                        <div
                            key={i}
                            className={`w-2 rounded-full transition-all duration-300 ${
                                active ? 'bg-green-400/60' : 'bg-gray-700'
                            }`}
                            style={{ height, minHeight: '4px' }}
                        />
                    )
                })}
            </div>
        </div>
    )
}
