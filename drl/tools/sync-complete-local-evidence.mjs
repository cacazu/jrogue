// Copy source-generation and browser supporting evidence only into owned DRL.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url));
const repository=path.resolve('C:/Users/kit/gameme/jnethack/jrouge'),destination=path.join(repository,'drl');
if((await fs.realpath(repository)).toLowerCase()!==repository.toLowerCase())throw Error('Shared repository physical path differs');
const excludedSdkBindings=new Set(['vfmodconst.inc','vfmodtypes.inc','vfmodlibrary.pas','vsteamconst.inc','vsteamtypes.inc','vsteamlibrary.pas']);
const records=[];const hash=b=>createHash('sha256').update(b).digest('hex');
async function safe(p,base){let q=p;for(;;){try{const s=await fs.lstat(q);if(s.isSymbolicLink())throw Error('Checkpoint symlink rejected');}catch(e){if(e.code!=='ENOENT')throw e;}if(q.toLowerCase()===base.toLowerCase())break;q=path.dirname(q);if(!q.toLowerCase().startsWith(base.toLowerCase()+path.sep)&&q.toLowerCase()!==base.toLowerCase())throw Error('Checkpoint escaped confinement');}}
async function copy(relative,expected){if(!relative||/[\\:]/.test(relative)||relative.split('/').some(p=>!p||p==='.'||p==='..'))throw Error('Unsafe checkpoint relative path');const from=path.resolve(root,relative),to=path.resolve(destination,relative);if(!from.toLowerCase().startsWith(root.toLowerCase())||!to.toLowerCase().startsWith(destination.toLowerCase()+path.sep))throw Error('Checkpoint escaped roots');await safe(from,path.resolve(root));await safe(to,repository);const bytes=await fs.readFile(from),sha256=hash(bytes);if(expected&&sha256!==expected)throw Error('Supporting evidence changed: '+relative);await fs.mkdir(path.dirname(to),{recursive:true});await safe(to,repository);await fs.writeFile(to,bytes);if(hash(await fs.readFile(from))!==sha256||hash(await fs.readFile(to))!==sha256)throw Error('Checkpoint copy changed');records.push({path:relative,size:bytes.length,sha256});}
async function tree(relative){const entries=await fs.readdir(path.join(root,relative),{withFileTypes:true});for(const f of entries){if(f.isSymbolicLink())throw Error('Generated source symlink');if(f.name==='build'||excludedSdkBindings.has(f.name.toLowerCase()))continue;const rel=relative+'/'+f.name;if(f.isDirectory())await tree(rel);else if(f.isFile()&&!/\.(o|ppu|wasm|a|exe|dll)$/i.test(f.name))await copy(rel);}}
await tree('core-adapted');
for(const f of ['link-evidence.json','drl-core.map','memory-evidence.json','compile-link.log'])await copy('core-adapted/build/browser-core/'+f);
const game=JSON.parse(await fs.readFile(path.join(root,'docs/ORIGINAL-GAME-RUNTIME-EVIDENCE.json'),'utf8'));
if(game.result!=='pass'||game.checks.length!==15)throw Error('Current primary browser evidence missing');
await copy('port/tests/output/original-game/evidence.json');await copy('port/tests/output/original-game/native-save-snapshot.json');
for(const shot of game.screenshots)await copy('port/tests/output/original-game/'+shot.file,shot.sha256);
const combat=JSON.parse(await fs.readFile(path.join(root,'docs/ORIGINAL-COMBAT-RUNTIME-EVIDENCE.json'),'utf8'));
if(combat.result!=='pass'||combat.checks.length!==6)throw Error('Current combat evidence missing');
await copy('port/tests/output/original-combat/evidence.json');
for(const shot of combat.observations){if(!/^frame-\d{3}\.json$/.test(shot.file))throw Error('Unexpected combat frame path');await copy('port/tests/output/original-combat/'+shot.file,shot.sha256);}
const death=JSON.parse(await fs.readFile(path.join(root,'docs/ORIGINAL-DEATH-RUNTIME-EVIDENCE.json'),'utf8'));
if(death.result!=='pass'||death.artifacts.core.sha256!==game.artifacts['drl-core.wasm'].sha256||death.artifacts.adapter.sha256!==game.artifacts['drl_web_port.wasm'].sha256)throw Error('Current death evidence missing or mismatched');
await copy('port/tests/output/original-death/evidence.json');await copy('port/tests/output/original-death/native-death-snapshot.json');
for(const shot of death.screenshots)await copy('port/tests/output/original-death/'+shot.file,shot.sha256);
for(const shot of death.observations){if(!/^frame-\d{3}\.json$/.test(shot.file))throw Error('Unexpected death frame path');await copy('port/tests/output/original-death/'+shot.file,shot.sha256);}
for(const f of ['core-host-browser.json','current-rust-tests-memory.json','current-rust-tests-memory.json.stdout.log','current-clippy-memory.json','current-wasm-memory.json','current-host-browser-memory.json'])await copy('port/tests/output/'+f);
const result={schema:1,scope:'Generated original source and exact selected supporting evidence; no game objects/compiler caches copied',recorded_utc:new Date().toISOString(),destination,core_sha256:game.artifacts['drl-core.wasm'].sha256,adapter_sha256:game.artifacts['drl_web_port.wasm'].sha256,files:records.length,records,full_port_complete:false};
const bytes=JSON.stringify(result,null,2)+'\n';await fs.writeFile(path.join(root,'docs/LOCAL-SUPPORT-CHECKPOINT.json'),bytes);await fs.writeFile(path.join(destination,'docs/LOCAL-SUPPORT-CHECKPOINT.json'),bytes);console.log(JSON.stringify({files:records.length,destination,core:result.core_sha256}));
