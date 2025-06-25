const axios = require('axios');

// Test the weather API endpoint
async function testWeatherAPI() {
    try {
        console.log('Testing weather API...');
        
        // Test the deployed Railway backend
        const response = await axios.get('https://universal-ride-planner-production.up.railway.app/api/weather');
        console.log('✅ Weather API is working!');
        console.log('Response:', response.data);
        
    } catch (error) {
        console.log('❌ Weather API test failed');
        console.log('Error:', error.response ? error.response.data : error.message);
        console.log('\nThis is likely because the WEATHER_API_KEY environment variable is not set on Railway.');
        console.log('\nTo fix this:');
        console.log('1. Get a free API key from OpenWeatherMap: https://openweathermap.org/api');
        console.log('2. Go to your Railway project dashboard');
        console.log('3. Navigate to Variables tab');
        console.log('4. Add a new variable: WEATHER_API_KEY = your_api_key_here');
        console.log('5. Redeploy the app');
    }
}

testWeatherAPI(); 