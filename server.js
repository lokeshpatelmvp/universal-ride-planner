const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
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
        const dataDir = path.join(__dirname, 'data');
        // Allow ?today=YYYY-MM-DD for testing or mobile use
        let todayStr = req.query.today;
        let today;
        if (todayStr && /^\d{4}-\d{2}-\d{2}$/.test(todayStr)) {
            today = new Date(todayStr);
        } else {
            // Use Eastern Time for theme park operations
            const now = new Date();
            const etOffset = -5; // Eastern Time is UTC-5 (or UTC-4 during DST)
            const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
            today = new Date(utc + (etOffset * 3600000));
            todayStr = today.toISOString().split('T')[0];
        }
        const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        const lastWeekStr = lastWeek.toISOString().split('T')[0];
        const filename = `last_week_waits_${lastWeekStr}.json`;
        const filePath = path.join(dataDir, filename);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: `No last week data found for ${lastWeekStr}` });
        }
        console.log(`Using last week data file: ${filePath} (date: ${lastWeekStr})`);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        res.json(data);
    } catch (error) {
        console.error('Error serving last week data:', error);
        res.status(500).json({ error: 'Failed to load last week data' });
    }
});

// Get today's wait times (from extracted JSON file)
app.get('/api/wait-times/today', (req, res) => {
    try {
        // Find the most recent today data file
        const dataDir = path.join(__dirname, 'data');
        const today = new Date().toISOString().split('T')[0];
        console.log(`Looking for today's data files in: ${dataDir}`);
        
        const files = fs.readdirSync(dataDir)
            .filter(file => file.startsWith('today_waits_') && file.endsWith('.json'))
            .sort()
            .reverse();
        
        console.log(`Found today files: ${files.join(', ')}`);
        
        if (files.length === 0) {
            console.log('No today data files found');
            return res.status(404).json({ error: 'No today data found' });
        }
        
        // Use the latest file (should be for today)
        const latestFile = path.join(dataDir, files[0]);
        console.log(`Reading file: ${latestFile}`);
        
        const fileContent = fs.readFileSync(latestFile, 'utf8');
        console.log(`File size: ${fileContent.length} characters`);
        console.log(`File preview: ${fileContent.substring(0, 200)}...`);
        
        const data = JSON.parse(fileContent);
        console.log(`Successfully parsed JSON with ${data.rides ? data.rides.length : 0} rides`);
        res.json(data);
    } catch (error) {
        console.error('Error serving today data:', error);
        console.error('Error details:', error.message);
        res.status(500).json({ error: 'Failed to load today data' });
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

// Trigger data update and return fresh data
app.post('/api/refresh-data', async (req, res) => {
    try {
        console.log('🔄 Triggering data refresh...');
        
        // Run the Python script
        const pythonProcess = spawn('python', ['extract_today_data.py'], {
            cwd: __dirname,
            stdio: 'pipe'
        });
        
        let output = '';
        let errorOutput = '';
        
        pythonProcess.stdout.on('data', (data) => {
            output += data.toString();
            console.log('Python output:', data.toString());
        });
        
        pythonProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
            console.error('Python error:', data.toString());
        });
        
        // Wait for the Python script to complete
        await new Promise((resolve, reject) => {
            pythonProcess.on('close', (code) => {
                if (code !== 0) {
                    console.error('Python script failed with code:', code);
                    console.error('Error output:', errorOutput);
                    reject(new Error(`Python script failed: ${errorOutput}`));
                } else {
                    console.log('✅ Data refresh completed successfully');
                    resolve();
                }
            });
            
            pythonProcess.on('error', (error) => {
                console.error('Failed to start Python script:', error);
                reject(error);
            });
        });
        
        // Now return the fresh data
        const dataDir = path.join(__dirname, 'data');
        const files = fs.readdirSync(dataDir)
            .filter(file => file.startsWith('today_waits_') && file.endsWith('.json'))
            .sort()
            .reverse();
        
        if (files.length === 0) {
            return res.status(404).json({ error: 'No today data found after refresh' });
        }
        
        const latestFile = path.join(dataDir, files[0]);
        const data = JSON.parse(fs.readFileSync(latestFile, 'utf8'));
        
        res.json({ 
            success: true, 
            message: 'Data refreshed successfully',
            data: data,
            output: output
        });
        
    } catch (error) {
        console.error('Error triggering data refresh:', error);
        res.status(500).json({ error: `Failed to trigger data refresh: ${error.message}` });
    }
});

// Get historical data from 7 days ago and save it
app.post('/api/get-historical-data', async (req, res) => {
    try {
        console.log('📅 Fetching historical data from 7 days ago...');
        
        // Calculate the date 7 days ago in Eastern Time
        const now = new Date();
        const etOffset = -5; // Eastern Time is UTC-5 (or UTC-4 during DST)
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        const today = new Date(utc + (etOffset * 3600000));
        const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];
        
        console.log(`Fetching data for date: ${sevenDaysAgoStr}`);
        
        // Run the Python script with the historical date
        const pythonProcess = spawn('python', ['extract_today_data.py', sevenDaysAgoStr], {
            cwd: __dirname,
            stdio: 'pipe'
        });
        
        let output = '';
        let errorOutput = '';
        
        pythonProcess.stdout.on('data', (data) => {
            output += data.toString();
            console.log('Python output:', data.toString());
        });
        
        pythonProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
            console.error('Python error:', data.toString());
        });
        
        // Wait for the Python script to complete
        await new Promise((resolve, reject) => {
            pythonProcess.on('close', (code) => {
                if (code !== 0) {
                    console.error('Python script failed with code:', code);
                    console.error('Error output:', errorOutput);
                    reject(new Error(`Python script failed: ${errorOutput}`));
                } else {
                    console.log('✅ Historical data fetch completed successfully');
                    resolve();
                }
            });
            
            pythonProcess.on('error', (error) => {
                console.error('Failed to start Python script:', error);
                reject(error);
            });
        });
        
        // Check if the historical file was created
        const dataDir = path.join(__dirname, 'data');
        const historicalFilename = `last_week_waits_${sevenDaysAgoStr}.json`;
        const historicalFilePath = path.join(dataDir, historicalFilename);
        
        if (!fs.existsSync(historicalFilePath)) {
            return res.status(404).json({ 
                error: `Historical data file not found: ${historicalFilename}`,
                output: output 
            });
        }
        
        const data = JSON.parse(fs.readFileSync(historicalFilePath, 'utf8'));
        
        res.json({ 
            success: true, 
            message: `Historical data for ${sevenDaysAgoStr} fetched and saved successfully`,
            date: sevenDaysAgoStr,
            data: data,
            output: output
        });
        
    } catch (error) {
        console.error('Error fetching historical data:', error);
        res.status(500).json({ error: `Failed to fetch historical data: ${error.message}` });
    }
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