// SPDX-License-Identifier: GPL-2.0-or-later
// Bounded source/catalog review only. No upstream code is executed.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const toolPath=fileURLToPath(import.meta.url);
const defaultRoot=path.resolve(path.dirname(toolPath),'..');
export const sourceCommit='1eebc1a2892e1c89776a0d7a10691f8dac8d9796';
const pins={
 'newgame.cc':'b3186394e72e533d40fbf2e69d5b4b8a3b123f847a3a488ac49fb4252b92f10c',
 'ng-input.cc':'23758132dc149752d890f8f21bed173286a48d7661bd026acf45a7f902abe978',
 'version.h':'bbcf4c21e2c100914fa1d42f07ae3e31e16c72ff9db69262888c1eb2426484a4',
 'externs.h':'0da9b608627678b4c0586375745e7ccc0221383c64bee5bc0e50136fab437c90'
};
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const keys=x=>Object.keys(x).sort();
function need(x,why){if(!x)throw new Error(why);}
const cpp=code=>[...code.matchAll(/"(?:[^"\\]|\\.)*"/g)].map(m=>JSON.parse(m[0]));
function commandTokens(text){
 const found=[...text.matchAll(/\[[^\]\r\n]+\]/g)].map(match=>match[0]);
 const prefix=/^(Esc|Enter|Tab|Bksp|\+|\*|%|\?) - /.exec(text);
 if(prefix)found.push(prefix[1]);
 return[...new Set(found)].sort();
}

// Parse JSON before schema validation, rejecting duplicate keys at every depth.
export function parseStrictJson(text,label='JSON'){
 need(Buffer.byteLength(text,'utf8')<=2000000,label+': oversized input');
 let p=0;
 const ws=()=>{while(/\s/.test(text[p]??''))p++;};
 const string=()=>{need(text[p]==='"',label+': string expected');const a=p++;
  while(p<text.length){if(text[p]==='\\'){p+=2;continue;}if(text[p++]==='"')return JSON.parse(text.slice(a,p));}
  throw new Error(label+': unterminated string');};
 const value=depth=>{need(depth<=64,label+': nesting limit');ws();
  if(text[p]==='"')return string();
  if(text[p]==='{'){p++;const o=Object.create(null);ws();if(text[p]!=='}')while(true){
   ws();const k=string();need(!Object.hasOwn(o,k),label+': duplicate key '+k);ws();
   need(text[p++]===':',label+': missing colon');o[k]=value(depth+1);ws();
   if(text[p]==='}')break;need(text[p++]===',',label+': missing comma');}
   need(text[p++]==='}',label+': object terminator');return o;}
  if(text[p]==='['){p++;const a=[];ws();if(text[p]!==']')while(true){
   a.push(value(depth+1));ws();if(text[p]===']')break;need(text[p++]===',',label+': missing comma');}
   need(text[p++]===']',label+': array terminator');return a;}
  const m=/^(?:true|false|null|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)/.exec(text.slice(p));
  need(m,label+': invalid value');p+=m[0].length;return JSON.parse(m[0]);};
 const result=value(0);ws();need(p===text.length,label+': trailing content');return result;
}
const entity=(family,expression)=>({value_type:'text',kind:'entity_catalog_reference',family,
 id_pattern:family==='species'?'species.sp_*.name':'job.job_*.name',
 source_expression:expression,english_string_lookup:false});
const external=expression=>({value_type:'text',kind:'external_player_text',
 source_expression:expression,translation:'preserve_verbatim',recursive_interpolation:false});
const metadata=expression=>({value_type:'text',kind:'version_metadata',
 source_expression:expression,translation:'preserve_verbatim'});
const weapon=(expression,context)=>({value_type:'text',kind:'localized_weapon_identity_reference',
 source_expression:expression,source_context:context,fixed_refs:context==='current_choice'
 ?['startup.weapon.claws.name','startup.weapon.unarmed.name']
 :['startup.weapon.unarmed.name','startup.weapon.default.random','startup.weapon.default.recommended'],
 ordinary_weapon_source:'weapon_base_name(WPN_*)',
 ordinary_weapon_catalog:'required item-name identity integration; outside this fixed-label slice',
 english_string_lookup:false});

export function collectStartupSource(root=defaultRoot){
 const files=[];const sources={};
 for(const [file,pin]of Object.entries(pins)){
  const bytes=fs.readFileSync(path.join(root,'upstream','crawl-ref','source',file));
  need(hash(bytes)===pin,file+': official source bytes differ from pinned release');
  const code=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  sources[file]={code,lines:code.split(/\r?\n/)};
  files.push({path:'crawl-ref/source/'+file,sha256:pin});
 }
 const sites=[];const records=new Map();
 const site=(id,file,start,end,fn,classification,condition,control={})=>{
  const original=sources[file].lines.slice(start-1,end).join('\n');
  const s={id,source:'crawl-ref/source/'+file,line:start,end_line:end,function:fn,
   classification,original_expression:original,original_strings:cpp(original),
   expression_sha256:hash(Buffer.from(original,'utf8')),source_condition:condition,control,message_ids:[]};
  sites.push(s);return s;};
 const add=(s,id,text,params={},bindings={},condition=s.source_condition,policy='translate',formatting={})=>{
  need(/^startup\.[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/.test(id),'invalid semantic ID '+id);
  assert.deepEqual(keys(params),keys(bindings),id+': binding keys differ');
  if(records.has(id)){const old=records.get(id);assert.equal(old.expected_en,text);assert.deepEqual(old.params,params);
   old.source_sites.push(s.id);old.source_emission_conditions.push({source_site:s.id,condition});
  }else records.set(id,{id,expected_en:text,params,parameter_bindings:bindings,translation_policy:policy,
   formatting,required_command_tokens:commandTokens(text),source_sites:[s.id],
   source_emission_conditions:[{source_site:s.id,condition}]});
  s.message_ids.push(id);
 };
 const one=s=>{const visible=s.original_strings.filter(text=>text.length>0);
  need(visible.length===1,s.id+': expected one nonempty source string');return visible[0];};
 const literal=(id,line,fn,classification,condition,control={})=>{
  const s=site(id,'newgame.cc',line,line,fn,classification,condition,control);add(s,id,one(s));return s;};
 const version=sources['version.h'].code;
 const macro=name=>{const m=new RegExp('^#define '+name+' ("(?:[^"\\\\]|\\\\.)*")$','m').exec(version);
  need(m,'missing macro '+name);return JSON.parse(m[1]);};
 const title=macro('CRAWL'),copyright=macro('CRAWL_COPYRIGHT');
 const opening=site('startup.opening.output','ng-input.cc',19,22,'opening_screen','markup_composition',
  'opening_screen() called',{colour_roles:{title:'yellow',copyright:'brown'}});
 assert.deepEqual(opening.original_strings,['<yellow>Hello, welcome to ',' ','!</yellow>\n','<brown>']);
 add(opening,'startup.opening.title',opening.original_strings[0].slice(8)+title+' {version}!\n',
  {version:'text'},{version:metadata('Version::Long')});
 add(opening,'startup.opening.copyright',copyright,{}, {},opening.source_condition,'preserve_notice');
 const welcome=site('startup.welcome.output','newgame.cc',167,189,'_welcome','conditional_sentence_composition',
  'startup caller requests welcome title');
 assert.deepEqual(welcome.original_strings,[' ',' the ','unnamed ',', ','Welcome','.']);
 for(const named of[false,true])for(const sp of[false,true])for(const job of[false,true]){
  const parts=[],params={},bindings={};
  if(sp){parts.push('{species}');params.species='text';bindings.species=entity('species','species::name(ng.species)');}
  if(job){parts.push('{job}');params.job='text';bindings.job=entity('job','get_job_name(ng.job)');}
  let phrase=parts.join(welcome.original_strings[0]);
  if(named){params.player_name='text';bindings.player_name=external('ng.name');
   phrase='{player_name}'+(phrase?welcome.original_strings[1]+phrase:'');}
  else if(phrase)phrase=welcome.original_strings[2]+phrase;
  const state=sp&&job?'species_job':sp?'species':job?'job':'empty';
  const id=state==='empty'?(named?'startup.welcome.named_only':'startup.welcome.empty'):
   'startup.welcome.'+(named?'named_':'unnamed_')+state;
  add(welcome,id,welcome.original_strings[4]+(phrase?welcome.original_strings[3]+phrase:'')+welcome.original_strings[5],
   params,bindings,'name_present='+named+'; species_known='+sp+'; job_known='+job);
 }
 const character=site('startup.name.character.output','newgame.cc',584,586,'_choose_name','printf_with_english_article',
  '!DGAMELAUNCH and choice.name.empty()',{article_control:'is_vowel(specs[0]) ? "n" : ""',species_chop_width:79});
 assert.deepEqual(character.original_strings,['You are a%s %s %s.','n','']);
 for(const article of['a','an'])add(character,'startup.name.character.'+article,'You are '+article+' {species} {job}.',
  {species:'text',job:'text'},{species:entity('species','chop_string(species::name(ng.species),79,false)'),
   job:entity('job','get_job_name(ng.job)')},article==='an'?'is_vowel(specs[0])':'!is_vowel(specs[0])',
  'translate',{english_article:article,japanese_article:'none'});
 const nc='!DGAMELAUNCH and choice.name.empty()';
 literal('startup.name.quit',612,'_choose_name','command_label',nc,{input:'CK_ESCAPE',action:'abort game'});
 literal('startup.name.random',614,'_choose_name','command_label',nc,{input:'*',action:'random unused name; ignored during overwrite prompt'});
 literal('startup.name.begin',620,'_choose_name','command_label',nc,{input:'CK_ENTER',action:'trim input; blank generates name; check existing save'});
 literal('startup.name.invalid',647,'_choose_name','validation_feedback','!is_good_name(buf,true)',{specificity:'generic; no per-reason message'});
 literal('startup.name.prompt',707,'_choose_name','input_prompt',nc);
 literal('startup.name.overwrite',712,'_choose_name','confirmation_prompt','overwrite_prompt',
  {displayed_choices:'[Y/n]',affirmative_input:'uppercase ASCII Y only',other_input:'dismiss without overwrite',default:'do not overwrite'});
 literal('startup.name.missing',1048,'choose_game','fatal_error','ng.name.empty()',{exit_status:1});
 for(const[line,condition,colour]of[[779,'valid_seed()','BROWN'],[781,'!valid_seed()','DARKGRAY'],[832,'initial custom-seed label','BROWN']]){
  const s=site('startup.seed.begin.'+line,'newgame.cc',line,line,line<800?'SeedTextEntry::update_buttons':'_choose_seed',
   'command_label',condition,{input:'CK_ENTER',colour});add(s,'startup.seed.begin',one(s));
 }
 const st=site('startup.seed.title.output','newgame.cc',841,843,'_choose_seed','printf','GAME_TYPE_CUSTOM_SEED');
 assert.equal(one(st),'Play a game with a custom seed for version %s.\n');
 add(st,'startup.seed.title',one(st).replace('%s','{version}'),{version:'text'},{version:metadata('Version::Long')});
 const sb=site('startup.seed.instructions.output','newgame.cc',846,847,'_choose_seed','adjacent_literals',
  'GAME_TYPE_CUSTOM_SEED',{input:['0','Tab','Shift-Tab'],seed_zero:'random seed',focus:'cycle input focus'});
 add(sb,'startup.seed.instructions',sb.original_strings.join(''));
 literal('startup.seed.label',853,'_choose_seed','input_label','GAME_TYPE_CUSTOM_SEED',{value_translation:'none; ASCII decimal'});
 literal('startup.seed.clear',867,'_choose_seed','command_label','GAME_TYPE_CUSTOM_SEED',{input:'-',action:'clear input; focus seed; disable Begin'});
 literal('startup.seed.daily',884,'_choose_seed','command_label','GAME_TYPE_CUSTOM_SEED',
  {input:'d',action:'localtime; strftime("%Y%m%d"); focus seed',timezone:'local environment, not necessarily UTC'});
 const footer=site('startup.seed.footer.output','newgame.cc',906,920,'_choose_seed','conditional_adjacent_literals',
  'GAME_TYPE_CUSTOM_SEED',{compile_conditions:['USE_TILE_LOCAL','SEEDING_UNRELIABLE']});
 const pieces=[];let gate=null;
 for(const line of footer.original_expression.split('\n')){
  const m=/^\s*#ifdef (\w+)\s*$/.exec(line);
  if(m){need(!gate,'nested seed footer condition');gate=m[1];}
  else if(/^\s*#endif\s*$/.test(line))gate=null;
  else for(const text of cpp(line))pieces.push({text,gate});
 }
 for(const local of[false,true])for(const unstable of[false,true]){
  const suffix=local&&unstable?'local_unreliable':local?'local':unstable?'unreliable':'standard';
  const text=pieces.filter(p=>p.gate===null||p.gate==='USE_TILE_LOCAL'&&local||p.gate==='SEEDING_UNRELIABLE'&&unstable)
   .map(p=>p.text).join('');
  add(footer,'startup.seed.footer.'+suffix,text,{}, {},'USE_TILE_LOCAL='+local+'; SEEDING_UNRELIABLE='+unstable);
 }
 literal('startup.seed.pregenerate',928,'_choose_seed','checkbox_label','GAME_TYPE_CUSTOM_SEED and !DGAMELAUNCH',
  {visibility:'show_pregen_toggle = !DGAMELAUNCH',action:'choice.pregenerate; level_gen_type::full'});
 const help=site('startup.seed.help.output','newgame.cc',963,963,'_choose_seed','help_title',"key == '?'",
  {input:'?',section:'D',body_translation:'outside this slice'});
 add(help,'startup.seed.help',one(help));
 const unarmed=site('startup.weapon.unarmed.output','newgame.cc',1701,1702,'_construct_weapon_menu','conditional_base_label','wpn_type == WPN_UNARMED');
 assert.deepEqual(unarmed.original_strings,['claws','unarmed']);
 add(unarmed,'startup.weapon.claws.name',unarmed.original_strings[0],{}, {},'species::has_claws(ng.species)');
 add(unarmed,'startup.weapon.unarmed.name',unarmed.original_strings[1],{}, {},'!species::has_claws(ng.species)');
 const row=site('startup.weapon.row.output','newgame.cc',1752,1754,'_construct_weapon_menu','neutral_printf_layout','each legal weapon choice',
  {hotkey:"'a' + i",legal_choice_count_at_most:7,label_chop:'max_text_width; CJK width integration required'});
 assert.equal(one(row),' %c - %s');
 add(row,'startup.weapon.row',' {hotkey} - {weapon_name}',{hotkey:'text',weapon_name:'text'},
  {hotkey:{value_type:'text',kind:'command_key',pattern:'^[a-g]$',source_expression:"'a' + i"},
   weapon_name:weapon('choices[i].label','current_choice')},row.source_condition,'preserve_layout');
 const apt=site('startup.weapon.aptitude.output','newgame.cc',1766,1767,'_construct_weapon_menu','printf_signed_integer','each legal weapon choice',
  {original_format:'%+d',sign:'explicit plus for positive and zero; minus for negative'});
 assert.equal(one(apt),'(%+d apt)');
 add(apt,'startup.weapon.aptitude.nonnegative','(+{aptitude} apt)',{aptitude:'unsigned'},
  {aptitude:{value_type:'unsigned',kind:'skill_training_aptitude',min:0,max:2147483647,source_expression:'species_apt(choice.skill,ng.species)'}},
  'printf sign variant: aptitude >= 0','translate',{explicit_plus:true});
 add(apt,'startup.weapon.aptitude.negative','({aptitude} apt)',{aptitude:'integer'},
  {aptitude:{value_type:'integer',kind:'skill_training_aptitude',min:-2147483648,max:-1,source_expression:'species_apt(choice.skill,ng.species)'}},
  'printf sign variant: aptitude < 0','translate',{negative_sign_from_value:true});
 for(const[stem,label,desc,input,action]of[
  ['recommended',1783,1784,'+','WPN_VIABLE: random unrestricted choice; falls back to all legal weapons'],
  ['aptitudes',1785,1786,'%','numeric skill training aptitude table'],
  ['help',1788,1789,'?','help screen; remain in popup'],
  ['random',1790,1791,'*','WPN_RANDOM: random legal weapon'],
  ['back',1792,1793,'CK_BKSP','M_ABORT: return to character selection']]){
  const s=site('startup.weapon.'+stem+'.label.output','newgame.cc',label,label,'_construct_weapon_menu','command_label',
   'weapon choice popup required',{input,action});add(s,'startup.weapon.'+stem+'.label',one(s));
  const t=site('startup.weapon.'+stem+'.description.output','newgame.cc',desc,desc,'_construct_weapon_menu','tooltip',
   'weapon choice popup required',{input,action});add(t,'startup.weapon.'+stem+'.description',one(t));
 }
 const def=site('startup.weapon.default.output','newgame.cc',1797,1802,'_construct_weapon_menu','conditional_label_composition',
  'defweapon != WPN_UNKNOWN',{input:'Tab',action:'M_DEFAULT_CHOICE',
   unarmed_distinction:'default label says unarmed even when current row says claws'});
 assert.deepEqual(def.original_strings,['Tab - ','Random','Recommended','unarmed']);
 add(def,'startup.weapon.default.label',def.original_strings[0]+'{weapon_name}',{weapon_name:'text'},
  {weapon_name:weapon('defweapon switch or weapon_base_name(defweapon)','previous_choice')},def.source_condition,'preserve_layout');
 add(def,'startup.weapon.default.random',def.original_strings[1],{}, {},'defweapon == WPN_RANDOM');
 add(def,'startup.weapon.default.recommended',def.original_strings[2],{}, {},'defweapon == WPN_VIABLE');
 add(def,'startup.weapon.unarmed.name',def.original_strings[3],{}, {},'defweapon == WPN_UNARMED');
 literal('startup.weapon.default.description',1805,'_construct_weapon_menu','tooltip','defweapon != WPN_UNKNOWN',
  {input:'Tab',action:'reuse prior weapon choice'});
 literal('startup.weapon.prompt',1837,'_prompt_weapon','selection_prompt','unresolved weapon and multiple legal choices');
 const retained=[
  {source:'crawl-ref/source/newgame.cc',line:709,function:'_choose_name',classification:'external_player_name_echo',
   original_string:'%s\n',parameter:{value_type:'text',translation:'preserve_verbatim',source_expression:'buf'}},
  {source:'crawl-ref/source/newgame.cc',line:857,function:'_choose_seed',classification:'seed_value_echo',
   original_expression:'make_stringf("%" PRIu64, choice.seed)',parameter:{value_type:'decimal',translation:'preserve_verbatim',
    precision:'unsigned 64-bit decimal text; never JS Number'}},
  {source:'crawl-ref/source/newgame.cc',line:803,function:'SeedTextEntry::paste',classification:'seed_value_echo',
   source_condition:'USE_TILE_LOCAL and clipboard scanner found a value',original_expression:'make_stringf("%" PRIu64, clip_seed)',
   parameter:{value_type:'decimal',translation:'preserve_verbatim',precision:'unsigned 64-bit decimal text; never JS Number'}},
  {source:'crawl-ref/source/newgame.cc',line:1704,function:'_construct_weapon_menu',classification:'item_identity_name_dependency',
   original_expression:'weapon_base_name(wpn_type)',translation:'resolve WPN identity through item catalog; no English fallback'}];
 const controls=[
  ['name.is_good','ng-input.cc',62,69,'is_good_name','silent_validation'],
  ['name.validate','ng-input.cc',71,97,'validate_player_name','silent_validation'],
  ['name.enter','newgame.cc',624,637,'_choose_name','input_transition'],
  ['name.confirm','newgame.cc',682,699,'_choose_name','input_transition'],
  ['seed.key_filter','newgame.cc',725,738,'_keyfun_seed_input','input_filter'],
  ['seed.begin_enabled','newgame.cc',771,774,'SeedTextEntry::valid_seed','nonempty_only_validation'],
  ['seed.daily_date','newgame.cc',894,903,'_choose_seed','local_date_to_decimal'],
  ['seed.begin_focus','newgame.cc',942,955,'_choose_seed','focus_and_web_control_gate'],
  ['seed.parse','newgame.cc',989,1002,'_choose_seed','unsigned_scan_without_emitted_error'],
  ['weapon.selection','newgame.cc',1960,2055,'_get_weapons/_resolve_weapon/_choose_weapon','domain_control_dependency']
 ].map(([id,file,start,end,fn,classification])=>{
  const original=sources[file].lines.slice(start-1,end).join('\n');
  return{id,source:'crawl-ref/source/'+file,line:start,end_line:end,function:fn,classification,
   original_expression:original,expression_sha256:hash(Buffer.from(original,'utf8'))};});
 const max=/^#define MAX_NAME_LENGTH (\d+)$/m.exec(sources['externs.h'].code);
 need(max&&Number(max[1])===30,'MAX_NAME_LENGTH changed');
 return{
  schema_version:1,release:'0.34.1',commit:sourceCommit,
  scope:{kind:'bounded_first_startup_slice',fixed_output_sites:sites.length,
   selected_functions:['opening_screen','_welcome','_choose_name','SeedTextEntry::update_buttons','_choose_seed',
    '_construct_weapon_menu','_prompt_weapon','choose_game missing-name failure'],
   complete_for_selected_fixed_labels_and_prompts:true,runtime_integration:false,full_startup_coverage:false,
   full_game_localization:false,
   excluded:['options_read_status','newgame_char_description','_reroll_random','UINewGameMenu species/background menus',
    'map/mode selection','ordinary item base names','help bodies','startup.cc main menu','validator implementation migration']},
  source_files:files,source_constants:{
   game_title:{value:title,source:'crawl-ref/source/version.h',line:11,translation:'preserve'},
   copyright:{value:copyright,source:'crawl-ref/source/version.h',line:18,translation:'preserve_notice'},
   max_name_width:{value:30,source:'crawl-ref/source/externs.h',line:81}},
  catalog_references:[
   {family:'species',english:'locales/entities/species.en.json',japanese:'locales/entities/species.ja.json',id_pattern:'species.sp_*.name'},
   {family:'job',english:'locales/entities/jobs.en.json',japanese:'locales/entities/jobs.ja.json',id_pattern:'job.job_*.name'}],
  output_sites:sites,messages:[...records.values()].sort((a,b)=>a.id.localeCompare(b.id,'en')),
  retained_untranslated_outputs:retained,control_sites:controls,
  transport_mirrors:[
   {source:'crawl-ref/source/newgame.cc',line:977,end_line:985,compile_condition:'USE_TILE_WEB',
    values:['body_text','title_text','footer_text'],property_names_untranslated:true,creates_new_language_text:false},
   {source:'crawl-ref/source/newgame.cc',line:1918,end_line:1927,compile_condition:'USE_TILE_WEB',
    values:['title','prompt','main-items','sub-items'],property_names_untranslated:true,creates_new_language_text:false}]
 };
}

function placeholders(text,label){
 const out=[];for(let p=0;p<text.length;p++){
  if(text[p]==='{'){const end=text.indexOf('}',p+1);need(end>p&&/^[a-z][a-z0-9_]*$/.test(text.slice(p+1,end)),label+': malformed placeholder');
   out.push(text.slice(p+1,end));p=end;}else need(text[p]!=='}',label+': unmatched brace');}
 return[...new Set(out)].sort();
}
function parts(value,label){
 if(typeof value==='string')return{text:value,params:{}};
 need(value&&typeof value==='object'&&!Array.isArray(value),label+': invalid entry');
 assert.deepEqual(keys(value),['params','text'],label+': unsupported fields');
 need(typeof value.text==='string'&&value.params&&typeof value.params==='object'&&!Array.isArray(value.params),label+': invalid text/params');
 return{text:value.text,params:{...value.params}};
}
export function validateStartupPair(source,en,ja){
 const expected=source.messages.map(x=>x.id).sort();
 assert.deepEqual(keys(en),expected,'English IDs differ from selected source sites');
 assert.deepEqual(keys(ja),expected,'Japanese IDs differ from selected source sites');
 for(const m of source.messages){
  const e=parts(en[m.id],m.id),j=parts(ja[m.id],m.id);
  assert.equal(e.text,m.expected_en,m.id+': English differs from source normalization');
  assert.deepEqual(e.params,m.params,m.id+': English parameter schema differs');
  assert.deepEqual(j.params,m.params,m.id+': Japanese parameter schema differs');
  assert.deepEqual(placeholders(e.text,m.id),keys(m.params),m.id+': English placeholders differ');
  assert.deepEqual(placeholders(j.text,m.id),keys(m.params),m.id+': Japanese placeholders differ');
  need(j.text.trim().length,m.id+': empty Japanese');
  for(const token of m.required_command_tokens)need(j.text.includes(token),m.id+': command token changed: '+token);
  if(m.id==='startup.seed.instructions')need(j.text.includes('0'),m.id+': random seed zero omitted');
  if(m.translation_policy==='translate')need(/[\u3040-\u30ff\u3400-\u9fff]/u.test(j.text),m.id+': Japanese missing');
  else assert.equal(j.text,e.text,m.id+': preserved notice/layout changed');
  need(!/\uFFFD/u.test(j.text),m.id+': replacement character');
 }
}
export function readEntityCatalogs(root=defaultRoot){
 const out={en:{},ja:{}};
 for(const[family,file]of[['species','species'],['job','jobs']])for(const lang of['en','ja']){
  const location=path.join(root,'locales','entities',file+'.'+lang+'.json');
  const source=parseStrictJson(fs.readFileSync(location,'utf8'),location);
  for(const[id,value]of Object.entries(source)){need(id.startsWith(family+'.')&&typeof value==='string','invalid entity entry');out[lang][id]=value;}
 }
 assert.deepEqual(keys(out.en),keys(out.ja),'entity reference IDs differ');return out;
}
// Strict disconnected render probe. It returns text, not UI or executable HTML.
export function renderStartupMessage(source,catalogs,entities,id,params={},language='ja'){
 need(language==='en'||language==='ja','unsupported language');
 const record=source.messages.find(m=>m.id===id);need(record,'unknown semantic ID '+id);
 need(params&&typeof params==='object'&&!Array.isArray(params),'invalid parameters');
 assert.deepEqual(keys(params),keys(record.params),id+': missing/extra params');
 const entry=parts(catalogs[language][id],id),resolved={};
 for(const[name,kind]of Object.entries(record.params)){
  const b=record.parameter_bindings[name],v=params[name];
  if(b.kind==='entity_catalog_reference'){
   need(v&&typeof v==='object'&&!Array.isArray(v),name+': entity text-ID descriptor required');
   assert.deepEqual(keys(v),['id']);const pattern=b.family==='species'?/^species\.sp_[a-z_]+\.name$/:/^job\.job_[a-z_]+\.name$/;
   need(typeof v.id==='string'&&pattern.test(v.id)&&Object.hasOwn(entities[language],v.id),name+': invalid/missing entity ID');
   resolved[name]=entities[language][v.id];
  }else if(b.kind==='localized_weapon_identity_reference'){
   need(v&&typeof v==='object'&&!Array.isArray(v),name+': weapon text-ID descriptor required');assert.deepEqual(keys(v),['id']);
   need(typeof v.id==='string'&&b.fixed_refs.includes(v.id),name+': ordinary item catalog integration required');
   const label=parts(catalogs[language][v.id],v.id);need(keys(label.params).length===0,'parameterized weapon label');resolved[name]=label.text;
  }else if(kind==='text'){
   need(typeof v==='string',name+': text required');if(b.kind==='command_key')need(new RegExp(b.pattern).test(v),name+': invalid hotkey');resolved[name]=v;
  }else{
   need(Number.isSafeInteger(v)&&v>=b.min&&v<=b.max,name+': invalid source-range integer');
   if(kind==='unsigned')need(v>=0,name+': unsigned integer required');resolved[name]=String(v);
  }
 }
 return entry.text.replace(/\{([a-z][a-z0-9_]*)\}/g,(_match,name)=>resolved[name]);
}
function selfTest(source,catalogs,entities){
 let count=0;const equal=(a,b)=>{assert.equal(a,b);count++;},reject=fn=>{assert.throws(fn);count++;};
 const render=(id,params,lang)=>renderStartupMessage(source,catalogs,entities,id,params,lang);
 equal(source.output_sites.length,37);equal(source.messages.length,51);equal(source.source_files.length,4);
 equal(source.messages.filter(m=>m.id.startsWith('startup.welcome.')).length,8);
 equal(source.messages.filter(m=>m.id.startsWith('startup.seed.footer.')).length,4);
 equal(render('startup.name.character.an',{species:{id:'species.sp_oni.name'},job:{id:'job.job_fighter.name'}},'en'),'You are an Oni Fighter.');
 const name='Alice \u732b {species} <img onerror=evil()>';
 const result=render('startup.welcome.named_species_job',{player_name:name,species:{id:'species.sp_human.name'},job:{id:'job.job_fighter.name'}});
 equal(result.includes(name),true);equal(result.includes('{species}'),true);
 equal(render('startup.weapon.aptitude.nonnegative',{aptitude:0},'en'),'(+0 apt)');
 equal(render('startup.weapon.aptitude.negative',{aptitude:-5},'en'),'(-5 apt)');
 equal(render('startup.weapon.aptitude.nonnegative',{aptitude:3}),'(\u9069\u6027 +3)');
 equal(render('startup.weapon.row',{hotkey:'a',weapon_name:{id:'startup.weapon.claws.name'}},'en'),' a - claws');
 equal(render('startup.weapon.default.label',{weapon_name:{id:'startup.weapon.unarmed.name'}},'en'),'Tab - unarmed');
 equal(render('startup.opening.copyright',{},'ja'),render('startup.opening.copyright',{},'en'));
 equal(render('startup.seed.title',{version:'0.34.1 {unexpanded}'}).includes('0.34.1 {unexpanded}'),true);
 reject(()=>render('startup.name.character.a',{species:'Human',job:'Fighter'}));
 reject(()=>render('startup.name.character.a',{species:{id:'species.sp_unknown.name'},job:{id:'job.job_fighter.name'}}));
 reject(()=>render('startup.name.character.a',{species:{id:'job.job_fighter.name'},job:{id:'job.job_fighter.name'}}));
 reject(()=>render('startup.weapon.row',{hotkey:'Enter',weapon_name:{id:'startup.weapon.claws.name'}}));
 reject(()=>render('startup.weapon.row',{hotkey:'a',weapon_name:{id:'untranslated short sword'}}));
 reject(()=>render('startup.weapon.row',{hotkey:'a',weapon_name:{id:'startup.weapon.default.random'}}));
 reject(()=>render('startup.weapon.row',{hotkey:'a',weapon_name:{id:'startup.weapon.default.recommended'}}));
 reject(()=>render('startup.weapon.default.label',{weapon_name:{id:'startup.weapon.claws.name'}}));
 for(const[id,value]of[['startup.weapon.aptitude.nonnegative',-1],['startup.weapon.aptitude.negative',0],
  ['startup.weapon.aptitude.nonnegative','3'],['startup.weapon.aptitude.nonnegative',2147483648]])
  reject(()=>render(id,{aptitude:value}));
 reject(()=>render('startup.seed.title',{version:341}));
 reject(()=>render('startup.name.begin',{extra:'injected'}));
 reject(()=>render('startup.unknown',{}));reject(()=>render('startup.name.begin',{},'xx'));
 reject(()=>parseStrictJson('{"startup.name.begin":"a","startup.name.begin":"b"}'));
 reject(()=>parseStrictJson('{"a":{"params":{"x":"text","x":"unsigned"}}}'));
 reject(()=>parseStrictJson('{"a":true,}'));
 reject(()=>validateStartupPair(source,{...catalogs.en,'startup.name.begin':'invented'},catalogs.ja));
 reject(()=>validateStartupPair(source,catalogs.en,{...catalogs.ja,'startup.name.begin':'English fallback'}));
 reject(()=>validateStartupPair(source,catalogs.en,{...catalogs.ja,'startup.seed.title':{text:'\u30d0\u30fc\u30b8\u30e7\u30f3 {other}',params:{version:'text'}}}));
 const missing={...catalogs.ja};delete missing['startup.name.begin'];reject(()=>validateStartupPair(source,catalogs.en,missing));
 reject(()=>validateStartupPair(source,catalogs.en,{...catalogs.ja,'startup.name.overwrite':'\u4e0a\u66f8\u304d\u3057\u307e\u3059\u304b\uff1f [y/n]'}));
 reject(()=>validateStartupPair(source,catalogs.en,{...catalogs.ja,'startup.seed.footer.local':
  catalogs.ja['startup.seed.footer.local'].replace('[ctrl-v]','[Ctrl-v]')}));
 return count;
}
export function checkStartupCatalogs(root=defaultRoot,tests=false){
 const source=collectStartupSource(root),folder=path.join(root,'locales','startup');
 const manifest=parseStrictJson(fs.readFileSync(path.join(folder,'source-map.json'),'utf8'),'startup source map');
 assert.deepEqual(JSON.parse(JSON.stringify(manifest)),source,'source map differs from exact pinned sites/conditions/hashes');
 const catalogs={en:parseStrictJson(fs.readFileSync(path.join(folder,'en.json'),'utf8'),'startup en'),
  ja:parseStrictJson(fs.readFileSync(path.join(folder,'ja.json'),'utf8'),'startup ja')};
 validateStartupPair(source,catalogs.en,catalogs.ja);const entities=readEntityCatalogs(root),areas={};
 for(const s of source.output_sites){const area=s.id.split('.')[1];areas[area]=(areas[area]??0)+1;}
 return{release:source.release,source_commit:source.commit,source_files_verified:source.source_files.length,
  source_evidence:'exact official source SHA-256 pins; no Git command executed',
  language_output_sites:source.output_sites.length,output_sites_by_area:areas,bilingual_ids:source.messages.length,
  entity_reference_ids:keys(entities.en).length,retained_untranslated_outputs:source.retained_untranslated_outputs.length,
  control_source_ranges:source.control_sites.length,self_test_assertions:tests?selfTest(source,catalogs,entities):0,
  runtime_integration:false,full_startup_coverage:false,full_game_localization:false};
}
if(process.argv[1]&&path.resolve(process.argv[1])===toolPath){
 try{const args=process.argv.slice(2);need(args.every(a=>a==='--self-test'||a.startsWith('--root=')),
  'usage: node check-startup-catalogs.mjs [--self-test] [--root=DCSS_ROOT]');
  const explicit=args.find(a=>a.startsWith('--root='));
  console.log(JSON.stringify(checkStartupCatalogs(explicit?path.resolve(explicit.slice(7)):defaultRoot,args.includes('--self-test')),null,2));
 }catch(error){console.error('Startup catalog validation failed: '+error.message);process.exitCode=1;}
}
