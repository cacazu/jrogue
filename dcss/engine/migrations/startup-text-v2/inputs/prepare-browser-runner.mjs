// Reuses the already reviewed Chrome ownership/cleanup driver, source only.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url)),game='C:/Users/kit/gameme/jnethack/jrouge/dcss';
let source=fs.readFileSync(path.join(game,'tests/controlled-core-browser.mjs'),'utf8');
source=source.replace("import { verifyControlledGameFlow, verifyControlledSource, nativeFrameRows, classifyStartingWeaponMenu } from './controlled-gameplay-browser.mjs';",
  "import { verifyControlledSource, nativeFrameRows } from './controlled-gameplay-browser.mjs';\nimport { verifyNativeDynamicStartup } from './native-dynamic-startup-browser.mjs';");
const argumentStart=source.indexOf('const flowArgs'),argumentEnd=source.indexOf('const runtime',argumentStart);
if(argumentStart<0||argumentEnd<argumentStart)throw Error('driver argument boundary');
source=source.slice(0,argumentStart)+[
  "const selected=process.argv.slice(2);",
  "assert(selected.length>=1&&selected.length<=2,'use --language=ja|en [--named]');",
  "const language=selected[0].match(/^--language=(ja|en)$/)?.[1];assert(language);",
  "const named=selected[1]==='--named';assert(selected.length===1||named);",
  "const flow='startup-'+language+'-'+(named?'named':'unnamed');",
  "",
].join('\n')+source.slice(argumentEnd);
source=source.replace("assert(['asyncify', 'jspi'].includes(runtime), 'unsupported engine mode');","assert.equal(runtime,'jspi','dynamic native UI candidate requires the production JSPI runtime');");
source=source.replace('output/core-gameflows','output/native-startup-v2');
source=source.replace("scope: 'controlled official C++ WIZARD fixtures in local Chrome; not a normal unassisted full playthrough'",
  "scope: 'actual original-engine character menus/newgame/ordinary wait/native save/quit in local Chrome; no WIZARD'");
const queryStart=source.indexOf("  const coreQuery = "),queryEnd=source.indexOf('\n',queryStart);
if(queryStart<0)throw Error('driver navigation query boundary');
source=source.slice(0,queryStart)+"  const coreQuery = '?reference=1';"+source.slice(queryEnd);
const begin=source.indexOf("  await until(() => cdp.eval('Boolean(window.__dcssCore?.waiting)')"),finish=source.indexOf("  assert.equal(evidence.runtimeErrors.length",begin);
const captureStart=source.indexOf('  const capture = async name => {',begin),captureEnd=source.indexOf('\n  };',captureStart)+5;
if(begin<0||finish<begin||captureStart<begin||captureEnd<captureStart)throw Error('driver bounded fixture replacement');
const capture=source.slice(captureStart,captureEnd);
source=source.slice(0,begin)+[
  "  await until(()=>cdp.eval('Boolean(window.__dcssVerification?.call)&&__dcssVerification.mode===\"reference\"'),'explicit reference host ready without default engine');",
  "  await cdp.eval('document.querySelector(\"#language\").value='+JSON.stringify(language)+';document.querySelector(\"#language\").dispatchEvent(new Event(\"change\"))');",
  capture,
  "  await verifyNativeDynamicStartup({cdp,until,language,named,evidence,capture});",
  "",
].join('\n')+source.slice(finish);
source=source.replace("} catch (error) { evidence.result = 'fail'; evidence.error = error.stack; process.exitCode = 1; }",
  "} catch (error) { evidence.result='fail';evidence.error=error.stack;process.exitCode=1;if(cdp)try{evidence.failure_native=await cdp.eval('({frame:__dcssVerification?.frame,waiting:window.__dcssDynamicCore?.waiting,error:window.__dcssDynamicCore?.error,completed:window.__dcssDynamicCore?.completed})');}catch(snapshotError){evidence.failure_snapshot_error=String(snapshotError);} }");
const file=path.join(root,'tests/dynamic-startup-browser.mjs');fs.writeFileSync(file,source);
console.log(JSON.stringify({ok:true,source_only:true,file}));
