/* SPDX-License-Identifier: GPL-3.0-or-later
 * Parent-run CDP scenario for the combined retained C/Lua + Rust application.
 * No process is launched here. Native state, RNG, original frame and full save
 * are observed through the existing application; no actor/rule state is set.
 */
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';

const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const sha=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const count=(calls,name)=>calls[name]||0;

export async function runScenario({call,evaluate,evidence,output}){
  const result={passed:false,checks:[],scope:'Combined original Japanese application: finite PC capture input, 390px touch, durable save action and Rust projection',
    renderer_purity_claim:false,complete_game_ui:false,complete_campaign_verified:false,
    native_SDL_queue_route_verified:false,
    limitations:['Accepted input uses the Rust capture/control owner and one explicit effectful original frame; native SDL queue draining is not tested.',
      'IME rejection uses a DOM keyboard event marked isComposing; an operating-system IME session is not claimed.',
      'CJK evidence covers visible controls, current original font flags and viewport geometry; complete game dialogs and campaign layout remain unverified.',
      'This scenario validates the genuine save action and visible hydrated-resume destination; fresh-document load/continuation is a separate scenario.']};
  const check=(name,passed,detail={})=>{result.checks.push({name,passed:Boolean(passed),...detail});if(!passed)throw Error(name+' failed: '+JSON.stringify(detail));};
  const probe=expression=>evaluate('window.tomePlayProbe.'+expression);
  const counts=()=>probe('calls()');
  let witnessInstalled=false,mobile=false;

  async function acceptedOnce(before){
    const expected=count(before,'tome_native_command')+1,deadline=Date.now()+15000;
    while(Date.now()<deadline){
      let current=await counts();
      if(count(current,'tome_native_command')>expected)throw Error('Input dispatched more than one original command');
      if(count(current,'tome_native_command')===expected){
        const presentation=await probe('settled()');current=await counts();
        if(presentation.pending_kind===0&&!presentation.error_id&&presentation.phase==='ready'&&await probe('nativeBusy()')===false){
          check('accepted input settles exactly one command and original frame',count(current,'tome_native_command')===expected&&
            count(current,'tome_native_draw_baseline')===count(before,'tome_native_draw_baseline')+1,
            {commands:count(current,'tome_native_command')-count(before,'tome_native_command'),
              original_frames:count(current,'tome_native_draw_baseline')-count(before,'tome_native_draw_baseline')});
          return {calls:current,snapshot:await probe('raw()')};
        }
      }
      await pause(25);
    }
    throw Error('Actual original input/frame boundary did not settle');
  }
  async function key(params){
    await call('Input.dispatchKeyEvent',{type:'keyDown',...params});
    await call('Input.dispatchKeyEvent',{type:'keyUp',...params,autoRepeat:false});
  }
  async function target(selector){
    return evaluate(`(()=>{const node=document.querySelector(${JSON.stringify(selector)});if(!node)throw Error('Missing actual control');
      node.scrollIntoView({block:'center'});const box=node.getBoundingClientRect(),x=box.x+box.width/2,y=box.y+box.height/2;
      const hit=document.elementFromPoint(x,y);return {x,y,width:box.width,height:box.height,disabled:node.disabled===true,
        visible:box.width>0&&box.height>0&&!node.hidden,hit:hit===node||node.contains(hit),
        within_viewport:x>=0&&x<innerWidth&&y>=0&&y<innerHeight,scrollWidth:document.documentElement.scrollWidth,viewport:innerWidth};})()`);
  }
  async function tap(box){
    await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x,y:box.y}]});
    await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }
  async function screenshot(name,options={}){
    const captured=await call('Page.captureScreenshot',{format:'png',...options}),file=path.join(output,name);
    await writeFile(file,Buffer.from(captured.data,'base64'));return file;
  }
  function assertPure(value,label){
    check(label,value.passed===true&&value.pure_Rust_projection_zero_native_calls===true&&
      value.original_snapshot_preserved===true&&value.original_rng_preserved===true&&value.original_baseline_render_tested===false,
      {purity:value});
  }

  try{
    await mkdir(output,{recursive:true});
    const report=await evaluate('window.tomePlayReport'),initial=await probe('raw()');
    check('combined actual original birth and Japanese application are ready',report?.completed&&report.passed===true&&
      report.original_locale==='ja_JP'&&report.projection_locale==='ja'&&initial.ready===true&&
      Boolean(initial.game?.player)&&Boolean(initial.game?.level),{phase:report?.phase,error:report?.error,locale:report?.original_locale});
    check('initial actual original player is alive and input boundary is idle',initial.game.player.dead!==true&&
      await probe('nativeBusy()')===false&&(await probe('presentation()')).pending_kind===0);
    const labels=await probe('presentation()');
    check('Japanese wait label comes from current compiled Rust semantic output',
      /\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}/u.test(labels.labels['ui.core.wait'])&&
      !labels.labels['ui.core.wait'].includes('\uFFFD'),{wait_label:labels.labels['ui.core.wait']});
    const nativeText=await probe('localization()');
    check('actual original I18N and genuine Japanese font package are active',nativeText.diagnostics?.locale==='ja_JP'&&
      nativeText.diagnostics.font.japanese_package_loaded===true&&nativeText.diagnostics.font.actual_font_exists===true&&
      nativeText.diagnostics.font.matches_japanese_package===true&&nativeText.diagnostics.font.break_text_all_character===true,
      {locale:nativeText.diagnostics?.locale,font:nativeText.diagnostics?.font});
    assertPure(await probe('purity()'),'initial pure Rust projection changes no native state, RNG or C calls');
    result.initial={turn:initial.game.turn,player:initial.game.player};

    // DOM-only witnesses run after the installed Rust window capture handler.
    // Ignored input can be observed there before any native canvas listener;
    // an owned accepted key must reach neither witness nor canvas target.
    await evaluate(`(()=>{const canvas=document.querySelector('#original');window.__tomePlayInputWitness={seen:[],target_seen:[]};
      const listener=event=>{const seen=window.__tomePlayInputWitness.seen;if(seen.length<16)seen.push({code:event.code,
        repeat:event.repeat,composing:event.isComposing,trusted:event.isTrusted,ctrl:event.ctrlKey,alt:event.altKey,
        meta:event.metaKey,shift:event.shiftKey});};const targetListener=event=>{const seen=window.__tomePlayInputWitness.target_seen;
        if(seen.length<16)seen.push(event.code);};window.__tomePlayInputWitness.listener=listener;
      window.__tomePlayInputWitness.targetListener=targetListener;window.addEventListener('keydown',listener,{capture:true});
      canvas.addEventListener('keydown',targetListener);canvas.focus();return document.activeElement===canvas;})()`);
    witnessInstalled=true;
    const keyboardBefore=await counts(),beforeKeyboard=await probe('raw()');
    await key({key:'5',code:'Numpad5',windowsVirtualKeyCode:101,nativeVirtualKeyCode:101,location:3});
    const keyboardAfter=await acceptedOnce(keyboardBefore);
    check('real PC Numpad5 advances original turn through the Rust capture owner',keyboardAfter.snapshot.game.turn>beforeKeyboard.game.turn,
      {before_turn:beforeKeyboard.game.turn,after_turn:keyboardAfter.snapshot.game.turn});
    const captured=await evaluate('({later_capture:window.__tomePlayInputWitness.seen,target:window.__tomePlayInputWitness.target_seen})');
    check('accepted PC key is stopped before later capture and canvas target handlers',captured.later_capture.length===0&&captured.target.length===0,
      {later_capture_keydown_events:captured.later_capture,target_keydown_events:captured.target});

    const ignoredState=await probe('raw()'),ignoredRng=await probe('rng()'),ignoredCalls=await counts();
    await key({key:'5',code:'Numpad5',windowsVirtualKeyCode:101,nativeVirtualKeyCode:101,location:3,autoRepeat:true});
    for(const modifiers of [1,2,4,8]){
      await key({key:'5',code:'Numpad5',windowsVirtualKeyCode:101,nativeVirtualKeyCode:101,location:3,modifiers});
    }
    await evaluate(`document.querySelector('#original').dispatchEvent(new KeyboardEvent('keydown',{
      key:'5',code:'Numpad5',isComposing:true,bubbles:true,cancelable:true}))`);
    await probe('settled()');
    const ignoredAfterCalls=await counts(),ignoredAfter=await probe('raw()'),ignoredAfterRng=await probe('rng()');
    const ignoredWitness=await evaluate('window.__tomePlayInputWitness.seen');
    check('repeat and all four modifier events plus IME-tagged DOM event reach the rejection context',
      ignoredWitness.some(event=>event.repeat&&event.trusted)&&['ctrl','alt','meta','shift'].every(field=>ignoredWitness.some(event=>event[field]&&event.trusted))&&
      ignoredWitness.some(event=>event.composing&&!event.trusted),{events:ignoredWitness});
    check('rejected input performs no native calls, command, effectful frame or state/RNG mutation',
      JSON.stringify(ignoredCalls)===JSON.stringify(ignoredAfterCalls)&&JSON.stringify(ignoredState)===JSON.stringify(ignoredAfter)&&ignoredRng===ignoredAfterRng,
      {before_calls:ignoredCalls,after_calls:ignoredAfterCalls,state_sha256:sha(ignoredAfter),rng_sha256:sha(ignoredAfterRng)});
    result.desktop=await screenshot('play-desktop.png');

    await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});mobile=true;
    await call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
    const waitBox=await target('[data-tome-command="MOVE_STAY"]');
    check('390px Japanese wait control fits with a usable real touch target',waitBox.visible&&!waitBox.disabled&&waitBox.hit&&waitBox.within_viewport&&
      waitBox.width>=48&&waitBox.height>=48&&waitBox.viewport===390&&waitBox.scrollWidth<=waitBox.viewport+2,{layout:waitBox});
    const mobileBefore=await counts(),beforeMobile=await probe('raw()');await tap(waitBox);
    const mobileAfter=await acceptedOnce(mobileBefore);
    check('real mobile touch advances one genuine original wait',mobileAfter.snapshot.game.turn>beforeMobile.game.turn,
      {before_turn:beforeMobile.game.turn,after_turn:mobileAfter.snapshot.game.turn});

    const priorGeneration=await probe('generation()'),saveBox=await target('#save');
    check('actual full-save control is available in normal mobile actions',saveBox.visible&&!saveBox.disabled&&saveBox.hit&&saveBox.within_viewport&&
      saveBox.width>=48&&saveBox.height>=48,{layout:saveBox});
    await tap(saveBox);
    const saveDeadline=Date.now()+90000;let savedReport;
    while(Date.now()<saveDeadline){
      savedReport=await evaluate('window.tomePlayReport');
      if(savedReport.save_error)throw Error('Actual save action failed: '+JSON.stringify(savedReport.save_error));
      if(savedReport.save_operation?.phase==='complete'&&savedReport.last_saved_head?.generation!==priorGeneration&&
        savedReport.durable===true&&await probe('nativeBusy()')===false&&(await probe('presentation()')).pending_kind===0)break;
      await pause(50);
    }
    check('actual mobile save reaches its completed durable boundary before timeout',savedReport?.save_operation?.phase==='complete'&&
      savedReport.durable===true&&savedReport.last_saved_head?.generation!==priorGeneration,
      {phase:savedReport?.save_operation?.phase,head:savedReport?.last_saved_head,error:savedReport?.save_error});
    const generation=await probe('generation()'),saved=await probe('inspect()');
    check('real mobile save action commits original full Game/World checkpoint and releases its gate',savedReport.save_operation?.phase==='complete'&&
      savedReport.durable===true&&generation!==priorGeneration&&saved.head?.generation===generation&&await probe('nativeBusy()')===false&&
      saved.manifest?.mode==='baseline_original_checkpoint'&&saved.manifest.loader.preferred_locale==='ja_JP'&&
      saved.sidecar?.layout_id===1&&saved.sidecar.bytes===2588&&saved.sidecar.hex===saved.rng,
      {operation:savedReport.save_operation,head:saved.head,saved_locale:saved.manifest?.loader?.preferred_locale,rng_bytes:saved.sidecar?.bytes});
    const resumeLink=await evaluate(`(()=>{const node=document.querySelector('.actions #resume-comparison');node.scrollIntoView({block:'center'});
      const box=node.getBoundingClientRect();return {href:node.href,pathname:new URL(node.href).pathname,hidden:node.hidden,
        visible:box.width>0&&box.height>0&&getComputedStyle(node).visibility!=='hidden',aria_disabled:node.getAttribute('aria-disabled'),
        text:node.textContent,origin:new URL(node.href).origin,document_origin:location.origin};})()`);
    check('actual committed save exposes the normal Japanese hydrated-resume link',resumeLink.visible&&!resumeLink.hidden&&
      resumeLink.aria_disabled==='false'&&resumeLink.pathname==='/semantic-resume.html'&&resumeLink.origin===resumeLink.document_origin,
      {link:resumeLink,probe_origin:evidence?.url?new URL(evidence.url).origin:null});
    const cjkLayout=await evaluate(String.raw`(()=>{const nodes=[...document.querySelectorAll('.controls [data-text-id],.actions [data-save-text-id]')];
      return {viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,
        language:document.documentElement.lang,labels:nodes.map(node=>({id:node.dataset.textId||node.dataset.saveTextId,text:node.textContent,
          invalid:node.textContent.includes('\uFFFD'),width:node.getBoundingClientRect().width})),
        japanese_wait:/\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}/u.test(document.querySelector('[data-tome-command="MOVE_STAY"]').textContent)};})()`);
    check('visible CJK controls retain Japanese text without horizontal overflow',cjkLayout.language==='ja'&&cjkLayout.viewport===390&&
      cjkLayout.scrollWidth<=cjkLayout.clientWidth+2&&cjkLayout.japanese_wait&&cjkLayout.labels.every(label=>label.text.length>0&&!label.invalid),
      {layout:cjkLayout});
    assertPure(await probe('purity()'),'post-input/save pure Rust projection still changes no native state, RNG or C calls');
    const final=await probe('raw()'),finalText=await probe('localization()');
    check('external original player name stays raw through input and durable save',final.game.player.name===initial.game.player.name&&
      finalText.diagnostics.player.name===initial.game.player.name&&finalText.diagnostics.player.get_name===initial.game.player.name,
      {name:final.game.player.name});
    result.final={turn:final.game.turn,player:final.game.player};result.saved_head=saved.head;result.resume_link=resumeLink;
    result.mobile=await screenshot('play-mobile.png',{captureBeyondViewport:true});
    result.passed=result.checks.every(entry=>entry.passed);
  }catch(error){result.error=error.stack||String(error);}
  finally{
    if(witnessInstalled)try{await evaluate(`(()=>{const witness=window.__tomePlayInputWitness;if(witness){
      window.removeEventListener('keydown',witness.listener,{capture:true});
      document.querySelector('#original')?.removeEventListener('keydown',witness.targetListener);}delete window.__tomePlayInputWitness;})()`);}catch{}
    if(mobile){
      try{await call('Emulation.setTouchEmulationEnabled',{enabled:false});}catch{}
      try{await call('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});}catch{}
    }
  }
  await writeFile(path.join(output,'play-mobile-evidence.json'),JSON.stringify(result,null,2));return result;
}
