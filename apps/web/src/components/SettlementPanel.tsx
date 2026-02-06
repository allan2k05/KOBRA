/**
 * Shown on the results screen after the game ends.
 * Shows:
 *   1. The ClearNode-signed state hash (the cryptographic proof)
 *   2. Timing comparison: game duration + state count → 1 tx settlement
 *   3. "Settle On-Chain" button → calls escrow.settle()
 *   4. TX receipt + BaseScan link
 *
 * This is the "oh damn" moment of the demo.
 */

'use client'
import { useState } from 'react'
import { useWriteContract } from 'wagmi'
import { SettlementProof } from '../lib/yellow'
import { ESCROW_ADDRESS, CHAIN_BASE_SEPOLIA } from '../lib/constants'

// Minimal escrow ABI — settle(bytes32 matchId, address winner, bytes signedState)
const ESCROW_ABI = [
    {
        name: 'settle',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'matchId', type: 'bytes32' },
            { name: 'winner', type: 'address' },
            { name: 'signedState', type: 'bytes' },
        ],
        outputs: [],
    },
] as const

interface Props {
    proof: SettlementProof
    stateCount: number
    matchDurationMs: number
}

export function SettlementPanel({ proof, stateCount, matchDurationMs }: Props) {
    const [settlementMs, setSettlementMs] = useState<number | null>(null)
    const [txHash, setTxHash] = useState<string | null>(null)
    const { writeContractAsync } = useWriteContract()

    const handleSettle = async () => {
        const start = Date.now()
        try {
            const hash = await writeContractAsync({
                address: ESCROW_ADDRESS,
                abi: ESCROW_ABI,
                chainId: CHAIN_BASE_SEPOLIA,
                functionName: 'settle',
                args: [
                    proof.matchId as `0x${string}`,
                    proof.winner as `0x${string}`,
                    proof.signedState as `0x${string}`,
                ],
            })
            setTxHash(hash)
            setSettlementMs(Date.now() - start)
        } catch (e) {
            console.error('[Settlement] Failed', e)
        }
    }

    const gameSeconds = (matchDurationMs / 1000).toFixed(1)
    const settleSeconds = settlementMs ? (settlementMs / 1000).toFixed(1) : null

    return (
        <div className="bg-black/90 border border-gray-800 rounded-2xl p-6 w-full max-w-md mx-auto shadow-2xl">
            <h3 className="text-white font-bold text-lg mb-5 font-mono flex items-center gap-2">
                <span className="text-green-400">⛓</span> Settlement Proof
            </h3>

            {/* The signed state hash — this IS the proof */}
            <div className="bg-gray-900 rounded-xl p-4 mb-4">
                <div className="text-xs text-gray-500 uppercase tracking-widest mb-2 font-mono">
                    ClearNode Signed State Hash
                </div>
                <div className="text-green-400 font-mono text-sm break-all leading-relaxed">
                    {proof.stateHash}
                </div>
            </div>

            {/* Timing comparison: game → settlement */}
            <div className="flex items-center gap-4 bg-gray-900 rounded-xl p-4 mb-4">
                <div className="flex-1 text-center">
                    <div className="text-white font-bold font-mono text-lg">{gameSeconds}s</div>
                    <div className="text-xs text-gray-500 font-mono">{stateCount} states</div>
                    <div className="text-xs text-gray-600 mt-0.5">Game</div>
                </div>
                <div className="text-gray-600 text-xl">→</div>
                <div className="flex-1 text-center">
                    <div className="text-white font-bold font-mono text-lg">
                        {settleSeconds ? `${settleSeconds}s` : '—'}
                    </div>
                    <div className="text-xs text-gray-500 font-mono">1 transaction</div>
                    <div className="text-xs text-gray-600 mt-0.5">Settlement</div>
                </div>
            </div>

            {/* Settle button — or TX receipt */}
            {!txHash ? (
                <button
                    onClick={handleSettle}
                    className="w-full bg-green-500 hover:bg-green-600 active:bg-green-700
                     text-black font-bold py-3.5 rounded-xl font-mono
                     transition-colors shadow-lg shadow-green-500/20"
                >
                    Settle On-Chain →
                </button>
            ) : (
                <div className="bg-green-900/30 border border-green-800 rounded-xl p-4 text-center">
                    <div className="text-green-400 font-mono font-bold">✓ Settled</div>
                    <div className="text-gray-400 font-mono text-xs mt-1">
                        {txHash.slice(0, 10)}…{txHash.slice(-6)}
                    </div>
                    <a
                        href={`https://sepolia.basescan.org/tx/${txHash}`}
                        target="_blank" rel="noopener noreferrer"
                        className="text-cyan-400 text-xs hover:underline mt-2 block font-mono"
                    >
                        View on BaseScan →
                    </a>
                </div>
            )}
        </div>
    )
}
