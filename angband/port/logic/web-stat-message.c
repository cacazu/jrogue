/* SPDX-License-Identifier: GPL-2.0-only */
#include "angband.h"
#include "web-stat-message.h"
#ifdef __EMSCRIPTEN__
#include "player.h"
#include "project.h"
#include "web-semantic.h"
#include <string.h>
#include "../migration/stat-message-data/bindings.inc"
static unsigned int stat_message_status;
unsigned int ab_stat_message_status(void) { return stat_message_status; }
static void begin(struct ab_semantic_event *event,const char *id,int sound) {
 ab_semantic_event_begin(event,id,"message","stat-effects","log",0,sound);
}
static void number(struct ab_semantic_event *event,const char *name,int value) {
 ab_semantic_param_begin(event,name,"integer");
 ab_semantic_json_int32(event,value);ab_semantic_param_end(event);
}
static bool reference(struct ab_semantic_event *event,const char *name,const char *id) {
 if(!id){stat_message_status=1;event->valid=false;return false;}
 ab_semantic_param_begin(event,name,"localized_text");
 ab_semantic_json_literal(event,"{\"id\":");ab_semantic_json_string(event,id);
 ab_semantic_json_literal(event,"}");ab_semantic_param_end(event);return true;
}
static void finish(struct ab_semantic_event *event) {
 if(!event->valid){stat_message_status=2;ab_semantic_event_discard(event);return;}
 ab_semantic_event_emit(event);
}
void ab_stat_courage(const struct ab_naming_snapshot *actor,const struct ab_naming_snapshot *possessive) {
 struct ab_semantic_event event;
 if(!actor || !possessive || !actor->json || !possessive->json){stat_message_status=3;return;}
 begin(&event,"game.stat.message.courage",MSG_GENERIC);
 ab_naming_param_snapshot(&event,"actor","MonsterDescription",actor);
 ab_naming_param_snapshot(&event,"possessive","MonsterDescription",possessive);finish(&event);
}
void ab_stat_condition(const char *message,int stat,int lexical_role,int damage,bool shown,int sound) {
 struct ab_semantic_event event;const char *id=NULL;
 if(stat<0 || stat>=STAT_MAX || lexical_role<0 || lexical_role>2){stat_message_status=4;return;}
 if(!strcmp(message,"restore"))id="game.stat.message.restore";
 else if(!strcmp(message,"sustained"))id="game.stat.message.sustained";
 else if(!strcmp(message,"drain"))id=shown?"game.stat.message.drain.with_damage":"game.stat.message.drain";
 else if(!strcmp(message,"lose"))id="game.stat.message.lose";
 else if(!strcmp(message,"gain"))id="game.stat.message.gain";
 else if(!strcmp(message,"project_drain"))id="game.stat.message.project_drain";
 if(!id){stat_message_status=4;return;}
 begin(&event,id,sound);reference(&event,"adjective",ab_stat_adjectives[lexical_role][stat]);
 if(shown)number(&event,"damage",damage);finish(&event);
}
void ab_stat_damage(const char *message,int damage,bool shown) {
 struct ab_semantic_event event;const char *id=NULL;
 if(!strcmp(message,"crushed"))id=shown?"game.stat.damage.crushed.with_damage":"game.stat.damage.crushed";
 else if(!strcmp(message,"uncursing"))id=shown?"game.stat.damage.uncursing.with_damage":"game.stat.damage.uncursing";
 else if(!strcmp(message,"exertion"))id=shown?"game.stat.damage.exertion.with_damage":"game.stat.damage.exertion";
 if(!id){stat_message_status=4;return;}
 begin(&event,id,MSG_GENERIC);if(shown)number(&event,"damage",damage);finish(&event);
}
void ab_stat_earthquake(int branch,int damage,bool shown) {
 struct ab_semantic_event event;
 static const char *const plain[]={"game.stat.damage.quake.empty","game.stat.damage.quake.dodge","game.stat.damage.quake.rubble","game.stat.damage.quake.squeezed"};
 static const char *const amount[]={"game.stat.damage.quake.empty.with_damage","game.stat.damage.quake.dodge.with_damage","game.stat.damage.quake.rubble.with_damage","game.stat.damage.quake.squeezed.with_damage"};
 if(branch<0 || branch>3){stat_message_status=4;return;}
 begin(&event,shown?amount[branch]:plain[branch],MSG_GENERIC);
 if(shown)number(&event,"damage",damage);finish(&event);
}
void ab_stat_projection(int type,bool blind,int sound) {
 struct ab_semantic_event event;
 const char *id=ab_stat_projection_id(type,blind);
 if(!id){stat_message_status=5;return;}
 begin(&event,blind?"game.stat.message.projection_hit":"game.stat.message.breathe",sound);
 reference(&event,"projection",id);finish(&event);
}
void ab_stat_summon(bool many,int sound) {
 struct ab_semantic_event event;
 begin(&event,"game.stat.message.summon",sound);
 reference(&event,"subject",many?"game.stat.summon.many":"game.stat.summon.one");finish(&event);
}
void ab_stat_probe(const char *native_buffer,int hp) {
 struct ab_semantic_event event;
 begin(&event,hp==1?"game.stat.message.probe.one":"game.stat.message.probe.many",MSG_GENERIC);
 ab_semantic_param_begin(&event,"actor","MonsterDescription");
 if(!ab_naming_copy_json_for_buffer(&event,native_buffer,"MonsterDescription"))stat_message_status=3;
 ab_semantic_param_end(&event);number(&event,"hp",hp);finish(&event);
}
#endif
