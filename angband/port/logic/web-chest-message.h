/* SPDX-License-Identifier: GPL-2.0-only */
#ifndef ANGBAND_WEB_CHEST_MESSAGE_H
#define ANGBAND_WEB_CHEST_MESSAGE_H
#ifdef __EMSCRIPTEN__
#include "h-basic.h"
struct chest_trap;
void ab_chest_message_register(const struct chest_trap *head);
void ab_chest_message_reset(void);
void ab_chest_message_selected(const struct chest_trap *trap);
uint32_t ab_chest_message_status(void);
#define AB_CHEST_MESSAGE_CAPTURE(expression) (expression)
#else
#define AB_CHEST_MESSAGE_CAPTURE(expression) ((void)0)
#endif
#endif
