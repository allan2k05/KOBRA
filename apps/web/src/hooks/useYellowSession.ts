/**
 * React hook that owns a YellowGameSession instance.
 * Exposes stateCount and proof reactively so components re-render.
 * Builds the MessageSigner from wagmi's walletClient.
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { useAccount, useWalletClient } from 'wagmi'
import { YellowGameSession, SettlementProof } from '../lib/yellow'
import type { GameState, FinalGameState } from '../game/types'

export function useYellowSession() {
    const { address } = useAccount()
    const { data: walletClient } = useWalletClient()

    const ref = useRef<YellowGameSession | null>(null)
    const [stateCount, setStateCount] = useState(0)
    const [proof, setProof] = useState<SettlementProof | null>(null)
    const [connected, setConnected] = useState(false)

    // ── Build a MessageSigner from the connected wallet ──
    // MessageSigner = (payload: any) => Promise<Hex>
    // wagmi's walletClient.signMessage does exactly this.
    const getSigner = useCallback(() => {
        if (!walletClient) {
            console.error('[Yellow] walletClient not available', { walletClient, address })
            throw new Error('Wallet client not ready. Ensure wallet is connected and useWalletClient hook has initialized.')
        }
        return async (payload: unknown): Promise<`0x${string}`> => {
            const msg = typeof payload === 'string' ? payload : JSON.stringify(payload)
            return walletClient.signMessage({ message: msg })
        }
    }, [walletClient])

    // ── 1. Connect to ClearNode ──
    const connect = useCallback(async () => {
        if (!address) throw new Error('No address')
        if (!walletClient) {
            console.error('[Yellow] Cannot connect: wallet client not ready')
            throw new Error('Wallet client not ready')
        }
        const signer = getSigner()
        const session = new YellowGameSession(address, signer)
        session.onStateUpdate = () => setStateCount(session.stateCount)
        session.onProofReady = (p) => setProof(p)
        await session.connect()
        ref.current = session
        setConnected(true)
    }, [address, walletClient, getSigner])

    // ── 2. Open session (match starts) ──
    const openSession = useCallback(async (opponent: string, stake: string) => {
        if (!ref.current) throw new Error('Not connected')
        await ref.current.openSession(opponent as `0x${string}`, stake)
    }, [])

    // ── 3. Push game state (every tick) ──
    const pushGameState = useCallback(async (state: GameState) => {
        await ref.current?.pushGameState(state)
    }, [])

    // ── 4. Close session (game over) ──
    const closeSession = useCallback(async (final: FinalGameState) => {
        if (!ref.current) throw new Error('Not connected')
        return await ref.current.closeSession(final)
    }, [])

    // Cleanup
    useEffect(() => () => { ref.current?.disconnect() }, [])

    return { connected, stateCount, proof, connect, openSession, pushGameState, closeSession }
}
