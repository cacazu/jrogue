#!/usr/bin/env node
// GPL-3.0-or-later. STAGED SOURCE: parent executes sequentially when permitted.
// Creates a derived one-call leaf and separate semantic delta in this folder.
// Pristine source and official catalogs stay unchanged. No Lua runs here.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {sourceCommit} from './precision-policy.mjs';

const directory=import.meta.dirname;
const output=path.join(directory,'dream-stage');
const roots=JSON.parse(fs.readFileSync(path.join(directory,'../inventory-work/inventory-output/summary.json'),'utf8')).sourceRoots;
const unpacked=path.resolve(process.argv[2]??roots[1]);
const file='game/modules/tome/data/timed_effects/other.lua';
const japaneseFile='game/engines/default/data/locales/engine/ja_JP.lua';
const sourcePath=path.join(unpacked,file),japanesePath=path.join(unpacked,japaneseFile);
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const sourceBytes=fs.readFileSync(sourcePath),japaneseBytes=fs.readFileSync(japanesePath);
assert.equal(hash(sourceBytes),'0ebac2cda64f72fb4e94460bac4560b2b541db31e392aa521cc2caccf44818f7','Original effect source differs');
assert.equal(hash(japaneseBytes),'09b74f2aefd11732c6d6be2543ebf8cdc0126ae0849f5d3ccb31b8b739983f09','Official Japanese source differs');
const source=sourceBytes.toString('utf8'),lines=source.split(/\r?\n/);
assert.deepEqual(Buffer.from(source,'utf8'),sourceBytes,'Original effect file is not exact round-trip UTF-8');
const before='\t\tgame:delayedLogDamage(eff, self, val, ("%s%d %s#LAST#"):tformat(DamageType:get(DamageType.MIND).text_color or "#aaaaaa#", math.ceil(val), "dream"), false)';
const after='\t\tgame:delayedLogDamage(eff, self, val, ("%s%d %s#LAST#"):tformat(DamageType:get(DamageType.MIND).text_color or "#aaaaaa#", math.ceil(val), _t("dream", "effect damage label death_dream")), false)';
assert.equal(lines[3177],'\tname = "DEATH_DREAM", image = "talents/sleep.png",','Wrong effect owner');
assert.equal(lines[3184],before,'Wrong exact producer line');
assert.equal(source.split(before).length,2,'The audited producer must occur exactly once');
const japanese='\u5922';
assert.equal(japaneseBytes.toString('utf8').split(/\r?\n/)[62],`t("dream", "${japanese}", "nil")`,'Official shared nil translation differs');
const derived=source.replace(before,after),derivedBytes=Buffer.from(derived,'utf8');
// Only this exact third argument changes; no state, RNG, amount or wrapper does.
assert.equal(derived.replace(after,before),source,'Derived source contains an extra change');
const owner='game.modules.tome.data.timed_effects.other.effect.death_dream.method.on_timeout';
const id=owner+'.property.damage_label',tag='effect damage label death_dream';
const location={source_root_id:'root_2',file,line:3185,column:after.indexOf('_t("dream"')+1,overlay:true};
const registration={file:japaneseFile,line:63,section:'.always_merge',tag:'nil',source:'dream',japanese,sha256:hash(japaneseBytes)};
const entry={owner,tag,japanese_args_order:[],special_tokens:[],
 printf_contract:{safe:true,status:'compatible_original_printf_arguments',source:[],target:[],order:[]},
 source_locations:[location],source_kinds:['reviewed_source_overlay:explicit_translation_call'],native_effective_metadata_validation_required:true};
const english={[id]:'dream'},japaneseMap={[id]:japanese};
const registry={schema_version:1,source_commit:sourceCommit,default_locale:'ja_JP',japanese_configuration:[],entries:{[id]:entry},
 routes:[{source:'dream',tag,default_id:id,aliases:[id],format_ambiguity:false}]};
const provenance={source_call:'authored_contextual_hook',translation:'official_nil_fallback_reuse',official_registration:registration};
const extension={schema_version:1,source_commit:sourceCommit,english,japanese:japaneseMap,registry,provenance};
fs.mkdirSync(path.join(output,'overlay',path.dirname(file)),{recursive:true});
const leaf=path.join(output,'overlay',file);
fs.writeFileSync(leaf,derivedBytes);
const write=(name,value)=>fs.writeFileSync(path.join(output,name),JSON.stringify(value,null,2)+'\n');
write('en.json',english);write('ja.json',japaneseMap);write('registry.json',registry);
write('dream-registry-extension.json',extension);
fs.writeFileSync(path.join(output,'death-dream-contextual-hook.patch'),
 `--- a/${file}\n+++ b/${file}\n@@ -3185,1 +3185,1 @@\n-${before}\n+${after}\n`);
const manifest={schema_version:1,source_commit:sourceCommit,semantic_id:id,tag,
 original:{file,bytes:sourceBytes.length,sha256:hash(sourceBytes)},
 derived:{file:'overlay/'+file,bytes:derivedBytes.length,sha256:hash(derivedBytes)},
 changed_callsite:{line:3185,before,after,original_literal_column:before.indexOf('"dream"')+1,semantic_hook_column:location.column},
 provenance,translation_is_authored:false,source_hook_is_authored:true,
 official_catalog_modified:false,original_source_modified:false,gameplay_or_rng_called:false,
 native_runtime_verified:false,counts_separate_from_official_missing_overlay:true,
 host_requirement:'Select this exact source/tag route before original-catalog unknown-tag fallback; preserve the original active shared nil translation and metadata.',
 memory:process.memoryUsage()};
write('dream-stage-manifest.json',manifest);
// Bound source checking after staged output. The original is never overwritten.
assert.equal(hash(fs.readFileSync(sourcePath)),manifest.original.sha256,'Original source changed during staging');
assert.equal(hash(fs.readFileSync(japanesePath)),registration.sha256,'Official locale changed during staging');
console.log(JSON.stringify({semantic_id:id,derived_sha256:manifest.derived.sha256,original_unchanged:true,output,memory:process.memoryUsage()}));
