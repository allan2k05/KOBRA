/**
 * ResultsScreen — Full post-game results with settlement flow.
 *
 * Shows:  Winner / Loser + Scores + Proof Hash + Payout Breakdown
 * Action: "Settle On-Chain" → Escrow.settle() on Base Sepolia
 *         "Play Again" → Back to Lobby
 *
 * This is the centerpiece of the Yellow Network integration demo.
 */
'use client'
import { useState, useMemo } from 'react'
import { useAccount } from 'wagmi'
import type { FinalGameState } from '../game/types'
import { SettlementPanel } from './SettlementPanel'
import { PlayerBadge } from './PlayerBadge'
import Link from 'next/link'

interface Props {
    finalState: FinalGameState
    playerAddress: string
    yellowProof: {
        signedState: string
        stateHash: string
    } | null
    stateCount: number
}

export function ResultsScreen({ finalState, playerAddress, yellowProof, stateCount }: Props) {
    const { address } = useAccount()
    const [settled, setSettled] = useState(false)
    const [settleTxHash, setSettleTxHash] = useState<string | null>(null)

    const isWinner = finalState.winner === playerAddress
    const isLoser = finalState.loser === playerAddress
    const isDraw = !finalState.winner

    // Player stats
    const myScore = finalState.finalScores[playerAddress] || 0
    const oppAddress = playerAddress === finalState.player1 ? finalState.player2 : finalState.player1
    const oppScore = finalState.finalScores[oppAddress] || 0
    const myLength = finalState.finalLengths[playerAddress] || 0
    const oppLength = finalState.finalLengths[oppAddress] || 0
    const myKills = finalState.finalKills[playerAddress] || 0
    const oppKills = finalState.finalKills[oppAddress] || 0

    // Payout display (USDC has 6 decimals)
    const payouts = useMemo(() => {
        const p = finalState.payouts
        return {
            totalPot: (Number(p.totalPot) / 1e6).toFixed(2),
            rake: (Number(p.rake) / 1e6).toFixed(2),
            winnerPayout: (Number(p.winnerPayout) / 1e6).toFixed(2),
            loserRefund: (Number(p.loserRefund) / 1e6).toFixed(2),
        }
    }, [finalState.payouts])

    const matchDurationSec = (finalState.duration / 1000).toFixed(1)

    return (
        <div className="w-full max-w-2xl mx-auto space-y-6 animate-in fade-in duration-500">
            {/* ── Result Header ── */}
            <div className="text-center">
                <div className="text-6xl mb-3">
                    {isWinner ? '🏆' : isDraw ? '🤝' : '💀'}
                </div>
                <h2 className="text-4xl font-bold font-mono mb-2" style={{
                    color: isWinner ? '#4ade80' : isDraw ? '#fbbf24' : '#ef4444'
                }}>
                    {isWinner ? 'VICTORY' : isDraw ? 'DRAW' : 'DEFEATED'}
                </h2>
                <div className="text-gray-500 font-mono text-sm">
                    {finalState.matchType === 'time_limit' ? '2:00 Match Complete' :
                     finalState.matchType === 'forfeit' ? 'Match Forfeited' :
                     'Opponent Disconnected'}
                    {' • '}{matchDurationSec}s
                </div>
            </div>

            {/* ── Score Comparison ── */}
            <div className="bg-black/80 border border-gray-800 rounded-2xl p-6">
                <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                        <PlayerBadge address={playerAddress} size="sm" />
                        <div className="text-xs text-gray-600 font-mono mt-1">You</div>
                    </div>
                    <div className="text-gray-600 font-mono text-xs self-center">VS</div>
                    <div>
                        <PlayerBadge address={oppAddress} size="sm" />
                        <div className="text-xs text-gray-600 font-mono mt-1">
                            {oppAddress === 'BOT' ? 'AI' : 'Opponent'}
                        </div>
                    </div>
                </div>

                <div className="mt-5 space-y-3">
                    {/* Score */}
                    <div className="flex items-center justify-between">
                        <span className={`font-mono font-bold text-lg ${myScore > oppScore ? 'text-green-400' : 'text-white'}`}>
                            {myScore}
                        </span>
                        <span className="text-gray-600 font-mono text-xs uppercase tracking-wider">Score</span>
                        <span className={`font-mono font-bold text-lg ${oppScore > myScore ? 'text-green-400' : 'text-white'}`}>
                            {oppScore}
                        </span>
                    </div>

                    {/* Length */}
                    <div className="flex items-center justify-between">
                        <span className={`font-mono text-sm ${myLength > oppLength ? 'text-green-400' : 'text-gray-300'}`}>
                            {myLength.toFixed(0)}px
                        </span>
                        <span className="text-gray-600 font-mono text-xs uppercase tracking-wider">Length</span>
                        <span className={`font-mono text-sm ${oppLength > myLength ? 'text-green-400' : 'text-gray-300'}`}>
                            {oppLength.toFixed(0)}px
                        </span>
                    </div>

                    {/* Kills */}
                    <div className="flex items-center justify-between">
                        <span className={`font-mono text-sm ${myKills > oppKills ? 'text-red-400' : 'text-gray-300'}`}>
                            {myKills} 🎯
                        </span>
                        <span className="text-gray-600 font-mono text-xs uppercase tracking-wider">Kills</span>
                        <span className={`font-mono text-sm ${oppKills > myKills ? 'text-red-400' : 'text-gray-300'}`}>
                            {oppKills} 🎯
                        </span>
                    </div>
                </div>
            </div>

            {/* ── Payout Breakdown ── */}
            <div className="bg-black/80 border border-gray-800 rounded-2xl p-6">
                <h3 className="text-white font-mono font-bold text-sm mb-4 flex items-center gap-2">
                    <span className="text-green-400">$</span> Payout Breakdown
                </h3>
                <div className="space-y-2 text-sm font-mono">
                    <div className="flex justify-between text-gray-400">
                        <span>Total Pot</span>
                        <span className="text-white">${payouts.totalPot} USDC</span>
                    </div>
                    <div className="flex justify-between text-gray-400">
                        <span>Platform Rake (2%)</span>
                        <span className="text-yellow-500">-${payouts.rake}</span>
                    </div>
                    <div className="border-t border-gray-800 my-2" />
                    <div className="flex justify-between">
                        <span className="text-green-400">Winner (80%)</span>
                        <span className="text-green-400 font-bold">${payouts.winnerPayout} USDC</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-400">Loser Refund (20%)</span>
                        <span className="text-gray-300">${payouts.loserRefund} USDC</span>
                    </div>
                    <div className="border-t border-gray-800 my-2" />
                    <div className="flex justify-between">
                        <span className={isWinner ? 'text-green-400' : 'text-gray-400'}>
                            Your Payout
                        </span>
                        <span className={`font-bold ${isWinner ? 'text-green-400 text-lg' : 'text-gray-300'}`}>
                            {isWinner ? `+$${payouts.winnerPayout}` : isDraw ? `$${(Number(finalState.payouts.totalPot) / 2 / 1e6).toFixed(2)}` : `$${payouts.loserRefund}`} USDC
                        </span>
                    </div>
                </div>
            </div>

            {/* ── Proof Hash ── */}
            <div className="bg-black/80 border border-gray-800 rounded-2xl p-6">
                <h3 className="text-white font-mono font-bold text-sm mb-4 flex items-center gap-2">
                    <span className="text-cyan-400">⛓</span> Settlement Proof
                </h3>

                {/* Server proof hash (always available) */}
                <div className="bg-gray-900 rounded-xl p-4 mb-3">
                    <div className="text-xs text-gray-500 uppercase tracking-widest mb-1.5 font-mono">
                        Match Proof Hash
                    </div>
                    <div className="text-green-400 font-mono text-xs break-all leading-relaxed">
                        {finalState.proofHash}
                    </div>
                </div>

                {/* Yellow ClearNode proof (if available) */}
                {yellowProof && (
                    <div className="bg-gray-900 rounded-xl p-4 mb-3">
                        <div className="text-xs text-gray-500 uppercase tracking-widest mb-1.5 font-mono">
                            ClearNode Signed State
                        </div>
                        <div className="text-cyan-400 font-mono text-xs break-all leading-relaxed">
                            {yellowProof.stateHash}
                        </div>
                    </div>
                )}

                {/* Timing comparison */}
                <div className="flex items-center gap-4 bg-gray-900 rounded-xl p-4">
                    <div className="flex-1 text-center">
                        <div className="text-white font-bold font-mono text-lg">{matchDurationSec}s</div>
                        <div className="text-xs text-gray-500 font-mono">{stateCount} states</div>
                        <div className="text-xs text-gray-600 mt-0.5">Game Duration</div>
                    </div>
                    <div className="text-gray-600 text-xl">→</div>
                    <div className="flex-1 text-center">
                        <div className="text-white font-bold font-mono text-lg">1</div>
                        <div className="text-xs text-gray-500 font-mono">transaction</div>
                        <div className="text-xs text-gray-600 mt-0.5">On-Chain Settlement</div>
                    </div>
                </div>
            </div>

            {/* ── Settle On-Chain Button ── */}
            {oppAddress !== 'BOT' && (
                <SettlementPanel
                    finalState={finalState}
                    yellowProof={yellowProof}
                    onSettled={(txHash) => {
                        setSettled(true)
                        setSettleTxHash(txHash)
                    }}
                />
            )}

            {/* ── Settlement TX ── */}
            {settleTxHash && (
                <div className="bg-green-900/20 border border-green-800 rounded-2xl p-4 text-center">
                    <div className="text-green-400 font-mono font-bold text-sm">✓ Settled On-Chain</div>
                    <div className="text-gray-400 font-mono text-xs mt-1">
                        {settleTxHash.slice(0, 14)}…{settleTxHash.slice(-8)}
                    </div>
                    <a
                        href={`https://sepolia.basescan.org/tx/${settleTxHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan-400 text-xs hover:underline mt-2 block font-mono"
                    >
                        View on BaseScan →
                    </a>
                </div>
            )}

            {/* ── Actions ── */}
            <div className="flex justify-center gap-4 pt-2">
                <Link
                    href="/"
                    className="bg-green-500 hover:bg-green-600 text-black font-bold px-8 py-3.5 rounded-xl font-mono transition-colors shadow-lg shadow-green-500/20"
                >
                    Play Again
                </Link>
                <Link
                    href="/leaderboard"
                    className="bg-gray-900 hover:bg-gray-800 text-white font-bold px-8 py-3.5 rounded-xl font-mono border border-gray-800 transition-colors"
                >
                    Leaderboard
                </Link>
            </div>
        </div>
    )
}
