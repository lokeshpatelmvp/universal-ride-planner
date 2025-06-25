@echo off
echo Generating Historical Wait Time Data...
echo.

REM Activate virtual environment if it exists
if exist ".venv\Scripts\activate.bat" (
    call .venv\Scripts\activate.bat
    echo Virtual environment activated.
) else (
    echo No virtual environment found, using system Python.
)

REM Get today's date in YYYY-MM-DD format
for /f "tokens=2 delims==" %%a in ('wmic OS Get localdatetime /value') do set "dt=%%a"
set "today=%dt:~0,4%-%dt:~4,2%-%dt:~6,2%"

REM Calculate last week's date (7 days ago)
echo Current date: %today%

REM Generate historical data for last week (7 days ago)
echo.
echo Generating data for last week...
python extract_today_data.py %today%

REM Check if the script ran successfully
if %errorlevel% equ 0 (
    echo.
    echo Data generation completed successfully!
    echo.
    echo Files generated:
    dir data\today_waits_*.json
    echo.
    echo To push these changes to GitHub, run:
    echo git add data/
    echo git commit -m "Update historical wait time data"
    echo git push origin main
) else (
    echo.
    echo Error: Data generation failed!
    pause
    exit /b 1
)

echo.
echo Done! Check the data/ folder for generated files.
pause 