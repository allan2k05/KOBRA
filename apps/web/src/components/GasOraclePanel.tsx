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
        <div className="bg-black/90 border border-cyan-500/20 rounded-xl px-4 py-2.5 backdrop-blur-sm shadow-lg shadow-cyan-500/5">
            <div className="font-mono text-xs leading-tight">
                <div className="text-gray-500 uppercase tracking-widest mb-1" style={{ fontSize: '9px' }}>
                    Gas Oracle — Base L2
                </div>

                {/* Main comparison */}
                <div className="flex items-center gap-3">
                    {/* On-chain cost */}
                    <div className="text-center">
                        <div className="text-red-400 font-bold text-sm tabular-nums line-through decoration-red-500/50">
                            ${onChainCost}
                        </div>
                        <div className="text-gray-600" style={{ fontSize: '8px' }}>
                            {txCount} on-chain txs
                        </div>
                    </div>

                    <div className="text-gray-600">→</div>

                    {/* Yellow cost */}
                    <div className="text-center">
                        <div className="text-green-400 font-bold text-sm">
                            $0.00
                        </div>
                        <div className="text-gray-600" style={{ fontSize: '8px' }}>
                            Yellow Network
                        </div>
                    </div>
                </div>

                {/* Detail line */}
                <div className="text-gray-700 mt-1 flex items-center gap-1" style={{ fontSize: '8px' }}>
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
