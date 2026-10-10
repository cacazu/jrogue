// SPDX-License-Identifier: GPL-3.0-or-later
// Genuine bounded physical navigation; read-only observer queries are outside purity brackets.
import fs from 'node:fs/promises';import path from 'node:path';
export async function runScenario({call,evaluate,output}){
 const result={protocol:1,passed:false,checks:[],steps:[],source_only_route_became_live_reviewed:false,
  combat_verified:false,stairs_verified:false,death_verified:false,full_campaign_verified:false,
  observer_heap_pure:false,actor_mutation:false,limits:{physical_steps:8},source_commit:'624a67329fe2ad440c5b344785a9c73fcf22ae63'};
 const check=(name,passed,detail={})=>{result.checks.push({name,passed,...detail});if(!passed)throw Error(name);};
 const query=()=>evaluate('window.tomeGameFlowProbe.snapshot(0)');
 const calls=()=>evaluate('window.tomePlayProbe.calls()');
 const frameErrors=()=>evaluate('window.tomePhysicalProbe.frameErrors()');
 const settle=()=>evaluate('window.tomePhysicalProbe.settled()');
 const scan=(s)=>({game:s.game,zone:s.zone,level:s.level,player:s.player,terrain:s.current_terrain});
 const count=(d,k)=>d[k]||0;
 try{
  check('actual game-flow facade installed',await evaluate('!!window.tomeGameFlowProbe'));
  result.installation=await evaluate('window.tomeGameFlowProbe.installation()');
  check('original hooks installed once after genuine birth',result.installation.hooks_attached_post_birth===true&&result.installation.hook_callbacks_return_nil===true,{installation:result.installation});
  await evaluate('window.tomePhysicalProbe.focus()');await settle();
  const initial=await query();result.initial=initial;
  check('actual seed176 original player and map',initial.available===true&&initial.player.x===0&&initial.player.y===10&&initial.player.life===132&&initial.player.level===1&&initial.game.turn===0&&initial.navigation.available===true&&initial.dialog_count===0,{initial});
  check('external player name stays exactly wolf',initial.player.name==='wolf');
  const raw0=await evaluate('window.tomePlayProbe.raw()'),rng0=await evaluate('window.tomePlayProbe.rng()');
  const repeated=await query(),raw1=await evaluate('window.tomePlayProbe.raw()'),rng1=await evaluate('window.tomePlayProbe.rng()');
  check('copied observer query preserves finite domain and full original RNG',JSON.stringify(scan(initial))===JSON.stringify(scan(repeated))&&JSON.stringify(raw0)===JSON.stringify(raw1)&&rng0===rng1,{heap_pure:false});
  check('passive trusted-key oracle was registered before original host listeners',await evaluate('Array.isArray(window.__tomeRoadEvents)'));
  const startCalls=await calls();let before=initial;
  const route=[['ArrowRight',39,1,10],['ArrowRight',39,2,10],['ArrowUp',38,2,9],['ArrowRight',39,3,9],['ArrowUp',38,3,8],['ArrowRight',39,4,8],['ArrowRight',39,5,8],['ArrowRight',39,6,8]];
  for(const [key,vk,x,y] of route){
   const cell=before.navigation.cells.find(c=>c.x===x&&c.y===y);
   check('live destination is currently seen with copied terrain',cell?.in_bounds===true&&cell.visible===true&&!!cell.terrain&&before.dialog_count===0,{step:result.steps.length,cell});
   if(before.navigation.cells.some(candidate=>candidate.actor))throw Error('Visible adjacent actor encountered; stop for live source review');
   const preCalls=await calls();
   await call('Input.dispatchKeyEvent',{type:'keyDown',key,code:key,windowsVirtualKeyCode:vk,nativeVirtualKeyCode:vk,modifiers:0});await settle();
   const down=await query();
   check('trusted physical key reaches the original visible-road destination',down.player.x===x&&down.player.y===y&&down.player.name===initial.player.name&&down.player.life===initial.player.life&&down.dialog_count===0&&down.level.identity===initial.level.identity&&down.trace_sequence===0&&down.game.turn>before.game.turn,{before:scan(before),after:scan(down)});
   await call('Input.dispatchKeyEvent',{type:'keyUp',key,code:key,windowsVirtualKeyCode:vk,nativeVirtualKeyCode:vk,modifiers:0});await settle();
   const after=await query(),postCalls=await calls(),backend=await evaluate('window.tomePhysicalProbe.backend()'),errors=await frameErrors();
   check('key release creates no second player action',JSON.stringify(scan(after))===JSON.stringify(scan(down))&&count(postCalls,'tome_physical_key')===count(preCalls,'tome_physical_key')+2&&backend.pressed_scancodes.length===0,{backend});
   check('original native frame error queue remains empty',errors.pending===0,{errors});
   result.steps.push({key,destination:{x,y},live_preflight:cell,before:scan(before),after:scan(after),native_key_submissions:2});before=after;
  }
  const finalCalls=await calls();
  check('no virtual original command was substituted',count(finalCalls,'tome_native_command')===count(startCalls,'tome_native_command'));
  result.events=await evaluate('window.__tomeRoadEvents');
  check('all sixteen browser key events are trusted and in exact order',result.events.length===16&&result.events.every((e,i)=>e.trusted===true&&e.type===(i%2?'keyup':'keydown')&&e.code===route[Math.floor(i/2)][0]),{events:result.events});
  result.final=before;result.source_only_route_became_live_reviewed=true;result.passed=true;
  const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await fs.writeFile(path.join(output,'original-visible-road-desktop.png'),Buffer.from(shot.data,'base64'));
 }catch(error){result.error=String(error?.stack||error);}
 await fs.writeFile(path.join(output,'visible-road-evidence.json'),JSON.stringify(result,null,2)+'\n');return result;
}
