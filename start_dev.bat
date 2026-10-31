@echo off
echo ==========================================================
echo   Starting WasteTrace AI - Civic Intelligence Platform
echo ==========================================================

start "WasteTrace AI Backend" cmd /k ".\.venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload"
start "WasteTrace AI Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo Servers launched in separate windows!
echo Frontend: http://localhost:5173
echo Backend:  http://127.0.0.1:8000
echo Swagger:  http://127.0.0.1:8000/docs
echo.
pause

