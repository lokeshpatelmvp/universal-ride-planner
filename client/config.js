// Configuration for API endpoints
const config = {
  // Use Railway backend for production, localhost for development
  apiBaseUrl: process.env.NODE_ENV === 'production' 
    ? 'https://universal-ride-planner-production.up.railway.app' // Railway backend
    : 'http://localhost:5000'
};

export default config; 