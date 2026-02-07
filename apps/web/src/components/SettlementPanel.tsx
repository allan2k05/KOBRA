/**
 * SettlementPanel — "Settle On-Chain" button + TX flow.
 *
 * Calls Escrow.settle(matchId, winner, signedState) on Base Sepolia.
 * The contract verifies the ClearNode ECDSA signature, then distributes:
 *   - 80% of net pot → winner
 *   - 20% of net pot → loser
 *   - 2% rake → stays in contract
 *
 * If Yellow ClearNode proof is available, uses the real signed state.
 * Otherwise falls back to the server-generated proof hash.
 */

'use client'
import { useState } from 'react'
import { useWriteContract, useSwitchChain, useChainId } from 'wagmi'
import type { FinalGameState } from '../game/types'
import { ESCROW_ADDRESS, CHAIN_BASE_SEPOLIA } from '../lib/constants'

// Escrow ABI — matches contracts/Escrow.sol
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
    finalState: FinalGameState
    yellowProof: {
        signedState: string
        stateHash: string
    } | null
    onSettled: (txHash: string) => void
}

export function SettlementPanel({ finalState, yellowProof, onSettled }: Props) {
    const [status, setStatus] = useState<'idle' | 'signing' | 'pending' | 'confirmed' | 'error'>('idle')
    const [txHash, setTxHash] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const { writeContractAsync } = useWriteContract()
    const { switchChainAsync } = useSwitchChain()
    const currentChainId = useChainId()

    // Convert matchId string to bytes32
    const matchIdBytes32 = (() => {
        const id = finalState.matchId
        // Pad or hash the matchId to get a bytes32
        const hex = Buffer.from(id).toString('hex').padEnd(64, '0').slice(0, 64)
        return `0x${hex}` as `0x${string}`
    })()

    const handleSettle = async () => {
        if (!finalState.winner) {
            setError('Cannot settle a draw')
            return
        }

        setStatus('signing')
        setError(null)

        try {
            // Auto-switch to Base Sepolia if on wrong chain
            if (currentChainId !== CHAIN_BASE_SEPOLIA) {
                try {
                    await switchChainAsync({ chainId: CHAIN_BASE_SEPOLIA })
                } catch (switchErr: any) {
                    setStatus('error')
                    setError('Please switch to Base Sepolia to settle')
                    return
                }
            }

            // Use Yellow ClearNode signed state if available, otherwise use proof hash
            const signedState = (yellowProof?.signedState || finalState.proofHash) as `0x${string}`

            const hash = await writeContractAsync({
                address: ESCROW_ADDRESS,
                abi: ESCROW_ABI,
                chainId: CHAIN_BASE_SEPOLIA,
                functionName: 'settle',
                args: [
                    matchIdBytes32,
                    finalState.winner as `0x${string}`,
                    signedState,
                ],
            })

            setTxHash(hash)
            setStatus('pending')
            onSettled(hash)
        } catch (e: any) {
            console.error('[Settlement] Failed:', e)
            setStatus('error')

            // Parse common error messages
            if (e.message?.includes('User rejected') || e.message?.includes('denied')) {
                setError('Transaction rejected by user')
            } else if (e.message?.includes('Already settled')) {
                setError('Match already settled on-chain')
            } else if (e.message?.includes('Invalid ClearNode')) {
                setError('Proof signature verification failed')
            } else if (e.message?.includes('insufficient funds')) {
                setError('Insufficient gas funds')
            } else if (e.message?.includes('does not match') || e.message?.includes('chain')) {
                setError('Please switch to Base Sepolia network')
            } else {
                setError(e.shortMessage || e.message || 'Settlement failed')
            }
        }
    }

    if (status === 'idle' || status === 'error') {
        return (
            <div className="text-center">
                <button
                    onClick={handleSettle}
                    className="w-full max-w-md bg-green-500 hover:bg-green-600 active:bg-green-700
                        text-black font-bold py-4 rounded-xl font-mono text-lg
                        transition-all shadow-lg shadow-green-500/20
                        hover:shadow-green-500/40 hover:scale-[1.02]"
                >
                    ⛓ Settle On-Chain →
                </button>
                {error && (
                    <div className="mt-3 text-red-400 font-mono text-xs">
                        {error}
                        <button
                            onClick={handleSettle}
                            className="text-cyan-400 hover:underline ml-2"
                        >
                            Retry
                        </button>
                    </div>
                )}
                <div className="mt-2 text-gray-600 font-mono text-xs">
                    Calls Escrow.settle() on Base Sepolia
                </div>
            </div>
        )
    }

    if (status === 'signing') {
        return (
            <div className="text-center py-4">
                <div className="text-yellow-400 font-mono text-sm animate-pulse">
                    ✍️ Sign the settlement transaction in your wallet...
                </div>
            </div>
        )
    }

    if (status === 'pending') {
        return (
            <div className="text-center py-4">
                <div className="text-cyan-400 font-mono text-sm animate-pulse">
                    ⏳ Transaction pending on Base Sepolia...
                </div>
                {txHash && (
                    <a
                        href={`https://sepolia.basescan.org/tx/${txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan-400 text-xs hover:underline mt-2 block font-mono"
                    >
                        Track on BaseScan →
                    </a>
                )}
            </div>
        )
    }

    return null
}
