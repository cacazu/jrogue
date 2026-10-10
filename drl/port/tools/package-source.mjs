import {cp, mkdir, mkdtemp, readFile, writeFile} from "node:fs/promises";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import os from "node:os";
import path from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url));
const stage = await mkdtemp(path.join(os.tmpdir(), "drl-corresponding-source-"));
const destination = path.join(stage, "drl-rust-migration");
await mkdir(destination);
for (const file of ["src","tests","locales","tools","web","licenses","Cargo.toml","Cargo.lock","build.ps1","README.md"]) {
  await cp(path.join(root,file),path.join(destination,file),{recursive:true,filter:source=>!source.includes(path.sep+"output"+path.sep)});
}
await writeFile(path.join(destination,"SOURCE-NOTICE.txt"),"DRL Rust migration source; campaign not yet ported. Original DRL https://github.com/chaosforgeorg/drl/tree/0_10_11a GPL 2.0; engine RNG and source credits in licenses. Cargo.lock pins dependencies. No original audio, FMOD, Steam or original game binary included.\n");
await mkdir(path.join(root,"dist"),{recursive:true});
// Windows-native archive, absolute targets, no deletion and no shell-built command text.
const script = path.join(stage,"archive.ps1");
await writeFile(script,"param([string]$Source,[string]$Destination)\n$ErrorActionPreference='Stop'\nCompress-Archive -LiteralPath $Source -DestinationPath $Destination -Force\n");
execFileSync("powershell.exe",["-NoProfile","-File",script,"-Source",destination,"-Destination",path.join(root,"dist","source.zip")],{windowsHide:true,stdio:"inherit"});
const wasm = await readFile(path.join(root,"dist","drl_web_port.wasm"));
await writeFile(path.join(root,"dist","build.json"),JSON.stringify({scope:"migration verification only",source_commit:"a6f965072b3a25b768c91dbced00367f1b57d865",wasm_bytes:wasm.length,created_at:new Date().toISOString()},null,2));
