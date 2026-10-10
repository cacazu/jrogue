#!/usr/bin/env node
// GPL-3.0-or-later. Static source evidence only; no actors/gameplay are created.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const roots=JSON.parse(fs.readFileSync(new URL('../inventory-work/inventory-output/summary.json',import.meta.url),'utf8')).sourceRoots;
const root=roots[1],name='wolf',japanese='\u30aa\u30aa\u30ab\u30df',tag='entity name';
const specs=[
 ['game/modules/tome/data/general/npcs/canine.lua',/name = "wolf"|level_range = \{1, nil\}|rarity = 1/],
 ['game/modules/tome/data/zones/trollmire/npcs.lua',/currentZone.is_flooded|load\("\/data\/general\/npcs\/canine.lua"/],
 ['game/modules/tome/data/locales/ja_JP.lua',/^t\("(?:wolf|bat)",.*"entity name"\)/],
 ['game/engines/default/data/locales/engine/ja_JP.lua',/^t\("(?:wolf|bat)",/],
 ['game/modules/tome/mod/class/Actor.lua',/function _M:getName|_t\(self.name, "entity name"\)/],
 ['game/engines/default/engine/Actor.lua',/function _M:getName|_t\(self.name, "entity name"\)/],
 ['game/modules/tome/mod/class/Player.lua',/require "mod.class.Actor"|function _M:getName|class.inherit/],
 ['game/engines/default/engine/Level.lua',/self.entities|function _M:addEntity|function _M:removeEntity/],
];
const sources=specs.map(([file,predicate])=>{
 const bytes=fs.readFileSync(path.join(root,file));
 return {file,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),
  evidence:bytes.toString('utf8').split(/\r?\n/).flatMap((text,index)=>predicate.test(text)?[{line:index+1,text}]:[])};
});
const official=sources[2].evidence.find(row=>row.text===`t("${name}", "${japanese}", "${tag}")`);
assert.ok(official,'Exact official NPC translation changed');
const report={schema_version:1,source_commit:'624a67329fe2ad440c5b344785a9c73fcf22ae63',
 source_only:true,gameplay_executed:false,actor_graph_modified:false,original_files_modified:false,
 collision:{external_player_name:name,expected_player_get_name:name,npc_name:name,npc_tag:tag,expected_npc_translation:japanese,
  original_npc:{file:sources[0].file,name_line:48,level_range_line:50,rarity_line:51,minimum_level:1,rarity:1},
  official_translation:{file:sources[2].file,line:official.line,tag,japanese},
  zone_eligibility:{file:sources[1].file,guard_line:20,loader_line:23,condition:'not currentZone.is_flooded'},
  actual_spawn_in_current_browser_session_verified:false,
  read_only_existing_npc_check:'Inspect game.level.entities for an existing nonplayer entity.name == "wolf" with getName; report availability separately and call its original getName without spawning or renaming it.'},
 previous_probe:{name:'bat',official_module_entity_name_registration_found:sources[2].evidence.some(row=>row.text.startsWith('t("bat",')),
  official_engine_registration_found:sources[3].evidence.some(row=>row.text.startsWith('t("bat",')),
  conclusion:'The bat literal was not a source-grounded translated NPC-name collision. English fallback is not evidence of an invented missing translation.'},
 native_contract_audit:{return_shape:'locale,texts,orders,specials',metadata_shape:'tag -> source -> metadata',
  official_japanese_order_or_special_t_arguments:0,synthetic_native_metadata_created:false,
  zero_active_special_order_counts_explained_by:'Official JA registration metadata absence; existing diagnostic return indexes and nested loops agree with original I18N.',
  optional_helper_robustness:['Treat an order table as present even when empty or sparse.','For special dispatch inspect the nil-bucket order, as original I18N.lua:90 does.']},
 sources,memory:process.memoryUsage()};
fs.writeFileSync(new URL('npc-collision-source-audit.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({collision:report.collision,native_contract_audit:report.native_contract_audit,memory:report.memory})
 .replace(/[\u0080-\uffff]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0')));
