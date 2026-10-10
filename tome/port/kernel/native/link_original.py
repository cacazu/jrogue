"""Link original project static archives, matching Premake archive semantics."""
import json
from pathlib import Path
import subprocess
import time

ROOT=Path(__file__).resolve().parent
SDK=Path(r"C:\Users\kit\emsdk\upstream\emscripten")
report=json.loads((ROOT/"full-build-results.json").read_text())
groups={}
for unit in report["units"]:
    if unit["exit"]: raise SystemExit("Cannot link failed translation units")
    groups.setdefault(unit["project"],[]).append(unit["object"])
archives=[]
for name,objects in groups.items():
    if name=="TEngine": continue
    archive=ROOT/"full-build"/("lib"+name+".a")
    result=subprocess.run([str(SDK/"emar.exe"),"rcs",str(archive),*objects],capture_output=True,text=True)
    if result.returncode: raise SystemExit(result.stderr)
    archives.append(str(archive))
command=[str(SDK/"em++.exe"),*groups["TEngine"],*archives,"-O1","-sUSE_SDL=2","-sUSE_SDL_IMAGE=2",'-sSDL2_IMAGE_FORMATS=["png"]',"-sUSE_SDL_TTF=2","-sUSE_LIBPNG=1","-sUSE_VORBIS=1","-sLEGACY_GL_EMULATION=1","-sALLOW_MEMORY_GROWTH=1","-sFORCE_FILESYSTEM=1","-sSTACK_SIZE=8388608","-Wl,--error-limit=0","-o",str(ROOT/"full-build/original-kernel.mjs")]
start=time.time()
result=subprocess.run(command,capture_output=True,text=True)
log=result.stdout+result.stderr
(ROOT/"logs/original-archive-link.txt").write_text(log,encoding="utf-8")
(ROOT/"original-archive-link.json").write_text(json.dumps({"exit":result.returncode,"elapsed":round(time.time()-start,2),"command":command},indent=2),encoding="utf-8")
print("LINK_EXIT="+str(result.returncode))
print(log[-12000:])
