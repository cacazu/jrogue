import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {drawProjection} from '../web/game.mjs';
import {reconstructProjection,observeMap,chooseObservedRoute,captureCombatMessages,
  nativeTargetWitness} from './original-combat-witness.mjs';

const ja=JSON.parse(readFileSync(new URL('../locales/native-ja.json',import.meta.url),'utf8'));
const en=JSON.parse(readFileSync(new URL('../locales/native-en.json',import.meta.url),'utf8'));
const glyph=(x,y,text,foreground='#aa0000',columns=1)=>
  ({x,y,text,foreground,columns,background:'#000000'});
const projection=(glyphs=[],commands=[],cursor=null)=>({width:80,height:25,glyphs,commands,cursor});
const probe={playerPresent:true,x:7,y:10,hp:72,hpMax:72,exp:0,level:1,state:4};
const fill=(template,values)=>template.replace(/\{\{(\w+)\}\}/g,(_,key)=>values[key]);
const corridor=()=>projection([glyph(7,11,'@','#ffffff'),
  ...Array.from({length:8},(_,i)=>glyph(i+8,11,'.'))]);

test('final cells follow production glyphs then ordered clears/overlays, including Rust columns',()=>{
  const input=projection([glyph(4,5,'h','#aaaaaa'),glyph(7,11,'@','#ffffff')],[
    {kind:'glyph',...glyph(4,5,'日本','#ffffff',4)},
    {kind:'clear',x:5,y:5,width:2,height:1,background:'#555555'},
    {kind:'glyph',...glyph(6,5,'X','#00aa00')},
  ]);
  const before=JSON.stringify(input),frame=reconstructProjection(input);
  assert.equal(frame.cells[5*80+4].text,'日本');
  assert.equal(frame.cells[5*80+5].text,' ');
  assert.equal(frame.cells[5*80+5].background,'#555555');
  assert.equal(frame.cells[5*80+6].text,'X');
  assert.equal(frame.cells[5*80+7].text,'');
  assert.equal(frame.cells[5*80+7].continuation,true);
  assert.equal(JSON.stringify(input),before);
  const context={canvas:{style:{}},setTransform(){},fillRect(){},fillText(){},strokeRect(){}};
  assert.equal(frame.text,drawProjection(context,input).text);
  assert.throws(()=>reconstructProjection(projection([],[{kind:'future'}])),/Unknown/);
  assert.throws(()=>reconstructProjection(projection([glyph(79,0,'wide','#ffffff',2)])),/outside/);
});

test('normal map validates @ against DRLP; excludes remembered cells, hazards, items and overlays',()=>{
  const input=corridor();
  input.glyphs.push(glyph(9,12,'.','#555555'),glyph(10,12,'#'),glyph(11,12,'+'),
    glyph(12,12,'>'),glyph(13,12,'='),glyph(14,12,'T'),glyph(15,12,'h','#aaaaaa'),
    glyph(20,22,'.'),glyph(0,11,'.'));
  input.commands.push({kind:'glyph',...glyph(8,11,'.')});
  const observation=observeMap(input,probe);
  assert.deepEqual(observation.player.mapCoordinate,{x:7,y:10});
  assert.deepEqual(observation.player.coordinate,{x:7,y:11});
  assert.equal(observation.clearCells.length,7);
  assert.deepEqual(observation.hostiles.map(({x,y})=>({x,y})),[{x:15,y:11}]);
  assert.throws(()=>observeMap(input,{...probe,x:6}),/validation failed/);
  assert.throws(()=>observeMap(input,{playerPresent:false}),/player probe/);
});

test('saved corridor permits only observed cardinal route 7 to 15,10 with a one-action bound',()=>{
  const observation=observeMap(corridor(),probe);
  assert.deepEqual(chooseObservedRoute(observation,{visited:new Set(['7,10']),maxSteps:1}),
    [{x:8,y:10,key:'ArrowRight',code:'ArrowRight'}]);
  assert.deepEqual(chooseObservedRoute(observation,{maxSteps:12,eastOnly:true}).map(({x,y})=>[x,y]),
    Array.from({length:8},(_,i)=>[8+i,10]));
  assert.deepEqual(chooseObservedRoute(observation,{visited:new Set(
    Array.from({length:9},(_,i)=>`${7+i},10`)),maxSteps:1}),[]);
});

test('frontier BFS goes around observed obstruction and never traverses unknown or a hostile',()=>{
  const input=projection([glyph(7,11,'@','#ffffff'),glyph(8,11,'#'),glyph(7,10,'.'),
    glyph(8,10,'.'),glyph(9,10,'.'),glyph(9,11,'h','#aaaaaa')]);
  const observation=observeMap(input,probe);
  const route=chooseObservedRoute(observation,{maxSteps:20,eastOnly:false});
  assert.deepEqual(route.map(({x,y})=>[x,y]),[[7,9],[8,9],[9,9]]);
  assert.ok(route.every(step=>observation.clearCells.some(cell=>cell.x===step.x&&cell.y===step.y)));
  assert.deepEqual(chooseObservedRoute(observeMap(projection([glyph(7,11,'@','#ffffff')]),probe)),[]);
});

test('native JA templates preserve displayed names and reject ammo/noise as outcomes',()=>{
  const name='BrowserMarine_5489 / Alice (external). [x]';
  const hit=fill(ja['message.missile-hits'],{target:name});
  const death=fill(ja['message.death.visible'],{subject:name});
  const result=captureCombatMessages(`  ${hit}  \n${death}\n${ja['message.hit.player-default']}\n[5/6] (40)`,{catalog:ja});
  assert.equal(result.hits[0].name,name);
  assert.equal(result.deaths[0].name,name);
  assert.equal(result.playerHits.length,1);
  assert.equal(result.findings.length,0);
  const chained=captureCombatMessages(`${hit} ${death} ${ja['message.hit.player-default']}`,{catalog:ja});
  assert.equal(chained.hits[0].name,name);assert.equal(chained.deaths[0].name,name);
  assert.equal(chained.playerHits.length,1);
  assert.deepEqual(captureCombatMessages('[5/6] (40)',{catalog:ja}).hits,[]);
  const leak=captureCombatMessages(fill(en['message.death.visible'],{subject:name}),{catalog:{ja,en}});
  assert.equal(leak.deaths.length,0);
  assert.equal(leak.findings[0].name,name);
});

test('literal template punctuation is escaped; changed/missing fields fail instead of guessing',()=>{
  const custom={...ja,'message.missile-hits':'[hit] {{target}} (ok).'};
  assert.equal(captureCombatMessages('[hit] A+B (ok).',{catalog:custom}).hits[0].name,'A+B');
  assert.equal(captureCombatMessages('hhith A+B ookX',{catalog:custom}).hits.length,0);
  assert.throws(()=>captureCombatMessages('',{catalog:{...ja,'message.death.visible':'{{who}} died'}}),/field/);
});

test('target witness uses exact native wound labels and requires original cursor/normal-hostile correlation',()=>{
  const input=corridor();input.glyphs.push(glyph(10,12,'h','#aaaaaa'));
  const normal=observeMap(input,probe);
  input.cursor=[10,12];input.commands=[{kind:'glyph',...glyph(10,12,'X','#00aa00')}];
  const name='unchanged  external identity';
  const wound=ja['entity.condition.unhurt'];
  const text=fill(ja['view.look-being'],{being:name,condition:wound})+' | floor';
  const witness=nativeTargetWitness(text,input,ja,{probe,hostiles:normal.hostiles});
  assert.equal(witness.name,name);assert.equal(witness.wound,wound);
  assert.equal(witness.x,10);assert.equal(witness.y,11);assert.equal(witness.validated,true);
  assert.equal(nativeTargetWitness(text,input,ja).validated,false);
  assert.equal(nativeTargetWitness(`${ja['view.target.fire']}    ${text}`,input,ja).name,name);
  assert.equal(nativeTargetWitness(text,input,ja,{probe,hostiles:[]}),null);
  assert.equal(nativeTargetWitness(text.replace(wound,'unknown condition'),input,ja),null);
  assert.equal(nativeTargetWitness(text,{...input,cursor:null},ja),null);
});

test('hidden native firing cursor uses one actual X command at a prior visible hostile, with bounded hit chance',()=>{
  const input=corridor();input.glyphs.push(glyph(10,12,'h','#aaaaaa'));
  const normal=observeMap(input,probe);input.commands=[{kind:'glyph',...glyph(10,12,'X','#00aa00')}];
  const description=fill(ja['view.look-being'],{being:'元人間',condition:ja['entity.condition.unhurt']});
  const opts={probe,hostiles:normal.hostiles};
  const w=nativeTargetWitness(ja['view.target.fire']+' '+description+' 84%',input,ja,opts);
  assert.equal(w.marker_source,'command_target_marker');assert.equal(w.validated,true);
  assert.equal(w.name,'元人間');assert.equal(w.x,10);assert.equal(w.y,11);
  assert.equal(nativeTargetWitness(description+' 101%',input,ja,opts),null);
  assert.equal(nativeTargetWitness(description,{...input,commands:[]},ja,opts),null);
  assert.equal(nativeTargetWitness(description,input,ja,{probe,hostiles:[]}),null);
  const second={x:12,y:11};
  assert.equal(nativeTargetWitness(description,{...input,commands:[...input.commands,{kind:'glyph',...glyph(12,12,'X','#00aa00')}]},ja,{probe,hostiles:[...normal.hostiles,second]}),null);
});
