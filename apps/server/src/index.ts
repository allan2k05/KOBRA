import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { processTick, createInitialState, setDirection, startBoost } from "./game/engine";
import type { GameState, FinalGameState } from "./game/types";

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*", // Adjust for production
        methods: ["GET", "POST"]
    }
});

const PORT = Number(process.env.PORT) || 3005;

console.log('Starting server setup...');
console.log('PORT:', PORT);

app.get("/", (req, res) => {
    console.log('Received request on /');
    res.send("Slither Duel Game Server is Running!");
});

// Debug endpoint: returns current matchmaking queues and active games
app.get('/debug/queues', (req, res) => {
    try {
        const queueSnapshot: Record<string, { socketId: string; address: string; stake: string }[]> = {};
        Object.keys(queues).forEach(k => {
            queueSnapshot[k] = queues[k].slice();
        });

        const active = Array.from(activeGames.entries()).map(([matchId, g]) => ({ 
            matchId, 
            p1: g.player1Address, 
            p2: g.player2Address,
            gameTime: g.state.gameTime,
            matchEnded: g.state.matchEnded
        }));

        res.json({ queues: queueSnapshot, active });
    } catch (err) {
        console.error('Error in /debug/queues:', err);
        res.status(500).json({ error: 'internal' });
    }
});
console.log('Express routes configured...');

interface QueuedPlayer {
    socketId: string;
    address: string;
    stake: string;
}

// ══════════════════════════════════════════════════════
//  LEADERBOARD SYSTEM
// ══════════════════════════════════════════════════════

interface LeaderboardEntry {
    address: string;
    wins: number;
    losses: number;
    kills: number;
    bestLength: number;
    bestScore: number;
    totalGames: number;
    lastProofHash: string;
    lastUpdated: number;
}

// In-memory leaderboard store (production: use Redis/PostgreSQL)
const leaderboard: Map<string, LeaderboardEntry> = new Map();

// Update leaderboard after a match ends
function updateLeaderboard(finalState: FinalGameState): void {
    const { winner, loser, finalScores, finalLengths, finalKills, matchId } = finalState;
    
    // Generate a proof hash from match data
    const proofHash = `0x${Buffer.from(matchId + Date.now().toString()).toString('hex').slice(0, 16)}...`;
    
    // Update winner stats
    if (winner && winner !== 'BOT') {
        const existing = leaderboard.get(winner) || {
            address: winner,
            wins: 0,
            losses: 0,
            kills: 0,
            bestLength: 0,
            bestScore: 0,
            totalGames: 0,
            lastProofHash: '',
            lastUpdated: 0
        };
        
        existing.wins += 1;
        existing.totalGames += 1;
        existing.kills += finalKills[winner] || 0;
        existing.bestLength = Math.max(existing.bestLength, finalLengths[winner] || 0);
        existing.bestScore = Math.max(existing.bestScore, finalScores[winner] || 0);
        existing.lastProofHash = proofHash;
        existing.lastUpdated = Date.now();
        
        leaderboard.set(winner, existing);
        console.log(`[Leaderboard] Updated winner ${winner}: ${existing.wins}W/${existing.losses}L`);
    }
    
    // Update loser stats (skip BOT)
    if (loser && loser !== 'BOT') {
        const existing = leaderboard.get(loser) || {
            address: loser,
            wins: 0,
            losses: 0,
            kills: 0,
            bestLength: 0,
            bestScore: 0,
            totalGames: 0,
            lastProofHash: '',
            lastUpdated: 0
        };
        
        existing.losses += 1;
        existing.totalGames += 1;
        existing.kills += finalKills[loser] || 0;
        existing.bestLength = Math.max(existing.bestLength, finalLengths[loser] || 0);
        existing.bestScore = Math.max(existing.bestScore, finalScores[loser] || 0);
        existing.lastUpdated = Date.now();
        
        leaderboard.set(loser, existing);
        console.log(`[Leaderboard] Updated loser ${loser}: ${existing.wins}W/${existing.losses}L`);
    }
}

// Get sorted leaderboard (by wins, then best score)
function getLeaderboard(limit: number = 50): LeaderboardEntry[] {
    return Array.from(leaderboard.values())
        .sort((a, b) => {
            if (b.wins !== a.wins) return b.wins - a.wins;
            if (b.bestScore !== a.bestScore) return b.bestScore - a.bestScore;
            return b.bestLength - a.bestLength;
        })
        .slice(0, limit);
}

// ── Leaderboard API Endpoints ──
app.get('/api/leaderboard', (req, res) => {
    try {
        const limit = parseInt(req.query.limit as string) || 50;
        const entries = getLeaderboard(limit);
        res.json({ 
            success: true, 
            data: entries,
            total: leaderboard.size,
            updatedAt: Date.now()
        });
    } catch (err) {
        console.error('Error fetching leaderboard:', err);
        res.status(500).json({ success: false, error: 'internal' });
    }
});

app.get('/api/leaderboard/:address', (req, res) => {
    try {
        const entry = leaderboard.get(req.params.address);
        if (entry) {
            // Calculate rank
            const sorted = getLeaderboard(1000);
            const rank = sorted.findIndex(e => e.address === req.params.address) + 1;
            res.json({ success: true, data: { ...entry, rank } });
        } else {
            res.json({ success: true, data: null });
        }
    } catch (err) {
        console.error('Error fetching player stats:', err);
        res.status(500).json({ success: false, error: 'internal' });
    }
});

// Matchmaking queues per stake tier
const queues: Record<string, QueuedPlayer[]> = {
    '1000000': [],  // $1
    '5000000': [],  // $5
    '25000000': [], // $25
};

// Active games: matchId -> GameState
const activeGames: Map<string, {
    state: GameState;
    player1Socket: string;
    player2Socket: string;
    player1Address: string;
    player2Address: string;
    interval?: NodeJS.Timeout;
    startTime: number;
    stake: string;
    isBotMode: boolean;
}> = new Map();

// Signature verification tracking
const matchSignatures: Map<string, {
    player1Signature?: string;
    player2Signature?: string;
    player1Message?: string;
    player2Message?: string;
}> = new Map();

console.log('Setting up Socket.IO...');
io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    // 1. Join Lobby / Matchmaking
    socket.on("join_lobby", ({ address, stake, mode }: { address: string, stake: string, mode?: 'multiplayer' | 'bot' }) => {
        if (!queues[stake]) {
            console.error(`Invalid stake tier: ${stake}`);
            return;
        }

        console.log(`[Lobby] ${socket.id} joined ${stake} queue (mode: ${mode || 'multiplayer'})`);
        
        // Bot mode - instant match creation (but wait for ready_to_start to begin game loop)
        if (mode === 'bot') {
            const matchId = `bot_match_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
            console.log(`[Bot Match] Created ${matchId} for ${address} vs BOT`);

            // Notify player - they will navigate to game page and send ready_to_start
            io.to(socket.id).emit("match_found", { opponent: 'BOT', matchId, stake, role: 'p1' });

            // Initialize Bot Game state with multi-AI arena (Slither.io-style)
            const initialState = createInitialState(address, 'BOT', matchId, true);

            const game = {
                state: initialState,
                player1Socket: '', // Will be set when game page connects
                player2Socket: 'BOT', 
                player1Address: address,
                player2Address: 'BOT',
                startTime: Date.now(),
                stake,
                interval: undefined as NodeJS.Timeout | undefined,
                isBotMode: true
            };

            activeGames.set(matchId, game);
            console.log(`[Bot Match] Match ${matchId} created, waiting for player to connect from game page`);
            
            return;
        }

        // Multiplayer mode - normal queue logic
        queues[stake].push({ socketId: socket.id, address, stake });

        // Check for match
        if (queues[stake].length >= 2) {
            const p1 = queues[stake].shift()!;
            const p2 = queues[stake].shift()!;

            const matchId = `match_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
            console.log(`[Match] Created ${matchId} for ${p1.address} vs ${p2.address}`);

            // Notify players
            io.to(p1.socketId).emit("match_found", { opponent: p2.address, matchId, stake, role: 'p1' });
            io.to(p2.socketId).emit("match_found", { opponent: p1.address, matchId, stake, role: 'p2' });

            // Initialize Game with new engine (multiplayer: no extra AI snakes)
            const initialState = createInitialState(p1.address, p2.address, matchId, false);

            activeGames.set(matchId, {
                state: initialState,
                player1Socket: p1.socketId, 
                player2Socket: p2.socketId, 
                player1Address: p1.address,
                player2Address: p2.address,
                startTime: Date.now(),
                stake,
                isBotMode: false
            });
        }
    });

    // 1.5 Handle Match Signature Verification (for multiplayer matches)
    socket.on("match_signature", ({ matchId, address, signature, message }) => {
        console.log(`[Signature] Received signature for ${matchId} from ${address}`);
        
        const game = activeGames.get(matchId);
        if (!game) {
            console.error(`[Signature] No game found for matchId: ${matchId}`);
            return;
        }

        // Initialize signature tracking for this match if needed
        if (!matchSignatures.has(matchId)) {
            matchSignatures.set(matchId, {});
        }
        
        const signatures = matchSignatures.get(matchId)!;
        
        // Store signature based on player address
        if (address === game.player1Address) {
            signatures.player1Signature = signature;
            signatures.player1Message = message;
            console.log(`[Signature] Player 1 signed for ${matchId}`);
        } else if (address === game.player2Address) {
            signatures.player2Signature = signature;
            signatures.player2Message = message;
            console.log(`[Signature] Player 2 signed for ${matchId}`);
        } else {
            console.error(`[Signature] Invalid address ${address} for match ${matchId}`);
            return;
        }

        // Check if both players have signed
        if (signatures.player1Signature && signatures.player2Signature) {
            console.log(`[Signature] Both players signed for ${matchId}, starting game!`);
            
            // Notify both players that signatures are complete
            io.to(game.player1Socket || socket.id).emit("opponent_signed");
            io.to(game.player2Socket || socket.id).emit("opponent_signed");
            
            // Clean up signature tracking
            matchSignatures.delete(matchId);
        } else {
            // Notify the signing player to wait for opponent
            io.to(socket.id).emit("waiting_for_opponent_signature");
        }
    });

    // 2. Player Ready -> Start Game Loop
    socket.on("ready_to_start", ({ matchId, address }) => {
        console.log(`[Game] Received ready_to_start for matchId: ${matchId} from socket: ${socket.id} (address: ${address})`);
        const game = activeGames.get(matchId);
        if (!game) {
            console.error(`[Game] No active game found for matchId: ${matchId}`);
            return;
        }

        // Join the match room
        socket.join(matchId);
        console.log(`[Game] Socket ${socket.id} joined room ${matchId}`);

        // Update socket mapping based on address
        if (address === game.player1Address) {
            game.player1Socket = socket.id;
            console.log(`[Game] Updated player1Socket to ${socket.id}`);
        } else if (address === game.player2Address && game.player2Address !== 'BOT') {
            game.player2Socket = socket.id;
            console.log(`[Game] Updated player2Socket to ${socket.id}`);
        }

        // Wait for BOTH players before starting the game loop (BOT counts as ready)
        const bothPlayersReady = game.player1Socket && (game.player2Socket || game.player2Address === 'BOT');
        console.log(`[Game] Player ready. P1: ${game.player1Socket ? 'ready' : 'waiting'}, P2: ${game.player2Address === 'BOT' ? 'BOT ready' : (game.player2Socket ? 'ready' : 'waiting')}`);

        if (bothPlayersReady && !game.interval) {
            console.log(`[Game] BOTH players ready - starting 2-minute Slither Duel for ${matchId}`);
            game.startTime = Date.now();
            let lastTickTime = Date.now();

            // Send initial state immediately
            console.log(`[Game] Sending initial state for ${matchId}`);
            io.to(matchId).emit("state_update", game.state);

            game.interval = setInterval(() => {
                try {
                    const now = Date.now();
                    const deltaMs = now - lastTickTime;
                    lastTickTime = now;
                    const newState = processTick(game.state, deltaMs);
                    game.state = newState;

                    // Broadcast state at 20 TPS for smooth Slither gameplay
                    io.to(matchId).emit("state_update", newState);

                    // Check if match ended (2 minutes or manual end)
                    if (newState.matchEnded) {
                        clearInterval(game.interval!);
                        game.interval = undefined;

                        const finalState: FinalGameState = {
                            matchId,
                            player1: newState.player1.address,
                            player2: newState.player2.address,
                            winner: newState.winner,
                            loser: newState.winner ? (newState.winner === newState.player1.address ? newState.player2.address : newState.player1.address) : null,
                            finalScores: {
                                [newState.player1.address]: newState.player1.score,
                                [newState.player2.address]: newState.player2.score,
                            },
                            finalLengths: {
                                [newState.player1.address]: newState.player1.length,
                                [newState.player2.address]: newState.player2.length,
                            },
                            finalKills: {
                                [newState.player1.address]: newState.player1.kills,
                                [newState.player2.address]: newState.player2.kills,
                            },
                            stakeAmount: game.stake,
                            duration: Date.now() - game.startTime,
                            matchType: 'time_limit'
                        };

                        console.log(`[Game] Slither Duel ended for ${matchId}. Winner: ${newState.winner} (Length: P1=${newState.player1.length}, P2=${newState.player2.length}, Kills: P1=${newState.player1.kills}, P2=${newState.player2.kills})`);
                        
                        // Update leaderboard with match results
                        updateLeaderboard(finalState);
                        
                        io.to(matchId).emit("game_over", finalState);

                        // Clean up
                        activeGames.delete(matchId);
                    }
                } catch (error) {
                    console.error(`[Game] Error in game loop for ${matchId}:`, error);
                }
            }, 50); // 20 TPS for smooth Slither movement
        }
    });

    // 3. Handle Mouse Input for Slither Controls
    socket.on("mouse_move", ({ matchId, mouseX, mouseY, canvasWidth, canvasHeight, address }) => {
        const game = activeGames.get(matchId);
        if (!game) return;

        // Find player snake and update target direction
        if (game.state.player1.address === address && game.state.player1.alive) {
            setDirection(game.state.player1, mouseX, mouseY, canvasWidth, canvasHeight);
        } else if (game.state.player2.address === address && game.state.player2.alive) {
            setDirection(game.state.player2, mouseX, mouseY, canvasWidth, canvasHeight);
        }
    });

    // 4. Handle Boost Input (Spacebar/Click)
    socket.on("boost", ({ matchId, address }) => {
        const game = activeGames.get(matchId);
        if (!game) return;

        // Find player snake and start boost
        if (game.state.player1.address === address && game.state.player1.alive) {
            startBoost(game.state.player1);
            console.log(`[Input] Player 1 boosted`);
        } else if (game.state.player2.address === address && game.state.player2.alive) {
            startBoost(game.state.player2);
            console.log(`[Input] Player 2 boosted`);
        }
    });

    // 5. Handle Forfeit
    socket.on("forfeit", ({ matchId, address }) => {
        const game = activeGames.get(matchId);
        if (!game) return;

        console.log(`[Game] Player ${address} forfeited match ${matchId}`);

        if (game.interval) {
            clearInterval(game.interval);
            game.interval = undefined;
        }

        const winner = game.state.player1.address === address ? game.state.player2.address : game.state.player1.address;
        const loser = address;

        const finalState: FinalGameState = {
            matchId,
            player1: game.state.player1.address,
            player2: game.state.player2.address,
            winner,
            loser,
            finalScores: {
                [game.state.player1.address]: game.state.player1.score,
                [game.state.player2.address]: game.state.player2.score,
            },
            finalLengths: {
                [game.state.player1.address]: game.state.player1.length,
                [game.state.player2.address]: game.state.player2.length,
            },
            finalKills: {
                [game.state.player1.address]: game.state.player1.kills,
                [game.state.player2.address]: game.state.player2.kills,
            },
            stakeAmount: game.stake,
            duration: Date.now() - game.startTime,
            matchType: 'forfeit'
        };

        // Update leaderboard with match results
        updateLeaderboard(finalState);
        
        io.to(matchId).emit("game_over", finalState);
        activeGames.delete(matchId);
    });

    // 6. Disconnect - Clean up queues and active games
    socket.on("disconnect", () => {
        console.log("Client disconnected:", socket.id);
        
        // Remove from all queues
        Object.keys(queues).forEach(stake => {
            const index = queues[stake].findIndex(p => p.socketId === socket.id);
            if (index !== -1) {
                queues[stake].splice(index, 1);
                console.log(`[Lobby] Removed ${socket.id} from ${stake} queue`);
            }
        });
        
        // Handle active games - if a player disconnects, end the match
        for (const [matchId, game] of activeGames.entries()) {
            if (game.player1Socket === socket.id || game.player2Socket === socket.id) {
                console.log(`[Game] Player disconnected in ${matchId}. Ending match...`);

                if (game.interval) {
                    clearInterval(game.interval);
                    game.interval = undefined;
                }

                const winnerAddress = (game.player1Socket === socket.id)
                    ? game.state.player2.address
                    : game.state.player1.address;

                const loserAddress = (game.player1Socket === socket.id)
                    ? game.state.player1.address
                    : game.state.player2.address;

                const finalState: FinalGameState = {
                    matchId,
                    player1: game.state.player1.address,
                    player2: game.state.player2.address,
                    winner: winnerAddress,
                    loser: loserAddress,
                    finalScores: {
                        [game.state.player1.address]: game.state.player1.score,
                        [game.state.player2.address]: game.state.player2.score,
                    },
                    finalLengths: {
                        [game.state.player1.address]: game.state.player1.length,
                        [game.state.player2.address]: game.state.player2.length,
                    },
                    finalKills: {
                        [game.state.player1.address]: game.state.player1.kills,
                        [game.state.player2.address]: game.state.player2.kills,
                    },
                    stakeAmount: game.stake,
                    duration: Date.now() - game.startTime,
                    matchType: 'disconnect'
                };

                // Update leaderboard with match results
                updateLeaderboard(finalState);
                
                const winnerSocket = (game.player1Socket === socket.id) ? game.player2Socket : game.player1Socket;
                io.to(winnerSocket).emit("game_over", finalState);

                activeGames.delete(matchId);
            }
        }
    });
});

console.log('Starting HTTP server...');
httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Slither Duel Server running on http://localhost:${PORT}`);
}).on('error', (err) => {
    console.error('❌ Server error:', err);
});

console.log('Server setup complete.');

process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
});

process.on('unhandledRejection', (err) => {
    console.error('Unhandled rejection:', err);
});
