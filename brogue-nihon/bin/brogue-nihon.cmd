@echo off
pushd "%~dp0"
brogue-nihon.exe --language ja %*
set "brogue_exit=%errorlevel%"
popd
exit /b %brogue_exit%
