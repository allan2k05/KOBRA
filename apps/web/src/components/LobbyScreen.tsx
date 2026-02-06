/**
 * Lobby screen - stake tier selection and matchmaking
 */
'use client'
import { useState, useEffect } from 'react'
import { io } from 'socket.io-client'
import { useAccount, useSignMessage } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { STAKE_TIERS, StakeTier } from '../lib/constants'
import { DepositModal } from './DepositModal'

interface Props {
    onMatchFound: (opponent: string, stake: string, matchId: string) => void
}

export function LobbyScreen({ onMatchFound }: Props) {
    const { isConnected, address } = useAccount()
    const [selectedTier, setSelectedTier] = useState<StakeTier>('mid')
    const [gameMode, setGameMode] = useState<'multiplayer' | 'bot'>('multiplayer')
    const [showDeposit, setShowDeposit] = useState(false)
    const [searching, setSearching] = useState(false)
    const [matchFound, setMatchFound] = useState(false)
    const [opponent, setOpponent] = useState<string>('')
    const [matchId, setMatchId] = useState<string>('')
    const [showSignature, setShowSignature] = useState(false)
    const [waitingForOpponent, setWaitingForOpponent] = useState(false)
    const [mounted, setMounted] = useState(false)
    
    const { signMessage } = useSignMessage()

    useEffect(() => {
        setMounted(true)
    }, [])

    const handlePlay = () => {
        if (!isConnected) return
        setShowDeposit(true)
    }

    const handleSignMatch = async () => {
        const socket = (window as any).__gameSocket
        if (!socket) return
        
        try {
            // Create signature message
            const message = `KŌBRA Match Verification\n\nMatch ID: ${matchId}\nStake: ${STAKE_TIERS[selectedTier].label}\nOpponent: ${opponent}\nTimestamp: ${Date.now()}`
            
            // Sign the message
            const signature = await signMessage({ message })
            
            console.log('[Lobby] Signature created:', signature)
            
            // Send signature to server
            socket.emit('match_signature', {
                matchId,
                address: address,
                signature,
                message
            })
            
        } catch (error) {
            console.error('[Lobby] Signature failed:', error)
            // Reset to searching state on signature failure
            setShowSignature(false)
            setMatchFound(false)
            setSearching(true)
        }
    }
    
    const handleDepositComplete = () => {
        setShowDeposit(false)
        setSearching(true)

        // Connect to game server — store socket globally so game page can reuse it
        const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3005')
        ;(window as any).__gameSocket = socket

        socket.on('connect', () => {
            console.log('[Lobby] Connected to matchmaking server:', socket.id)
            socket.emit('join_lobby', {
                address: address || 'guest', // Use real wallet address
                stake: STAKE_TIERS[selectedTier].amount,
                mode: gameMode
            })
        })

        socket.on('match_found', ({ opponent, matchId }: { opponent: string, matchId: string }) => {
            console.log('[Lobby] Match found:', opponent, matchId)
            setSearching(false)
            setMatchFound(true)
            setOpponent(opponent)
            setMatchId(matchId)
            
            // For bot matches, skip signature verification
            if (gameMode === 'bot') {
                onMatchFound(opponent, STAKE_TIERS[selectedTier].amount, matchId)
            } else {
                // Show signature verification for multiplayer
                setShowSignature(true)
            }
        })
        
        socket.on('opponent_signed', () => {
            console.log('[Lobby] Opponent has signed, starting game')
            setWaitingForOpponent(false)
            onMatchFound(opponent, STAKE_TIERS[selectedTier].amount, matchId)
        })
        
        socket.on('waiting_for_opponent_signature', () => {
            console.log('[Lobby] Waiting for opponent to sign')
            setShowSignature(false)
            setWaitingForOpponent(true)
        })
    }

    return (
        <div className="min-h-screen bg-[#08090c] flex flex-col items-center justify-center p-8">
            <div className="max-w-2xl w-full">
                {/* Header */}
                <div className="text-center mb-12">
                    <h1 className="text-6xl font-bold text-white mb-4 font-mono">
                        KŌBR<span className="text-green-400">A</span>
                    </h1>
                    <p className="text-gray-400 text-lg font-mono">
                        Slither-style snake arena. Real-money stakes verified by Yellow state channels.
                    </p>
                </div>

                {/* Connect Wallet */}
                <div className="flex justify-center mb-8">
                    <ConnectButton />
                </div>

                {mounted && isConnected && !searching && (
                    <>
                        {/* Game Mode Selection */}
                        <div className="bg-black/60 border border-gray-800 rounded-2xl p-8 mb-6">
                            <h2 className="text-white font-mono font-bold text-xl mb-6">Game Mode</h2>
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={() => setGameMode('multiplayer')}
                                    className={`p-4 rounded-xl font-mono font-semibold text-lg transition-all
                                        ${gameMode === 'multiplayer'
                                            ? 'bg-blue-500 text-black shadow-lg shadow-blue-500/30'
                                            : 'bg-gray-900 text-gray-400 hover:bg-gray-800'}`}
                                >
                                    🌐 Multiplayer
                                    <div className="text-sm mt-1 opacity-75">Real players</div>
                                </button>
                                <button
                                    onClick={() => setGameMode('bot')}
                                    className={`p-4 rounded-xl font-mono font-semibold text-lg transition-all
                                        ${gameMode === 'bot'
                                            ? 'bg-orange-500 text-black shadow-lg shadow-orange-500/30'
                                            : 'bg-gray-900 text-gray-400 hover:bg-gray-800'}`}
                                >
                                    🤖 Bot Arena
                                    <div className="text-sm mt-1 opacity-75">8 AI snakes</div>
                                </button>
                            </div>
                        </div>

                        {/* Stake Tier Selection */}
                        <div className="bg-black/60 border border-gray-800 rounded-2xl p-8 mb-6">
                            <h2 className="text-white font-mono font-bold text-xl mb-6">Select Stake</h2>
                            <div className="grid grid-cols-3 gap-4">
                                {(Object.keys(STAKE_TIERS) as StakeTier[]).map((tier) => (
                                    <button
                                        key={tier}
                                        onClick={() => setSelectedTier(tier)}
                                        className={`p-6 rounded-xl font-mono font-bold text-2xl transition-all
                      ${selectedTier === tier
                                                ? 'bg-green-500 text-black shadow-lg shadow-green-500/30'
                                                : 'bg-gray-900 text-gray-400 hover:bg-gray-800'}`}
                                    >
                                        {STAKE_TIERS[tier].label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Play Button */}
                        <button
                            onClick={handlePlay}
                            className="w-full bg-green-500 hover:bg-green-600 active:bg-green-700
                         text-black font-bold text-xl py-6 rounded-xl font-mono
                         transition-colors shadow-lg shadow-green-500/20"
                        >
                            Stake {STAKE_TIERS[selectedTier].label} · {gameMode === 'bot' ? 'Enter Slither Arena' : 'Find Match'} →
                        </button>
                    </>
                )}

                {searching && (
                    <div className="bg-black/60 border border-gray-800 rounded-2xl p-12 text-center">
                        <div className="flex items-center justify-center gap-3 mb-4">
                            <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse" />
                            <span className="text-green-400 font-mono text-lg font-semibold">
                                {gameMode === 'bot' ? '🐍 Entering Slither Arena...' : 'Finding opponent...'}
                            </span>
                        </div>
                        <p className="text-gray-500 font-mono text-sm">
                            {gameMode === 'bot' 
                                ? `Playing against AI with ${STAKE_TIERS[selectedTier].label} stake`
                                : `Matching by ${STAKE_TIERS[selectedTier].label} stake tier`}
                        </p>
                    </div>
                )}
                
                {showSignature && (
                    <div className="bg-black/60 border border-gray-800 rounded-2xl p-8 text-center">
                        <div className="mb-6">
                            <h3 className="text-white font-mono font-bold text-xl mb-2">✅ Match Found!</h3>
                            <p className="text-gray-400 font-mono">
                                Opponent: <span className="text-green-400">{opponent.slice(0, 6)}...{opponent.slice(-4)}</span>
                            </p>
                            <p className="text-gray-400 font-mono">
                                Stake: <span className="text-yellow-400">{STAKE_TIERS[selectedTier].label}</span>
                            </p>
                        </div>
                        
                        <div className="bg-yellow-900/30 border border-yellow-600 rounded-xl p-4 mb-6">
                            <p className="text-yellow-400 font-mono text-sm mb-2">🔐 Signature Required</p>
                            <p className="text-gray-300 font-mono text-xs">
                                Both players must sign to verify the match and lock in stakes
                            </p>
                        </div>
                        
                        <button
                            onClick={handleSignMatch}
                            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-4 px-6 rounded-xl font-mono transition-colors"
                        >
                            🖊️ Sign Match Verification
                        </button>
                    </div>
                )}
                
                {waitingForOpponent && (
                    <div className="bg-black/60 border border-gray-800 rounded-2xl p-8 text-center">
                        <div className="mb-6">
                            <h3 className="text-white font-mono font-bold text-xl mb-2">✅ Signature Complete!</h3>
                            <p className="text-green-400 font-mono mb-2">Your signature verified</p>
                        </div>
                        
                        <div className="flex items-center justify-center gap-3 mb-4">
                            <div className="w-3 h-3 rounded-full bg-yellow-400 animate-pulse" />
                            <span className="text-yellow-400 font-mono text-lg font-semibold">
                                Waiting for opponent signature...
                            </span>
                        </div>
                        <p className="text-gray-500 font-mono text-sm">
                            Match will start automatically once both players sign
                        </p>
                    </div>
                )}
            </div>

            {/* Deposit Modal */}
            {showDeposit && (
                <DepositModal
                    stakeAmount={STAKE_TIERS[selectedTier].amount}
                    onClose={() => setShowDeposit(false)}
                    onComplete={handleDepositComplete}
                />
            )}
        </div>
    )
}
