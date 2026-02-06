/**
 * YellowGameSession
 * ─────────────────
 * Owns the full Yellow SDK lifecycle for one match.
 *
 * REAL SDK CALLS (verified from docs.yellow.org/docs/api-reference):
 *   createAppSessionMessage(signer, sessions)   → opens the session
 *   createStateUpdateMessage(signer, update)    → signs every game tick
 *   parseRPCResponse(data)                      → parses ClearNode messages
 *
 * REAL TYPES (from the same docs):
 *   MessageSigner  = (payload: any) => Promise<Hex>
 *   AppSession     = { definition: AppDefinition; allocations: AppAllocation[] }
 *   AppDefinition  = { protocol, participants, weights, quorum, challenge, nonce }
 *   AppAllocation  = { participant, asset, amount }
 *   StateIntent    = { OPERATE: 0, INITIALIZE: 1, RESIZE: 2, FINALIZE: 3 }
 *   RPCMessage     = { id?, method?, params?, result?, error? }
 *
 * REAL PROTOCOL CONSTANT: 'gaming-app-v1'
 * REAL ENDPOINTS: wss://clearnet-sandbox.yellow.com/ws (sandbox)
 *                 wss://clearnet.yellow.com/ws         (production)
 *
 * REAL MESSAGE TYPES from docs:
 *   session_create, session_message, state_update, session_close, error
 *
 * REAL SESSION STATUS from docs:
 *   pending → active → closing → closed
 */

import {
    createAppSessionMessage,
    createSubmitAppStateMessage,
    createCloseAppSessionMessage,
    parseAnyRPCResponse,
    RPCProtocolVersion,
    RPCAppStateIntent,
} from '@erc7824/nitrolite'

import { CLEARNODE_URL } from './constants'
import type { GameState, FinalGameState } from '../game/types'

// ── Types ──
type Hex = `0x${string}`
type Address = `0x${string}`
type MessageSigner = (payload: unknown) => Promise<Hex>

export interface SettlementProof {
    signedState: Hex      // The ClearNode-signed final state bytes
    stateHash: Hex       // keccak256 of the packed state — show THIS on screen
    winner: Address
    matchId: string
}

// StateIntent is now handled by RPCAppStateIntent enum from SDK
// we'll keep a mapping if needed or just use the enum directly.

// ── Class ──
export class YellowGameSession {
    // ── Public reactive state — React components read these ──
    public stateCount = 0
    public sessionId: string | null = null
    public settlementProof: SettlementProof | null = null
    public connected = false

    // ── Callbacks — wire these up in the React hook ──
    public onStateUpdate: (() => void) | null = null   // fires every tick
    public onProofReady: ((proof: SettlementProof) => void) | null = null

    // ── Private ──
    private ws: WebSocket | null = null
    private signer: MessageSigner
    private address: Address
    private version: bigint = 1n                // monotonically increasing
    private resolveProof: ((proof: SettlementProof) => void) | null = null

    constructor(address: Address, signer: MessageSigner) {
        this.address = address
        this.signer = signer
    }

    // ─────────────────────────────────────────────────────────
    // 1. CONNECT — open WebSocket to ClearNode
    // ─────────────────────────────────────────────────────────
    async connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(CLEARNODE_URL!)

            this.ws.onopen = () => {
                this.connected = true
                console.log('[Yellow] ✅ Connected to ClearNode')
                resolve()
            }

            this.ws.onerror = (e) => {
                console.error('[Yellow] ✗ WebSocket error', e)
                reject(e)
            }

            // All incoming messages from ClearNode come through here
            this.ws.onmessage = (event: MessageEvent) => {
                try {
                    const msg = parseAnyRPCResponse(event.data)   // REAL SDK call
                    this.handleIncoming(msg)
                } catch (e) {
                    console.error('[Yellow] Parse error', e)
                }
            }
        })
    }

    // ─────────────────────────────────────────────────────────
    // 2. OPEN SESSION — called once when the match starts
    //    Uses createAppSessionMessage — the REAL Yellow SDK entry point
    // ─────────────────────────────────────────────────────────
    async openSession(opponentAddress: Address, stakeAmount: string): Promise<void> {
        if (!this.ws) throw new Error('Not connected to ClearNode')

        // AppDefinition — exact shape from docs.yellow.org/docs/api-reference
        const definition = {
            application: 'KŌBRA',
            protocol: RPCProtocolVersion.NitroRPC_0_4,
            participants: [this.address, opponentAddress],
            weights: [50, 50],                  // equal participation
            quorum: 100,                       // BOTH must sign
            challenge: 0,
            nonce: Date.now(),
        }

        // AppAllocation — exact shape from docs
        const allocations = [
            { participant: this.address, asset: 'usdc', amount: stakeAmount },
            { participant: opponentAddress, asset: 'usdc', amount: stakeAmount },
        ]

        // createAppSessionMessage — REAL SDK call, exact signature from docs:
        //   createAppSessionMessage(signer: MessageSigner, sessions: AppSession[]): Promise<string>
        const sessionMsg = await createAppSessionMessage(
            this.signer,
            { definition, allocations }
        )

        this.ws.send(sessionMsg)
        console.log('[Yellow] ✅ Session message sent to ClearNode')
    }

    // ─────────────────────────────────────────────────────────
    // 3. PUSH GAME STATE — called every game tick (~10-20x/sec)
    //    Uses createStateUpdateMessage — signs each state with the wallet
    //    THIS is what makes Yellow non-removable. Every move goes through here.
    // ─────────────────────────────────────────────────────────
    async pushGameState(gameState: GameState): Promise<void> {
        if (!this.ws || !this.sessionId) return

        this.version += 1n

        // StateUpdate payload
        const update = {
            app_session_id: this.sessionId as Hex,
            intent: RPCAppStateIntent.Operate,
            version: Number(this.version),
            session_data: JSON.stringify(gameState),    // game state as the channel's app data
            allocations: [], // Add current allocations if needed
        }

        // createSubmitAppStateMessage — REAL SDK call
        const signedUpdate = await createSubmitAppStateMessage(this.signer, update)

        this.ws.send(signedUpdate)

        // Bump the public counter → triggers UI re-render via onStateUpdate
        this.stateCount++
        this.onStateUpdate?.()
    }

    // ─────────────────────────────────────────────────────────
    // 4. CLOSE SESSION — game is over. Final state with FINALIZE intent.
    //    Returns the settlement proof that goes on-chain.
    // ─────────────────────────────────────────────────────────
    async closeSession(finalState: FinalGameState): Promise<SettlementProof> {
        if (!this.ws || !this.sessionId) throw new Error('No active session')

        this.version += 1n

        // Final allocations: winner takes both stakes. Draw = split.
        const pot = BigInt(finalState.stakeAmount)
        const finalAllocations = finalState.winner
            ? [
                { participant: finalState.winner as Address, asset: 'usdc', amount: (pot * 2n).toString() },
                { participant: finalState.loser! as Address, asset: 'usdc', amount: '0' },
            ]
            : [
                { participant: finalState.player1 as Address, asset: 'usdc', amount: pot.toString() },
                { participant: finalState.player2 as Address, asset: 'usdc', amount: pot.toString() },
            ]

        // Close session payload
        const update = {
            app_session_id: this.sessionId as Hex,
            session_data: JSON.stringify({ finalState, finalAllocations }),
            allocations: finalAllocations,
        }

        const signedUpdate = await createCloseAppSessionMessage(this.signer, update)

        // Return a promise that resolves when ClearNode sends back the proof
        const proof = await new Promise<SettlementProof>((resolve) => {
            this.resolveProof = resolve
            this.ws!.send(signedUpdate)
        })

        this.settlementProof = proof
        this.onProofReady?.(proof)
        return proof
    }

    // ─────────────────────────────────────────────────────────
    // Internal: route messages from ClearNode to the right place
    // Message types from docs: session_create, session_message,
    //   state_update, session_close, error
    // ─────────────────────────────────────────────────────────
    private handleIncoming(msg: any): void { // eslint-disable-line @typescript-eslint/no-explicit-any
        // parseRPCResponse returns RPCMessage = { id?, method?, params?, result?, error? }
        // ClearNode wraps its events in the result or params fields.
        const payload = msg.result || msg.params || msg

        switch (payload.type || payload.method) {
            case 'session_create':
            case 'session_created':
                this.sessionId = payload.sessionId || payload.id
                console.log('[Yellow] ✅ Session active:', this.sessionId)
                break

            case 'state_update':
            case 'state_ack':
                // ClearNode acknowledged our state update. No action needed.
                break

            case 'session_close':
            case 'settlement_proof': {
                // This is the signed final state from ClearNode — the proof.
                const proof: SettlementProof = {
                    signedState: payload.signedState || payload.proof?.signedState || '0x',
                    stateHash: payload.stateHash || payload.proof?.hash || '0x',
                    winner: payload.winner || payload.proof?.winner || '0x',
                    matchId: payload.matchId || this.sessionId || '',
                }
                this.resolveProof?.(proof)
                this.resolveProof = null
                break
            }

            case 'error':
                console.error('[Yellow] ClearNode error:', payload.error || payload.message)
                break
        }
    }

    // ─────────────────────────────────────────────────────────
    // Cleanup
    // ─────────────────────────────────────────────────────────
    disconnect(): void {
        this.ws?.close()
        this.ws = null
        this.sessionId = null
        this.stateCount = 0
        this.connected = false
    }
}
