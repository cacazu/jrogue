/* SPDX-License-Identifier: GPL-2.0-only */
#ifndef ANGBAND_WEB_STAT_MESSAGE_H
#define ANGBAND_WEB_STAT_MESSAGE_H
#ifdef __EMSCRIPTEN__
#include "web-naming.h"
void ab_stat_courage(const struct ab_naming_snapshot *actor,
 const struct ab_naming_snapshot *possessive);
void ab_stat_condition(const char *message,int stat,int lexical_role,
 int damage,bool shown,int sound);
void ab_stat_damage(const char *message,int damage,bool shown);
void ab_stat_earthquake(int branch,int damage,bool shown);
void ab_stat_projection(int type,bool blind,int sound);
void ab_stat_summon(bool many,int sound);
void ab_stat_probe(const char *native_buffer,int hp);
unsigned int ab_stat_message_status(void);
#define AB_STAT_MESSAGE(expression) (expression)
#else
#define AB_STAT_MESSAGE(expression) ((void)0)
#endif
#endif
