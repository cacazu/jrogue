/* SPDX-License-Identifier: GPL-2.0-only */
#ifndef ANGBAND_WEB_LOOK_TARGET_H
#define ANGBAND_WEB_LOOK_TARGET_H
#ifdef __EMSCRIPTEN__
#include "web-naming.h"
struct ab_look_condition { const char *health; const char *status[8]; bool complete; };
struct ab_look_state {
 int intro, gender, feature, trap, vertical, horizontal, noise, scent, x, y;
 bool south, west, wizard, also, coordinates, terrain, article_an;
 struct ab_look_condition condition;
 struct ab_naming_snapshot monster, object;
};
enum ab_look_content { AB_LOOK_STRANGE, AB_LOOK_MONSTER, AB_LOOK_OBJECT,
 AB_LOOK_CARRY, AB_LOOK_TRAP, AB_LOOK_PILE, AB_LOOK_TERRAIN };
void ab_look_init(struct ab_look_state *state);
void ab_look_release(struct ab_look_state *state);
int ab_look_int(int *destination,int original);
bool ab_look_wizard(struct ab_look_state *state,bool original);
bool ab_look_trap_article(struct ab_look_state *state,bool original);
void ab_look_name(struct ab_look_state *state,const char *buffer,bool object);
void ab_look_coordinate_begin(struct ab_look_state *state,const char *buffer);
void ab_look_coordinate_direction(const char *buffer,bool vertical,bool negative);
int ab_look_coordinate_distance(const char *buffer,bool vertical,int original);
void ab_look_coordinate_end(struct ab_look_state *state);
void ab_look_condition_begin(struct ab_look_state *state,const char *buffer);
void ab_look_condition_health(const char *buffer,bool living,int grade);
void ab_look_condition_status(const char *buffer,int status);
void ab_look_condition_end(struct ab_look_state *state);
void ab_look_feature_begin(struct ab_look_state *state);
void ab_look_feature_selected(int selected);
void ab_look_feature_end(struct ab_look_state *state);
const char *ab_look_selected_feature_id(void);
const char *ab_look_selected_feature_prefix_id(void);
void ab_look_emit(struct ab_look_state *state,enum ab_look_content content,int count);
#define AB_LOOK_COORD_DIRECTION(buffer,vertical,negative) ab_look_coordinate_direction((buffer),(vertical),(negative))
#define AB_LOOK_CONDITION_HEALTH(buffer,living,grade) ab_look_condition_health((buffer),(living),(grade))
#define AB_LOOK_CONDITION_STATUS(buffer,status) ab_look_condition_status((buffer),(status))
#define AB_LOOK_INT(destination,original) ab_look_int((destination),(original))
#define AB_LOOK_WIZARD(state,original) ab_look_wizard((state),(original))
#define AB_LOOK_TRAP_ARTICLE(state,original) ab_look_trap_article((state),(original))
#define AB_LOOK_COORD_DISTANCE(buffer,vertical,original) ab_look_coordinate_distance((buffer),(vertical),(original))
#else
#define AB_LOOK_COORD_DIRECTION(buffer,vertical,negative) ((void)0)
#define AB_LOOK_CONDITION_HEALTH(buffer,living,grade) ((void)0)
#define AB_LOOK_CONDITION_STATUS(buffer,status) ((void)0)
#define AB_LOOK_INT(destination,original) (original)
#define AB_LOOK_WIZARD(state,original) (original)
#define AB_LOOK_TRAP_ARTICLE(state,original) (original)
#define AB_LOOK_COORD_DISTANCE(buffer,vertical,original) (original)
#endif
#endif
