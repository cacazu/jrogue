import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

// Preparation only. This script contains no child-process creation or optimization.
const root=path.dirname(fileURLToPath(import.meta.url));
const sha=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');
const original=JSON.parse(fs.readFileSync(path.join(root,'logs','link-engine.log'),'utf8').split('\n',1)[0]);
const manifest=JSON.parse(fs.readFileSync(path.join(root,'build-manifest.json'),'utf8'));
const candidateRoot=path.join(root,'candidates','o1-conservative-asyncify');
fs.mkdirSync(candidateRoot,{recursive:true});
const frozenConfig=path.join(candidateRoot,'.emscripten');
fs.writeFileSync(frozenConfig,fs.readFileSync(original.EM_CONFIG,'utf8')+'\nFROZEN_CACHE = True\n');
const originalResponse=original.args.find(arg=>arg.startsWith('@')).slice(1);
const responseBytes=fs.readFileSync(originalResponse);
const objectCount=responseBytes.toString('utf8').split(/\r?\n/).filter(Boolean).length;
if(objectCount!==438)throw new Error('Expected 438 whole-engine objects');
const candidateResponse=path.join(candidateRoot,'objects.rsp');
fs.writeFileSync(candidateResponse,responseBytes);
const args=[...original.args],changes=[];
for(let i=0;i<args.length;i++)if(args[i]==='-Os'){changes.push({index:i,from:args[i],to:'-O1'});args[i]='-O1';}
if(changes.length!==1)throw new Error('Expected one link optimization flag');
const rspIndex=args.findIndex(arg=>arg.startsWith('@'));
changes.push({index:rspIndex,from:args[rspIndex],to:'@'+candidateResponse,reason:'Identical response bytes in separate candidate directory'});args[rspIndex]='@'+candidateResponse;
const outputIndex=args.indexOf('-o')+1;
if(outputIndex===0)throw new Error('Missing original output argument');
const candidateOutput=path.join(candidateRoot,'output','cataclysm-tiles.js');
fs.mkdirSync(path.dirname(candidateOutput),{recursive:true});
changes.push({index:outputIndex,from:args[outputIndex],to:candidateOutput,reason:'Separate output; preserves current artifacts'});args[outputIndex]=candidateOutput;
const sdkLinkPath='C:/Users/kit/emsdk/upstream/emscripten/tools/link.py';
const sdkLink=fs.readFileSync(sdkLinkPath,'utf8').split(/\r?\n/);
fs.writeFileSync(path.join(candidateRoot,'sdk-pass-selection.txt'),[
  'Trusted installed Emscripten 6.0.8 tools/link.py SHA256 '+sha(fs.readFileSync(sdkLinkPath)),
  ...sdkLink.slice(295,410).map((line,index)=>String(index+296)+': '+line),
  ...sdkLink.slice(1727,1748).map((line,index)=>String(index+1728)+': '+line),
].join('\n')+'\n');
const candidate={schemaVersion:1,status:'prepared-not-executed',createdUtc:new Date().toISOString(),
  requiresParentHeavyStageCoordination:true,existingPidPreserved:39680,
  executable:'C:/Users/kit/emsdk/python/3.13.3_64bit/python.exe',argv:[original.tool,...args],cwd:root,
  environmentOverrides:{EM_CONFIG:frozenConfig,EM_CACHE:original.EM_CACHE,EM_PORTS:original.EM_PORTS,EMCC_CORES:'1',EMCC_BATCH_BUILD:'0',BINARYEN_CORES:'1'},
  configChanges:{original:original.EM_CONFIG,candidate:frozenConfig,frozenCache:true,portsAndLibraryPathsUnchanged:true},
  unsetEnvironment:['EMSDK','EMSDK_NODE','EMSDK_PYTHON'],argumentChanges:changes,
  source:{upstreamCommit:manifest.upstreamCommit,tag:manifest.upstreamTag,totalUnits:438,responseSha256:sha(responseBytes),
    existingCompileOptimization:'-Os',objectsRecompiled:false,sourceAndObjectsUnmodified:true},
  retained:{asyncify:true,conservativeIndirectCalls:true,defaultAsyncifyImports:true,exceptions:true,idbfs:true,
    includeListChanged:false,excludeListChanged:false,ignoreIndirectEnabled:false,initialAndMaximumMemoryChanged:false},
  rationale:'Installed tools/link.py should_run_binaryen_optimizer returns OPT_LEVEL>=2. Link -O1 retains Asyncify/default conservative call handling while avoiding the -Os default optimization pipeline. Actual final flags and complete browser flows require verification if executed.',
  limits:['This is an unexecuted candidate, not a successful or faster build claim.',
    'No Asyncify call graph edges or callback/save hooks are removed by this argument diff.',
    'Semantic equivalence and IDBFS/UI callback behavior still require the existing full browser verification gate.'],
};
const candidatePath=path.join(candidateRoot,'link-candidate.json');fs.writeFileSync(candidatePath,JSON.stringify(candidate,null,2)+'\n');

const binaryPath='C:/Users/kit/emsdk/upstream/bin/wasm-opt.exe',pe=fs.readFileSync(binaryPath);
const peOffset=pe.readUInt32LE(0x3c);
if(pe.toString('ascii',peOffset,peOffset+4)!=='PE\0\0')throw new Error('Unexpected PE');
const coff=peOffset+4,sectionCount=pe.readUInt16LE(coff+2),optionalSize=pe.readUInt16LE(coff+16),optional=coff+20;
if(pe.readUInt16LE(optional)!==0x20b)throw new Error('Expected PE32+');
const sectionOffset=optional+optionalSize,sections=[];
for(let i=0;i<sectionCount;i++){const offset=sectionOffset+i*40;sections.push({name:pe.toString('ascii',offset,offset+8).replace(/\0.*$/,''),virtualAddress:pe.readUInt32LE(offset+12),rawBytes:pe.readUInt32LE(offset+16)});}
const sdkBin=path.dirname(binaryPath),pdbs=fs.readdirSync(sdkBin).filter(name=>/\.pdb$/i.test(name));
const metadata={generatedUtc:new Date().toISOString(),binaryPath,bytes:pe.length,sha256:sha(pe),
  binaryenVersion:'132 (version_132-16-g89a81ef9b)',coffSymbols:pe.readUInt32LE(coff+12),
  debugDirectoryRva:pe.readUInt32LE(optional+112+6*8),debugDirectoryBytes:pe.readUInt32LE(optional+112+6*8+4),
  sections,pdbFilesInSdkBin:pdbs,dwarfSections:sections.filter(section=>/debug|dwarf/i.test(section.name)),
  conclusion:'Installed binary has no COFF symbol table, debug directory, DWARF sections or adjacent PDB. Unwind metadata exists but does not identify named optimizer passes; no attachment, suspension, dump or profiler installation was attempted.'};
const metadataPath=path.join(root,'evidence','optimizer-binary-metadata.json');fs.mkdirSync(path.dirname(metadataPath),{recursive:true});fs.writeFileSync(metadataPath,JSON.stringify(metadata,null,2)+'\n');
console.log(JSON.stringify({candidate:candidatePath,executed:false,argumentChanges:changes,objectCount,metadata:metadataPath,coffSymbols:metadata.coffSymbols,debugDirectoryBytes:metadata.debugDirectoryBytes,pdbs,dwarfSections:metadata.dwarfSections},null,2));
