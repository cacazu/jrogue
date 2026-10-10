// Bounded source/recognizer checks; never starts Worker, WASM, game, or Chrome.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {isNativeInitialStartupMenu,nativeMenuEntityHotkey} from './tests/native-dynamic-startup-browser.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const game='C:/Users/kit/gameme/jnethack/jrouge/dcss';
const sourceRoot=path.join(game,'upstream/crawl-ref/source');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const records=[];
function readSource(file,start,end){
  const bytes=fs.readFileSync(path.join(sourceRoot,file)),lines=bytes.toString('utf8').split(/\r?\n/);
  const text=lines.slice(start-1,end).join('\n');
  records.push({path:'upstream/crawl-ref/source/'+file,sha256:hash(bytes),first_line:start,last_line:end,span_sha256:hash(Buffer.from(text))});return text;
}
const checks=[];
function check(label,body){body();checks.push(label);}
check('initial-menu recognizer requires genuine name, mode and seed choices',()=>{
  assert(isNativeInitialStartupMenu(['Enter your name:','Choices:','Dungeon Crawl','Choose Game Seed']));
  for(const missing of ['Enter your name:','Choices:','Dungeon Crawl','Choose Game Seed'])
    assert(!isNativeInitialStartupMenu(['Enter your name:','Choices:','Dungeon Crawl','Choose Game Seed'].filter(row=>row!==missing)));
  assert(!isNativeInitialStartupMenu(['Welcome.','Please select your species.','a - Human']));
});
check('localized species/job display keeps actual row letters',()=>{
  for(const [label,key] of [['Human','a'],['人間','a'],['Fighter','b'],['戦士','b']])
    assert.equal(nativeMenuEntityHotkey([key+' - '+label+'     c - another'],label).key,key);
  assert.throws(()=>nativeMenuEntityHotkey(['a - 人間','b - 人間'],'人間'));
});
check('official unnamed startup cannot bypass native initial menu',()=>{
  const source=readSource('startup.cc',1054,1082);
  assert(source.includes('Options.name_bypasses_menu'));
  assert(source.includes('is_good_name(choice.name, false)'));
  assert(source.includes('else if (!can_bypass_menu && choice.type != GAME_TYPE_ARENA)'));
  assert(source.includes('_show_startup_menu(choice, defaults);'));
});
check('initial-mode activation permits blank name and chooses real normal mode',()=>{
  const source=readSource('startup.cc',917,939);
  assert(source.includes('case GAME_TYPE_NORMAL:'));assert(source.includes('is_good_name(input_string, true)'));
  assert(source.includes('ng_choice.type = static_cast<game_type>(id);'));
  assert(source.includes('ng_choice.name = input_string;'));assert(source.includes('done = true;'));
  const validation=readSource('ng-input.cc',62,68);
  assert(validation.includes('return blankOK && name.empty();'));
});
check('fresh startup defaults focus the first normal game entry',()=>{
  const missingPrefs=readSource('initfile.cc',2402,2413);
  assert(missingPrefs.includes('if (fl.error())'));assert(missingPrefs.includes('return newgame_def();'));
  const defaults=readSource('startup.cc',803,825);
  assert(defaults.includes('default_id = defaults.type < NUM_GAME_TYPE ? defaults.type : 0;'));
  assert(defaults.includes('id = default_id;'));assert(defaults.includes('get_button_by_id(id)'));
  const entries=readSource('startup.cc',421,430);
  assert(entries.includes('{GAME_TYPE_NORMAL, "Dungeon Crawl",'));
});
check('weapon Escape goes back while uppercase X genuinely ends generation',()=>{
  const prompt=readSource('newgame.cc',1893,1910);
  assert(prompt.includes('ui::key_exits_popup(lastch, false)'));assert(prompt.includes('ret = false;'));
  assert(prompt.includes("case 'X':"));assert(prompt.includes("case CONTROL('Q'):"));assert(prompt.includes('end(0);'));
  const loop=readSource('newgame.cc',520,530);
  assert(loop.includes('_choose_weapon(ng, choice, defaults)'));assert(loop.includes('choice = ng_reset;'));
});
check('name Enter and typed ordinary quit preserve official completion routes',()=>{
  const name=readSource('newgame.cc',622,643);
  assert(name.includes('CK_ENTER'));assert(name.includes('ng.name ='));assert(name.includes('done = true;'));
  const quit=readSource('main.cc',2459,2469);
  assert(quit.includes('confirm_prompt("quit",'));assert(quit.includes('KILLED_BY_QUITTING'));
  const confirmation=readSource('prompt.cc',109,125);assert(confirmation.includes('Confirm with'));
  const end=readSource('end.cc',333,336);assert(end.indexOf('more()')<end.indexOf('display_inventory()'));
});
const fixture=fs.readFileSync(path.join(root,'tests/native-dynamic-startup-browser.mjs'));
check('dedicated fixture traverses actual initial menu, X cancel and ordinary gameplay',()=>{
  const text=fixture.toString('utf8');assert(text.includes("if(!named){"));
  assert(text.includes("'genuine initial normal-game startup menu',isNativeInitialStartupMenu"));
  assert(text.includes("if(named)await physical(cdp,'X');"));assert(!text.includes("if(named)await physical(cdp,'Escape');"));
  assert(text.includes("await physical(cdp,'.')"));assert(text.includes("__dcssDynamicCore.save()"));
  assert(text.includes("await physical(cdp,'q',{modifiers:2,text:'\\u0011'})"));
  assert(text.includes("'native ordinary quit completion'"));assert(text.includes('if(!completed)throw Error'));
});
const result={result:'pass',scope:'source/recognizer checks only; no engine/Worker/WASM/browser execution',upstream:'1eebc1a2892e1c89776a0d7a10691f8dac8d9796',checks:checks.length,labels:checks,
  fixtures:['tests/native-dynamic-startup-browser.mjs','tests/dynamic-startup-browser.mjs'].map(file=>({path:file,sha256:hash(fs.readFileSync(path.join(root,file)))})),source_receipts:records};
fs.writeFileSync(path.join(root,'fixture-readiness-results.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({result:result.result,scope:result.scope,checks:result.checks,fixtures:result.fixtures}));
