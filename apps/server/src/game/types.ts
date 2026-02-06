/**
 * KŌBRA Slither Game Types
 * Ported from Slither.io reference: continuous movement, segment chase-following,
 * death-to-orbs mechanic, multi-AI bot arena, colored snakes & orbs.
 */

export interface Position {
  x: number  // World coordinates
  y: number  // World coordinates
}

export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'

/** Color palette: 6 snake/orb colors matching Slither.io textures */
export type SnakeColor = 'red' | 'blue' | 'green' | 'purple' | 'yellow' | 'orange'

export const SNAKE_COLORS: SnakeColor[] = ['red', 'blue', 'green', 'purple', 'yellow', 'orange']

export interface Snake {
  address: string
  segments: Position[]
  direction: number        // Angle in radians
  targetDirection: number
  length: number           // Total snake length in pixels
  speed: number            // Current speed in pixels/second
  alive: boolean
  respawnTime: number      // When snake can respawn (0 if active)
  graceTime: number        // Invincibility period after respawn
  boostTime: number        // Remaining boost time
  score: number            // Orbs eaten
  kills: number            // Snakes killed
  color: SnakeColor        // Snake body color
}

export interface Orb {
  id: string
  x: number
  y: number
  size: number       // 1-3 (small, medium, large)
  value: number      // Growth amount
  color: SnakeColor  // Orb color (matches Slither.io texture palette)
}

export interface GameState {
  player1: Snake
  player2: Snake
  aiSnakes: Snake[]       // Multiple AI snakes (Slither.io-style arena)
  orbs: Orb[]
  gameTime: number        // Match elapsed time in ms
  matchEnded: boolean
  winner: string | null
  tick: number
  lastOrbSpawn: number
  arenaWidth: number
  arenaHeight: number
}

export interface FinalGameState {
  matchId: string
  player1: string         // address
  player2: string         // address
  winner: string | null
  loser: string | null
  finalScores: Record<string, number>
  finalLengths: Record<string, number>
  finalKills: Record<string, number>
  stakeAmount: string     // raw USDC units
  duration: number        // milliseconds
  matchType: 'time_limit' | 'forfeit' | 'disconnect'
}

// Legacy compatibility types
export interface GridPosition {
  x: number
  y: number
}

export interface PlayerState {
  address: string
  segments: [number, number][]
  direction: 'up' | 'down' | 'left' | 'right'
  score: number
  alive: boolean
}
