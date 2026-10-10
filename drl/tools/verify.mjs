import {execFileSync} from "node:child_process";
import {mkdir,readFile,readdir,writeFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {fileURLToPath} from "node:url";
import path from "node:path";
const root=fileURLToPath(new URL("../",import.meta.url));
const port=path.join(root,"port");
const output=path.join(port,"tests","output");
await mkdir(output,{recursive:true});
const results=[];
function run(name,command,args,working=port){
  const log=execFileSync(command,args,{cwd:working,windowsHide:true,encoding:"utf8",stdio:["ignore","pipe","pipe"]});
  results.push({name,command,args,result:"pass",stdout:log});return log;
}
run("format","cargo",["fmt","--check"]);
run("clippy","cargo",["clippy","--offline","--locked","--all-targets","--","-D","warnings"]);
const native=run("native Rust reference/adapters","cargo",["test","--offline","--locked"]);
const counts=[...native.matchAll(/test result: ok\. (\d+) passed; (\d+) failed/g)].map(match=>({passed:Number(match[1]),failed:Number(match[2])}));
const scanner=run("text scanner","node",["--test","tests/text-inventory.test.mjs"]);
const scannerMatch=scanner.match(/^[#ℹ]\s+pass\s+(\d+)/m);
if(!scannerMatch)throw new Error("Cannot read executed scanner test count");
run("read-only feature inventory","node",["inventory-source.mjs"],root);
run("Wasm build/source package","powershell.exe",["-NoProfile","-File",path.join(port,"build.ps1")]);
run("real Chrome PC/mobile verification surface","node",["tests/browser.mjs"]);
const manifest=[];
async function files(directory){
  for(const entry of await readdir(directory,{withFileTypes:true})){
    const full=path.join(directory,entry.name);
    if(entry.isDirectory()){if(!["target","output","dist","catalog"].includes(entry.name))await files(full);}
    else if(entry.isFile()){const bytes=await readFile(full);manifest.push({path:path.relative(root,full).replaceAll(path.sep,"/"),bytes:bytes.length,sha256:createHash("sha256").update(bytes).digest("hex")});}
  }
}
await files(path.join(port,"src"));await files(path.join(port,"locales"));await files(path.join(port,"tests"));await files(path.join(port,"web"));
for(const file of ["Cargo.toml","Cargo.lock","dist/drl_web_port.wasm","dist/source.zip"]){const bytes=await readFile(path.join(port,file));manifest.push({path:"port/"+file,bytes:bytes.length,sha256:createHash("sha256").update(bytes).digest("hex")});}
const evidence={created_at:new Date().toISOString(),scope:"native-source acquisition, reference numeric/RNG and Rust adapters; no original DRL campaign execution",original_core_preserved:true,full_port_complete:false,source_commit:"a6f965072b3a25b768c91dbced00367f1b57d865",engine_commit:"f89735a741a968997656c2d48a003ec569db7f22",native_tests:counts.reduce((sum,item)=>sum+item.passed,0),scanner_tests:Number(scannerMatch[1]),browser:JSON.parse(await readFile(path.join(output,"browser-evidence.json"),"utf8")),results,files:manifest};
await writeFile(path.join(root,"verification.json"),JSON.stringify(evidence,null,2));
console.log(JSON.stringify({result:"pass",native_tests:evidence.native_tests,scanner_tests:evidence.scanner_tests,browser_checks:evidence.browser.checks.length,full_port_complete:false}));
