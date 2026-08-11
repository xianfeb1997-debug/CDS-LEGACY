@echo off
setlocal
cd /d "%~dp0"

if not exist ".env.local" (
  copy ".env.local.example" ".env.local" >nul
  echo Created .env.local from .env.local.example.
  echo Edit .env.local and set SUPABASE_DATABASE_URL and ILAW_ADMIN_KEY before using database features.
)

if not exist "node_modules\next\package.json" (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 exit /b 1
)

echo Starting Classroom Design Suite at http://localhost:3000
call npm run dev
