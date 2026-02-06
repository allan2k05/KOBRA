const { io } = require('socket.io-client');

const SERVER_URL = 'http://localhost:3001';

async function main() {
    console.log('🔵 Starting Verification Script...');

    const p1 = io(SERVER_URL);
    const p2 = io(SERVER_URL);

    // Helper to log with timestamp
    const log = (who, msg) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${who}: ${msg}`);

    let matchId = null;
    let p1Role = '';
    let ticks = 0;

    p1.on('connect', () => log('P1', 'Connected ' + p1.id));
    p2.on('connect', () => log('P2', 'Connected ' + p2.id));

    p1.emit('join_lobby', { address: '0xPlayer1', stake: '1000000' });
    log('P1', 'Joined Lobby ($1)');

    // Delay P2 slightly
    setTimeout(() => {
        p2.emit('join_lobby', { address: '0xPlayer2', stake: '1000000' });
        log('P2', 'Joined Lobby ($1)');
    }, 500);

    // Listen for Match
    const onMatch = (who, data) => {
        log(who, `Match Found! MatchId: ${data.matchId}, Opponent: ${data.opponent}`);
        matchId = data.matchId;

        // P1 sends ready
        // Wait 1s then Ready
        setTimeout(() => {
            if (who === 'P1') { // Only one needs to trigger in current simplified server
                log(who, 'Sending Ready...');
                p1.emit('ready_to_start', { matchId });
            }
        }, 1000);
    };

    p1.on('match_found', (data) => onMatch('P1', data));
    p2.on('match_found', (data) => onMatch('P2', data));

    // Listen for State
    p1.on('state_update', (state) => {
        if (ticks === 0) log('P1', 'Received First State Update! Tick: ' + state.tick);
        ticks++;

        if (ticks === 5) {
            log('P1', 'Disconnecting to test forfeit at Tick 5...');
            p1.disconnect();
        }
    });

    p2.on('game_end', (finalState) => {
        log('P2', 'Game Ended!');
        console.log('Winner:', finalState.winner);
        console.log('Loser:', finalState.loser);

        if (finalState.winner === '0xPlayer2' && finalState.loser === '0xPlayer1') {
            console.log('SUCCESS: Forfeit Verified! P2 won.');
            process.exit(0);
        } else {
            console.log('FAILURE: Unexpected result.');
            process.exit(1);
        }
    });
}

main().catch(console.error);
