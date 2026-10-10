/* SPDX-License-Identifier: GPL-2.0-only */
/* Source-selected original Angband 4.2.6 realm/spell message facts. */
#include "web-realm-text.h"
#ifdef __EMSCRIPTEN__
#include "angband.h"
#include "player.h"
#include "web-semantic.h"
#include "web-spell-text.h"

struct ab_realm_binding { const char *singular,*plural,*verb; };
/* realm.txt parse_realm_name prepends exactly these four source records.
 * A copied class_magic_realms node retains the original immutable name pointer.
 * code is NOT populated by upstream. No completed English is inspected here. */
static const struct ab_realm_binding ab_realm_bindings[] = {
 {"magic.realm.shadow.spell_noun_singular","magic.realm.shadow.spell_noun_plural","magic.realm.shadow.verb"},
 {"magic.realm.nature.spell_noun_singular","magic.realm.nature.spell_noun_plural","magic.realm.nature.verb"},
 {"magic.realm.divine.spell_noun_singular","magic.realm.divine.spell_noun_plural","magic.realm.divine.verb"},
 {"magic.realm.arcane.spell_noun_singular","magic.realm.arcane.spell_noun_plural","magic.realm.arcane.verb"},
};
static const struct ab_realm_binding *ab_realm_binding_for(const struct magic_realm *selected)
{
 const struct magic_realm *source=realms;
 const struct ab_realm_binding *found=NULL;
 unsigned index=0;
 if(!selected || !selected->name)return NULL;
 while(source && index<4U) {
  if(selected->name==source->name)found=&ab_realm_bindings[index];
  source=source->next;index++;
 }
 return index==4U && !source ? found:NULL;
}
static void ab_realm_begin(struct ab_semantic_event *event,const char *id,int type)
{ab_semantic_event_begin(event,id,"message","game","message",type,type);}
static void ab_realm_reference(struct ab_semantic_event *event,const char *name,const char *id)
{
 ab_semantic_param_begin(event,name,"localized_text");
 ab_semantic_json_string(event,id?id:"__unsupported.realm_catalog_identity");
 ab_semantic_param_end(event);
}
static void ab_realm_integer(struct ab_semantic_event *event,const char *name,int value)
{
 ab_semantic_param_begin(event,name,"integer");
 ab_semantic_json_int32(event,value);ab_semantic_param_end(event);
}
static void ab_realm_list(struct ab_semantic_event *event,const struct ab_realm_list_snapshot *snapshot)
{
 unsigned i;
 ab_semantic_param_begin(event,"realms","localized_text_list");
 ab_semantic_json_literal(event,"{\"ids\":[");
 if(!snapshot || !snapshot->valid) {
  ab_semantic_json_string(event,"__unsupported.realm_catalog_identity");
 }else for(i=0;i<snapshot->count;i++) {
  if(i)ab_semantic_json_literal(event,",");
  ab_semantic_json_string(event,snapshot->ids[i]);
 }
 ab_semantic_json_literal(event,"],\"style\":\"realm_spell_disjunction\"}");
 ab_semantic_param_end(event);
}
void ab_realm_cast_warning(const struct magic_realm *realm)
{
 struct ab_semantic_event event;
 const struct ab_realm_binding *binding=ab_realm_binding_for(realm);
 ab_realm_begin(&event,"realm.message.cast.insufficient_mana",MSG_GENERIC);
 ab_realm_reference(&event,"verb",binding?binding->verb:NULL);
 ab_realm_reference(&event,"noun",binding?binding->singular:NULL);
 ab_semantic_event_emit(&event);
}
void ab_realm_book_no_learnable(const struct magic_realm *realm)
{
 struct ab_semantic_event event;
 const struct ab_realm_binding *binding=ab_realm_binding_for(realm);
 ab_realm_begin(&event,"realm.message.study.book_no_learnable_spells",MSG_GENERIC);
 ab_realm_reference(&event,"noun",binding?binding->plural:NULL);
 ab_semantic_event_emit(&event);
}
void ab_realm_known_spell(const struct player *p,const struct class_spell *spell,const char *id,int type)
{
 struct ab_semantic_event event;
 const struct ab_realm_binding *binding=spell?ab_realm_binding_for(spell->realm):NULL;
 ab_realm_begin(&event,id,type);
 ab_realm_reference(&event,"noun",binding?binding->singular:NULL);
 ab_realm_reference(&event,"spell",ab_spell_name_id(p,spell));
 ab_semantic_event_emit(&event);
}
void ab_realm_more_single(const struct magic_realm *realm,int count)
{
 struct ab_semantic_event event;
 const struct ab_realm_binding *binding=ab_realm_binding_for(realm);
 ab_realm_begin(&event,"realm.message.study.more_single_realm",MSG_GENERIC);
 ab_realm_integer(&event,"count",count);
 /* This callsite uses PLURAL(count), unlike calc_spells' explicit >1 gate. */
 ab_realm_reference(&event,"noun",binding?(count==1?binding->singular:binding->plural):NULL);
 ab_semantic_event_emit(&event);
}
void ab_realm_capture_list(struct ab_realm_list_snapshot *snapshot,const struct magic_realm *selected,bool plural)
{
 const struct magic_realm *node;
 if(!snapshot)return;
 snapshot->count=0;snapshot->valid=true;
 for(node=selected;node;node=node->next) {
  const struct ab_realm_binding *binding=ab_realm_binding_for(node);
  if(!binding || snapshot->count>=AB_REALM_LIST_MAX) {snapshot->valid=false;return;}
  snapshot->ids[snapshot->count++]=plural?binding->plural:binding->singular;
 }
 if(!snapshot->count)snapshot->valid=false;
}
void ab_realm_more_list(const struct ab_realm_list_snapshot *snapshot,int count)
{
 struct ab_semantic_event event;
 ab_realm_begin(&event,"realm.message.study.more_realms",MSG_GENERIC);
 ab_realm_integer(&event,"count",count);ab_realm_list(&event,snapshot);
 ab_semantic_event_emit(&event);
}
void ab_realm_none_remaining(const struct ab_realm_list_snapshot *snapshot)
{
 struct ab_semantic_event event;
 ab_realm_begin(&event,"realm.message.study.none_remaining",MSG_GENERIC);
 ab_realm_list(&event,snapshot);ab_semantic_event_emit(&event);
}
#endif
