Set-Location c:\Projects\TFW_WEB\website
$env:DATABASE_URL = "postgresql://tfw:tfwpassword@localhost:5433/tfw_db"
npm run dev
