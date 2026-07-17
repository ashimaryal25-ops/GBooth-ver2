$ErrorActionPreference = "Stop"

Push-Location $PSScriptRoot
try {
  if (-not (Test-Path ".env.local")) {
    Write-Host "Missing .env.local. Run setup-kiosk.ps1 first, then add OPENAI_API_KEY."
    exit 1
  }

  if (-not (Test-Path ".next")) {
    Write-Host "No production build found. Building now..."
    npm run build
  }

  Write-Host ""
  Write-Host "Main booth:   http://localhost:3000/"
  Write-Host "LCD mirror:   http://localhost:3000/camera-mirror.html"
  Write-Host ""
  npm run start -- -H 0.0.0.0 -p 3000
} finally {
  Pop-Location
}
