/* Read-only proof of the frozen collector's two CRLF text-hash difference.
 * This never edits JS, parses a game event, instantiates WASM or queries C. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,realpath} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const commandHash=argv=>hash(Buffer.from(JSON.stringify(argv),'utf8'));

export async function verifyJsNormalization({root,config,engine,webRoot,bound,json}) {
  const proof=await json(config.js_normalization_proof);
  assert.equal(proof.schema_version,1);assert.equal(proof.status,'passed');
  assert.equal(proof.kind,'raw-JS-to-recorded-universal-newline-text');
  assert.equal(proof.compiler_executed,false);assert.equal(proof.runtime_executed,false);
  for(const name of ['installed_identical_to_raw','loader_unchanged','manifest_preserved','runtime_preserved'])assert.equal(proof[name],true);
  assert.equal(proof.postprocessing_performed,false);
  async function evidence(ref){const bytes=await bound(ref);assert.equal(bytes.length,ref.bytes);return bytes;}
  const actualPath=ref=>realpath(resolve(root,ref.path));
  assert.equal(proof.candidate_manifest.path,config.engine_manifest.path);assert.equal(proof.candidate_manifest.sha256,config.engine_manifest.sha256);
  assert.deepEqual(JSON.parse((await evidence(proof.candidate_manifest)).toString('utf8')),engine);
  assert.equal(proof.generator_manifest.path,config.generator_manifest.path);assert.equal(proof.generator_manifest.sha256,config.generator_manifest.sha256);await evidence(proof.generator_manifest);
  const stage=dirname(await realpath(resolve(root,config.engine_manifest.path)));
  assert.equal(await actualPath(proof.compile_embed_evidence),resolve(stage,'compile-embed-evidence.json'));
  const captured=JSON.parse((await evidence(proof.compile_embed_evidence)).toString('utf8'));
  assert.deepEqual(captured.embedded_data,engine.embedded_data);assert.deepEqual(captured.compile_evidence,engine.compile_evidence);
  assert.equal(proof.certificate_source.path,'tools/semantic-text/phase6-js-certificate/certify.py');
  assert.equal(proof.provenance_source.path,'tools/semantic-text/phase6-integration/provenance.py');
  await evidence(proof.certificate_source);await evidence(proof.provenance_source);
  assert.equal(await actualPath(proof.raw_js),resolve(stage,'nethack.js'));
  assert.equal(await actualPath(proof.installed_js),resolve(webRoot,'engine/nethack.js'));
  const raw=await evidence(proof.raw_js),installed=await evidence(proof.installed_js);
  assert.ok(raw.equals(installed));
  const rawText=new TextDecoder('utf-8',{fatal:true}).decode(raw);assert.ok(Buffer.from(rawText,'utf8').equals(raw));
  assert.equal(hash(raw),config.expected_runtime_sha256['engine/nethack.js']);assert.equal(hash(raw),engine.artifacts['nethack.js'].sha256);
  assert.equal(raw.length,engine.artifacts['nethack.js'].bytes);assert.equal(raw.length,102556);
  const offsets=[];let crCount=0;
  for(let i=0;i<raw.length;i++)if(raw[i]===13){crCount++;if(raw[i+1]===10)offsets.push(i);}
  const normalization=proof.normalization;
  assert.deepEqual(offsets,[102502,102554]);assert.deepEqual(offsets,normalization.crlf_offsets);
  assert.equal(crCount,2);assert.equal(normalization.crlf_count,2);assert.equal(normalization.bare_cr_count,0);
  assert.equal(normalization.only_crlf_to_lf,true);assert.equal(normalization.operation,'UTF-8 Path.read_text universal newline conversion');
  const normalized=Buffer.from(rawText.replace(/\r\n/g,'\n'),'utf8');
  assert.equal(normalized.length,102554);assert.equal(normalized.length,normalization.normalized_bytes);
  assert.equal(hash(normalized),normalization.normalized_sha256);assert.equal(hash(normalized),normalization.recorded_sha256);
  assert.equal(hash(normalized),engine.embedded_data.emitted_js.sha256);
  let restored=normalized;
  for(let i=offsets.length-1;i>=0;i--){const offset=offsets[i]-i;assert.equal(restored[offset],10);restored=Buffer.concat([restored.subarray(0,offset),Buffer.from([13]),restored.subarray(offset)]);}
  assert.ok(restored.equals(raw));
  const pattern=/var __emscripten_fs_load_embedded_files=ptr=>\{do\{.*?\}while\(HEAPU32\[ptr>>2\]\)\};/gs;
  const loader=rawText.match(pattern),normalizedLoader=normalized.toString('utf8').match(pattern);
  assert.equal(loader?.length,1);assert.deepEqual(loader,normalizedLoader);
  for(const token of ['var name_addr=HEAPU32[ptr>>2]','var len=HEAPU32[ptr>>2]','var content=HEAPU32[ptr>>2]','HEAP8.subarray(content,content+len)'])assert.ok(loader[0].includes(token));
  const actual=proof.raw_embedded_data;
  assert.equal(actual.emitted_js.sha256,hash(raw));assert.equal(hash(Buffer.from(loader[0],'utf8')),actual.emitted_js.loader_sha256);
  assert.equal(actual.emitted_js.loader_sha256,engine.embedded_data.emitted_js.loader_sha256);
  assert.deepEqual(actual.datafile_entry,engine.embedded_data.datafile_entry);assert.deepEqual(actual.emitted_wasm,engine.embedded_data.emitted_wasm);assert.equal(actual.runtime_fs_verified,false);
  assert.equal(await actualPath(proof.wasm),resolve(stage,'nethack.wasm'));
  const wasm=await evidence(proof.wasm);assert.ok(wasm.equals(await readFile(resolve(webRoot,'engine/nethack.wasm'))));
  assert.equal(hash(wasm),config.expected_runtime_sha256['engine/nethack.wasm']);assert.equal(hash(wasm),engine.artifacts['nethack.wasm'].sha256);assert.equal(wasm.length,engine.artifacts['nethack.wasm'].bytes);
  assert.deepEqual(proof.compile_membership,{units:177,unique_sources:177,all_passed:true,exact_compiled_input_membership:true,command_hashes_validated:true});
  const units=engine.compile_evidence.units,expected=new Map(engine.compiled_input_hashes.map(row=>[row.path.replace(/\\/g,'/'),row.sha256]));
  const names=units.map(row=>row.source.replace(/\\/g,'/'));
  assert.equal(units.length,177);assert.equal(new Set(names).size,177);assert.deepEqual([...new Set(names)].sort(),[...expected.keys()].sort());
  for(const [index,unit] of units.entries()){assert.equal(unit.status,'passed');assert.equal(unit.source_sha256,expected.get(names[index]));assert.ok(unit.argv.includes('-c'));assert.equal(commandHash(unit.argv),unit.command_sha256);}
  assert.equal(commandHash(engine.embedded_data.link.argv),engine.embedded_data.link.command_sha256);
  return {proof_sha256:config.js_normalization_proof.sha256,raw_sha256:hash(raw),recorded_text_sha256:hash(normalized),crlf_offsets:offsets,postprocessing_performed:false,loader_unchanged:true};
}
