import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { applyPatches } from '../localization/generate.mjs';
import { rewriteLuaVarargs, adaptLuaLibrary } from '../experiments/lua-wasi/adapt-varargs.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const read = p => fs.readFileSync(path.join(root,p));
const manifest = JSON.parse(read('core-adapted/adaptation-manifest.json'));
for (const f of manifest.files) assert.equal(sha(read('core-adapted/'+f.path)),f.sha256,f.path+' no longer matches generated manifest');
const sdkBindings=['vfmodconst.inc','vfmodtypes.inc','vfmodlibrary.pas','vsteamconst.inc','vsteamtypes.inc','vsteamlibrary.pas'];
assert.deepEqual(manifest.excluded_sdk_bindings,sdkBindings.toSorted());
for(const name of sdkBindings)assert.ok(!fs.existsSync(path.join(root,'core-adapted/fpcvalkyrie/libs',name)),
  'browser reconstruction depends on excluded SDK binding: '+name);

// Check the entire selected rule units against pristine source plus only the
// reviewed semantic manifest and exact, recorded platform/ABI transformations.
// Source provenance does not prove semantic equivalence or campaign behavior.
const ruleUnits = ['dfbeing','dfdata','dfhof','dfitem','dflevel','dfmap','dfplayer','dfthing',
  'drlcommand','drlinventory','drlperk','drlplayer','drltarget','drltraits'];
const semanticManifest=JSON.parse(read('localization/manifest.json'));
const exactRules=[],reviewedRules=[];
for(const name of ruleUnits) {
  const relative='drl/src/'+name+'.pas';
  if(!fs.existsSync(path.join(root,'native',relative)))continue;
  const original=read('native/'+relative),semanticPath='src/'+name+'.pas';
  const semanticPatches=semanticManifest.patches.filter(p=>p.file===semanticPath);
  let expected=original.toString('utf8');
  if(semanticManifest.sources[semanticPath])
    expected=applyPatches(original,semanticManifest.sources[semanticPath],semanticPatches);
  const platform=manifest.changes.filter(c=>c.path===relative);
  for(const change of platform) {
    assert.equal(sha(Buffer.from(expected)),change.original_sha256,relative+' transformation input mismatch: '+change.kind);
    if(typeof change.patch_before==='string') {
      assert.equal(expected.split(change.patch_before).length,2,relative+' platform patch anchor ambiguous');
      expected=expected.replace(change.patch_before,change.patch_after);
    } else if(change.kind==='dated GPL modified-file notice') {
      assert.equal(typeof change.prepend_notice,'string');
      assert.ok(change.prepend_notice.includes('Modified 2026-10-02'));
      expected=change.prepend_notice+expected;
    } else if(change.kind==='fixed WASM C varargs call shape; native branch preserved') {
      const rewritten=rewriteLuaVarargs(expected,relative);
      let adapted=rewritten.source;
      if(relative==='fpcvalkyrie/libs/vlualibrary.pas')adapted=adaptLuaLibrary(adapted);
      assert.equal(rewritten.rewritten_calls,change.rewritten_calls);
      expected='{$IFDEF DRL_WASM}\n'+adapted+'\n{$ELSE}\n'+expected+'\n{$ENDIF}\n';
    } else assert.fail(relative+' contains an unreviewed source replacement: '+change.kind);
    assert.equal(sha(Buffer.from(expected)),change.adapted_sha256,relative+' transformation output mismatch');
  }
  assert.equal(sha(read('core-adapted/'+relative)),sha(Buffer.from(expected)),relative+' source differs outside recorded transformations');
  if(!semanticPatches.length&&!platform.length)exactRules.push(relative);
  else reviewedRules.push({path:relative,semantic_patches:semanticPatches.length,
    semantic_patch_kinds:[...new Set(semanticPatches.map(p=>p.kind))],platform_changes:platform.map(c=>c.kind)});
}
assert.ok(exactRules.length+reviewedRules.length>=10);

const fingerprint=read('core-overlay/drl/src/drlbrowserprobe.pas').toString('utf8');
assert.equal((fingerprint.match(/\.GameRNG\.WriteToStream\(/g)??[]).length,1);
for(const forbidden of [/\.WriteSaveFile\(/,/\.RDWord\b/,/\.RLongInt\b/,/LuaSystem\./,/Player\.Detach/])assert.ok(!forbidden.test(fingerprint),'diagnostic capture has side effects '+forbidden);
assert.deepEqual([...fingerprint.matchAll(/([A-Za-z_][A-Za-z_0-9.]*)\.WriteToStream\(/g)].map(match=>match[1]),
  ['drlbase.DRL.GameRNG'],'diagnostic may serialize only the audited original RNG; level/node saving has side effects');

const result={schema:2,generated_files_checked:manifest.files.length,exact_original_units:exactRules,
  reviewed_rule_source_transformations:reviewedRules,source_outside_recorded_transformations_unchanged:true,
  diagnostic_rng_capture_read_only_source_check:true,compiled_runtime_verified:false};
fs.writeFileSync(path.join(root,'docs/core-overlay-source-evidence.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
