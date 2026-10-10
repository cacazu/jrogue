/* SPDX-License-Identifier: GPL-2.0-only */
#ifndef ANGBAND_WEB_DEATH_CAUSE_H
#define ANGBAND_WEB_DEATH_CAUSE_H
#ifdef __EMSCRIPTEN__
#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>
struct feature;
struct trap_kind;
struct chest_trap;
struct effect;
struct high_score;
struct ab_dc_capture { char *json; uint32_t length; };
void ab_dc_capture_release(struct ab_dc_capture *capture);
void ab_dc_capture_monster(struct ab_dc_capture *capture,const char *buffer);
void ab_dc_capture_object(struct ab_dc_capture *capture,const char *buffer);
void ab_dc_capture_trap(struct ab_dc_capture *capture,const struct trap_kind *trap);
void ab_dc_capture_chest(struct ab_dc_capture *capture,const struct chest_trap *trap);
void ab_dc_capture_source(struct ab_dc_capture *capture,const char *message);
void ab_dc_capture_fixed(struct ab_dc_capture *capture,const char *id);
void ab_dc_push(const struct ab_dc_capture *capture,const char *native_buffer);
void ab_dc_push_fixed(const char *id);
void ab_dc_pop(void);
void ab_dc_commit(const char *native_buffer);
void ab_dc_set_fixed(const char *id);
void ab_dc_clear(void);
const struct feature *ab_dc_terrain(const struct feature *feature);
bool ab_dc_register_source_message(const char *source_address,const char *id);
void ab_dc_unregister_source_message(const char *source_address);
const char *ab_dc_source_message_id(const char *source_address);
void ab_dc_register_shape_effect(const char *shape,const struct effect *effect);
void ab_dc_register_class_effect(const char *class_name,const char *spell,const struct effect *effect);
void ab_dc_registry_reset(void);
void ab_dc_emit_current(const char *context,const char *widget,const char *id);
void ab_dc_emit_score(const struct high_score *score,int index,bool town,int depth);
void ab_dc_score_enter(const struct high_score *entry,const struct high_score *scores,size_t count);
void ab_dc_score_preview(const struct high_score *entry);
const char *ab_dc_date(const char *native_date);
#define AB_DC_AROUND(c,b,call) (ab_dc_push((c),(b)),(call),ab_dc_pop())
#define AB_DC_FIXED(i,call) (ab_dc_push_fixed((i)),(call),ab_dc_pop())
#define AB_DC_TERRAIN(call) (ab_dc_push_fixed(NULL),(call),ab_dc_pop())
#define AB_DC_FEATURE(call) ab_dc_terrain(call)
#define AB_DC_SCORE_LINE(s,i,t,d,call) (ab_dc_emit_score((s),(i),(t),(d)),(call))
#define AB_DC_DATE(call) ab_dc_date(call)
#define AB_DC_STATUS(i,call) ((call),ab_dc_set_fixed(i))
#else
#define AB_DC_AROUND(c,b,call) call
#define AB_DC_FIXED(i,call) call
#define AB_DC_TERRAIN(call) call
#define AB_DC_FEATURE(call) call
#define AB_DC_SCORE_LINE(s,i,t,d,call) call
#define AB_DC_DATE(call) call
#define AB_DC_STATUS(i,call) call
#endif
#endif
