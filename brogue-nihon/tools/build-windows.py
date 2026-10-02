"""Build the SDL Windows port with the installed Visual Studio C compiler."""
import os
from pathlib import Path
import shutil
import subprocess
import sys
import argparse
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', default='brogue-nihon.exe', help='Executable filename under bin/')
parser.add_argument('--probe', action='store_true', help='Build the display-text DLL for code-based catalog tests')
options = parser.parse_args()
if Path(options.output).name != options.output or not options.output.endswith('.exe'):
    raise SystemExit('Output must be an executable filename under bin/')

ROOT = Path(__file__).resolve().parents[1]
subprocess.run([sys.executable, str(ROOT / "tools/compile-locales.py")], check=True)
BUILD = ROOT / ".build"
BUILD.mkdir(exist_ok=True)
(BUILD / "obj").mkdir(exist_ok=True)
vcvars = os.environ.get("BROGUE_VCVARS")
if not vcvars:
    installer = Path(os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)")) / "Microsoft Visual Studio/Installer/vswhere.exe"
    if installer.is_file():
        installation = subprocess.check_output([str(installer), "-latest", "-prerelease", "-products", "*", "-requires",
            "Microsoft.VisualStudio.Component.VC.Tools.x86.x64", "-property", "installationPath"], text=True).strip()
        if installation:
            vcvars = str(Path(installation) / "VC/Auxiliary/Build/vcvars64.bat")
if not vcvars or not Path(vcvars).is_file():
    raise SystemExit("Visual Studio C compiler not found. Install C++ build tools or set BROGUE_VCVARS to vcvars64.bat.")
packages = [next((ROOT / ".deps" / name).iterdir()) for name in ("SDL", "SDL_image", "SDL_ttf")]
sources = sorted((ROOT / "src/brogue").glob("*.c")) + sorted((ROOT / "src/variants").glob("*.c"))
sources += [ROOT / "src/platform" / (name + ".c") for name in ("main", "platformdependent", "null-platform", "sdl2-platform", "tiles")]
args = ["/nologo", "/std:c11", "/utf-8", "/O2", "/MD", "/W3", "/D_CRT_SECURE_NO_WARNINGS", "/DNOMINMAX", "/DBROGUE_SDL", "/DDATADIR=.", '/DBROGUE_EXTRA_VERSION=""', '/Fe"' + str(ROOT / 'bin' / options.output) + '"', '/Fo"' + str(BUILD / "obj") + '/"']
args += ['/I"' + str(ROOT / path) + '"' for path in ("src/brogue", "src/platform", "src/variants")]
args += ['/I"' + str(p / "include") + '"' for p in packages]
args += ['"' + str(p) + '"' for p in sources]
args += ["/link", "/SUBSYSTEM:CONSOLE", "/STACK:8388608", "SDL2.lib", "SDL2main.lib", "SDL2_image.lib", "SDL2_ttf.lib"]
args += ['/LIBPATH:"' + str(p / "lib/x64") + '"' for p in packages]
response = BUILD / "build.rsp"
if options.probe:
    args = ['/nologo', '/std:c11', '/utf-8', '/O2', '/MD', '/LD', '/D_CRT_SECURE_NO_WARNINGS',
            '/I"' + str(ROOT/'src/brogue') + '"', '/Fe"' + str(BUILD/'locale-probe.dll') + '"',
            '/Fo"' + str(BUILD/'obj') + '/"', '"' + str(ROOT/'src/brogue/LocalizedText.c') + '"',
            '/link', '/EXPORT:localeDisplay', '/EXPORT:localeSetLanguage', '/EXPORT:localeTextWidth', '/EXPORT:localeWrap']
response.write_text(" ".join(args), encoding="utf-8")
script = BUILD / "compile.cmd"
script.write_text(f'@echo off\ncall "{vcvars}"\nif errorlevel 1 exit /b %errorlevel%\ncl @"{response}"\nexit /b %errorlevel%\n', encoding="utf-8")
result = subprocess.run(["cmd.exe", "/d", "/c", str(script)], cwd=ROOT)
if result.returncode:
    raise SystemExit(result.returncode)
if options.probe:
    print('Built:', BUILD/'locale-probe.dll')
    raise SystemExit(0)
for package in packages:
    for dll in (package / "lib/x64").glob("*.dll"):
        destination = ROOT / 'bin' / dll.name
        if not destination.exists() or destination.read_bytes() != dll.read_bytes():
            shutil.copy2(dll, destination)
print("Built:", ROOT / 'bin' / options.output)
