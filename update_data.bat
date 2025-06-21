@echo off
echo Updating Universal Studios wait time data...
echo.
cd /d "C:\Users\LokeshPatel\Desktop\Universal"
python extract_today_data.py
echo.
echo Data update complete!
pause 