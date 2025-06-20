const express = require('express');
const path = require('path');
const app = express();
const PORT = 5000;

// Serve static files from the dist directory
app.use(express.static('dist'));

// For any other route, serve index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Development server running at http://localhost:${PORT}`);
    console.log('Press Ctrl+C to stop the server');
}); 