/* SPDX-License-Identifier: GPL-2.0-only */
#ifndef ANGBAND_WEB_REALM_TEXT_H
#define ANGBAND_WEB_REALM_TEXT_H
#ifdef __EMSCRIPTEN__
#include <stdbool.h>
struct player;
struct class_spell;
struct magic_realm;
/* These are owned selected semantic identities, never a live realm list. */
#define AB_REALM_LIST_MAX 16U
struct ab_realm_list_snapshot {
 const char *ids[AB_REALM_LIST_MAX];
 unsigned count;
 bool valid;
};
void ab_realm_cast_warning(const struct magic_realm *realm);
void ab_realm_book_no_learnable(const struct magic_realm *realm);
void ab_realm_known_spell(const struct player *p,const struct class_spell *spell,
 const char *id,int type);
void ab_realm_more_single(const struct magic_realm *realm,int count);
void ab_realm_capture_list(struct ab_realm_list_snapshot *snapshot,
 const struct magic_realm *selected,bool plural);
void ab_realm_more_list(const struct ab_realm_list_snapshot *snapshot,int count);
void ab_realm_none_remaining(const struct ab_realm_list_snapshot *snapshot);
#endif
#endif
