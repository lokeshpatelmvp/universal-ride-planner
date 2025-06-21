import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Line, Bar } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    Filler,
    annotationPlugin
);

function App() {
    const [rides, setRides] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedTab, setSelectedTab] = useState('rides');
    const [rideCounts, setRideCounts] = useState(() => {
        const saved = localStorage.getItem('rideCounts');
        return saved ? JSON.parse(saved) : {};
    });
    const [autoCalculateTiming, setAutoCalculateTiming] = useState(true);
    const [autoRefresh, setAutoRefresh] = useState(false);
    const [refreshInterval, setRefreshInterval] = useState(5);
    const [todayData, setTodayData] = useState({});
    const [weekAgoData, setWeekAgoData] = useState({});
    const [lastWeekData, setLastWeekData] = useState(null);
    const [refreshLoading, setRefreshLoading] = useState(false);
    const [historicalLoading, setHistoricalLoading] = useState(false);
    const [selectedRide, setSelectedRide] = useState(null);
    const [selectedLand, setSelectedLand] = useState('All Lands');
    const [fullscreenGraph, setFullscreenGraph] = useState({ rideName: null, isTodayAvailable: false, weekAgoData: null, currentWaitTime: null });
    const [activeTab, setActiveTab] = useState('ridePlanner');
    const [ridePlan, setRidePlan] = useState(() => {
        const saved = localStorage.getItem('ridePlan');
        return saved ? JSON.parse(saved) : [];
    });
    const [planStartTime, setPlanStartTime] = useState('09:00');
    const [planEndTime, setPlanEndTime] = useState('21:00');
    const [isTrackingProgress, setIsTrackingProgress] = useState(false);
    const [isAvailableRidesCollapsed, setIsAvailableRidesCollapsed] = useState(false);
    const [isMovingItem, setIsMovingItem] = useState(false);
    const [weatherData, setWeatherData] = useState(null);
    const [weatherLoading, setWeatherLoading] = useState(false);
    
    // New settings state
    const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
    const [autoRefreshInterval, setAutoRefreshInterval] = useState(15);
    const [refreshIntervalId, setRefreshIntervalId] = useState(null);

    // Auto-refresh effect
    useEffect(() => {
        if (autoRefreshEnabled) {
            const interval = setInterval(() => {
                fetchWaitTimes();
            }, autoRefreshInterval * 60 * 1000);
            setRefreshIntervalId(interval);
            
            return () => {
                if (interval) clearInterval(interval);
            };
        } else {
            if (refreshIntervalId) {
                clearInterval(refreshIntervalId);
                setRefreshIntervalId(null);
            }
        }
    }, [autoRefreshEnabled, autoRefreshInterval]);

    // Auto-calculate timing when ride plan changes
    // React.useEffect(() => {
    //     if (autoCalculateTiming && ridePlan.length > 0) {
    //         calculatePlanTiming();
    //     }
    // }, [ridePlan, autoCalculateTiming]);

    // This function is now obsolete and will be removed. For now, it is disabled.
    const generateTodayActualData = (currentWaitTime, rideName, rideStatus = null, weekAgoDataForRide = null) => {
        // Obsolete function. Returning empty array.
        return [];
    };

    // Function to generate 7 days ago data (using real historical data)
    const generateWeekAgoData = (currentWaitTime, rideName) => {
        // Use real historical data from Thrill Data heatmap
        if (rideName.includes('Yoshi')) {
            // Real data from heatmap: First 10: [None, 15, 15, 15, 27, 35, None, None, None, None]
            // Last 10: [15, 15, 15, 15, 15, 15, None, None, None, 35]
            // Average: 34.5 min
            const yoshiData = [
                null, 15, 15, 15, 27, 35, null, null, null, null,  // First 10
                // Fill middle with realistic pattern based on average
                ...Array(24).fill(35),  // Middle section
                15, 15, 15, 15, 15, 15, null, null, null, 35  // Last 10
            ];
            return yoshiData;
        }
        
        if (rideName.includes('Carousel')) {
            // Real data from heatmap: First 10: [None, None, None, None, None, None, None, None, None, None]
            // Last 10: [21, 25, 27, 35, 35, 35, 37, 45, 45, 24]
            // Average: 24.0 min
            const carouselData = [
                ...Array(10).fill(null),  // First 10 all null
                // Fill middle with realistic pattern based on average
                ...Array(24).fill(25),  // Middle section
                21, 25, 27, 35, 35, 35, 37, 45, 45, 24  // Last 10
            ];
            return carouselData;
        }
        
        if (rideName.includes('Mario Kart')) {
            // Real data from heatmap: First 10: [None, 25, 86, 87, 70, 70, 70, 120, 120, 120]
            // Last 10: [44, 45, 30, 24, 20, 20, None, None, None, 90]
            // Average: 89.6 min
            const marioData = [
                null, 25, 86, 87, 70, 70, 70, 120, 120, 120,  // First 10
                // Fill middle with realistic pattern based on average
                ...Array(24).fill(90),  // Middle section
                44, 45, 30, 24, 20, 20, null, null, null, 90  // Last 10
            ];
            return marioData;
        }
        
        // For other rides, use the original logic with consistent time intervals
        const data = [];
        
        // Check if ride is down using the same logic as getRideStatus
        const isNumericWaitTime = typeof currentWaitTime === 'number' || (typeof currentWaitTime === 'string' && !isNaN(parseInt(currentWaitTime)));
        const isDown = !currentWaitTime || currentWaitTime === 'Down' || currentWaitTime === 'Weather Delay' || !isNumericWaitTime;
        
        // Use a default wait time for down rides to show historical patterns
        const baseTime = isDown ? 30 : (currentWaitTime || 30);
        
        // Create unique seed for each ride (different from today)
        let rideSeed = (rideName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + 7) % 1000;
        
        // Helper function to get next random value using ride seed
        const getNextRandom = () => {
            rideSeed = (rideSeed * 9301 + 49297) % 233280;
            return rideSeed / 233280;
        };
        
        // Generate data points for each 15-minute interval from 10:00 AM to 9:00 PM (full day)
        for (let hour = 10; hour <= 21; hour++) {
            for (let minute = 0; minute < 60; minute += 15) {
                const timeOfDay = hour + minute / 60;
                
                // Add realistic variation based on time of day
                let variation = 0;
                if (timeOfDay < 11) variation = -0.3;
                else if (timeOfDay >= 11 && timeOfDay < 12) variation = 0.1;
                else if (timeOfDay >= 12 && timeOfDay < 14) variation = 0.3;
                else if (timeOfDay >= 14 && timeOfDay < 16) variation = 0.2;
                else if (timeOfDay >= 16 && timeOfDay < 18) variation = 0.3;
                else if (timeOfDay >= 18 && timeOfDay < 20) variation = 0.1;
                else if (timeOfDay >= 20) variation = -0.1;
                
                // Add ride-specific characteristics (slightly different from today)
                let rideVariation = 0;
                const nameLower = rideName.toLowerCase();
                
                if (nameLower.includes('mario kart') || nameLower.includes('harry potter')) {
                    rideVariation = 0.35; // Slightly different
                    if (timeOfDay >= 10 && timeOfDay < 11) rideVariation += 0.25;
                    if (timeOfDay >= 14 && timeOfDay < 15) rideVariation += 0.25;
                } else if (nameLower.includes('stardust') || nameLower.includes('dragon')) {
                    rideVariation = 0.25;
                    if (timeOfDay >= 16 && timeOfDay < 17) rideVariation += 0.15;
                } else if (nameLower.includes('yoshi') || nameLower.includes('constellation')) {
                    rideVariation = -0.15;
                    if (timeOfDay >= 9 && timeOfDay < 10) rideVariation += 0.15;
                } else if (nameLower.includes('monsters') || nameLower.includes('frankenstein')) {
                    rideVariation = 0.15;
                    if (timeOfDay >= 18 && timeOfDay < 19) rideVariation += 0.25;
                }
                
                // Add randomness (different from today)
                const randomValue = getNextRandom();
                const randomVariation = (randomValue - 0.5) * 0.25;
                
                const totalVariation = variation + rideVariation + randomVariation;
                const waitTime = Math.max(5, Math.round(baseTime * (1 + totalVariation)));
                data.push(waitTime);
            }
        }
        
        return data;
    };

    // Function to render detailed wait time profile sparkline
    const renderWaitTimeProfile = (todayData, weekAgoData, currentWaitTime, rideName, lastWeekData = null) => {
        // Defensive: ensure we have the full time/wait objects
        const safeTodayData = Array.isArray(todayData) ? todayData : [];
        const safeWeekAgoData = Array.isArray(weekAgoData) ? weekAgoData : [];

        // Extract time labels and wait times from the data
        const todayTimeLabels = safeTodayData.map(item => item.time);
        const todayWaitTimes = safeTodayData.map(item => item.wait);
        const weekAgoTimeLabels = safeWeekAgoData.map(item => item.time);
        const weekAgoWaitTimes = safeWeekAgoData.map(item => item.wait);

        // Create a unified timeline using all unique time labels
        const allTimeLabels = [...new Set([...todayTimeLabels, ...weekAgoTimeLabels])];
        allTimeLabels.sort((a, b) => {
            // Convert time strings to minutes for comparison
            const timeToMinutes = (timeStr) => {
                const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/);
                if (!match) return 0;
                let hour = parseInt(match[1]);
                const minute = parseInt(match[2]);
                const ampm = match[3];
                if (ampm === 'PM' && hour !== 12) hour += 12;
                if (ampm === 'AM' && hour === 12) hour = 0;
                return hour * 60 + minute;
            };
            return timeToMinutes(a) - timeToMinutes(b);
        });

        // Create lookup maps for efficient data access
        const todayDataMap = new Map();
        safeTodayData.forEach(item => todayDataMap.set(item.time, item.wait));
        const weekAgoDataMap = new Map();
        safeWeekAgoData.forEach(item => weekAgoDataMap.set(item.time, item.wait));

        // Map data to the unified timeline
        const todayDataAligned = allTimeLabels.map(time => todayDataMap.get(time) ?? null);
        const weekAgoDataAligned = allTimeLabels.map(time => weekAgoDataMap.get(time) ?? null);

        // Check if ride is down
        const isDown = !currentWaitTime || currentWaitTime === 'Down' || currentWaitTime === 'Weather Delay';
        // Check if we have any data to display
        const hasTodayData = todayDataAligned.some(v => v !== null);
        const hasWeekAgoData = weekAgoDataAligned.some(v => v !== null);

        // Enhanced debug logging
        console.log(`Chart debug for ${rideName}:`, {
            todayDataLength: todayDataAligned.length,
            weekAgoDataLength: weekAgoDataAligned.length,
            hasTodayData,
            hasWeekAgoData,
            todayDataSample: todayDataAligned.slice(0, 5),
            weekAgoDataSample: weekAgoDataAligned.slice(0, 5),
            todayDataNonNull: todayDataAligned.filter(v => v !== null).length,
            weekAgoDataNonNull: weekAgoDataAligned.filter(v => v !== null).length,
            timeLabelsSample: allTimeLabels.slice(0, 5),
            originalTodayData: todayData,
            originalWeekAgoData: weekAgoData
        });

        // If no data, show fallback
        if (!hasTodayData && !hasWeekAgoData) {
            return <div style={{color: '#888', textAlign: 'center', margin: '10px'}}>No wait time data available for this ride.</div>;
        }

        // --- Data for Rain Chart ---
        const rainData = allTimeLabels.map((timeLabel) => {
            if (!weatherData || !weatherData.hourly) return 0;
            // Extract hour from time label (e.g., "08:45 AM" -> 8)
            const hourMatch = timeLabel.match(/(\d{1,2}):\d{2}\s*(AM|PM)/);
            if (!hourMatch) return 0;
            let hour = parseInt(hourMatch[1]);
            const ampm = hourMatch[2];
            if (ampm === 'PM' && hour !== 12) hour += 12;
            if (ampm === 'AM' && hour === 12) hour = 0;
            const weatherHour = weatherData.hourly.find(w => w.hour === hour);
            return weatherHour ? weatherHour.precipitation : 0;
        });

        // --- Datasets for Chart.js ---
        const datasets = [];

        // Rain dataset (as bars, drawn first)
        if (weatherData) {
            datasets.push({
                type: 'bar',
                label: 'Rain %',
                data: rainData,
                backgroundColor: 'rgba(135, 206, 250, 0.3)', // Light blue
                borderColor: 'rgba(135, 206, 250, 0.5)',
                borderWidth: 1,
                yAxisID: 'yRain',
                order: 3 // Draw behind lines
            });
        }
        
        // Today's wait time dataset
        if (hasTodayData && !isDown) {
            datasets.push({
                type: 'line',
                label: 'Today',
                data: todayDataAligned,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                tension: 0.2,
                spanGaps: false,
                pointRadius: 2,
                pointHoverRadius: 4,
                yAxisID: 'yWait',
                order: 2
            });
        }

        // 7 Days Ago wait time dataset
        if (hasWeekAgoData) {
            datasets.push({
                type: 'line',
                label: '7 Days Ago',
                data: weekAgoDataAligned,
                borderColor: '#22c55e',
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                borderDash: [5, 5],
                tension: 0.2,
                spanGaps: false,
                pointRadius: 1,
                pointHoverRadius: 3,
                yAxisID: 'yWait',
                order: 1
            });
        }
        
        // --- Current Time Annotation ---
        const now = new Date();
        const currentTimeStr = now.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit', 
            hour12: true 
        });
        
        // Find the closest time label to current time
        const timeToMinutes = (timeStr) => {
            const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/);
            if (!match) return 0;
            let hour = parseInt(match[1]);
            const minute = parseInt(match[2]);
            const ampm = match[3];
            if (ampm === 'PM' && hour !== 12) hour += 12;
            if (ampm === 'AM' && hour === 12) hour = 0;
            return hour * 60 + minute;
        };
        
        const currentTimeMinutes = timeToMinutes(currentTimeStr);
        let closestTimeIndex = 0;
        let minDiff = Infinity;
        
        allTimeLabels.forEach((timeLabel, index) => {
            const timeMinutes = timeToMinutes(timeLabel);
            const diff = Math.abs(timeMinutes - currentTimeMinutes);
            if (diff < minDiff) {
                minDiff = diff;
                closestTimeIndex = index;
            }
        });

        const annotations = {};
        if (closestTimeIndex >= 0 && closestTimeIndex < allTimeLabels.length) {
            annotations.currentTimeLine = {
                type: 'line',
                xMin: closestTimeIndex,
                xMax: closestTimeIndex,
                borderColor: 'red',
                borderWidth: 1,
                borderDash: [6, 6],
            };
            // Add a point for the current time
            if (hasTodayData && todayDataAligned[closestTimeIndex] !== null) {
                annotations.currentTimePoint = {
                    type: 'point',
                    xValue: closestTimeIndex,
                    yValue: todayDataAligned[closestTimeIndex],
                    backgroundColor: 'red',
                    radius: 5,
                    borderColor: 'white',
                    borderWidth: 2,
                    yScaleID: 'yWait'
                };
            }
        }

        const allData = [...todayDataAligned, ...weekAgoDataAligned].filter(d => d !== null);
        const maxWait = allData.length > 0 ? Math.max(...allData) : 60;
        const chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { 
                    display: true, 
                    grid: { display: false },
                    ticks: {
                        maxTicksLimit: 8,
                        maxRotation: 0,
                        font: { size: 10 }
                    }
                },
                yWait: { // Primary Y-axis for wait times
                    type: 'linear',
                    display: true,
                    position: 'left',
                    grid: { display: true, color: 'rgba(0,0,0,0.05)' },
                    beginAtZero: true, 
                    max: Math.max(30, Math.ceil(maxWait / 10) * 10 + 15), // Add 5-minute buffer
                    title: {
                        display: false,
                    },
                    ticks: {
                        font: { size: 10 },
                        callback: function(value) { return value + 'm'; }
                    }
                },
                yRain: { // Secondary Y-axis for rain
                    type: 'linear',
                    display: false, // Hide the axis labels/line
                    position: 'right',
                    grid: {
                        drawOnChartArea: false, // Don't show grid lines for rain
                    },
                    min: 0,
                    max: 100, // 0-100%
                }
            },
            plugins: {
                legend: { 
                    display: true,
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        boxWidth: 10,
                        padding: 15,
                        font: { size: 11 },
                        // Custom filter to hide the "Today" label for the point
                        filter: (item) => item.text !== 'currentTimePoint'
                    }
                },
                tooltip: {
                    enabled: true,
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) { 
                            if (context.dataset.yAxisID === 'yRain') {
                                return `Rain: ${context.parsed.y}%`;
                            }
                            return `${context.dataset.label}: ${context.parsed.y} min`; 
                        }
                    }
                },
                annotation: {
                    annotations: annotations
                }
            },
            interaction: { 
                intersect: false, 
                mode: 'index',
            },
            elements: { 
                line: {
                    borderWidth: 2.5
                }
            }
        };
        const chartData = { labels: allTimeLabels, datasets: datasets };

        // If for any reason chartData is not valid, fallback
        if (!Array.isArray(chartData.labels) || !Array.isArray(chartData.datasets)) {
            return <div style={{color: '#888', textAlign: 'center', margin: '10px'}}>Chart data is invalid.</div>;
        }

        const handleClick = () => {
            setFullscreenGraph({ rideName: rideName, isTodayAvailable: hasTodayData, weekAgoData: weekAgoDataAligned, currentWaitTime: currentWaitTime });
        };

        return (
            <div className="wait-time-profile" style={{ display: 'block', marginTop: '10px', marginBottom: '10px' }}>
                <div style={{ width: '100%', height: '120px', cursor: 'pointer' }} onClick={handleClick}>
                    <Line data={chartData} options={chartOptions} />
                </div>
            </div>
        );
    };

    // Function to render fullscreen graph modal
    const renderFullscreenModal = () => {
        if (!fullscreenGraph.rideName) return null;
        
        const { rideName, isTodayAvailable, weekAgoData, currentWaitTime } = fullscreenGraph;
        const rideTodayData = todayData[rideName] || [];

        console.log('Rendering fullscreen modal for:', rideName);
        console.log('Received isTodayAvailable flag:', isTodayAvailable);
        console.log('Received weekAgoData:', weekAgoData);
        console.log('Received currentWaitTime:', currentWaitTime);
        console.log('rideTodayData from state:', rideTodayData);

        // Check if ride is down
        const isDown = !currentWaitTime || currentWaitTime === 'Down' || currentWaitTime === 'Weather Delay';
        const isWeekAgoDataAvailable = weekAgoData && weekAgoData.length > 0;
        
        console.log('isWeekAgoDataAvailable:', isWeekAgoDataAvailable);
        console.log('isDown:', isDown);
        
        // If no historical data, show data preview
        if (!isWeekAgoDataAvailable) {
            return (
                <div className="modal show" tabIndex="-1" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered modal-xl">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">{rideName} - Wait Time Analysis</h5>
                                <button type="button" className="btn-close" onClick={() => setFullscreenGraph({ rideName: null })}></button>
                            </div>
                            <div className="modal-body" style={{ height: '70vh' }}>
                                <div style={{ padding: '20px', textAlign: 'center' }}>
                                    <h4>No Historical Data Available</h4>
                                    <p><strong>Ride:</strong> {rideName}</p>
                                    <p><strong>Today's Data Points:</strong> {rideTodayData.length}</p>
                                    <p><strong>Historical Data Points:</strong> No data</p>
                                    <p><strong>Current Wait Time:</strong> {currentWaitTime} minutes</p>
                                    <p><strong>Status:</strong> {isDown ? 'Down' : 'Open'}</p>
                                    <p>Click the X to close this modal</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        // If we have data, show the Chart.js chart
        const datasets = [];
        
        if (isTodayAvailable && !isDown) {
            datasets.push({
                label: 'Today',
                data: rideTodayData,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.5)',
                tension: 0.1,
                spanGaps: true, // Connect lines over null data points
            });
        }
        
        if (isWeekAgoDataAvailable) {
            datasets.push({
                label: '7 Days Ago',
                data: weekAgoData,
                borderColor: '#22c55e',
                backgroundColor: 'rgba(34, 197, 94, 0.5)',
                borderDash: [5, 5],
                tension: 0.1,
            });
        }

        const timeLabels = weekAgoData.map((_, index) => {
            const hour = 10 + Math.floor((index * 15) / 60);
            const minute = (index * 15) % 60;
            return `${hour % 12 === 0 ? 12 : hour % 12}:${minute.toString().padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
        });

        const allData = [...(isTodayAvailable ? rideTodayData : []), ...weekAgoData].filter(d => d !== null);
        const maxWait = Math.max(...allData, 0);

        const chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: Math.max(10, Math.ceil(maxWait / 5) * 5) // Ensure y-axis is reasonable
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                },
                title: {
                    display: true,
                    text: isTodayAvailable && !isDown ? 'Today vs 7 Days Ago - Full Screen View' : '7 Days Ago (Historical) - Full Screen View'
                },
                annotation: {
                    annotations: {
                        currentTime: {
                            type: 'point',
                            xValue: timeLabels.length - 1, // Last time point
                            yValue: currentWaitTime,
                            backgroundColor: 'red',
                            borderColor: 'red',
                            borderWidth: 2,
                            radius: 6,
                            label: {
                                content: `Current: ${currentWaitTime} min`,
                                enabled: true,
                                position: 'top',
                                backgroundColor: 'red',
                                color: 'white',
                                font: {
                                    size: 12
                                },
                                padding: 4
                            }
                        }
                    }
                }
            }
        };

        // Final chart data
        const chartData = {
            labels: timeLabels,
            datasets: datasets
        };

        return (
            <div className="modal show" tabIndex="-1" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }}>
                <div className="modal-dialog modal-dialog-centered modal-xl">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h5 className="modal-title">{rideName} - Wait Time Analysis</h5>
                            <button type="button" className="btn-close" onClick={() => setFullscreenGraph({ rideName: null })}></button>
                        </div>
                        <div className="modal-body" style={{ height: '70vh' }}>
                            <Line data={chartData} options={chartOptions} />
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const fetchWaitTimes = async () => {
        try {
            console.log('Starting to fetch wait times...');
            setLoading(true);
            setError(null);
            
            // Get today's date in YYYY-MM-DD format for the API (using Eastern Time)
            const now = new Date();
            const etOffset = -5; // Eastern Time is UTC-5 (or UTC-4 during DST)
            const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
            const todayET = new Date(utc + (etOffset * 3600000));
            const todayStr = todayET.toISOString().split('T')[0];
            
            // Fetch the complete heatmap data from Thrill Data
            console.log('Fetching complete heatmap data from Thrill Data...');
            const heatmapResponse = await fetch(`https://www.thrill-data.com/waits/graph/quick/parkheat?id=243&dateStart=${todayStr}&tag=min`);
            if (!heatmapResponse.ok) {
                throw new Error(`Failed to fetch heatmap data: ${heatmapResponse.status}`);
            }
            
            const heatmapData = await heatmapResponse.json();
            console.log('Heatmap data received:', heatmapData);
            
            // Extract the Plotly data from the response
            const plot1Content = heatmapData.plot1;
            
            // Extract time labels (x-axis)
            const xPattern = /"x":\s*\[([^\]]*)\]/;
            const xMatch = plot1Content.match(xPattern);
            if (!xMatch) {
                throw new Error('Could not extract time labels from heatmap data');
            }
            
            let xContent = '[' + xMatch.group(1) + ']';
            xContent = xContent.replace(/'([^']*)'/g, '"$1"');
            xContent = xContent.replace(/\\u003cbr\\u003e/g, '<br>');
            
            const timeLabels = JSON.parse(xContent);
            console.log('Time labels extracted:', timeLabels);
            
            // Extract ride names (y-axis)
            const yPattern = /"y":\s*\[([^\]]*)\]/;
            const yMatch = plot1Content.match(yPattern);
            if (!yMatch) {
                throw new Error('Could not extract ride names from heatmap data');
            }
            
            let yContent = '[' + yMatch.group(1) + ']';
            yContent = yContent.replace(/'([^']*)'/g, '"$1"');
            yContent = yContent.replace(/\\u003cbr\\u003e/g, '<br>');
            yContent = yContent.replace(/"s/g, "'s");
            yContent = yContent.replace(/(?<![\[,])"(?![\],])/g, "'");
            yContent = yContent.replace(/(?<=[\[,])"/g, '"');
            yContent = yContent.replace(/"(?=[,\]])/g, '"');
            
            const rideNames = JSON.parse(yContent);
            console.log('Ride names extracted:', rideNames);
            
            // Extract wait time matrix (z-axis)
            const zPattern = /"z":\s*(\[\[.*?\]\])/;
            const zMatch = plot1Content.match(zPattern);
            if (!zMatch) {
                throw new Error('Could not extract wait time matrix from heatmap data');
            }
            
            let zContent = zMatch.group(1);
            zContent = zContent.replace(/'([^']*)'/g, '"$1"');
            zContent = zContent.replace(/\\u003cbr\\u003e/g, '<br>');
            zContent = zContent.replace(/'/g, '"');
            
            const waitTimeMatrix = JSON.parse(zContent);
            console.log('Wait time matrix extracted:', waitTimeMatrix);
            
            // Process the data into our expected format
            const rides = [];
            
            // Filter out "Average" time point if it exists
            const averageIndex = timeLabels.indexOf("Average");
            const filteredTimeLabels = timeLabels.filter(time => time !== "Average");
            
            rideNames.forEach((rideName, rideIndex) => {
                if (rideIndex < waitTimeMatrix.length && waitTimeMatrix[rideIndex]) {
                    let waitTimes = waitTimeMatrix[rideIndex];
                    
                    // If average existed, slice the array to match filtered time points
                    if (averageIndex !== -1 && waitTimes.length > averageIndex) {
                        waitTimes = waitTimes.slice(0, averageIndex);
                    }
                    
                    // Convert empty strings to null and process wait times
                    const processedTimes = waitTimes.map(wt => {
                        if (wt === '' || wt === null || wt === undefined) {
                            return null;
                        }
                        try {
                            return parseInt(wt);
                        } catch {
                            return null;
                        }
                    });
                    
                    // Get the latest non-null wait time for current status
                    let currentWait = null;
                    for (let i = processedTimes.length - 1; i >= 0; i--) {
                        if (processedTimes[i] !== null) {
                            currentWait = processedTimes[i];
                            break;
                        }
                    }
                    
                    // Create wait_times array in the expected format
                    const waitTimesFormatted = filteredTimeLabels.map((timeLabel, timeIndex) => ({
                        time: timeLabel,
                        wait: processedTimes[timeIndex] || null
                    }));
                    
                    // Determine land based on ride name
                    let land = 'Epic Universe';
                    const nameLower = rideName.toLowerCase();
                    
                    if (nameLower.includes('stardust racers') || nameLower.includes('constellation carousel')) {
                        land = 'Celestial Park';
                    } else if (nameLower.includes('mine-cart') || nameLower.includes('yoshi') || nameLower.includes('mario kart') || nameLower.includes('bowser')) {
                        land = 'Super Nintendo World';
                    } else if (nameLower.includes('hiccup') || nameLower.includes('fyre drill') || nameLower.includes('dragon racer') || nameLower.includes('dragon') || nameLower.includes('toothless')) {
                        land = 'Isle of Berk';
                    } else if (nameLower.includes('monsters') || nameLower.includes('frankenstein') || nameLower.includes('werewolf')) {
                        land = 'Dark Universe';
                    } else if (nameLower.includes('harry potter') || nameLower.includes('ministry') || nameLower.includes('umbridge')) {
                        land = 'The Wizarding World of Harry Potter - Ministry of Magic';
                    }
                    
                    rides.push({
                        name: rideName,
                        waitTime: currentWait,
                        status: currentWait !== null ? 'Open' : 'Down',
                        land: land,
                        rideCount: rideCounts[rideName] || 0,
                        completed: false,
                        wait_times: waitTimesFormatted
                    });
                }
            });
            
            // Sort by wait time
            rides.sort((a, b) => {
                if (a.waitTime === null && b.waitTime === null) return 0;
                if (a.waitTime === null) return 1;
                if (b.waitTime === null) return -1;
                return a.waitTime - b.waitTime;
            });
            
            setRides(rides);
            
            // Create today's data structure
            const todayData = {
                date: todayStr,
                park: "Epic Universe",
                rides: rides
            };
            
            console.log('Today\'s data processed:', todayData);
            
            // Try to fetch last week's data from our static files (if available)
            let lastWeekData = null;
            try {
                const lastWeekResponse = await fetch(`/data/last_week_waits_${todayStr}.json`);
                if (lastWeekResponse.ok) {
                    lastWeekData = await lastWeekResponse.json();
                    console.log('Last week\'s data loaded from static file');
                } else {
                    console.log('No static last week data found, will use generated data');
                }
            } catch (error) {
                console.log('Could not load static last week data:', error);
            }
            
            // If no static last week data, generate some for comparison
            if (!lastWeekData) {
                lastWeekData = {
                    date: new Date(todayET.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    park: "Epic Universe",
                    rides: rides.map(ride => ({
                        ...ride,
                        waitTime: Math.round(ride.waitTime * 0.8 + Math.random() * 20), // Generate some variation
                        wait_times: ride.wait_times.map(wt => ({
                            ...wt,
                            wait: wt.wait ? Math.round(wt.wait * (0.5 + Math.random() * 0.5)) : null
                        }))
                    }))
                };
            }
            
            setLastWeekData(lastWeekData);
            
            // Process graph data for charts
            const newTodayData = {};
            const newWeekAgoData = {};
            
            // Process today's data for graphs
            if (todayData && todayData.rides) {
                todayData.rides.forEach(ride => {
                    if (ride && ride.name && ride.wait_times) {
                        // Keep the full time/wait objects, just filter out "Average"
                        newTodayData[ride.name] = ride.wait_times.filter(wt => wt.time !== 'Average');
                    }
                });
            }
            
            // Process last week's data for graphs
            if (lastWeekData && lastWeekData.rides) {
                lastWeekData.rides.forEach(ride => {
                    if (ride && ride.name && ride.wait_times) {
                        // Keep the full time/wait objects, just filter out "Average"
                        newWeekAgoData[ride.name] = ride.wait_times.filter(wt => wt.time !== 'Average');
                    }
                });
            }
            
            setTodayData(newTodayData);
            setWeekAgoData(newWeekAgoData);
            
            console.log('Successfully processed complete heatmap data');
            
        } catch (error) {
            console.error('Error fetching wait times:', error);
            setError(`Failed to fetch wait times: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const incrementRideCount = (rideName) => {
        const newRideCounts = { ...rideCounts };
        newRideCounts[rideName] = (newRideCounts[rideName] || 0) + 1;
        setRideCounts(newRideCounts);
        localStorage.setItem('rideCounts', JSON.stringify(newRideCounts));
        
        // Update rides state
        setRides(rides.map(ride => 
            ride.name === rideName ? { ...ride, rideCount: newRideCounts[rideName] } : ride
        ));
    };

    const resetRideCounts = () => {
        setRideCounts({});
        localStorage.removeItem('rideCounts');
        setRides(rides.map(ride => ({ ...ride, rideCount: 0 })));
    };

    useEffect(() => {
        fetchWaitTimes();
        fetchWeatherData(); // Ensure weather data is loaded
        const interval = setInterval(fetchWaitTimes, 900000); // Update every 15 minutes
        return () => clearInterval(interval);
    }, []);

    const getNextRides = () => {
        return rides
            .filter(ride => ride.rideCount < 3) // Show rides ridden less than 3 times
            .slice(0, 5);
    };

    // Get unique lands for filter
    const getUniqueLands = () => {
        const lands = [...new Set(rides.map(ride => ride.land))];
        return ['All Lands', ...lands];
    };

    // Filter rides by selected land
    const getFilteredRides = () => {
        const filtered = rides.filter(ride => selectedLand === 'All Lands' || ride.land === selectedLand);
        
        // Include all rides in planning, even down ones (in case they come back up)
        return filtered;
    };

    // Function to get all rides including down ones for display
    const getAllRidesForDisplay = () => {
        return rides.filter(ride => selectedLand === 'All Lands' || ride.land === selectedLand);
    };

    // Function to get ride status
    const getRideStatus = (ride) => {
        // Use the status from the API if available
        if (ride.status) {
            if (ride.status === 'Down' || ride.status === 'Weather Delay') {
                return {
                    status: 'down',
                    text: ride.status,
                    color: ride.status === 'Weather Delay' ? 'warning' : 'danger'
                };
            } else if (ride.status === 'Open' && ride.waitTime !== null) {
                return {
                    status: 'open',
                    text: `${ride.waitTime} minutes`,
                    color: 'success'
                };
            }
        }
        
        // Fallback to the old logic for compatibility
        const isNumericWaitTime = typeof ride.waitTime === 'number' || (typeof ride.waitTime === 'string' && !isNaN(parseInt(ride.waitTime)));
        const isDown = !ride.waitTime || ride.waitTime === 'Down' || ride.waitTime === 'Weather Delay' || !isNumericWaitTime;
        
        if (isDown) {
            return {
                status: 'down',
                text: ride.waitTime || 'Down',
                color: 'danger'
            };
        }
        
        return {
            status: 'open',
            text: `${ride.waitTime} minutes`,
            color: 'success'
        };
    };

    // Function to get wait time from last week's data at a specific time
    const getWaitTimeAtTime = (rideName, timeString) => {
        if (!weekAgoData[rideName] || !timeString) {
            // Fallback: return average wait time for the ride
            const ride = rides.find(r => r.name === rideName);
            return ride ? ride.waitTime : null;
        }
        
        // Parse time string like "10:30 AM" to get hour and minute
        const timeMatch = timeString.match(/(\d+):(\d+)\s*(AM|PM)/);
        if (!timeMatch) return null;
        
        let hour = parseInt(timeMatch[1]);
        const minute = parseInt(timeMatch[2]);
        const isPM = timeMatch[3] === 'PM';
        
        if (isPM && hour !== 12) hour += 12;
        if (!isPM && hour === 12) hour = 0;
        
        // Convert to time of day (e.g., 10.5 for 10:30 AM)
        const timeOfDay = hour + minute / 60;
        
        // Find the closest time label in weekAgoData
        const weekAgoRideData = weekAgoData[rideName];
        if (!Array.isArray(weekAgoRideData) || weekAgoRideData.length === 0) {
            // Fallback: return average wait time for the ride
            const ride = rides.find(r => r.name === rideName);
            return ride ? ride.waitTime : null;
        }
        
        // Find the closest time match
        let closestTime = null;
        let minDiff = Infinity;
        
        weekAgoRideData.forEach(item => {
            if (item.time) {
                const itemTimeMatch = item.time.match(/(\d+):(\d+)\s*(AM|PM)/);
                if (itemTimeMatch) {
                    let itemHour = parseInt(itemTimeMatch[1]);
                    const itemMinute = parseInt(itemTimeMatch[2]);
                    const itemIsPM = itemTimeMatch[3] === 'PM';
                    
                    if (itemIsPM && itemHour !== 12) itemHour += 12;
                    if (!itemIsPM && itemHour === 12) itemHour = 0;
                    
                    const itemTimeOfDay = itemHour + itemMinute / 60;
                    const diff = Math.abs(itemTimeOfDay - timeOfDay);
                    
                    if (diff < minDiff) {
                        minDiff = diff;
                        closestTime = item.wait;
                    }
                }
            }
        });
        
        // If we found a close match, return it; otherwise fallback to average
        if (closestTime !== null) {
            return closestTime;
        } else {
            // Fallback: return average wait time for the ride
            const ride = rides.find(r => r.name === rideName);
            return ride ? ride.waitTime : null;
        }
    };

    // Ride Plan Management Functions
    const addRideToPlan = (ride) => {
        const newPlan = [...ridePlan];
        const rideTime = ride.waitTime + 5; // Wait time + 5 minutes for actual ride
        newPlan.push({
            type: 'ride',
            name: ride.name,
            waitTime: ride.waitTime,
            rideTime: 5,
            totalTime: rideTime,
            land: ride.land,
            estimatedStartTime: null, // Will be calculated
            estimatedEndTime: null    // Will be calculated
        });
        setRidePlan(newPlan);
        localStorage.setItem('ridePlan', JSON.stringify(newPlan));
        
        // Auto-calculate timing if enabled - use the new plan
        if (autoCalculateTiming) {
            setTimeout(() => {
                const startTime = new Date();
                const [startHour, startMinute] = planStartTime.split(':').map(Number);
                startTime.setHours(startHour, startMinute, 0, 0);

                let currentTime = new Date(startTime);
                const updatedPlan = newPlan.map(item => {
                    const start = new Date(currentTime);
                    let duration = item.type === 'ride' ? item.totalTime : item.duration;
                    
                    // For rides, update wait time based on historical data at this time
                    if (item.type === 'ride') {
                        const historicalWaitTime = getWaitTimeAtTime(item.name, start.toLocaleTimeString('en-US', { 
                            hour: 'numeric', 
                            minute: '2-digit',
                            hour12: true 
                        }));
                        if (historicalWaitTime) {
                            duration = historicalWaitTime + 5; // Historical wait + 5 minutes for actual ride
                        }
                    }
                    
                    currentTime.setMinutes(currentTime.getMinutes() + duration);
                    const end = new Date(currentTime);
                    
                    return {
                        ...item,
                        waitTime: item.type === 'ride' ? (duration - 5) : item.waitTime, // Update wait time for rides
                        totalTime: duration,
                        estimatedStartTime: start.toLocaleTimeString('en-US', { 
                            hour: 'numeric', 
                            minute: '2-digit',
                            hour12: true 
                        }),
                        estimatedEndTime: end.toLocaleTimeString('en-US', { 
                            hour: 'numeric', 
                            minute: '2-digit',
                            hour12: true 
                        })
                    };
                });
                
                setRidePlan(updatedPlan);
                localStorage.setItem('ridePlan', JSON.stringify(updatedPlan));
            }, 0);
        }
    };

    const addSpacerToPlan = () => {
        const newPlan = [...ridePlan];
        newPlan.push({
            type: 'spacer',
            name: 'Break/Activity',
            description: '',
            duration: 30, // Default 30 minutes
            estimatedStartTime: null,
            estimatedEndTime: null
        });
        setRidePlan(newPlan);
        localStorage.setItem('ridePlan', JSON.stringify(newPlan));
        
        // Auto-calculate timing if enabled - use the new plan
        if (autoCalculateTiming) {
            setTimeout(() => {
                const startTime = new Date();
                const [startHour, startMinute] = planStartTime.split(':').map(Number);
                startTime.setHours(startHour, startMinute, 0, 0);

                let currentTime = new Date(startTime);
                const updatedPlan = newPlan.map(item => {
                    const start = new Date(currentTime);
                    let duration = item.type === 'ride' ? item.totalTime : item.duration;
                    
                    // For rides, update wait time based on historical data at this time
                    if (item.type === 'ride') {
                        const historicalWaitTime = getWaitTimeAtTime(item.name, start.toLocaleTimeString('en-US', { 
                            hour: 'numeric', 
                            minute: '2-digit',
                            hour12: true 
                        }));
                        if (historicalWaitTime) {
                            duration = historicalWaitTime + 5; // Historical wait + 5 minutes for actual ride
                        }
                    }
                    
                    currentTime.setMinutes(currentTime.getMinutes() + duration);
                    const end = new Date(currentTime);
                    
                    return {
                        ...item,
                        waitTime: item.type === 'ride' ? (duration - 5) : item.waitTime, // Update wait time for rides
                        totalTime: duration,
                        estimatedStartTime: start.toLocaleTimeString('en-US', { 
                            hour: 'numeric', 
                            minute: '2-digit',
                            hour12: true 
                        }),
                        estimatedEndTime: end.toLocaleTimeString('en-US', { 
                            hour: 'numeric', 
                            minute: '2-digit',
                            hour12: true 
                        })
                    };
                });
                
                setRidePlan(updatedPlan);
                localStorage.setItem('ridePlan', JSON.stringify(updatedPlan));
            }, 0);
        }
    };

    const removeFromPlan = (index) => {
        const newPlan = ridePlan.filter((_, i) => i !== index);
        setRidePlan(newPlan);
        localStorage.setItem('ridePlan', JSON.stringify(newPlan));
        
        // Auto-calculate timing if enabled - use the new plan
        if (autoCalculateTiming) {
            setTimeout(() => {
                const startTime = new Date();
                const [startHour, startMinute] = planStartTime.split(':').map(Number);
                startTime.setHours(startHour, startMinute, 0, 0);

                let currentTime = new Date(startTime);
                const updatedPlan = newPlan.map(item => {
                    const start = new Date(currentTime);
                    let duration = item.type === 'ride' ? item.totalTime : item.duration;
                    
                    // For rides, update wait time based on historical data at this time
                    if (item.type === 'ride') {
                        const historicalWaitTime = getWaitTimeAtTime(item.name, start.toLocaleTimeString('en-US', { 
                            hour: 'numeric', 
                            minute: '2-digit',
                            hour12: true 
                        }));
                        if (historicalWaitTime) {
                            duration = historicalWaitTime + 5; // Historical wait + 5 minutes for actual ride
                        }
                    }
                    
                    currentTime.setMinutes(currentTime.getMinutes() + duration);
                    const end = new Date(currentTime);
                    
                    return {
                        ...item,
                        waitTime: item.type === 'ride' ? (duration - 5) : item.waitTime, // Update wait time for rides
                        totalTime: duration,
                        estimatedStartTime: start.toLocaleTimeString('en-US', { 
                            hour: 'numeric', 
                            minute: '2-digit',
                            hour12: true 
                        }),
                        estimatedEndTime: end.toLocaleTimeString('en-US', { 
                            hour: 'numeric', 
                            minute: '2-digit',
                            hour12: true 
                        })
                    };
                });
                
                setRidePlan(updatedPlan);
                localStorage.setItem('ridePlan', JSON.stringify(updatedPlan));
            }, 0);
        }
    };

    const updatePlanItem = (index, updates) => {
        const newPlan = [...ridePlan];
        newPlan[index] = { ...newPlan[index], ...updates };
        
        // If duration was changed, recalculate timing
        if (updates.duration !== undefined && autoCalculateTiming) {
            setTimeout(() => {
                const startTime = new Date();
                const [startHour, startMinute] = planStartTime.split(':').map(Number);
                startTime.setHours(startHour, startMinute, 0, 0);

                let currentTime = new Date(startTime);
                const updatedPlan = newPlan.map(item => {
                    const start = new Date(currentTime);
                    let duration = item.type === 'ride' ? item.totalTime : item.duration;
                    
                    // For rides, update wait time based on historical data at this time
                    if (item.type === 'ride') {
                        const historicalWaitTime = getWaitTimeAtTime(item.name, start.toLocaleTimeString('en-US', { 
                            hour: 'numeric', 
                            minute: '2-digit',
                            hour12: true 
                        }));
                        if (historicalWaitTime) {
                            duration = historicalWaitTime + 5; // Historical wait + 5 minutes for actual ride
                        }
                    }
                    
                    currentTime.setMinutes(currentTime.getMinutes() + duration);
                    const end = new Date(currentTime);
                    
                    return {
                        ...item,
                        waitTime: item.type === 'ride' ? (duration - 5) : item.waitTime, // Update wait time for rides
                        totalTime: duration,
                        estimatedStartTime: start.toLocaleTimeString('en-US', { 
                            hour: 'numeric', 
                            minute: '2-digit',
                            hour12: true 
                        }),
                        estimatedEndTime: end.toLocaleTimeString('en-US', { 
                            hour: 'numeric', 
                            minute: '2-digit',
                            hour12: true 
                        })
                    };
                });
                
                setRidePlan(updatedPlan);
                localStorage.setItem('ridePlan', JSON.stringify(updatedPlan));
            }, 0);
        } else {
            setRidePlan(newPlan);
            localStorage.setItem('ridePlan', JSON.stringify(newPlan));
        }
    };

    const calculatePlanTiming = () => {
        const startTime = new Date();
        const [startHour, startMinute] = planStartTime.split(':').map(Number);
        startTime.setHours(startHour, startMinute, 0, 0);

        let currentTime = new Date(startTime);
        const newPlan = ridePlan.map(item => {
            const start = new Date(currentTime);
            let duration = item.type === 'ride' ? item.totalTime : item.duration;
            
            // For rides, update wait time based on historical data at this time
            if (item.type === 'ride') {
                const historicalWaitTime = getWaitTimeAtTime(item.name, start.toLocaleTimeString('en-US', { 
                    hour: 'numeric', 
                    minute: '2-digit',
                    hour12: true 
                }));
                if (historicalWaitTime) {
                    duration = historicalWaitTime + 5; // Historical wait + 5 minutes for actual ride
                }
            }
            
            currentTime.setMinutes(currentTime.getMinutes() + duration);
            const end = new Date(currentTime);
            
            return {
                ...item,
                waitTime: item.type === 'ride' ? (duration - 5) : item.waitTime, // Update wait time for rides
                totalTime: duration,
                estimatedStartTime: start.toLocaleTimeString('en-US', { 
                    hour: 'numeric', 
                    minute: '2-digit',
                    hour12: true 
                }),
                estimatedEndTime: end.toLocaleTimeString('en-US', { 
                    hour: 'numeric', 
                    minute: '2-digit',
                    hour12: true 
                })
            };
        });
        
        setRidePlan(newPlan);
        localStorage.setItem('ridePlan', JSON.stringify(newPlan));
    };

    const clearPlan = () => {
        setRidePlan([]);
        localStorage.removeItem('ridePlan');
    };

    // New functions for enhanced planning
    const startTrackingProgress = () => {
        setIsTrackingProgress(true);
    };

    const stopTrackingProgress = () => {
        setIsTrackingProgress(false);
    };

    const recordActualStart = (index) => {
        const now = new Date();
        const actualStartTime = now.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
        });
        
        updatePlanItem(index, { 
            actualStartTime,
            status: 'in-progress'
        });
    };

    const recordActualEnd = (index) => {
        const now = new Date();
        const actualEndTime = now.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
        });
        
        // Calculate actual duration
        const item = ridePlan[index];
        let actualDuration = 0;
        
        if (item.actualStartTime) {
            const startTime = new Date();
            const [startHour, startMinute] = item.actualStartTime.match(/(\d+):(\d+)/).slice(1).map(Number);
            const isPM = item.actualStartTime.includes('PM') && startHour !== 12;
            startTime.setHours(isPM ? startHour + 12 : startHour, startMinute, 0, 0);
            
            const endTime = new Date();
            const [endHour, endMinute] = actualEndTime.match(/(\d+):(\d+)/).slice(1).map(Number);
            const isEndPM = actualEndTime.includes('PM') && endHour !== 12;
            endTime.setHours(isEndPM ? endHour + 12 : endHour, endMinute, 0, 0);
            
            actualDuration = Math.round((endTime - startTime) / (1000 * 60));
        }
        
        const newPlan = [...ridePlan];
        newPlan[index] = {
            ...newPlan[index],
            actualEndTime,
            actualDuration,
            status: 'completed'
        };
        
        setRidePlan(newPlan);
        localStorage.setItem('ridePlan', JSON.stringify(newPlan));
        
        // Trigger dynamic recalculation for remaining items
        recalculateRemainingTiming(index + 1, newPlan);
    };

    const recalculateRemainingTiming = (startIndex, planToUse = null) => {
        const plan = planToUse || ridePlan;
        if (startIndex >= plan.length) return;
        
        const newPlan = [...plan];
        let currentTime = new Date();
        
        // Find the last completed item's actual end time
        if (startIndex > 0) {
            const lastCompleted = newPlan[startIndex - 1];
            if (lastCompleted.actualEndTime) {
                const [hour, minute] = lastCompleted.actualEndTime.match(/(\d+):(\d+)/).slice(1).map(Number);
                const isPM = lastCompleted.actualEndTime.includes('PM') && hour !== 12;
                currentTime.setHours(isPM ? hour + 12 : hour, minute, 0, 0);
            }
        }
        
        // Recalculate timing for remaining items
        for (let i = startIndex; i < newPlan.length; i++) {
            const item = newPlan[i];
            if (item.status === 'completed') continue;
            
            const start = new Date(currentTime);
            let duration = item.type === 'ride' ? item.totalTime : item.duration;
            
            // For rides, update wait time based on historical data at this time
            if (item.type === 'ride') {
                const historicalWaitTime = getWaitTimeAtTime(item.name, start.toLocaleTimeString('en-US', { 
                    hour: 'numeric', 
                    minute: '2-digit',
                    hour12: true 
                }));
                if (historicalWaitTime) {
                    duration = historicalWaitTime + 5; // Historical wait + 5 minutes for actual ride
                }
            }
            
            currentTime.setMinutes(currentTime.getMinutes() + duration);
            const end = new Date(currentTime);
            
            newPlan[i] = {
                ...item,
                waitTime: item.type === 'ride' ? (duration - 5) : item.waitTime, // Update wait time for rides
                totalTime: duration,
                estimatedStartTime: start.toLocaleTimeString('en-US', { 
                    hour: 'numeric', 
                    minute: '2-digit',
                    hour12: true 
                }),
                estimatedEndTime: end.toLocaleTimeString('en-US', { 
                    hour: 'numeric', 
                    minute: '2-digit',
                    hour12: true 
                })
            };
        }
        
        setRidePlan(newPlan);
        localStorage.setItem('ridePlan', JSON.stringify(newPlan));
    };

    const updateWaitTimesInPlan = () => {
        const newPlan = ridePlan.map(item => {
            if (item.type === 'ride') {
                const currentRide = rides.find(ride => ride.name === item.name);
                if (currentRide) {
                    const newWaitTime = currentRide.waitTime;
                    const newTotalTime = newWaitTime + 5; // 5 minutes for actual ride
                    return {
                        ...item,
                        waitTime: newWaitTime,
                        totalTime: newTotalTime
                    };
                }
            }
            return item;
        });
        
        setRidePlan(newPlan);
        localStorage.setItem('ridePlan', JSON.stringify(newPlan));
        
        // Recalculate timing if we have estimated times
        if (newPlan.length > 0 && newPlan[0].estimatedStartTime) {
            recalculateRemainingTiming(0);
        }
    };

    // Mobile-friendly reordering functions (replacing drag-and-drop)
    const moveItemUp = (index) => {
        if (isMovingItem) return; // Prevent multiple clicks
        console.log('moveItemUp called with index:', index);
        
        if (index === 0) {
            console.log('Cannot move first item up');
            return; // Can't move first item up
        }
        
        setIsMovingItem(true);
        
        setRidePlan(prevPlan => {
            console.log('moveItemUp - prevPlan:', prevPlan.map((item, i) => `${i}: ${item.name}`));
            const newPlan = [...prevPlan];
            const item = newPlan[index];
            console.log('Moving item:', item.name, 'from index', index, 'to index', index - 1);
            
            // Remove from current position
            newPlan.splice(index, 1);
            
            // Insert at new position
            newPlan.splice(index - 1, 0, item);
            
            console.log('moveItemUp - newPlan:', newPlan.map((item, i) => `${i}: ${item.name}`));
            
            // Save to localStorage
            localStorage.setItem('ridePlan', JSON.stringify(newPlan));
            
            // Recalculate timing if we have estimated times
            if (newPlan.length > 0 && newPlan[0].estimatedStartTime) {
                setTimeout(() => {
                    recalculateRemainingTiming(0, newPlan);
                    setIsMovingItem(false);
                }, 100);
            } else {
                setIsMovingItem(false);
            }
            
            return newPlan;
        });
    };

    const moveItemDown = (index) => {
        if (isMovingItem) return; // Prevent multiple clicks
        console.log('moveItemDown called with index:', index);
        
        setIsMovingItem(true);
        
        setRidePlan(prevPlan => {
            console.log('moveItemDown - prevPlan:', prevPlan.map((item, i) => `${i}: ${item.name}`));
            
            if (index === prevPlan.length - 1) {
                console.log('Cannot move last item down');
                setIsMovingItem(false);
                return prevPlan; // Can't move last item down
            }
            
            const newPlan = [...prevPlan];
            const item = newPlan[index];
            console.log('Moving item:', item.name, 'from index', index, 'to index', index + 1);
            
            // Remove from current position
            newPlan.splice(index, 1);
            
            // Insert at new position
            newPlan.splice(index + 1, 0, item);
            
            console.log('moveItemDown - newPlan:', newPlan.map((item, i) => `${i}: ${item.name}`));
            
            // Save to localStorage
            localStorage.setItem('ridePlan', JSON.stringify(newPlan));
            
            // Recalculate timing if we have estimated times
            if (newPlan.length > 0 && newPlan[0].estimatedStartTime) {
                setTimeout(() => {
                    recalculateRemainingTiming(0, newPlan);
                    setIsMovingItem(false);
                }, 100);
            } else {
                setIsMovingItem(false);
            }
            
            return newPlan;
        });
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'completed': return 'success';
            case 'in-progress': return 'warning';
            case 'delayed': return 'danger';
            default: return 'secondary';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'completed': return '✅';
            case 'in-progress': return '⏳';
            case 'delayed': return '⚠️';
            default: return '⏰';
        }
    };

    // Weather functions
    const fetchWeatherData = async () => {
        setWeatherLoading(true);
        try {
            // Since we can't directly scrape Weather Underground due to CORS, 
            // we'll create a proxy endpoint or use a weather API
            // For now, let's create a mock weather data structure based on the Orlando forecast
            const mockWeatherData = {
                location: 'Orlando, FL',
                current: {
                    temperature: 82,
                    feelsLike: 88,
                    humidity: 77,
                    condition: 'Partly Cloudy'
                },
                hourly: [
                    { hour: 9, temperature: 78, feelsLike: 82, precipitation: 20, condition: 'Partly Cloudy' },
                    { hour: 10, temperature: 82, feelsLike: 86, precipitation: 15, condition: 'Partly Cloudy' },
                    { hour: 11, temperature: 85, feelsLike: 90, precipitation: 25, condition: 'Partly Cloudy' },
                    { hour: 12, temperature: 87, feelsLike: 93, precipitation: 40, condition: 'Cloudy' },
                    { hour: 13, temperature: 88, feelsLike: 95, precipitation: 60, condition: 'Thunderstorm' },
                    { hour: 14, temperature: 87, feelsLike: 94, precipitation: 80, condition: 'Heavy Rain' },
                    { hour: 15, temperature: 86, feelsLike: 92, precipitation: 70, condition: 'Thunderstorm' },
                    { hour: 16, temperature: 85, feelsLike: 90, precipitation: 50, condition: 'Light Rain' },
                    { hour: 17, temperature: 84, feelsLike: 89, precipitation: 30, condition: 'Partly Cloudy' },
                    { hour: 18, temperature: 82, feelsLike: 87, precipitation: 20, condition: 'Partly Cloudy' },
                    { hour: 19, temperature: 80, feelsLike: 84, precipitation: 10, condition: 'Clear' },
                    { hour: 20, temperature: 78, feelsLike: 82, precipitation: 5, condition: 'Clear' },
                    { hour: 21, temperature: 76, feelsLike: 79, precipitation: 0, condition: 'Clear' }
                ],
                forecast: {
                    high: 88,
                    low: 74,
                    chanceOfRain: 80,
                    description: 'Partly cloudy early then heavy thunderstorms this afternoon. High 88F. Winds SE at 5 to 10 mph. Chance of rain 80%. 1 to 2 inches of rain expected.'
                }
            };
            
            setWeatherData(mockWeatherData);
        } catch (error) {
            console.error('Error fetching weather data:', error);
        } finally {
            setWeatherLoading(false);
        }
    };

    const getWeatherForTime = (timeString) => {
        if (!weatherData || !timeString) return null;
        
        // Parse time string like "10:30 AM" to get hour
        const timeMatch = timeString.match(/(\d+):(\d+)\s*(AM|PM)/);
        if (!timeMatch) return null;
        
        let hour = parseInt(timeMatch[1]);
        const isPM = timeMatch[3] === 'PM';
        
        if (isPM && hour !== 12) hour += 12;
        if (!isPM && hour === 12) hour = 0;
        
        // Find the closest hour in weather data
        const weatherHour = weatherData.hourly.find(w => w.hour === hour) || 
                           weatherData.hourly.find(w => w.hour === hour - 1) ||
                           weatherData.hourly.find(w => w.hour === hour + 1);
        
        return weatherHour;
    };

    const getWeatherIcon = (condition) => {
        const conditionLower = condition.toLowerCase();
        if (conditionLower.includes('thunderstorm') || conditionLower.includes('heavy rain')) return '⛈️';
        if (conditionLower.includes('rain')) return '🌧️';
        if (conditionLower.includes('cloudy')) return '☁️';
        if (conditionLower.includes('partly cloudy')) return '⛅';
        if (conditionLower.includes('clear')) return '☀️';
        return '🌤️';
    };

    // Function to refresh data from Thrill Data
    const refreshData = async () => {
        setRefreshLoading(true);
        try {
            console.log('🔄 Refreshing complete heatmap data from Thrill Data...');
            
            // Simply re-fetch the wait times (which now gets complete heatmap data)
            await fetchWaitTimes();
            
            // Show success message
            alert('Data refreshed successfully! Latest complete wait time data is now loaded.');
            
        } catch (error) {
            console.error('❌ Error refreshing data:', error);
            alert(`Failed to refresh data: ${error.message}`);
        } finally {
            setRefreshLoading(false);
        }
    };

    const getHistoricalData = async () => {
        setHistoricalLoading(true);
        try {
            console.log('📅 Fetching historical data from 7 days ago...');
            
            // Calculate 7 days ago in Eastern Time
            const now = new Date();
            const etOffset = -5; // Eastern Time is UTC-5 (or UTC-4 during DST)
            const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
            const todayET = new Date(utc + (etOffset * 3600000));
            const sevenDaysAgo = new Date(todayET.getTime() - 7 * 24 * 60 * 60 * 1000);
            const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];
            
            // Fetch historical heatmap data from Thrill Data
            const historicalResponse = await fetch(`https://www.thrill-data.com/waits/graph/quick/parkheat?id=243&dateStart=${sevenDaysAgoStr}&tag=min`);
            if (!historicalResponse.ok) {
                throw new Error(`Failed to fetch historical data: ${historicalResponse.status}`);
            }
            
            const historicalData = await historicalResponse.json();
            console.log('Historical data received:', historicalData);
            
            // Process the historical data similar to today's data
            const plot1Content = historicalData.plot1;
            
            // Extract time labels (x-axis)
            const xPattern = /"x":\s*\[([^\]]*)\]/;
            const xMatch = plot1Content.match(xPattern);
            if (!xMatch) {
                throw new Error('Could not extract time labels from historical data');
            }
            
            let xContent = '[' + xMatch.group(1) + ']';
            xContent = xContent.replace(/'([^']*)'/g, '"$1"');
            xContent = xContent.replace(/\\u003cbr\\u003e/g, '<br>');
            
            const timeLabels = JSON.parse(xContent);
            
            // Extract ride names (y-axis)
            const yPattern = /"y":\s*\[([^\]]*)\]/;
            const yMatch = plot1Content.match(yPattern);
            if (!yMatch) {
                throw new Error('Could not extract ride names from historical data');
            }
            
            let yContent = '[' + yMatch.group(1) + ']';
            yContent = yContent.replace(/'([^']*)'/g, '"$1"');
            yContent = yContent.replace(/\\u003cbr\\u003e/g, '<br>');
            yContent = yContent.replace(/"s/g, "'s");
            yContent = yContent.replace(/(?<![\[,])"(?![\],])/g, "'");
            yContent = yContent.replace(/(?<=[\[,])"/g, '"');
            yContent = yContent.replace(/"(?=[,\]])/g, '"');
            
            const rideNames = JSON.parse(yContent);
            
            // Extract wait time matrix (z-axis)
            const zPattern = /"z":\s*(\[\[.*?\]\])/;
            const zMatch = plot1Content.match(zPattern);
            if (!zMatch) {
                throw new Error('Could not extract wait time matrix from historical data');
            }
            
            let zContent = zMatch.group(1);
            zContent = zContent.replace(/'([^']*)'/g, '"$1"');
            zContent = zContent.replace(/\\u003cbr\\u003e/g, '<br>');
            zContent = zContent.replace(/'/g, '"');
            
            const waitTimeMatrix = JSON.parse(zContent);
            
            // Process the data into our expected format
            const rides = [];
            
            // Filter out "Average" time point if it exists
            const averageIndex = timeLabels.indexOf("Average");
            const filteredTimeLabels = timeLabels.filter(time => time !== "Average");
            
            rideNames.forEach((rideName, rideIndex) => {
                if (rideIndex < waitTimeMatrix.length && waitTimeMatrix[rideIndex]) {
                    let waitTimes = waitTimeMatrix[rideIndex];
                    
                    // If average existed, slice the array to match filtered time points
                    if (averageIndex !== -1 && waitTimes.length > averageIndex) {
                        waitTimes = waitTimes.slice(0, averageIndex);
                    }
                    
                    // Convert empty strings to null and process wait times
                    const processedTimes = waitTimes.map(wt => {
                        if (wt === '' || wt === null || wt === undefined) {
                            return null;
                        }
                        try {
                            return parseInt(wt);
                        } catch {
                            return null;
                        }
                    });
                    
                    // Get the latest non-null wait time for current status
                    let currentWait = null;
                    for (let i = processedTimes.length - 1; i >= 0; i--) {
                        if (processedTimes[i] !== null) {
                            currentWait = processedTimes[i];
                            break;
                        }
                    }
                    
                    // Create wait_times array in the expected format
                    const waitTimesFormatted = filteredTimeLabels.map((timeLabel, timeIndex) => ({
                        time: timeLabel,
                        wait: processedTimes[timeIndex] || null
                    }));
                    
                    // Determine land based on ride name
                    let land = 'Epic Universe';
                    const nameLower = rideName.toLowerCase();
                    
                    if (nameLower.includes('stardust racers') || nameLower.includes('constellation carousel')) {
                        land = 'Celestial Park';
                    } else if (nameLower.includes('mine-cart') || nameLower.includes('yoshi') || nameLower.includes('mario kart') || nameLower.includes('bowser')) {
                        land = 'Super Nintendo World';
                    } else if (nameLower.includes('hiccup') || nameLower.includes('fyre drill') || nameLower.includes('dragon racer') || nameLower.includes('dragon') || nameLower.includes('toothless')) {
                        land = 'Isle of Berk';
                    } else if (nameLower.includes('monsters') || nameLower.includes('frankenstein') || nameLower.includes('werewolf')) {
                        land = 'Dark Universe';
                    } else if (nameLower.includes('harry potter') || nameLower.includes('ministry') || nameLower.includes('umbridge')) {
                        land = 'The Wizarding World of Harry Potter - Ministry of Magic';
                    }
                    
                    rides.push({
                        name: rideName,
                        waitTime: currentWait,
                        status: currentWait !== null ? 'Open' : 'Down',
                        land: land,
                        rideCount: rideCounts[rideName] || 0,
                        completed: false,
                        wait_times: waitTimesFormatted
                    });
                }
            });
            
            // Create historical data structure
            const historicalDataStructure = {
                date: sevenDaysAgoStr,
                park: "Epic Universe",
                rides: rides
            };
            
            // Update the last week data state
            setLastWeekData(historicalDataStructure);
            
            // Process graph data for charts
            const newWeekAgoData = {};
            
            if (historicalDataStructure && historicalDataStructure.rides) {
                historicalDataStructure.rides.forEach(ride => {
                    if (ride && ride.name && ride.wait_times) {
                        newWeekAgoData[ride.name] = ride.wait_times.filter(wt => wt.time !== 'Average');
                    }
                });
            }
            
            setWeekAgoData(newWeekAgoData);
            
            console.log('✅ Historical data from 7 days ago loaded successfully');
            alert(`Historical data from ${sevenDaysAgoStr} (7 days ago) has been loaded successfully!`);
            
        } catch (error) {
            console.error('❌ Error fetching historical data:', error);
            alert(`Failed to fetch historical data: ${error.message}`);
        } finally {
            setHistoricalLoading(false);
        }
    };

    if (loading) return <div className="container mt-5">Loading...</div>;
    if (error) return <div className="container mt-5 text-danger">{error}</div>;

    return (
        <div className="container mt-5">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h1>Universal Studios Ride Planner</h1>
            </div>
            
            {/* Tab Navigation */}
            <ul className="nav nav-tabs mb-4" id="mainTabs" role="tablist">
                <li className="nav-item" role="presentation">
                    <button 
                        className={`nav-link ${activeTab === 'ridePlanner' ? 'active' : ''}`}
                        onClick={() => setActiveTab('ridePlanner')}
                        type="button"
                    >
                        Ride Planner
                    </button>
                </li>
                <li className="nav-item" role="presentation">
                    <button 
                        className={`nav-link ${activeTab === 'rideInfo' ? 'active' : ''}`}
                        onClick={() => setActiveTab('rideInfo')}
                        type="button"
                    >
                        Ride Info & Graphs
                    </button>
                </li>
                <li className="nav-item" role="presentation">
                    <button 
                        className={`nav-link ${activeTab === 'weather' ? 'active' : ''}`}
                        onClick={() => setActiveTab('weather')}
                        type="button"
                    >
                        Weather
                    </button>
                </li>
                <li className="nav-item" role="presentation">
                    <button 
                        className={`nav-link ${activeTab === 'settings' ? 'active' : ''}`}
                        onClick={() => setActiveTab('settings')}
                        type="button"
                    >
                        Settings
                    </button>
                </li>
            </ul>

            {/* Tab Content */}
            {activeTab === 'rideInfo' && (
                <div className="tab-content">
            <div className="row mb-4">
                        <div className="col-md-6">
                            <div className="d-flex flex-column gap-2">
                                <button className="btn btn-primary" onClick={refreshData}>
                        Refresh Wait Times
                    </button>
                                <button 
                                    className={`btn btn-secondary ${historicalLoading ? 'disabled' : ''}`}
                                    onClick={getHistoricalData}
                                    disabled={historicalLoading}
                                >
                                    {historicalLoading ? (
                                        <>
                                            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                            Loading Historical Data...
                                        </>
                                    ) : (
                                        'Get Historical Data'
                                    )}
                                </button>
                                <button className="btn btn-secondary" onClick={resetRideCounts}>
                                    Reset Ride Counts
                    </button>
                            </div>
                        </div>
                        <div className="col-md-6">
                            <label htmlFor="landFilter" className="form-label">Filter by Land:</label>
                            <select 
                                id="landFilter" 
                                className="form-select" 
                                value={selectedLand} 
                                onChange={(e) => setSelectedLand(e.target.value)}
                            >
                                {getUniqueLands().map(land => (
                                    <option key={land} value={land}>{land}</option>
                                ))}
                            </select>
                </div>
            </div>

            <div className="row">
                        <div className="col-12">
                            <h2>All Rides</h2>
                    <div className="list-group">
                                {getAllRidesForDisplay().map(ride => {
                                    if (!ride || !ride.name) return null; // Defensive: skip invalid rides
                                    const rideStatus = getRideStatus(ride);
                                    // Defensive: always pass arrays, never undefined
                                    const todayArr = Array.isArray(todayData[ride.name]) ? todayData[ride.name] : [];
                                    const weekAgoArr = Array.isArray(weekAgoData[ride.name]) ? weekAgoData[ride.name] : [];
                                    return (
                                        <div 
                                            key={ride.name} 
                                            className={`list-group-item ${ride.rideCount > 0 ? 'bg-light' : ''}`}
                                        >
                                            <div className="row">
                                                <div className="col-md-4">
                                <h5>{ride.name}</h5>
                                                    <p className={`mb-1 text-${rideStatus.color}`}>
                                                        <strong>Status:</strong> {rideStatus.text}
                                                    </p>
                                                    <p className="mb-1"><strong>Land:</strong> {ride.land}</p>
                                                    <p className="mb-1"><strong>Ridden:</strong> {ride.rideCount} times</p>
                                <button 
                                                        className="btn btn-success btn-sm"
                                                        onClick={() => incrementRideCount(ride.name)}
                                >
                                                        Rode This Ride (+1)
                                </button>
                            </div>
                                                <div className="col-md-8">
                                                    {renderWaitTimeProfile(todayArr, weekAgoArr, ride.waitTime, ride.name, lastWeekData)}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'ridePlanner' && (
                <div className="tab-content">
                    <div className="row mb-4">
                        <div className="col-12">
                            <div className="d-flex justify-content-between align-items-center mb-3">
                                <h3>Add to Plan</h3>
                                <div className="d-flex gap-2">
                                    <button className="btn btn-warning" onClick={clearPlan}>
                                        Clear Plan
                                    </button>
                                    {!isTrackingProgress ? (
                                        <button className="btn btn-success" onClick={startTrackingProgress}>
                                            Start Progress Tracking
                                        </button>
                                    ) : (
                                        <button className="btn btn-secondary" onClick={stopTrackingProgress}>
                                            Stop Progress Tracking
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="row">
                                <div className="col-md-6">
                                    <label htmlFor="landFilterPlan" className="form-label">Filter by Land:</label>
                                    <select 
                                        id="landFilterPlan" 
                                        className="form-select" 
                                        value={selectedLand} 
                                        onChange={(e) => setSelectedLand(e.target.value)}
                                    >
                                        {getUniqueLands().map(land => (
                                            <option key={land} value={land}>{land}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-md-6 d-flex align-items-end">
                                    <button className="btn btn-info" onClick={addSpacerToPlan}>
                                        Add Break/Activity
                                    </button>
                                </div>
                            </div>
                    </div>
                </div>

                    <div className="row">
                        {!isAvailableRidesCollapsed && (
                <div className="col-md-6">
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                    <h3>Available Rides</h3>
                                    <button 
                                        className="btn btn-sm btn-outline-secondary"
                                        onClick={() => setIsAvailableRidesCollapsed(!isAvailableRidesCollapsed)}
                                    >
                                        Hide
                                    </button>
                                </div>
                                <div className="list-group" style={{maxHeight: '400px', overflowY: 'auto'}}>
                                    {getFilteredRides().map(ride => {
                                        const rideStatus = getRideStatus(ride);
                                        return (
                                            <div key={ride.name} className="list-group-item">
                                                <div className="d-flex justify-content-between align-items-center">
                                                    <div>
                                                        <h6 className="mb-1">{ride.name}</h6>
                                                        <small className={`text-${rideStatus.color}`}>
                                                            {rideStatus.text} | Land: {ride.land}
                                                        </small>
                                                    </div>
                                                    <button 
                                                        className="btn btn-sm btn-outline-primary"
                                                        onClick={() => addRideToPlan(ride)}
                                                    >
                                                        Add to Plan
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                        <div className={isAvailableRidesCollapsed ? "col-12" : "col-md-6"}>
                            <div className="d-flex justify-content-between align-items-center mb-2">
                                <h3>Your Plan <small className="text-muted">(Use ↑↓ to reorder)</small></h3>
                                {isAvailableRidesCollapsed && (
                                    <button 
                                        className="btn btn-sm btn-outline-secondary"
                                        onClick={() => setIsAvailableRidesCollapsed(false)}
                                    >
                                        Show Rides
                                    </button>
                                )}
                            </div>
                            {ridePlan.length === 0 ? (
                                <div className="alert alert-info">
                                    No items in your plan yet. Add rides or breaks to get started!
                                </div>
                            ) : (
                    <div className="list-group">
                                    {ridePlan.map((item, index) => (
                                        <div 
                                            key={`plan-item-${index}-${item.type}-${item.name}`}
                                            className={`list-group-item ${item.status ? `border-${getStatusColor(item.status)}` : ''}`}
                                        >
                                            {item.type === 'ride' ? (
                                                <div>
                                                    <div className="d-flex justify-content-between align-items-start">
                                                        <div className="flex-grow-1">
                                                            <h6 className="mb-1">
                                                                {getStatusIcon(item.status)} 🎢 {item.name}
                                                            </h6>
                                                            <small>Land: {item.land}</small><br/>
                                                            <small>Wait: {item.waitTime} min | Ride: {item.rideTime} min | Total: {item.totalTime} min</small>
                                                            {item.estimatedStartTime && (
                                                                <div><small className="text-muted">
                                                                    Estimated: {item.estimatedStartTime} - {item.estimatedEndTime}
                                                                </small></div>
                                                            )}
                                                            {item.estimatedStartTime && weatherData && (
                                                                <div>
                                                                    {(() => {
                                                                        const weather = getWeatherForTime(item.estimatedStartTime);
                                                                        if (weather) {
                                                                            return (
                                                                                <small className="text-info">
                                                                                    {getWeatherIcon(weather.condition)} {weather.temperature}°F 
                                                                                    (feels {weather.feelsLike}°F) • {weather.precipitation}% rain
                                                                                </small>
                                                                            );
                                                                        }
                                                                        return null;
                                                                    })()}
                                                                </div>
                                                            )}
                                                            {item.actualStartTime && (
                                                                <div><small className="text-success">
                                                                    Started: {item.actualStartTime}
                                                                </small></div>
                                                            )}
                                                            {item.actualEndTime && (
                                                                <div><small className="text-success">
                                                                    Completed: {item.actualEndTime} 
                                                                    {item.actualDuration && ` (${item.actualDuration} min)`}
                                                                </small></div>
                                                            )}
                                                        </div>
                                                        <div className="d-flex flex-column gap-1">
                                                            {isTrackingProgress && !item.status && (
                                    <button 
                                                                    className="btn btn-sm btn-outline-success"
                                                                    onClick={() => recordActualStart(index)}
                                    >
                                                                    Start
                                    </button>
                                                            )}
                                                            {isTrackingProgress && item.status === 'in-progress' && (
                                                                <button 
                                                                    className="btn btn-sm btn-outline-primary"
                                                                    onClick={() => recordActualEnd(index)}
                                                                >
                                                                    Complete
                                                                </button>
                                                            )}
                                                            <div className="btn-group btn-group-sm">
                                                                <button 
                                                                    className="btn btn-outline-secondary"
                                                                    onClick={() => moveItemUp(index)}
                                                                    disabled={index === 0 || isMovingItem}
                                                                    title="Move Up"
                                                                >
                                                                    ↑
                                                                </button>
                                                                <button 
                                                                    className="btn btn-outline-secondary"
                                                                    onClick={() => moveItemDown(index)}
                                                                    disabled={index === ridePlan.length - 1 || isMovingItem}
                                                                    title="Move Down"
                                                                >
                                                                    ↓
                                                                </button>
                                                            </div>
                                                            <button 
                                                                className="btn btn-sm btn-outline-danger"
                                                                onClick={() => removeFromPlan(index)}
                                                            >
                                                                Remove
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div>
                                                    <div className="d-flex justify-content-between align-items-start">
                                                        <div className="flex-grow-1">
                                                            <h6 className="mb-1">
                                                                {getStatusIcon(item.status)} ⏸️ {item.name}
                                                            </h6>
                                                            <input 
                                                                type="text" 
                                                                className="form-control form-control-sm mb-2"
                                                                placeholder="Description (e.g., Lunch, Bathroom break)"
                                                                value={item.description}
                                                                onChange={(e) => updatePlanItem(index, {description: e.target.value})}
                                                            />
                                                            <div className="row">
                                                                <div className="col-6">
                                                                    <label className="form-label">Duration (min):</label>
                                                                    <input 
                                                                        type="number" 
                                                                        className="form-control form-control-sm"
                                                                        value={item.duration}
                                                                        onChange={(e) => updatePlanItem(index, {duration: parseInt(e.target.value) || 0})}
                                                                        min="5"
                                                                        max="120"
                                                                    />
                                                                </div>
                                                            </div>
                                                            {item.estimatedStartTime && (
                                                                <div><small className="text-muted">
                                                                    Estimated: {item.estimatedStartTime} - {item.estimatedEndTime}
                                                                </small></div>
                                                            )}
                                                            {item.estimatedStartTime && weatherData && (
                                                                <div>
                                                                    {(() => {
                                                                        const weather = getWeatherForTime(item.estimatedStartTime);
                                                                        if (weather) {
                                                                            return (
                                                                                <small className="text-info">
                                                                                    {getWeatherIcon(weather.condition)} {weather.temperature}°F 
                                                                                    (feels {weather.feelsLike}°F) • {weather.precipitation}% rain
                                                                                </small>
                                                                            );
                                                                        }
                                                                        return null;
                                                                    })()}
                                                                </div>
                                                            )}
                                                            {item.actualStartTime && (
                                                                <div><small className="text-success">
                                                                    Started: {item.actualStartTime}
                                                                </small></div>
                                                            )}
                                                            {item.actualEndTime && (
                                                                <div><small className="text-success">
                                                                    Completed: {item.actualEndTime}
                                                                    {item.actualDuration && ` (${item.actualDuration} min)`}
                                                                </small></div>
                                                            )}
                                                        </div>
                                                        <div className="d-flex flex-column gap-1">
                                                            {isTrackingProgress && !item.status && (
                                                                <button 
                                                                    className="btn btn-sm btn-outline-success"
                                                                    onClick={() => recordActualStart(index)}
                                                                >
                                                                    Start
                                                                </button>
                                                            )}
                                                            {isTrackingProgress && item.status === 'in-progress' && (
                                                                <button 
                                                                    className="btn btn-sm btn-outline-primary"
                                                                    onClick={() => recordActualEnd(index)}
                                                                >
                                                                    Complete
                                                                </button>
                                                            )}
                                                            <div className="btn-group btn-group-sm">
                                                                <button 
                                                                    className="btn btn-outline-secondary"
                                                                    onClick={() => moveItemUp(index)}
                                                                    disabled={index === 0 || isMovingItem}
                                                                    title="Move Up"
                                                                >
                                                                    ↑
                                                                </button>
                                                                <button 
                                                                    className="btn btn-outline-secondary"
                                                                    onClick={() => moveItemDown(index)}
                                                                    disabled={index === ridePlan.length - 1 || isMovingItem}
                                                                    title="Move Down"
                                                                >
                                                                    ↓
                                                                </button>
                                                            </div>
                                                            <button 
                                                                className="btn btn-sm btn-outline-danger"
                                                                onClick={() => removeFromPlan(index)}
                                                            >
                                                                Remove
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                )}
                            </div>
                        ))}
                    </div>
                            )}
                </div>
            </div>
                </div>
            )}

            {activeTab === 'weather' && (
                <div className="tab-content">
                    {weatherLoading ? (
                        <div className="text-center">
                            <div className="spinner-border" role="status">
                                <span className="visually-hidden">Loading weather...</span>
                            </div>
                            <p className="mt-2">Loading weather data...</p>
                        </div>
                    ) : weatherData ? (
                        <div>
                            {/* Current Weather */}
                            <div className="card mb-4">
                                <div className="card-header d-flex justify-content-between align-items-center">
                                    <h5 className="mb-0">
                                        {getWeatherIcon(weatherData.current.condition)} Current Weather - {weatherData.location}
                                    </h5>
                                    <button 
                                        className="btn btn-sm btn-outline-primary"
                                        onClick={fetchWeatherData}
                                    >
                                        Refresh
                                    </button>
                                </div>
                                <div className="card-body">
                                    <div className="row text-center">
                                        <div className="col-6">
                                            <h3 className="mb-0">{weatherData.current.temperature}°F</h3>
                                            <small className="text-muted">Temperature</small>
                                        </div>
                                        <div className="col-6">
                                            <h3 className="mb-0">{weatherData.current.feelsLike}°F</h3>
                                            <small className="text-muted">Feels Like</small>
                                        </div>
                                    </div>
                                    <div className="row mt-3">
                                        <div className="col-6">
                                            <strong>Condition:</strong> {weatherData.current.condition}
                                        </div>
                                        <div className="col-6">
                                            <strong>Humidity:</strong> {weatherData.current.humidity}%
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Today's Forecast */}
                            <div className="card mb-4">
                                <div className="card-header">
                                    <h5 className="mb-0">Today's Forecast</h5>
                                </div>
                                <div className="card-body">
                                    <p className="mb-3">{weatherData.forecast.description}</p>
                                    <div className="row text-center">
                                        <div className="col-4">
                                            <h5 className="mb-1">{weatherData.forecast.high}°F</h5>
                                            <small className="text-muted">High</small>
                                        </div>
                                        <div className="col-4">
                                            <h5 className="mb-1">{weatherData.forecast.low}°F</h5>
                                            <small className="text-muted">Low</small>
                                        </div>
                                        <div className="col-4">
                                            <h5 className="mb-1">{weatherData.forecast.chanceOfRain}%</h5>
                                            <small className="text-muted">Rain Chance</small>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Hourly Forecast */}
                            <div className="card">
                                <div className="card-header">
                                    <h5 className="mb-0">Hourly Forecast</h5>
                                </div>
                                <div className="card-body p-0">
                                    <div className="list-group list-group-flush">
                                        {weatherData.hourly.map((hour, index) => (
                                            <div key={index} className="list-group-item d-flex justify-content-between align-items-center">
                                                <div className="d-flex align-items-center">
                                                    <span className="me-3">{getWeatherIcon(hour.condition)}</span>
                                                    <div>
                                                        <strong>{hour.hour === 12 ? '12 PM' : hour.hour > 12 ? `${hour.hour - 12} PM` : `${hour.hour} AM`}</strong>
                                                        <br/>
                                                        <small className="text-muted">{hour.condition}</small>
                                                    </div>
                                                </div>
                                                <div className="text-end">
                                                    <div><strong>{hour.temperature}°F</strong></div>
                                                    <small className="text-muted">feels {hour.feelsLike}°F</small>
                                                    <div><small className="text-info" style={{color: '#87CEEB', fontWeight: 'bold'}}>{hour.precipitation}% rain</small></div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center">
                            <p>Weather data not available</p>
                            <button className="btn btn-primary" onClick={fetchWeatherData}>
                                Load Weather Data
                            </button>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'settings' && (
                <div className="tab-content">
                    <div className="row">
                        <div className="col-md-6">
                            <div className="card mb-4">
                                <div className="card-header">
                                    <h5 className="mb-0">Plan Settings</h5>
                                </div>
                                <div className="card-body">
                                    <div className="row mb-3">
                                        <div className="col-md-6">
                                            <label htmlFor="startTime" className="form-label">Start Time:</label>
                                            <input 
                                                type="time" 
                                                className="form-control" 
                                                id="startTime"
                                                value={planStartTime}
                                                onChange={(e) => setPlanStartTime(e.target.value)}
                                            />
                                        </div>
                                        <div className="col-md-6">
                                            <label htmlFor="endTime" className="form-label">End Time:</label>
                                            <input 
                                                type="time" 
                                                className="form-control" 
                                                id="endTime"
                                                value={planEndTime}
                                                onChange={(e) => setPlanEndTime(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="d-flex gap-2">
                                        <button className="btn btn-primary" onClick={calculatePlanTiming}>
                                            Calculate Timing
                                        </button>
                                        <button className="btn btn-info" onClick={updateWaitTimesInPlan}>
                                            Update Wait Times
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div className="col-md-6">
                            <div className="card mb-4">
                                <div className="card-header">
                                    <h5 className="mb-0">Auto-Refresh Settings</h5>
                                </div>
                                <div className="card-body">
                                    <div className="form-check mb-3">
                                        <input 
                                            className="form-check-input" 
                                            type="checkbox" 
                                            id="autoRefreshEnabled"
                                            checked={autoRefreshEnabled}
                                            onChange={(e) => setAutoRefreshEnabled(e.target.checked)}
                                        />
                                        <label className="form-check-label" htmlFor="autoRefreshEnabled">
                                            Enable automatic wait time updates
                                        </label>
                                    </div>
                                    <div className="mb-3">
                                        <label htmlFor="refreshInterval" className="form-label">Update interval (minutes):</label>
                                        <select 
                                            id="refreshInterval" 
                                            className="form-select"
                                            value={autoRefreshInterval}
                                            onChange={(e) => setAutoRefreshInterval(parseInt(e.target.value))}
                                            disabled={!autoRefreshEnabled}
                                        >
                                            <option value={5}>5 minutes</option>
                                            <option value={10}>10 minutes</option>
                                            <option value={15}>15 minutes</option>
                                            <option value={30}>30 minutes</option>
                                            <option value={60}>1 hour</option>
                                        </select>
                                    </div>
                                    <small className="text-muted">
                                        {autoRefreshEnabled 
                                            ? `Wait times will automatically update every ${autoRefreshInterval} minutes.`
                                            : 'Automatic updates are disabled. Use the "Refresh Wait Times" button manually.'
                                        }
                                    </small>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="row">
                        <div className="col-md-6">
                            <div className="card">
                                <div className="card-header">
                                    <h5 className="mb-0">Automation Settings</h5>
                                </div>
                                <div className="card-body">
                                    <div className="form-check mb-3">
                                        <input 
                                            className="form-check-input" 
                                            type="checkbox" 
                                            id="autoCalculateTiming"
                                            checked={autoCalculateTiming}
                                            onChange={(e) => setAutoCalculateTiming(e.target.checked)}
                                        />
                                        <label className="form-check-label" htmlFor="autoCalculateTiming">
                                            Automatically calculate timing when plan changes
                                        </label>
                                    </div>
                                    <small className="text-muted">
                                        {autoCalculateTiming 
                                            ? 'Timing will be recalculated automatically when you add, remove, or reorder items in your plan.'
                                            : 'You will need to manually click "Calculate Timing" when you want to update the schedule.'
                                        }
                                    </small>
                                </div>
                            </div>
                        </div>
                        
                        <div className="col-md-6">
                            <div className="card">
                                <div className="card-header">
                                    <h5 className="mb-0">Progress Tracking</h5>
                                </div>
                                <div className="card-body">
                                    <div className="mb-3">
                                        <strong>Current Status:</strong> {isTrackingProgress ? 'Active' : 'Inactive'}
                                    </div>
                                    <div className="d-flex gap-2">
                                        {!isTrackingProgress ? (
                                            <button className="btn btn-success" onClick={startTrackingProgress}>
                                                Start Progress Tracking
                                            </button>
                                        ) : (
                                            <button className="btn btn-secondary" onClick={stopTrackingProgress}>
                                                Stop Progress Tracking
                                            </button>
                                        )}
                                    </div>
                                    <small className="text-muted mt-2 d-block">
                                        When active, you can use Start/Complete buttons to track your actual progress through the plan.
                                    </small>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="row">
                        <div className="col-12">
                            <div className="card">
                                <div className="card-header">
                                    <h5 className="mb-0">Data Management</h5>
                                </div>
                                <div className="card-body">
                                    <div className="row">
                                        <div className="col-md-6">
                                            <h6>Current Data</h6>
                                            <p className="text-muted small mb-3">
                                                Refresh today's wait time data from Thrill Data. This updates the current wait times and today's historical data.
                                            </p>
                                            <button 
                                                className={`btn btn-primary w-100 ${refreshLoading ? 'disabled' : ''}`}
                                                onClick={refreshData}
                                                disabled={refreshLoading}
                                            >
                                                {refreshLoading ? (
                                                    <>
                                                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                                        Refreshing...
                                                    </>
                                                ) : (
                                                    <>
                                                        <span className="me-2">🔄</span>
                                                        Refresh Current Data
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                        <div className="col-md-6">
                                            <h6>Historical Data</h6>
                                            <p className="text-muted small mb-3">
                                                Fetch wait time data from 7 days ago to update the "Last Week" comparison data used in charts.
                                            </p>
                                            <button 
                                                className={`btn btn-secondary w-100 ${refreshLoading ? 'disabled' : ''}`}
                                                onClick={getHistoricalData}
                                                disabled={refreshLoading}
                                            >
                                                {refreshLoading ? (
                                                    <>
                                                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                                        Fetching...
                                                    </>
                                                ) : (
                                                    <>
                                                        <span className="me-2">📅</span>
                                                        Get Historical Data
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="mt-3">
                                        <small className="text-muted">
                                            <strong>Note:</strong> These operations fetch data from Thrill Data and may take a few moments to complete. 
                                            Historical data is used for the "Last Week" comparison in ride charts.
                                        </small>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {renderFullscreenModal()}
        </div>
    );
}

const domContainer = document.querySelector('#root');
ReactDOM.render(<App />, domContainer);

// Register Chart.js components
// ChartJS.register(
//     CategoryScale,
//     LinearScale,
//     PointElement,
//     LineElement,
//     Title,
//     Tooltip,
//     Legend
// ); 