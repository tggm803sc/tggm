@echo off
setlocal enabledelayedexpansion

if "%TGG_BASE_URL%"=="" set "TGG_BASE_URL=http://127.0.0.1:3000"

echo [TGG] Network smoke target: %TGG_BASE_URL%

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "$u='%TGG_BASE_URL%/api/health';" ^
  "$r=Invoke-WebRequest -UseBasicParsing -Uri $u -TimeoutSec 15;" ^
  "if ($r.StatusCode -ne 200) { throw 'Health check failed' };" ^
  "Write-Host '[TGG] health PASS'"

if errorlevel 1 exit /b 1

echo [TGG] Smoke test PASS
exit /b 0
