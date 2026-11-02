@echo off
REM Stops the backend. Your data (database, documents, photos) is kept. Close the website window to stop it.
cd /d "%~dp0backend"
docker compose down
echo.
echo Backend stopped. Data is kept.
pause
