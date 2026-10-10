/* SPDX-License-Identifier: GPL-3.0-or-later
 * Source-only until the parent's monitored Chrome run. Tests one genuine
 * original popup, not complete game UI/campaign/save or native SDL input drain.
 */
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';

const sha=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const count=(value,name)=>value[name]||0;
const japanese=value=>typeof value==='string'&&/\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}/u.test(value);
const finiteBounds=value=>value&&['x','y','w','h'].every(key=>Number.isFinite(value[key]))&&value.w>0&&value.h>0;

export async function runScenario({call,evaluate,evidence,output}){
  const result={passed:false,scope:'Real original yesnoPopup through Rust UI kinds3/4',checks:[],opens:[],
    limitations:['One source-identified original popup covers its actual Textzone/Buttons and callbacks; other game dialogs remain separate work.',
      'The comparison canvas uses one explicit original effectful background draw before observations; purity tests exclude it.',
      'Tested DOM keyboard/mouse/touch input is owned by Rust; native SDL queue processing is not asserted.',
      'Rust diagnostic JA/EN repaint is read-only; it is not the original persisted locale reboot flow.']};
  function check(name,passed,detail={}){
    result.checks.push({name,passed:Boolean(passed),...detail});
    if(!passed)throw Error(name+' failed: '+JSON.stringify(detail));
  }
  const probe=expression=>evaluate('window.tomeUiRoundtripProbe.'+expression);
  const calls=()=>probe('calls()');
  const pending=()=>probe('pendingCalls()');
  async function waitForOne(before){
    const deadline=Date.now()+10000;let after;
    do{
      after=await calls();
      if(count(after,'tome_native_ui_command')>count(before,'tome_native_ui_command')+1)throw Error('More than one original UI action dispatched');
      if(count(after,'tome_native_ui_command')===count(before,'tome_native_ui_command')+1){
        const settled=await probe('settled()');
        if(settled.pending_kind===0){
          check('accepted UI action has no Rust/native error',!settled.error_id,{error_id:settled.error_id||null});return await calls();
        }
      }
      await new Promise(resolve=>setTimeout(resolve,25));
    }while(Date.now()<deadline);
    throw Error('The actual original UI action did not settle once');
  }
  async function point(target){
    return evaluate(`(()=>{
      const button=Array.from(document.querySelectorAll('[data-tome-ui-target]')).find(node=>node.dataset.tomeUiTarget===${JSON.stringify(target)});
      if(!button)throw Error('Actual projected component button is absent');
      button.scrollIntoView({block:'center'});const r=button.getBoundingClientRect();
      return{x:r.left+r.width/2,y:r.top+r.height/2,width:r.width,height:r.height,disabled:button.disabled,
        viewport:{w:innerWidth,h:innerHeight},scroll_width:document.documentElement.scrollWidth,text:button.textContent};
    })()`);
  }
  async function capture(name){
    const image=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
    const file=path.join(output,name);await writeFile(file,Buffer.from(image.data,'base64'));return file;
  }
  async function open(){
    const kindsBefore=await pending();
    const observation=await probe('open("ja")'),s=observation.status,u=observation.ui,frame=observation.presentation;
    result.opens.push({generation:s.generation,dialog:s.dialog,yes:s.yes,no:s.no,gate:observation.gate});
    const top=u.stack.at(-1),projected=frame.ui?.dialogs.at(-1),kindsAfter=await pending();
    check('genuine source factory registers one live original dialog',s.phase==='open'&&u.protocol===1&&u.stack.length===1&&
      top?.active===true&&top.handle===s.dialog&&top.class_name==='engine.ui.Dialog'&&finiteBounds(top.bounds),
      {generation:s.generation,dialog:s.dialog,class_name:top?.class_name,bounds:top?.bounds});
    check('actual three widget identities and geometry project through kind3',top.components.length===3&&
      top.components.every(component=>finiteBounds(component.bounds))&&top.components[0].kind==='text'&&
      top.components[1].kind==='button'&&top.components[1].handle===s.yes&&
      top.components[2].kind==='button'&&top.components[2].handle===s.no&&
      projected?.handle===s.dialog&&projected.components.map(component=>component.handle).join('|')===top.components.map(component=>component.handle).join('|')&&
      count(kindsAfter,'3')===count(kindsBefore,'3')+1,
      {source_components:top.components.map(({handle,class_name,kind,bounds})=>({handle,class_name,kind,bounds})),pending_kind3:kindsAfter['3']});
    const body=top.components[0].text;
    check('four semantic IDs and external original name survive the native boundary',top.title?.kind==='semantic'&&top.title.id==='ui.roundtrip.title'&&
      body?.kind==='semantic'&&body.id==='ui.roundtrip.body'&&body.args?.character_name?.kind==='external'&&
      body.args.character_name.value===s.external_name&&s.external_name===result.initial_player.name&&
      top.components[1].text?.id==='ui.roundtrip.yes'&&top.components[2].text?.id==='ui.roundtrip.no',
      {title_id:top.title?.id,body_id:body?.id,external_name:s.external_name});
    check('Japanese is the Rust dialog presentation default',frame.locale==='ja'&&japanese(projected.title)&&
      japanese(projected.components[1].text)&&projected.components[0].text.includes(s.external_name),
      {title:projected.title,body:projected.components[0].text,yes:projected.components[1].text,no:projected.components[2].text});
    check('original focus and genuine virtual bindings remain authoritative',top.focused===s.yes&&
      top.components[1].actions.includes('ACCEPT')&&top.components[2].actions.includes('ACCEPT')&&top.actions.includes('EXIT'),
      {focused:top.focused,dialog_actions:top.actions,yes_actions:top.components[1].actions,no_actions:top.components[2].actions});
    const gate=observation.gate;
    check('observed input deadline respects natural original SDL time',gate.deadline===null||gate.original_clock_end_ms>=gate.deadline,
      {gate});return observation;
  }
  async function closed(expected,before,kindBefore,route){
    const after=await waitForOne(before),kindAfter=await pending();
    check('one accepted kind4 invokes one real original callback path: '+route,
      count(after,'tome_native_ui_command')===count(before,'tome_native_ui_command')+1&&
      count(kindAfter,'4')===count(kindBefore,'4')+1,{before:count(before,'tome_native_ui_command'),after:count(after,'tome_native_ui_command'),route});
    const verified=await probe('verifyClosed('+JSON.stringify(expected)+')');
    check('original preexit -> unregister -> outcome and handler identity restoration: '+expected,
      verified.phase==='closed'&&verified.preexit_count===1&&verified.outcome_count===1&&verified.outcome===expected&&
      verified.stack_restored&&verified.key_handler_restored&&verified.mouse_handler_restored&&verified.events.length===2&&
      verified.events[0].stage==='preexit'&&verified.events[0].stack_contains_dialog&&verified.events[0].key_owned_by_dialog&&verified.events[0].mouse_owned_by_dialog&&
      verified.events[1].stage==='outcome'&&!verified.events[1].stack_contains_dialog&&!verified.events[1].key_owned_by_dialog&&!verified.events[1].mouse_owned_by_dialog,
      {status:verified});
    const beforeState=await probe('raw()'),beforeRng=await probe('rng()');
    const stale=await probe('verifyStale()');
    check('actual native live-stack guard rejects stale handle without second callback',stale.stale_rejected&&
      stale.preexit_count===1&&stale.outcome_count===1&&JSON.stringify(beforeState)===JSON.stringify(await probe('raw()'))&&beforeRng===await probe('rng()'),{stale});
    return verified;
  }
  try{
    await mkdir(output,{recursive:true});
    check('actual original birth and installed roundtrip are ready',evidence.runtime?.passed===true&&evidence.runtime?.install?.installed===true);
    const initial=await probe('raw()');result.initial_player=initial.game.player;result.initial_turn=initial.game.turn;
    check('original initial dialog stack is empty',(await probe('uiRaw()')).stack.length===0);

    const yes=await open();
    const pure=await probe('purity()');
    check('eight native UI snapshots preserve identity/callbacks and real gameplay/RNG',pure.repeated_native_ui_query_pure&&
      pure.original_state_preserved&&pure.combined_rng_preserved,{ui_sha256:sha(pure.ui_before),status_sha256:sha(pure.status_before),rng_hex_characters:pure.rng_hex_characters});
    check('Rust view and JA/EN locale repaint perform zero native calls',pure.pure_rust_locale_zero_native_calls,{native_calls:pure.native_calls_during_rust_render});
    const pureCounts=await calls();
    const english=await probe('locale("en")'),englishCounts=await calls();
    const englishDialog=english.ui.dialogs.at(-1);
    check('English repaint resolves the same real handles and external parameter',englishDialog.handle===yes.status.dialog&&
      englishDialog.title==='Original dialog check'&&englishDialog.components[1].text===english.labels['ui.dialog.yes']&&
      englishDialog.components[0].text.includes(result.initial_player.name)&&JSON.stringify(pureCounts)===JSON.stringify(englishCounts),
      {title:englishDialog.title,body:englishDialog.components[0].text});
    await probe('locale("ja")');
    result.desktop_screenshot=await capture('ui-original-desktop.png');
    const yesPoint=await point(yes.status.yes),yesBefore=await calls(),yesKinds=await pending();
    check('real desktop Yes control is visible and usable',!yesPoint.disabled&&yesPoint.width>=48&&yesPoint.height>=48&&
      yesPoint.x>0&&yesPoint.x<yesPoint.viewport.w&&yesPoint.y>0&&yesPoint.y<yesPoint.viewport.h,{control:yesPoint});
    await call('Input.dispatchMouseEvent',{type:'mousePressed',x:yesPoint.x,y:yesPoint.y,button:'left',clickCount:1});
    await call('Input.dispatchMouseEvent',{type:'mouseReleased',x:yesPoint.x,y:yesPoint.y,button:'left',clickCount:1});
    const yesClosed=await closed('true',yesBefore,yesKinds,'PC mouse -> Rust OriginalUi -> real Yes Button ACCEPT');

    const staleBefore=await calls(),staleKinds=await pending();
    const staleRust=await probe('command('+JSON.stringify({dialog:yes.status.dialog,target:yes.status.yes,key:'ACCEPT'})+')');
    const staleAfter=await calls(),staleKindsAfter=await pending();
    check('Rust rejects the same stale typed action before a native callback',staleRust.presentation.error_id==='error.ui.stale'&&
      count(staleBefore,'tome_native_ui_command')===count(staleAfter,'tome_native_ui_command')&&
      count(staleKinds,'4')===count(staleKindsAfter,'4')&&staleRust.status.preexit_count===yesClosed.preexit_count&&staleRust.status.outcome_count===yesClosed.outcome_count,
      {error_id:staleRust.presentation.error_id});

    await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    await call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
    const no=await open(),noPoint=await point(no.status.no),noBefore=await calls(),noKinds=await pending();
    check('mobile original No projection fits CJK viewport and usable touch bounds',!noPoint.disabled&&noPoint.width>=48&&noPoint.height>=48&&
      noPoint.x>0&&noPoint.x<noPoint.viewport.w&&noPoint.y>0&&noPoint.y<noPoint.viewport.h&&noPoint.scroll_width<=noPoint.viewport.w+2,{control:noPoint});
    result.mobile_screenshot=await capture('ui-original-mobile.png');
    await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:noPoint.x,y:noPoint.y,radiusX:4,radiusY:4,force:1,id:1}]});
    await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await closed('false',noBefore,noKinds,'mobile touch -> Rust OriginalUi -> real No Button ACCEPT');

    await call('Emulation.setTouchEmulationEnabled',{enabled:false});
    await call('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
    await open();await evaluate('document.querySelector("#original").focus()');
    const exitBefore=await calls(),exitKinds=await pending();
    await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27,nativeVirtualKeyCode:27});
    await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27,nativeVirtualKeyCode:27});
    await closed('nil',exitBefore,exitKinds,'PC Escape -> Rust OriginalUi -> real dialog EXIT nil');

    await open();await evaluate('document.querySelector("#original").focus()');
    const enterBefore=await calls(),enterKinds=await pending();
    await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13});
    await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13});
    await closed('true',enterBefore,enterKinds,'PC Enter -> Rust original focused Yes component ACCEPT');
    const final=await probe('raw()');
    check('popup callbacks advance no gameplay turn and preserve actual external player',final.game.turn===result.initial_turn&&
      final.game.player.uid===result.initial_player.uid&&final.game.player.name===result.initial_player.name,
      {turn:final.game.turn,player:final.game.player});
    check('all factory generations own distinct real opaque dialog handles',new Set(result.opens.map(open=>open.dialog)).size===result.opens.length,
      {generations:result.opens.map(({generation,dialog})=>({generation,dialog}))});
    if(!result.opens.some(open=>open.gate.deadline!==null&&open.gate.original_clock_start_ms<open.gate.deadline)){
      result.limitations.push('No active original disable_until deadline occurred in these genuine factory opens; deadline scheduling was wired, but an actually blocked gate was not exercised.');
    }
    result.final_player=final.game.player;result.native_calls=await calls();result.pending_calls=await pending();result.passed=true;
  }catch(error){result.error=error.stack||String(error);}
  finally{
    try{
      await call('Emulation.setTouchEmulationEnabled',{enabled:false});
      await call('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
    }catch(error){result.restore_error=error.message;result.passed=false;}
  }
  await writeFile(path.join(output,'ui-roundtrip-evidence.json'),JSON.stringify(result,null,2));
  return result;
}
