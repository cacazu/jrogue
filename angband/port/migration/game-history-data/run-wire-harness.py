# SPDX-License-Identifier: GPL-2.0-only
"""Small actual-C history ownership/wire test; parent serializes compiler jobs."""
from pathlib import Path
import hashlib,json,os,re,subprocess,tempfile
root=Path(__file__).resolve().parents[2]
family=root/'migration/game-history-data'
sdk=Path(os.environ.get('ANGBAND_SDK',r'C:\Users\kit\emsdk'))
work=Path(tempfile.gettempdir())/'angband-history-wire-harness'
work.mkdir(parents=True,exist_ok=True)
def read(p):return p.read_text(encoding='utf-8')
def struct(source,name):
 match=re.search(r'struct '+re.escape(name)+r'\s*\{[\s\S]*?\};',source)
 if not match:raise RuntimeError('Missing real source struct '+name)
 return match.group(0)
prefix=read(family/'wire-harness-prefix.c')
for token,value in {
 '__NATIVE_HISTORY_ENUM__':read(root/'logic/list-history-types.h'),
 '__NATIVE_HISTORY_STRUCT__':struct(read(root/'logic/player-history.h'),'history_info'),
 '__NATIVE_SEMANTIC_STRUCT__':struct(read(root/'logic/web-semantic.h'),'ab_semantic_event'),
 '__NATIVE_UI_PARAM_STRUCT__':struct(read(root/'logic/web-ui-text.h'),'ab_ui_param')
}.items():prefix=prefix.replace('/* '+token+' */',value)
prefix=prefix.replace('bitflag type[HIST_SIZE]','uint8_t type[HIST_SIZE]')
sources=[root/'logic/web-semantic.c',root/'logic/web-game-history.c']
formatter_sources=[root/'logic/z-form.c',root/'logic/z-util.c',root/'logic/z-virt.c']
ui_source=root/'logic/ui-history.c'
selected=re.findall(r'strnfmt\(widget,sizeof\(widget\),\"row\.[^\"]+\",[^;]+;',read(ui_source))
if len(selected)!=1:raise RuntimeError('Expected exactly one source-selected history widget formatter')
prefix=prefix.replace('/* __SELECTED_HISTORY_WIDGET_FORMAT__ */',selected[0])
# Compile the unmodified native formatter translation unit and dependencies.
# Hash every quoted-header dependency, including conditional native headers.
formatter_headers=set()
def collect_headers(source):
 for name in re.findall(r'^\s*#include\s+\"([^\"]+)\"',read(source),flags=re.M):
  target=source.parent/name
  if target.is_file() and target not in formatter_headers:
   formatter_headers.add(target);collect_headers(target)
for source in formatter_sources:collect_headers(source)
# Actual current header bytes define the copied struct layouts. Record them
# alongside the serializer/adapter and explicit test boundaries, then refuse
# acceptance if any of those inputs change during compiler/runtime execution.
headers=[root/'logic/web-semantic.h',root/'logic/message.h',root/'logic/player-history.h',root/'logic/list-history-types.h',root/'logic/web-ui-text.h',root/'logic/web-game-history.h']
inputs=sources+formatter_sources+[ui_source]+headers+sorted(formatter_headers)+[family/'catalog-digest.inc',family/'wire-harness-prefix.c',family/'wire-harness-tests.c',Path(__file__).resolve()]
def input_hashes():return {p.relative_to(root).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in inputs}
input_before=input_hashes()
def bounded_run(command,seconds,label,env):
 try:
  return subprocess.run(command,cwd=root,env=env,capture_output=True,text=True,encoding='utf-8',timeout=seconds)
 except subprocess.TimeoutExpired:
  raise SystemExit(f'{label} exceeded the {seconds}-second subprocess timeout')
chunks=[prefix]
for source in sources:
 text=read(source)
 text=re.sub(r'^\s*#include[^\n]*$', '',text,flags=re.M)
 if source.name=='web-game-history.c':
  text=text.replace('extern uint32_t ab_rs_review_status(void);',read(family/'catalog-digest.inc'))
 chunks.append(text)
chunks.append(read(family/'wire-harness-tests.c'))
unit=work/'history-wire-harness.c';unit.write_text('\n'.join(chunks),encoding='utf-8',newline='\n')
env=dict(os.environ);env.update({'EM_CONFIG':str(sdk/'.emscripten'),'EM_CACHE':str(root/'build/em-cache'),'EMSDK_PYTHON':str(sdk/'python/3.13.3_64bit/python.exe'),'EMCC_CORES':'1','BINARYEN_CORES':'1'})
output=work/'history-wire-harness.cjs'
command=[str(sdk/'python/3.13.3_64bit/python.exe'),str(sdk/'upstream/emscripten/emcc.py'),str(unit),*[str(source) for source in formatter_sources],'-std=c11','-O0','-sENVIRONMENT=node','-sASSERTIONS=2','-o',str(output)]
compiled=bounded_run(command,120,'history wire fixture compiler',env)
if compiled.returncode:raise SystemExit((compiled.stdout+compiled.stderr)[-12000:])
node=os.environ.get('ANGBAND_NODE',r'C:\Program Files\nodejs\node.exe')
run=bounded_run([node,str(output)],30,'history wire fixture runtime',env)
if run.returncode:raise SystemExit((run.stdout+run.stderr)[-12000:])
if input_before!=input_hashes():raise SystemExit('History wire fixture inputs changed during compile/runtime; result is not accepted')
result=json.loads(run.stdout.strip().splitlines()[-1]);result.update({'compiledActualSources':[{'path':p.relative_to(root).as_posix(),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}for p in sources+formatter_sources],'fixtureInputs':input_before,'compilerTimeoutSeconds':120,'runtimeTimeoutSeconds':30,'fixtureInputsStableDuringRun':True,'messageStorageBoundariesStubbed':True,'nativeFormatterSourceUnmodified':True,'selectedHistoryFormatter':{'path':ui_source.relative_to(root).as_posix(),'statement':selected[0],'sha256':input_before[ui_source.relative_to(root).as_posix()]},'testDriverOnly':True,'fullEngineOrBrowserAcceptance':False})
print(json.dumps(result,ensure_ascii=True))
