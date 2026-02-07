/**
 * Proof-of-Skill leaderboard. Each entry has a ClearNode proof hash.
 * Uses PlayerBadge so ENS names appear here too.
 * Fetches real data from the game server API.
 */
'use client'
import { useEffect, useState } from 'react'
import { PlayerBadge } from './PlayerBadge'

interface LeaderboardEntry {
    address: string
    wins: number
    losses: number
    kills: number
    bestLength: number
    bestScore: number
    totalGames: number
    lastProofHash: string
    lastUpdated: number
}

interface LeaderboardResponse {
    success: boolean
    data: LeaderboardEntry[]
    total: number
    updatedAt: number
}

export function Leaderboard() {
    const [entries, setEntries] = useState<LeaderboardEntry[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [lastUpdated, setLastUpdated] = useState<number>(0)
    const [expandedProof, setExpandedProof] = useState<string | null>(null)

    const fetchLeaderboard = async () => {
        try {
            const serverUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3005'
            const response = await fetch(`${serverUrl}/api/leaderboard?limit=20`)
            const data: LeaderboardResponse = await response.json()
            
            if (data.success) {
                setEntries(data.data)
                setLastUpdated(data.updatedAt)
                setError(null)
            } else {
                setError('Failed to load leaderboard')
            }
        } catch (err) {
            console.error('Error fetching leaderboard:', err)
            setError('Could not connect to server')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchLeaderboard()
        const interval = setInterval(fetchLeaderboard, 30000)
        return () => clearInterval(interval)
    }, [])

    if (loading) {
        return (
            <div className="bg-black/80 border border-gray-800 rounded-2xl p-6 w-full max-w-2xl mx-auto">
                <div className="text-center text-gray-500 font-mono py-8">
                    Loading leaderboard...
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="bg-black/80 border border-gray-800 rounded-2xl p-6 w-full max-w-2xl mx-auto">
                <div className="text-center text-red-400 font-mono py-8">
                    {error}
                </div>
                <button 
                    onClick={fetchLeaderboard}
                    className="block mx-auto mt-4 text-cyan-400 hover:text-cyan-300 font-mono text-sm"
                >
                    Retry
                </button>
            </div>
        )
    }

    return (
        <div className="bg-black/80 border border-gray-800 rounded-2xl p-6 w-full max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-5">
                <h3 className="text-white font-mono font-bold text-lg">Proof-of-Skill Leaderboard</h3>
                <span className="text-xs text-gray-600 font-mono">backed by state channel proofs</span>
            </div>
            
            {entries.length === 0 ? (
                <div className="text-center text-gray-500 font-mono py-8">
                    No matches played yet. Be the first!
                </div>
            ) : (
                <div className="space-y-2">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-2 text-xs text-gray-600 font-mono uppercase tracking-wider">
                        <div className="flex items-center gap-3">
                            <span className="w-6 text-center">#</span>
                            <span>Player</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="w-16 text-right">W/L</span>
                            <span className="w-14 text-right">Score</span>
                            <span className="w-12 text-right">Kills</span>
                            <span className="w-8 text-center">Proof</span>
                        </div>
                    </div>

                    {entries.map((entry, i) => (
                        <div key={entry.address}>
                            <div className="flex items-center justify-between bg-gray-900/60 rounded-xl px-4 py-3">
                                <div className="flex items-center gap-3">
                                    <span className={`font-mono text-sm w-6 text-center ${
                                        i === 0 ? 'text-yellow-400 font-bold' : 
                                        i === 1 ? 'text-gray-300 font-semibold' : 
                                        i === 2 ? 'text-orange-400 font-semibold' : 'text-gray-600'
                                    }`}>
                                        #{i + 1}
                                    </span>
                                    <PlayerBadge address={entry.address} />
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="w-16 text-right">
                                        <span className="text-green-400 font-mono text-sm font-semibold">{entry.wins}W</span>
                                        <span className="text-gray-500 font-mono text-sm">/{entry.losses}L</span>
                                    </div>
                                    <div className="w-14 text-right">
                                        <span className="text-cyan-400 font-mono text-xs">{entry.bestScore}pts</span>
                                    </div>
                                    <div className="w-12 text-right">
                                        <span className="text-red-400 font-mono text-xs">{entry.kills}🎯</span>
                                    </div>
                                    {entry.lastProofHash && (
                                        <button
                                            className="w-8 text-center text-cyan-500 font-mono text-xs cursor-pointer hover:text-cyan-300 transition-colors"
                                            onClick={() => setExpandedProof(
                                                expandedProof === entry.address ? null : entry.address
                                            )}
                                            title="View settlement proof"
                                        >
                                            ⛓
                                        </button>
                                    )}
                                    {!entry.lastProofHash && <div className="w-8" />}
                                </div>
                            </div>
                            
                            {/* Expanded proof hash */}
                            {expandedProof === entry.address && entry.lastProofHash && (
                                <div className="bg-gray-900/40 border border-gray-800 rounded-lg mx-2 mt-1 p-3">
                                    <div className="text-xs text-gray-500 font-mono uppercase tracking-wider mb-1">
                                        Last Settlement Proof
                                    </div>
                                    <div className="text-green-400 font-mono text-xs break-all leading-relaxed">
                                        {entry.lastProofHash}
                                    </div>
                                    <div className="mt-2 flex gap-3 text-xs font-mono">
                                        <span className="text-gray-500">
                                            {entry.totalGames} games played
                                        </span>
                                        <span className="text-gray-500">
                                            Best: {entry.bestLength.toFixed(0)}px length
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
            
            {lastUpdated > 0 && (
                <div className="mt-4 text-center text-gray-600 font-mono text-xs">
                    Last updated: {new Date(lastUpdated).toLocaleTimeString()}
                    {' • '}
                    <button onClick={fetchLeaderboard} className="text-cyan-600 hover:text-cyan-400">
                        Refresh
                    </button>
                </div>
            )}
        </div>
    )
}
