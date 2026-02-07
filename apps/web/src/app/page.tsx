'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LobbyScreen } from '../components/LobbyScreen'
import Link from 'next/link'

export default function HomePage() {
    const router = useRouter()
    const [matchData, setMatchData] = useState<{ opponent: string; stake: string; matchId: string } | null>(null)

    if (matchData) {
        // Use Next.js router for SPA navigation (preserves socket connections)
        router.push(`/game?opponent=${matchData.opponent}&stake=${matchData.stake}&matchId=${matchData.matchId}`)
        return <div className="min-h-screen bg-[#08090c] flex items-center justify-center text-white font-mono">Loading match...</div>
    }

    return (
        <>
            <LobbyScreen onMatchFound={(opponent, stake, matchId) => setMatchData({ opponent, stake, matchId })} />

            {/* Footer Navigation */}
            <div className="fixed bottom-8 left-0 right-0 flex justify-center gap-4">
                <Link
                    href="/leaderboard"
                    className="bg-gray-900/80 hover:bg-gray-800 text-gray-300 px-6 py-3 rounded-xl font-mono text-sm border border-gray-800 transition-colors"
                >
                    🏆 Leaderboard
                </Link>
            </div>
        </>
    )
}
