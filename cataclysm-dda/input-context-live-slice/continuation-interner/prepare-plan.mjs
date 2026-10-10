import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const HERE=path.dirname(fileURLToPath(import.meta.url)),SLICE=path.dirname(HERE),ROOT=path.dirname(SLICE);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const pin=f=>{f=path.resolve(f);const b=fs.readFileSync(f);return{path:f,bytes:b.length,sha256:sha(b)}};
const demand=(ok,message)=>{if(!ok)throw Error(message)};
const oldName=path.join(SLICE,'fixture-plan.json'),oldBytes=fs.readFileSync(oldName);
demand(sha(oldBytes)==='1eba4f012fa418c0fd5bf6848e5ef0626924805e7a708168e2d68ddf8978e993','initial accepted plan changed');
const old=JSON.parse(oldBytes),records=new Map();
function add(r){const actual=pin(r.path);demand(actual.bytes===r.bytes&&actual.sha256===r.sha256,'protected input changed: '+r.path);const key=actual.path.toLowerCase(),prior=records.get(key);demand(!prior||prior.sha256===actual.sha256,'conflicting input pin');records.set(key,actual);}
for(const r of old.pins)add(r);
const proofName=path.join(SLICE,'INITIAL-NATIVE-VERIFICATION.json'),proof=JSON.parse(fs.readFileSync(proofName,'utf8'));
demand(proof.status==='original-member-compile-passed-interner-link-dependency-blocked'&&proof.compilePassed&&
 !proof.linkPassed&&!proof.NodeWasmExecuted&&proof.nativeJsonRecords===0&&proof.allOwnedRootsAndJobsClosed&&
 proof.all233ProtectedFilesUnchanged&&proof.frozenSdkCacheAndPortsUnchanged,'initial proof/closure invalid');
add(proof.compiledObject);add(proof.dependencyFile);add(proof.terminal);add(pin(proofName));
const internerObject=path.join(ROOT,'engine-build/objects/string_id.o');
const interner=pin(internerObject);demand(interner.bytes===18239&&interner.sha256==='6e1540527a927e3d43fe3d884f1790b06f32a60a74c52c78aea115884f61ff13','actual original interner object changed');add(interner);
const upstream=path.join('C:/Users/kit/gameme/jnethack/jrouge/cataclysm-dda/upstream/Cataclysm-DDA-'+old.sourceCommit,'src');
const tree=JSON.parse(fs.readFileSync(path.join(ROOT,'audit/github-stable-tree.json'),'utf8'));
for(const n of ['string_id.cpp','string_id.h']){
 const name=path.join(upstream,n),bytes=fs.readFileSync(name);
 const git=crypto.createHash('sha1').update(Buffer.concat([Buffer.from('blob '+bytes.length+'\0'),bytes])).digest('hex');
 demand(tree.tree.find(x=>x.path==='src/'+n&&x.type==='blob')?.sha===git,'official interner source mismatch');add(pin(name));
}
const dependency=path.join(ROOT,'engine-build/objects/string_id.d');
const d=fs.readFileSync(dependency,'utf8').replaceAll(/\\\r?\n/g,' ').split('\n')[0];
const deps=d.slice(d.indexOf(': ')+2).trim().split(/\s+/).map(p=>path.resolve(p));
demand(deps.length===2&&deps.includes(path.resolve(path.join(upstream,'string_id.cpp')))&&deps.includes(path.resolve(path.join(upstream,'string_id.h'))),'original interner MMD not exact');
add(pin(dependency));
const logName=path.join(ROOT,'engine-build/logs/compile-src_string_id_cpp.log');
const log=JSON.parse(fs.readFileSync(logName,'utf8').split('\n')[0]);
const base=JSON.parse(fs.readFileSync(path.join(ROOT,'integration-overlay/build-plan/cpp-compile/compile-plan.json'),'utf8'));
demand(JSON.stringify(log.args.slice(0,base.baseline.exactBaseFlagsPreserved.length))===JSON.stringify(base.baseline.exactBaseFlagsPreserved),'original interner compiler flags differ');
demand(log.args.includes(path.join(upstream,'string_id.cpp').replaceAll('\\','/'))&&log.args.at(-1)===internerObject,'interner compile source/output provenance mismatch');
add(pin(logName));
for(const name of ['test-wasm.mjs','module-build-id.txt']){
 const original=path.join(SLICE,name),bytes=fs.readFileSync(original);const target=path.join(HERE,name);
 if(fs.existsSync(target))demand(fs.readFileSync(target).equals(bytes),'existing continuation input differs');else fs.writeFileSync(target,bytes);
 add(pin(original));add(pin(target));
}
for(const name of [oldName,path.join(SLICE,'run-context-window.py'),path.join(HERE,'prepare-plan.mjs'),path.join(ROOT,'engine-build/build-manifest.json')])add(pin(name));
const build=path.join(HERE,'build');
const link={...old.commands[1],cwd:HERE,stage:'link-original-context-with-original-interner',
 argv:[...old.commands[1].argv],outputs:[path.join(build,'original-input-context.mjs'),path.join(build,'original-input-context.wasm')]};
link.argv.splice(link.argv.indexOf(proof.compiledObject.path)+1,0,internerObject);
link.argv[link.argv.length-1]=link.outputs[0];
const execute={...old.commands[2],cwd:HERE,stage:'execute-selected-original-input-context',
 argv:[...old.commands[2].argv.slice(0,-1),path.join(HERE,'test-wasm.mjs')],outputs:[path.join(HERE,'execution/wasm-results/verification.json')]};
const plan={...old,status:'source-prepared-fresh-link-and-node-continuation-no-launch',
 pins:[...records.values()].sort((a,b)=>a.path.localeCompare(b.path)),commands:[link,execute],
 successfulOriginalMemberCompile:proof.compiledObject,initialNativeProof:pin(proofName),initialAttemptTerminal:proof.terminal,
 actualOriginalInterner:interner,internerSource:pin(path.join(upstream,'string_id.cpp')),internerDependencies:deps.map(pin),
 internerProvenance:{compilerFlagsMatch:true,sameSourceCommit:true,sourceGitBlobMatches:true,MMDExactTwoDependencies:true},
 successfulCompileReused:true,compilerRerun:false,previousAttemptReplaced:false,syntheticInterner:false,
 newStageCount:2,nextLaunchGate:'Separate root release and independent exact-owner review required; fresh continuation output tree; all existing browser priority/resource/job guards unchanged.'};
fs.writeFileSync(path.join(HERE,'fixture-plan.json'),JSON.stringify(plan,null,2)+'\n');
console.log(JSON.stringify({status:plan.status,pins:plan.pins.length,plan:pin(path.join(HERE,'fixture-plan.json')),compiledOriginal:proof.compiledObject,actualInterner:interner}));
