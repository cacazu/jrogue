/* SPDX-License-Identifier: GPL-2.0-only */
#ifndef ANGBAND_WEB_RECALL_KNOWLEDGE_H
#define ANGBAND_WEB_RECALL_KNOWLEDGE_H
#ifdef __EMSCRIPTEN__
#include <stdint.h>
#include <stdbool.h>
struct monster_race;
struct ab_rk_title { const char *id; char seed[16]; };
bool ab_message_recall_emit(uint16_t age,const char *context,const char *widget);
const char *ab_message_recall_text(uint16_t age);
const char *ab_rk_status_token(int index,const char *id,const char *native);
void ab_rk_kills(int index,int kills);
void ab_rk_monster_name_restore(int index,const struct monster_race *race);
void ab_rk_unique_summary(int known,int slain);
void ab_rk_group_summary(int group,int total);
void ab_rk_title_prepare(const char *native,const char *id,uint32_t seed);
void ab_rk_title_take(const char *native,struct ab_rk_title *out);
void ab_rk_title_emit(const struct ab_rk_title *source);
void ab_rk_knowledge_leave(void);
void ab_rk_recall_one(void);
void ab_rk_recall_begin(void);
void ab_rk_recall_row(uint16_t age,int terminal_row,uint16_t count,int color,int offset);
void ab_rk_recall_header(int first,int last,int total,int offset);
void ab_rk_recall_end(const char *query);
void ab_rk_recall_leave(void);
bool ab_rk_recall_find(uint16_t age,const char *query,bool native_match);
#define AB_RK_TOKEN(i,id,n) ab_rk_status_token((i),(id),(n))
#define AB_RK_KILLS(i,n,call) (ab_rk_kills((i),(n)),(call))
#define AB_RK_UNIQUE_SUMMARY(n,k,call) (ab_rk_unique_summary((n),(k)),(call))
#define AB_RK_GROUP_SUMMARY(g,t,call) (ab_rk_group_summary((g),(t)),(call))
#define AB_RK_HEADER(f,l,n,q,call) (ab_rk_recall_header((f),(l),(n),(q)),(call))
#define AB_RK_FIND(a,q,call) ab_rk_recall_find((a),(q),(call)!=NULL)
#else
#define AB_RK_TOKEN(i,id,n) (n)
#define AB_RK_KILLS(i,n,call) (call)
#define AB_RK_UNIQUE_SUMMARY(n,k,call) (call)
#define AB_RK_GROUP_SUMMARY(g,t,call) (call)
#define AB_RK_HEADER(f,l,n,q,call) (call)
#define AB_RK_FIND(a,q,call) (call)
#endif
#endif
