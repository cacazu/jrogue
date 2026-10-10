/* SPDX-License-Identifier: GPL-3.0-or-later
 * Actual original C/Lua actions through the compiled Rust mailbox in Chrome.
 * This covers the diagnostic status/input seam, not complete game presentation.
 */
import {writeFile} from 'node:fs/promises';
import path from 'node:path';

export async function runScenario({call,evaluate,output}){
  const checks=[];
  const check=(name,passed,detail)=>{checks.push({name,passed:Boolean(passed),detail});if(!passed)throw Error(name+': '+JSON.stringify(detail));};
  const snapshot=()=>evaluate('window.tomeRetainedProbe.raw()');
  const counts=()=>evaluate('window.tomeRetainedProbe.calls()');
  const commandCount=value=>value.tome_native_command||0;
  const waitFor=async count=>{
    const end=Date.now()+10000;
    while(Date.now()<end){const value=await counts();if(commandCount(value)===count&&await evaluate('window.tomeRetainedProbe.presentation().pending_kind===0'))return value;
      if(commandCount(value)>count)throw Error('More than one original action was dispatched');await new Promise(resolve=>setTimeout(resolve,25));}
    throw Error('Original Rust command did not settle');
  };
  const purity=await evaluate('window.tomeRetainedProbe.pure()');
  check('Rust view/locale rendering makes zero native calls and preserves real state/RNG',purity.passed,purity);
  const initial=await snapshot(),before=await counts();
  const action=await evaluate("window.tomeRetainedProbe.command('MOVE_STAY')");
  check('Rust touch command delegates one actual original wait',commandCount(action.calls)===commandCount(before)+1&&action.native.game.turn>initial.game.turn,
    {beforeTurn:initial.game.turn,afterTurn:action.native.game.turn,counts:action.calls});
  const labels=await evaluate('window.tomeRetainedProbe.presentation().labels');
  check('Japanese default semantic labels are real compiled Rust output',/\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}/u.test(labels['ui.core.wait']),{wait:labels['ui.core.wait']});
  await evaluate("document.querySelector('#original').focus()");
  const keyboardBefore=await counts();
  await call('Input.dispatchKeyEvent',{type:'keyDown',key:'5',code:'Numpad5',windowsVirtualKeyCode:101,nativeVirtualKeyCode:101,location:3});
  await call('Input.dispatchKeyEvent',{type:'keyUp',key:'5',code:'Numpad5',windowsVirtualKeyCode:101,nativeVirtualKeyCode:101,location:3});
  const keyboardAfter=await waitFor(commandCount(keyboardBefore)+1);
  check('Real PC keypad input dispatches exactly one original action through Rust',commandCount(keyboardAfter)===commandCount(keyboardBefore)+1,keyboardAfter);
  const ignoredBefore=await counts();
  await call('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39,autoRepeat:true});
  await call('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
  await call('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39,modifiers:2});
  await call('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39,modifiers:2});
  await evaluate("document.querySelector('#original').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',code:'ArrowRight',isComposing:true,bubbles:true}))");
  const ignoredAfter=await counts();
  check('Repeat, modifier and IME composition produce no gameplay command',commandCount(ignoredAfter)===commandCount(ignoredBefore),ignoredAfter);
  const pc=await call('Page.captureScreenshot',{format:'png'});
  await writeFile(path.join(output,'rust-desktop.png'),Buffer.from(pc.data,'base64'));
  await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
  const layout=await evaluate("(()=>{const b=document.querySelector('[data-tome-command=\"MOVE_STAY\"]');b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,width:r.width,height:r.height,scrollWidth:document.documentElement.scrollWidth,viewport:innerWidth};})()");
  check('Mobile Japanese controls fit the viewport and have usable tap targets',layout.width>=48&&layout.height>=48&&layout.scrollWidth<=layout.viewport+2,layout);
  const touchBefore=await counts();
  await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:layout.x,y:layout.y}]});
  await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  const touchAfter=await waitFor(commandCount(touchBefore)+1);
  check('Real mobile tap dispatches one original wait through Rust',commandCount(touchAfter)===commandCount(touchBefore)+1,touchAfter);
  const mobile=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
  await writeFile(path.join(output,'rust-mobile.png'),Buffer.from(mobile.data,'base64'));
  const final=await snapshot();
  check('External original player name remains unchanged',final.game.player.name===initial.game.player.name,{name:final.game.player.name});
  const finalPure=await evaluate('window.tomeRetainedProbe.pure()');
  check('Pure Rust status repaint still preserves real state/RNG after input',finalPure.passed,finalPure);
  await call('Emulation.setTouchEmulationEnabled',{enabled:false});
  await call('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  return {passed:true,checks,initial:{turn:initial.game.turn,player:initial.game.player},final:{turn:final.game.turn,player:final.game.player},
    limitations:['Original effectful renderer prepares the comparison canvas once after accepted Rust input; pure Rust status repaint never invokes it.',
      'This Rust status/input path does not cover complete native dialogs, campaign presentation or full content localization.',
      'Native SDL event drain remains inactive; the Rust capture handler owns tested input.']};
}
