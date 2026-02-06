/**
 * KŌBRA Slither Game Engine - Server Authoritative
 *
 * Ported from Slither.io Python reference:
 *   - Smooth segment chase-following (Segment.py distance-based movement)
 *   - Death → body converts to orbs (MainGame.py kill mechanic)
 *   - AI hunts nearest orb + avoids opponents (AI.py)
 *   - 6-color palette for snakes & orbs (textures/)
 *   - Multiple AI snakes in bot arena (NUM_AI = 15)
 *   - Score-based segment growth (every 20 score → new segment)
 *   - Player follows mouse direction (Player.py)
 *   - Camera-relative world coordinates (Camera.py)
 *
 * 2-minute matches, continuous movement, unlimited respawns.
 * Winner determined by final snake length.
 */
import type {
  GameState, Snake, Position, Orb, FinalGameState, SnakeColor
} from './types'
import { SNAKE_COLORS } from './types'

// ─── Arena ───
const ARENA_WIDTH = 3000
const ARENA_HEIGHT = 3000

// ─── Match ───
const MATCH_DURATION_MS = 120_000 // 2 minutes

// ─── Snake physics (from Slither.io reference) ───
const BASE_SPEED = 150       // px/sec
const AI_SPEED = 120          // AI slightly slower (Slither ref: AI speed=5 vs player speed=7)
const BOOST_MULTIPLIER = 2
const BOOST_DURATION_MS = 500
const BOOST_LENGTH_COST = 0.05
const TURN_SPEED = 3          // radians/sec

// ─── Snake dimensions ───
const INITIAL_LENGTH = 50
const SEGMENT_SIZE = 8

// ─── Respawn ───
const RESPAWN_GRACE_MS = 2000

// ─── Orbs (Slither ref: NUM_ORBS = 400) ───
const ORB_COUNT = 200
const ORB_SPAWN_RATE = 300        // ms between spawns
const ORB_SCORE_INCREMENT = 5     // Slither ref: SCORE_INCREMENT = 5
const MAX_ORB_SIZE = 3

// ─── AI (Slither ref: NUM_AI = 20) ───
const NUM_AI_BOT_MODE = 8
const MAX_CHECK_DISTANCE = 500    // Slither ref: collision check radius

// ─── Seeded RNG for deterministic gameplay ───
class SeededRandom {
  private seed: number
  constructor(seed: number) { this.seed = seed }
  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280
    return this.seed / 233280
  }
}

let rng: SeededRandom

// ─── Color helpers ───
function randomColor(): SnakeColor {
  return SNAKE_COLORS[Math.floor(rng.next() * SNAKE_COLORS.length)]
}

// ══════════════════════════════════════════════════════
//  PUBLIC API
// ══════════════════════════════════════════════════════

export function createInitialState(
  p1Address: string,
  p2Address: string,
  matchId: string,
  isBotMode = false
): GameState {
  rng = new SeededRandom(hashMatchId(matchId))

  // Scatter orbs across arena (Slither ref: NUM_ORBS = 400)
  const orbs: Orb[] = []
  for (let i = 0; i < ORB_COUNT; i++) {
    orbs.push(spawnOrb())
  }

  // Spawn AI snakes for bot mode (Slither ref: NUM_AI = 20)
  const aiSnakes: Snake[] = []
  if (isBotMode) {
    for (let i = 0; i < NUM_AI_BOT_MODE; i++) {
      const spawnX = 200 + rng.next() * (ARENA_WIDTH - 400)
      const spawnY = 200 + rng.next() * (ARENA_HEIGHT - 400)
      const spawnDir = rng.next() * 2 * Math.PI
      aiSnakes.push(createSnake(`AI_${i}`, spawnX, spawnY, spawnDir, true))
    }
  }

  return {
    player1: createSnake(p1Address, ARENA_WIDTH * 0.25, ARENA_HEIGHT * 0.5, 0, false),
    player2: createSnake(p2Address, ARENA_WIDTH * 0.75, ARENA_HEIGHT * 0.5, Math.PI, p2Address === 'BOT'),
    aiSnakes,
    orbs,
    gameTime: 0,
    matchEnded: false,
    winner: null,
    tick: 0,
    lastOrbSpawn: 0,
    arenaWidth: ARENA_WIDTH,
    arenaHeight: ARENA_HEIGHT
  }
}

export function processTick(state: GameState, deltaMs: number): GameState {
  // Clamp delta to prevent physics explosions from lag spikes (max ~100ms)
  const clampedDelta = Math.min(Math.max(deltaMs, 0), 100)
  state.gameTime += clampedDelta
  state.tick++

  // ── Match end ──
  if (state.gameTime >= MATCH_DURATION_MS && !state.matchEnded) {
    state.matchEnded = true
    state.winner = determineWinner(state)
    return state
  }

  // Collect all snakes for shared collision checks
  const allSnakes = getAllSnakes(state)

  // ── Respawns ──
  for (const snake of allSnakes) {
    if (!snake.alive && state.gameTime >= snake.respawnTime) {
      respawnSnake(snake)
    }
  }

  // ── Update AI directions (Slither ref: AI.calculateDirection) ──
  if ((state.player2.address === 'BOT' || state.player2.address.startsWith('AI_')) && state.player2.alive) {
    updateAIDirection(state.player2, allSnakes, state.orbs)
  }
  for (const ai of state.aiSnakes) {
    if (ai.alive) {
      updateAIDirection(ai, allSnakes, state.orbs)
    }
  }

  // ── Move all snakes ──
  for (const snake of allSnakes) {
    if (snake.alive) {
      updateSnake(snake, clampedDelta)
    }
  }

  // ── Check orb collisions ──
  checkOrbCollisions(state, allSnakes)

  // ── Check snake-to-snake collisions ──
  checkSnakeCollisions(state, allSnakes)

  // ── Spawn orbs ──
  if (state.gameTime - state.lastOrbSpawn > ORB_SPAWN_RATE) {
    if (state.orbs.length < ORB_COUNT * 1.5) {
      state.orbs.push(spawnOrb())
      state.lastOrbSpawn = state.gameTime
    }
  }

  return state
}

export function setDirection(
  snake: Snake,
  mouseX: number, mouseY: number,
  canvasWidth: number, canvasHeight: number
): void {
  if (!snake.alive || !snake.segments.length) return

  const centerX = canvasWidth / 2
  const centerY = canvasHeight / 2
  const dx = mouseX - centerX
  const dy = mouseY - centerY
  snake.targetDirection = Math.atan2(dy, dx)
}

export function startBoost(snake: Snake): void {
  if (snake.boostTime > 0 || snake.length < 20) return
  const cost = Math.max(5, snake.length * BOOST_LENGTH_COST)
  snake.length -= cost
  snake.boostTime = BOOST_DURATION_MS
}

// ══════════════════════════════════════════════════════
//  SNAKE CREATION
// ══════════════════════════════════════════════════════

function createSnake(
  address: string, x: number, y: number, direction: number, isAI: boolean
): Snake {
  const segments: Position[] = []
  for (let i = 0; i < INITIAL_LENGTH; i += SEGMENT_SIZE) {
    segments.push({
      x: x - Math.cos(direction) * i,
      y: y - Math.sin(direction) * i
    })
  }

  return {
    address,
    segments,
    direction,
    targetDirection: direction,
    length: INITIAL_LENGTH,
    speed: isAI ? AI_SPEED : BASE_SPEED,
    alive: true,
    respawnTime: 0,
    graceTime: 0,
    boostTime: 0,
    score: 0,
    kills: 0,
    color: randomColor()
  }
}

// ══════════════════════════════════════════════════════
//  SNAKE MOVEMENT  (ported from Snake.py + Segment.py)
// ══════════════════════════════════════════════════════

function updateSnake(snake: Snake, deltaMs: number): void {
  const dt = deltaMs / 1000

  // ── Grace period ──
  if (snake.graceTime > 0) snake.graceTime = Math.max(0, snake.graceTime - deltaMs)

  // ── Boost ──
  if (snake.boostTime > 0) {
    snake.boostTime = Math.max(0, snake.boostTime - deltaMs)
    snake.speed = BASE_SPEED * BOOST_MULTIPLIER
  } else {
    // Speed inversely proportional to length (bigger = slower)
    const factor = Math.max(0.5, 1 - (snake.length - INITIAL_LENGTH) / 500)
    const baseSpd = (snake.address.startsWith('AI_') || snake.address === 'BOT') ? AI_SPEED : BASE_SPEED
    snake.speed = baseSpd * factor
  }

  // ── Smooth direction change ──
  let dirDiff = snake.targetDirection - snake.direction
  while (dirDiff > Math.PI) dirDiff -= 2 * Math.PI
  while (dirDiff < -Math.PI) dirDiff += 2 * Math.PI

  const maxTurn = TURN_SPEED * dt
  if (Math.abs(dirDiff) > maxTurn) {
    snake.direction += Math.sign(dirDiff) * maxTurn
  } else {
    snake.direction = snake.targetDirection
  }
  snake.direction = ((snake.direction % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)

  // ── Move head ──
  const head = snake.segments[0]
  const newHead: Position = {
    x: head.x + Math.cos(snake.direction) * snake.speed * dt,
    y: head.y + Math.sin(snake.direction) * snake.speed * dt
  }

  // Soft boundary slowdown
  const margin = 100
  if (newHead.x < margin || newHead.x > ARENA_WIDTH - margin ||
      newHead.y < margin || newHead.y > ARENA_HEIGHT - margin) {
    snake.speed *= 0.5
  }

  newHead.x = Math.max(20, Math.min(ARENA_WIDTH - 20, newHead.x))
  newHead.y = Math.max(20, Math.min(ARENA_HEIGHT - 20, newHead.y))
  snake.segments[0] = newHead

  // ── Segment chase-follow (Segment.py: each segment chases the one ahead) ──
  for (let i = 1; i < snake.segments.length; i++) {
    const target = snake.segments[i - 1]
    const curr = snake.segments[i]
    const dx = target.x - curr.x
    const dy = target.y - curr.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist > SEGMENT_SIZE * 0.6) {
      const ratio = SEGMENT_SIZE / dist
      snake.segments[i] = {
        x: target.x - dx * ratio,
        y: target.y - dy * ratio
      }
    }
  }

  // ── Grow / trim segments to match length ──
  const targetSegments = Math.floor(snake.length / SEGMENT_SIZE)
  while (snake.segments.length < targetSegments) {
    const last = snake.segments[snake.segments.length - 1]
    const prev = snake.segments[snake.segments.length - 2] || last
    const dx = last.x - prev.x
    const dy = last.y - prev.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist === 0) {
      snake.segments.push({ x: last.x, y: last.y - SEGMENT_SIZE })
    } else {
      const r = SEGMENT_SIZE / dist
      snake.segments.push({ x: last.x + dx * r, y: last.y + dy * r })
    }
  }
  if (snake.segments.length > targetSegments + 2) {
    snake.segments.length = targetSegments + 1
  }
}

// ══════════════════════════════════════════════════════
//  AI  (ported from AI.py)
// ══════════════════════════════════════════════════════

function updateAIDirection(ai: Snake, allSnakes: Snake[], orbs: Orb[]): void {
  if (!ai.alive || ai.segments.length === 0) return
  const head = ai.segments[0]

  // AI.py: find closest orb
  let closestOrb: Orb | null = null
  let closestDist = Infinity
  for (const orb of orbs) {
    const dx = orb.x - head.x
    const dy = orb.y - head.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < closestDist) {
      closestDist = dist
      closestOrb = orb
    }
  }

  if (closestOrb) {
    const dx = closestOrb.x - head.x
    const dy = closestOrb.y - head.y
    const l = Math.sqrt(dx * dx + dy * dy)
    if (l > 0) ai.targetDirection = Math.atan2(dy, dx)
  }

  // Avoid opponents within range
  for (const other of allSnakes) {
    if (other === ai || !other.alive || other.segments.length === 0) continue
    const dx = other.segments[0].x - head.x
    const dy = other.segments[0].y - head.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < 120 && dist > 0) {
      const avoidAngle = Math.atan2(-dy, -dx)
      ai.targetDirection = (ai.targetDirection + avoidAngle) / 2
    }
  }

  // Avoid arena edges
  const edgeMargin = 200
  if (head.x < edgeMargin) ai.targetDirection = 0
  else if (head.x > ARENA_WIDTH - edgeMargin) ai.targetDirection = Math.PI
  if (head.y < edgeMargin) ai.targetDirection = Math.PI / 2
  else if (head.y > ARENA_HEIGHT - edgeMargin) ai.targetDirection = -Math.PI / 2

  // Random boost (1% chance per tick)
  if (ai.boostTime === 0 && rng.next() < 0.01) startBoost(ai)
}

// ══════════════════════════════════════════════════════
//  COLLISIONS  (from Orb.py + Snake.py + MainGame.py)
// ══════════════════════════════════════════════════════

function checkOrbCollisions(state: GameState, allSnakes: Snake[]): void {
  for (const snake of allSnakes) {
    if (!snake.alive || snake.segments.length === 0) continue
    const head = snake.segments[0]
    for (let i = state.orbs.length - 1; i >= 0; i--) {
      const orb = state.orbs[i]
      const dx = head.x - orb.x
      const dy = head.y - orb.y
      if (Math.sqrt(dx * dx + dy * dy) < 15 + orb.size * 3) {
        snake.length += orb.value
        snake.score += ORB_SCORE_INCREMENT
        state.orbs.splice(i, 1)
      }
    }
  }
}

function checkSnakeCollisions(state: GameState, allSnakes: Snake[]): void {
  const toKill: Snake[] = []
  const killers = new Map<Snake, Snake>()

  for (const attacker of allSnakes) {
    if (!attacker.alive || attacker.graceTime > 0 || attacker.segments.length === 0) continue
    const head = attacker.segments[0]

    for (const defender of allSnakes) {
      if (defender === attacker || !defender.alive || defender.graceTime > 0 || defender.segments.length === 0) continue

      // Distance pre-check (Slither ref: MAX_CHECK_DISTANCE)
      const hDx = defender.segments[0].x - head.x
      const hDy = defender.segments[0].y - head.y
      if (Math.sqrt(hDx * hDx + hDy * hDy) > MAX_CHECK_DISTANCE) continue

      // Head-to-head
      if (Math.sqrt(hDx * hDx + hDy * hDy) < 15) {
        if (!toKill.includes(attacker)) toKill.push(attacker)
        if (!toKill.includes(defender)) toKill.push(defender)
        continue
      }

      // Head-to-body (Snake.py: self.rect.colliderect(segment.rect))
      for (let i = 3; i < defender.segments.length; i++) {
        const seg = defender.segments[i]
        const dx = head.x - seg.x
        const dy = head.y - seg.y
        if (Math.sqrt(dx * dx + dy * dy) < 12) {
          if (!toKill.includes(attacker)) {
            toKill.push(attacker)
            killers.set(attacker, defender)
          }
          break
        }
      }
    }
  }

  // ── Death → orbs (MainGame.py: snake body becomes orbs) ──
  for (const dead of toKill) {
    const deathOrbs = convertSnakeToOrbs(dead)
    state.orbs.push(...deathOrbs)

    const killer = killers.get(dead)
    if (killer) {
      killer.kills++
      killer.length += Math.floor(dead.length * 0.15)
    }

    dead.alive = false
    dead.respawnTime = state.gameTime + 2000
    dead.boostTime = 0
    dead.segments = []
  }
}

/** MainGame.py: when a snake dies, head + segments become collectible orbs */
function convertSnakeToOrbs(snake: Snake): Orb[] {
  const orbs: Orb[] = []
  if (snake.segments.length === 0) return orbs

  // Head → large orb
  orbs.push({
    id: `death_${snake.address}_head_${Date.now()}`,
    x: snake.segments[0].x,
    y: snake.segments[0].y,
    size: 3, value: 9,
    color: snake.color
  })

  // Every Nth segment → medium orb
  const step = Math.max(1, Math.floor(snake.segments.length / 20))
  for (let i = 1; i < snake.segments.length; i += step) {
    orbs.push({
      id: `death_${snake.address}_${i}_${Date.now()}`,
      x: snake.segments[i].x + (rng.next() - 0.5) * 10,
      y: snake.segments[i].y + (rng.next() - 0.5) * 10,
      size: 2, value: 6,
      color: snake.color
    })
  }
  return orbs
}

// ══════════════════════════════════════════════════════
//  RESPAWN
// ══════════════════════════════════════════════════════

function respawnSnake(snake: Snake): void {
  const spawnX = 200 + rng.next() * (ARENA_WIDTH - 400)
  const spawnY = 200 + rng.next() * (ARENA_HEIGHT - 400)
  const spawnDir = rng.next() * 2 * Math.PI

  snake.segments = []
  for (let i = 0; i < INITIAL_LENGTH; i += SEGMENT_SIZE) {
    snake.segments.push({
      x: spawnX - Math.cos(spawnDir) * i,
      y: spawnY - Math.sin(spawnDir) * i
    })
  }
  snake.direction = spawnDir
  snake.targetDirection = spawnDir
  snake.length = INITIAL_LENGTH
  snake.speed = BASE_SPEED * 1.5
  snake.alive = true
  snake.graceTime = RESPAWN_GRACE_MS
  snake.boostTime = 0
}

// ══════════════════════════════════════════════════════
//  ORB SPAWNING  (Slither ref: random position/size)
// ══════════════════════════════════════════════════════

function spawnOrb(): Orb {
  const size = 1 + Math.floor(rng.next() * MAX_ORB_SIZE)
  return {
    id: Math.random().toString(36).substr(2, 9),
    x: 50 + rng.next() * (ARENA_WIDTH - 100),
    y: 50 + rng.next() * (ARENA_HEIGHT - 100),
    size,
    value: size * 3,
    color: randomColor()
  }
}

// ══════════════════════════════════════════════════════
//  WINNER DETERMINATION
// ══════════════════════════════════════════════════════

function determineWinner(state: GameState): string | null {
  const p1Len = state.player1.alive ? state.player1.length : 0
  const p2Len = state.player2.alive ? state.player2.length : 0
  if (p1Len > p2Len) return state.player1.address
  if (p2Len > p1Len) return state.player2.address
  if (state.player1.score > state.player2.score) return state.player1.address
  if (state.player2.score > state.player1.score) return state.player2.address
  if (state.player1.kills > state.player2.kills) return state.player1.address
  if (state.player2.kills > state.player1.kills) return state.player2.address
  return null
}

// ══════════════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════════════

function getAllSnakes(state: GameState): Snake[] {
  return [state.player1, state.player2, ...state.aiSnakes]
}

function hashMatchId(matchId: string): number {
  let hash = 0
  for (let i = 0; i < matchId.length; i++) {
    hash = ((hash << 5) - hash) + matchId.charCodeAt(i)
    hash = hash & hash
  }
  return Math.abs(hash)
}

// Legacy compatibility
export function tick(state: any, elapsedMs: number): any { return state }
export type { GameState as SlitherGameState }
