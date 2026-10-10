// Record mutable source inputs around a build. Hashing never invokes a compiler.
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {lstat, readdir} from 'node:fs/promises';
import path from 'node:path';

const sourceExtension=/\.(?:pas|pp|inc|c|h|lua|lpr|json|mjs|ps1)$/i;
const excluded=new Set(['.git','build','mixed-build','mixed-rtl','toolchain','output','probe-build','native-probe-build','tests-output','units','units_bs']);
export async function fileHash(file){
  const hash=createHash('sha256');
  for await(const bytes of createReadStream(file))hash.update(bytes);
  return hash.digest('hex');
}

export async function captureLinkSources(root,relativeRoots){
  const records=[];
  async function visit(file){
    const stat=await lstat(file);
    if(stat.isSymbolicLink())throw Error('Build source symlink rejected: '+file);
    if(stat.isDirectory()){
      for(const entry of await readdir(file,{withFileTypes:true})){
        if(entry.isDirectory()&&excluded.has(entry.name))continue;
        await visit(path.join(file,entry.name));
      }
    }else if(stat.isFile()&&sourceExtension.test(file)){
      const relative=path.relative(root,file).replaceAll('\\','/');
      if(relative.startsWith('../')||path.isAbsolute(relative))throw Error('Build source escaped root');
      records.push({path:relative,size:stat.size,sha256:await fileHash(file)});
    }
  }
  for(const relative of relativeRoots)await visit(path.join(root,relative));
  records.sort((a,b)=>a.path.localeCompare(b.path,'en'));
  const seen=new Set();
  for(const record of records){
    const key=record.path.toLowerCase();
    if(seen.has(key))throw Error('Duplicate build source path: '+record.path);
    seen.add(key);
  }
  return {schema:1,roots:relativeRoots,files:records,
    sha256:createHash('sha256').update(JSON.stringify(records)).digest('hex')};
}

export function compiledSourceRecords(root,compiledPaths,snapshot){
  const byPath=new Map(snapshot.files.map(file=>[file.path.toLowerCase(),file]));
  const selected=new Map(),unresolved=[];
  for(const printed of compiledPaths){
    const normalized=printed.replaceAll('\\','/');
    const absolute=path.isAbsolute(printed)?printed:path.join(root,printed);
    const relative=path.relative(root,absolute).replaceAll('\\','/').toLowerCase();
    let record=byPath.get(relative);
    if(!record){
      const suffix=normalized.replace(/^\.\//,'').toLowerCase();
      const matches=snapshot.files.filter(file=>file.path.toLowerCase()===suffix||file.path.toLowerCase().endsWith('/'+suffix));
      if(matches.length===1)record=matches[0];
    }
    if(record)selected.set(record.path,record);else unresolved.push(printed);
  }
  return {files:[...selected.values()],unresolved};
}
