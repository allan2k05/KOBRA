// Simple connection test
const { io } = require('socket.io-client');

console.log('🔌 Testing server connection...');

const socket = io('http://localhost:3005');

socket.on('connect', () => {
    console.log('✅ Connected to server successfully!', socket.id);
    console.log('🎮 Joining lobby...');
    
    socket.emit('join_lobby', {
        address: '0x1234567890abcdef1234567890abcdef12345678',
        stake: '1000000'
    });
    
    setTimeout(() => {
        console.log('✅ Basic connection test passed!');
        socket.disconnect();
        process.exit(0);
    }, 2000);
});

socket.on('connect_error', (error) => {
    console.error('❌ Connection error:', error);
    process.exit(1);
});

socket.on('match_found', (data) => {
    console.log('🎯 Match found event received:', data);
});

setTimeout(() => {
    console.log('⏰ Test timeout');
    process.exit(1);
}, 10000);