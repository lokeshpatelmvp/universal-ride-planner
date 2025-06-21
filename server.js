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
        
        // Find the closest available historical data file
        const historicalFiles = fs.readdirSync(dataDir)
            .filter(file => file.startsWith('last_week_waits_') && file.endsWith('.json'))
            .map(file => {
                const dateMatch = file.match(/last_week_waits_(\d{4}-\d{2}-\d{2})\.json/);
                return dateMatch ? { file, date: dateMatch[1] } : null;
            })
            .filter(item => item !== null)
            .sort((a, b) => {
                const dateA = new Date(a.date);
                const dateB = new Date(b.date);
                const targetDate = new Date(lastWeekStr);
                return Math.abs(dateA - targetDate) - Math.abs(dateB - targetDate);
            });
        
        if (historicalFiles.length === 0) {
            return res.status(404).json({ error: `No historical data files found` });
        }
        
        const closestFile = historicalFiles[0];
        const filePath = path.join(dataDir, closestFile.file);
        console.log(`Using last week data file: ${filePath} (date: ${closestFile.date}, requested: ${lastWeekStr})`);
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

// Get weather data
app.get('/api/weather', async (req, res) => {
    const apiKey = process.env.WEATHER_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'Weather API key is not configured.' });
    }

    // Coordinates for Universal's Epic Universe
    const lat = 28.4739;
    const lon = -81.4688;
    const url = `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&exclude=minutely,daily,alerts&units=imperial&appid=${apiKey}`;

    try {
        const response = await axios.get(url);
        const weatherData = response.data;

        // Transform data to match the structure expected by the frontend
        const transformedData = {
            current: {
                temperature: Math.round(weatherData.current.temp),
                feelsLike: Math.round(weatherData.current.feels_like),
                condition: weatherData.current.weather[0].main,
                icon: weatherData.current.weather[0].icon
            },
            hourly: weatherData.hourly.slice(0, 24).map(hour => ({
                hour: new Date(hour.dt * 1000).getHours(),
                temperature: Math.round(hour.temp),
                feelsLike: Math.round(hour.feels_like),
                precipitation: Math.round(hour.pop * 100), // Probability of precipitation
                condition: hour.weather[0].main,
                icon: hour.weather[0].icon,
            })),
        };
        
        res.json(transformedData);
    } catch (error) {
        console.error('Error fetching weather data:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Failed to fetch weather data.' });
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

// Trigger data update and return fresh data (Node.js version - no Python required)
app.post('/api/refresh-data', async (req, res) => {
    try {
        console.log('🔄 Triggering data refresh (Node.js version)...');
        
        // Master list of rides and their lands at Epic Universe
        // Note: Using the truncated names from the Thrill Data API
        const rideLandMap = {
            "Stardust Racers": "Celestial Park",
            "Constellation Carousel": "Celestial Park",
            "Curse of the Werewolf": "Dark Universe",
            "Darkmoor Monster Makeup Experience": "Dark Universe",
            "Monsters Unch...Experiment": "Dark Universe",
            "Hiccup's Wing Gliders": "Isle of Berk",
            "Dragon Racer's Rally": "Isle of Berk",
            "Fyre Drill": "Isle of Berk",
            "The Untrainable Dragon": "Isle of Berk",
            "Meet Toothles...nd Friends": "Isle of Berk",
            "Mario Kart: B... Challenge": "SUPER NINTENDO WORLD",
            "Yoshi's Adventure": "SUPER NINTENDO WORLD",
            "Mine-Cart Madness": "SUPER NINTENDO WORLD",
            "Bowser Jr. Challenge": "SUPER NINTENDO WORLD",
            "Harry Potter ...e Ministry": "The Wizarding World of Harry Potter",

        };
        
        // Use Node.js to fetch data instead of Python
        const axios = require('axios');
        const cheerio = require('cheerio');
        const fs = require('fs');
        const path = require('path');
        
        // Get current date in Eastern Time
        const now = new Date();
        const etOffset = -5; // Eastern Time is UTC-5 (or UTC-4 during DST)
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        const today = new Date(utc + (etOffset * 3600000));
        const todayStr = today.toISOString().split('T')[0];
        
        console.log(`Fetching heatmap data for date: ${todayStr}`);
        
        // Fetch the heatmap data (this gives us the full day's historical data)
        const heatMapResponse = await axios.get('https://www.thrill-data.com/waits/graph/quick/parkheat', {
            params: {
                id: 243,  // Epic Universe park ID
                dateStart: todayStr,
                tag: 'min'
            },
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        
        // Extract the Plotly.newPlot data array
        const plotData = heatMapResponse.data.plot1;
        const dataArrayMatch = plotData.match(/Plotly\.newPlot\([^,]+,\s*(\[.*?\]),\s*\{/s);
        
        if (!dataArrayMatch) {
            throw new Error('Could not extract Plotly data array');
        }
        
        // Parse the data array
        let dataArr;
        try {
            dataArr = eval(dataArrayMatch[1]);
        } catch (e) {
            throw new Error('Failed to parse Plotly data array: ' + e.message);
        }
        
        const data = dataArr[0];
        const z = data.z; // Wait times matrix
        const y = data.y; // Ride names
        const x = data.x; // Time labels
        
        console.log(`Extracted data: ${y.length} rides, ${x.length} time points`);
        
        // Process the data into the same format as the Python script
        const rides = [];
        
        for (let i = 0; i < y.length; i++) {
            const rideName = y[i];
            const waitTimes = z[i] || [];
            
            // Look up the land for the current ride, default to 'Unknown'
            const land = rideLandMap[rideName] || 'Unknown';

            // Convert wait times to the expected format
            const formattedWaitTimes = [];
            for (let j = 0; j < x.length; j++) {
                const timeLabel = x[j];
                const waitTime = waitTimes[j];
                
                // Skip "Average" time point
                if (timeLabel === "Average") continue;
                
                formattedWaitTimes.push({
                    time: timeLabel,
                    wait: waitTime === '' || waitTime === null ? null : parseInt(waitTime)
                });
            }
            
            // Get current wait time (latest non-null value)
            let currentWait = null;
            for (let k = formattedWaitTimes.length - 1; k >= 0; k--) {
                if (formattedWaitTimes[k].wait !== null) {
                    currentWait = formattedWaitTimes[k].wait;
                    break;
                }
            }
            
            rides.push({
                name: rideName,
                waitTime: currentWait,
                status: currentWait !== null ? "Open" : "Down",
                wait_times: formattedWaitTimes,
                land: land
            });
        }
        
        // Create the data structure
        const todayData = {
            date: todayStr,
            park: "Epic Universe",
            rides: rides
        };
        
        // Ensure data directory exists
        const dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        // Save to file
        const outputFile = path.join(dataDir, `today_waits_${todayStr}.json`);
        fs.writeFileSync(outputFile, JSON.stringify(todayData, null, 2));
        
        console.log(`✅ Data refresh completed successfully. Saved ${rides.length} rides to ${outputFile}`);
        
        res.json({ 
            success: true, 
            message: 'Data refreshed successfully (Node.js version)',
            data: todayData,
            ridesCount: rides.length
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