Set-Location $PSScriptRoot
$env:DATABASE_URL = "postgresql://tfw:tfwpassword@localhost:5433/tfw_db"
$env:JWT_SECRET = "tfw-website-jwt-secret-change-in-prod-2024"
$env:API_PORT = "5001"
& node_modules\.bin\concurrently.cmd "npx tsx watch server/index.ts" "npx vite --port 3000"
