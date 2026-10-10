/* SPDX-License-Identifier: GPL-3.0-or-later */
#ifndef TOME_ORIGINAL_SYSTEM_DISPATCH_H
#define TOME_ORIGINAL_SYSTEM_DISPATCH_H
#include <SDL.h>
/* Generated from the exact original main loop switch. Includes its existing
 * resize/focus/audio/timer/redraw effects; this is never a read-only view. */
void tome_main_dispatch_original_event(SDL_Event *event);
int tome_main_original_reboot_pending(void);
int tome_main_physical_prepare_initial_boot(void);
#endif
