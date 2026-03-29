@echo off
echo ==========================================
echo   TutorBoard Automated Setup (Windows)
echo ==========================================

echo.
echo [1/2] Installing Backend Dependencies...
cd server
call npm install
cd ..

echo.
echo [2/2] Installing Frontend Dependencies...
cd client
call npm install
cd ..

echo.
echo ==========================================
echo   Setup Complete!
echo   Run dev.bat to start the application.
echo ==========================================
pause
