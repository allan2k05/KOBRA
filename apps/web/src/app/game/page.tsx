'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { useSearchParams } from 'next/navigation'
import { GameCanvas } from '../../components/GameCanvas'
import { SettlementPanel } from '../../components/SettlementPanel'
import { useYellowSession } from '../../hooks/useYellowSession'
// import { createInitialState, tick } from '../../game/engine' // Engine logic now on server
import type { GameState, FinalGameState } from '../../game/types'
import { useAccount, useWalletClient } from 'wagmi'
import Link from 'next/link'
import { useENS } from '../../hooks/useENS'
import { PlayerBadge } from '../../components/PlayerBadge'

import { Suspense } from 'react'

function GameContent() {
    const searchParams = useSearchParams()
    const opponent = searchParams.get('opponent') || ''
    const matchId = searchParams.get('matchId') || '' // New param
    const stake = searchParams.get('stake') || '0'

    const { address } = useAccount()
    const { data: walletClient } = useWalletClient()
    const { connected, stateCount, proof, connect, openSession, pushGameState, closeSession } = useYellowSession()
    const { ensName: opponentENS, ensAvatar: opponentAvatar, displayName: opponentDisplay } = useENS(opponent !== 'BOT' ? opponent : undefined)

    const [gameState, setGameState] = useState<GameState | null>(null)
    const [matchActive, setMatchActive] = useState(false)
    const [gameOver, setGameOver] = useState(false)
    const [matchDuration, setMatchDuration] = useState(0)

    const [yellowStatus, setYellowStatus] = useState<'connecting' | 'connected' | 'failed'>('connecting')

    const socketRef = useRef<Socket | null>(null) // Keep socket connection

    // 1. Game Server Connection (Socket.io) — always create fresh connection
    useEffect(() => {
        if (!address || !matchId || !opponent) return

        // Create a new socket connection for the game page
        let socket: Socket
        const existingSocket = (window as any).__gameSocket
        
        if (existingSocket && existingSocket.connected) {
            console.log('[Game] Reusing existing socket connection')
            socket = existingSocket
        } else {
            console.log('[Game] Creating new socket connection')
            socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3005')
            ;(window as any).__gameSocket = socket
        }
        
        socketRef.current = socket

        const handleConnect = () => {
            console.log('[Game] Socket connected to server for Match:', matchId)
            // Send ready_to_start immediately — server waits for both players
            console.log('[Game] Sending ready_to_start')
            socket.emit('ready_to_start', { matchId, address })
        }

        // If socket is already connected, handle it immediately
        if (socket.connected) {
            handleConnect()
        }

        const handleStateUpdate = (serverState: GameState) => {
            try {
                // Normalize server state: support both legacy `players` array and new `player1`/`player2` shape
                let normalized: any = serverState as any
                if ((serverState as any).players) {
                    const s: any = serverState as any
                    normalized = {
                        tick: s.tick,
                        time: s.time,
                        player1: s.players[0],
                        player2: s.players[1],
                        food: s.food
                    }
                }

                setGameState(normalized)
                setMatchActive(true) // Mark active once first state arrives
            } catch (err) {
                console.error('Error normalizing server state:', err)
            }
        }

        const handleGameEnd = (finalState: FinalGameState) => {
            setMatchActive(false)
            setGameOver(true)
            setMatchDuration(finalState.duration)
            // Only close Yellow session for multiplayer matches
            if (opponent !== 'BOT') {
                closeSession(finalState).catch(console.error)
            }
            socket.disconnect()
            ;(window as any).__gameSocket = null
        }

        socket.on('connect', handleConnect)
        socket.on('state_update', handleStateUpdate)
        socket.on('game_over', handleGameEnd)

        return () => {
            socket.off('connect', handleConnect)
            socket.off('state_update', handleStateUpdate)
            socket.off('game_over', handleGameEnd)
            // Don't disconnect here — keep connection alive
        }
    }, [address, matchId, closeSession])

    // 2. Yellow Session Initialization (non-blocking — game starts regardless)
    useEffect(() => {
        if (!address || !matchId || !opponent) return
        
        // For bot matches, skip Yellow session
        if (opponent === 'BOT') {
            setYellowStatus('connected')
            return
        }
        
        // For multiplayer matches, try to establish Yellow state channel in background
        if (!connected && walletClient && opponent !== 'BOT') {
            console.log('[Game] Initiating Yellow session in background')
            setYellowStatus('connecting')
            
            const timeoutId = setTimeout(() => {
                if (!connected) {
                    console.warn('[Game] Yellow ClearNode connection timed out (game continues)')
                    setYellowStatus('failed')
                }
            }, 15000)
            
            connect().then(() => {
                clearTimeout(timeoutId)
                return openSession(opponent, stake)
            }).then(() => {
                console.log('[Game] Yellow session established')
                setYellowStatus('connected')
            }).catch((err) => {
                clearTimeout(timeoutId)
                console.error('[Game] Yellow session error (game continues):', err)
                setYellowStatus('failed')
            })
            
            return () => clearTimeout(timeoutId)
        }
    }, [address, connected, opponent, stake, matchId, connect, openSession, walletClient])

    // 3. Push incoming states to Yellow (Bridge) - skip for bot matches
    useEffect(() => {
        if (matchActive && connected && gameState && opponent !== 'BOT') {
            pushGameState(gameState)
        }
    }, [matchActive, connected, gameState, pushGameState, opponent])

    // Game loop - runs every 150ms
    // This useEffect is removed as game state updates come from the server via socket.io
    // useEffect(() => {
    //     if (!matchActive || !gameState) return

    //     const interval = setInterval(() => {
    //         const elapsedMs = Date.now() - startTimeRef.current
    //         const newState = tick(gameState, elapsedMs)
    //         setGameState(newState)

    //         // Push state to Yellow SDK
    //         pushGameState(newState)

    //         // Check game over
    //         const alivePlayers = newState.players.filter(p => p.alive)
    //         if (alivePlayers.length < 2) {
    //             setMatchActive(false)
    //             setGameOver(true)
    //             setMatchDuration(elapsedMs)

    //             // Create final state and close session
    //             const winner = alivePlayers.length === 1 ? alivePlayers[0].address : null
    //             const loser = winner ? newState.players.find(p => !p.alive)?.address || null : null
    //             const finalState: FinalGameState = {
    //                 matchId: `match_${Date.now()}`,
    //                 player1: address!,
    //                 player2: opponent,
    //                 winner,
    //                 loser,
    //                 finalScores: {
    //                     [newState.players[0].address]: newState.players[0].score,
    //                     [newState.players[1].address]: newState.players[1].score,
    //                 },
    //                 stakeAmount: stake,
    //                 duration: elapsedMs,
    //             }

    //             closeSession(finalState).catch(console.error)
    //         }
    //     }, 150)

    //     return () => clearInterval(interval)
    // }, [matchActive, gameState, pushGameState, closeSession, address, opponent, stake])

    // Handle Mouse Movement -> Emit to Server
    const handleMouseMove = useCallback((mouseX: number, mouseY: number) => {
        if (!matchId || !socketRef.current) return
        socketRef.current.emit('mouse_move', { 
            matchId, 
            mouseX, 
            mouseY, 
            canvasWidth: 1200, 
            canvasHeight: 800, 
            address 
        })
    }, [matchId, address])

    // Handle Boost (Spacebar/Click) -> Emit to Server
    const handleBoost = useCallback(() => {
        if (!matchId || !socketRef.current) return
        socketRef.current.emit('boost', { matchId, address })
    }, [matchId, address])

    // Handle Forfeit
    const handleForfeit = useCallback(() => {
        if (!matchId || !socketRef.current) return
        if (confirm('Are you sure you want to forfeit? You will lose your stake.')) {
            socketRef.current.emit('forfeit', { matchId, address })
        }
    }, [matchId, address])

    if (!matchId || !opponent) {
        return (
            <div className="min-h-screen bg-[#08090c] flex items-center justify-center">
                <div className="text-gray-500 font-mono text-center">
                    <div>No match data found.</div>
                    <Link href="/" className="text-green-400 hover:text-green-300 underline mt-2 block">
                        Return to Lobby
                    </Link>
                </div>
            </div>
        )
    }

    if (!gameState) {
        return (
            <div className="min-h-screen bg-[#08090c] flex items-center justify-center">
                <div className="text-white font-mono text-center max-w-md">
                    <div className="flex items-center justify-center gap-2 mb-3">
                        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                        <span>Waiting for {opponent === 'BOT' ? 'game server' : 'both players'}...</span>
                    </div>
                    
                    {/* Yellow status indicator */}
                    {opponent !== 'BOT' && (
                        <div className="text-xs mt-4 space-y-1">
                            <div className={`${yellowStatus === 'connected' ? 'text-green-500' : yellowStatus === 'failed' ? 'text-yellow-600' : 'text-gray-600'}`}>
                                {yellowStatus === 'connecting' && '○ Yellow state channel: connecting...'}
                                {yellowStatus === 'connected' && '● Yellow state channel: active'}
                                {yellowStatus === 'failed' && '○ Yellow state channel: offline (game will proceed)'}
                            </div>
                        </div>
                    )}
                    
                    {!walletClient && (
                        <div className="text-sm text-gray-500 mt-2">Waiting for wallet...</div>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#08090c] flex flex-col items-center justify-center p-8">
            {!gameOver ? (
                <>
                    <div className="mb-6 text-center">
                        <div className="text-white font-mono text-2xl mb-2">
                            KŌBRA ARENA
                        </div>
                        <div className="text-gray-400 font-mono text-sm flex items-center justify-center gap-2">
                            vs {opponent === 'BOT' ? '🤖 AI' : (
                                <span className="inline-flex items-center gap-1.5">
                                    {opponentAvatar && (
                                        <img src={opponentAvatar} alt="" className="w-5 h-5 rounded-full inline" />
                                    )}
                                    <span className="text-green-400">{opponentDisplay}</span>
                                </span>
                            )} • Stake: ${Number(stake) / 1e6} USDC
                        </div>
                    </div>

                    <GameCanvas
                        gameState={gameState}
                        stateCount={stateCount}
                        matchActive={matchActive}
                        playerAddress={address || ''}
                        onMouseMove={handleMouseMove}
                        onBoost={handleBoost}
                    />

                    <div className="mt-4 flex gap-4">
                        <div className="text-gray-600 font-mono text-sm text-center">
                            Mouse: Steer • Space/Click: Boost
                        </div>
                        <button 
                            onClick={handleForfeit}
                            className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 text-xs rounded font-mono"
                        >
                            Forfeit
                        </button>
                    </div>
                </>
            ) : (
                <div className="space-y-8">
                    <div className="text-center mb-8">
                        <h2 className="text-4xl font-bold text-white font-mono mb-4">
                            {gameState.winner === address ? '🎉 VICTORY!' : '💀 DEFEATED'}
                        </h2>
                        {/* ENS-resolved winner display */}
                        {gameState.winner && gameState.winner !== 'BOT' && (
                            <div className="flex items-center justify-center gap-2 mb-2">
                                <span className="text-gray-500 font-mono text-sm">Winner:</span>
                                <PlayerBadge address={gameState.winner} size="md" />
                            </div>
                        )}
                        <div className="text-gray-400 font-mono">
                            Final Length: {(gameState.player1.address === address ? gameState.player1.length : gameState.player2.length).toFixed(0)}px
                        </div>
                        <div className="text-gray-400 font-mono text-sm">
                            Kills: {(gameState.player1.address === address ? gameState.player1.kills : gameState.player2.kills) || 0}
                            {' • '}Score: {(gameState.player1.address === address ? gameState.player1.score : gameState.player2.score) || 0}
                        </div>
                        <div className="text-gray-500 font-mono text-sm">
                            Match Duration: {(matchDuration / 1000).toFixed(1)}s
                        </div>
                    </div>

                    {proof && (
                        <SettlementPanel
                            proof={proof}
                            stateCount={stateCount}
                            matchDurationMs={matchDuration}
                        />
                    )}

                    <div className="flex justify-center gap-4 mt-8">
                        <Link
                            href="/"
                            className="bg-green-500 hover:bg-green-600 text-black font-bold px-8 py-3 rounded-xl font-mono transition-colors"
                        >
                            Play Again
                        </Link>
                        <Link
                            href="/leaderboard"
                            className="bg-gray-900 hover:bg-gray-800 text-white font-bold px-8 py-3 rounded-xl font-mono border border-gray-800 transition-colors"
                        >
                            Leaderboard
                        </Link>
                    </div>
                </div>
            )}
        </div>
    )
}

export default function GamePage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-[#08090c] flex items-center justify-center">
                <div className="text-white font-mono">Loading game...</div>
            </div>
        }>
            <GameContent />
        </Suspense>
    )
}
