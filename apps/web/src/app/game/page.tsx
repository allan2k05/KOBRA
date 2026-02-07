'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { useSearchParams } from 'next/navigation'
import { GameCanvas } from '../../components/GameCanvas'
import { ResultsScreen } from '../../components/ResultsScreen'
import { useYellowSession } from '../../hooks/useYellowSession'
import type { GameState, FinalGameState } from '../../game/types'
import { useAccount, useWalletClient } from 'wagmi'
import Link from 'next/link'
import { useENS } from '../../hooks/useENS'
import { PlayerBadge } from '../../components/PlayerBadge'

import { Suspense } from 'react'

function GameContent() {
    const searchParams = useSearchParams()
    const opponent = searchParams.get('opponent') || ''
    const matchId = searchParams.get('matchId') || ''
    const stake = searchParams.get('stake') || '0'

    const { address } = useAccount()
    const { data: walletClient } = useWalletClient()
    const { connected, stateCount, proof, connect, openSession, pushGameState, closeSession } = useYellowSession()
    const { ensName: opponentENS, ensAvatar: opponentAvatar, displayName: opponentDisplay } = useENS(opponent !== 'BOT' ? opponent : undefined)

    const [gameState, setGameState] = useState<GameState | null>(null)
    const [matchActive, setMatchActive] = useState(false)
    const [gameOver, setGameOver] = useState(false)
    const [finalState, setFinalState] = useState<FinalGameState | null>(null)

    const [yellowStatus, setYellowStatus] = useState<'connecting' | 'connected' | 'failed'>('connecting')

    const socketRef = useRef<Socket | null>(null)

    // 1. Game Server Connection (Socket.io)
    useEffect(() => {
        if (!address || !matchId || !opponent) return

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
            console.log('[Game] Sending ready_to_start')
            socket.emit('ready_to_start', { matchId, address })
        }

        if (socket.connected) {
            handleConnect()
        }

        const handleStateUpdate = (serverState: GameState) => {
            try {
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
                setMatchActive(true)
            } catch (err) {
                console.error('Error normalizing server state:', err)
            }
        }

        const handleGameEnd = (serverFinalState: FinalGameState) => {
            console.log('[Game] Match ended:', serverFinalState)
            setMatchActive(false)
            setGameOver(true)
            setFinalState(serverFinalState)

            // Close Yellow session for multiplayer matches (FINALIZE intent)
            if (opponent !== 'BOT' && connected) {
                closeSession(serverFinalState)
                    .then((yellowProof) => {
                        console.log('[Game] Yellow session closed, proof received:', yellowProof)
                    })
                    .catch((err) => {
                        console.warn('[Game] Yellow session close failed (settlement still possible):', err)
                    })
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
        }
    }, [address, matchId, closeSession, connected, opponent])

    // 2. Yellow Session Initialization (non-blocking)
    useEffect(() => {
        if (!address || !matchId || !opponent) return
        
        if (opponent === 'BOT') {
            setYellowStatus('connected')
            return
        }
        
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

    // 3. Push game states to Yellow (every tick)
    useEffect(() => {
        if (matchActive && connected && gameState && opponent !== 'BOT') {
            pushGameState(gameState)
        }
    }, [matchActive, connected, gameState, pushGameState, opponent])

    // Handle Mouse Movement
    const handleMouseMove = useCallback((mouseX: number, mouseY: number) => {
        if (!matchId || !socketRef.current) return
        socketRef.current.emit('mouse_move', { 
            matchId, mouseX, mouseY, 
            canvasWidth: 1200, canvasHeight: 800, 
            address 
        })
    }, [matchId, address])

    // Handle Boost
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

    // ── No match data ──
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

    // ── Waiting for game to start ──
    if (!gameState) {
        return (
            <div className="min-h-screen bg-[#08090c] flex items-center justify-center">
                <div className="text-white font-mono text-center max-w-md">
                    <div className="flex items-center justify-center gap-2 mb-3">
                        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                        <span>Waiting for {opponent === 'BOT' ? 'game server' : 'both players'}...</span>
                    </div>
                    
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

    // ── GAME OVER → RESULTS SCREEN ──
    if (gameOver && finalState) {
        return (
            <div className="min-h-screen bg-[#08090c] flex items-center justify-center p-8">
                <ResultsScreen
                    finalState={finalState}
                    playerAddress={address || ''}
                    yellowProof={proof ? {
                        signedState: proof.signedState,
                        stateHash: proof.stateHash,
                    } : null}
                    stateCount={stateCount}
                />
            </div>
        )
    }

    // ── ACTIVE GAME ──
    return (
        <div className="min-h-screen bg-[#08090c] flex flex-col items-center justify-center p-8">
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
                {/* Yellow status during game */}
                {opponent !== 'BOT' && (
                    <div className="text-xs mt-1">
                        <span className={yellowStatus === 'connected' ? 'text-green-600' : yellowStatus === 'failed' ? 'text-yellow-700' : 'text-gray-700'}>
                            {yellowStatus === 'connected' ? '● Yellow' : yellowStatus === 'failed' ? '○ Yellow offline' : '○ Yellow...'}
                        </span>
                        {connected && <span className="text-gray-700 ml-2">{stateCount} states</span>}
                    </div>
                )}
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
