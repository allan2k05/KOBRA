/**
 * GasOraclePanel — Shows what the state channel updates would cost on-chain.
 *
 * Math: stateCount × $0.0672 (21k gas × 1 gwei × $3200/ETH) = hypothetical cost.
 * Yellow Network: $0.00.
 * The contrast is the entire point.
 */
'use client'
import { useMemo } from 'react'
import { USD_PER_UPDATE, GAS_PER_UPDATE, BASE_GAS_GWEI, ETH_USD } from '../lib/constants'

interface Props {
    stateCount: number
    connected: boolean
}

export function GasOraclePanel({ stateCount, connected }: Props) {
    const { onChainCost, gasUsed, txCount } = useMemo(() => ({
        onChainCost: (stateCount * USD_PER_UPDATE).toFixed(2),
        gasUsed: (stateCount * GAS_PER_UPDATE).toLocaleString(),
        txCount: stateCount.toLocaleString(),
    }), [stateCount])

    if (!connected || stateCount === 0) return null

    return (
        <div className="bg-black/90 border-2 border-cyan-500/30 rounded-2xl px-8 py-5 backdrop-blur-sm shadow-2xl shadow-cyan-500/10">
            <div className="font-mono leading-tight">
                <div className="text-gray-400 uppercase tracking-widest text-xs font-semibold mb-2">
                    Gas Oracle — Base L2
                </div>

                {/* Main comparison */}
                <div className="flex items-center gap-5">
                    {/* On-chain cost */}
                    <div className="text-center">
                        <div className="text-red-400 font-bold text-3xl tabular-nums line-through decoration-red-500/50">
                            ${onChainCost}
                        </div>
                        <div className="text-gray-600 text-xs font-medium mt-1">
                            {txCount} on-chain txs
                        </div>
                    </div>

                    <div className="text-gray-500 text-2xl">→</div>

                    {/* Yellow cost */}
                    <div className="text-center">
                        <div className="text-green-400 font-bold text-3xl">
                            $0.00
                        </div>
                        <div className="text-gray-600 text-xs font-medium mt-1">
                            Yellow Network
                        </div>
                    </div>
                </div>

                {/* Detail line */}
                <div className="text-gray-600 mt-2 flex items-center gap-1.5 text-xs">
                    <span>{gasUsed} gas</span>
                    <span>•</span>
                    <span>{BASE_GAS_GWEI} gwei</span>
                    <span>•</span>
                    <span>${ETH_USD} ETH</span>
                </div>
            </div>
        </div>
    )
}
