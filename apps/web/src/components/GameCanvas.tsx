/**
 * KŌBRA Slither Canvas Renderer
 * Ported from Slither.io reference:
 *   - Colored snakes & orbs (6-color palette from textures/)
 *   - Multiple AI snakes rendered simultaneously
 *   - Camera follows player head (Camera.py translate logic)
 *   - Death orbs visually match dead snake's color
 *   - Glow effects, eyes, smooth body lines
 *   - Minimap showing all snakes in the arena
 *   - HUD with timer, length bars, kills, score, boost
 *
 * 60 FPS rendering with requestAnimationFrame.
 */
'use client'
import { useEffect, useRef, useCallback, useState } from 'react'
import type { GameState, Snake, SnakeColor } from '../game/types'

const CANVAS_WIDTH = 1200
const CANVAS_HEIGHT = 800
const MINIMAP_SIZE = 160
const MINIMAP_PADDING = 12

// ─── Color palette matching Slither.io textures/ ───
const COLOR_MAP: Record<SnakeColor, { body: string; head: string; glow: string }> = {
  red:    { body: '#ef4444', head: '#dc2626', glow: '#f87171' },
  blue:   { body: '#3b82f6', head: '#2563eb', glow: '#60a5fa' },
  green:  { body: '#22c55e', head: '#16a34a', glow: '#4ade80' },
  purple: { body: '#a855f7', head: '#9333ea', glow: '#c084fc' },
  yellow: { body: '#eab308', head: '#ca8a04', glow: '#facc15' },
  orange: { body: '#f97316', head: '#ea580c', glow: '#fb923c' },
}

const ORB_COLOR_MAP: Record<SnakeColor, string> = {
  red: '#ef4444', blue: '#3b82f6', green: '#22c55e',
  purple: '#a855f7', yellow: '#eab308', orange: '#f97316',
}

// Fallback if color is undefined
const DEFAULT_PLAYER_COLORS = { body: '#06b6d4', head: '#0891b2', glow: '#22d3ee' }
const DEFAULT_OPPONENT_COLORS = { body: '#f97316', head: '#ea580c', glow: '#fb923c' }

interface Props {
  gameState: GameState
  stateCount: number
  matchActive: boolean
  playerAddress: string
  onMouseMove: (mouseX: number, mouseY: number) => void
  onBoost: () => void
}

export function GameCanvas({ gameState, stateCount, matchActive, playerAddress, onMouseMove, onBoost }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animationRef = useRef<number | null>(null)
  const lastRef = useRef<number>(0)
  const [cameraX, setCameraX] = useState<number>(1500)
  const [cameraY, setCameraY] = useState<number>(1500)

  const arenaW = gameState?.arenaWidth || 3000
  const arenaH = gameState?.arenaHeight || 3000

  // ─── Get player's own snake ───
  const getPlayerSnake = useCallback((): Snake | null => {
    if (!gameState?.player1 || !gameState?.player2) return null
    return gameState.player1.address === playerAddress ? gameState.player1 : gameState.player2
  }, [gameState, playerAddress])

  const getOpponentSnake = useCallback((): Snake | null => {
    if (!gameState?.player1 || !gameState?.player2) return null
    return gameState.player1.address === playerAddress ? gameState.player2 : gameState.player1
  }, [gameState, playerAddress])

  // ─── Camera follows player head (Camera.py: update) ───
  useEffect(() => {
    const ps = getPlayerSnake()
    if (ps?.segments && ps.segments.length > 0) {
      setCameraX(ps.segments[0].x)
      setCameraY(ps.segments[0].y)
    }
  }, [gameState, getPlayerSnake])

  // ─── Collect ALL snakes for rendering ───
  const getAllSnakes = useCallback((): Snake[] => {
    if (!gameState) return []
    const snakes: Snake[] = []
    if (gameState.player1) snakes.push(gameState.player1)
    if (gameState.player2) snakes.push(gameState.player2)
    if (gameState.aiSnakes) snakes.push(...gameState.aiSnakes)
    return snakes
  }, [gameState])

  // ─── Draw a single snake (body line + head + eyes) ───
  const drawSnake = useCallback((ctx: CanvasRenderingContext2D, snake: Snake, isPlayer: boolean) => {
    if (!snake || !snake.alive || !snake.segments || snake.segments.length === 0) return

    const colors = snake.color && COLOR_MAP[snake.color]
      ? COLOR_MAP[snake.color]
      : (isPlayer ? DEFAULT_PLAYER_COLORS : DEFAULT_OPPONENT_COLORS)

    // Grace period: flash translucent
    if (snake.graceTime > 0) {
      ctx.globalAlpha = 0.4 + 0.3 * Math.sin(Date.now() / 80)
    }

    // Body glow (subtle outer line)
    ctx.lineWidth = 18
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = colors.glow
    ctx.globalAlpha = (ctx.globalAlpha || 1) * 0.3
    ctx.beginPath()
    ctx.moveTo(snake.segments[0].x, snake.segments[0].y)
    for (let i = 1; i < snake.segments.length; i++) {
      ctx.lineTo(snake.segments[i].x, snake.segments[i].y)
    }
    ctx.stroke()
    ctx.globalAlpha = snake.graceTime > 0 ? 0.4 + 0.3 * Math.sin(Date.now() / 80) : 1

    // Body line
    ctx.lineWidth = 14
    ctx.strokeStyle = colors.body
    ctx.beginPath()
    ctx.moveTo(snake.segments[0].x, snake.segments[0].y)
    for (let i = 1; i < snake.segments.length; i++) {
      ctx.lineTo(snake.segments[i].x, snake.segments[i].y)
    }
    ctx.stroke()

    // Head circle with glow
    const head = snake.segments[0]
    ctx.beginPath()
    ctx.fillStyle = colors.head
    ctx.shadowColor = colors.glow
    ctx.shadowBlur = 15
    ctx.arc(head.x, head.y, 16, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0

    // Eyes (Player.py: direction-based eye placement)
    const dir = snake.direction || 0
    const eyeOff = 6
    const eyeR = 4
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(head.x + Math.cos(dir - 0.4) * eyeOff, head.y + Math.sin(dir - 0.4) * eyeOff, eyeR, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(head.x + Math.cos(dir + 0.4) * eyeOff, head.y + Math.sin(dir + 0.4) * eyeOff, eyeR, 0, Math.PI * 2)
    ctx.fill()

    // Pupils
    ctx.fillStyle = '#000'
    ctx.beginPath()
    ctx.arc(head.x + Math.cos(dir - 0.4) * (eyeOff + 2), head.y + Math.sin(dir - 0.4) * (eyeOff + 2), 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(head.x + Math.cos(dir + 0.4) * (eyeOff + 2), head.y + Math.sin(dir + 0.4) * (eyeOff + 2), 2, 0, Math.PI * 2)
    ctx.fill()

    // Boost indicator ring
    if (snake.boostTime > 0) {
      ctx.strokeStyle = '#fbbf24'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(head.x, head.y, 22, 0, Math.PI * 2)
      ctx.stroke()
    }

    // Name label for AI snakes
    if (!isPlayer && snake.address !== playerAddress) {
      ctx.fillStyle = 'rgba(255,255,255,0.6)'
      ctx.font = '10px monospace'
      ctx.textAlign = 'center'
      const label = snake.address.startsWith('AI_') ? `Bot ${snake.address.slice(3)}` : snake.address.slice(0, 6)
      ctx.fillText(label, head.x, head.y - 24)
    }

    ctx.globalAlpha = 1
  }, [playerAddress])

  // ─── Draw minimap (Camera.py: shows entire arena scaled down) ───
  const drawMinimap = useCallback((ctx: CanvasRenderingContext2D) => {
    const mx = CANVAS_WIDTH - MINIMAP_SIZE - MINIMAP_PADDING
    const my = MINIMAP_PADDING
    const scaleX = MINIMAP_SIZE / arenaW
    const scaleY = MINIMAP_SIZE / arenaH

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.7)'
    ctx.fillRect(mx, my, MINIMAP_SIZE, MINIMAP_SIZE)
    ctx.strokeStyle = '#333'
    ctx.lineWidth = 1
    ctx.strokeRect(mx, my, MINIMAP_SIZE, MINIMAP_SIZE)

    // Viewport rectangle
    const vpX = mx + (cameraX - CANVAS_WIDTH / 2) * scaleX
    const vpY = my + (cameraY - CANVAS_HEIGHT / 2) * scaleY
    const vpW = CANVAS_WIDTH * scaleX
    const vpH = CANVAS_HEIGHT * scaleY
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'
    ctx.strokeRect(vpX, vpY, vpW, vpH)

    // Draw all snakes as dots
    const all = getAllSnakes()
    for (const snake of all) {
      if (!snake.alive || !snake.segments || snake.segments.length === 0) continue
      const head = snake.segments[0]
      const isMe = snake.address === playerAddress
      const dotColor = isMe ? '#22d3ee' : (snake.color ? ORB_COLOR_MAP[snake.color] || '#f97316' : '#f97316')
      ctx.fillStyle = dotColor
      ctx.beginPath()
      ctx.arc(mx + head.x * scaleX, my + head.y * scaleY, isMe ? 3 : 2, 0, Math.PI * 2)
      ctx.fill()
    }
  }, [arenaW, arenaH, cameraX, cameraY, getAllSnakes, playerAddress])

  // ─── Draw HUD ───
  const drawHUD = useCallback((ctx: CanvasRenderingContext2D) => {
    const ps = getPlayerSnake()
    const os = getOpponentSnake()
    if (!ps || !os) return

    const timeLeft = Math.max(0, 120000 - (gameState?.gameTime || 0))
    const min = Math.floor(timeLeft / 60000)
    const sec = Math.floor((timeLeft % 60000) / 1000)

    ctx.save()

    // Timer (top center)
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 24px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(`${min}:${sec.toString().padStart(2, '0')}`, CANVAS_WIDTH / 2, 40)

    // Length bars
    const maxLen = Math.max(ps.length || 50, os.length || 50, 100)
    const barW = 300
    const barH = 20

    // Player bar (bottom)
    const pColor = ps.color && COLOR_MAP[ps.color] ? COLOR_MAP[ps.color].body : '#10b981'
    ctx.fillStyle = pColor
    ctx.fillRect((CANVAS_WIDTH - barW) / 2, CANVAS_HEIGHT - 60, ((ps.length || 50) / maxLen) * barW, barH)
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 2
    ctx.strokeRect((CANVAS_WIDTH - barW) / 2, CANVAS_HEIGHT - 60, barW, barH)
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 14px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(`You: ${Math.floor(ps.length || 50)}  •  Kills: ${ps.kills || 0}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT - 36)

    // Opponent bar (top)
    const oColor = os.color && COLOR_MAP[os.color] ? COLOR_MAP[os.color].body : '#ef4444'
    ctx.fillStyle = oColor
    ctx.fillRect((CANVAS_WIDTH - barW) / 2, 60, ((os.length || 50) / maxLen) * barW, barH)
    ctx.strokeStyle = '#fff'
    ctx.strokeRect((CANVAS_WIDTH - barW) / 2, 60, barW, barH)
    ctx.fillStyle = '#fff'
    ctx.fillText(`Opponent: ${Math.floor(os.length || 50)}  •  Kills: ${os.kills || 0}`, CANVAS_WIDTH / 2, 100)

    // Boost indicator (bottom left)
    const isBoosting = (ps.boostTime || 0) > 0
    ctx.fillStyle = isBoosting ? '#f59e0b' : '#10b981'
    ctx.font = 'bold 14px monospace'
    ctx.textAlign = 'left'
    ctx.fillText(isBoosting ? '🔥 BOOSTING!' : '⚡ Boost: READY [Space/Click]', 16, CANVAS_HEIGHT - 16)

    // Score (bottom right)
    ctx.textAlign = 'right'
    ctx.fillStyle = '#fbbf24'
    ctx.fillText(`Score: ${ps.score || 0}`, CANVAS_WIDTH - MINIMAP_SIZE - 32, CANVAS_HEIGHT - 16)

    // Snake count (top left)
    const aliveCount = getAllSnakes().filter(s => s.alive).length
    ctx.textAlign = 'left'
    ctx.fillStyle = '#9ca3af'
    ctx.font = '12px monospace'
    ctx.fillText(`🐍 ${aliveCount} alive`, 16, 30)

    ctx.restore()
  }, [gameState, getPlayerSnake, getOpponentSnake, getAllSnakes])

  // ─── Main render loop ───
  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear
    ctx.fillStyle = '#07070b'
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    // Camera transform (Camera.py: translate world → screen)
    ctx.save()
    const viewX = cameraX - CANVAS_WIDTH / 2
    const viewY = cameraY - CANVAS_HEIGHT / 2
    ctx.translate(-viewX, -viewY)

    // Arena boundary
    ctx.strokeStyle = '#333'
    ctx.lineWidth = 4
    ctx.strokeRect(0, 0, arenaW, arenaH)

    // Grid lines for visual reference
    ctx.strokeStyle = '#151520'
    ctx.lineWidth = 1
    const gridStep = 100
    for (let x = 0; x <= arenaW; x += gridStep) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, arenaH); ctx.stroke()
    }
    for (let y = 0; y <= arenaH; y += gridStep) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(arenaW, y); ctx.stroke()
    }

    // ── Draw orbs with Slither.io-style colors ──
    if (gameState?.orbs) {
      for (const orb of gameState.orbs) {
        // Cull orbs outside viewport
        if (orb.x < viewX - 30 || orb.x > viewX + CANVAS_WIDTH + 30 ||
            orb.y < viewY - 30 || orb.y > viewY + CANVAS_HEIGHT + 30) continue

        const orbCol = orb.color ? (ORB_COLOR_MAP[orb.color] || '#22c55e') : '#22c55e'
        const radius = orb.size * 5 + 2

        // Glow
        ctx.shadowColor = orbCol
        ctx.shadowBlur = 8
        ctx.fillStyle = orbCol
        ctx.beginPath()
        ctx.arc(orb.x, orb.y, radius, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0

        // Inner highlight
        ctx.fillStyle = 'rgba(255,255,255,0.3)'
        ctx.beginPath()
        ctx.arc(orb.x - radius * 0.2, orb.y - radius * 0.2, radius * 0.4, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // ── Draw all snakes (Slither.io: player + opponent + AI bots) ──
    const allSnakes = getAllSnakes()
    // Draw non-player snakes first, player on top
    for (const snake of allSnakes) {
      if (snake.address === playerAddress) continue
      drawSnake(ctx, snake, false)
    }
    // Draw player last (on top)
    for (const snake of allSnakes) {
      if (snake.address === playerAddress) {
        drawSnake(ctx, snake, true)
      }
    }

    ctx.restore()

    // ── HUD overlay (FontRenderer.py: score display) ──
    drawHUD(ctx)

    // ── Minimap ──
    drawMinimap(ctx)
  }, [cameraX, cameraY, arenaW, arenaH, gameState, playerAddress, getAllSnakes, drawSnake, drawHUD, drawMinimap])

  // ─── Animation loop at 60 FPS ───
  useEffect(() => {
    let mounted = true
    const loop = (ts: number) => {
      if (!mounted) return
      const delta = ts - lastRef.current
      if (delta >= 16) {
        render()
        lastRef.current = ts
      }
      animationRef.current = requestAnimationFrame(loop)
    }
    if (matchActive && gameState) {
      animationRef.current = requestAnimationFrame(loop)
    }
    return () => {
      mounted = false
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [render, matchActive, gameState])

  // ─── Mouse → server for steering (Player.py: calculateDirection) ───
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect || !matchActive) return
    onMouseMove(e.clientX - rect.left, e.clientY - rect.top)
  }, [onMouseMove, matchActive])

  // ─── Click for boost ───
  const handleClick = useCallback(() => {
    if (matchActive) onBoost()
  }, [onBoost, matchActive])

  // ─── Space for boost ───
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        if (matchActive) onBoost()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onBoost, matchActive])

  return (
    <div className="relative inline-block">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        className="border-2 border-gray-700 rounded-xl cursor-crosshair"
        style={{ maxWidth: '100%', height: 'auto' }}
      />
    </div>
  )
}
