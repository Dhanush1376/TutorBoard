@echo off
echo ==========================================
echo   TutorBoard Development Server (Windows)
echo ==========================================

echo [1/2] Starting Backend Server...
start cmd /k "cd server && npm start"

echo [2/2] Starting Frontend Client...
start cmd /k "cd client && npm run dev"

echo.
echo ==========================================
echo   Both services are starting in new windows.
echo   Frontend: http://localhost:5173
echo   Backend: http://localhost:3001
echo ==========================================
