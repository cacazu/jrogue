import test from 'node:test';
import assert from 'node:assert/strict';
import {observeMap,chooseObservedRoute} from './original-combat-witness.mjs';
import {chooseObservedEntryRoute} from './original-entry-route.mjs';

const glyph=(x,y,text,foreground='#aa0000',columns=1)=>
  ({x,y:y+1,text,foreground,columns,background:'#000000'});
const observation=(cells=[],commands=[])=>observeMap({width:80,height:25,cursor:null,
  glyphs:[glyph(7,10,'@','#ffffff'),...cells],commands},
  {playerPresent:true,x:7,y:10,hp:72,hpMax:72,exp:0,level:1,state:4});
const floor=(x,y)=>glyph(x,y,'.');
const door=(x,y)=>glyph(x,y,'+','#aa5500');
const portal=(x,y)=>glyph(x,y,'/','#aa5500');
const xy=route=>route.map(({x,y,kind})=>[x,y,kind]);

test('closed door is only the final action; route and zero-action bounds are respected',()=>{
  const map=observation([floor(8,10),floor(9,10),door(10,10)]);
  assert.deepEqual(xy(chooseObservedEntryRoute(map,{maxSteps:10})),
    [[8,10,'clear'],[9,10,'clear'],[10,10,'open_door']]);
  assert.deepEqual(chooseObservedEntryRoute(map),
    [{x:8,y:10,key:'ArrowRight',code:'ArrowRight',kind:'clear'}]);
  assert.deepEqual(chooseObservedEntryRoute(map,{maxSteps:0}),[]);
});

test('a blocked or unseen approach never routes through walls, hostiles, hazards, or items',()=>{
  for (const text of ['#','h','=','T','>']) {
    const blocker=glyph(8,10,text,text==='h'?'#aaaaaa':'#aa0000');
    const map=observation([blocker,door(9,10)]);
    assert.deepEqual(chooseObservedEntryRoute(map,{maxSteps:10}),[],text);
  }
  assert.deepEqual(chooseObservedEntryRoute(observation([door(9,10)]),{maxSteps:10}),[]);
});

test('observed open portal is traversable only after caller recorded a successful opening',()=>{
  const map=observation([portal(8,10),floor(9,10),door(10,10)]);
  assert.deepEqual(chooseObservedEntryRoute(map,{maxSteps:10}),[]);
  assert.deepEqual(xy(chooseObservedEntryRoute(map,{opened:new Set(['8,10']),maxSteps:10})),
    [[8,10,'enter_open_door'],[9,10,'clear'],[10,10,'open_door']]);
  const stale=observation([glyph(8,10,'/','#555555'),floor(9,10),door(10,10)]);
  assert.deepEqual(chooseObservedEntryRoute(stale,{opened:new Set(['8,10']),maxSteps:10}),[]);
});

test('shortest reachable door wins; equal distances prefer east then stable y proximity',()=>{
  const map=observation([floor(8,10),floor(9,10),door(10,10),door(7,9)]);
  assert.deepEqual(xy(chooseObservedEntryRoute(map,{maxSteps:10})),[[7,9,'open_door']]);
  const tied=observation([door(7,9),door(7,11),door(8,10),door(6,10)]);
  assert.deepEqual(chooseObservedEntryRoute(tied),
    [{x:8,y:10,key:'ArrowRight',code:'ArrowRight',kind:'open_door'}]);
  const vertical=observation([door(7,9),door(7,11)]);
  assert.deepEqual(xy(chooseObservedEntryRoute(vertical)),[[7,9,'open_door']]);
});

test('memory colors, overlays and wide primitives cannot become door candidates',()=>{
  const remembered=observation([glyph(8,10,'+','#555555')]);
  assert.deepEqual(chooseObservedEntryRoute(remembered),[]);
  const overlay=observation([door(8,10)],[{kind:'glyph',...door(8,10)}]);
  assert.deepEqual(chooseObservedEntryRoute(overlay),[]);
  const wide=observation([glyph(8,10,'+','#aa5500',2)]);
  assert.deepEqual(chooseObservedEntryRoute(wide),[]);
});

test('fallback delegates to frozen clear-frontier selection and can transit a known portal',()=>{
  const map=observation([floor(8,10),floor(9,10),floor(10,10)]);
  const visited=new Set(['7,10']);
  const expected=chooseObservedRoute(map,{visited,maxSteps:3,eastOnly:false})
    .map(step=>({...step,kind:'clear'}));
  assert.deepEqual(chooseObservedEntryRoute(map,{visited,maxSteps:3}),expected);
  const through=observation([portal(8,10),floor(9,10)]);
  assert.deepEqual(xy(chooseObservedEntryRoute(through,{opened:new Set(['8,10']),maxSteps:3})),
    [[8,10,'enter_open_door'],[9,10,'clear']]);
  assert.deepEqual(chooseObservedEntryRoute(observation([portal(8,10)]),
    {opened:new Set(['8,10']),maxSteps:3}),[]);
});

test('route proposals do not mutate observations or caller tracking sets',()=>{
  const map=observation([portal(8,10),floor(9,10),door(10,10)]);
  const visited=new Set(['7,10']),opened=new Set(['8,10']);
  const before=JSON.stringify(map);
  chooseObservedEntryRoute(map,{visited,opened,maxSteps:8});
  assert.equal(JSON.stringify(map),before);
  assert.deepEqual([...visited],['7,10']);assert.deepEqual([...opened],['8,10']);
  assert.throws(()=>chooseObservedEntryRoute(map,{maxSteps:-1}),/nonnegative/);
  assert.throws(()=>chooseObservedEntryRoute(map,{opened:[]}),/Sets/);
  assert.throws(()=>chooseObservedEntryRoute({...map,mapping:{validated:false}}),/Validated/);
});
