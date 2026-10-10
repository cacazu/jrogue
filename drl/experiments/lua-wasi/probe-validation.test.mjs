import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateProbeOutput,validateDigest,validateBuildInputs} from './probe-validation.mjs';
import {auditAllocatorMap} from './link-validation.mjs';
import {auditMixedSources} from './source-audit.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const fixture=JSON.parse(fs.readFileSync(path.join(root,'node-mixed-evidence.json'),'utf8')).output;
const map=fs.readFileSync(path.join(root,'mixed-build/mixed.map'),'utf8');
const refs=fs.readFileSync(path.join(root,'allocator-symbol-refs.log'),'utf8');
test('Actual successful mixed result satisfies the complete contract',()=>assert.deepEqual(validateProbeOutput('mixed',fixture),[]));
test('Exit-zero placeholder JSON cannot certify an ABI run',()=>assert.notEqual(validateProbeOutput('mixed',{}).length,0));
test('Each required mixed result field is enforced',()=>{
  for(const key of Object.keys(fixture)){
    const copy={...fixture};delete copy[key];
    assert.notEqual(validateProbeOutput('mixed',copy).length,0,key);
  }
});
test('An allocation/stdio/semantic failure cannot be masked by other passing fields',()=>{
  for(const [key,value] of [['allocator_patterns',false],['allocator_oom_retains_old_block',false],
    ['stdio_file_io',false],['platform_semantic_callbacks',2],['error_callbacks',2000],['gc_iterations',4999],['pascal_finally_count',1]])
    assert.notEqual(validateProbeOutput('mixed',{...fixture,[key]:value}).length,0,key);
});
test('Heap counts are numeric, bounded and retain the measured 4096-byte tolerance',()=>{
  for(const value of ['42512',0,NaN,Number.MAX_SAFE_INTEGER])assert.notEqual(validateProbeOutput('mixed',{...fixture,error_heap_second:value}).length,0);
  assert.deepEqual(validateProbeOutput('mixed',{...fixture,error_heap_second:fixture.error_heap_first+4096}),[]);
  assert.notEqual(validateProbeOutput('mixed',{...fixture,error_heap_second:fixture.error_heap_first+4097}).length,0);
});
test('JSPI has its own exact callback count and suspension contract',()=>{
  const jspi={...fixture,suspended_pascal_callbacks:1,error_callbacks:2002};
  assert.deepEqual(validateProbeOutput('mixed-jspi',jspi),[]);
  assert.notEqual(validateProbeOutput('mixed',jspi).length,0);
  assert.notEqual(validateProbeOutput('mixed-jspi',fixture).length,0);
});
test('Wrong variants and result types are rejected',()=>{
  for(const variant of ['mixed-jsp','unknown'])assert.notEqual(validateProbeOutput(variant,fixture).length,0);
  for(const output of [null,[],true,'pass'])assert.notEqual(validateProbeOutput('mixed',output).length,0);
});
test('Recorded digest mismatches and missing digests fail closed',()=>{
  const a='a'.repeat(64),b='b'.repeat(64);
  assert.deepEqual(validateDigest('fixture',a,a),[]);
  for(const recorded of [b,null,'not-a-digest'])assert.notEqual(validateDigest('fixture',recorded,a).length,0);
});
const inputFixture={schema_version:1,inputs_stable:true,errors:[],
  inputs_before:[{path:'probe.pas',kind:'pascal-source',sha256:'a'.repeat(64)},
    {path:'system.o',kind:'rtl-object',sha256:'b'.repeat(64)}],
  inputs_after:[{path:'probe.pas',kind:'pascal-source',sha256:'a'.repeat(64)},
    {path:'system.o',kind:'rtl-object',sha256:'b'.repeat(64)}]};
test('Build-time input snapshots require unchanged source and selected RTL inputs',()=>{
  assert.deepEqual(validateBuildInputs(inputFixture,['probe.pas','system.o']),[]);
  const changed=structuredClone(inputFixture);changed.inputs_after[0].sha256='c'.repeat(64);
  assert.notEqual(validateBuildInputs(changed).length,0);
  assert.notEqual(validateBuildInputs(inputFixture,['missing-used-unit.o']).length,0);
});
test('Historical, unstable, duplicate and incomplete provenance cannot pass',()=>{
  const duplicate=structuredClone(inputFixture);duplicate.inputs_after[1]=duplicate.inputs_after[0];
  for(const snapshot of [undefined,{...inputFixture,inputs_stable:false},duplicate,
    {...inputFixture,inputs_after:[]},{...inputFixture,errors:['input changed']}])
    assert.notEqual(validateBuildInputs(snapshot).length,0);
});
test('Actual link map has one Pascal owner for all seven allocator symbols',()=>assert.deepEqual(auditAllocatorMap(map,refs).errors,[]));
test('Independent allocator selection and ambiguous owner fail static audit',()=>{
  assert.notEqual(auditAllocatorMap(map+'\nlibc.a(dlmalloc.c.obj)\n',refs).errors.length,0);
  assert.notEqual(auditAllocatorMap(map.replaceAll('drl_c_allocator.o','fake_drl_c_allocator.o'),refs).errors.length,0);
});
test('Empty or malformed allocator inventory fails static audit',()=>{
  for(const inventory of ['',refs+'\nnot-an-nm-reference'])assert.notEqual(auditAllocatorMap(map,inventory).errors.length,0);
});
test('Current compiler/archives/bridge/Lua sources match recorded mixed inputs without WASM execution',async()=>{
  const audit=await auditMixedSources(root);
  assert.deepEqual(audit.errors,[]);
  assert.equal(audit.result,'pass');
  const record=JSON.parse(fs.readFileSync(path.join(root,audit.build_record),'utf8').replace(/^\uFEFF/,''));
  assert.equal(audit.complete_provenance,Boolean(record.provenance),'historical manifests must not retroactively certify uncaptured Pascal/RTL inputs');
  const mismatch=await auditMixedSources(root,'mixed','0'.repeat(64));
  assert.equal(mismatch.result,'fail');
  assert.ok(mismatch.errors.includes('Linked module: SHA-256 mismatch'));
});
