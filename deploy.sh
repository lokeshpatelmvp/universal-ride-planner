#!/bin/bash

# Initialize git repository
git init

# Add all files
git add .

# Commit changes
git commit -m "Initial commit"

# Add GitHub repository as remote (replace with your repository URL)
git remote add origin https://github.com/YOUR_USERNAME/universal-ride-planner.git

# Push to GitHub
git push -u origin main 