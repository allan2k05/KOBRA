/**
 * Test script to validate multiplayer functionality
 * This simulates two players joining a match
 */

const io = require('socket.io-client');

async function testMultiplayerGame() {
    console.log('🎮 Starting multiplayer test...');
    
    // Create two socket connections (simulating two players)
    const player1 = io('http://localhost:3001');
    const player2 = io('http://localhost:3001');
    
    // Player 1 setup
    player1.on('connect', () => {
        console.log('✅ Player 1 connected:', player1.id);
        player1.emit('join_lobby', {
            address: '0x1234567890abcdef1234567890abcdef12345678',
            stake: '1000000' // $1 tier
        });
    });
    
    // Player 2 setup
    player2.on('connect', () => {
        console.log('✅ Player 2 connected:', player2.id);
        player2.emit('join_lobby', {
            address: '0x9876543210fedcba9876543210fedcba98765432',
            stake: '1000000' // $1 tier
        });
    });
    
    // Handle match found
    let matchId = null;
    let gameStarted = false;
    
    player1.on('match_found', (data) => {
        console.log('🎯 Player 1 match found:', data);
        matchId = data.matchId;
        player1.emit('ready_to_start', { matchId });
    });
    
    player2.on('match_found', (data) => {
        console.log('🎯 Player 2 match found:', data);
        matchId = data.matchId;
        player2.emit('ready_to_start', { matchId });
    });
    
    // Handle game state updates
    player1.on('state_update', (state) => {
        if (!gameStarted) {
            console.log('🎮 Game started! Tick:', state.tick);
            gameStarted = true;
            
            // Simulate some player input
            setTimeout(() => {
                console.log('🎯 Player 1 sending input: down');
                player1.emit('input', {
                    matchId,
                    dir: 'down',
                    address: '0x1234567890abcdef1234567890abcdef12345678'
                });
            }, 1000);
            
            setTimeout(() => {
                console.log('🎯 Player 2 sending input: up');
                player2.emit('input', {
                    matchId,
                    dir: 'up',
                    address: '0x9876543210fedcba9876543210fedcba98765432'
                });
            }, 1500);
        }
    });
    
    player2.on('state_update', (state) => {
        if (state.tick % 10 === 0) { // Log every 10 ticks
            console.log(`📊 Game tick ${state.tick}, P1 score: ${state.players[0].score}, P2 score: ${state.players[1].score}`);
        }
    });
    
    // Handle game end
    player1.on('game_end', (finalState) => {
        console.log('🏁 Game ended (P1 view):', {
            winner: finalState.winner,
            duration: finalState.duration,
            scores: finalState.finalScores
        });
        player1.disconnect();
    });
    
    player2.on('game_end', (finalState) => {
        console.log('🏁 Game ended (P2 view):', {
            winner: finalState.winner,
            duration: finalState.duration,
            scores: finalState.finalScores
        });
        player2.disconnect();
        console.log('✅ Multiplayer test completed successfully!');
        process.exit(0);
    });
    
    // Handle errors
    [player1, player2].forEach((socket, i) => {
        socket.on('error', (error) => {
            console.error(`❌ Player ${i + 1} error:`, error);
        });
        
        socket.on('disconnect', () => {
            console.log(`👋 Player ${i + 1} disconnected`);
        });
    });
    
    // Timeout after 30 seconds
    setTimeout(() => {
        console.log('⏰ Test timeout - cleaning up...');
        player1.disconnect();
        player2.disconnect();
        process.exit(1);
    }, 30000);
}

testMultiplayerGame().catch(console.error);