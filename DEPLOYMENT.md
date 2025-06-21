# Deployment Guide

## Frontend (GitHub Pages)
The frontend is already configured to deploy to GitHub Pages via GitHub Actions.

## Backend Deployment Options

### Option 1: Heroku (Recommended)
1. Create a Heroku account at https://heroku.com
2. Install Heroku CLI
3. Run these commands:
```bash
heroku login
heroku create your-universal-backend
git add .
git commit -m "Add Heroku deployment"
git push heroku main
```
4. Update `client/config.js` with your Heroku URL

### Option 2: Railway
1. Go to https://railway.app
2. Connect your GitHub repository
3. Deploy the backend
4. Update `client/config.js` with your Railway URL

### Option 3: Render
1. Go to https://render.com
2. Create a new Web Service
3. Connect your GitHub repository
4. Set build command: `npm install`
5. Set start command: `node server.js`
6. Update `client/config.js` with your Render URL

## Environment Variables
Make sure to set these environment variables in your backend deployment:
- `PORT` (usually set automatically)
- Any API keys your backend needs

## Testing
1. Deploy the backend first
2. Update the URL in `client/config.js`
3. Push to GitHub to trigger frontend deployment
4. Test the deployed app

## Troubleshooting
- If you get CORS errors, make sure your backend allows requests from your GitHub Pages domain
- If the API calls fail, check that your backend URL is correct in `config.js` 