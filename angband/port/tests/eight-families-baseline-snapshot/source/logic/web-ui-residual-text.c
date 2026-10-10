/* SPDX-License-Identifier: GPL-2.0-only */
#include "angband.h"
#include "web-ui-residual-text.h"
#ifdef __EMSCRIPTEN__
#include "web-semantic.h"
#include "web-death-cause.h"
#include "web-knowledge-text.h"
#include "obj-properties.h"
#include "obj-tval.h"
#include "parser.h"
#include "cmd-core.h"
#include "ui-event.h"
#include "web-check-commands.h"
#include "trap.h"
#include <stdlib.h>
#include <string.h>
#include "web-ui-residual-bindings.h"
static void value(struct ab_semantic_event *event,const struct ab_ui_param *p,unsigned depth)
{
 size_t i;
 if(!p || !p->type || depth>8){event->valid=false;return;}
 if(!strcmp(p->type,"integer")||!strcmp(p->type,"signed_integer"))ab_semantic_json_int32(event,p->number);
 else if(!strcmp(p->type,"localized_text")){
  if(!p->text || (p->nested_count&&!p->nested) || p->nested_count>16){event->valid=false;return;}
  ab_semantic_json_literal(event,"{\"id\":");ab_semantic_json_string(event,p->text);
  if(p->nested_count){ab_semantic_json_literal(event,",\"params\":{");
   for(i=0;i<p->nested_count;i++){
    const struct ab_ui_param *child=&p->nested[i];
    if(!child->name || !child->type){event->valid=false;return;}
    if(i)ab_semantic_json_literal(event,",");ab_semantic_json_string(event,child->name);
    ab_semantic_json_literal(event,":{\"type\":");ab_semantic_json_string(event,child->type);
    ab_semantic_json_literal(event,",\"value\":");value(event,child,depth+1);ab_semantic_json_literal(event,"}");
   }
   ab_semantic_json_literal(event,"}");
  }
  ab_semantic_json_literal(event,"}");
 }else if(!strcmp(p->type,"TrapName")){
  if(!p->text){event->valid=false;return;}
  ab_semantic_json_literal(event,"{\"name_id\":");ab_semantic_json_string(event,p->text);ab_semantic_json_literal(event,"}");
 }else ab_semantic_json_string(event,p->text?p->text:"");
}
static void parameters(struct ab_semantic_event *event,const struct ab_ui_param *params,size_t count)
{
 size_t i;
 if(count>16 || (count&&!params)){event->valid=false;return;}
 for(i=0;i<count;i++){
  if(!params[i].name || !params[i].type){event->valid=false;return;}
  ab_semantic_param_begin(event,params[i].name,params[i].type);value(event,&params[i],0);ab_semantic_param_end(event);
 }
}
void ab_ur_message(const char *id,int sound,const struct ab_ui_param *params,size_t count)
{
 struct ab_semantic_event event;
 if(!id)quit("Unbound reviewed browser message source");
 ab_semantic_event_begin(&event,id,"message","ui-residual","selected",0,sound);
 parameters(&event,params,count);ab_semantic_event_emit(&event);
}
void ab_ur_message_object(const char *id,int sound,const char *parameter,
 const struct ab_naming_snapshot *object,const struct ab_ui_param *params,size_t count)
{
 struct ab_semantic_event event;
 if(!id || !parameter || !object || !object->json)quit("Unbound reviewed browser object message");
 ab_semantic_event_begin(&event,id,"message","ui-residual","selected",0,sound);
 ab_naming_param_snapshot(&event,parameter,"KnownObjectDescription",object);
 parameters(&event,params,count);ab_semantic_event_emit(&event);
}
const char *ab_ur_source(const char *id,const char *native_source)
{
 /* The integration script restricts this adapter to immutable literal fields. */
 if(!ab_dc_register_source_message(native_source,id))quit("Invalid reviewed browser literal source");
 return native_source;
}
void ab_ur_message_source(const char *native_source,int sound)
{ab_ur_message(ab_dc_source_message_id(native_source),sound,NULL,0);}
void ab_ur_generation(const char *native_error)
{
 struct ab_ui_param p=AB_UI_REF("error",ab_dc_source_message_id(native_error));
 if(!p.text)quit("Unbound reviewed browser generation error");
 ab_ur_message("ui.residual.generation.restarted",MSG_GENERIC,&p,1);
}
const char *ab_ur_parser_error(int error)
{
 size_t i;for(i=0;i<N_ELEMENTS(ab_ur_parser_ids);i++)if(ab_ur_parser_ids[i].value==error)return ab_ur_parser_ids[i].id;
 return NULL;
}
const char *ab_ur_tval_name(int tval)
{
 size_t i;for(i=0;i<N_ELEMENTS(ab_ur_tval_ids);i++)if(ab_ur_tval_ids[i].value==tval)return ab_ur_tval_ids[i].id;
 return "ui.residual.tval.unknown";
}
const char *ab_ur_trap_name(const struct trap_kind *kind)
{
 size_t i;
 if(!kind || !kind->name || !kind->desc)return NULL;
 for(i=0;i<N_ELEMENTS(ab_ur_trap_ids);i++)if(ab_ur_trap_ids[i].index==kind->tidx &&
  !strcmp(ab_ur_trap_ids[i].name,kind->name) && !strcmp(ab_ur_trap_ids[i].desc,kind->desc))return ab_ur_trap_ids[i].id;
 return NULL;
}
void ab_ur_object_capture(struct ab_naming_snapshot *owned,const char *native_buffer)
{
 ab_naming_snapshot_release(owned);
 if(!ab_naming_copy_object_snapshot(owned,native_buffer))quit("Missing reviewed browser naming snapshot");
}
struct borrow {const struct ab_naming_snapshot *object;const char *address;};
struct owned_title {struct ab_naming_snapshot *object;const char *address;};
static struct owned_title titles[16];
static struct borrow properties[16];
static unsigned title_depth,property_depth;
void ab_ur_title_begin(struct ab_naming_snapshot *object,const char *native_title)
{
 if(title_depth>=N_ELEMENTS(titles) || !object || !object->json || !native_title)quit("Invalid browser title lifetime");
 titles[title_depth++]=(struct owned_title){object,native_title};
}
void ab_ur_title_end(void){if(!title_depth)quit("Unpaired browser title lifetime");title_depth--;ab_naming_snapshot_release(titles[title_depth].object);memset(&titles[title_depth],0,sizeof(titles[0]));}
int ab_ur_title_result(int native_result){ab_ur_title_end();return native_result;}
void ab_ur_title_message(const char *native_title)
{
 if(!title_depth || titles[title_depth-1].address!=native_title)quit("Unbound browser inscription title");
 ab_ur_message_object("ui.residual.inscribe.title",MSG_GENERIC,"object",titles[title_depth-1].object,NULL,0);
}
void ab_ur_property_begin(const struct ab_naming_snapshot *object,const char *native_name)
{
 if(property_depth>=N_ELEMENTS(properties) || !object || !object->json || !native_name)quit("Invalid browser property lifetime");
 properties[property_depth++]=(struct borrow){object,native_name};
}
void ab_ur_property_end(void){if(!property_depth)quit("Unpaired browser property lifetime");memset(&properties[--property_depth],0,sizeof(properties[0]));}
void ab_ur_property_message(int flag,const char *native_name)
{
 const char *id=ab_knowledge_property_id(OBJ_PROPERTY_FLAG,flag,AB_KNOWLEDGE_NOTICE);
 if(!property_depth || properties[property_depth-1].address!=native_name)quit("Unbound browser property notice");
 ab_ur_message_object(id,MSG_GENERIC,"name",properties[property_depth-1].object,NULL,0);
}
static struct ab_semantic_event pending_note;
static bool has_note;
void ab_ur_note_prepare(int branch,const char *name,const char *text)
{
 const char *id;struct ab_ui_param params[2];size_t count;
 if(has_note)ab_semantic_event_discard(&pending_note);has_note=false;
 if(branch==1){id="ui.residual.note.say";params[0]=AB_UI_OPAQUE("name","character_name",name);params[1]=AB_UI_OPAQUE("text","verbatim_user_text",text);count=2;}
 else if(branch==2){id="ui.residual.note.action";params[0]=AB_UI_OPAQUE("name","character_name",name);params[1]=AB_UI_OPAQUE("text","verbatim_user_text",text);count=2;}
 else if(branch==3){id="ui.residual.note.plain";params[0]=AB_UI_OPAQUE("text","verbatim_user_text",text);count=1;}
 else quit("Invalid browser note source branch");
 ab_semantic_event_begin(&pending_note,id,"message","ui-residual","note",0,MSG_GENERIC);
 parameters(&pending_note,params,count);has_note=true;
}
void ab_ur_note_message(void)
{
 struct ab_semantic_event owned;
 if(!has_note)quit("Unbound browser note source");
 owned=pending_note;memset(&pending_note,0,sizeof(pending_note));has_note=false;
 ab_semantic_event_emit(&owned);
}
static const char *preference_categories[16];
static unsigned preference_depth;
void ab_ur_preferences_begin(const char *category_id)
{
 if(!category_id || preference_depth>=N_ELEMENTS(preference_categories))quit("Invalid browser preferences lifetime");
 preference_categories[preference_depth++]=category_id;
}
void ab_ur_preferences_end(void){if(!preference_depth)quit("Unpaired browser preferences lifetime");preference_categories[--preference_depth]=NULL;}
void ab_ur_preferences_message(bool saved)
{
 struct ab_ui_param p;
 if(!preference_depth)quit("Unbound browser preferences category");
 p=AB_UI_REF("category",preference_categories[preference_depth-1]);
 ab_ur_message(saved?"ui.residual.preferences.saved":"ui.residual.preferences.save_failed",MSG_GENERIC,&p,1);
}
const char *ab_ur_rune_name(size_t oid,const char *native_name)
{
 struct ab_semantic_event event;
 ab_semantic_event_begin(&event,"ui.residual.rune.learned","message","ui-residual","rune",0,MSG_RUNE);
 ab_knowledge_param_last_rune(&event,"rune",oid,false);ab_semantic_event_emit(&event);
 return native_name;
}

/* Owned references are detached by exact producer address before any callback. */
struct dialog_pending {char *reference;const char *address,*action;int kind;};
static struct dialog_pending quantity_pending,choice_pending;
static char *dialog_reference(const char *id,const struct ab_ui_param *params,size_t count)
{
 struct ab_semantic_event e;char *result;
 memset(&e,0,sizeof(e));e.valid=id!=NULL;
 ab_semantic_json_literal(&e,"{\"id\":");ab_semantic_json_string(&e,id);
 ab_semantic_json_literal(&e,",\"params\":{");parameters(&e,params,count);ab_semantic_json_literal(&e,"}}");
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
 {char key[2]={fallback,0};struct ab_ui_param p=AB_UI_OPAQUE("key","display_token",key);ab_ui_emit(NULL,"fallback","ui.residual.choice.fallback",&p,1);}
}
void ab_ur_choice_end(void)
{if(!ab_ui_in("choice-dialog"))quit("Unpaired choice scope");ab_ui_scope_end();ab_ui_reset("choice-dialog");}
#endif
