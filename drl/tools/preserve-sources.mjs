// Prepare the original-language gameplay source for Git without redistributing
// acquired proprietary runtime/audio binaries. Never changes pristine upstream.
import {mkdir,readFile,writeFile,readdir,copyFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {fileURLToPath} from "node:url";
import path from "node:path";
const root=fileURLToPath(new URL("../",import.meta.url));
const manifest=[];
async function copyTree(project,subdirectory,extensions){
  const sourceRoot=path.join(root,"upstream",project,subdirectory);
  async function visit(directory){
    for(const entry of await readdir(directory,{withFileTypes:true})){
      const source=path.join(directory,entry.name);
      if(entry.isDirectory()){await visit(source);continue;}
      if(!entry.isFile()||!extensions.has(path.extname(entry.name).toLowerCase()))continue;
      const relative=path.relative(path.join(root,"upstream",project),source);
      const target=path.join(root,"native",project,relative);
      const bytes=await readFile(source);
      await mkdir(path.dirname(target),{recursive:true});await copyFile(source,target);
      manifest.push({file:path.relative(root,target).replaceAll(path.sep,"/"),bytes:bytes.length,sha256:createHash("sha256").update(bytes).digest("hex")});
    }
  }
  await visit(sourceRoot);
}
async function copyFileExact(project,file){
  const source=path.join(root,"upstream",project,file),target=path.join(root,"native",project,file);
  const bytes=await readFile(source);await mkdir(path.dirname(target),{recursive:true});await copyFile(source,target);
  manifest.push({file:path.relative(root,target).replaceAll(path.sep,"/"),bytes:bytes.length,sha256:createHash("sha256").update(bytes).digest("hex")});
}
await copyTree("drl","src",new Set([".pas",".inc",".lpr",".lpi"]));
await copyTree("drl","old",new Set([".pas",".inc",".lpr",".lpi"]));
await copyTree("drl","bin",new Set([".lua"]));
await copyTree("drl","bin",new Set([".hlp"]));
for(const file of ["LICENSE","README.md","bin/manual.txt","bin/data/drl/help/drl.txt","config-linux.lua","config-windows.lua","makefile.lua"])await copyFileExact("drl",file);
await copyTree("fpcvalkyrie","src",new Set([".pas",".inc",".lpr"]));
for(const file of ["LICENSE","README.md"])await copyFileExact("fpcvalkyrie",file);
await copyTree("lua-5.1.5","src",new Set([".c",".h"]));
for(const file of ["COPYRIGHT","README","INSTALL","Makefile","src/Makefile"])await copyFileExact("lua-5.1.5",file);
manifest.sort((a,b)=>a.file.localeCompare(b.file));
await mkdir(path.join(root,"docs"),{recursive:true});
await writeFile(path.join(root,"docs","native-source-manifest.json"),JSON.stringify({source_commit:"a6f965072b3a25b768c91dbced00367f1b57d865",engine_commit:"f89735a741a968997656c2d48a003ec569db7f22",selection:"original Pascal/Lua/C source and explicit licenses/help; no binary game/runtime/audio/art payload",modified_gameplay_files:0,files:manifest},null,2));
console.log(JSON.stringify({preserved_files:manifest.length,bytes:manifest.reduce((sum,file)=>sum+file.bytes,0),gameplay_modified:false}));
