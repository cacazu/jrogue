/* SPDX-License-Identifier: GPL-2.0-only */
#ifndef ANGBAND_WEB_GAME_HISTORY_H
#define ANGBAND_WEB_GAME_HISTORY_H
#ifdef __EMSCRIPTEN__
#include "h-basic.h"
struct player;
struct history_info;
/* These copy only already-selected facts, never perform descriptions or RNG. */
void ab_game_history_prepare_monster(const char *name_buffer,const char *event_buffer);
void ab_game_history_prepare_level(int level,const char *event_buffer);
void ab_game_history_prepare_note(int form,const char *username,const char *body,const char *event_buffer);
void ab_game_history_capture_artifact_name(const char *name_buffer);
void ab_game_history_prepare_artifact(bool missed,const char *event_buffer);
void ab_game_history_prepare_birth(const char *event_buffer);
void ab_game_history_added(struct player *p,size_t ordinal,const struct history_info *row,const char *event_buffer);
void ab_game_history_clear(struct player *p);
void ab_game_history_project_row(const char *context,const char *widget,const struct history_info *row,size_t ordinal);
void ab_game_history_export_header(void);
void wr_web_game_history(void);
int rd_web_game_history(void);
uint32_t ab_game_history_status(void);
#define AB_GAME_HISTORY_CAPTURE(expression) (expression)
#define AB_GAME_HISTORY_BEFORE(expression,call) ((expression),(call))
#else
#define AB_GAME_HISTORY_CAPTURE(expression) ((void)0)
#define AB_GAME_HISTORY_BEFORE(expression,call) (call)
#endif
#endif
