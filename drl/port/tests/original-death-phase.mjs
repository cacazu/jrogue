// Read-only native terminal-phase witnesses. No inputs, Lua calls or memory writes.
// Sequence: dfplayer.pas:557-569; drlbase.pas:1574-1599; dfhof.pas:924-951.
import assert from 'node:assert/strict';
export const SOURCE_PAGED_FOOTER='{l<{!{$input_up},{$input_down}}> scroll, <{!{$input_left},{$input_right}}> pages, <{!{$input_ok},{$input_escape}}> exit}';
export const glyphs=text=>String(text).replace(/\s/gu,'');
export function visibleText(text,catalog){
  assert.equal(typeof text,'string');
  const keys={input_up:'up',input_down:'down',input_left:'left',input_right:'right',input_ok:'enter',input_escape:'escape'};
  return text.replace(/\{\$([a-z_]+)\}/g,(_,key)=>{
    assert.ok(keys[key], 'Unexpected input binding '+key);
    const value=catalog['view.input-key.'+keys[key]];assert.equal(typeof value,'string');return value;
  }).replace(/\{[a-zA-Z!^]/g,'').replace(/[{}]/g,'').trim();
}
const includes=(text,label)=>glyphs(text).includes(glyphs(label));
const exact=(catalog,id)=>{assert.equal(typeof catalog[id],'string','Missing semantic ID '+id);return visibleText(catalog[id],catalog);};
export function createDeathClassifier(ja,{name='BrowserMarine_5489'}={}){
  assert.ok(name && !/[\r\n]/.test(name));
  assert.ok(/^[\x20-\x7e]+$/.test(name),'This fixture uses the original 17-byte ASCII score display');
  const scoreName=name.slice(0,17);
  const more=['view.hud.more','view.hud.press-confirm'].map(id=>({id,text:exact(ja,id)}));
  const footer=visibleText(SOURCE_PAGED_FOOTER,ja);
  return ({text,probe})=>{
    assert.equal(typeof text,'string');assert.ok(probe && Number.isInteger(probe.state));
    const rows=text.split(/\r?\n/),header=rows.slice(0,3).join('\n');
    // Original TMoreLayer.Update draws Point(3,2); the real production frame
    // confirms browser row 2. Native recent messages occupy rows 0 and 1.
    // Never accept a matching prompt or old death text elsewhere in the map.
    const deathMessages=rows.slice(0,2).join('\n'),deathPrompt=rows[2]??'';
    const footerSeen=includes(rows.slice(-3).join('\n'),footer);
    const moreSeen=more.find(value=>includes(deathPrompt,value.text));
    const findings=[];
    if(footerSeen)findings.push({kind:'untranslated-native-source-footer',source:'drlpagedview.pas:68',text:footer});
    const matches=[];
    if(probe.state===4 && probe.playerPresent && probe.hp<=0 && moreSeen && includes(deathMessages,exact(ja,'message.player-dies')))
      matches.push({kind:'death_more',confirm:'Enter',semantic_ids:['message.player-dies',moreSeen.id],message_rows:[0,1],prompt_row:2,prompt_source:'drlhudviews.pas:279 Point(3,2)'});
    if(probe.state===8 && includes(header,exact(ja,'view.rank-up.title')) &&
      includes(text,exact(ja,'view.rank-up.press-confirm')) && includes(text,exact(ja,'view.hint.confirm-escape-continue')))
      matches.push({kind:'rank_up',confirm:'Escape',semantic_ids:['view.rank-up.title','view.rank-up.press-confirm','view.hint.confirm-escape-continue']});
    // Current TPagedReport title is the original literal 'Post mortem'. Require
    // independent Japanese report body + external name + known native footer.
    // A title alone or generic word 'record' cannot authorize a key.
    const versionMarker=ja['mortem.report.version'].split('{{engine_version}}')[1];
    assert.ok(versionMarker && !versionMarker.includes('{{'));
    const bodyMarker=visibleText(versionMarker,ja);
    if(probe.state===8 && includes(header,'Post mortem') && includes(text,bodyMarker) && text.includes(name) && footerSeen){
      findings.push({kind:'untranslated-native-source-title',source:'drlbase.pas:1583',text:'Post mortem'});
      matches.push({kind:'mortem',confirm:'Escape',semantic_ids:['mortem.report.version','mortem.report.player-long-name'],external_name:name});
    }
    if(probe.state===8 && includes(header,exact(ja,'view.report.hall-of-fame-title')) && text.includes(scoreName) && footerSeen)
      matches.push({kind:'hall_of_fame',confirm:'Escape',semantic_ids:['view.report.hall-of-fame-title'],external_name:name,displayed_name:scoreName,native_name_display_cropped:scoreName!==name});
    const menuIds=['menu.main.new','menu.main.highscores','menu.main.player'];
    const menuSeen=menuIds.every(id=>includes(text,exact(ja,id).replace(/^[-=\s]+|[-=\s]+$/g,'')));
    if(probe.state===1 && !probe.playerPresent && menuSeen && !footerSeen)
      matches.push({kind:'main_menu',confirm:null,semantic_ids:menuIds});
    if(probe.state===1 && !probe.playerPresent && !menuSeen && includes(header,exact(ja,'view.report.player-info-title')) && footerSeen)
      matches.push({kind:'profile',confirm:'Escape',semantic_ids:['view.report.player-info-title']});
    if(probe.state===1 && !probe.playerPresent && !menuSeen && includes(header,exact(ja,'view.report.hall-of-fame-title')) && text.includes(scoreName) && footerSeen)
      matches.push({kind:'persisted_hall_of_fame',confirm:'Escape',semantic_ids:['view.report.hall-of-fame-title'],external_name:name,displayed_name:scoreName,native_name_display_cropped:scoreName!==name});
    assert.ok(matches.length<=1,'Ambiguous terminal phase; no input allowed');
    return matches.length?{...matches[0],findings}:{kind:'unknown',confirm:null,semantic_ids:[],findings};
  };
}
export function terminalConfirmationAllowed(witness,{expected,frameGeneration,activationFrame=-1}){
  assert.ok(['death_more','rank_up','mortem','hall_of_fame','profile','persisted_hall_of_fame'].includes(expected));
  assert.ok(Number.isSafeInteger(frameGeneration) && frameGeneration>=0);
  assert.ok(Number.isSafeInteger(activationFrame) && activationFrame>=-1);
  return witness.kind===expected && ['Enter','Escape'].includes(witness.confirm) && frameGeneration>activationFrame;
}
