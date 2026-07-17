$ErrorActionPreference = "Stop"

Push-Location $PSScriptRoot
try {
  Write-Host "Installing dependencies..."
  npm install

  if (-not (Test-Path ".env.local")) {
    Copy-Item ".env.example" ".env.local"
    Write-Host ""
    Write-Host "Created .env.local from .env.example."
    Write-Host "Open .env.local and set OPENAI_API_KEY before running the booth."
  } else {
    Write-Host ".env.local already exists."
  }
} finally {
  Pop-Location
}
