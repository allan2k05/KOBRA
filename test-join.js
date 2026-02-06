const { io } = require('socket.io-client');
const addr = process.argv[2] || `0x${Math.random().toString(16).slice(2, 42).padEnd(40, '0')}`;
const stake = process.argv[3] || '1000000';
const mode = process.argv[4] || 'multiplayer'; // 'bot' or 'multiplayer'
console.log('Starting test join:', addr, stake, mode);
const socket = io('http://localhost:3005', { transports: ['websocket', 'polling'] });

socket.on('connect', () => {
  console.log('[test-join] connected', socket.id);
  socket.emit('join_lobby', { address: addr, stake, mode });
});

socket.on('match_found', (data) => {
  console.log('[test-join] match_found', data);
  setTimeout(() => { socket.disconnect(); process.exit(0); }, 1000);
});

socket.on('connect_error', (err) => {
  console.error('[test-join] connect_error', err.message || err);
  process.exit(1);
});

setTimeout(() => { console.log('[test-join] timeout'); process.exit(1); }, 30000);
