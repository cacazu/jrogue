@echo off
pushd "%~dp0"
brogue-ja.exe --language ja %*
set "brogue_exit=%errorlevel%"
popd
exit /b %brogue_exit%
