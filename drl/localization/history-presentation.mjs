/** Original English DRL history plus independent typed presentation records, GPL-2.0. */
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {scanSource} from '../port/tools/inventory-texts.mjs';
import {render,tokens as templateTokens} from './render.mjs';
import {buildItemNameAspects} from './item-name-aspects.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),digest=b=>createHash('sha256').update(b).digest('hex'),q=JSON.stringify;
const pas=s=>`'${s.replaceAll("'","''")}'`;
const sourceCommit='a6f965072b3a25b768c91dbced00367f1b57d865';
const lockSHA='29e02e86b7372da8509fb9ebbeafffeedf83d51eea96a2b064d2dde96ccbf6e4';
const nativeLocks={
 'src/dfplayer.pas':{bytes:29088,sha256:'7068d0645251a65e63438cd007a17e9751d78b358958bd41599378f15bf5f13b'},
 'src/dflevel.pas':{bytes:70572,sha256:'9d21d5c5a908fd9f6c9ea7b37ed25be83051a39bff0d2b834db7039899eeecaf'},
};
const translations=new Map;
const add=(english,suffix,japanese)=>translations.set(english,{id:'history.'+suffix,japanese});
for(const [en,suffix,ja]of [
 ['On @1, hell froze over!','event.frozen','{{depth}}階で地獄が凍りついた！'],
 ['@1 was a hard nut to crack!','event.hard-nut','{{depth}}階は手ごわい難所だった！'],
 ['He sounded the alarm on @1!','event.alarm','{{depth}}階で警報を鳴らした！'],
 ['@1 blasted him with an unholy atmosphere!','event.unholy','{{depth}}階の邪悪な空気に打ちのめされた！'],
 ['On @1 he encountered an armed nuke!','event.armed-nuke','{{depth}}階で作動中の核爆弾に出くわした！'],
 ['On @1 he ran for his life from acid!','event.acid','{{depth}}階で酸から命がけで逃げた！'],
 ['On @1 he ran for his life from lava!','event.lava','{{depth}}階で溶岩から命がけで逃げた！'],
 ['On @1 he ran for his life from blood!','event.blood','{{depth}}階で血の洪水から命がけで逃げた！'],
 ['On @1 he was targeted for extermination!','event.extermination','{{depth}}階で抹殺の標的にされた！'],
 ['On @1 he was bombarded!','event.bombarded','{{depth}}階で砲撃を浴びた！'],
 ['On @1 he was walking in fire!','event.fire','{{depth}}階で炎の中を歩いた！'],
 ['On @1 he was stumbling in the dark!','event.dark','{{depth}}階で暗闇を手探りで進んだ！'],
 ['He nuked @1!','item.nuked','{{depth}}階を核爆弾で吹き飛ばした！'],
 ['He flooded the entire @1 with acid!','item.flooded-acid','{{depth}}階全体を酸で満たした！'],
 ['He flooded the entire @1 with lava!','item.flooded-lava','{{depth}}階全体を溶岩で満たした！'],
 ['He activated the Angel Arm on @1!','item.angel-arm','{{depth}}階でエンジェルアームを発動した！'],
 ['He slaughtered the beasts living there.','abyssal.slaughtered','そこに巣食う獣を皆殺しにした。'],
 ['He barely escaped the trap set for him.','abyssal.escaped','仕掛けられた罠から、かろうじて逃れた。'],
 ['He saw, left a present and left.','arena.present','様子を見て、置き土産を残して立ち去った。'],
 ['He cowardly fled the Arena.','arena.fled','臆病にも闘技場から逃げ出した。'],
 ['He left the Arena before it got too hot.','arena.left','熱くなりすぎる前に闘技場を後にした。'],
 ["He fought desperately in the Arena but didn't have what it takes.",'arena.lost','闘技場で必死に戦ったが、実力が足りなかった。'],
 ['He left the Arena as a champion!','arena.champion','王者として闘技場を後にした！'],
 ["He decided to nuke Hell's production center.",'armory.nuked','地獄の生産施設を核爆弾で破壊することにした。'],
 ['He left the Armory without drawing too much attention.','armory.quiet','あまり注意を引かずに武器庫を後にした。'],
 ['He fled being chased by a nightmare!','armory.nightmare','悪夢に追われながら逃げ出した！'],
 ['He destroyed the evil within and reaped the rewards!','level.rewarded','中に潜む邪悪を滅ぼし、報酬を手に入れた！'],
 ['He kept his hands to himself.','asmosden.abstained','宝に手を出さずにおいた。'],
 ['He pilfered the treasure there.','asmosden.treasure','そこにあった宝を盗み出した。'],
 ['He arrived at the Phobos Anomaly.','boss.anomaly','フォボス異常地帯へ到着した。'],
 ['He found the Tower of Babel.','boss.babel','バベルの塔を見つけた。'],
 ['Then at last he found Dis!','boss.dis','そしてついに、ディスを見つけた！'],
 ['He defeated the Mastermind and found the TRUE EVIL!','boss.true-evil','マスターマインドを倒し、真の邪悪を見つけた！'],
 ['Nothing stood in his way.','level.unstoppable','行く手を阻むものは何もなかった。'],
 ["He couldn't quite finish the job.",'level.unfinished','仕事を最後までやり遂げられなかった。'],
 ['He defeated the Hell Arena Master!','chained.arena-master','地獄の闘技場の主を倒した！'],
 ['Not knowing what to do, he left.','level.uncertain','どうすればよいかわからず、立ち去った。'],
 ['He broke into the Containment Area, but gave up against the overwhelming forces.','containment.gave-up','封鎖区域へ突入したが、圧倒的な戦力を前に諦めた。'],
 ['He emerged from the Containment Area victorious!','containment.victorious','封鎖区域で勝利を収めた！'],
 ['He decided to nuke the forbidden Lab.','deimoslab.nuked','禁断の研究所を核爆弾で破壊することにした。'],
 ['He left the Deimos Lab without drawing too much attention.','deimoslab.quiet','あまり注意を引かずにダイモス研究所を後にした。'],
 ['He fought hard, but decided the reward was not worth it.','deimoslab.reward','奮戦したが、報酬に見合わないと判断した。'],
 ['He fled the lab after unleashing a nightmare!','deimoslab.nightmare','悪夢を解き放った後、研究所から逃げ出した！'],
 ['He fled the Unholy Cathedral seeing no chance to win.','cathedral.fled','勝ち目がないと悟り、邪悪の大聖堂から逃げ出した。'],
 ['He then destroyed the Unholy Cathedral!','cathedral.destroyed','そして邪悪の大聖堂を破壊した！'],
 ['He left the House without drawing too much attention.','house.quiet','あまり注意を引かずに苦痛の館を後にした。'],
 ['He fled the House on fire!','house.fire','炎上する苦痛の館から逃げ出した！'],
 ['He conquered the House!','house.conquered','苦痛の館を制圧した！'],
 ['He started his journey on the surface of Phobos.','intro.journey','フォボスの地表から旅を始めた。'],
 ['He decided it was too hot there.','lava.too-hot','そこは熱すぎると判断した。'],
 ['He fled there from the monstrous lava elemental.','lava.elemental','巨大な溶岩のエレメンタルから逃げ出した。'],
 ['He managed to clear the Lava Pits completely!','lava.cleared','溶岩の穴を完全に制圧した！'],
 ['He managed to clear Limbo from evil!','limbo.cleared','リンボの邪悪を一掃した！'],
 ['He managed to escape from Limbo!','limbo.escaped','リンボから脱出した！'],
 ['He left without a fuss.','military.quiet','騒ぎを起こさずに立ち去った。'],
 ['He purified his fellow comrades.','military.purified','かつての仲間たちを浄化した。'],
 ['He managed to clear the Mortuary from evil!','mortuary.cleared','死体安置所の邪悪を一掃した！'],
 ['He managed to escape from the Mortuary!','mortuary.escaped','死体安置所から脱出した！'],
 ['He decided it was too dangerous.','erebus.dangerous','危険すぎると判断した。'],
 ['He managed to raise Mt. Erebus completely!','erebus.raised','エレバス山を完全に出現させた！'],
 ['He broke through the lab.','phoboslab.through','研究所を突破した。'],
 ['He wiped out the City of Skulls.','skulls.cleared','髑髏の都を一掃した。'],
 ['He fled the City in terror!','skulls.fled','恐怖に駆られ、髑髏の都から逃げ出した！'],
 ['He fled the Lair, knowing how to fear Arachnotrons!','spider.fled','アラクノトロンの恐ろしさを知り、蜘蛛の巣から逃げ出した！'],
 ["He cleared the Lair, kickin' serious spider ass!",'spider.cleared','蜘蛛どもを叩きのめし、巣を制圧した！'],
 ['He was the antidote.','toxin.antidote','彼自身が解毒剤となった。'],
 ['He came, he saw, but he left.','vaults.left','来て、見て、しかし立ち去った。'],
 ["He managed to scavenge a part of the Vaults' treasures.",'vaults.partial','金庫室の宝を一部回収した。'],
 ['He managed to clear the Vaults completely!','vaults.cleared','金庫室を完全に制圧した！'],
 ['He cracked the Vaults and cleared them out!','vaults.cracked','金庫室をこじ開け、すべて制圧した！'],
 ['He broke into the Wall, but gave up against the overwhelming forces.','wall.gave-up','壁の向こうへ突入したが、圧倒的な戦力を前に諦めた。'],
 ['He massacred the evil behind the Wall!','wall.cleared','壁の向こうの邪悪を皆殺しにした！'],
 ['Entering @1 he was almost dead...','native.almost-dead','{{depth}}階へ入ったとき、瀕死だった……'],
 ['He left @1 as soon as possible.','native.left-quickly','できるだけ早く{{depth}}階を後にした。'],
])add(en,suffix,ja);
const caveHistoryRows=[
 [298,'nightmare-demon','On @1 he stumbled into a nightmare demon cave!','{{depth}}階で悪夢のデーモンの洞窟に迷い込んだ！'],
 [299,'nightmare-arachnotron','On @1 he stumbled into a nightmare arachnotron cave!','{{depth}}階で悪夢のアラクノトロンの洞窟に迷い込んだ！'],
 [300,'nightmare-elemental','On @1 he stumbled into a nightmare elemental cave!','{{depth}}階で悪夢のエレメンタルの洞窟に迷い込んだ！'],
 [301,'nightmare-cacodemon','On @1 he stumbled into a nightmare cacodemon cave!','{{depth}}階で悪夢のカコデーモンの洞窟に迷い込んだ！'],
 [302,'agony-elemental','On @1 he stumbled into a agony elemental cave!','{{depth}}階でアゴニー・エレメンタルの洞窟に迷い込んだ！'],
 [303,'lava-elemental','On @1 he stumbled into a lava elemental cave!','{{depth}}階で溶岩のエレメンタルの洞窟に迷い込んだ！'],
];
const englishHistoryTemplate=s=>s.replaceAll('@1','level {{depth}}').replace(/^[a-z]/,c=>c.toUpperCase());
const normalize=s=>scanSource(s,'lua').tokens.map(t=>t.raw).join('');
const binding=(name,kind,expression)=>({name,kind,expression});
const luaParams=bs=>'{'+bs.map(b=>`{name=${q(b.name)},kind=${q(b.kind)},value=${b.kind==='integer'?`tostring(${b.expression})`:b.expression}}`).join(',')+'}';
function sourceData(root,overrides){
 const bytes=readFileSync(path.join(here,'registry-sources.lock.json'));if(digest(bytes)!==lockSHA)throw Error('History independent Lua source lock changed');
 const locks={...JSON.parse(bytes).sources,...nativeLocks},data={};
 for(const[file,lock]of Object.entries(locks)){
  const b=Object.hasOwn(overrides,file)?Buffer.from(overrides[file]):readFileSync(path.join(root,file));
  if(b.length!==lock.bytes||digest(b)!==lock.sha256)throw Error(`History source provenance mismatch: ${file}`);
  const source=b.toString('utf8');data[file]={source,tokens:scanSource(source,file.endsWith('.pas')?'pascal':'lua').tokens,lock};
 }return data;
}
function scanHistoryCalls(data){
 const calls=[];
 for(const[file,{source,tokens:ts}]of Object.entries(data))if(file.startsWith('bin/data/core/')||file.startsWith('bin/data/drl/')){
  for(let i=0;i<ts.length-3;i++)if(ts[i]?.kind==='identifier'&&ts[i+1]?.raw===':'&&ts[i+2]?.raw==='add_history'&&ts[i+3]?.raw==='('&&ts[i-1]?.raw!=='function'){
   let depth=1,j=i+4;for(;j<ts.length;j++){if(ts[j].raw==='(')depth++;if(ts[j].raw===')'&&!--depth)break;}if(depth)throw Error('Unclosed history call');
   const start=ts[i].start,end=ts[j].end,argStart=ts[i+3].end,argEnd=ts[j].start,arg=source.slice(argStart,argEnd).trim(),argTokens=ts.slice(i+4,j);
   calls.push({key:file+':'+start,file,line:ts[i].line,start,end,original:source.slice(start,end),receiver:ts[i].raw,argument:arg,tokens:argTokens,sourceSha256:data[file].lock.sha256});i=j;
  }
 }
 return calls;
}
function exact(data,file,needle,replacement,kind='history-support',id=null){
 const source=data[file].source,newline=source.includes('\r\n')?'\r\n':'\n';needle=needle.replaceAll('\r\n',newline);replacement=replacement.replaceAll('\r\n',newline);
 const start=source.indexOf(needle);if(start<0||source.indexOf(needle,start+1)>=0)throw Error(`History exact source guard changed: ${file}:${needle}`);
 return{file,start,end:start+needle.length,original:needle,replacement,kind,id,sourceSha256:data[file].lock.sha256};
}
function wrapCall(c,id,en,bs=[],captures=[]){
 return{...c,id,kind:'semantic-history',bindings:bs,englishTemplate:en,originalEnglishCallPreserved:true,replacement:`do ${captures.join('; ')}${captures.length?'; ':''}${c.original}; ui.remember_semantic_history(${id.startsWith('history.')?q(id):id}, ${q(en)}, ${luaParams(bs)}) end`};
}
function registryRows(registry,category,field){return registry.metadata.filter(m=>m.category===category&&m.scope==='base_game'&&m.fields[field]).map(m=>({registryId:m.registryId,english:m.fields[field].english,field,semanticId:m.fields[field].semanticId}));}
export const semanticHistoryApiContract={luaRemember:'ui.remember_semantic_history(id,englishTemplate,typedParams)',luaReplay:'ui.presentation_history(index,actualOriginalEnglish)',originalStorage:'player.__props.history; original Lua @1 substitution and initial ASCII lowercase capitalization remain untouched',nativeSourceCallbacks:'Source(index,outOriginalEnglish), CurrentSource(outLastIndex,outLastOriginalEnglish)',prefix:'No implicit prefix. @1 becomes the complete source phrase level <depth>; depth is captured as a canonical signed Int64 integer parameter.',sidecar:'/user/drl.presentation-history.json',schema:1};
export const semanticHistorySidecarSchema={schema:1,format:'drl.semantic-history',exactRootFields:['schema','format','records'],exactRecordFields:['index','id','english','originalEnglish','params'],exactParameterFields:['name','kind','value'],index:'canonical positive signed Int64 decimal string',parameterKinds:['string','integer'],integerValue:'canonical signed Int64 decimal string',maximumRecords:4096,maximumParameters:16,maximumTextBytes:32768,maximumJSONBytes:1048576,validation:'source-whitelisted ID/template/named kinds; original English reconstruction; exact original history index/text; atomic whole-file load; duplicate fields rejected by shared JSON preflight'};
export function buildHistoryPresentation(root=path.resolve(here,'../upstream/drl'),{manifest={patches:[]},sourceOverrides={}}={}){
 const data=sourceData(root,sourceOverrides),calls=scanHistoryCalls(data),terms=new Map,records=[],support=[],projections=[],alreadyPatched=[];
 const registry=JSON.parse(readFileSync(path.join(here,'registration-term-catalog.json'))),jaRegistry=JSON.parse(readFileSync(path.join(here,'ja.json')));
 const catalog=(id,english,japanese,parameters={})=>{const old=terms.get(id);if(old&&(old.english!==english||old.japanese!==japanese))throw Error(`Conflicting history semantic ID:${id}`);terms.set(id,{id,english,japanese,parameters});};
 const existingFor=r=>(manifest.patches??[]).filter(p=>p.file===r.file&&((p.start===r.start&&p.end===r.end)||(p.start<r.end&&p.end>r.start)));
 const add=r=>{const overlap=existingFor(r);if(overlap.length)alreadyPatched.push({...r,existingPatches:overlap.map(p=>p.id??p.kind)});else records.push(r);};
 const addSupport=r=>{const overlap=existingFor(r);if(overlap.length)alreadyPatched.push({...r,existingPatches:overlap.map(p=>p.id??p.kind)});else support.push(r);};
 const depth=binding('depth','integer','drl_history_depth'),depthCapture='local drl_history_depth = level.index';
 const dynamic=new Map;
 for(const c of calls)if(c.tokens.length===1&&c.tokens[0].kind==='string'){
  const originalEnglish=c.tokens[0].value,t=translations.get(originalEnglish);if(!t)throw Error(`Unreviewed literal history:${c.file}:${c.line}:${originalEnglish}`);
  const en=englishHistoryTemplate(originalEnglish),hasDepth=originalEnglish.includes('@1');catalog(t.id,en,t.japanese,hasDepth?{depth:'integer'}:{});
  add(wrapCall(c,t.id,en,hasDepth?[depth]:[],hasDepth?[depthCapture]:[]));
 }else dynamic.set(c.file+':'+c.line,c);
 const take=(file,line)=>{const key=file+':'+line,c=dynamic.get(key);if(!c)throw Error(`Missing dynamic history producer:${key}`);dynamic.delete(key);return c;};
 const assemblyTerms=registryRows(registry,'mod_array','name'),beingTerms=registryRows(registry,'being','name_plural'),itemTerms=registryRows(registry,'item','name');
 const dynamicRegistry=(file,line,argument,prefix,category,field,rows,paramName,originalName,originalId,en,ja)=>{
  const c=take(file,line);if(normalize(c.argument)!==normalize(argument))throw Error(`History dynamic original argument changed:${file}:${line}`);
  for(const r of rows){const id=prefix+'.'+r.registryId.replaceAll('_','-');catalog(id,en,ja,{depth:'integer',[paramName]:'string'});projections.push({id,paramName,category,registryId:r.registryId,scope:'base_game',field,english:r.english});}
  const idExpression=`${q(prefix+'.')}..string.gsub(drl_history_registry_id, "_", "-")`;
  const bs=[depth,binding(paramName,'string','drl_history_name')];
  const record=wrapCall(c,idExpression,en,bs,[depthCapture,`local drl_history_name = ${originalName}`,`local drl_history_registry_id = ${originalId}`]);record.id=prefix+'.'+rows[0].registryId.replaceAll('_','-');record.idExpression=idExpression;add(record);
 };
 dynamicRegistry('bin/data/core/item.lua',177,'"On @1 he assembled a "..ma.name.."!"','history.assembled','mod_array','name',assemblyTerms,'assembly','ma.name','ma.id','On level {{depth}} he assembled a {{assembly}}!','{{depth}}階で{{assembly}}を組み立てた！');
 for(const line of [291,320])dynamicRegistry('bin/data/drl/generators.lua',line,'"On @1 he stumbled into a complex full of "..beings[monster].name_plural.."!"','history.monster-complex','being','name_plural',beingTerms,'beings','beings[monster].name_plural','monster','On level {{depth}} he stumbled into a complex full of {{beings}}!','{{depth}}階で{{beings}}だらけの施設に迷い込んだ！');
 dynamicRegistry('bin/data/drl/main.lua',274,"'On @1 he found the '..i.name..'!'",'history.found-item','item','name',itemTerms,'item','i.name','i.id','On level {{depth}} he found the {{item}}!','{{depth}}階で{{item}}を見つけた！');
 dynamicRegistry('bin/data/drl/perks.lua',245,'"He overloaded a "..self.name.." on @1!"','history.overloaded-item','item','name',itemTerms,'item','self.name','self.id','He overloaded a {{item}} on level {{depth}}!','{{depth}}階で{{item}}を過負荷にした！');
 const entries=registryRows(registry,'level','entry');
 const entryCall=take('bin/data/drl/cells.lua',361);if(normalize(entryCall.argument)!==normalize('levels[sinfo.script].entry'))throw Error('Level entry history source argument changed');
 const entryBranches=[];
 for(const r of entries){const id='history.level-entry.'+r.registryId.replaceAll('_','-'),en=englishHistoryTemplate(r.english),hasDepth=r.english.includes('@1'),ja=jaRegistry[r.semanticId].replaceAll('@1','{{depth}}階');catalog(id,en,ja,hasDepth?{depth:'integer'}:{});entryBranches.push(`${entryBranches.length?'elseif':'if'} drl_history_registry_id == ${q(r.registryId)} and drl_history_entry == ${q(r.english)} then ui.remember_semantic_history(${q(id)}, ${q(en)}, ${luaParams(hasDepth?[depth]:[])})`);}
 add({...entryCall,id:'history.level-entry.'+entries[0].registryId.replaceAll('_','-'),kind:'semantic-history-registry-entry',originalEnglishCallPreserved:true,replacement:`do ${depthCapture}; local drl_history_entry = levels[sinfo.script].entry; local drl_history_registry_id = sinfo.script; ${entryCall.original}; ${entryBranches.join(' ')} end end`});
 const caveCall=take('bin/data/drl/generator.lua',317);if(normalize(caveCall.argument)!=='set.history')throw Error('Cave history argument changed');
 const caveBranches=[];
 for(const[line,suffix,enOriginal,ja]of caveHistoryRows){const ts=data[caveCall.file].tokens.filter(t=>t.line===line&&t.kind==='string'&&t.value===enOriginal);if(ts.length!==1)throw Error(`Cave history field guard changed:${line}`);const id='history.cave.'+suffix,en=englishHistoryTemplate(enOriginal);catalog(id,en,ja,{depth:'integer'});const t=ts[0];addSupport({file:caveCall.file,start:t.end,end:t.end,original:'',replacement:', history_semantic_id = '+q(id),id,kind:'history-producer-metadata'});caveBranches.push(`${caveBranches.length?'elseif':'if'} set.history_semantic_id == ${q(id)} and drl_history_original == ${q(enOriginal)} then ui.remember_semantic_history(${q(id)}, ${q(en)}, ${luaParams([depth])})`);}
 add({...caveCall,id:'history.cave.nightmare-demon',kind:'semantic-history-cave',originalEnglishCallPreserved:true,replacement:`do ${depthCapture}; local drl_history_original = set.history; ${caveCall.original}; ${caveBranches.join(' ')} end end`});
 if(dynamic.size)throw Error(`Unreviewed dynamic history producers:${[...dynamic.keys()].join(',')}`);
 for(const[file,line,needle,enOriginal]of [
  ['src/dfplayer.pas',429,"AddHistory('Entering @1 he was almost dead...')",'Entering @1 he was almost dead...'],
  ['src/dflevel.pas',679,"Player.AddHistory('He left @1 as soon as possible.')",'He left @1 as soon as possible.'],
 ]){const t=translations.get(enOriginal),en=englishHistoryTemplate(enOriginal);catalog(t.id,en,t.japanese,{depth:'integer'});const r=exact(data,file,needle,`begin ${needle}; DRLRememberCurrentSemanticHistory(${pas(t.id)}, ${pas(en)}, [DRLIntegerParam('depth', DRL.Level.Index)]); end`,'semantic-history-native',t.id);r.line=line;r.originalEnglishCallPreserved=true;add(r);}
 const mortem='bin/data/core/mortem.lua';addSupport(exact(data,mortem,'for _,v in pairs( player.__props.history ) do\n\t\tplayer:mortem_print( "  "..v )','for history_index,v in pairs( player.__props.history ) do\n\t\tplayer:mortem_print( "  "..ui.presentation_history(history_index, v) )','history-display-consumer'));
 const originalDispatcher='function player:add_history( history )\n\tif history then\n\t\tlocal name = "level "..level.index\n\t\ttable.insert( self.__props.history, (string.gsub( history, "@1", name ):gsub("^%l", string.upper)) )\n\tend\nend';
 if(!data['bin/data/core/player.lua'].source.includes(originalDispatcher))throw Error('Original stored history formatter changed');
 const nativeDelegate="procedure TPlayer.AddHistory( const aHistory : Ansistring );\nbegin\n  LuaSystem.ProtectedCall(['player','add_history'],[ Self, aHistory ]);\nend;";
 if(!data['src/dfplayer.pas'].source.replaceAll('\r\n','\n').includes(nativeDelegate))throw Error('Original native AddHistory delegate changed');
 if(calls.length!==81)throw Error(`Original executable history call count changed:${calls.length}`);
 const nameRules=buildItemNameAspects(root).rules.filter(r=>r.kind!=='schematic');
 return{schema:1,sourceCommit,api:semanticHistoryApiContract,catalogTerms:[...terms.values()],records,supportRecords:support,alreadyPatched,projections,itemNameRules:nameRules,registryItems:itemTerms,inventory:calls.map(({tokens,...r})=>r),registryEntryProducers:entries.length,caveHistoryProducers:caveHistoryRows.length,originalDispatcherPreserved:true,originalNativeDelegatePreserved:true,originalSerializedHistoryUnchanged:true,requiredUnits:{'src/dfplayer.pas':['drlsemantictext','drlsemantichistory'],'src/dflevel.pas':['drlsemantictext','drlsemantichistory']},nativeOrBrowserExecuted:false};
}
export function curateHistoryPresentation({file,catalog,patches}){
 const result=buildHistoryPresentation(undefined,{manifest:{patches}});
 for(const t of result.catalogTerms)catalog(t.id,t.english,t.japanese,t.parameters);
 for(const r of [...result.records,...result.supportRecords]){
  if(file(r.file).slice(r.start,r.end)!==r.original)throw Error('History integration source interval mismatch');
  patches.push({file:r.file,start:r.start,end:r.end,original:r.original,replacement:r.replacement,id:r.id??null,kind:r.kind});
 }
 return result;
}
/** Generated exact ID/template/kind validator plus contextual registry projections. */
export function buildSemanticHistoryCatalog(result=buildHistoryPresentation()){
 const params=[],rows=result.catalogTerms.map(t=>{const first=params.length;params.push(...Object.entries(t.parameters).map(([name,kind])=>({name,kind})));return{...t,first};});
 const projectCases=result.projections.map(p=>`  if (aID=${pas(p.id)}) and (aParam.Name=${pas(p.paramName)}) then Exit(DRLRegistryText(${pas(p.category)},${pas(p.registryId)},'base_game',${pas(p.field)},aParam.Value));`).join('\n');
 const itemRows=result.registryItems.map(item=>` (ID:${pas(item.registryId)};English:${pas(item.english)})`).join(',\n');
 const nameRules=result.itemNameRules.filter(r=>r.eventID!=='item.name.aspect.overcharge');
 const nameRows=nameRules.map(r=>` (SemanticID:${pas(r.semanticID)};English:${pas(r.englishTemplate)};Fixed:${r.kind==='fixed'?'True':'False'};Aspect:${pas(r.kind==='fixed'?r.fixedEnglish:r.prefix)})`).join(',\n');
 // A known prototype and original source-defined rename recipes delimit this
 // finite contextual guard. No global rendered-name lookup or prefix stripping.
 const itemCases=`var i,j:Integer;expected,base,localized:AnsiString;
begin
 for i:=0 to High(CHistoryItems)do if CHistoryItems[i].ID=aRegistryID then begin
  base:=DRLRegistryText('item',aRegistryID,'base_game','name',CHistoryItems[i].English);
  if aOriginal=CHistoryItems[i].English then Exit(base);
  if aOriginal='overcharged '+CHistoryItems[i].English then Exit(DRLText('item.name.overcharged','overcharged {{name}}',[DRLStringParam('name',base)]));
  for j:=0 to High(CHistoryNameRules)do begin
   if CHistoryNameRules[j].Fixed then expected:=CHistoryNameRules[j].Aspect
    else expected:=CHistoryNameRules[j].Aspect+CHistoryItems[i].English;
   if(aOriginal=expected)or(aOriginal='overcharged '+expected)then begin
    if CHistoryNameRules[j].Fixed then localized:=DRLText(CHistoryNameRules[j].SemanticID,CHistoryNameRules[j].English)
     else localized:=DRLText(CHistoryNameRules[j].SemanticID,CHistoryNameRules[j].English,[DRLStringParam('name',base)]);
    if aOriginal<>expected then localized:=DRLText('item.name.overcharged','overcharged {{name}}',[DRLStringParam('name',localized)]);
    Exit(localized);
   end;
  end;Exit(aOriginal);
 end;Exit(aOriginal);
end;`;
 const itemOverrides=result.projections.filter(p=>p.category==='item').map(p=>`  if (aID=${pas(p.id)}) and (aParam.Name='item') then Exit(ProjectItemName(${pas(p.registryId)},aParam.Value));`).join('\n');
 const unit=`{ Generated source-guarded original DRL history catalog, GPL-2.0. }\nunit drlsemantichistorycatalog;\n{$mode objfpc}{$H+}{$B-}\ninterface\nuses drlsemantictext,drlsemantichistory;\nfunction DRLValidateHistoryRequest(const aID,aEnglish:AnsiString;const aParams:array of TDRLTextParam):Boolean;\nfunction DRLProjectHistoryParams(const aID:AnsiString;const aOriginalParams:array of TDRLTextParam;out aPresentationParams:TDRLHistoryParams):Boolean;\nimplementation\nuses drlsemanticregistry;\ntype THistoryRow=record ID,English:AnsiString;FirstParam,ParamCount:Integer;end;\nconst CHistoryRows:array[0..${rows.length-1}]of THistoryRow=(\n${rows.map(r=>` (ID:${pas(r.id)};English:${pas(r.english)};FirstParam:${r.first};ParamCount:${Object.keys(r.parameters).length})`).join(',\n')}\n);\nconst CHistoryParams:array[0..${Math.max(params.length,1)-1}]of record Name:AnsiString;Kind: TDRLTextParamKind;end=(\n${(params.length?params:[{name:'',kind:'string'}]).map(p=>` (Name:${pas(p.name)};Kind:${p.kind==='integer'?'DRL_TEXT_INTEGER':'DRL_TEXT_STRING'})`).join(',\n')}\n);\nfunction DRLValidateHistoryRequest(const aID,aEnglish:AnsiString;const aParams:array of TDRLTextParam):Boolean;\nvar i,j,k:Integer;found:Boolean;\nbegin\n for i:=0 to High(CHistoryRows)do if CHistoryRows[i].ID=aID then begin\n  if(CHistoryRows[i].English<>aEnglish)or(CHistoryRows[i].ParamCount<>Length(aParams))then Exit(False);\n  for j:=0 to CHistoryRows[i].ParamCount-1 do begin\n   found:=False;for k:=0 to High(aParams)do if(aParams[k].Name=CHistoryParams[CHistoryRows[i].FirstParam+j].Name)and(aParams[k].Kind=CHistoryParams[CHistoryRows[i].FirstParam+j].Kind)then found:=True;\n   if not found then Exit(False);\n  end;Exit(True);\n end;Exit(False);\nend;\nconst CHistoryItems:array[0..${result.registryItems.length-1}]of record ID,English:AnsiString;end=(\n${itemRows}\n);\nconst CHistoryNameRules:array[0..${nameRules.length-1}]of record SemanticID,English:AnsiString;Fixed:Boolean;Aspect:AnsiString;end=(\n${nameRows}\n);\nfunction ProjectItemName(const aRegistryID,aOriginal:AnsiString):AnsiString;\n${itemCases}\nfunction ProjectParameter(const aID:AnsiString;const aParam:TDRLTextParam):AnsiString;\nbegin\n${itemOverrides}\n${projectCases}\n Exit(aParam.Value);\nend;\nfunction DRLProjectHistoryParams(const aID:AnsiString;const aOriginalParams:array of TDRLTextParam;out aPresentationParams:TDRLHistoryParams):Boolean;\nvar i:Integer;\nbegin\n SetLength(aPresentationParams,Length(aOriginalParams));\n for i:=0 to High(aOriginalParams)do begin\n  aPresentationParams[i]:=aOriginalParams[i];\n  if aOriginalParams[i].Kind=DRL_TEXT_STRING then aPresentationParams[i].Value:=ProjectParameter(aID,aOriginalParams[i]);\n end;Exit(True);\nend;\ninitialization\n DRLSemanticHistoryValidator:=@DRLValidateHistoryRequest;\n DRLSemanticHistoryProjector:=@DRLProjectHistoryParams;\nend.\n`;
 return{unit,ids:rows.map(r=>r.id),registryProjections:result.projections.length,originalEnglishParamsPreserved:true};
}
export function verifyHistoryPresentation(root,options={}){
 const result=buildHistoryPresentation(root,options);let templateCases=0;
 for(const t of result.catalogTerms){const ps=s=>Array.from(new Set(templateTokens(s).filter(t=>t.parameter).map(t=>t.parameter))).sort();assert.deepEqual(ps(t.english),ps(t.japanese));assert.deepEqual(ps(t.english),Object.keys(t.parameters).sort());const values=Object.fromEntries(Object.entries(t.parameters).map(([n,k])=>[n,k==='integer'?9223372036854775807n:`原文${n}%{{opaque}}😀`]));for(const text of [t.english,t.japanese]){const out=render({[t.id]:text},{[t.id]:t.parameters},t.id,values);for(const v of Object.values(values))assert.ok(out.includes(String(v)));templateCases++;}}
 const ordered=[...result.records,...result.supportRecords].toSorted((a,b)=>a.file.localeCompare(b.file)||a.start-b.start);for(let i=1;i<ordered.length;i++)if(ordered[i].file===ordered[i-1].file)assert.ok(ordered[i].start>=ordered[i-1].end);
 const unit=readFileSync(path.join(here,'drlsemantichistory.pas'),'utf8');for(const required of ['DRLSemanticPreflightJSON(data)','stream.Size <> size','FRecords := candidate','FUsable := False','entry.Count <> 5','param.Count <> 3','DRLEnglishText','DRL_HISTORY_MAX_RECORDS = 4096','DRL_HISTORY_MAX_PARAMS = 16','DRL_HISTORY_MAX_JSON_BYTES = 1048576','IntToStr(aRecords[i].Index) <> index','DRLSemanticHistorySource(aRecord.Index, original)','stream.Free'])assert.ok(unit.includes(required),required);
 assert.ok(!/\b(?:Random|RLongInt|CallHook|Player|add_property)\s*(?:\.|\()/i.test(unit.replace(/\{[\s\S]*?\}/g,'')));
 const generated=buildSemanticHistoryCatalog(result);assert.equal(scanSource(generated.unit,'pascal').diagnostics.length,0);
 const sourceRoot=root??path.resolve(here,'../upstream/drl'),manifest=JSON.parse(readFileSync(path.join(here,'manifest.json'),'utf8'));
 const combined=buildHistoryPresentation(sourceRoot,{manifest}),patches=[...manifest.patches,...combined.records,...combined.supportRecords],files=[...new Set([...result.records,...result.supportRecords,...result.alreadyPatched].map(p=>p.file))];
 let overlayFiles=0,sourceGuardRejections=0,spanGuardRejections=0,englishReconstructions=0;
 for(const f of files){const original=readFileSync(path.join(sourceRoot,f),'utf8'),ps=patches.filter(p=>p.file===f).toSorted((a,b)=>a.start-b.start);let cursor=0,edited='',reverse=[];for(const p of ps){assert.ok(p.start>=cursor,`Overlapping source proposals:${f}`);assert.equal(original.slice(p.start,p.end),p.original,`Raw offset guard:${f}`);edited+=original.slice(cursor,p.start);const start=edited.length;edited+=p.replacement;reverse.push({start,end:edited.length,replacement:p.original});cursor=p.end;}edited+=original.slice(cursor);assert.equal(scanSource(edited,f.endsWith('.pas')?'pascal':'lua').diagnostics.length,0,f);for(const p of reverse.toReversed())edited=edited.slice(0,p.start)+p.replacement+edited.slice(p.end);assert.equal(edited,original);overlayFiles++;}
 for(const r of result.records){assert.ok(r.replacement.includes(r.original),`Original append retained:${r.file}:${r.line}`);const source=readFileSync(path.join(sourceRoot,r.file),'utf8');const guard=p=>{if(source.slice(p.start,p.end)!==p.original)throw Error('Raw offset guard rejected');};guard(r);assert.throws(()=>guard({...r,start:r.start+1,end:r.end+1}),/Raw offset guard rejected/);spanGuardRejections++;}
 for(const f of ['bin/data/core/player.lua','src/dfplayer.pas','src/dflevel.pas']){const b=readFileSync(path.join(sourceRoot,f));const mutated=Buffer.from(b);mutated[0]^=1;assert.throws(()=>buildHistoryPresentation(sourceRoot,{sourceOverrides:{[f]:mutated}}),/provenance mismatch/);sourceGuardRejections++;}
 for(const c of result.inventory){const ts=scanSource(c.argument,'lua').tokens;if(ts.length!==1||ts[0].kind!=='string')continue;const sourceEnglish=ts[0].value,definition=translations.get(sourceEnglish),term=result.catalogTerms.find(t=>t.id===definition.id);for(const depthValue of [1n,9223372036854775807n]){const expected=sourceEnglish.replaceAll('@1',`level ${depthValue}`).replace(/^[a-z]/,s=>s.toUpperCase());const actual=render({[term.id]:term.english},{[term.id]:term.parameters},term.id,sourceEnglish.includes('@1')?{depth:depthValue}:{});assert.equal(actual,expected);englishReconstructions++;}}
 assert.ok(result.records.every(r=>result.catalogTerms.some(t=>t.id===r.id)),'Every producer patch has a canonical finite catalog ID');
 assert.equal(semanticHistorySidecarSchema.maximumJSONBytes,1048576);assert.equal(semanticHistorySidecarSchema.maximumRecords,4096);assert.equal(semanticHistorySidecarSchema.maximumParameters,16);
 return{luaHistoryCalls:81,nativeHistoryCalls:2,reviewedHistoryCalls:83,excludedCommentedCalls:[{file:'bin/data/drl/levels/asmosden.lua',line:211},{file:'bin/data/drl/levels/asmosden.lua',line:215}],excludedMethodDeclarations:1,newProducerPatches:result.records.length,alreadyPatched:result.alreadyPatched.length,caveHistoryFields:6,levelEntryFields:result.registryEntryProducers,semanticIds:result.catalogTerms.length,templateCases,registryParameterProjections:result.projections.length,generatedValidatorBytes:Buffer.byteLength(generated.unit),overlayFiles,sourceGuardRejections,spanGuardRejections,englishReconstructions,originalSerializedHistoryUnchanged:true,nativeOrBrowserExecuted:false};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(verifyHistoryPresentation()));
