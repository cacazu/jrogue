import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {scanSource} from '../../port/tools/inventory-texts.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const task=path.resolve(root,'../..');
const targets=new Set(['lual_error','lua_pushfstring']);
export function rewriteLuaVarargs(source,file='source.pas') {
  let text=source,total=0;
  for(let iteration=0;iteration<20;iteration++) {
    const scan=scanSource(text,'pascal');if(scan.diagnostics.length)throw Error(file+': lexical diagnostics '+JSON.stringify(scan.diagnostics));
    const ts=scan.tokens,candidates=[];
    for(let i=0;i<ts.length;i++) {
      if(ts[i].kind!=='identifier'||!targets.has(ts[i].raw.toLowerCase())||ts[i+1]?.raw!=='(')continue;
      if(['function','procedure'].includes(ts[i-1]?.raw.toLowerCase()))continue;
      let depth=1,brackets=0,start=ts[i+1].end,end=null,invalid=false;const args=[];
      for(let j=i+2;j<ts.length;j++) {
        const t=ts[j];if(t.kind==='string'||t.kind==='character-code')continue;
        if(t.raw==='(')depth++;
        if(t.raw==='[')brackets++;
        if(t.raw===']')brackets--;
        if(t.raw===')'){depth--;if(depth===0){args.push(text.slice(start,t.start).trim());end=t.end;break;}}
        if(depth===1&&brackets===0&&t.raw===','){args.push(text.slice(start,t.start).trim());start=t.end;}
        if(depth===1&&[';',':'].includes(t.raw))invalid=true;
      }
      if(invalid)continue;
      if(end===null||args.length<2)throw Error(file+': malformed Lua call at '+ts[i].line);
      if(args.length===3&&args[2].startsWith('[')&&args[2].endsWith(']'))continue;
      candidates.push({start:ts[i].start,end,name:ts[i].raw,line:ts[i].line,args});
    }
    if(!candidates.length)return {source:text,rewritten_calls:total};
    const inner=candidates.filter(c=>!candidates.some(other=>other!==c&&other.start>c.start&&other.end<c.end));
    for(const c of inner.sort((a,b)=>b.start-a.start))text=text.slice(0,c.start)+`${c.name}(${c.args[0]}, ${c.args[1]}, [${c.args.slice(2).join(', ')}])`+text.slice(c.end);
    total+=inner.length;
  }
  throw Error(file+': nested Lua call rewrite exceeded bound');
}
export function adaptLuaLibrary(source) {
  let text=source;
  const declarations=[
    [/function\s+luaL_error\([^\n]+varargs;[^\n]+external;/i,'function luaL_error(L : Plua_State; const fmt : PChar; const args : array of const) : Integer;'],
    [/function\s+lua_pushfstring\([^\n]+varargs;[^\n]+external;/i,'function lua_pushfstring(L : Plua_State; const fmt : PChar; const args : array of const) : PChar;']
  ];
  for(const [pattern,replacement] of declarations){if(!pattern.test(text))throw Error('Expected static Lua declaration absent');text=text.replace(pattern,replacement);}
  if(!text.includes('uses Classes, SysUtils, vlibrary;'))throw Error('Expected Lua uses clause absent');
  text=text.replace('uses Classes, SysUtils, vlibrary;','uses Classes, SysUtils, vlibrary, drl_lua_varargs;');
  // These are Pascal wrappers with an open-array ABI, not external C varargs.
  text=text.replace('implementation','implementation\n\nfunction luaL_error(L : Plua_State; const fmt : PChar; const args : array of const) : Integer;\nbegin Result := DrlLuaError(L,fmt,args); end;\n\nfunction lua_pushfstring(L : Plua_State; const fmt : PChar; const args : array of const) : PChar;\nbegin Result := DrlLuaFormat(L,fmt,args); end;\n');
  return text;
}
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):/\.(pas|pp|lpr)$/i.test(e.name)?[path.join(dir,e.name)]:[]);}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const output=path.join(root,'source-overlay'),records=[];
  for(const project of ['drl','fpcvalkyrie'])for(const file of walk(path.join(task,'upstream',project))) {
    const relative=path.relative(path.join(task,'upstream'),file),original=fs.readFileSync(file,'utf8');
    const result=rewriteLuaVarargs(original,relative);
    let text=result.source;
    if(relative.replaceAll('\\','/')==='fpcvalkyrie/libs/vlualibrary.pas')text=adaptLuaLibrary(text);
    if(text===original)continue;
    const target=path.join(output,relative);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,text);
    records.push({file:relative.replaceAll('\\','/'),rewritten_calls:result.rewritten_calls});
  }
  fs.writeFileSync(path.join(root,'varargs-overlay-manifest.json'),JSON.stringify({pristine_modified:false,scope:'WASM ABI call shape only; original argument order preserved',validation:'lexical source tests; compiled integration pending',files:records,total_calls:records.reduce((n,r)=>n+r.rewritten_calls,0)},null,2)+'\n');
  console.log(JSON.stringify({files:records.length,calls:records.reduce((n,r)=>n+r.rewritten_calls,0)}));
}
