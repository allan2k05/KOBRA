/**
 * ENS badge. Used in: lobby, game overlay, leaderboard, settlement.
 * Resolves name + avatar. Falls back cleanly.
 * This is what makes ENS non-cosmetic — it's in every player-facing surface.
 */
'use client'
import { usePlayerIdentity } from '../hooks/usePlayerIdentity'

interface Props {
    address: string
    score?: number
    size?: 'sm' | 'md' | 'lg'
}

export function PlayerBadge({ address, score, size = 'md' }: Props) {
    const { displayName, avatar, isLoading } = usePlayerIdentity(address)

    const dim = size === 'sm' ? 24 : size === 'lg' ? 40 : 32

    return (
        <div className="flex items-center gap-2.5">
            <div
                className="rounded-full overflow-hidden bg-gray-800 flex items-center justify-center"
                style={{ width: dim, height: dim }}
            >
                {avatar ? (
                    <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={avatar} alt={displayName} className="w-full h-full object-cover" />
                    </>
                ) : (
                    <span className="text-gray-500 text-xs font-mono">
                        {isLoading ? '…' : address.slice(2, 4).toUpperCase()}
                    </span>
                )}
            </div>
            <span className="text-white font-mono text-sm">{isLoading ? '…' : displayName}</span>
            {score !== undefined && (
                <span className="bg-green-900/40 text-green-400 font-mono text-xs px-2 py-0.5 rounded-lg">
                    {score}
                </span>
            )}
        </div>
    )
}
