/* SPDX-License-Identifier: GPL-3.0-or-later */
#ifndef TOME_WEB_CHECKPOINT_GATE_H
#define TOME_WEB_CHECKPOINT_GATE_H
#include "lua.h"
enum { TOME_CHECKPOINT_BASELINE_SAVE = 1, TOME_CHECKPOINT_STRICT_SAVE = 2,
       TOME_CHECKPOINT_BASELINE_RESUME = 3, TOME_CHECKPOINT_STRICT_RESUME = 4 };
/* Single browser-thread export gate, not a worker barrier or purity proof.
 * All external command/frame exports and application scheduling must honor it.
 * Internal original screenshot/display calls remain allowed in baseline mode.
 */
int tome_web_checkpoint_gate_install(lua_State *L);
int tome_web_checkpoint_busy(void);
int tome_web_checkpoint_mode(void);
int tome_web_checkpoint_held(const char *generation);
#endif
