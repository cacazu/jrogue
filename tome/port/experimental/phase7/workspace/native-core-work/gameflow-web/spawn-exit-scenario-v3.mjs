// SPDX-License-Identifier: GPL-3.0-or-later
// One actual original stair command, sent as trusted keyboard events.
import fs from 'node:fs/promises';
import path from 'node:path';
export async function runScenario({call,evaluate,output}) {
 const result={protocol:1,passed:false,checks:[],stairs_verified:false,combat_verified:false,
  death_verified:false,full_campaign_verified:false,observer_heap_pure:false,actor_mutation:false,
  source_commit:'624a67329fe2ad440c5b344785a9c73fcf22ae63'};
 const check=(name,passed,detail={})=>{result.checks.push({name,passed,...detail});if(!passed)throw Error(name);};
 const query=()=>evaluate('window.tomeGameFlowProbe.snapshot(0)');
 const settle=()=>evaluate('window.tomePhysicalProbe.settled()');
 const key=async(type,key,code,vk,modifiers=0,text)=>{
  const event={type,key,code,windowsVirtualKeyCode:vk,nativeVirtualKeyCode:vk,modifiers};
  if(text!==undefined){event.text=text;event.unmodifiedText=',';}
  await call('Input.dispatchKeyEvent',event);await settle();
 };
 try {
  check('real original flow observer exists',await evaluate('!!window.tomeGameFlowProbe'));
  await evaluate('window.tomePhysicalProbe.focus()');await settle();
  const before=await query();result.initial=before;
  check('genuine original spawn on eligible wilderness exit',before.available===true&&before.player.x===0&&before.player.y===10&&before.player.life===132&&before.game.turn===0&&before.dialog_count===0&&before.current_terrain.change_level===1&&before.current_terrain.change_zone==='wilderness',{before});
  check('external player name remains wolf',before.player.name==='wolf');
  const startCalls=await evaluate('window.tomePlayProbe.calls()');
  // The passive oracle was installed before the owner; this extension observes
  // actual keypress only and neither changes default behavior nor generates input.
  check('passive text oracle exists before owner listeners',await evaluate('Array.isArray(window.__tomeStairTextEvents)'));
  await key('keyDown','Shift','ShiftLeft',16,8);
  await key('keyDown','<','Comma',188,8,'<');
  // Key release has to reach the same ownership path even after the original
  // level generation has completed; there is no synthetic command or direct Lua call.
  await key('keyUp','<','Comma',188,8);
  await key('keyUp','Shift','ShiftLeft',16,0);
  const after=await query();result.final=after;
  const endCalls=await evaluate('window.tomePlayProbe.calls()');result.calls={before:startCalls,after:endCalls};
  const backend=await evaluate('window.tomePhysicalProbe.backend()');result.backend=backend;
  const errors=await evaluate('window.tomePhysicalProbe.frameErrors()');result.frame_errors=errors;
  result.key_events=await evaluate('window.__tomeRoadEvents');
  result.text_events=await evaluate('window.__tomeStairTextEvents');
  check('four actual browser key events are trusted and ordered',result.key_events.length===4&&result.key_events.every(e=>e.trusted===true)&&result.key_events.map(e=>e.type+':'+e.code).join('|')==='keydown:ShiftLeft|keydown:Comma|keyup:Comma|keyup:ShiftLeft',{events:result.key_events});
  check('physical keys are released',backend.pressed_scancodes.length===0,{backend});
  check('virtual commands were never substituted',(endCalls.tome_native_command||0)===(startCalls.tome_native_command||0));
  check('actual native text input carried the stair glyph',(endCalls.tome_physical_text||0)===(startCalls.tome_physical_text||0)+1&&result.text_events.length===1&&result.text_events[0].trusted===true&&result.text_events[0].charCode===60&&result.text_events[0].key==='<', {text_events:result.text_events});
  check('original wilderness generation and placement completed',after.zone.identity!==before.zone.identity&&after.level.identity!==before.level.identity&&after.zone.short_name==='wilderness'&&after.dialog_count===0,{after});
  check('same valid player UID and descriptors survive genuine transition',Number.isInteger(before.player.uid)&&before.player.uid>0&&after.player.uid===before.player.uid&&after.player.name===before.player.name&&after.player.life===before.player.life&&after.player.level===before.player.level&&JSON.stringify(after.player.descriptor)===JSON.stringify(before.player.descriptor)&&after.player.death_count===before.player.death_count&&after.trace_sequence===before.trace_sequence);
  check('original native frame error queue stays empty',errors.pending===0,{errors});
  result.stairs_verified=true;result.passed=true;
  const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await fs.writeFile(path.join(output,'original-wilderness-exit-desktop.png'),Buffer.from(shot.data,'base64'));
 } catch(error) {result.error=String(error?.stack||error);}
 await fs.writeFile(path.join(output,'spawn-exit-evidence.json'),JSON.stringify(result,null,2)+'\n');return result;
}
