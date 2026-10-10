import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Read-only structural inspection. Does not instantiate, validate, execute,
// optimize, or modify the active build's WebAssembly.
const root = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1'));
const build = path.resolve(root, '../engine-build');
const input = path.join(build, 'output/cataclysm-tiles.wasm');
const bytes = fs.readFileSync(input);
let pos = 8;
const leb = () => {
  let value = 0, scale = 1, count = 0;
  while (true) {
    if (pos >= bytes.length || ++count > 5) throw new Error('Invalid u32 LEB128');
    const b = bytes[pos++]; value += (b & 127) * scale;
    if (!(b & 128)) return value;
    scale *= 128;
  }
};
const string = () => { const n = leb(); const end = pos + n;
  if (end > bytes.length) throw new Error('String exceeds input');
  const value = bytes.toString('utf8', pos, end); pos = end; return value;
};
const limits = () => { const flags = leb(); if (flags & 4) throw new Error('memory64 not supported by inspector'); leb(); if (flags & 1) leb(); };
const valueType = () => { const t = bytes[pos++]; if (t === 0x63 || t === 0x64) leb(); };
const sections = [], imports = [], functionNames = new Map(), bodies = [];
let definedFunctions = 0, declaredLocalsExcludingParameters = 0;
if (bytes.readUInt32LE(0) !== 0x6d736100 || bytes.readUInt32LE(4) !== 1) throw new Error('Not WebAssembly v1');
while (pos < bytes.length) {
  const id = bytes[pos++], length = leb(), begin = pos, end = begin + length;
  if (end > bytes.length) throw new Error('Section exceeds input');
  sections.push({id, bytes:length});
  if (id === 2) {
    const count = leb();
    for (let i = 0; i < count; i++) {
      const module = string(), name = string(), kind = bytes[pos++];
      const entry = {module, name, kind};
      if (kind === 0) entry.type = leb();
      else if (kind === 1) { valueType(); limits(); }
      else if (kind === 2) limits();
      else if (kind === 3) { valueType(); pos++; }
      else if (kind === 4) { pos++; leb(); }
      else throw new Error('Unknown import kind');
      imports.push(entry);
    }
    if (pos !== end) throw new Error('Import section not consumed exactly');
  } else if (id === 3) {
    definedFunctions = leb();
  } else if (id === 10) {
    const count = leb();
    if (count !== definedFunctions) throw new Error('Function/code count mismatch');
    const importedCount = imports.filter(i => i.kind === 0).length;
    for (let i = 0; i < count; i++) {
      const size = leb(), bodyEnd = pos + size, localGroups = leb();
      if (bodyEnd > end) throw new Error('Body exceeds section');
      let locals = 0;
      for (let g = 0; g < localGroups; g++) { locals += leb(); valueType(); }
      declaredLocalsExcludingParameters += locals;
      bodies.push({index:importedCount+i, encodedBodyBytes:size, declaredLocalsExcludingParameters:locals});
      pos = bodyEnd;
    }
    if (pos !== end) throw new Error('Code section not consumed exactly');
  } else if (id === 0 && string() === 'name') {
    while (pos < end) {
      const subsection = bytes[pos++], subLength = leb(), subEnd = pos + subLength;
      if (subEnd > end) throw new Error('Name subsection exceeds section');
      if (subsection === 1) {
        const count = leb();
        for (let i=0;i<count;i++) { const index=leb(); functionNames.set(index,string()); }
      }
      pos = subEnd;
    }
  }
  pos = end;
}
const manifest = JSON.parse(fs.readFileSync(path.join(build,'build-manifest.json'),'utf8'));
const compileResults = JSON.parse(fs.readFileSync(path.join(build,'compile-results.json'),'utf8'));
const legacyResults = JSON.parse(fs.readFileSync(path.join(build,'compile-results-without-legacy-macro.json'),'utf8'));
const lastBySource = new Map(compileResults.map(r=>[r.source,r]));
const selected = [...manifest.cppSources,...manifest.cSources].map(s=>lastBySource.get(s));
if (selected.some(s=>!s || s.code!==0)) throw new Error('Incomplete successful compile records');
const fnImports = imports.filter(i=>i.kind===0);
const stat = fs.statSync(input);
const report = {
  observedUTC:new Date().toISOString(),
  input:{path:input,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),lastModifiedUTC:stat.mtime.toISOString(),stage:'pre-terminal optimizer input; not runnable final engine'},
  structuralInspection:{method:'read sections and declared local headers; no opcode analysis or Wasm execution',sections,importedFunctions:fnImports.length,definedFunctions,totalFunctions:fnImports.length+definedFunctions,declaredLocalsExcludingParameters,
    exceptionInvokeImports:fnImports.filter(i=>i.module==='env'&&i.name.startsWith('invoke_')),
    explicitAsyncImportsPresent:fnImports.filter(i=>/emscripten_sleep|^__asyncjs__|emscripten_promise_await|fd_sync|__syscall_poll|__syscall_epoll_pwait|emscripten_idb_|emscripten_wget_data|emscripten_fiber_swap|_emval_await/.test(i.name)),
    largestBodies:[...bodies].sort((a,b)=>b.encodedBodyBytes-a.encodedBodyBytes).slice(0,10).map(b=>({...b,name:functionNames.get(b.index)??null}))},
  compileTiming:{selectedSuccessfulUnits:selected.length,summedUnitWallMilliseconds:selected.reduce((n,r)=>n+r.milliseconds,0),allRecordedAttempts:compileResults.length,summedAttemptWallMilliseconds:compileResults.reduce((n,r)=>n+(r.milliseconds||0),0),archivedPreMacroRecords:legacyResults.length,archivedPreMacroSummedWallMilliseconds:legacyResults.reduce((n,r)=>n+(r.milliseconds||0),0),note:'Current-manifest and archived pre-macro per-unit wall durations summed, not CPU time or overall elapsed. Includes concurrent work; probes are not necessarily included; compiler session start/end must come from owner records.'}
};
fs.writeFileSync(path.join(root,'input-structure.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({input:report.input,functions:report.structuralInspection.totalFunctions,definedFunctions,declaredLocalsExcludingParameters,invokeImports:report.structuralInspection.exceptionInvokeImports.length,asyncImports:report.structuralInspection.explicitAsyncImportsPresent,compileTiming:report.compileTiming}));
