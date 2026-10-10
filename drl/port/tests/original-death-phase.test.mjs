import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createDeathClassifier,visibleText,SOURCE_PAGED_FOOTER,terminalConfirmationAllowed} from './original-death-phase.mjs';
const ja=JSON.parse(await readFile(new URL('../../localization/ja.json',import.meta.url),'utf8'));
const name='BrowserMarine_5489',classify=createDeathClassifier(ja,{name});
const probe={state:8,playerPresent:true,hp:0};
const footer=visibleText(SOURCE_PAGED_FOOTER,ja);
const report=`Post mortem (mortem.txt)\n\nDRL 0.10.11a（エンジン 0.10.11）ローグライクの戦闘記録\n${name}、\n\n${footer}`;
test('death requires zero HP, Japanese message and the exact Enter hint',()=>{
  const text=`${visibleText(ja['message.player-dies'],ja)}\n\n${visibleText(ja['view.hud.press-confirm'],ja)}`;
  assert.equal(classify({text,probe:{...probe,state:4}}).kind,'death_more');
  assert.equal(classify({text,probe:{...probe,state:4,hp:1}}).kind,'unknown');
  assert.equal(classify({text:text.replace('死んでしまった……','You die!...'),probe:{...probe,state:4}}).kind,'unknown');
  assert.equal(classify({text:text.replace('Enter','Space'),probe:{...probe,state:4}}).kind,'unknown');
});
test('actual failed Chrome frame182 has death on row1 and the prompt on row2; map/history matches cannot authorize Enter',()=>{
  // Source receipt: original-death/frame-182.json SHA256
  // a51aca439b1c21e039152335e96d654adb9b30f1529cb61b3ad443adc43a9eb7.
  // Retain the exact three captured browser rows independently of outputs,
  // which the next actual browser run will overwrite.
  const rows=[
    '  攻撃を受けた！                                                                ',
    '  攻撃を受けた！ 死んでしまった……                                             ',
    '   <Enter>を押してください…                          ヒント：<F>で武器を撃つ！ ',
  ];
  const p={state:4,playerPresent:true,hp:0};
  const w=classify({text:rows.join('\n'),probe:p});
  assert.equal(w.kind,'death_more');assert.deepEqual(w.message_rows,[0,1]);assert.equal(w.prompt_row,2);
  assert.equal(classify({text:rows.join('\n'),probe:{...p,hp:1}}).kind,'unknown');
  assert.equal(classify({text:rows.join('\n'),probe:{...p,state:8}}).kind,'unknown');
  assert.equal(classify({text:rows.join('\n'),probe:{...p,playerPresent:false}}).kind,'unknown');
  assert.equal(classify({text:[...rows.slice(0,2),'',rows[2]].join('\n'),probe:p}).kind,'unknown','Prompt on row3 is outside source-backed native prompt row');
  assert.equal(classify({text:[rows[0],'',rows[2],rows[1]].join('\n'),probe:p}).kind,'unknown','Old death message in map/history row3 is outside native recent messages');
  assert.equal(classify({text:[rows[0],rows[2],rows[1]].join('\n'),probe:p}).kind,'unknown','Swapped message/prompt rows cannot authorize a key');
  assert.equal(classify({text:rows.join('\n').replace('死んでしまった……','You die!...'),probe:p}).kind,'unknown');
  assert.equal(classify({text:rows.join('\n').replace('<Enter>を押してください…','Press <Enter>...'),probe:p}).kind,'unknown');
});
test('mortem requires full external name, Japanese version suffix, finished state and source footer',()=>{
  const w=classify({text:report,probe});assert.equal(w.kind,'mortem');assert.equal(w.findings.length,2);
  for(const text of [report.replace(name,name.slice(0,17)),report.replace('ローグライクの戦闘記録','roguelike post-mortem dump'),report.replace(footer,''),report.replace('Post mortem','unknown')])
    assert.equal(classify({text,probe}).kind,'unknown');
  assert.equal(classify({text:report,probe:{...probe,state:4}}).kind,'unknown');
});
test('hall accepts only original 17-byte cropped name and exact Japanese title',()=>{
  const text=`${ja['view.report.hall-of-fame-title']}\n\n5489 ${name.slice(0,17)} killed\n${footer}`;
  const w=classify({text,probe});assert.equal(w.kind,'hall_of_fame');assert.equal(w.native_name_display_cropped,true);
  assert.equal(w.displayed_name,'BrowserMarine_548');
  assert.equal(classify({text:text.replace(name.slice(0,17),'AnotherMarine'),probe}).kind,'unknown');
  assert.equal(classify({text:text.replace('殿堂','Hall of fame'),probe}).kind,'unknown');
});
test('rank screen requires both exact prompts, not title alone',()=>{
  const text=[ja['view.rank-up.title'],visibleText(ja['view.rank-up.press-confirm'],ja),visibleText(ja['view.hint.confirm-escape-continue'],ja)].join('\n');
  assert.equal(classify({text,probe}).kind,'rank_up');
  assert.equal(classify({text:ja['view.rank-up.title'],probe}).kind,'unknown');
});
test('menu and profile cannot be confused by their shared label',()=>{
  const menu=['menu.main.new','menu.main.highscores','menu.main.player'].map(id=>visibleText(ja[id],ja)).join('\n');
  const p={state:1,playerPresent:false,hp:0};
  assert.equal(classify({text:menu,probe:p}).kind,'main_menu');
  assert.equal(classify({text:`${ja['view.report.player-info-title']}\n\n${footer}`,probe:p}).kind,'profile');
  assert.equal(classify({text:ja['view.report.player-info-title'],probe:p}).kind,'unknown');
});
test('confirmation requires expected phase and a later actual frame',()=>{
  const w=classify({text:report,probe});
  assert.equal(terminalConfirmationAllowed(w,{expected:'mortem',frameGeneration:21,activationFrame:20}),true);
  assert.equal(terminalConfirmationAllowed(w,{expected:'mortem',frameGeneration:20,activationFrame:20}),false);
  assert.equal(terminalConfirmationAllowed(w,{expected:'hall_of_fame',frameGeneration:21,activationFrame:20}),false);
  assert.equal(terminalConfirmationAllowed({kind:'unknown',confirm:null},{expected:'mortem',frameGeneration:21}),false);
});
