@echo off
chcp 65001 >nul
cd /d "%~dp0"
node server/app.cjs 5514 --share
if errorlevel 1 pause
