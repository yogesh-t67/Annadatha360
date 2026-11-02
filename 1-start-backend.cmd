@echo off
REM Starts the backend (API + database) on this laptop. Double-click, or run from a terminal.
cd /d "%~dp0backend"
set ANNADATA_DB_PORT=5440
set ANNADATA_API_PORT=8010
docker compose up -d --build
echo.
echo Backend is running at http://localhost:8010  (check: http://localhost:8010/health)
echo Now start the website with 2-start-website.cmd
pause
