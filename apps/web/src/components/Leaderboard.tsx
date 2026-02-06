/**
 * Proof-of-Skill leaderboard. Each entry has a ClearNode proof hash.
 * Uses PlayerBadge so ENS names appear here too.
 * In production: fetch from DB. For demo: use structured mock data.
 */
'use client'
import { PlayerBadge } from './PlayerBadge'

interface Entry {
    address: string
    wins: number
    bestScore: number
    proofHash: string
}

// Mock data — replace with DB fetch in production
const DATA: Entry[] = [
    { address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F', wins: 14, bestScore: 380, proofHash: '0x3a9f2c8b1d…' },
    { address: '0xd2135CfB216b74109775236E36d4b433F1DF507B', wins: 11, bestScore: 310, proofHash: '0x7b12d4e9…' },
    { address: '0xA0Cf798816D4b9b9866b5330EEa46a18382f251e', wins: 8, bestScore: 420, proofHash: '0xe5a891f3…' },
]

export function Leaderboard() {
    return (
        <div className="bg-black/80 border border-gray-800 rounded-2xl p-6 w-full max-w-lg mx-auto">
            <div className="flex items-center justify-between mb-5">
                <h3 className="text-white font-mono font-bold text-lg">Proof-of-Skill</h3>
                <span className="text-xs text-gray-600 font-mono">backed by state channel proofs</span>
            </div>
            <div className="space-y-2">
                {DATA.map((entry, i) => (
                    <div key={entry.address} className="flex items-center justify-between bg-gray-900/60 rounded-xl px-4 py-3">
                        <div className="flex items-center gap-3">
                            <span className="text-gray-600 font-mono text-sm w-5 text-center">#{i + 1}</span>
                            <PlayerBadge address={entry.address} />
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="text-green-400 font-mono text-sm font-semibold">{entry.wins}W</span>
                            <span className="text-gray-400 font-mono text-sm">{entry.bestScore}pts</span>
                            <span
                                className="text-cyan-500 font-mono text-xs cursor-pointer hover:underline"
                                onClick={() => alert(`ClearNode proof:\n${entry.proofHash}`)}
                            >⛓ proof</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
