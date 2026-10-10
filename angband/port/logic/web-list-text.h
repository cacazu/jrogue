/* SPDX-License-Identifier: GPL-2.0-only */
#ifndef ANGBAND_WEB_LIST_TEXT_H
#define ANGBAND_WEB_LIST_TEXT_H
#include "angband.h"
enum ab_list_kind { AB_LIST_MONSTER, AB_LIST_OBJECT };
#ifdef __EMSCRIPTEN__
#include "web-naming.h"
struct ab_list_row { struct ab_naming_snapshot snapshot; int x,y,sleep; bool north,west,location; };
void ab_list_begin(enum ab_list_kind kind);
void ab_list_end(enum ab_list_kind kind);
void ab_list_format_end(enum ab_list_kind kind,bool real_textblock,bool notice_guard);
void ab_list_reset(enum ab_list_kind kind);
int ab_list_int(int *out,int original);
bool ab_list_bool(bool *out,bool original);
void ab_list_location(struct ab_list_row *row);
void ab_list_sleep(struct ab_list_row *row,int source_role);
void ab_list_monster_name(struct ab_list_row *row,const char *original_buffer);
void ab_list_object_name_begin(struct ab_list_row *row);
void ab_list_object_name_capture(const char *original_buffer);
void ab_list_object_name_end(struct ab_list_row *row);
void ab_list_row_release(struct ab_list_row *row);
void ab_list_header(enum ab_list_kind kind,int section,int count,bool others,bool period);
void ab_list_row_emit(enum ab_list_kind kind,const struct ab_list_row *row,int asleep);
void ab_list_omitted(enum ab_list_kind kind,int original_remaining);
void ab_list_hallucination(void);
void ab_list_sort_prompt(bool currently_enabled);
#define AB_LIST_INT(p,v) ab_list_int((p),(v))
#define AB_LIST_BOOL(p,v) ab_list_bool((p),(v))
#define AB_LIST_LOCATION(r) ab_list_location(r)
#define AB_LIST_SLEEP(r,s) ab_list_sleep((r),(s))
#define AB_LIST_HEADER(k,s,c,o,p) ab_list_header((k),(s),(c),(o),(p))
#define AB_LIST_OMITTED(k,n) ab_list_omitted((k),(n))
#define AB_LIST_HALLUCINATION() ab_list_hallucination()
#define AB_LIST_FORMAT_END(k,t,g) (ab_list_format_end((k),(t)!=NULL,(g)))
#else
#define AB_LIST_INT(p,v) (v)
#define AB_LIST_BOOL(p,v) (v)
#define AB_LIST_LOCATION(r) ((void)0)
#define AB_LIST_SLEEP(r,s) ((void)0)
#define AB_LIST_HEADER(k,s,c,o,p) ((void)0)
#define AB_LIST_OMITTED(k,n) ((void)0)
#define AB_LIST_HALLUCINATION() ((void)0)
#define AB_LIST_FORMAT_END(k,t,g) ((void)0)
#endif
#endif
