/* In-place catalog/source phase. Never restores the earlier UI baselines. */
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import{fileURLToPath}from'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const write=(p,s)=>fs.writeFileSync(path.join(root,p),s);
const manifest=JSON.parse(read('migration/interface-data/source-manifest.json'));
const en=JSON.parse(read('migration/interface-data/en.json')),ja=JSON.parse(read('migration/interface-data/ja.json'));
const phase=[];
const source=(file,needle)=>{const text=read('tests/first-naming-build-snapshot/source/'+file);const at=text.indexOf(needle);assert.ok(at>=0,file+': '+needle);return{file,line:text.slice(0,at).split('\n').length,original_lexeme:needle};};
function add(id,english,japanese,parameters,sources){
 const record={id,english,japanese,parameters,sources,role:'source_death_or_item_projection',status:'reviewed_source_catalog'};
 if(Object.hasOwn(en,id)){assert.equal(en[id],english);assert.equal(ja[id],japanese);}else{en[id]=english;ja[id]=japanese;manifest.entries.push(record);}
 phase.push(record);
}
const fixed=[
 ['poison','poison','毒','logic/game-world.c','"poison"'],
 ['wound','a fatal wound','致命傷','logic/game-world.c','"a fatal wound"'],
 ['starvation','starvation','飢餓','logic/game-world.c','"starvation"'],
 ['earthquake','an earthquake','地震','logic/effect-handler-attack.c','"an earthquake"'],
 ['failed_uncursing','Failed uncursing','呪いの解除失敗','logic/effect-handler-general.c','"Failed uncursing"'],
 ['stat_drain','stat drain','能力値の吸収','logic/effect-handler-general.c','"stat drain"'],
 ['banishment','the strain of casting Banishment','追放の術による消耗','logic/effect-handler-general.c','"the strain of casting Banishment"'],
 ['mass_banishment','the strain of casting Mass Banishment','大量追放の術による消耗','logic/effect-handler-general.c','"the strain of casting Mass Banishment"'],
 ['over_exertion','over-exertion','無理な行動','logic/player-util.c','"over-exertion"'],
 ['lava','burning to a cinder in lava','溶岩による火傷','data/gamedata/terrain.txt','die-msg:burning to a cinder in lava'],
 ['chest_needle','a poison needle','毒針','data/gamedata/chest_trap.txt','msg-death:a poison needle'],
 ['chest_explosion','an exploding chest','宝箱の爆発','data/gamedata/chest_trap.txt','msg-death:an exploding chest'],
 ['yourself','yourself','自らの攻撃','logic/project-player.c','"yourself"'],
 ['bug','a bug','不具合','logic/project-player.c','"a bug"'],
 ['retired','Retiring','引退','logic/cmd-misc.c','"Retiring"'],
 ['winner','Ripe Old Age','天寿','logic/score.h','"Ripe Old Age"'],
 ['saved','(saved)','保存済み','logic/ui-game.c','"(saved)"'],
 ['alive','(alive and well)','健在','logic/ui-game.c','"(alive and well)"'],
 ['cheat_death','Cheating death','死からの復活','logic/wiz-debug.c','"Cheating death"'],
 ['preview','nobody (yet!)','まだ誰にも倒されていない','logic/ui-score.c','"nobody (yet!)"'],
];
for(const[key,english,japanese,file,needle]of fixed)add('interface.death.cause.'+key,english,japanese,[],[source(file,needle)]);
for(const[key,english,japanese]of[
 ['legacy_unknown','an unknown recorded cause','翻訳情報のない記録上の死因'],
 ['capture_unavailable','an unavailable captured cause','取得できなかった死因'],
])add('interface.death.cause.'+key,english,japanese,[],[{file:'rust/src/death_cause.rs',role:'explicit_missing_semantic_provenance'}]);
for(const[key,name,type,file,needle]of[
 ['monster','monster','MonsterDescription','logic/mon-attack.c','monster_desc(ddesc'],
 ['object','object','KnownObjectDescription','logic/project-player.c','object_desc(killer'],
 ['trap','trap','TrapName','logic/project-player.c','trap->kind->desc'],
 ['source_effect','effect','localized_text','logic/effect-handler-attack.c','context->msg'],
])add('interface.death.cause.'+key,key==='trap'?'a {trap}':`{${name}}`,`{${name}}`,[{name,type}],[source(file,needle)]);
add('interface.death.by','by {cause}.','死因：{cause}。',[{name:'cause',type:'localized_text'}],[source('logic/ui-death.c','"by %s."')]);
add('interface.death.date','on {date}','死亡日時：{date}',[{name:'date',type:'opaque_calendar_date'}],[source('logic/ui-death.c','"on %-.24s"')]);
add('interface.score.row.cause.town','Killed by {cause} in the town','町で{cause}により死亡',[{name:'cause',type:'localized_text'}],[source('logic/ui-score.c','"Killed by %s in the town"')]);
add('interface.score.row.cause.dungeon','Killed by {cause} on dungeon level {depth}','地下{depth}階で{cause}により死亡',[{name:'cause',type:'localized_text'},{name:'depth',type:'integer'}],[source('logic/ui-score.c','"Killed by %s on dungeon level %d"')]);
for(const[key,english,japanese,needle]of[
 ['inventory','/ for inventory','「/」で所持品','" / for Inven,"'],
 ['equipment','/ for equipment','「/」で装備','" / for Equip,"'],
 ['quiver','| for quiver','「|」で矢筒','" | for Quiver,"'],
 ['floor','- for floor','「-」で床上の品','" - for floor,"'],
 ['escape','ESC to exit','Escで戻る','" ESC"'],
])add('interface.items.switch.'+key,english,japanese,[],[source('logic/ui-object.c',needle)]);
let object=read('logic/ui-object.c');
for(const[key,raw,activation,count]of[
 ['inventory',' / for Inven,','/',4],['equipment',' / for Equip,','/',3],
 ['quiver',' | for Quiver,','|',4],['floor',' - for floor,','-',4],
]){
 const call=`my_strcat(out_val, "${raw}", sizeof(out_val))`;
 const replacement=`AB_IF_ITEM_ACTION("${key}", "interface.items.switch.${key}", '${activation}', ${call})`;
 if(!object.includes(replacement)){assert.equal(object.split(call).length-1,count,key);object=object.replaceAll(call,replacement);}
}
write('logic/ui-object.c',object);
manifest.death_and_direct_item_phase={catalog_entries:phase.length,causes:26,direct_item_contexts:['inventory','equipment','quiver','floor-items','throwing-items'],source_connected:true,browser_verified:false};
for(const[p,value]of[['migration/interface-data/source-manifest.json',manifest],['migration/interface-data/en.json',en],['migration/interface-data/ja.json',ja]])write(p,JSON.stringify(value,null,2)+'\n');
fs.mkdirSync(path.join(root,'migration/death-data'),{recursive:true});
const files=['mon-attack.c','project-player.c','effect-handler-attack.c','player-util.c','game-world.c','effect-handler-general.c','cmd-misc.c','ui-game.c','wiz-debug.c','score.c','init.c','load.c','ui-death.c','ui-score.c'];
const scoreFields=[...read('logic/score.h').match(/struct high_score\s*\{([\s\S]*?)\};/)[1].matchAll(/char\s+([a-z_]+)\[(\d+)\]\s*;/g)].map(m=>({name:m[1],bytes:Number(m[2])}));
const scoreBytes=scoreFields.reduce((sum,field)=>sum+field.bytes,0);assert.equal(scoreFields.length,14);assert.equal(scoreBytes,126);
write('migration/death-data/source-manifest.json',JSON.stringify({schema_version:1,upstream_commit:manifest.upstream_commit,status:'source_connected_unbuilt',complete_game_translation:false,entries:phase,source_files:files.map(file=>'logic/'+file),baseline:'tests/first-naming-build-snapshot/source',cause_section:{id:'angband.death_cause',version:1,max_bytes:16384},scores_section:{id:'angband.death_scores',version:1,max_bytes:524288,max_records:100,identity_bytes:scoreBytes,native_identity_fields:scoreFields,identity_hex_characters:scoreBytes*2,identity_source:'logic/score.h struct high_score, all fourteen native char-array fields; original struct untouched'}},null,2)+'\n');
console.log(JSON.stringify({catalog_entries:manifest.entries.length,new_phase:phase.length,causes:26,direct_item_header_actions:16,source_connected:true,browser_verified:false}));
