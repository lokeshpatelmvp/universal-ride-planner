@echo off
echo Generating Historical Wait Time Data for Specific Date...
echo.

REM Check if date parameter was provided
if "%1"=="" (
    echo Usage: generate_specific_date.bat YYYY-MM-DD
    echo Example: generate_specific_date.bat 2025-06-15
    echo.
    echo This will generate historical data for the specified date.
    pause
    exit /b 1
)

set "target_date=%1"

REM Validate date format
echo %target_date% | findstr /r "^[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]$" >nul
if %errorlevel% neq 0 (
    echo Error: Invalid date format. Please use YYYY-MM-DD format.
    echo Example: 2025-06-15
    pause
    exit /b 1
)

echo Generating data for date: %target_date%
echo.

REM Activate virtual environment if it exists
if exist ".venv\Scripts\activate.bat" (
    call .venv\Scripts\activate.bat
    echo Virtual environment activated.
) else (
    echo No virtual environment found, using system Python.
)

REM Generate historical data for the specified date
python extract_today_data.py %target_date%

REM Check if the script ran successfully
if %errorlevel% equ 0 (
    echo.
    echo Data generation completed successfully!
    echo.
    echo Files generated:
    dir data\today_waits_%target_date%.json
    echo.
    echo To push these changes to GitHub, run:
    echo git add data/
    echo git commit -m "Add historical data for %target_date%"
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