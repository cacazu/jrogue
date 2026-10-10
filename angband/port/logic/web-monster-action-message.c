/* SPDX-License-Identifier: GPL-2.0-only */
#include "angband.h"
#include "web-monster-action-message.h"
#ifdef __EMSCRIPTEN__
#include "web-naming.h"
#include "web-semantic.h"
#include "web-knowledge-text.h"
#include "web-domain-text.h"
#include "message.h"
#include <stdint.h>
#include <string.h>

#define AB_MON_ACTION_ID(role) "angband.monster_action." role
enum ab_verb_kind { AB_VERB_HITS, AB_VERB_BRAND, AB_VERB_SLAY, AB_VERB_FAILS, AB_VERB_PUNCH, AB_VERB_HIT, AB_VERB_SHAPE };
struct ab_verb_selection { uintptr_t address; enum ab_verb_kind kind; int index; bool range; int shape_slot; };
static struct ab_verb_selection verbs[16];
static unsigned verb_cursor;
struct ab_note_selection { const char *pointer; enum ab_mon_action_note selected; bool valid; int damage; };
static struct ab_note_selection notes[8];
static unsigned note_depth;
static struct ab_note_selection arena_note;

static void begin(struct ab_semantic_event *e,const char *id,int sound)
{ ab_semantic_event_begin(e,id,"message","command","log",0,sound); }
static void descriptor(struct ab_semantic_event *e,const char *name,const char *kind,const char *buffer)
{
 ab_semantic_param_begin(e,name,kind);
 ab_naming_copy_json_for_buffer(e,buffer,kind);
 ab_semantic_param_end(e);
}
static void text_reference(struct ab_semantic_event *e,const char *name,const char *id)
{
 ab_semantic_param_begin(e,name,"localized_text");
 ab_semantic_json_literal(e,"{\"id\":");ab_semantic_json_string(e,id?id:"");ab_semantic_json_literal(e,"}");
 ab_semantic_param_end(e);
}
static void integer(struct ab_semantic_event *e,const char *name,int value)
{ab_semantic_param_begin(e,name,"integer");ab_semantic_json_int32(e,value);ab_semantic_param_end(e);}

void ab_mon_action_actor_capture(struct ab_mon_action_actor *out,const char *original_buffer)
{
 if(!out)return;ab_naming_snapshot_release(&out->snapshot);
 ab_naming_copy_monster_snapshot(&out->snapshot,original_buffer);
}
void ab_mon_action_actor_release(struct ab_mon_action_actor *out)
{if(out)ab_naming_snapshot_release(&out->snapshot);}
void ab_mon_action_push(const struct ab_mon_action_actor *actor,const struct ab_mon_action_actor *target,bool kill)
{
 struct ab_semantic_event e;
 begin(&e,kill?AB_MON_ACTION_ID("movement.tramples"):AB_MON_ACTION_ID("movement.pushes"),MSG_GENERIC);
 ab_naming_param_snapshot(&e,"actor","MonsterDescription",actor?&actor->snapshot:NULL);
 ab_naming_param_snapshot(&e,"target","MonsterDescription",target?&target->snapshot:NULL);
 ab_semantic_event_emit(&e);
}
void ab_mon_action_shape(const char *actor)
{
 struct ab_semantic_event e;begin(&e,AB_MON_ACTION_ID("shape.shimmers_and_changes"),MSG_GENERIC);
 descriptor(&e,"actor","MonsterDescription",actor);ab_semantic_event_emit(&e);
}
bool ab_mon_action_note_destroyed(enum ab_mon_action_note *selected,bool native_value)
{if(selected)*selected=native_value?AB_MON_ACTION_DESTROYED:AB_MON_ACTION_DIES;return native_value;}
void ab_mon_action_note_begin(const char *note,enum ab_mon_action_note selected)
{
 if(note_depth>=N_ELEMENTS(notes)) {note_depth++;return;}
 notes[note_depth].pointer=note;notes[note_depth].selected=selected;
 notes[note_depth].valid=note && selected>=AB_MON_ACTION_DIES && selected<=AB_MON_ACTION_DRAINED_DRY;
 notes[note_depth].damage=0;
 note_depth++;
}
void ab_mon_action_note_end(void)
{if(note_depth){note_depth--;if(note_depth<N_ELEMENTS(notes))memset(&notes[note_depth],0,sizeof(notes[note_depth]));}}
const char *ab_mon_action_note_literal(enum ab_mon_action_note selected,const char *note)
{ab_mon_action_note_begin(note,selected);return note;}
const char *ab_mon_action_curse_note(bool displayed,int damage,const char *note)
{
 ab_mon_action_note_begin(note,displayed?AB_MON_ACTION_DIES_DAMAGE_EXCLAIM:AB_MON_ACTION_DIES_EXCLAIM);
 if(displayed && note_depth && note_depth<=N_ELEMENTS(notes))notes[note_depth-1].damage=damage;
 return note;
}
const char *ab_mon_action_arena_note(const char *note)
{arena_note.pointer=note;arena_note.selected=AB_MON_ACTION_DEFEATED;arena_note.valid=note!=NULL;return note;}
void ab_mon_action_arena_end(void)
{memset(&arena_note,0,sizeof(arena_note));}
void ab_mon_action_death(const struct ab_mon_action_actor *actor,const char *note,int sound)
{
 struct ab_semantic_event e;const struct ab_note_selection *selected=NULL;
 const char *id=AB_MON_ACTION_ID("death.unidentified_source");
 if(note_depth && note_depth<=N_ELEMENTS(notes) && notes[note_depth-1].valid && notes[note_depth-1].pointer==note)
  selected=&notes[note_depth-1];
 else if(arena_note.valid && arena_note.pointer==note)selected=&arena_note;
 if(selected) {
  if(selected->selected==AB_MON_ACTION_DIES)id=AB_MON_ACTION_ID("death.dies");
  else if(selected->selected==AB_MON_ACTION_DESTROYED)id=AB_MON_ACTION_ID("death.destroyed");
  else if(selected->selected==AB_MON_ACTION_DEFEATED)id=AB_MON_ACTION_ID("death.defeated");
  else if(selected->selected==AB_MON_ACTION_DESTROYED_EXCLAIM)id=AB_MON_ACTION_ID("death.destroyed_exclaim");
  else if(selected->selected==AB_MON_ACTION_DIES_EXCLAIM)id=AB_MON_ACTION_ID("death.dies_exclaim");
  else if(selected->selected==AB_MON_ACTION_DIES_DAMAGE_EXCLAIM)id=AB_MON_ACTION_ID("death.dies_exclaim_damage");
  else if(selected->selected==AB_MON_ACTION_DRAINED_DRY)id=AB_MON_ACTION_ID("death.drained_dry");
 }
 begin(&e,id,sound);ab_semantic_param_begin(&e,"actor","CapitalizedMonsterDescription");
 ab_semantic_json_literal(&e,"{\"schema_version\":2,\"subject\":");
 if(actor && actor->snapshot.json)ab_semantic_json_literal(&e,actor->snapshot.json);
 else ab_semantic_json_literal(&e,"{\"schema_version\":2,\"complete\":false,\"reason\":\"NoDescriptorSnapshot\"}");
 ab_semantic_json_literal(&e,",\"capitalize\":true}");ab_semantic_param_end(&e);
 if(selected && selected->selected==AB_MON_ACTION_DIES_DAMAGE_EXCLAIM)integer(&e,"damage",selected->damage);
 ab_semantic_event_emit(&e);
 /* An arena pointer is consume-once; this never inspects its English bytes. */
 memset(&arena_note,0,sizeof(arena_note));
}
void ab_mon_action_failed_steal(const char *actor,const char *object,bool split)
{
 struct ab_semantic_event e;
 begin(&e,split?AB_MON_ACTION_ID("steal.failed_stack"):AB_MON_ACTION_ID("steal.failed_single"),MSG_GENERIC);
 descriptor(&e,"actor","MonsterDescription",actor);descriptor(&e,"object","KnownObjectDescription",object);
 ab_semantic_event_emit(&e);
}
int ab_mon_action_stolen_label(const char *object,bool split,int native_label)
{
 struct ab_semantic_event e;char key[2]={(char)native_label,'\0'};
 begin(&e,split?AB_MON_ACTION_ID("steal.stolen_stack"):AB_MON_ACTION_ID("steal.stolen_single"),MSG_GENERIC);
 descriptor(&e,"object","KnownObjectDescription",object);
 ab_semantic_param_begin(&e,"label","canonical_key");
 if(native_label<32 || native_label>126)e.valid=false;
 else ab_semantic_json_string(&e,key);
 ab_semantic_param_end(&e);ab_semantic_event_emit(&e);return native_label;
}
static struct ab_verb_selection *find_verb(const char *buffer)
{
 size_t i;if(!buffer)return NULL;
 for(i=0;i<N_ELEMENTS(verbs);i++)if(verbs[i].address==(uintptr_t)buffer)return &verbs[i];
 return NULL;
}
void ab_mon_action_verb_init(const char *native_buffer)
{
 struct ab_verb_selection *slot=find_verb(native_buffer);
 if(!native_buffer)return;
 if(!slot)slot=&verbs[(verb_cursor++)%N_ELEMENTS(verbs)];
 *slot=(struct ab_verb_selection){(uintptr_t)native_buffer,AB_VERB_HITS,0,true,0};
}
void ab_mon_action_verb_melee_init(const char *native_buffer,bool armed)
{
 struct ab_verb_selection *slot;
 ab_mon_action_verb_init(native_buffer);slot=find_verb(native_buffer);
 if(slot){slot->kind=armed?AB_VERB_HIT:AB_VERB_PUNCH;slot->range=false;}
}
int ab_mon_action_shape_choice(int *captured,int native_choice)
{if(captured)*captured=native_choice;return native_choice;}
const char *ab_mon_action_damage_visible(bool *captured,const char *native_text)
{if(captured)*captured=true;return native_text;}
void ab_mon_action_verb_shape(const char *native_buffer,int shape_index,int original_choice)
{
 struct ab_verb_selection *slot=find_verb(native_buffer);
 if(slot && !slot->range){slot->kind=AB_VERB_SHAPE;slot->index=shape_index;slot->shape_slot=original_choice;}
}
void ab_mon_action_verb_brand(const char *native_buffer,int index,bool range)
{
 struct ab_verb_selection *slot=find_verb(native_buffer);
 if(slot && slot->range==range)*slot=(struct ab_verb_selection){(uintptr_t)native_buffer,AB_VERB_BRAND,index,range,0};
}
void ab_mon_action_verb_slay(const char *native_buffer,int index,bool range)
{
 struct ab_verb_selection *slot=find_verb(native_buffer);
 if(slot && slot->range==range)*slot=(struct ab_verb_selection){(uintptr_t)native_buffer,AB_VERB_SLAY,index,range,0};
}
void ab_mon_action_verb_forget(const char *native_buffer)
{struct ab_verb_selection *slot=find_verb(native_buffer);if(slot)memset(slot,0,sizeof(*slot));}
void ab_mon_action_verb_transfer(const char *destination,const char *source)
{
 struct ab_verb_selection *original=find_verb(source),saved;
 if(!original){ab_mon_action_verb_forget(destination);return;}
 saved=*original;ab_mon_action_verb_forget(source);ab_mon_action_verb_init(destination);
 original=find_verb(destination);if(original){*original=saved;original->address=(uintptr_t)destination;}
}
void ab_mon_action_verb_fails(const char *native_buffer)
{
 struct ab_verb_selection *slot=find_verb(native_buffer);
 if(slot){slot->kind=AB_VERB_FAILS;slot->index=0;}
}
static const char *ranged_brand_grammar(const char *lexeme);
static void verb_reference(struct ab_semantic_event *e,const char *buffer)
{
 struct ab_verb_selection *selected=find_verb(buffer);
 const char *id="",*lexeme=NULL;
 if(selected) {
  if(selected->kind==AB_VERB_HITS)id=AB_MON_ACTION_ID("verb.hits");
  else if(selected->kind==AB_VERB_FAILS)id=AB_MON_ACTION_ID("verb.fails_to_harm");
  else if(selected->kind==AB_VERB_BRAND) {lexeme=ab_knowledge_brand_id(selected->index,true);id=ranged_brand_grammar(lexeme);}
  else if(selected->kind==AB_VERB_SLAY) {id=AB_MON_ACTION_ID("grammar.ranged_slay");lexeme=ab_knowledge_slay_id(selected->index,2);}
 }
 ab_semantic_param_begin(e,"verb","localized_text");
 ab_semantic_json_literal(e,"{\"id\":");ab_semantic_json_string(e,id);
 if(selected && (selected->kind==AB_VERB_BRAND || selected->kind==AB_VERB_SLAY)) {
  ab_semantic_json_literal(e,",\"params\":{\"verb\":{\"type\":\"localized_text\",\"value\":{\"id\":");
  ab_semantic_json_string(e,lexeme?lexeme:"");ab_semantic_json_literal(e,"}}}");
 }
 ab_semantic_json_literal(e,"}");ab_semantic_param_end(e);
}
void ab_mon_action_ranged(const char *object,const char *verb,const char *target,
 int quality,bool show_damage,int damage,int sound)
{
 struct ab_semantic_event e;const char *id,*quality_id=NULL;
 if(quality>=2) {
  if(quality==2)quality_id=AB_MON_ACTION_ID("quality.good_hit");
  else if(quality==3)quality_id=AB_MON_ACTION_ID("quality.great_hit");
  else if(quality==4)quality_id=AB_MON_ACTION_ID("quality.superb_hit");
  id=show_damage?AB_MON_ACTION_ID("ranged.critical_damage"):AB_MON_ACTION_ID("ranged.critical");
 } else id=show_damage?AB_MON_ACTION_ID("ranged.hit_damage"):AB_MON_ACTION_ID("ranged.hit");
 begin(&e,id,sound);descriptor(&e,"projectile","KnownObjectDescription",object);
 verb_reference(&e,verb);descriptor(&e,"target","MonsterDescription",target);
 if(show_damage)integer(&e,"damage",damage);
 if(quality>=2)text_reference(&e,"quality",quality_id);
 ab_semantic_event_emit(&e);
}
/* Frozen canonical lexical IDs select authored Japanese case morphology.
 * These are source binding keys; no English descriptor bytes are inspected. */
static const struct { const char *lexeme; const char *grammar; } melee_lexemes[] = {
 {"angband.knowledge.slay.verb.smite",AB_MON_ACTION_ID("grammar.melee_transitive")},
 {"angband.knowledge.slay.verb.fiercely_smite",AB_MON_ACTION_ID("grammar.melee_transitive")},
 {"angband.knowledge.brand.verb.dissolve",AB_MON_ACTION_ID("grammar.melee_transitive")},
 {"angband.knowledge.brand.verb.shock",AB_MON_ACTION_ID("grammar.melee_to")},
 {"angband.knowledge.brand.verb.burn",AB_MON_ACTION_ID("grammar.melee_transitive")},
 {"angband.knowledge.brand.verb.freeze",AB_MON_ACTION_ID("grammar.melee_transitive")},
 {"angband.knowledge.brand.verb.poison",AB_MON_ACTION_ID("grammar.melee_to")},
 {"angband.knowledge.brand.verb.corrode",AB_MON_ACTION_ID("grammar.melee_transitive")},
 {"angband.knowledge.brand.verb.zap",AB_MON_ACTION_ID("grammar.melee_to")},
 {"angband.knowledge.brand.verb.singe",AB_MON_ACTION_ID("grammar.melee_transitive")},
 {"angband.knowledge.brand.verb.chill",AB_MON_ACTION_ID("grammar.melee_transitive")},
 {"angband.knowledge.brand.verb.sicken",AB_MON_ACTION_ID("grammar.melee_possessive")},
 {"domain.shape.fox.blow.0.verb",AB_MON_ACTION_ID("grammar.melee_to")},
 {"domain.shape.fox.blow.1.verb",AB_MON_ACTION_ID("grammar.melee_transitive")},
 {"domain.shape.pukel_man.blow.0.verb",AB_MON_ACTION_ID("grammar.melee_transitive")},
 {"domain.shape.pukel_man.blow.1.verb",AB_MON_ACTION_ID("grammar.melee_transitive")},
 {"domain.shape.pukel_man.blow.2.verb",AB_MON_ACTION_ID("grammar.melee_transitive")},
 {"domain.shape.pukel_man.blow.3.verb",AB_MON_ACTION_ID("grammar.melee_transitive")},
 {"domain.shape.bear.blow.0.verb",AB_MON_ACTION_ID("grammar.melee_transitive")},
 {"domain.shape.bear.blow.1.verb",AB_MON_ACTION_ID("grammar.melee_transitive")},
 {"domain.shape.bear.blow.2.verb",AB_MON_ACTION_ID("grammar.melee_transitive")},
 {"domain.shape.bear.blow.3.verb",AB_MON_ACTION_ID("grammar.melee_transitive")},
 {"domain.shape.bear.blow.4.verb",AB_MON_ACTION_ID("grammar.melee_transitive")},
 {"domain.shape.bear.blow.5.verb",AB_MON_ACTION_ID("grammar.melee_transitive")},
 {"domain.shape.bear.blow.6.verb",AB_MON_ACTION_ID("grammar.melee_transitive")},
 {"domain.shape.eagle.blow.0.verb",AB_MON_ACTION_ID("grammar.melee_transitive")},
 {"domain.shape.eagle.blow.1.verb",AB_MON_ACTION_ID("grammar.melee_transitive")},
 {"domain.shape.eagle.blow.2.verb",AB_MON_ACTION_ID("grammar.melee_transitive")},
 {"domain.shape.eagle.blow.3.verb",AB_MON_ACTION_ID("grammar.melee_transitive")},
 {"domain.shape.eagle.blow.4.verb",AB_MON_ACTION_ID("grammar.melee_transitive")},
 {"domain.shape.bat.blow.0.verb",AB_MON_ACTION_ID("grammar.melee_to")},
 {"domain.shape.bat.blow.1.verb",AB_MON_ACTION_ID("grammar.melee_transitive")},
 {"domain.shape.warg.blow.0.verb",AB_MON_ACTION_ID("grammar.melee_to")},
 {"domain.shape.warg.blow.1.verb",AB_MON_ACTION_ID("grammar.melee_to")},
 {"domain.shape.warg.blow.2.verb",AB_MON_ACTION_ID("grammar.melee_transitive")},
 {"domain.shape.warg.blow.3.verb",AB_MON_ACTION_ID("grammar.melee_transitive")},
 {"domain.shape.vampire.blow.0.verb",AB_MON_ACTION_ID("grammar.melee_to")},
 {"domain.shape.werewolf.blow.0.verb",AB_MON_ACTION_ID("grammar.melee_to")},
 {"domain.shape.werewolf.blow.1.verb",AB_MON_ACTION_ID("grammar.melee_to")},
 {"domain.shape.werewolf.blow.2.verb",AB_MON_ACTION_ID("grammar.melee_transitive")},
 {"domain.shape.werewolf.blow.3.verb",AB_MON_ACTION_ID("grammar.melee_transitive")},
};
static const char *melee_grammar(const char *lexeme)
{
 size_t i;if(!lexeme)return NULL;
 for(i=0;i<N_ELEMENTS(melee_lexemes);i++)
  if(!strcmp(melee_lexemes[i].lexeme,lexeme))return melee_lexemes[i].grammar;
 return NULL;
}
/* Use the same finite canonical lexical case bindings as melee.
 * Original ranged English templates and selected native verb identity remain. */
static const char *ranged_brand_grammar(const char *lexeme)
{
 const char *selected=melee_grammar(lexeme);
 if(!selected)return NULL;
 if(!strcmp(selected,AB_MON_ACTION_ID("grammar.melee_to")))return AB_MON_ACTION_ID("grammar.ranged_brand_to");
 if(!strcmp(selected,AB_MON_ACTION_ID("grammar.melee_possessive")))return AB_MON_ACTION_ID("grammar.ranged_brand_possessive");
 if(!strcmp(selected,AB_MON_ACTION_ID("grammar.melee_transitive")))return AB_MON_ACTION_ID("grammar.ranged_brand");
 return NULL;
}
static void melee_verb_reference(struct ab_semantic_event *e,const char *buffer)
{
 const struct ab_verb_selection *selected=find_verb(buffer);
 const char *id=NULL,*lexeme=NULL;
 if(selected && !selected->range) {
  if(selected->kind==AB_VERB_PUNCH)id=AB_MON_ACTION_ID("verb.punch");
  else if(selected->kind==AB_VERB_HIT)id=AB_MON_ACTION_ID("verb.hit");
  else if(selected->kind==AB_VERB_FAILS)id=AB_MON_ACTION_ID("verb.fail_to_harm");
  else if(selected->kind==AB_VERB_BRAND)lexeme=ab_knowledge_brand_id(selected->index,true);
  else if(selected->kind==AB_VERB_SLAY)lexeme=ab_knowledge_slay_id(selected->index,1);
  else if(selected->kind==AB_VERB_SHAPE)
   lexeme=ab_domain_id(AB_DOMAIN_SHAPE,selected->index,AB_DOMAIN_BLOW,selected->shape_slot);
  if(lexeme)id=melee_grammar(lexeme);
 }
 /* Empty unknown reference is deliberately rejected by Rust: no English fallback. */
 ab_semantic_param_begin(e,"verb","localized_text");
 ab_semantic_json_literal(e,"{\"id\":");ab_semantic_json_string(e,id?id:"");
 if(lexeme && id) {
  ab_semantic_json_literal(e,",\"params\":{\"verb\":{\"type\":\"localized_text\",\"value\":{\"id\":");
  ab_semantic_json_string(e,lexeme);ab_semantic_json_literal(e,"}}}");
 }
 ab_semantic_json_literal(e,"}");ab_semantic_param_end(e);
}
void ab_mon_action_melee(const struct ab_mon_action_actor *target,const char *verb,
 int quality,bool show_damage,int damage,int sound)
{
 struct ab_semantic_event e;const char *id,*quality_id=NULL;
 if(quality>=2 && quality<=6) {
  if(quality==2)quality_id=AB_MON_ACTION_ID("quality.good_hit");
  else if(quality==3)quality_id=AB_MON_ACTION_ID("quality.great_hit");
  else if(quality==4)quality_id=AB_MON_ACTION_ID("quality.superb_hit");
  else if(quality==5)quality_id=AB_MON_ACTION_ID("quality.high_great_hit");
  else if(quality==6)quality_id=AB_MON_ACTION_ID("quality.high_superb_hit");
  id=show_damage?AB_MON_ACTION_ID("melee.critical_damage"):AB_MON_ACTION_ID("melee.critical");
 } else id=show_damage?AB_MON_ACTION_ID("melee.hit_damage"):AB_MON_ACTION_ID("melee.hit");
 begin(&e,id,sound);melee_verb_reference(&e,verb);
 ab_naming_param_snapshot(&e,"target","MonsterDescription",target?&target->snapshot:NULL);
 if(show_damage)integer(&e,"damage",damage);
 if(quality_id)text_reference(&e,"quality",quality_id);
 if(quality<0 || quality>6)e.valid=false;
 ab_semantic_event_emit(&e);
}
#endif
