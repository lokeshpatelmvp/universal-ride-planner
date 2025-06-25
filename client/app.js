import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Line, Bar } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    BarController,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import { DateTime } from 'luxon';
import config from './config.js';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    BarController,
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
    const [isWeatherLoading, setIsWeatherLoading] = useState(true);
    
    // New settings state
    const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
    const [autoRefreshInterval, setAutoRefreshInterval] = useState(15);
    const [refreshIntervalId, setRefreshIntervalId] = useState(null);

    // Initial data fetch
    useEffect(() => {
        fetchWaitTimes();
        fetchWeekAgoData(); // Fetch historical data separately
        fetchWeatherData();
    }, []);

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

    

    // Function to render detailed wait time profile sparkline
    const renderWaitTimeProfile = (todayData, weekAgoData, currentWaitTime, rideName, isFullscreen = false) => {
        // Clean and validate data
        const safeTodayData = (Array.isArray(todayData) ? todayData : []).filter(d => d && d.time && d.wait !== undefined);
        const safeWeekAgoData = (Array.isArray(weekAgoData) ? weekAgoData : []).filter(d => d && d.time && d.wait !== undefined);

        // Create unified timeline from BOTH datasets (not just today's)
        const allTimeLabels = [...new Set([
            ...safeTodayData.map(d => d.time), 
            ...safeWeekAgoData.map(d => d.time)
        ])];
        
        // Sort time labels chronologically
        allTimeLabels.sort((a, b) => {
            const timeToMinutes = (timeStr) => {
                const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/);
                if (!match) return 0;
                let hour = parseInt(match[1]);
                const minute = parseInt(match[2]);
                if (match[3] === 'PM' && hour !== 12) hour += 12;
                if (match[3] === 'AM' && hour === 12) hour = 0;
                return hour * 60 + minute;
            };
            return timeToMinutes(a) - timeToMinutes(b);
        });

        if (allTimeLabels.length === 0) {
            return (
                <div style={{ height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
                    No wait time data available.
                </div>
            );
        }

        // Create lookup maps for efficient data access
        const todayDataMap = new Map();
        safeTodayData.forEach(item => todayDataMap.set(item.time, item.wait));
        const weekAgoDataMap = new Map();
        safeWeekAgoData.forEach(item => weekAgoDataMap.set(item.time, item.wait));
        
        // Align data to unified timeline
        const todayDataAligned = allTimeLabels.map(time => todayDataMap.get(time) ?? null);
        const weekAgoDataAligned = allTimeLabels.map(time => weekAgoDataMap.get(time) ?? null);

        // Add weather data overlay
        const weatherDataAligned = allTimeLabels.map(time => {
            const weather = getWeatherForTime(time);
            return weather ? weather.precipitation : null;
        });

        // Check if we have any data to display
        const hasTodayData = todayDataAligned.some(v => v !== null);
        const hasWeekAgoData = weekAgoDataAligned.some(v => v !== null);
        const hasWeatherData = weatherDataAligned.some(v => v !== null);

        if (!hasTodayData && !hasWeekAgoData) {
            return (
                <div style={{ height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
                    No wait time data available.
                </div>
            );
        }

        // Create datasets
        const datasets = [];
        
        if (hasTodayData) {
            datasets.push({
                label: `Today (${currentWaitTime}m)`,
                data: todayDataAligned,
                borderColor: 'rgb(0, 0, 255)', // Darker blue
                backgroundColor: 'transparent', // No fill
                tension: 0.4,
                fill: false, // No fill
                pointRadius: 1,
                pointHoverRadius: 3,
                yAxisID: 'yWait',
            });
        }
        
        if (hasWeekAgoData) {
            datasets.push({
                label: '7 Days Ago',
                data: weekAgoDataAligned,
                borderColor: 'rgba(255, 99, 132, 0.5)',
                backgroundColor: 'transparent',
                tension: 0.4,
                borderDash: [5, 5],
                fill: false,
                pointRadius: 1,
                pointHoverRadius: 3,
                yAxisID: 'yWait',
            });
        }

        // Add weather overlay dataset
        if (hasWeatherData) {
            datasets.push({
                label: 'Rain %',
                data: weatherDataAligned,
                borderColor: 'rgba(0, 123, 255, 0.1)', // Very light blue border
                backgroundColor: 'rgba(0, 123, 255, 0.05)', // Very light blue background
                tension: 0.4,
                fill: true,
                pointRadius: 0,
                pointHoverRadius: 2,
                yAxisID: 'yWeather',
                order: 1, // Put weather behind wait times
            });
        }

        // Chart options
        const allData = [...todayDataAligned, ...weekAgoDataAligned].filter(d => d !== null);
        const maxWait = allData.length > 0 ? Math.max(...allData) : 60;
        
        // Adjust font sizes and spacing based on fullscreen mode
        const fontSize = isFullscreen ? 16 : 10;
        const legendFontSize = isFullscreen ? 14 : 11;
        const tickFontSize = isFullscreen ? 14 : 10;
        
        const chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { 
                    display: true, 
                    grid: { display: false },
                    ticks: { 
                        maxTicksLimit: isFullscreen ? 12 : 8, 
                        maxRotation: 0, 
                        font: { size: tickFontSize } 
                    }
                },
                yWait: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    grid: { display: true, color: 'rgba(0,0,0,0.05)' },
                    beginAtZero: true, 
                    max: Math.max(30, Math.ceil(maxWait / 10) * 10 + 15),
                    ticks: { 
                        font: { size: tickFontSize }, 
                        callback: value => value + 'm',
                        padding: isFullscreen ? 10 : 5
                    }
                },
                yWeather: {
                    type: 'linear',
                    display: false, // Hide weather axis
                    position: 'right',
                    beginAtZero: true,
                    max: 100,
                    grid: { display: false }
                }
            },
            plugins: {
                legend: { 
                    display: true,
                    position: 'top',
                    labels: { 
                        usePointStyle: true, 
                        boxWidth: isFullscreen ? 15 : 10, 
                        padding: isFullscreen ? 20 : 15, 
                        font: { size: legendFontSize } 
                    }
                },
                tooltip: {
                    enabled: true,
                    mode: 'index',
                    intersect: false,
                    titleFont: { size: isFullscreen ? 14 : 12 },
                    bodyFont: { size: isFullscreen ? 13 : 11 },
                    callbacks: {
                        label: context => {
                            if (context.parsed.y === null) {
                                return null;
                            }
                            if (context.dataset.label === 'Rain %') {
                                return `Rain: ${context.parsed.y}%`;
                            }
                            return `${context.dataset.label}: ${context.parsed.y} min`;
                        }
                    }
                },
            },
            interaction: { 
                intersect: false, 
                mode: 'index',
            },
            elements: {
                line: { borderWidth: isFullscreen ? 3 : 2.5 },
                point: {
                    radius: isFullscreen ? 2 : 1,
                    hoverRadius: isFullscreen ? 5 : 3
                }
            }
        };

        const chartData = { labels: allTimeLabels, datasets: datasets };

        const handleClick = () => {
            setFullscreenGraph({ rideName, currentWaitTime });
        };

        // If fullscreen, render without click handler and with larger height
        if (isFullscreen) {
            return (
                <div className="wait-time-profile" style={{ display: 'block', marginTop: '10px', marginBottom: '10px' }}>
                    <div style={{ width: '100%', height: '100%', minHeight: '400px' }}>
                        <Line data={chartData} options={chartOptions} />
                    </div>
                </div>
            );
        }

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
    
        const { rideName, currentWaitTime } = fullscreenGraph;
        
        // Get data for this specific ride
        const todayDataForRide = todayData[rideName] || [];
        const weekAgoDataForRide = weekAgoData[rideName] || [];
    
        return (
            <div className="modal" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.8)' }} onClick={() => setFullscreenGraph({ rideName: null, currentWaitTime: null })}>
                <div className="modal-content" style={{ maxWidth: '90%', margin: '5% auto', border: 'none', borderRadius: '10px' }} onClick={e => e.stopPropagation()}>
                    <div className="modal-header" style={{ borderBottom: '1px solid #dee2e6' }}>
                        <h5 className="modal-title">{rideName} - Wait Time Profile</h5>
                        <button type="button" className="btn-close" onClick={() => setFullscreenGraph({ rideName: null, currentWaitTime: null })}></button>
                    </div>
                    <div className="modal-body" style={{ height: '70vh', padding: '1rem' }}>
                        {/* Render the chart in fullscreen */}
                        {renderWaitTimeProfile(todayDataForRide, weekAgoDataForRide, currentWaitTime, rideName, true)}
                    </div>
                </div>
            </div>
        );
    };

    const fetchWaitTimes = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${config.apiBaseUrl}/api/wait-times/today`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            
            // Process today's data
            const processedData = {};
            if (data.rides) {
                data.rides.forEach(ride => {
                    if (ride.wait_times && Array.isArray(ride.wait_times)) {
                        processedData[ride.name] = ride.wait_times;
                    }
                });
            }
            
            // Filter out the "Average" ride and ensure all rides have proper data
            const filteredRides = (data.rides || []).filter(ride => ride.name !== 'Average').map(ride => ({
                ...ride,
                rideCount: rideCounts[ride.name] || 0
            }));
            
            setRides(filteredRides);
            setTodayData(processedData);
            setError(null);
        } catch (error) {
            console.error('Error fetching wait times:', error);
            setError('Failed to fetch wait times');
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
        // Get rides from current data
        const currentRides = rides.filter(ride => selectedLand === 'All Lands' || ride.land === selectedLand);
        
        // Get rides from historical data that might not be in current data
        const historicalRides = [];
        if (weekAgoData) {
            Object.keys(weekAgoData).forEach(rideName => {
                // Skip the "Average" ride
                if (rideName === 'Average') return;
                
                // Check if this ride is already in current rides
                const existingRide = currentRides.find(r => r.name === rideName);
                if (!existingRide) {
                    // Try to find land information from current rides
                    const landInfo = rides.find(r => r.name === rideName)?.land || 'Unknown';
                    
                    // Create a ride object from historical data
                    const historicalRide = {
                        name: rideName,
                        waitTime: null, // No current wait time
                        status: 'No Current Data',
                        land: landInfo,
                        rideCount: rideCounts[rideName] || 0
                    };
                    historicalRides.push(historicalRide);
                }
            });
        }
        
        // Combine current and historical rides
        const allRides = [...currentRides, ...historicalRides];
        
        // Filter by selected land (but include rides with unknown land if "All Lands" is selected)
        const filtered = allRides.filter(ride => 
            selectedLand === 'All Lands' || 
            ride.land === selectedLand || 
            (selectedLand === 'All Lands' && ride.land === 'Unknown')
        );
        
        // Debug logging
        console.log('Ride filtering debug:', {
            totalRides: rides.length,
            currentRides: currentRides.length,
            historicalRides: historicalRides.length,
            allRides: allRides.length,
            filtered: filtered.length,
            selectedLand,
            rideNames: filtered.map(r => r.name)
        });
        
        // In the ride planner, show ALL rides regardless of status (even down ones)
        // This allows users to plan for rides that might come back up
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
            } else if (ride.status === 'No Current Data') {
                return {
                    status: 'no-data',
                    text: 'No current data (use historical)',
                    color: 'secondary'
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
        
        // Use current wait time if available, otherwise use historical data or default
        let waitTime = ride.waitTime;
        if (!waitTime || ride.status === 'No Current Data') {
            // Try to get historical wait time for current time
            const now = new Date();
            const currentTime = now.toLocaleTimeString('en-US', { 
                hour: 'numeric', 
                minute: '2-digit',
                hour12: true 
            });
            const historicalWaitTime = getWaitTimeAtTime(ride.name, currentTime);
            waitTime = historicalWaitTime || 30; // Default to 30 minutes if no data
        }
        
        const rideTime = waitTime + 5; // Wait time + 5 minutes for actual ride
        newPlan.push({
            type: 'ride',
            name: ride.name,
            waitTime: waitTime,
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
        setIsWeatherLoading(true);
        try {
            const response = await fetch(`${config.apiBaseUrl}/api/weather`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();

            // Find the highest and lowest temp for the day from hourly data
            const todayHigh = Math.max(...data.hourly.map(h => h.temperature));
            const todayLow = Math.min(...data.hourly.map(h => h.temperature));

            // Find the max precipitation chance for the day
            const chanceOfRain = Math.max(...data.hourly.map(h => h.precipitation));

            setWeatherData({
                ...data,
                forecast: {
                    high: todayHigh,
                    low: todayLow,
                    chanceOfRain: chanceOfRain,
                    description: data.current.condition, // Simple description for now
                }
            });
        } catch (error) {
            console.error("Error fetching weather data:", error);
        } finally {
            setIsWeatherLoading(false);
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
            console.log("🔄 Refreshing data from Thrill Data...");
            const response = await fetch(`${config.apiBaseUrl}/api/refresh-data`, {
                method: 'POST',
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('Refresh result:', result);
            
            // Now fetch the updated data
            await fetchWaitTimes();
            await fetchWeekAgoData();
            
        } catch (error) {
            console.error('Error refreshing data:', error);
            setError('Failed to refresh data: ' + error.message);
        } finally {
            setRefreshLoading(false);
        }
    };

    const fetchWeekAgoData = async () => {
        try {
            const response = await fetch(`${config.apiBaseUrl}/api/wait-times/last-week`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            
            // Process historical data into the same format as today's data
            const processedData = {};
            if (data.rides) {
                data.rides.forEach(ride => {
                    if (ride.wait_times && Array.isArray(ride.wait_times)) {
                        processedData[ride.name] = ride.wait_times;
                    }
                });
            }
            
            setWeekAgoData(processedData);
            setLastWeekData(data);
        } catch (error) {
            console.error('Error fetching week ago data:', error);
            setWeekAgoData({});
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
                        className={`nav-link ${activeTab === 'settings' ? 'active' : ''}`}
                        onClick={() => setActiveTab('settings')}
                        type="button"
                    >
                        Settings & Weather
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
                                                    {renderWaitTimeProfile(todayArr, weekAgoArr, ride.waitTime, ride.name)}
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

            {/* Weather Section */}
            <div className="row">
                <div className="col-12">
                    <div className="card">
                        <div className="card-header">
                            <h5 className="mb-0">Weather Information</h5>
                        </div>
                        <div className="card-body">
                            {isWeatherLoading ? (
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
                                            <h6 className="mb-0">
                                                {getWeatherIcon(weatherData.current.condition)} Current Weather - Universal Studios
                                            </h6>
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
                                                    <h4 className="mb-0">{weatherData.current.temperature}°F</h4>
                                                    <small className="text-muted">Temperature</small>
                                                </div>
                                                <div className="col-6">
                                                    <h4 className="mb-0">{weatherData.current.feelsLike}°F</h4>
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
                                            <h6 className="mb-0">Today's Forecast</h6>
                                        </div>
                                        <div className="card-body">
                                            <p className="mb-3">{weatherData.forecast.description}</p>
                                            <div className="row text-center">
                                                <div className="col-4">
                                                    <h6 className="mb-1">{weatherData.forecast.high}°F</h6>
                                                    <small className="text-muted">High</small>
                                                </div>
                                                <div className="col-4">
                                                    <h6 className="mb-1">{weatherData.forecast.low}°F</h6>
                                                    <small className="text-muted">Low</small>
                                                </div>
                                                <div className="col-4">
                                                    <h6 className="mb-1">{weatherData.forecast.chanceOfRain}%</h6>
                                                    <small className="text-muted">Rain Chance</small>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Hourly Forecast */}
                                    <div className="card">
                                        <div className="card-header">
                                            <h6 className="mb-0">Hourly Forecast</h6>
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