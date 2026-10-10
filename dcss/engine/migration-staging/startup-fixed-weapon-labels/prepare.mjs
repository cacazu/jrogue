// Separate future slice. Never changes the installed game or current candidate.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=dirname(fileURLToPath(import.meta.url)),prior=dirname(root);
const installed='C:\\Users\\kit\\gameme\\jnethack\\jrouge\\dcss';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const sourcePins={
  'upstream/crawl-ref/source/newgame.cc':'b3186394e72e533d40fbf2e69d5b4b8a3b123f847a3a488ac49fb4252b92f10c',
  'upstream/crawl-ref/source/ng-input.cc':'23758132dc149752d890f8f21bed173286a48d7661bd026acf45a7f902abe978',
  'upstream/crawl-ref/source/outer-menu.cc':'88c0cedb12f4453b3a66c3cf199e33f304ac9d9ba573039e9a1f2d19c93b9a72',
  'locales/startup/en.json':'1fe29184d921ff7b809f168394efddd9601681c357481fddb87bda8cc77bb866',
  'locales/startup/ja.json':'849f34f6db7f27595bbec292b1ad522baf8757db8c392b82da6c9b0102a629ab',
  'locales/startup/source-map.json':'cac159c02ec30ebcadebf8188228d25f15e03af51d1a7533ad25c9c64dec042c',
};
function checked(relative,pin){const bytes=readFileSync(join(installed,relative));if(hash(bytes)!==pin)throw new Error('Source pin changed: '+relative);return bytes.toString('utf8').replace(/\r\n/g,'\n');}
const original=checked('upstream/crawl-ref/source/newgame.cc',sourcePins['upstream/crawl-ref/source/newgame.cc']);
const outer=checked('upstream/crawl-ref/source/outer-menu.cc',sourcePins['upstream/crawl-ref/source/outer-menu.cc']);
checked('upstream/crawl-ref/source/ng-input.cc',sourcePins['upstream/crawl-ref/source/ng-input.cc']);
const en=JSON.parse(checked('locales/startup/en.json',sourcePins['locales/startup/en.json']));
const ja=JSON.parse(checked('locales/startup/ja.json',sourcePins['locales/startup/ja.json']));
const map=JSON.parse(checked('locales/startup/source-map.json',sourcePins['locales/startup/source-map.json']));
const ids=['startup.weapon.prompt',...['recommended','aptitudes','help','random','back'].flatMap(name=>
  ['label','description'].map(role=>'startup.weapon.'+name+'.'+role))];
const bindings=ids.map(id=>{
  const message=map.messages.find(entry=>entry.id===id),site=map.output_sites.find(entry=>entry.message_ids.includes(id));
  if(!message||!site||Object.keys(message.params).length||typeof en[id]!=='string'||typeof ja[id]!=='string'
      ||message.expected_en!==en[id]||message.source_sites.length!==1)throw new Error('Unreviewed fixed binding: '+id);
  const lines=original.split('\n').slice(site.line-1,site.end_line).join('\n');
  if(lines!==site.original_expression||hash(Buffer.from(lines))!==site.expression_sha256)throw new Error('Exact source span mismatch: '+id);
  return {id,en:en[id],ja:ja[id],params:{},source_site:message.source_sites[0],
    native_source:site.source,line:site.line,end_line:site.end_line,function:site.function,
    original_expression:site.original_expression,expression_sha256:site.expression_sha256,
    condition:site.source_condition,control:site.control,required_command_tokens:message.required_command_tokens,
    role:id.endsWith('.description')?'description_assignment':id.endsWith('.label')?'visible_control_label':'visible_prompt',
    console_weapon_visibility:id.endsWith('.description')?'not_displayed_no_descriptions_switcher':'visible',};
});
for(const dir of ['engine','web'])mkdirSync(join(root,dir),{recursive:true});
const receipts={schema_version:1,scope:'future fixed weapon texts; current candidate untouched',source_pins:sourcePins,
  source:'startup-fixed-weapon-v1',ids,bindings,transformations:{}};
let edits=[];
function once(text,before,after){if(text.split(before).length!==2)throw new Error('Expected unique future-slice anchor: '+before);edits.push({before,after});return text.replace(before,after);}
function base(relative,pin){edits=[];const bytes=readFileSync(join(prior,relative));if(hash(bytes)!==pin)throw new Error('Current candidate changed: '+relative);return bytes.toString('utf8');}
function emit(relative,baseSha,text){writeFileSync(join(root,relative),text);receipts.transformations[relative]={base_sha256:baseSha,
  staged_sha256:hash(Buffer.from(text)),patches:edits};}

const cppPin='ef20867b4f3af194368217864b076a17828492665480753dda9a2d722e46ef11';
let cpp=base('engine/newgame.cc',cppPin);
cpp=once(cpp,'// BEGIN jrogue startup-weapon-prompt adapter v1\n// Source: DCSS 0.34.1 newgame.cc:1837; params={}, CYAN and controls unchanged.',
  '// BEGIN jrogue startup-fixed-weapon adapter v1\n// Source: DCSS 0.34.1 newgame.cc:1783-1793,1837; 11 fixed IDs, params={}.\n// Native BROWN/CYAN colours, hotkeys, controls and description visibility stay unchanged.');
cpp=once(cpp,'// END jrogue startup-weapon-prompt adapter v1','// END jrogue startup-fixed-weapon adapter v1');
cpp=once(cpp,'static string _dcss_startup_weapon_prompt()',
  'static string _dcss_startup_fixed_text(const char* id, const char* canonical_english)');
cpp=once(cpp,'dcss_host_startup_text("startup.weapon.prompt", "{}",','dcss_host_startup_text(id, "{}",');
cpp=once(cpp,'    return "You have a choice of weapons.";','    return canonical_english;');
cpp=once(cpp,'formatted_string(_dcss_startup_weapon_prompt(), CYAN)',
  'formatted_string(_dcss_startup_fixed_text("startup.weapon.prompt", "You have a choice of weapons."), CYAN)');
// Bind only the ten exact original sites inside this function, not all callers
// of _add_menu_sub_item and never an English runtime string lookup.
const begin=cpp.indexOf('static void _construct_weapon_menu('),end=cpp.indexOf('\n/**\n * Returns false if user escapes',begin);
if(begin<0||end<0)throw new Error('Missing fixed weapon function boundary');
let region=cpp.slice(begin,end);
const priorEdits=edits;
for(const binding of bindings.slice(1)){
  const literal=JSON.stringify(binding.en);
  region=once(region,literal,`_dcss_startup_fixed_text(${JSON.stringify(binding.id)}, ${literal})`);
}
cpp=cpp.slice(0,begin)+region+cpp.slice(end);edits=priorEdits;
emit('engine/newgame.cc',cppPin,cpp);

const modulePin='2bbbae4b169d62777409e897d22abee8d4493ca697e85a99c663efe39587d8f8';
let module=base('web/startup-text.mjs',modulePin);
const dictionaries=bindings.map(binding=>`    ${JSON.stringify(binding.id)}:Object.freeze(${JSON.stringify({en:binding.en,ja:binding.ja,source_site:binding.source_site})})`).join(',\n');
module=once(module,"  id: 'startup.weapon.prompt',",`  id: 'startup.weapon.prompt',
  scope: 'startup-fixed-weapon-v1',
  ids: Object.freeze(${JSON.stringify(ids)}),
  messages: Object.freeze({
${dictionaries}
  }),`);
module=once(module,'id !== STARTUP_TEXT_PIN.id || !exactKeys(params, [])','!Object.hasOwn(STARTUP_TEXT_PIN.messages, id) || !exactKeys(params, [])');
module=once(module,'text !== STARTUP_TEXT_PIN[locale]','text !== STARTUP_TEXT_PIN.messages[id][locale]');
module=once(module,"  render(STARTUP_TEXT_PIN.id, {}, 'en');\n  render(STARTUP_TEXT_PIN.id, {}, 'ja');",`  for (const id of STARTUP_TEXT_PIN.ids) {
    render(id, {}, 'en');
    render(id, {}, 'ja');
  }`);
const start=module.indexOf('  const receipt = source?.messages?.find('),finish=module.indexOf('  const bytes = await verifiedBytes(',start);
if(start<0||finish<0)throw new Error('Missing source validation block');
const oldBlock=module.slice(start,finish);
module=once(module,oldBlock,`  if (source.schema_version !== 1 || source.release !== STARTUP_TEXT_PIN.release
      || source.commit !== STARTUP_TEXT_PIN.upstream
      || !source.source_files?.some(file => file.path === 'crawl-ref/source/newgame.cc'
        && file.sha256 === STARTUP_TEXT_PIN.nativeSource)) throw new Error('startup source identity mismatch');
  for (const id of STARTUP_TEXT_PIN.ids) {
    const expected = STARTUP_TEXT_PIN.messages[id];
    const receipt = source?.messages?.find(message => message.id === id);
    if (en?.[id] !== expected.en || ja?.[id] !== expected.ja || receipt?.expected_en !== expected.en
        || !exactKeys(receipt.params, []) || receipt.source_sites?.length !== 1
        || receipt.source_sites[0] !== expected.source_site) throw new Error('startup fixed text source mismatch');
  }
`);
emit('web/startup-text.mjs',modulePin,module);

const libraryPin='a71cd6ff8ddcaaf479fd7c37c2eea7731c4ab9fd86944576eb634f8fd2c5137c';
let library=base('engine/library.js',libraryPin);
const importStart=library.indexOf('  // Synchronous presentation import.'),importEnd=library.indexOf('  dcss_host_frame:',importStart);
if(importStart<0||importEnd<0)throw new Error('Missing synchronous library import');
const known=JSON.stringify(Object.fromEntries(bindings.map(binding=>[binding.id,[binding.en,binding.ja]])));
library=once(library,library.slice(importStart,importEnd),`  // Future fixed weapon texts. No dynamic entities or arbitrary parameters.
  dcss_host_startup_text__deps: ['$UTF8ToString', '$lengthBytesUTF8', '$stringToUTF8'],
  dcss_host_startup_text: function(idPtr, paramsPtr, destination, capacity) {
    try {
      if (!Number.isInteger(capacity) || capacity !== 512 || !destination || destination < 0
          || destination + capacity > HEAPU8.length || !idPtr || idPtr < 0 || idPtr + 81 > HEAPU8.length
          || !paramsPtr || paramsPtr < 0 || paramsPtr + 3 > HEAPU8.length) throw new Error('invalid fixed startup pointers');
      const known = ${known};
      const id = UTF8ToString(idPtr, 81);
      const params = UTF8ToString(paramsPtr, 3);
      if (!Object.prototype.hasOwnProperty.call(known,id) || HEAPU8[idPtr+id.length] !== 0
          || params !== '{}' || HEAPU8[paramsPtr+2] !== 0) throw new Error('unreviewed fixed startup descriptor');
      if (typeof Module.dcssFormatStartup !== 'function') throw new Error('startup formatter unavailable');
      const text = Module.dcssFormatStartup(id, {});
      if (typeof text !== 'string' || text.indexOf('\\0') !== -1
          || (text !== known[id][0] && text !== known[id][1])) throw new Error('unreviewed fixed startup text');
      const length = lengthBytesUTF8(text);
      if (length >= capacity || destination+capacity > HEAPU8.length) throw new Error('fixed startup text exceeds destination');
      stringToUTF8(text,destination,capacity);
      return length;
    } catch (error) {
      try { if (typeof Module.dcssStartupTextError === 'function') Module.dcssStartupTextError(String(error)); }
      catch (_) { /* Preserve native end(1), with no fabricated input. */ }
      return -1;
    }
  },
`);
emit('engine/library.js',libraryPin,library);
receipts.description_visibility_evidence={weapon_popup:{source:'newgame.cc:1840-1848',
  descriptions_switcher_assigned:false},consumer:{source:'outer-menu.cc:306-312',
  conditional:'if (descriptions)',foreground:'WHITE',wrap:true},
  label:{source:'newgame.cc:533-546',foreground:'BROWN',hotkey_separate_from_text:true}};
receipts.current_candidate_pins_unchanged={cpp:cppPin,module:modulePin,library:libraryPin};
receipts.review_files=Object.fromEntries(['prepare.mjs','tests.test.mjs','README.md','dynamic-scope.md'].map(file=>
  [file,{install:false,sha256:hash(readFileSync(join(root,file)))}]));
writeFileSync(join(root,'source-receipts.json'),JSON.stringify(receipts,null,2)+'\n');
console.log(JSON.stringify({ok:true,ids:ids.length,new_fixed_bindings:10,visible_new_labels:5,
  description_assignments:5,current_candidate_changed:false}));
