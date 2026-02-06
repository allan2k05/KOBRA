/**
 * Client-side game engine — LEGACY STUB.
 *
 * All game logic now runs on the server (server-authoritative).
 * The server engine implements the full Slither.io mechanics:
 *   - Segment chase-following, death-to-orbs, multi-AI arena,
 *     colored snakes/orbs, score-based growth, AI pathfinding.
 *
 * This file only exists for backward-compat if anything still imports it.
 * GameCanvas renders whatever state the server sends via Socket.IO.
 */
import type { GameState, PlayerState } from './types'

const GRID = 20

export function createInitialState(p1: string, p2: string): GameState {
    // Return a minimal valid GameState — never actually used in production.
    // Server calls createInitialState() from its own engine.
    return {
        player1: {
            address: p1,
            segments: [{ x: 40, y: 200 }, { x: 32, y: 200 }],
            direction: 0,
            targetDirection: 0,
            length: 50,
            speed: 150,
            alive: true,
            respawnTime: 0,
            graceTime: 0,
            boostTime: 0,
            score: 0,
            kills: 0,
            color: 'blue',
        },
        player2: {
            address: p2,
            segments: [{ x: 360, y: 200 }, { x: 368, y: 200 }],
            direction: Math.PI,
            targetDirection: Math.PI,
            length: 50,
            speed: 150,
            alive: true,
            respawnTime: 0,
            graceTime: 0,
            boostTime: 0,
            score: 0,
            kills: 0,
            color: 'red',
        },
        aiSnakes: [],
        orbs: [],
        gameTime: 0,
        matchEnded: false,
        winner: null,
        tick: 0,
        lastOrbSpawn: 0,
        arenaWidth: 3000,
        arenaHeight: 3000,
    }
}

/** No-op stub — all ticking happens server-side. */
export function tick(state: GameState, _elapsedMs: number): GameState {
    return state
}
