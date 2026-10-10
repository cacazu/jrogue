/* SPDX-License-Identifier: GPL-2.0-only */
#ifndef ANGBAND_WEB_DOMAIN_TEXT_H
#define ANGBAND_WEB_DOMAIN_TEXT_H
#ifdef __EMSCRIPTEN__
#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>
#include "web-naming.h"
#include "web-ui-text.h"
enum ab_domain_kind { AB_DOMAIN_OBJECT,AB_DOMAIN_ACTIVATION,AB_DOMAIN_TIMED,
 AB_DOMAIN_TRAP,AB_DOMAIN_TERRAIN,AB_DOMAIN_SHAPE,AB_DOMAIN_CURSE,
 AB_DOMAIN_ARTIFACT,AB_DOMAIN_EGO };
enum ab_domain_field { AB_DOMAIN_NAME,AB_DOMAIN_SHORT_NAME,AB_DOMAIN_DESCRIPTION,
 AB_DOMAIN_EFFECT_MESSAGE,AB_DOMAIN_VISIBLE_MESSAGE,AB_DOMAIN_MESSAGE,
 AB_DOMAIN_END,AB_DOMAIN_INCREASE,AB_DOMAIN_DECREASE,AB_DOMAIN_STATUS_NAME,
 AB_DOMAIN_ENTER,AB_DOMAIN_LEAVE,AB_DOMAIN_TRIGGER,AB_DOMAIN_SAVED,
 AB_DOMAIN_FAILED,AB_DOMAIN_EXTRA,AB_DOMAIN_WALK_WARN,AB_DOMAIN_RUN_WARN,
 AB_DOMAIN_DAMAGE,AB_DOMAIN_DEATH,AB_DOMAIN_CONFUSED,AB_DOMAIN_PREFIX,
 AB_DOMAIN_PREPOSITION,AB_DOMAIN_BLOW,AB_DOMAIN_ALT_ACTIVATION };
/* Native identities refer only to immutable parsed fields; no live query. */
const char *ab_domain_id(enum ab_domain_kind kind,int index,
 enum ab_domain_field field,int slot);
const char *ab_domain_source_id(const char *native_source);
const char *ab_domain_curse_name_id(int index);
const char *ab_domain_curse_description_id(int index);
bool ab_domain_register_messages(void);
uint32_t ab_domain_status(void);
void ab_domain_message_pointer(const char *native_source,int sound);
const char *ab_domain_expect_check(const char *native_source);
const char *ab_domain_hurt(const char *native_source,int damage,bool show);
struct ab_domain_custom_capture {
 const char *id;
 unsigned tags;
 bool has_object;
 uint8_t number;
 int sound;
 struct ab_naming_snapshot name,kind;
};
void ab_domain_custom_begin(struct ab_domain_custom_capture *capture,
 const char *native_source,bool has_object,int number,int sound);
void ab_domain_custom_snapshot(struct ab_domain_custom_capture *capture,
 const char *native_buffer,bool kind);
void ab_domain_custom_hands(struct ab_domain_custom_capture *capture,bool kind);
void ab_domain_custom_finish(struct ab_domain_custom_capture *capture);
/* Source-ordered public info builder projection. No dump/spoiler projection. */
void ab_domain_info_begin(const char *context);
void *ab_domain_info_end_result(void *native_result);
const char *ab_domain_info_context(void);
void ab_domain_info_emit(const char *id,const struct ab_ui_param *params,size_t count);
void ab_domain_info_selected(enum ab_domain_kind kind,int index,
 enum ab_domain_field field,int slot);
void ab_domain_curse_info(int curse_index,bool permanent);
void ab_domain_info_commit(void);
void ab_domain_info_close(void);
void ab_domain_info_tag(const void *native_textblock,const char *context);
void ab_domain_info_display_end(const void *native_textblock);
void ab_domain_info_forget(const void *native_textblock);
#define AB_DOMAIN_CAPTURE(expression) (expression)
#define AB_DOMAIN_RESULT(expression) ab_domain_info_end_result(expression)
#define AB_DOMAIN_CHECK(expression) ab_domain_expect_check(expression)
#define AB_DOMAIN_HURT(expression,damage,show) ab_domain_hurt((expression),(damage),(show))
#else
#define AB_DOMAIN_CAPTURE(expression) ((void)0)
#define AB_DOMAIN_RESULT(expression) (expression)
#define AB_DOMAIN_CHECK(expression) (expression)
#define AB_DOMAIN_HURT(expression,damage,show) (expression)
#endif
#endif
