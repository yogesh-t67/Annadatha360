@echo off
REM Shows the emails the system "sends" (invite, sign-up, password reset links). Keep it open while testing.
cd /d "%~dp0backend"
echo Waiting for emails... (links appear below; close this window to stop watching)
powershell -NoProfile -Command "docker compose logs -f --since 1h api | Select-String -Pattern 'DEV EMAIL' -Context 0,4"
