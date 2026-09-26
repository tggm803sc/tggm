@echo off
setlocal

set "ROOT=%~dp0.."
for %%D in (
  "%ROOT%\artifacts"
  "%ROOT%\artifacts\logs"
  "%ROOT%\artifacts\build"
  "%ROOT%\artifacts\test"
  "%ROOT%\game\unreal\Saved"
) do (
  if not exist "%%~D" mkdir "%%~D"
)

echo [TGG] Workspace directories ready.
exit /b 0
