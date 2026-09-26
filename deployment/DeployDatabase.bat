@echo off
setlocal

if "%DATABASE_URL%"=="" (
  echo [TGG] DATABASE_URL is required.
  exit /b 2
)

pushd "%~dp0..\tgg-app"

call npm install --no-audit --no-fund
if errorlevel 1 goto :fail

call npx prisma generate
if errorlevel 1 goto :fail

if /I "%TGG_ALLOW_SCHEMA_PUSH%"=="1" (
  echo [TGG] Explicit schema push enabled.
  call npx prisma db push
  if errorlevel 1 goto :fail
) else (
  echo [TGG] Schema push NOT executed.
  echo [TGG] Set TGG_ALLOW_SCHEMA_PUSH=1 only when an intentional schema push is approved.
)

popd
exit /b 0

:fail
set "CODE=%ERRORLEVEL%"
popd
exit /b %CODE%
