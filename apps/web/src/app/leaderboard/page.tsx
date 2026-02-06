'use client'
import { Leaderboard } from '../../components/Leaderboard'
import Link from 'next/link'

export default function LeaderboardPage() {
    return (
        <div className="min-h-screen bg-[#08090c] flex flex-col items-center justify-center p-8">
            <div className="mb-12">
                <h1 className="text-4xl font-bold text-white text-center font-mono mb-4">
                    Slithr<span className="text-green-400">0</span>
                </h1>
                <p className="text-gray-500 font-mono text-sm text-center">
                    Every score backed by ClearNode proofs
                </p>
            </div>

            <Leaderboard />

            <Link
                href="/"
                className="mt-12 bg-green-500 hover:bg-green-600 text-black font-bold px-8 py-3 rounded-xl font-mono transition-colors"
            >
                ← Back to Lobby
            </Link>
        </div>
    )
}
