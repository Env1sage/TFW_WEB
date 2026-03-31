@echo off
cd /d "%~dp0"
set DATABASE_URL=postgresql://tfw:tfwpassword@localhost:5433/tfw_db
set API_PORT=5001
call node_modules\.bin\concurrently.cmd "npx tsx watch server/index.ts" "node_modules\.bin\vite.cmd --port 3000"
