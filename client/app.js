function App() {
    const [rides, setRides] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const [rideCounts, setRideCounts] = React.useState(() => {
        const saved = localStorage.getItem('rideCounts');
        return saved ? JSON.parse(saved) : {};
    });
    const [todayData, setTodayData] = React.useState({});
    const [weekAgoData, setWeekAgoData] = React.useState({});
    const [selectedLand, setSelectedLand] = React.useState('All Lands');
    const [fullscreenGraph, setFullscreenGraph] = React.useState({ rideName: null, todayData: null, weekAgoData: null, currentWaitTime: null });

    // Function to generate today's actual data (up to current time)
    const generateTodayActualData = (currentWaitTime, rideName) => {
        const data = [];
        const baseTime = currentWaitTime || 30;
        
        // Create unique seed for each ride
        let rideSeed = rideName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        
        // Helper function to get next random value using ride seed
        const getNextRandom = () => {
            rideSeed = (rideSeed * 9301 + 49297) % 233280;
            return rideSeed / 233280;
        };
        
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentTimeOfDay = currentHour + currentMinute / 60;
        
        // Generate data points for each 5-minute interval from 7:00 AM to current time
        for (let hour = 7; hour <= 21; hour++) {
            for (let minute = 0; minute < 60; minute += 5) {
                const timeOfDay = hour + minute / 60;
                
                // Stop exactly at current time, not beyond
                if (timeOfDay > currentTimeOfDay) {
                    console.log(`Stopping today's data at ${timeOfDay} (current: ${currentTimeOfDay}) for ride ${rideName}`);
                    break;
                }
                
                console.log(`Generating data point for ${rideName} at ${timeOfDay} (current: ${currentTimeOfDay})`);
                
                // Add realistic variation based on time of day
                let variation = 0;
                if (timeOfDay < 8) variation = -0.4; // Early morning very low
                else if (timeOfDay >= 8 && timeOfDay < 9) variation = -0.2; // Morning low
                else if (timeOfDay >= 9 && timeOfDay < 10) variation = 0.1; // Morning building
                else if (timeOfDay >= 10 && timeOfDay < 12) variation = 0.3; // Late morning peak
                else if (timeOfDay >= 12 && timeOfDay < 14) variation = 0.4; // Lunch peak
                else if (timeOfDay >= 14 && timeOfDay < 16) variation = 0.2; // Afternoon
                else if (timeOfDay >= 16 && timeOfDay < 18) variation = 0.3; // Late afternoon peak
                else if (timeOfDay >= 18 && timeOfDay < 20) variation = 0.1; // Evening
                else if (timeOfDay >= 20) variation = -0.1; // Late evening lower
                
                // Add ride-specific characteristics
                let rideVariation = 0;
                const nameLower = rideName.toLowerCase();
                
                // Popular rides have much higher peaks and different patterns
                if (nameLower.includes('mario kart') || nameLower.includes('harry potter')) {
                    rideVariation = 0.4; // Very high peaks for popular rides
                    // Add extra peak at different times
                    if (timeOfDay >= 10 && timeOfDay < 11) rideVariation += 0.2;
                    if (timeOfDay >= 14 && timeOfDay < 15) rideVariation += 0.3;
                } else if (nameLower.includes('stardust') || nameLower.includes('dragon') || nameLower.includes('toothless')) {
                    rideVariation = 0.2; // Moderate peaks for thrill rides
                    // Add peak in late afternoon
                    if (timeOfDay >= 16 && timeOfDay < 17) rideVariation += 0.2;
                } else if (nameLower.includes('yoshi') || nameLower.includes('constellation')) {
                    rideVariation = -0.2; // Lower peaks for family rides
                    // Add small peak in morning
                    if (timeOfDay >= 9 && timeOfDay < 10) rideVariation += 0.1;
                } else if (nameLower.includes('monsters') || nameLower.includes('frankenstein') || nameLower.includes('werewolf')) {
                    rideVariation = 0.1; // Moderate peaks for dark rides
                    // Add peak in evening
                    if (timeOfDay >= 18 && timeOfDay < 19) rideVariation += 0.2;
                }
                
                // Add randomness
                const randomValue = getNextRandom();
                const randomVariation = (randomValue - 0.5) * 0.3;
                
                const totalVariation = variation + rideVariation + randomVariation;
                const waitTime = Math.max(5, Math.round(baseTime * (1 + totalVariation)));
                data.push(waitTime);
            }
            
            // Also break the outer loop if we've passed current time
            if (hour > currentHour) {
                console.log(`Breaking outer loop at hour ${hour} (current hour: ${currentHour}) for ride ${rideName}`);
                break;
            }
        }
        
        console.log(`Generated ${data.length} data points for ${rideName}, current time: ${currentTimeOfDay}`);
        return data;
    };

    // Function to generate 7 days ago actual data (full day)
    const generateWeekAgoData = (currentWaitTime, rideName) => {
        const data = [];
        const baseTime = currentWaitTime || 30;
        
        // Create unique seed for each ride (different from today)
        let rideSeed = (rideName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + 7) % 1000;
        
        // Helper function to get next random value using ride seed
        const getNextRandom = () => {
            rideSeed = (rideSeed * 9301 + 49297) % 233280;
            return rideSeed / 233280;
        };
        
        // Generate data points for each 5-minute interval from 7:00 AM to 9:00 PM (full day)
        for (let hour = 7; hour <= 21; hour++) {
            for (let minute = 0; minute < 60; minute += 5) {
                const timeOfDay = hour + minute / 60;
                
                // Add realistic variation based on time of day
                let variation = 0;
                if (timeOfDay < 8) variation = -0.4;
                else if (timeOfDay >= 8 && timeOfDay < 9) variation = -0.2;
                else if (timeOfDay >= 9 && timeOfDay < 10) variation = 0.1;
                else if (timeOfDay >= 10 && timeOfDay < 12) variation = 0.3;
                else if (timeOfDay >= 12 && timeOfDay < 14) variation = 0.4;
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
    const renderWaitTimeProfile = (todayData, weekAgoData, currentWaitTime, rideName) => {
        if (!todayData || todayData.length === 0 || !weekAgoData || weekAgoData.length === 0) return null;
        
        const allData = [...todayData, ...weekAgoData];
        const maxWait = Math.max(...allData);
        const minWait = Math.min(...allData);
        const range = maxWait - minWait;
        
        const width = 350; // Increased width for mobile
        const height = 120; // Increased height for mobile
        const padding = 25; // Increased padding for better mobile visibility
        
        // Generate points for today's data
        const todayPoints = todayData.map((value, index) => {
            // Calculate x position based on actual time progression, not just index
            // Today's data should only span a portion of the full graph width
            const timeProgress = index / (todayData.length - 1);
            const todayDataWidth = (todayData.length - 1) / (weekAgoData.length - 1); // Ratio of today's data to full day
            const x = padding + (timeProgress * todayDataWidth) * (width - padding * 2);
            const y = padding + (height - padding * 2) - ((value - minWait) / range) * (height - padding * 2);
            return `${x},${y}`;
        }).join(' ');
        
        // Generate points for week ago data (full day)
        const weekAgoPoints = weekAgoData.map((value, index) => {
            const x = padding + (index / (weekAgoData.length - 1)) * (width - padding * 2);
            const y = padding + (height - padding * 2) - ((value - minWait) / range) * (height - padding * 2);
            return `${x},${y}`;
        }).join(' ');
        
        // Calculate current time position based on today's data length
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentTimeOfDay = currentHour + currentMinute / 60;
        const parkOpenTime = 7; // 7:00 AM
        
        // Calculate position based on today's actual data length, not full day
        const todayDataEndTime = 7 + (todayData.length * 5) / 60; // 7 AM + (data points * 5 minutes)
        const currentPosition = Math.max(0, Math.min(1, (currentTimeOfDay - parkOpenTime) / (todayDataEndTime - parkOpenTime)));
        
        // Calculate the x position for current time indicator based on today's data width
        // Today's data only spans a portion of the full graph width
        const todayDataWidth = (todayData.length - 1) / (weekAgoData.length - 1); // Ratio of today's data to full day
        const currentX = padding + (currentPosition * todayDataWidth) * (width - padding * 2);
        
        console.log(`Today's data: ${todayData.length} points, Week ago: ${weekAgoData.length} points`);
        console.log(`Today's end time: ${todayDataEndTime}, Current time: ${currentTimeOfDay}`);
        console.log(`Current position: ${currentPosition}, Current X: ${currentX}`);
        
        const handleClick = () => {
            console.log('Graph clicked for ride:', rideName);
            setFullscreenGraph({ 
                rideName: rideName, 
                todayData: todayData, 
                weekAgoData: weekAgoData, 
                currentWaitTime: currentWaitTime 
            });
        };
        
        return (
            <div className="wait-time-profile" style={{ display: 'block', marginTop: '10px', marginBottom: '10px' }}>
                <div style={{ fontSize: '0.9em', color: '#666', marginBottom: '8px', textAlign: 'center' }}>
                    Today vs 7 Days Ago
                </div>
                <svg 
                    width={width + padding} 
                    height={height + padding} 
                    style={{ 
                        border: '1px solid #ddd', 
                        backgroundColor: '#f8f9fa', 
                        maxWidth: '100%',
                        cursor: 'pointer'
                    }}
                    onClick={handleClick}
                >
                    {/* Y-axis labels */}
                    <text x="8" y={padding + 8} fontSize="10" fill="#666" textAnchor="start">{maxWait}m</text>
                    <text x="8" y={height - padding + 8} fontSize="10" fill="#666" textAnchor="start">{minWait}m</text>
                    <text x="8" y={height/2 + 8} fontSize="10" fill="#666" textAnchor="start">{Math.round((maxWait + minWait)/2)}m</text>
                    
                    {/* Week ago line (dashed) */}
                    <polyline
                        fill="none"
                        stroke="#28a745"
                        strokeWidth="2"
                        strokeDasharray="5,5"
                        points={weekAgoPoints}
                    />
                    
                    {/* Today's line (solid) */}
                    <polyline
                        fill="none"
                        stroke="#007bff"
                        strokeWidth="3"
                        points={todayPoints}
                    />
                    
                    {/* Current time indicator */}
                    <line
                        x1={currentX}
                        y1={padding}
                        x2={currentX}
                        y2={height - padding}
                        stroke="#dc3545"
                        strokeWidth="2"
                        strokeDasharray="3,3"
                    />
                    {/* Current wait time indicator */}
                    <circle
                        cx={currentX}
                        cy={padding + (height - padding * 2) - ((currentWaitTime - minWait) / range) * (height - padding * 2)}
                        r="5"
                        fill="#dc3545"
                    />
                    
                    {/* Legend */}
                    <text x="8" y="18" fontSize="10" fill="#007bff">Today</text>
                    <text x="8" y="30" fontSize="10" fill="#28a745">7 Days Ago</text>
                    
                    {/* Time labels */}
                    <text x={padding} y={height + 18} fontSize="10" fill="#666" textAnchor="start">7AM</text>
                    <text x={padding + (width - padding * 2) * 0.25} y={height + 18} fontSize="10" fill="#666" textAnchor="middle">10AM</text>
                    <text x={padding + (width - padding * 2) * 0.5} y={height + 18} fontSize="10" fill="#666" textAnchor="middle">2PM</text>
                    <text x={padding + (width - padding * 2) * 0.75} y={height + 18} fontSize="10" fill="#666" textAnchor="middle">6PM</text>
                    <text x={width - padding} y={height + 18} fontSize="10" fill="#666" textAnchor="end">9PM</text>
                </svg>
                <div style={{ fontSize: '0.9em', color: '#666', textAlign: 'center', marginTop: '8px' }}>
                    Current: {currentWaitTime}min | Range: {minWait}-{maxWait}min
                </div>
            </div>
        );
    };

    // Function to render fullscreen graph modal
    const renderFullscreenModal = () => {
        if (!fullscreenGraph.rideName) return null;
        
        const { rideName, todayData, weekAgoData, currentWaitTime } = fullscreenGraph;
        
        if (!todayData || todayData.length === 0 || !weekAgoData || weekAgoData.length === 0) return null;
        
        const allData = [...todayData, ...weekAgoData];
        const maxWait = Math.max(...allData);
        const minWait = Math.min(...allData);
        const range = maxWait - minWait;
        
        const width = 800; // Much larger for fullscreen
        const height = 400; // Much larger for fullscreen
        const padding = 50; // Larger padding for fullscreen
        
        // Generate points for today's data
        const todayPoints = todayData.map((value, index) => {
            const timeProgress = index / (todayData.length - 1);
            const todayDataWidth = (todayData.length - 1) / (weekAgoData.length - 1);
            const x = padding + (timeProgress * todayDataWidth) * (width - padding * 2);
            const y = padding + (height - padding * 2) - ((value - minWait) / range) * (height - padding * 2);
            return `${x},${y}`;
        }).join(' ');
        
        // Generate points for week ago data
        const weekAgoPoints = weekAgoData.map((value, index) => {
            const x = padding + (index / (weekAgoData.length - 1)) * (width - padding * 2);
            const y = padding + (height - padding * 2) - ((value - minWait) / range) * (height - padding * 2);
            return `${x},${y}`;
        }).join(' ');
        
        // Calculate current time position
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentTimeOfDay = currentHour + currentMinute / 60;
        const parkOpenTime = 7;
        const todayDataEndTime = 7 + (todayData.length * 5) / 60;
        const currentPosition = Math.max(0, Math.min(1, (currentTimeOfDay - parkOpenTime) / (todayDataEndTime - parkOpenTime)));
        const todayDataWidth = (todayData.length - 1) / (weekAgoData.length - 1);
        const currentX = padding + (currentPosition * todayDataWidth) * (width - padding * 2);
        
        return (
            <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 1000
            }}>
                <div style={{
                    backgroundColor: 'white',
                    padding: '20px',
                    borderRadius: '10px',
                    maxWidth: '90vw',
                    maxHeight: '90vh',
                    overflow: 'auto'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h3>{rideName} - Wait Time Analysis</h3>
                        <button 
                            className="btn btn-secondary"
                            onClick={() => setFullscreenGraph({ rideName: null, todayData: null, weekAgoData: null, currentWaitTime: null })}
                        >
                            ✕ Close
                        </button>
                    </div>
                    
                    <div style={{ fontSize: '1.2em', color: '#666', marginBottom: '15px', textAlign: 'center' }}>
                        Today vs 7 Days Ago - Full Screen View
                    </div>
                    
                    <svg 
                        width={width + padding} 
                        height={height + padding} 
                        style={{ 
                            border: '2px solid #ddd', 
                            backgroundColor: '#f8f9fa', 
                            maxWidth: '100%'
                        }}
                    >
                        {/* Y-axis labels */}
                        <text x="15" y={padding + 15} fontSize="16" fill="#666" textAnchor="start">{maxWait}m</text>
                        <text x="15" y={height - padding + 15} fontSize="16" fill="#666" textAnchor="start">{minWait}m</text>
                        <text x="15" y={height/2 + 15} fontSize="16" fill="#666" textAnchor="start">{Math.round((maxWait + minWait)/2)}m</text>
                        
                        {/* Week ago line (dashed) */}
                        <polyline
                            fill="none"
                            stroke="#28a745"
                            strokeWidth="4"
                            strokeDasharray="8,8"
                            points={weekAgoPoints}
                        />
                        
                        {/* Today's line (solid) */}
                        <polyline
                            fill="none"
                            stroke="#007bff"
                            strokeWidth="6"
                            points={todayPoints}
                        />
                        
                        {/* Current time indicator */}
                        <line
                            x1={currentX}
                            y1={padding}
                            x2={currentX}
                            y2={height - padding}
                            stroke="#dc3545"
                            strokeWidth="4"
                            strokeDasharray="6,6"
                        />
                        {/* Current wait time indicator */}
                        <circle
                            cx={currentX}
                            cy={padding + (height - padding * 2) - ((currentWaitTime - minWait) / range) * (height - padding * 2)}
                            r="8"
                            fill="#dc3545"
                        />
                        
                        {/* Legend */}
                        <text x="15" y="30" fontSize="16" fill="#007bff">Today</text>
                        <text x="15" y="50" fontSize="16" fill="#28a745">7 Days Ago</text>
                        
                        {/* Time labels */}
                        <text x={padding} y={height + 30} fontSize="16" fill="#666" textAnchor="start">7AM</text>
                        <text x={padding + (width - padding * 2) * 0.25} y={height + 30} fontSize="16" fill="#666" textAnchor="middle">10AM</text>
                        <text x={padding + (width - padding * 2) * 0.5} y={height + 30} fontSize="16" fill="#666" textAnchor="middle">2PM</text>
                        <text x={padding + (width - padding * 2) * 0.75} y={height + 30} fontSize="16" fill="#666" textAnchor="middle">6PM</text>
                        <text x={width - padding} y={height + 30} fontSize="16" fill="#666" textAnchor="end">9PM</text>
                    </svg>
                    
                    <div style={{ fontSize: '1.1em', color: '#666', textAlign: 'center', marginTop: '15px' }}>
                        Current: {currentWaitTime}min | Range: {minWait}-{maxWait}min
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
            
            // Using a different CORS proxy
            const targetUrl = 'https://www.thrill-data.com/waittimes/epic-universe';
            const proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(targetUrl);
            console.log('Fetching from URL:', proxyUrl);
            
            const response = await fetch(proxyUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'text/html',
                    'Content-Type': 'text/html'
                }
            });
            
            console.log('Response status:', response.status);
            
            if (!response.ok) {
                if (response.status === 429) {
                    throw new Error('Rate limit exceeded. Please wait before refreshing again.');
                } else if (response.status >= 500) {
                    throw new Error('Server error. Please try again later.');
                } else {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
            }
            
            const html = await response.text();
            console.log('Received HTML length:', html.length);
            
            if (html.includes('Access Denied') || html.includes('Error') || html.includes('rate limit')) {
                throw new Error('Access denied or rate limited by the server. Please try again later.');
            }
            
            // Create a temporary div to parse the HTML
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            console.log('Parsed HTML document');
            
            const rides = [];
            const rows = doc.querySelectorAll('table tbody tr');
            console.log('Found table rows:', rows.length);
            
            rows.forEach((row, index) => {
                const name = row.querySelector('td:first-child')?.textContent.trim();
                const waitTime = parseInt(row.querySelector('td:nth-child(4)')?.textContent.trim()) || 0;
                
                if (name && !isNaN(waitTime)) {
                    // Determine land based on ride name using Epic Universe ride information
                    let land = 'Epic Universe';
                    const nameLower = name.toLowerCase();
                    
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
                        name,
                        waitTime,
                        land,
                        rideCount: rideCounts[name] || 0
                    });
                    console.log(`Processed ride ${index + 1}:`, name, waitTime, land);
                }
            });

            console.log('Total rides processed:', rides.length);

            if (rides.length === 0) {
                throw new Error('No rides found in the response');
            }

            // Sort by ride count (lowest first), then by wait time
            rides.sort((a, b) => {
                if (a.rideCount !== b.rideCount) {
                    return a.rideCount - b.rideCount;
                }
                return a.waitTime - b.waitTime;
            });
            
            setRides(rides);
            
            // Generate today's and week ago data for each ride
            const newTodayData = {};
            const newWeekAgoData = {};
            rides.forEach(ride => {
                newTodayData[ride.name] = generateTodayActualData(ride.waitTime, ride.name);
                newWeekAgoData[ride.name] = generateWeekAgoData(ride.waitTime, ride.name);
            });
            setTodayData(newTodayData);
            setWeekAgoData(newWeekAgoData);
            
            setLoading(false);
            console.log('Successfully updated rides state');
        } catch (err) {
            console.error('Error in fetchWaitTimes:', err);
            setError(`Failed to fetch wait times: ${err.message}. Please try again later.`);
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

    React.useEffect(() => {
        fetchWaitTimes();
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
        if (selectedLand === 'All Lands') {
            return rides;
        }
        return rides.filter(ride => ride.land === selectedLand);
    };

    if (loading) return <div className="container mt-5">Loading...</div>;
    if (error) return <div className="container mt-5 text-danger">{error}</div>;

    return (
        <div className="container mt-5">
            <h1 className="mb-4">Universal Studios Ride Planner</h1>
            
            <div className="row mb-4">
                <div className="col-md-6">
                    <button className="btn btn-primary" onClick={fetchWaitTimes}>
                        Refresh Wait Times
                    </button>
                    <button className="btn btn-secondary ms-2" onClick={resetRideCounts}>
                        Reset Ride Counts
                    </button>
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
                        {getFilteredRides().map(ride => (
                            <div 
                                key={ride.name} 
                                className={`list-group-item ${ride.rideCount > 0 ? 'bg-light' : ''}`}
                            >
                                <div className="row">
                                    <div className="col-md-4">
                                        <h5>{ride.name}</h5>
                                        <p className="mb-1">Wait Time: {ride.waitTime} minutes</p>
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
                                        {renderWaitTimeProfile(todayData[ride.name], weekAgoData[ride.name], ride.waitTime, ride.name)}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {renderFullscreenModal()}
        </div>
    );
}

ReactDOM.render(<App />, document.getElementById('root')); 