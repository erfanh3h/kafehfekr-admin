@echo off
title Building Cafe Fekr Admin Frontend for Production...
cd /d "%~dp0frontend"
npm run build
echo.
echo Build complete! Static assets placed in frontend/dist.
echo The backend (backend/main.py) will now serve this frontend at http://localhost:5002/
pause
