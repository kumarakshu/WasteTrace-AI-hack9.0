# WasteTrace AI Local Development Launcher for Windows PowerShell
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  Starting WasteTrace AI - Civic Intelligence Platform   " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green

# 1. Check Python Virtualenv
if (-not (Test-Path ".\.venv\Scripts\python.exe")) {
    Write-Host "[Error] Python virtualenv not found in .venv! Run 'python -m venv .venv' first." -ForegroundColor Red
    exit 1
}

# 2. Check Frontend node_modules
if (-not (Test-Path ".\frontend\node_modules")) {
    Write-Host "[Setup] Installing frontend dependencies..." -ForegroundColor Yellow
    Push-Location frontend
    npm install
    Pop-Location
}

Write-Host "`n[1/2] Starting FastAPI Backend on http://127.0.0.1:8000..." -ForegroundColor Cyan
$backendProc = Start-Process -FilePath ".\.venv\Scripts\python.exe" -ArgumentList "-m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload" -PassThru

Write-Host "[2/2] Starting Vite React Frontend on http://localhost:5173..." -ForegroundColor Cyan
$frontendProc = Start-Process -FilePath "npm" -ArgumentList "run dev" -WorkingDirectory ".\frontend" -PassThru

Write-Host "`n>>> Both servers started successfully!" -ForegroundColor Green
Write-Host "  Frontend URL: http://localhost:5173" -ForegroundColor White
Write-Host "  Backend API:  http://127.0.0.1:8000" -ForegroundColor White
Write-Host "  Swagger Docs: http://127.0.0.1:8000/docs" -ForegroundColor White
Write-Host "`nPress Ctrl+C or close this terminal to stop both servers." -ForegroundColor Yellow

try {
    # Keep script open and wait
    Wait-Process -Id $backendProc.Id, $frontendProc.Id
} finally {
    Write-Host "`nStopping servers..." -ForegroundColor Red
    Stop-Process -Id $backendProc.Id -ErrorAction SilentlyContinue
    Stop-Process -Id $frontendProc.Id -ErrorAction SilentlyContinue
}

