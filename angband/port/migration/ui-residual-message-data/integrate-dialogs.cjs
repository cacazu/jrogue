/* Retired one-shot source migration; do not rerun against integrated inputs. */
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const dir='migration/ui-residual-message-data',manifest=JSON.parse(fs.readFileSync(dir+'/source-manifest.json','utf8'));
const read=p=>fs.readFileSync(p,'utf8'),B='/* AB_UI_RESIDUAL_BEGIN */',E='/* AB_UI_RESIDUAL_END */',strip=s=>s.replace(/\/\* AB_UI_RESIDUAL_BEGIN \*\/[\s\S]*?\/\* AB_UI_RESIDUAL_END \*\//g,'');
const block=s=>B+'\n#ifdef __EMSCRIPTEN__\n'+s+'\n#endif\n'+E,wrap=(p,n,s=')')=>B+p+E+n+B+s+E;
const pending=new Map();function get(file){if(!pending.has(file)){const before=read(file);pending.set(file,{before,source:before});}return pending.get(file);}
function edit(file,needle,change,count=1){const f=get(file),re=new RegExp(needle.replaceAll('\r\n','\n').replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replaceAll('\n','\\r?\\n'),'g');const matches=[...f.source.matchAll(re)];assert.equal(matches.length,count,file+': '+needle);for(const m of matches.reverse())f.source=f.source.slice(0,m.index)+(typeof change==='function'?change(m[0]):change)+f.source.slice(m.index+m[0].length);}
function fn(file,name,change){const f=get(file),mask=f.source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g,m=>m.replace(/[^\r\n]/g,' '));const declaration=new RegExp('(?:static )?(?:int|char|bool) '+name+'\\(').exec(mask);assert.ok(declaration,name);const start=declaration.index,open=mask.indexOf('{',start);let d=1,end=open+1;while(d){if(mask[end]==='{')d++;if(mask[end]==='}')d--;end++;}const original=f.source.slice(start,end),next=change(original);assert.equal(strip(next),strip(original),name+' native bytes');f.source=f.source.slice(0,start)+next+f.source.slice(end);}
function one(s,n,c){assert.equal(s.split(n).length-1,1,n);return s.replace(n,typeof c==='function'?c(n):c);}
const helper='logic/web-ui-residual-text.c',header='logic/web-ui-residual-text.h';
let h=read(header);h=h.replace('void ab_ur_message(',`struct ab_ur_quantity_call { char *reference; int maximum,initial; bool active; };
struct ab_ur_store_quantity { int operation,owned; bool has_owned; };
void ab_ur_quantity_capture(struct ab_ur_quantity_call *call,const char *prompt,int maximum,int initial);
void ab_ur_quantity_begin(struct ab_ur_quantity_call *call);
bool ab_ur_quantity_result(struct ab_ur_quantity_call *call,bool result);
int ab_ur_quantity_return(struct ab_ur_quantity_call *call,int result);
void ab_ur_quantity_editor(const char *text,size_t limit);
const char *ab_ur_quantity_word(struct ab_ur_store_quantity *facts,int operation,const char *word);
const char *ab_ur_quantity_owned(struct ab_ur_store_quantity *facts,bool has_owned,int owned,const char *fragment);
void ab_ur_quantity_store(const struct ab_ur_store_quantity *facts,int maximum,const char *prompt);
const char *ab_ur_choice_source(int kind,const char *id,const char *prompt);
void ab_ur_choice_command(int command,const char *prompt);
void ab_ur_choice_begin(const char *prompt,const char *options,size_t len,char fallback);
void ab_ur_choice_end(void);
void ab_ur_message(`);
h=h.replace('#define AB_UR_BEFORE(effect,call)',`#define AB_UR_QUANTITY_RESULT(o,call) ab_ur_quantity_result((o),(call))
#define AB_UR_QUANTITY_RETURN(o,v) ab_ur_quantity_return((o),(v))
#define AB_UR_QUANTITY_WORD(o,k,v) ab_ur_quantity_word((o),(k),(v))
#define AB_UR_QUANTITY_OWNED(o,h,n,v) ab_ur_quantity_owned((o),(h),(n),(v))
#define AB_UR_CHOICE_SOURCE(k,i,v) ab_ur_choice_source((k),(i),(v))
#define AB_UR_CHOICE_COMMAND(c,p,call) (ab_ur_choice_command((c),(p)),(call))
#define AB_UR_BEFORE(effect,call)`);
const elseAt=h.indexOf('\n#else\n#define AB_UR_BEFORE');assert.ok(elseAt>=0);h=h.slice(0,elseAt)+h.slice(elseAt).replace('#define AB_UR_BEFORE(effect,call)',`#define AB_UR_QUANTITY_RESULT(o,call) (call)
#define AB_UR_QUANTITY_RETURN(o,v) (v)
#define AB_UR_QUANTITY_WORD(o,k,v) (v)
#define AB_UR_QUANTITY_OWNED(o,h,n,v) (v)
#define AB_UR_CHOICE_SOURCE(k,i,v) (v)
#define AB_UR_CHOICE_COMMAND(c,p,call) (call)
#define AB_UR_BEFORE(effect,call)`);
let c=read(helper);c=c.replace('#include "parser.h"','#include "parser.h"\n#include "cmd-core.h"\n#include "ui-event.h"\n#include "web-check-commands.h"');
const additions=`
/* Owned references are detached by exact producer address before any callback. */
struct dialog_pending {char *reference;const char *address,*action;int kind;};
static struct dialog_pending quantity_pending,choice_pending;
static char *dialog_reference(const char *id,const struct ab_ui_param *params,size_t count)
{
 struct ab_semantic_event e;char *result;
 memset(&e,0,sizeof(e));e.valid=id!=NULL;
 ab_semantic_json_literal(&e,"{\\\"id\\\":");ab_semantic_json_string(&e,id);
 ab_semantic_json_literal(&e,",\\\"params\\\":{");parameters(&e,params,count);ab_semantic_json_literal(&e,"}}");
 if(!e.valid || e.parameter_open || e.length>16384) {ab_semantic_event_discard(&e);quit("Invalid owned browser dialog reference");}
 result=e.data;e.data=NULL;ab_semantic_event_discard(&e);return result;
}
static void dialog_prepare(struct dialog_pending *p,int kind,const char *id,const struct ab_ui_param *params,size_t count,const char *address,const char *action)
{free(p->reference);*p=(struct dialog_pending){dialog_reference(id,params,count),address,action,kind};}
static struct dialog_pending dialog_take(struct dialog_pending *pending,const char *address)
{
 struct dialog_pending owned=*pending;memset(pending,0,sizeof(*pending));
 if(owned.address!=address){free(owned.reference);memset(&owned,0,sizeof(owned));}
 return owned;
}
static void dialog_emit_reference(const char *context,const char *reference,const char *id,const char *options)
{
 struct ab_semantic_event e;ab_semantic_event_begin(&e,id,"ui",context,"prompt",0,-1);
 ab_semantic_param_begin(&e,"prompt","localized_text");ab_semantic_json_literal(&e,reference);ab_semantic_param_end(&e);
 if(options){ab_semantic_param_begin(&e,"keys","display_token");ab_semantic_json_string(&e,options);ab_semantic_param_end(&e);}
 ab_semantic_event_emit(&e);
}
static void dialog_action(const char *context,const char *name,const char *id,int key,const struct ab_ui_param *params,size_t count)
{
 char widget[64];struct ab_semantic_event e;
 snprintf(widget,sizeof(widget),"action.%s.label",name);ab_ui_emit(context,widget,id,params,count);
 snprintf(widget,sizeof(widget),"__action:%s",name);ab_semantic_event_begin(&e,"","ui",context,widget,0,-1);
 ab_semantic_param_begin(&e,"activation_key","integer");ab_semantic_json_int32(&e,key);ab_semantic_param_end(&e);ab_semantic_event_emit_control(&e);
}
void ab_ur_quantity_capture(struct ab_ur_quantity_call *call,const char *prompt,int maximum,int initial)
{
 struct dialog_pending owned=dialog_take(&quantity_pending,prompt);struct ab_ui_param p[]={AB_UI_INT("lower",0),AB_UI_INT("upper",maximum)};
 memset(call,0,sizeof(*call));call->maximum=maximum;call->initial=initial;
 if(owned.reference)call->reference=owned.reference;
 else call->reference=dialog_reference(prompt?ab_dc_source_message_id(prompt):"ui.residual.quantity.generic",prompt?NULL:p,prompt?0:2);
}
void ab_ur_quantity_begin(struct ab_ur_quantity_call *call)
{
 struct ab_ui_param p[]={AB_UI_INT("lower",0),AB_UI_INT("upper",call->maximum),AB_UI_INT("initial",call->initial)};
 ab_ui_scope_begin_required("quantity-editor",true);call->active=true;
 dialog_emit_reference("quantity-editor",call->reference,"ui.residual.quantity.prompt",NULL);
 ab_ui_emit(NULL,"limits","ui.residual.quantity.limits",p,3);
 dialog_action("quantity-editor","all","ui.residual.quantity.all",'*',NULL,0);
 dialog_action("quantity-editor","accept","ui.residual.quantity.accept",KC_ENTER,NULL,0);
 dialog_action("quantity-editor","cancel","ui.residual.quantity.cancel",ESCAPE,NULL,0);
}
bool ab_ur_quantity_result(struct ab_ur_quantity_call *call,bool result)
{
 if(call->active){if(!ab_ui_in("quantity-editor"))quit("Unpaired quantity scope");ab_ui_scope_end();ab_ui_reset("quantity-editor");call->active=false;}
 free(call->reference);call->reference=NULL;return result;
}
int ab_ur_quantity_return(struct ab_ur_quantity_call *call,int result)
{ab_ur_quantity_result(call,true);return result;}
void ab_ur_quantity_editor(const char *text,size_t limit)
{
 struct ab_semantic_event e;if(!ab_ui_in("quantity-editor"))return;
 if(!limit || limit>80)quit("Invalid native quantity editor bound");
 ab_semantic_event_begin(&e,"","ui","quantity-editor","__input:value",0,-1);
 ab_semantic_param_begin(&e,"text","verbatim_user_text");ab_semantic_json_string(&e,text);ab_semantic_param_end(&e);
 ab_semantic_param_begin(&e,"max_bytes","integer");ab_semantic_json_int32(&e,(int32_t)limit-1);ab_semantic_param_end(&e);
 ab_semantic_event_emit_control(&e);ab_ui_scope_commit();
}
const char *ab_ur_quantity_word(struct ab_ur_store_quantity *facts,int operation,const char *word)
{facts->operation=operation;return word;}
const char *ab_ur_quantity_owned(struct ab_ur_store_quantity *facts,bool has_owned,int owned,const char *fragment)
{facts->has_owned=has_owned;facts->owned=owned;return fragment;}
void ab_ur_quantity_store(const struct ab_ur_store_quantity *facts,int maximum,const char *prompt)
{
 const char *id;struct ab_ui_param p[]={AB_UI_INT("maximum",maximum),AB_UI_INT("owned",facts->owned)};
 if(facts->operation==1)id=facts->has_owned?"ui.residual.quantity.store_take_owned":"ui.residual.quantity.store_take";
 else if(facts->operation==0)id=facts->has_owned?"ui.residual.quantity.store_buy_owned":"ui.residual.quantity.store_buy";
 else quit("Invalid selected store quantity operation");
 dialog_prepare(&quantity_pending,0,id,p,facts->has_owned?2:1,prompt,NULL);
}
const char *ab_ur_choice_source(int kind,const char *id,const char *prompt)
{dialog_prepare(&choice_pending,kind,id,NULL,0,prompt,NULL);return prompt;}
void ab_ur_choice_command(int command,const char *prompt)
{
 size_t i;const char *action=NULL;struct ab_ui_param p;
 for(i=0;i<N_ELEMENTS(ab_check_commands);i++)if(ab_check_commands[i].command==command){action=ab_check_commands[i].id;break;}
 if(!action)quit("Unknown selected browser command identity");p=AB_UI_REF("action",action);
 dialog_prepare(&choice_pending,2,"ui.residual.choice.shape_prompt",&p,1,prompt,action);
}
void ab_ur_choice_begin(const char *prompt,const char *options,size_t len,char fallback)
{
 struct dialog_pending owned=dialog_take(&choice_pending,prompt);struct ab_ui_param p;size_t i,n;
 if(!owned.reference || !options || len>16)quit("Unbound browser choice source");
 n=strlen(options);if(n>16)quit("Unbounded native choice options");
 ab_ui_scope_begin_required("choice-dialog",true);
 dialog_emit_reference("choice-dialog",owned.reference,"ui.residual.choice.prompt",options);free(owned.reference);
 /* Controlled original option bytes, not an alternate selection policy. */
 for(i=0;i<n;i++) {
  const char *id=NULL;char widget[2]={options[i],0};const struct ab_ui_param *params=NULL;size_t count=0;
  if(owned.kind==1){if(options[i]=='h')id="ui.residual.choice.html";else if(options[i]=='f')id="ui.residual.choice.forum";}
  else if(owned.kind==2){if(options[i]=='y'){id="ui.residual.choice.shape_change";p=AB_UI_REF("action",owned.action);params=&p;count=1;}else if(options[i]=='r')id="ui.residual.choice.shape_return";else if(options[i]=='n')id="ui.residual.choice.cancel";}
  if(!id)quit("Unmapped original choice key");dialog_action("choice-dialog",widget,id,(unsigned char)options[i],params,count);
 }
 dialog_action("choice-dialog","escape","ui.residual.choice.cancel",ESCAPE,NULL,0);
 /* The original fallback remains C-owned; capture its byte for replay facts. */
 {struct ab_semantic_event e;ab_semantic_event_begin(&e,"","ui","choice-dialog","__value:native_fallback",0,-1);ab_semantic_param_begin(&e,"number","integer");ab_semantic_json_int32(&e,(unsigned char)fallback);ab_semantic_param_end(&e);ab_semantic_event_emit_control(&e);}
}
void ab_ur_choice_end(void)
{if(!ab_ui_in("choice-dialog"))quit("Unpaired choice scope");ab_ui_scope_end();ab_ui_reset("choice-dialog");}
`;
assert.ok(c.endsWith('#endif\n'));c=c.slice(0,-7)+additions+'#endif\n';
const ui='logic/ui-input.c';edit(ui,'#include "angband.h"',n=>n+block('\n#include "web-ui-residual-text.h"'));
fn(ui,'textui_get_quantity',s=>{s=one(s,'int amt = 1;',n=>n+block('\tstruct ab_ur_quantity_call ab_quantity;\n\tab_ur_quantity_capture(&ab_quantity,prompt,max,amt);'));s=one(s,'if (!get_string(prompt, buf, 7)) return (0);',n=>block('\tab_ur_quantity_begin(&ab_quantity);')+n.replace('get_string(prompt, buf, 7)',wrap('AB_UR_QUANTITY_RESULT(&ab_quantity,','get_string(prompt, buf, 7)')));return one(s,'return (amt);',n=>n.replace('amt',wrap('AB_UR_QUANTITY_RETURN(&ab_quantity,','amt')));});
fn(ui,'get_char',s=>{s=one(s,'event_signal(EVENT_MESSAGE_FLUSH);',n=>block('\tab_ur_choice_begin(prompt,options,len,fallback);')+n);s=one(s,'key = inkey();',n=>block('\tab_ui_scope_commit();')+n);return one(s,'prt("", 0, 0);',n=>n+block('\tab_ur_choice_end();'));});
fn(ui,'askfor_aux',s=>one(s,'ch = inkey();',n=>block('\tab_ur_quantity_editor(buf,len);')+n));
const literalPairs=[['great','How many great objects? ','高品質の品をいくつ生成しますか？'],['good','How many good objects? ','良質の品をいくつ生成しますか？'],['zap','Zap within what distance? ','何マス以内を攻撃しますか？'],['experience','Gain how much experience? ','経験値をいくつ増やしますか？'],['radius','Enter second parameter (radius): ','第2引数（半径）：'],['other','Enter third parameter (other): ','第3引数（その他）：'],['y','Enter y parameter: ','y座標：'],['x','Enter x parameter: ','x座標：'],['monsters','How many monsters? ','モンスターを何体召喚しますか？']];
for(const[key,english]of literalPairs)edit('logic/cmd-wizard.c',JSON.stringify(english),n=>wrap('AB_UR_SOURCE("ui.residual.quantity.wizard_'+key+'",',n));
const recall='Which level do you wish to return to (0 to cancel)? ';edit('logic/player-util.c',JSON.stringify(recall),n=>wrap('AB_UR_SOURCE("ui.residual.quantity.recall",',n));
const shapeCall='get_char(prompt, "yrn", 3, \'n\')';edit('logic/player-util.c',shapeCall,n=>wrap('AB_UR_CHOICE_COMMAND(cmd->code,prompt,',n));
const screen='Dump as (H)TML or (F)orum text? ';edit('logic/ui-command.c',JSON.stringify(screen),n=>wrap('AB_UR_CHOICE_SOURCE(1,"interface.command.do_cmd_save_screen.dump_as_h_tml_or_f_orum_text",',n));
const store='logic/ui-store.c';const storeNative='strnfmt(o_name, sizeof o_name, "%s how many%s? (max %d) ",\n\t\t\t\t(store->feat == FEAT_HOME) ? "Take" : "Buy",\n\t\t\t\tnum ? format(" (you have %d)", num) : "", amt);';
edit(store,storeNative,n=>{let next=n.replace('"Take"',wrap('AB_UR_QUANTITY_WORD(&ab_qty,1,','"Take"')).replace('"Buy"',wrap('AB_UR_QUANTITY_WORD(&ab_qty,0,','"Buy"'));next=next.replace('format(" (you have %d)", num)',wrap('AB_UR_QUANTITY_OWNED(&ab_qty,true,num,','format(" (you have %d)", num)'));next=next.replace(': "", amt)',': '+wrap('AB_UR_QUANTITY_OWNED(&ab_qty,false,0,','""')+', amt)');return block('\tstruct ab_ur_store_quantity ab_qty={0};')+next+block('\tab_ur_quantity_store(&ab_qty,amt,o_name);');});
for(const[file,f]of pending){assert.equal(strip(f.source),strip(f.before),file+' native reconstruction');assert.equal(read(file),f.before,'concurrent '+file);if(!manifest.source_files.includes(file)){const p=manifest.baseline+'/'+path.basename(file);assert.ok(!fs.existsSync(p),'immutable snapshot exists');fs.writeFileSync(p,f.before);manifest.source_files.push(file);manifest.source_before_sha256[file]=crypto.createHash('sha256').update(f.before).digest('hex');}}
const uih='logic/web-ui-text.h',uic='logic/web-ui-text.c';let uh=read(uih),uc=read(uic);assert.ok(!uc.includes('void ab_ui_scope_begin_required'));uh=uh.replace('void ab_ui_scope_begin(const char *context,bool replace);','void ab_ui_scope_begin(const char *context,bool replace);\nvoid ab_ui_scope_begin_required(const char *context,bool replace);');uc+='\n#ifdef __EMSCRIPTEN__\nvoid ab_ui_scope_begin_required(const char *context,bool replace) {\n if(ui_depth>=N_ELEMENTS(ui_scopes))quit("Browser presentation scope capacity exceeded");\n ab_ui_scope_begin(context,replace);\n}\n#endif\n';
const en=JSON.parse(read(dir+'/en.json')),ja=JSON.parse(read(dir+'/ja.json'));function add(id,english,japanese,parameters,source){assert.ok(!en[id],id);en[id]=english;ja[id]=japanese;manifest.entries.push({id,english,japanese,parameters,sources:[source],source_role:'source_owned_native_dialog',status:'source_connected_unbuilt'});}
const src=(file,fn,expression)=>({file,function:fn,original_expression:expression});const ip=n=>({name:n,type:'integer'}),rp=n=>({name:n,type:'localized_text'});
add('ui.residual.quantity.generic','Quantity ({lower}-{upper}, *=all): ','数量（{lower}～{upper}、*で全数）：',[ip('lower'),ip('upper')],src(ui,'textui_get_quantity','strnfmt(tmp, sizeof(tmp), "Quantity (0-%d, *=all): ", max);'));
add('ui.residual.quantity.prompt','{prompt}','{prompt}',[rp('prompt')],src(ui,'textui_get_quantity','get_string(prompt, buf, 7)'));
add('ui.residual.quantity.limits','Range: {lower}-{upper}; default: {initial}.','範囲：{lower}～{upper}、初期値：{initial}。',[ip('lower'),ip('upper'),ip('initial')],src(ui,'textui_get_quantity','int amt = 1; /* then clamps 0..max */'));
for(const[key,english,japanese]of literalPairs)add('ui.residual.quantity.wizard_'+key,english,japanese,[],src('logic/cmd-wizard.c','original quantity caller',JSON.stringify(english)));
add('ui.residual.quantity.recall',recall,'どの階に帰還しますか？（0でキャンセル）',[],src('logic/player-util.c','player_get_recall_depth',JSON.stringify(recall)));
for(const[op,e,j]of[['buy','Buy','購入'],['take','Take','自宅から取り出す']]){add('ui.residual.quantity.store_'+op,e+' how many? (max {maximum}) ',j+'数量は？（最大{maximum}）',[ip('maximum')],src(store,'store_purchase',storeNative));add('ui.residual.quantity.store_'+op+'_owned',e+' how many (you have {owned})? (max {maximum}) ',j+'数量は？（所持数{owned}、最大{maximum}）',[ip('maximum'),ip('owned')],src(store,'store_purchase',storeNative));}
for(const[key,e,j,proof]of[['all','All (*)','全数（*）',"if ((buf[0] == '*') || isalpha((unsigned char)buf[0])) amt = max;"],['accept','Accept','確定','case KC_ENTER:'],['cancel','Cancel','キャンセル','case ESCAPE:']])add('ui.residual.quantity.'+key,e,j,[],src(ui,key==='all'?'textui_get_quantity':'askfor_aux_keypress',proof));
add('ui.residual.choice.prompt','{prompt} [{keys}]','{prompt} [{keys}]',[rp('prompt'),{name:'keys',type:'display_token'}],src(ui,'get_char','strnfmt(buf, 78, "%.70s[%s] ", prompt, options);'));
add('ui.residual.choice.shape_prompt','Change back and {action} (y/n) or (r)eturn to normal? ','元の姿に戻って{action}しますか？（y/n）、元の姿に戻るだけならrを押してください。',[rp('action')],src('logic/player-util.c','player_revert_shape','"Change back and %s (y/n) or (r)eturn to normal? "'));
add('ui.residual.choice.shape_change','Change back and {action}','元の姿に戻って{action}',[rp('action')],src('logic/player-util.c','player_revert_shape',"if (answer == 'y' || answer == 'r')"));
add('ui.residual.choice.shape_return','Return to normal','元の姿に戻る',[],src('logic/player-util.c','player_revert_shape',"answer == 'r'"));
add('ui.residual.choice.cancel','Cancel','キャンセル',[],src(ui,'get_char','key.code = fallback;'));
add('ui.residual.choice.html','HTML','HTML',[],src('logic/ui-command.c','do_cmd_save_screen',"\"hf\", 2, ' '"));
add('ui.residual.choice.forum','Forum text','フォーラム用テキスト',[],src('logic/ui-command.c','do_cmd_save_screen',"\"hf\", 2, ' '"));
add('semantic.context.quantity_editor','Quantity','数量',[],src(ui,'textui_get_quantity','"Quantity (0-%d, *=all): "'));
add('semantic.context.choice_dialog','Response','応答',[],src(ui,'get_char','"%.70s[%s] "'));
for(const entry of manifest.entries.filter(e=>/^ui\.residual\.note\.(say|action|plain)$/.test(e.id))){entry.native_output_max_bytes=86;entry.native_output_budget_source={file:'logic/cmd-misc.c',function:'do_cmd_note',buffer_expression:'char note[90];',omitted_prefix_expression:'msg("%s", &note[3]);',buffer_bytes:90,nul_bytes:1,prefix_bytes:3};}
manifest.known_presentation_limits=manifest.known_presentation_limits.filter(x=>!x.startsWith('User note native'));manifest.catalog_entries=manifest.entries.length;manifest.dialog_phase={status:'source_connected_unbuilt',quantity_calls:13,choice_calls:2,native_editor_len:7,native_text_max_bytes:6,single_maximum:'original max==1 branch does not begin scope; pending source still consumed/released',owned_reference_identity:'original prompt address consumed once before any callback',store_branches:'original Take/Buy and original owned-count branches captured separately with order-independent struct fields'};
manifest.connections.push(...[...pending.keys()].map(file=>({file,kind:'source_owned_common_dialog',phase:'quantity_choice'})));
for(const[file,f]of pending)fs.writeFileSync(file,f.source);
for(const[file,value]of[[helper,c],[header,h],[uih,uh],[uic,uc]])fs.writeFileSync(file,value);
for(const[p,v]of[[dir+'/source-manifest.json',manifest],[dir+'/en.json',en],[dir+'/ja.json',ja]])fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');
console.log(JSON.stringify({catalog_entries:manifest.entries.length,source_files:manifest.source_files.length,quantity_calls:13,choice_calls:2,exact_native_bytes:true}));