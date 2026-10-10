/* SPDX-License-Identifier: GPL-2.0-only */
#include "angband.h"
#include "web-object-messages.h"
#ifdef __EMSCRIPTEN__
#include "web-semantic.h"
#include "web-death-cause.h"
#include "player.h"
#include "obj-gear.h"
#include <string.h>
static uint32_t object_status;
static struct ab_ui_param relation,relation_slot;
void ab_object_snapshot(struct ab_naming_snapshot *owned,const char *native_buffer)
{
 ab_naming_snapshot_release(owned);
 if(!ab_naming_copy_object_snapshot(owned,native_buffer))object_status=1;
}
static bool parameter_value(struct ab_semantic_event *event,const struct ab_ui_param *p,unsigned depth)
{
 size_t i;
 if(!p || !p->name || !p->type || depth>4)return false;
 ab_semantic_param_begin(event,p->name,p->type);
 if(!strcmp(p->type,"integer"))ab_semantic_json_int32(event,p->number);
 else if(!strcmp(p->type,"canonical_identity")) {
  if(!p->text)return false;
  ab_semantic_json_string(event,p->text);
 } else if(!strcmp(p->type,"localized_text")) {
  if(!p->text || p->nested_count>8)return false;
  ab_semantic_json_literal(event,"{\"id\":");ab_semantic_json_string(event,p->text);
  if(p->nested_count) {
   ab_semantic_json_literal(event,",\"params\":{");
   for(i=0;i<p->nested_count;i++) {
    /* Nested parameters have the same typed shape, not finished English. */
    const struct ab_ui_param *n=&p->nested[i];
    if(i)ab_semantic_json_literal(event,",");
    ab_semantic_json_string(event,n->name);ab_semantic_json_literal(event,":{\"type\":");
    ab_semantic_json_string(event,n->type);ab_semantic_json_literal(event,",\"value\":");
    if(!n->text || strcmp(n->type,"localized_text") || n->nested_count)return false;
    ab_semantic_json_literal(event,"{\"id\":");ab_semantic_json_string(event,n->text);ab_semantic_json_literal(event,"}}");
   }
   ab_semantic_json_literal(event,"}");
  }
  ab_semantic_json_literal(event,"}");
 } else return false;
 ab_semantic_param_end(event);return true;
}
void ab_object_message(const char *id,int sound,struct ab_naming_snapshot *owned,
 const struct ab_ui_param *params,size_t count)
{
 struct ab_semantic_event event;size_t i;bool valid=true;
 if(!id || count>8 || (owned && !owned->json)){object_status=1;if(owned)ab_naming_snapshot_release(owned);return;}
 ab_semantic_event_begin(&event,id,"message","object-message","selected",0,sound);
 if(owned)ab_naming_param_snapshot(&event,"name","KnownObjectDescription",owned);
 for(i=0;i<count;i++)if(!parameter_value(&event,&params[i],0)){valid=false;break;}
 if(valid)ab_semantic_event_emit(&event);else{object_status=3;ab_semantic_event_discard(&event);}
 if(owned)ab_naming_snapshot_release(owned);
}
const char *ab_object_word(const char *id,const char *native_word)
{if(!ab_dc_register_source_message(native_word,id))object_status=2;return native_word;}
const char *ab_object_word_id(const char *native_word,bool capital)
{
 const char *id=ab_dc_source_message_id(native_word);
 if(capital && id) {
  if(!strcmp(id,"object.device.staff"))return "object.device.staff.capital";
  if(!strcmp(id,"object.device.wand"))return "object.device.wand.capital";
 }
 return id;
}
void ab_object_relation_capture(int body,int slot,int type,bool heavy,bool named)
{
 static const int slot_types[]={EQUIP_WEAPON,EQUIP_BOW,EQUIP_RING,EQUIP_RING,EQUIP_AMULET,EQUIP_LIGHT,EQUIP_BODY_ARMOR,EQUIP_CLOAK,EQUIP_SHIELD,EQUIP_HAT,EQUIP_GLOVES,EQUIP_BOOTS};
 static const char *const slot_semantic[]={"object.slot.humanoid.weapon","object.slot.humanoid.shooting","object.slot.humanoid.right_hand","object.slot.humanoid.left_hand","object.slot.humanoid.neck","object.slot.humanoid.light","object.slot.humanoid.body","object.slot.humanoid.back","object.slot.humanoid.arm","object.slot.humanoid.head","object.slot.humanoid.hands","object.slot.humanoid.feet"};
 const char *id=NULL;
 if(heavy) {
  if(type==EQUIP_WEAPON)id="object.relation.weapon.heavy";
  else if(type==EQUIP_BOW)id="object.relation.bow.heavy";
 } else if(named) {
  if(body==0 && slot>=0 && slot<(int)N_ELEMENTS(slot_semantic) && type==slot_types[slot]) {
   id=type==EQUIP_AMULET?"object.relation.slot.around":"object.relation.slot.on";
   relation_slot=AB_UI_REF("slot",slot_semantic[slot]);
  }
 } else {
  if(type==EQUIP_WEAPON)id="object.relation.weapon.normal";
  else if(type==EQUIP_BOW)id="object.relation.bow.normal";
  else if(type==EQUIP_LIGHT)id="object.relation.light.normal";
 }
 relation=named?AB_UI_NESTED("relation",id,&relation_slot,1):AB_UI_REF("relation",id);
 if(!id)object_status=4;
}
struct ab_ui_param ab_object_relation_parameter(void){return relation;}
uint32_t ab_object_message_status(void){return object_status;}
#endif
