# Universal Studios Ride Planner

A web application that helps you plan your Universal Studios visit by tracking ride wait times and suggesting the best next rides to visit.

## Features

- Real-time wait time updates from Thrill Data
- Track completed rides (saved on your device)
- Get suggestions for the next best rides to visit
- View all rides with their current wait times
- Reset completed rides
- Mobile-friendly interface
- Works offline after initial load
- No server required - runs entirely in your browser

## How to Use on Your Phone

1. Visit the deployed website (you'll need the URL from the developer)
2. The app will work immediately in your phone's browser
3. No installation required
4. Your completed rides are saved on your device
5. Wait times update automatically every minute
6. Works with any modern mobile browser (Chrome, Safari, Firefox, etc.)

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

## Running the Application

1. Start the backend server:
   ```bash
   npm start
   ```

2. Open the `client/index.html` file in your web browser

## Usage

1. The application will automatically fetch wait times when loaded
2. Wait times are updated every minute
3. Click "Mark as Complete" when you've finished a ride
4. The "Next Best Rides" section will show the top 3 rides with the shortest wait times that you haven't completed yet
5. Use the "Reset Completed Rides" button to start over
6. Click "Refresh Wait Times" to manually update the wait times

## Technical Details

- Frontend: React with Bootstrap for styling
- Data Source: Thrill Data wait times
- Storage: Local browser storage
- Real-time updates every minute
- No server required - runs entirely in your browser 