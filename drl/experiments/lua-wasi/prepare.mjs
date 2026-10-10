import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const task=path.resolve(root,'../..');
const copied=path.join(root,'lua-src');
fs.mkdirSync(copied,{recursive:true});
const patches=[];
for (const name of fs.readdirSync(path.join(task,'upstream/lua-5.1.5/src'))) {
  if (!/\.(c|h)$/.test(name)) continue;
  const original=fs.readFileSync(path.join(task,'upstream/lua-5.1.5/src',name));
  let bytes=original;
  if(name==='luaconf.h') {
    const input=original.toString('utf8');
    const output=input.replace('#define LUA_INTEGER\tptrdiff_t','#define LUA_INTEGER\tlong long /* DRL wasm32 ABI: Pascal lua_Integer is int64. */')
      .replace('#define LUAL_BUFFERSIZE\t\tBUFSIZ','#define LUAL_BUFFERSIZE\t\t1024 /* Match preserved Pascal lauxlib record. */');
    if(output===input || output.includes('#define LUA_INTEGER\tptrdiff_t') || output.includes('#define LUAL_BUFFERSIZE\t\tBUFSIZ')) throw Error('Expected original config tokens missing');
    bytes=Buffer.from(output);
    patches.push({file:name,original_sha256:crypto.createHash('sha256').update(original).digest('hex'),patched_sha256:crypto.createHash('sha256').update(bytes).digest('hex'),changes:['LUA_INTEGER=long long (int64)','LUAL_BUFFERSIZE=1024']});
  }
  if(name==='loslib.c') {
    const input=original.toString('utf8');
    const execute=/static int os_execute \(lua_State \*L\) \{[\s\S]*?\n\}/;
    const tmpname=/static int os_tmpname \(lua_State \*L\) \{[\s\S]*?\n\}/;
    const output=input.replace('#include "lauxlib.h"','#include "lauxlib.h"\n#include "drl_platform_errors.h"')
      .replace(execute,'static int os_execute (lua_State *L) {\n  return drl_lua_platform_error(L, "error.lua.platform.external-process", "external processes are unavailable in the browser");\n}')
      .replace(tmpname,'static int os_tmpname (lua_State *L) {\n  return drl_lua_platform_error(L, "error.lua.platform.temporary-name", "temporary filename allocation requires the browser platform adapter");\n}');
    if(output===input || output.includes('char buff[LUA_TMPNAMBUFSIZE]')) throw Error('Expected OS functions missing');
    bytes=Buffer.from(output);
    patches.push({file:name,original_sha256:crypto.createHash('sha256').update(original).digest('hex'),patched_sha256:crypto.createHash('sha256').update(bytes).digest('hex'),changes:['os.execute explicitly rejected (browser has no subprocesses)','os.tmpname explicitly rejected pending virtual filesystem adapter']});
  }
  if(name==='liolib.c') {
    const input=original.toString('utf8');
    const output=input.replace('#include "lauxlib.h"','#include "lauxlib.h"\n#include "drl_platform_errors.h"')
      .replace(/static int io_tmpfile \(lua_State \*L\) \{[\s\S]*?\n\}/,'static int io_tmpfile (lua_State *L) {\n  return drl_lua_platform_error(L, "error.lua.platform.temporary-file", "temporary file allocation requires the browser platform adapter");\n}');
    if(output===input) throw Error('Expected io_tmpfile missing');
    bytes=Buffer.from(output);
    patches.push({file:name,original_sha256:crypto.createHash('sha256').update(original).digest('hex'),patched_sha256:crypto.createHash('sha256').update(bytes).digest('hex'),changes:['io.tmpfile explicitly rejected pending virtual filesystem adapter']});
  }
  fs.writeFileSync(path.join(copied,name),bytes);
}
fs.copyFileSync(path.join(root,'drl_platform_errors.h'),path.join(copied,'drl_platform_errors.h'));
const binding=fs.readFileSync(path.join(task,'upstream/fpcvalkyrie/libs/vluatypes.inc'),'utf8');
const corrected=binding.replace('    linedefined : Integer; (* (S) *)','    linedefined : Integer; (* (S) *)\n    lastlinedefined : Integer; (* (S) Lua 5.1.5 ABI field omitted upstream. *)');
if(corrected===binding) throw Error('Expected debug field missing');
const overlay=path.join(root,'pascal-overlay');fs.mkdirSync(overlay,{recursive:true});
fs.writeFileSync(path.join(overlay,'vluatypes.inc'),corrected);
const authored_files=[{file:'drl_platform_errors.h',sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(copied,'drl_platform_errors.h'))).digest('hex')}];
fs.writeFileSync(path.join(root,'patch-manifest.json'),JSON.stringify({pristine_modified:false,lua_version:'5.1.5',patches,authored_files,pascal_debug_fix:'Add lastlinedefined before short_src'},null,2)+'\n');
