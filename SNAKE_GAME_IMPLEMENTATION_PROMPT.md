# KŌBRA SNAKE GAME — COMPLETE IMPLEMENTATION PROMPT
### Copy this entire prompt into your AI coding agent. Do not summarize. Do not skip sections.

---

## SECTION 1 — WHAT YOU ARE BUILDING

A **competitive multiplayer snake game** with perfect mechanics, 60 FPS rendering, and authoritative server validation. This is NOT a casual mobile snake. This is a high-stakes competitive game where:
- Every frame counts
- Collision detection must be pixel-perfect
- Input lag must be minimized
- Network synchronization must be bulletproof
- The game must feel responsive even at 100ms latency

**Technical constraints:**
- Game runs at **10 ticks per second** (100ms per tick) — this is the authoritative game speed
- Rendering runs at **60 FPS** (16.67ms per frame) — client-side interpolation for smooth visuals
- Grid: **20×20 cells**, each cell is **20×20 pixels** → total canvas: **400×400px**
- Every tick generates a Yellow SDK state update via `pushGameState()`

---

## SECTION 2 — CORE GAME MECHANICS (Pixel-Perfect Specification)

### Grid System
```typescript
const GRID_SIZE = 20        // 20×20 cells
const CELL_SIZE = 20        // Each cell is 20×20 pixels
const CANVAS_WIDTH = 400    // GRID_SIZE × CELL_SIZE
const CANVAS_HEIGHT = 400   // GRID_SIZE × CELL_SIZE

// Grid coordinates are integers from 0 to 19
type GridPosition = { x: number; y: number }  // x ∈ [0, 19], y ∈ [0, 19]
```

### Snake Representation
```typescript
interface Snake {
  segments: GridPosition[]   // Array of positions, [0] = head, [length-1] = tail
  direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'
  alive: boolean
  score: number
}

// Starting positions (EXACT coordinates):
const PLAYER_1_START: Snake = {
  segments: [
    { x: 2, y: 10 },   // head
    { x: 1, y: 10 },   // body segment 1
    { x: 0, y: 10 }    // tail
  ],
  direction: 'RIGHT',
  alive: true,
  score: 0
}

const PLAYER_2_START: Snake = {
  segments: [
    { x: 17, y: 10 },  // head
    { x: 18, y: 10 },  // body segment 1
    { x: 19, y: 10 }   // tail
  ],
  direction: 'LEFT',
  alive: true,
  score: 0
}
```

### Movement Rules (Critical — Get This Right)

**1. Direction Changes:**
```typescript
// RULE: Cannot reverse 180 degrees in one move
function isValidDirectionChange(current: Direction, next: Direction): boolean {
  const opposites = {
    'UP': 'DOWN',
    'DOWN': 'UP',
    'LEFT': 'RIGHT',
    'RIGHT': 'LEFT'
  }
  return opposites[current] !== next
}

// RULE: Direction change takes effect on NEXT tick, not immediately
// Store pending direction, apply on next tick
let pendingDirection: Direction | null = null

function handleInput(key: string) {
  const dirMap = {
    'ArrowUp': 'UP', 'w': 'UP', 'W': 'UP',
    'ArrowDown': 'DOWN', 's': 'DOWN', 'S': 'DOWN',
    'ArrowLeft': 'LEFT', 'a': 'LEFT', 'A': 'LEFT',
    'ArrowRight': 'RIGHT', 'd': 'RIGHT', 'D': 'RIGHT'
  }
  
  const newDir = dirMap[key]
  if (newDir && isValidDirectionChange(snake.direction, newDir)) {
    pendingDirection = newDir
  }
}
```

**2. Movement Algorithm (Every Tick):**
```typescript
function moveSnake(snake: Snake): Snake {
  // Apply pending direction change
  if (pendingDirection && isValidDirectionChange(snake.direction, pendingDirection)) {
    snake.direction = pendingDirection
    pendingDirection = null
  }

  // Calculate new head position
  const head = snake.segments[0]
  let newHead: GridPosition

  switch (snake.direction) {
    case 'UP':    newHead = { x: head.x, y: head.y - 1 }; break
    case 'DOWN':  newHead = { x: head.x, y: head.y + 1 }; break
    case 'LEFT':  newHead = { x: head.x - 1, y: head.y }; break
    case 'RIGHT': newHead = { x: head.x + 1, y: head.y }; break
  }

  // Check if new head position has food
  const foodEaten = food.some(f => f.x === newHead.x && f.y === newHead.y)

  if (foodEaten) {
    // GROW: Add new head, keep tail
    snake.segments = [newHead, ...snake.segments]
    snake.score += 10
    // Remove the food from the food array
    food = food.filter(f => !(f.x === newHead.x && f.y === newHead.y))
  } else {
    // MOVE: Add new head, remove tail
    snake.segments = [newHead, ...snake.segments.slice(0, -1)]
  }

  return snake
}
```

### Collision Detection (Authoritative — Server-Side)

**1. Wall Collision:**
```typescript
function checkWallCollision(snake: Snake): boolean {
  const head = snake.segments[0]
  return head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE
}
```

**2. Self Collision:**
```typescript
function checkSelfCollision(snake: Snake): boolean {
  const head = snake.segments[0]
  // Check if head position matches any body segment (skip index 0 = head itself)
  return snake.segments.slice(1).some(segment => 
    segment.x === head.x && segment.y === head.y
  )
}
```

**3. Snake-to-Snake Collision:**
```typescript
function checkSnakeCollision(snake1: Snake, snake2: Snake): boolean {
  const head1 = snake1.segments[0]
  const head2 = snake2.segments[0]

  // Head-to-head collision (both die)
  if (head1.x === head2.x && head1.y === head2.y) {
    snake1.alive = false
    snake2.alive = false
    return true
  }

  // Snake 1 head hits Snake 2 body
  if (snake2.segments.some(seg => seg.x === head1.x && seg.y === head1.y)) {
    snake1.alive = false
    return true
  }

  // Snake 2 head hits Snake 1 body
  if (snake1.segments.some(seg => seg.x === head2.x && seg.y === head2.y)) {
    snake2.alive = false
    return true
  }

  return false
}
```

**4. Collision Check Order (Critical):**
```typescript
function processTick(state: GameState): GameState {
  // 1. Move both snakes
  state.player1 = moveSnake(state.player1)
  state.player2 = moveSnake(state.player2)

  // 2. Check wall collisions
  if (checkWallCollision(state.player1)) state.player1.alive = false
  if (checkWallCollision(state.player2)) state.player2.alive = false

  // 3. Check self collisions
  if (checkSelfCollision(state.player1)) state.player1.alive = false
  if (checkSelfCollision(state.player2)) state.player2.alive = false

  // 4. Check snake-to-snake collisions
  checkSnakeCollision(state.player1, state.player2)

  // 5. Spawn new food if needed
  if (state.food.length === 0) {
    state.food.push(spawnFood(state))
  }

  // 6. Increment tick counter
  state.tick++

  return state
}
```

### Food Spawning (Must Not Spawn on Snakes)

```typescript
function spawnFood(state: GameState): GridPosition {
  // Build a set of all occupied cells
  const occupied = new Set<string>()
  
  state.player1.segments.forEach(seg => occupied.add(`${seg.x},${seg.y}`))
  state.player2.segments.forEach(seg => occupied.add(`${seg.x},${seg.y}`))
  state.food.forEach(f => occupied.add(`${f.x},${f.y}`))

  // Find all free cells
  const freeCells: GridPosition[] = []
  for (let x = 0; x < GRID_SIZE; x++) {
    for (let y = 0; y < GRID_SIZE; y++) {
      if (!occupied.has(`${x},${y}`)) {
        freeCells.push({ x, y })
      }
    }
  }

  // Random selection from free cells
  if (freeCells.length === 0) {
    // Extremely rare: grid is completely full
    // Just spawn at (0, 0) and let collision handle it
    return { x: 0, y: 0 }
  }

  const randomIndex = Math.floor(Math.random() * freeCells.length)
  return freeCells[randomIndex]
}
```

**Food Spawn Determinism (Critical for Multiplayer):**
```typescript
// Use seeded RNG for deterministic food spawns
// Both server and clients can replay with same seed → same food positions
class SeededRandom {
  private seed: number

  constructor(seed: number) {
    this.seed = seed
  }

  next(): number {
    // Linear congruential generator
    this.seed = (this.seed * 9301 + 49297) % 233280
    return this.seed / 233280
  }
}

// Initialize with match ID as seed
const rng = new SeededRandom(hashMatchId(matchId))

function spawnFood(state: GameState): GridPosition {
  // ... (same logic as above, but use rng.next() instead of Math.random())
  const randomIndex = Math.floor(rng.next() * freeCells.length)
  return freeCells[randomIndex]
}
```

---

## SECTION 3 — RENDERING (Client-Side, 60 FPS)

### Canvas Setup
```typescript
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!

canvas.width = CANVAS_WIDTH   // 400
canvas.height = CANVAS_HEIGHT // 400

// Disable image smoothing for crisp pixel art
ctx.imageSmoothingEnabled = false
```

### Render Loop (60 FPS, Interpolated)
```typescript
let lastRenderTime = 0
const TARGET_FPS = 60
const FRAME_TIME = 1000 / TARGET_FPS  // ~16.67ms

function renderLoop(timestamp: number) {
  const delta = timestamp - lastRenderTime
  
  if (delta >= FRAME_TIME) {
    render(currentGameState)
    lastRenderTime = timestamp
  }

  requestAnimationFrame(renderLoop)
}

requestAnimationFrame(renderLoop)
```

### Rendering Function
```typescript
function render(state: GameState) {
  // Clear canvas
  ctx.fillStyle = '#0a0a0f'  // Dark background
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

  // Draw grid lines (subtle)
  ctx.strokeStyle = '#1a1a24'
  ctx.lineWidth = 0.5
  for (let i = 0; i <= GRID_SIZE; i++) {
    // Vertical lines
    ctx.beginPath()
    ctx.moveTo(i * CELL_SIZE, 0)
    ctx.lineTo(i * CELL_SIZE, CANVAS_HEIGHT)
    ctx.stroke()

    // Horizontal lines
    ctx.beginPath()
    ctx.moveTo(0, i * CELL_SIZE)
    ctx.lineTo(CANVAS_WIDTH, i * CELL_SIZE)
    ctx.stroke()
  }

  // Draw food
  state.food.forEach(food => {
    ctx.fillStyle = '#22c55e'  // Green
    ctx.beginPath()
    ctx.arc(
      (food.x + 0.5) * CELL_SIZE,  // Center of cell
      (food.y + 0.5) * CELL_SIZE,
      CELL_SIZE * 0.35,             // Radius slightly smaller than cell
      0,
      Math.PI * 2
    )
    ctx.fill()
  })

  // Draw snakes
  const snakeColors = ['#06b6d4', '#f97316']  // Cyan, Orange
  
  [state.player1, state.player2].forEach((snake, idx) => {
    if (!snake.alive) return

    ctx.fillStyle = snakeColors[idx]

    snake.segments.forEach((segment, segIdx) => {
      const isHead = segIdx === 0
      
      // Draw segment
      ctx.fillRect(
        segment.x * CELL_SIZE + 1,  // +1 for visual spacing
        segment.y * CELL_SIZE + 1,
        CELL_SIZE - 2,              // -2 for visual spacing
        CELL_SIZE - 2
      )

      // Draw eyes on head
      if (isHead) {
        ctx.fillStyle = '#000'
        const eyeSize = 3
        const eyeOffset = 6

        // Determine eye positions based on direction
        let eye1X = segment.x * CELL_SIZE + eyeOffset
        let eye1Y = segment.y * CELL_SIZE + eyeOffset
        let eye2X = segment.x * CELL_SIZE + CELL_SIZE - eyeOffset
        let eye2Y = segment.y * CELL_SIZE + eyeOffset

        if (snake.direction === 'DOWN') {
          eye1Y = segment.y * CELL_SIZE + CELL_SIZE - eyeOffset
          eye2Y = segment.y * CELL_SIZE + CELL_SIZE - eyeOffset
        } else if (snake.direction === 'LEFT') {
          eye1X = segment.x * CELL_SIZE + eyeOffset
          eye2X = segment.x * CELL_SIZE + eyeOffset
          eye1Y = segment.y * CELL_SIZE + eyeOffset
          eye2Y = segment.y * CELL_SIZE + CELL_SIZE - eyeOffset
        } else if (snake.direction === 'RIGHT') {
          eye1X = segment.x * CELL_SIZE + CELL_SIZE - eyeOffset
          eye2X = segment.x * CELL_SIZE + CELL_SIZE - eyeOffset
          eye1Y = segment.y * CELL_SIZE + eyeOffset
          eye2Y = segment.y * CELL_SIZE + CELL_SIZE - eyeOffset
        }

        ctx.fillRect(eye1X, eye1Y, eyeSize, eyeSize)
        ctx.fillRect(eye2X, eye2Y, eyeSize, eyeSize)

        ctx.fillStyle = snakeColors[idx]  // Reset color
      }
    })
  })

  // Draw scores (top of canvas)
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 14px monospace'
  ctx.fillText(`P1: ${state.player1.score}`, 10, 20)
  ctx.fillText(`P2: ${state.player2.score}`, CANVAS_WIDTH - 80, 20)
}
```

---

## SECTION 4 — NETWORK SYNCHRONIZATION (Multiplayer)

### Client-Server Architecture

**Server is authoritative.** The server runs the game loop. Clients send inputs, server validates and broadcasts state.

```typescript
// ══════════════════════════════════════════════════════════
// SERVER SIDE (Node.js + Socket.io)
// ══════════════════════════════════════════════════════════

import { Server } from 'socket.io'
import express from 'express'

const app = express()
const server = app.listen(3001)
const io = new Server(server, { cors: { origin: '*' } })

interface Match {
  id: string
  player1: { socketId: string; address: string }
  player2: { socketId: string; address: string }
  gameState: GameState
  yellowSession: YellowGameSession
  tickInterval: NodeJS.Timeout
  startTime: number
}

const activeMatches = new Map<string, Match>()

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id)

  socket.on('join_match', (data: { matchId: string; playerAddress: string }) => {
    const match = activeMatches.get(data.matchId)
    if (!match) return

    // Start game loop when both players connected
    if (match.player1.socketId && match.player2.socketId) {
      startGameLoop(match)
    }
  })

  socket.on('input', (data: { matchId: string; direction: Direction }) => {
    const match = activeMatches.get(data.matchId)
    if (!match) return

    // Determine which player sent the input
    const isPlayer1 = socket.id === match.player1.socketId
    const snake = isPlayer1 ? match.gameState.player1 : match.gameState.player2

    // Validate and queue direction change
    if (isValidDirectionChange(snake.direction, data.direction)) {
      snake.pendingDirection = data.direction
    }
  })

  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id)
    // Handle disconnect: wait 10s for reconnect, then forfeit
  })
})

function startGameLoop(match: Match) {
  match.startTime = Date.now()

  match.tickInterval = setInterval(async () => {
    // Process one game tick
    match.gameState = processTick(match.gameState)

    // Send state update to Yellow SDK (CRITICAL INTEGRATION POINT)
    await match.yellowSession.pushGameState(match.gameState)

    // Broadcast state to both clients
    io.to(match.player1.socketId).emit('state_update', match.gameState)
    io.to(match.player2.socketId).emit('state_update', match.gameState)

    // Check for game end conditions
    const bothDead = !match.gameState.player1.alive && !match.gameState.player2.alive
    const oneDead = !match.gameState.player1.alive || !match.gameState.player2.alive
    const timeUp = (Date.now() - match.startTime) >= 180000  // 3 minutes

    if (bothDead || oneDead || timeUp) {
      endGame(match)
    }
  }, 100)  // 100ms = 10 ticks per second
}

async function endGame(match: Match) {
  clearInterval(match.tickInterval)

  // Determine winner
  const p1 = match.gameState.player1
  const p2 = match.gameState.player2

  let winner: string | null = null
  let loser: string | null = null

  if (p1.alive && !p2.alive) {
    winner = match.player1.address
    loser = match.player2.address
  } else if (p2.alive && !p1.alive) {
    winner = match.player2.address
    loser = match.player1.address
  } else if (!p1.alive && !p2.alive) {
    // Both dead = draw
    winner = null
    loser = null
  } else {
    // Both alive (time expired) → higher score wins
    if (p1.score > p2.score) {
      winner = match.player1.address
      loser = match.player2.address
    } else if (p2.score > p1.score) {
      winner = match.player2.address
      loser = match.player1.address
    } else {
      // Tie score = draw
      winner = null
      loser = null
    }
  }

  const finalState: FinalGameState = {
    matchId: match.id,
    player1: match.player1.address,
    player2: match.player2.address,
    winner,
    loser,
    finalScores: {
      [match.player1.address]: p1.score,
      [match.player2.address]: p2.score
    },
    stakeAmount: '5000000',  // Example: $5 USDC
    duration: Date.now() - match.startTime
  }

  // Close Yellow session and get settlement proof (CRITICAL INTEGRATION POINT)
  const proof = await match.yellowSession.closeSession(finalState)

  // Broadcast game end to both clients
  io.to(match.player1.socketId).emit('game_end', { finalState, proof })
  io.to(match.player2.socketId).emit('game_end', { finalState, proof })

  // Cleanup
  activeMatches.delete(match.id)
}
```

```typescript
// ══════════════════════════════════════════════════════════
// CLIENT SIDE (React + Socket.io-client)
// ══════════════════════════════════════════════════════════

import { io, Socket } from 'socket.io-client'

let socket: Socket
let currentGameState: GameState

function connectToMatch(matchId: string, playerAddress: string) {
  socket = io('http://localhost:3001')

  socket.on('connect', () => {
    socket.emit('join_match', { matchId, playerAddress })
  })

  socket.on('state_update', (state: GameState) => {
    currentGameState = state
    // State is rendered at 60 FPS in the renderLoop
  })

  socket.on('game_end', ({ finalState, proof }) => {
    // Show results screen with settlement proof
    showResultsScreen(finalState, proof)
  })

  // Input handling
  window.addEventListener('keydown', (e) => {
    const dirMap = {
      'ArrowUp': 'UP', 'w': 'UP', 'W': 'UP',
      'ArrowDown': 'DOWN', 's': 'DOWN', 'S': 'DOWN',
      'ArrowLeft': 'LEFT', 'a': 'LEFT', 'A': 'LEFT',
      'ArrowRight': 'RIGHT', 'd': 'RIGHT', 'D': 'RIGHT'
    }

    const direction = dirMap[e.key]
    if (direction) {
      e.preventDefault()
      socket.emit('input', { matchId, direction })
    }
  })
}
```

---

## SECTION 5 — YELLOW SDK INTEGRATION POINTS

### Integration Point 1: Session Open (When Match Starts)
```typescript
// Called once when both players are matched
const yellowSession = new YellowGameSession(playerAddress, messageSigner)
await yellowSession.connect()
await yellowSession.openSession(opponentAddress, stakeAmount)
```

### Integration Point 2: State Updates (Every Tick)
```typescript
// Called 10 times per second during gameplay
match.tickInterval = setInterval(async () => {
  match.gameState = processTick(match.gameState)
  
  // YELLOW SDK CALL — This is the core integration
  await match.yellowSession.pushGameState(match.gameState)
  
  // ... broadcast to clients
}, 100)
```

### Integration Point 3: Session Close (When Game Ends)
```typescript
// Called once when game ends
const finalState: FinalGameState = {
  matchId,
  player1: address1,
  player2: address2,
  winner: winnerAddress || null,
  loser: loserAddress || null,
  finalScores: { [address1]: score1, [address2]: score2 },
  stakeAmount: '5000000',
  duration: endTime - startTime
}

// YELLOW SDK CALL — Returns settlement proof
const proof = await match.yellowSession.closeSession(finalState)

// proof contains:
// {
//   signedState: '0xABCD...',  // ClearNode-signed bytes
//   stateHash: '0x1234...',    // Show this in UI
//   winner: '0x...',
//   matchId: 'uuid'
// }
```

---

## SECTION 6 — GAME STATE TYPE DEFINITIONS

```typescript
interface GridPosition {
  x: number  // 0-19
  y: number  // 0-19
}

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'

interface Snake {
  segments: GridPosition[]
  direction: Direction
  pendingDirection: Direction | null
  alive: boolean
  score: number
}

interface GameState {
  player1: Snake
  player2: Snake
  food: GridPosition[]
  tick: number
  time: number  // milliseconds since match start
}

interface FinalGameState {
  matchId: string
  player1: string   // address
  player2: string   // address
  winner: string | null
  loser: string | null
  finalScores: Record<string, number>
  stakeAmount: string  // raw USDC units
  duration: number     // milliseconds
}
```

---

## SECTION 7 — PERFORMANCE OPTIMIZATIONS

### 1. Minimize Object Allocations in Hot Loop
```typescript
// BAD (creates new array every tick):
function moveSnake(snake: Snake): Snake {
  return {
    ...snake,
    segments: [newHead, ...snake.segments.slice(0, -1)]
  }
}

// GOOD (mutate in place):
function moveSnake(snake: Snake): void {
  snake.segments.unshift(newHead)
  if (!foodEaten) {
    snake.segments.pop()
  }
}
```

### 2. Pre-allocate Occupied Cell Set
```typescript
// Reuse the same Set across ticks, clear and refill
const occupiedCells = new Set<string>()

function spawnFood(state: GameState): GridPosition {
  occupiedCells.clear()
  state.player1.segments.forEach(s => occupiedCells.add(`${s.x},${s.y}`))
  state.player2.segments.forEach(s => occupiedCells.add(`${s.x},${s.y}`))
  // ...
}
```

### 3. Avoid Unnecessary Renders
```typescript
let lastStateHash = ''

function render(state: GameState) {
  const stateHash = JSON.stringify(state)  // Quick and dirty hash
  if (stateHash === lastStateHash) return  // Skip render if state unchanged
  lastStateHash = stateHash

  // ... render logic
}
```

---

## SECTION 8 — EDGE CASES & SPECIAL SCENARIOS

### Scenario 1: Both Snakes Eat Same Food (Same Tick)
```typescript
// RULE: First snake in processing order gets the food
// Processing order: always player1 then player2

function processTick(state: GameState): GameState {
  // Move player1
  const p1NewHead = calculateNewHead(state.player1)
  const p1AteFood = state.food.some(f => f.x === p1NewHead.x && f.y === p1NewHead.y)
  
  if (p1AteFood) {
    state.player1.score += 10
    state.player1.segments.unshift(p1NewHead)
    state.food = state.food.filter(f => !(f.x === p1NewHead.x && f.y === p1NewHead.y))
  } else {
    state.player1.segments = [p1NewHead, ...state.player1.segments.slice(0, -1)]
  }

  // Move player2 (food might already be gone if player1 ate it)
  const p2NewHead = calculateNewHead(state.player2)
  const p2AteFood = state.food.some(f => f.x === p2NewHead.x && f.y === p2NewHead.y)
  
  if (p2AteFood) {
    state.player2.score += 10
    state.player2.segments.unshift(p2NewHead)
    state.food = state.food.filter(f => !(f.x === p2NewHead.x && f.y === p2NewHead.y))
  } else {
    state.player2.segments = [p2NewHead, ...state.player2.segments.slice(0, -1)]
  }

  // ... rest of collision checks
}
```

### Scenario 2: Snake Grows Into Its Own Tail
```typescript
// This is ALLOWED. When a snake eats food, it grows by adding the new head
// and NOT removing the tail. This means the tail segment stays in place.
// The snake will not collide with its own tail on the same tick it grows.

// Example:
// Before eating food:
// segments = [{x:5,y:5}, {x:4,y:5}, {x:3,y:5}]  // length 3
//
// After eating food at (6,5):
// segments = [{x:6,y:5}, {x:5,y:5}, {x:4,y:5}, {x:3,y:5}]  // length 4
//
// Self-collision check skips index 0 (head), so checks [1,2,3]
// Head at (6,5) doesn't match any of those → no collision
```

### Scenario 3: Network Desync
```typescript
// If client state desyncs from server (due to packet loss, lag, etc.):
// 1. Client continues to render its local prediction
// 2. When server state arrives, client reconciles
// 3. If desync is >5 ticks, force full resync

let lastServerTick = 0

socket.on('state_update', (serverState: GameState) => {
  const tickDiff = serverState.tick - lastServerTick
  
  if (tickDiff > 5) {
    // Force resync
    currentGameState = serverState
    console.warn('Desync detected, resyncing')
  } else {
    // Normal update
    currentGameState = serverState
  }
  
  lastServerTick = serverState.tick
})
```

---

## SECTION 9 — TESTING CHECKLIST

Before shipping, verify:
- [ ] Wall collision works on all 4 edges
- [ ] Self collision works when snake length > 3
- [ ] Head-to-head collision kills both snakes
- [ ] Head-to-body collision kills only the colliding snake
- [ ] 180° direction reversal is blocked
- [ ] Food never spawns on snake bodies
- [ ] Food respawns immediately after being eaten
- [ ] Score increments by +10 on food eat
- [ ] Snake grows by exactly 1 segment on food eat
- [ ] Game tick rate is stable at 100ms (no drift)
- [ ] Render rate is smooth at 60 FPS
- [ ] Input lag is <100ms (one tick delay is acceptable)
- [ ] Network sync works at 100ms latency
- [ ] Both players see identical game states
- [ ] Yellow SDK `pushGameState()` is called every tick
- [ ] Yellow SDK `closeSession()` returns valid proof
- [ ] Game ends correctly on: death, double death, timeout, high score

---

## SECTION 10 — FINAL IMPLEMENTATION NOTES

**Do NOT add:**
- Power-ups (keep it pure snake)
- Obstacles (grid should be empty except snakes + food)
- Multiple food items (one at a time is correct)
- Variable snake speed (10 ticks/sec is fixed)
- Diagonal movement (only 4 directions)

**Do ADD:**
- Sound effects (food eat, death, countdown)
- Particle effects (food explosion, death)
- Screen shake on collision
- Victory/defeat animations

**Critical Path:**
1. Build the core game loop (tick → move → collision → render)
2. Test single-player mode first (AI opponent or keyboard-controlled second snake)
3. Add multiplayer networking (Socket.io client + server)
4. Integrate Yellow SDK (connect → openSession → pushGameState loop → closeSession)
5. Add UI polish (LiveGameOverlay, SettlementPanel, scores, timer)
6. Test with 100ms simulated latency
7. Optimize render loop for 60 FPS
8. Ship

---

## SECTION 11 — SUCCESS CRITERIA

**You know the game works when:**
1. Two players can connect and play a full match
2. Every tick generates a Yellow state update (visible in network tab)
3. LiveGameOverlay counter increments smoothly
4. Game ends correctly in all scenarios (death/timeout/draw)
5. Settlement proof appears on results screen
6. Judges can play the demo without bugs

**Performance benchmarks:**
- Tick processing: <10ms per tick
- Render time: <5ms per frame (leaves 11ms buffer for 60 FPS)
- Network latency: <100ms round-trip
- State update signing: <50ms (Yellow SDK overhead)

**The ultimate test:**
Play 10 full matches. If all 10 end with correct winners and valid settlement proofs, you're ready to demo.
