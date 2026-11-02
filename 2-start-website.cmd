@echo off
REM Starts the ERP website on this laptop. Keep this window open while you use it; close it to stop.
cd /d "%~dp0web"
if not exist .env copy .env.example .env >nul
if not exist node_modules call npm install
echo Website starting at http://localhost:3000 ...
npm run dev
