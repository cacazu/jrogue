// SPDX-License-Identifier: GPL-3.0-or-later
// Parent-run actual Chrome scenario. This module never launches a process.
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const sha=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const count=(value,name)=>value[name]||0;

export async function runScenario({call,evaluate,output}){
  const result={passed:false,checks:[],menus:[],original_frames:[],scope:'Isolated actual original SDL physical input: finite menus/backend/mouse and mutual checkpoint exclusion',
    renderer_purity_claim:false,whole_campaign_verified:false,full_original_UI_projection_verified:false,
    limitations:['Original menu text is rendered in the native canvas. DOM text absence cannot prove that a menu failed; actual native counts, source ownership and screenshots are retained.',
      'Backend checks observe actual SDL state against pinned source semantics; a second independent original SDK browser A/B session is not claimed.',
      'Mobile evidence tests browser touch-to-mouse compatibility at one native dialog coordinate, not complete touch/pen/controller or IME behavior.',
      'Only cached Rust view/locale projection is tested for purity. Original input, system events, ticks, frames and graph saves remain effectful.']};
  const check=(name,passed,detail={})=>{result.checks.push({name,passed:Boolean(passed),...detail});if(!passed)throw Error(name+' failed: '+JSON.stringify(detail));};
  const physical=expression=>evaluate('window.tomePhysicalProbe.'+expression),play=expression=>evaluate('window.tomePlayProbe.'+expression);
  let mobile=false;
  async function frameErrorBoundary(label){
    const available=await evaluate('typeof window.tomePhysicalProbe?.frameErrors === "function"');
    check(label+' has the real readonly native Lua error observer',available);
    const value=await physical('frameErrors()');
    check(label+' leaves the original Lua error queue empty',value?.pending===0&&typeof value.message==='string',
      {original_lua_error:value});
    return value;
  }
  async function settled(){
    const deadline=Date.now()+15000;let status;
    do{
      status=await physical('settled()');const diagnostic=await physical('diagnostic()');
      if(diagnostic.failed)throw Error('Actual physical owner failed: '+JSON.stringify(diagnostic));
      if(!diagnostic.busy&&!status.busy&&status.tick_paused&&status.tick_end_pending===0)return status;
      await pause(25);
    }while(Date.now()<deadline);
    throw Error('Original physical boundary did not settle: '+JSON.stringify(status));
  }
  async function originalOperation(label,operation){
    const before=await frameErrorBoundary(label+' before'),beforeCalls=await play('calls()');
    await operation();const status=await settled();
    const after=await frameErrorBoundary(label+' after'),afterCalls=await play('calls()');
    const frameBefore=count(beforeCalls,'tome_native_draw_baseline'),frameAfter=count(afterCalls,'tome_native_draw_baseline');
    const report=await evaluate('window.tomePlayReport'),diagnostic=await physical('diagnostic()');
    const frame={operation:label,observer_before:before,observer_after:after,draw_calls_before:frameBefore,
      draw_calls_after:frameAfter,entered:frameAfter>frameBefore,returned_to_settled_boundary:!diagnostic.busy&&!diagnostic.failed,
      report_error:report.error??null,physical_error:report.physical_error??null};
    result.original_frames.push(frame);
    check(label+' enters an actual original frame and returns without Lua/owner error',frame.entered&&frame.returned_to_settled_boundary&&
      !frame.report_error&&!frame.physical_error,{frame});
    return status;
  }
  async function keyDown(key,code,virtual,modifiers=0){return originalOperation('physical keyDown '+code,
    ()=>call('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:virtual,nativeVirtualKeyCode:virtual,modifiers}));}
  async function keyUp(key,code,virtual,modifiers=0){return originalOperation('physical keyUp '+code,
    ()=>call('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:virtual,nativeVirtualKeyCode:virtual,modifiers}));}
  async function key(key,code,virtual){await physical('focus()');await keyDown(key,code,virtual);await keyUp(key,code,virtual);return settled();}
  async function shot(name){const captured=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true}),file=path.join(output,name);await writeFile(file,Buffer.from(captured.data,'base64'));return file;}
  async function sourceUi(){return {native:await physical('ui()'),rust:await play('presentation()'),dom_dialog_count:await evaluate('document.querySelectorAll("[role=dialog]").length')};}
  async function point(xFactor,yFactor){
    return evaluate(`(()=>{const canvas=document.querySelector('#original');canvas.scrollIntoView({block:'center'});canvas.focus({preventScroll:true});
      const status=window.tomePhysicalProbe.status(),rect=canvas.getBoundingClientRect(),left=rect.left+canvas.clientLeft,top=rect.top+canvas.clientTop;
      const x=left+canvas.clientWidth*${xFactor},y=top+canvas.clientHeight*${yFactor};
      return {x,y,expected_x:Math.trunc((x-left)*status.window_width/canvas.clientWidth),expected_y:Math.trunc((y-top)*status.window_height/canvas.clientHeight),
        native_width:status.window_width,native_height:status.window_height,client_width:canvas.clientWidth,client_height:canvas.clientHeight,
        viewport:innerWidth,scroll_width:document.documentElement.scrollWidth,within_viewport:x>=0&&x<innerWidth&&y>=0&&y<innerHeight};})()`);
  }
  function assertPure(value,name){check(name,value.passed===true&&value.pure_Rust_projection_zero_native_calls===true&&
    value.original_snapshot_preserved===true&&value.original_rng_preserved===true&&value.original_baseline_render_tested===false,{purity:value});}

  try{
    await mkdir(output,{recursive:true});
    const report=await evaluate('window.tomePlayReport'),initial=await play('raw()'),initialStatus=await physical('status()');
    await frameErrorBoundary('actual initial birth and original frame');
    check('isolated physical candidate completed genuine Japanese birth',report?.completed&&report.passed===true&&
      report.mode==='isolated_original_physical_input_candidate'&&report.original_locale==='ja_JP'&&initial.ready===true&&Boolean(initial.game?.player),
      {phase:report?.phase,error:report?.error,physical_error:report?.physical_error});
    check('one actual physical owner prepared before start and claimed after birth',Boolean(report.physical_prepare)&&Boolean(report.physical_claim)&&
      initialStatus.dialog_count===0&&!initialStatus.busy&&!initialStatus.checkpoint_busy&&initialStatus.text_input_active===true,
      {prepare:report.physical_prepare,claim:report.physical_claim,status:initialStatus});
    result.initial={turn:initial.game.turn,player:initial.game.player};
    const initialVirtual=count(await play('calls()'),'tome_native_command');
    assertPure(await play('purity()'),'pure Rust views before physical input call no C and preserve state/RNG');
    const readonlyBefore=await play('raw()'),readonlyRng=await play('rng()'),backendBefore=await physical('backend()');
    for(let index=0;index<6;index++){await physical('status()');await physical('backend()');await physical('ui()');}
    check('native physical/UI/backend getters are readonly with exact state and all RNG preserved',
      JSON.stringify(readonlyBefore)===JSON.stringify(await play('raw()'))&&readonlyRng===await play('rng()')&&
      JSON.stringify(backendBefore)===JSON.stringify(await physical('backend()')),{state_sha256:sha(readonlyBefore),rng_sha256:sha(readonlyRng)});

    await physical('focus()');await keyDown('Control','ControlLeft',17,2);await settled();
    const control=await physical('backend()');
    check('actual SDL backend records held left Control and its pinned modifier mask',control.pressed_scancodes.includes(224)&&
      (control.modifiers&0xc0)===0x40,{backend:control,source_semantics:'SDL_SCANCODE_LCTRL=224, KMOD_LCTRL=0x40'});
    await keyDown('Shift','ShiftLeft',16,10);await settled();const both=await physical('backend()');
    check('actual SDL backend simultaneously records left Shift and Control',both.pressed_scancodes.includes(224)&&both.pressed_scancodes.includes(225)&&
      (both.modifiers&0xc3)===0x41,{backend:both,source_semantics:'SDL_SCANCODE_LSHIFT=225, KMOD_LSHIFT=1'});
    await keyUp('Shift','ShiftLeft',16,2);await keyUp('Control','ControlLeft',17,0);await settled();const released=await physical('backend()');
    check('real modifier releases clear native pressed keys and modifier bits',!released.pressed_scancodes.includes(224)&&!released.pressed_scancodes.includes(225)&&
      (released.modifiers&0xc3)===0,{backend:released});

    for(const menu of [
      {key:'i',code:'KeyI',vk:73,label:'inventory',source:'mod/class/Game.lua:2309 SHOW_INVENTORY -> original player:showEquipInven'},
      {key:'m',code:'KeyM',vk:77,label:'talents',source:'mod/class/Game.lua:2343 USE_TALENTS -> mod.dialogs.UseTalents'},
      {key:'j',code:'KeyJ',vk:74,label:'quests',source:'mod/class/Game.lua:2372 SHOW_QUESTS -> engine.dialogs.ShowQuests'},
      {key:'Escape',code:'Escape',vk:27,label:'main-menu',source:'mod/class/Game.lua:2434 EXIT -> engine.dialogs.GameMenu'},
    ]){
      const before=await physical('status()'),beforeCalls=await play('calls()');const opened=await key(menu.key,menu.code,menu.vk);
      const afterCalls=await play('calls()'),ui=await sourceUi();
      check('real physical '+menu.label+' key opens an original native dialog',before.dialog_count===0&&opened.dialog_count>before.dialog_count&&
        count(afterCalls,'tome_physical_key')>=count(beforeCalls,'tome_physical_key')+2&&count(afterCalls,'tome_native_command')===initialVirtual,
        {status:opened,source:menu.source,dom_dialog_count:ui.dom_dialog_count});
      const png=await shot('physical-'+menu.label+'-desktop.png');
      result.menus.push({label:menu.label,source:menu.source,actual_dialog_count:opened.dialog_count,
        source_ui:ui.native,rust_dialog_count:ui.rust.ui?.dialogs?.length??null,dom_dialog_count:ui.dom_dialog_count,screenshot:png});
      const closed=await key('Escape','Escape',27);
      check('real Escape closes original '+menu.label+' back to the prior dialog boundary',closed.dialog_count===before.dialog_count,
        {before_count:before.dialog_count,after_count:closed.dialog_count});
    }
    // Observe trusted MouseEvent coordinates at the real browser boundary.
    // CDP requested fractional coordinates are not the delivered DOM values.
    await evaluate(`(()=>{window.__tomePhysicalMouseOracle=[];
      for(const kind of ['mousemove','mouseup'])window.addEventListener(kind,event=>{
        const canvas=document.querySelector('#original');if(event.target!==canvas||!event.isTrusted)return;
        const status=window.tomePhysicalProbe.status(),rect=canvas.getBoundingClientRect();
        const left=rect.left+canvas.clientLeft,top=rect.top+canvas.clientTop;
        window.__tomePhysicalMouseOracle.push({kind,trusted:event.isTrusted,client_x:event.clientX,client_y:event.clientY,
          expected_x:Math.trunc((event.clientX-left)*status.window_width/canvas.clientWidth),
          expected_y:Math.trunc((event.clientY-top)*status.window_height/canvas.clientHeight)});
      },{capture:true,passive:true});return true;})()`);
    const pcPoint=await point(.50,.17),mouseBefore=await play('calls()');
    await originalOperation('physical desktop mouse motion',()=>call('Input.dispatchMouseEvent',
      {type:'mouseMoved',x:pcPoint.x,y:pcPoint.y,button:'none',buttons:0}));
    const pcBackend=await physical('backend()'),pcDelivered=await evaluate("window.__tomePhysicalMouseOracle.filter(event=>event.kind==='mousemove').at(-1)");
    check('actual desktop motion reaches native SDL pixel coordinates through Rust',pcDelivered?.trusted===true&&pcBackend.mouse_x===pcDelivered.expected_x&&pcBackend.mouse_y===pcDelivered.expected_y&&
      count(await play('calls()'),'tome_physical_motion')>count(mouseBefore,'tome_physical_motion'),{requested_point:pcPoint,delivered_event:pcDelivered,backend:pcBackend});

    // Keep a genuine modal quest dialog current for the mobile canvas tap; never
    // fabricate a UI control or click a gameplay map merely to obtain packets.
    await key('j','KeyJ',74);
    await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});mobile=true;
    await call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
    const mobilePoint=await point(.50,.17),touchBefore=await play('calls()');
    check('actual native canvas coordinate fits the 390px mobile viewport',mobilePoint.viewport===390&&mobilePoint.scroll_width<=392&&mobilePoint.within_viewport,
      {point:mobilePoint});
    const touchErrorBefore=await frameErrorBoundary('physical mobile touch before'),touchFrameBefore=count(await play('calls()'),'tome_native_draw_baseline');
    await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:mobilePoint.x,y:mobilePoint.y}]});
    await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    const touchDeadline=Date.now()+10000;let touchAfter;
    do{await settled();touchAfter=await play('calls()');if(count(touchAfter,'tome_physical_button')>=count(touchBefore,'tome_physical_button')+2)break;await pause(25);}while(Date.now()<touchDeadline);
    const mobileBackend=await physical('backend()'),mobileStatus=await physical('status()'),mobileDelivered=await evaluate("window.__tomePhysicalMouseOracle.filter(event=>event.kind==='mouseup').at(-1)");
    const touchErrorAfter=await frameErrorBoundary('physical mobile touch after'),touchFrameAfter=count(await play('calls()'),'tome_native_draw_baseline');
    result.original_frames.push({operation:'physical mobile touch compatibility batch',observer_before:touchErrorBefore,
      observer_after:touchErrorAfter,draw_calls_before:touchFrameBefore,draw_calls_after:touchFrameAfter,
      entered:touchFrameAfter>touchFrameBefore,returned_to_settled_boundary:!mobileStatus.busy});
    check('physical mobile touch enters and returns from an actual original frame',touchFrameAfter>touchFrameBefore&&!mobileStatus.busy);
    check('real mobile touch produces one compatibility mouse press/release in native SDL',
      count(touchAfter,'tome_physical_button')===count(touchBefore,'tome_physical_button')+2&&mobileBackend.mouse_buttons===0&&
      mobileDelivered?.trusted===true&&mobileBackend.mouse_x===mobileDelivered.expected_x&&mobileBackend.mouse_y===mobileDelivered.expected_y,
      {requested_point:mobilePoint,delivered_event:mobileDelivered,backend:mobileBackend,status:mobileStatus,button_packets:count(touchAfter,'tome_physical_button')-count(touchBefore,'tome_physical_button')});
    result.mobile={point:mobilePoint,backend:mobileBackend,status:mobileStatus,source_ui:await physical('ui()'),screenshot:await shot('physical-quests-mobile.png')};
    if(mobileStatus.dialog_count>0)await key('Escape','Escape',27);
    check('actual native dialog boundary is clear before checkpoint tests',(await physical('status()')).dialog_count===0);
    const gateErrorBefore=await frameErrorBoundary('mutual checkpoint exclusion before'),gateFrameBefore=count(await play('calls()'),'tome_native_draw_baseline');
    const exclusion=await physical('gateExclusion()');result.checkpoint_exclusion=exclusion;
    const gateErrorAfter=await frameErrorBoundary('mutual checkpoint exclusion after'),gateFrameAfter=count(await play('calls()'),'tome_native_draw_baseline');
    result.original_frames.push({operation:'mutual checkpoint exclusion and genuine save',observer_before:gateErrorBefore,
      observer_after:gateErrorAfter,draw_calls_before:gateFrameBefore,draw_calls_after:gateFrameAfter,
      entered:gateFrameAfter>gateFrameBefore,returned_to_settled_boundary:!exclusion.final_status.busy});
    check('valid empty physical transaction returns through an actual original frame',gateFrameAfter>gateFrameBefore&&!exclusion.final_status.busy);
    const saveBlocked=exclusion.save_while_physical,physicalBlocked=exclusion.physical_while_save;
    check('real full-save settle rejects its gate while physical input is collecting',saveBlocked.rejection.phase==='rejected'&&
      saveBlocked.rejection.error?.id==='save.bridge.gate_busy'&&saveBlocked.physical_still_collecting&&saveBlocked.checkpoint_not_acquired&&
      saveBlocked.original_state_unchanged&&saveBlocked.combined_rng_unchanged&&saveBlocked.runtime_files_byte_identical,{probe:saveBlocked});
    check('real physical begin rejects a held genuine save without mutation or gate loss',Boolean(physicalBlocked?.rejection.error_id)&&
      physicalBlocked.checkpoint_still_held&&physicalBlocked.original_state_unchanged&&physicalBlocked.combined_rng_unchanged&&
      physicalBlocked.runtime_files_byte_identical,{probe:physicalBlocked});
    check('valid physical transaction closes normally and genuine checkpoint commits',exclusion.save.operation.phase==='complete'&&
      exclusion.save.durable.phase==='committed'&&!exclusion.final_status.busy&&!exclusion.final_status.checkpoint_busy&&
      exclusion.final_backend.mouse_buttons===0,{save:exclusion.save,final_status:exclusion.final_status});
    assertPure(await play('purity()'),'pure Rust views after physical menus/mouse/save still call no C and preserve state/RNG');
    check('tested menus and mouse never use the old virtual gameplay command owner',count(await play('calls()'),'tome_native_command')===initialVirtual);
    const final=await play('raw()');result.final={turn:final.game.turn,player:final.game.player};
    check('external original player name remains unchanged',final.game.player.name===initial.game.player.name,{name:final.game.player.name});
    await frameErrorBoundary('final original error queue');
    result.passed=result.checks.every(row=>row.passed);
  }catch(error){result.error=error.stack||String(error);}
  finally{
    if(mobile){try{await call('Emulation.setTouchEmulationEnabled',{enabled:false});}catch{}
      try{await call('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});}catch{}}
  }
  await writeFile(path.join(output,'physical-input-evidence.json'),JSON.stringify(result,null,2));return result;
}
