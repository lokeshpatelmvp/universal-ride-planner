const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0'; // Listen on all network interfaces

app.use(cors());
app.use(express.json());

// Store completed rides
let completedRides = new Set();

// Get wait times from Thrill Data
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
}); 