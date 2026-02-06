// Minimal server test
const express = require('express');
const { createServer } = require('http');

const app = express();
const httpServer = createServer(app);
const PORT = 3005;

app.get("/", (req, res) => {
    res.send("Test Server Running!");
});

httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Test server running on http://localhost:${PORT}`);
}).on('error', (err) => {
    console.error('❌ Server error:', err);
});

console.log('Starting minimal test server...');