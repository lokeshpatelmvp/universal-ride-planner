function App() {
    const [rides, setRides] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const [completedRides, setCompletedRides] = React.useState(() => {
        const saved = localStorage.getItem('completedRides');
        return saved ? new Set(JSON.parse(saved)) : new Set();
    });

    const fetchWaitTimes = async () => {
        try {
            // Using a CORS proxy to access the wait times
            const response = await fetch('https://api.allorigins.win/raw?url=' + 
                encodeURIComponent('https://www.thrill-data.com/waittimes/epic-universe'));
            const html = await response.text();
            
            // Parse the HTML using a simple regex approach
            const rides = [];
            const rideRegex = /<tr[^>]*>.*?<td[^>]*>([^<]+)<\/td>.*?<td[^>]*>([^<]+)<\/td>.*?<td[^>]*>([^<]+)<\/td>.*?<td[^>]*>(\d+)<\/td>/gs;
            let match;
            
            while ((match = rideRegex.exec(html)) !== null) {
                const name = match[1].trim();
                const heightReq = match[2].trim();
                const waitTime = parseInt(match[4]) || 0;
                
                if (name && !isNaN(waitTime)) {
                    rides.push({
                        name,
                        waitTime,
                        heightReq,
                        completed: completedRides.has(name)
                    });
                }
            }

            // Sort by wait time
            rides.sort((a, b) => a.waitTime - b.waitTime);
            setRides(rides);
            setLoading(false);
        } catch (err) {
            setError('Failed to fetch wait times. Please check your internet connection.');
            setLoading(false);
        }
    };

    const markRideComplete = (rideName) => {
        const newCompletedRides = new Set(completedRides);
        newCompletedRides.add(rideName);
        setCompletedRides(newCompletedRides);
        localStorage.setItem('completedRides', JSON.stringify(Array.from(newCompletedRides)));
        
        // Update rides state
        setRides(rides.map(ride => 
            ride.name === rideName ? { ...ride, completed: true } : ride
        ));
    };

    const resetRides = () => {
        setCompletedRides(new Set());
        localStorage.removeItem('completedRides');
        setRides(rides.map(ride => ({ ...ride, completed: false })));
    };

    React.useEffect(() => {
        fetchWaitTimes();
        const interval = setInterval(fetchWaitTimes, 60000); // Update every minute
        return () => clearInterval(interval);
    }, []);

    const getNextRides = () => {
        return rides
            .filter(ride => !ride.completed)
            .slice(0, 3);
    };

    if (loading) return <div className="container mt-5">Loading...</div>;
    if (error) return <div className="container mt-5 text-danger">{error}</div>;

    return (
        <div className="container mt-5">
            <h1 className="mb-4">Universal Studios Ride Planner</h1>
            
            <div className="row mb-4">
                <div className="col">
                    <button className="btn btn-primary" onClick={fetchWaitTimes}>
                        Refresh Wait Times
                    </button>
                    <button className="btn btn-secondary ms-2" onClick={resetRides}>
                        Reset Completed Rides
                    </button>
                </div>
            </div>

            <div className="row">
                <div className="col-md-6">
                    <h2>Next Best Rides</h2>
                    <div className="list-group">
                        {getNextRides().map(ride => (
                            <div key={ride.name} className="list-group-item">
                                <h5>{ride.name}</h5>
                                <p>Wait Time: {ride.waitTime} minutes</p>
                                <p>Height Requirement: {ride.heightReq}</p>
                                <button 
                                    className="btn btn-success"
                                    onClick={() => markRideComplete(ride.name)}
                                >
                                    Mark as Complete
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="col-md-6">
                    <h2>All Rides</h2>
                    <div className="list-group">
                        {rides.map(ride => (
                            <div 
                                key={ride.name} 
                                className={`list-group-item ${ride.completed ? 'bg-light' : ''}`}
                            >
                                <h5>{ride.name}</h5>
                                <p>Wait Time: {ride.waitTime} minutes</p>
                                <p>Height Requirement: {ride.heightReq}</p>
                                {!ride.completed && (
                                    <button 
                                        className="btn btn-success"
                                        onClick={() => markRideComplete(ride.name)}
                                    >
                                        Mark as Complete
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

ReactDOM.render(<App />, document.getElementById('root')); 