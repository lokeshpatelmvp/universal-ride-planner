const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0'; // Listen on all network interfaces

app.use(cors());
app.use(express.json());

// Store completed rides
let completedRides = new Set();

// Get last week's wait times (static JSON)
app.get('/api/wait-times/last-week', (req, res) => {
    try {
        // Find the most recent last week data file
        const dataDir = path.join(__dirname, 'data');
        const files = fs.readdirSync(dataDir)
            .filter(file => file.startsWith('last_week_waits_') && file.endsWith('.json'))
            .sort()
            .reverse();
        
        if (files.length === 0) {
            return res.status(404).json({ error: 'No last week data found' });
        }
        
        const latestFile = path.join(dataDir, files[0]);
        const data = JSON.parse(fs.readFileSync(latestFile, 'utf8'));
        
        res.json(data);
    } catch (error) {
        console.error('Error serving last week data:', error);
        res.status(500).json({ error: 'Failed to load last week data' });
    }
});

// Get today's wait times (live from Thrill Data)
app.get('/api/wait-times/today', async (req, res) => {
    try {
        const response = await axios.get('https://www.thrill-data.com/waittimes/epic-universe');
        const $ = cheerio.load(response.data);
        
        const rides = [];
        
        // Parse the wait times table
        $('table tbody tr').each((i, element) => {
            const name = $(element).find('td:first-child').text().trim();
            const waitTimeText = $(element).find('td:nth-child(4)').text().trim();
            const heightReq = $(element).find('td:nth-child(2)').text().trim();
            
            // Handle different wait time formats (numbers, "Weather Delay", "Down", etc.)
            let waitTime = null;
            let status = 'Open';
            
            if (waitTimeText.toLowerCase().includes('weather delay')) {
                status = 'Weather Delay';
            } else if (waitTimeText.toLowerCase().includes('down') || waitTimeText === '') {
                status = 'Down';
            } else {
                const parsed = parseInt(waitTimeText);
                if (!isNaN(parsed)) {
                    waitTime = parsed;
                }
            }
            
            if (name) {
                rides.push({
                    name,
                    waitTime,
                    status,
                    heightReq,
                    completed: completedRides.has(name)
                });
            }
        });

        // Sort by wait time (null values last)
        rides.sort((a, b) => {
            if (a.waitTime === null && b.waitTime === null) return 0;
            if (a.waitTime === null) return 1;
            if (b.waitTime === null) return -1;
            return a.waitTime - b.waitTime;
        });
        
        res.json({
            date: new Date().toISOString().split('T')[0],
            park: "Epic Universe",
            rides: rides
        });
    } catch (error) {
        console.error('Error fetching today\'s wait times:', error);
        res.status(500).json({ error: 'Failed to fetch today\'s wait times' });
    }
});

// Get wait times from Thrill Data (legacy endpoint - keep for compatibility)
app.get('/api/wait-times', async (req, res) => {
    try {
        const response = await axios.get('https://www.thrill-data.com/waittimes/epic-universe');
        const $ = cheerio.load(response.data);
        
        const rides = [];
        
        // Parse the wait times table
        $('table tbody tr').each((i, element) => {
            const name = $(element).find('td:first-child').text().trim();
            const waitTime = parseInt($(element).find('td:nth-child(4)').text().trim()) || 0;
            const heightReq = $(element).find('td:nth-child(2)').text().trim();
            
            if (name && !isNaN(waitTime)) {
                rides.push({
                    name,
                    waitTime,
                    heightReq,
                    completed: completedRides.has(name)
                });
            }
        });

        // Sort by wait time
        rides.sort((a, b) => a.waitTime - b.waitTime);
        
        res.json(rides);
    } catch (error) {
        console.error('Error fetching wait times:', error);
        res.status(500).json({ error: 'Failed to fetch wait times' });
    }
});

// Mark ride as completed
app.post('/api/complete-ride', (req, res) => {
    const { rideName } = req.body;
    if (rideName) {
        completedRides.add(rideName);
        res.json({ success: true, completedRides: Array.from(completedRides) });
    } else {
        res.status(400).json({ error: 'Ride name is required' });
    }
});

// Get completed rides
app.get('/api/completed-rides', (req, res) => {
    res.json(Array.from(completedRides));
});

// Reset completed rides
app.post('/api/reset-rides', (req, res) => {
    completedRides.clear();
    res.json({ success: true });
});

// Serve static files from the dist directory
app.use(express.static('dist'));

app.listen(PORT, HOST, () => {
    console.log(`Server running at http://${HOST}:${PORT}`);
    console.log('To access from your phone, use your computer\'s IP address instead of localhost');
    console.log('Available endpoints:');
    console.log('  GET /api/wait-times/last-week - Last week\'s historical data');
    console.log('  GET /api/wait-times/today - Today\'s live data');
    console.log('  GET /api/wait-times - Legacy endpoint (today\'s data)');
}); 