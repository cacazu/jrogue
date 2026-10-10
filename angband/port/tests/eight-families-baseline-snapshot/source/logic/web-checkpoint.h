/**
 * \file web-checkpoint.h
 * \brief Explicit browser command-boundary continuation data.
 *
 * Copyright (c) 2026 Angband browser port contributors
 * SPDX-License-Identifier: GPL-2.0-only
 */
#ifndef WEB_CHECKPOINT_H
#define WEB_CHECKPOINT_H

#include "h-basic.h"

#ifdef __EMSCRIPTEN__
extern bool ab_web_checkpoint_restore_requested;
extern bool ab_web_checkpoint_loaded;

/* Requires the adapter to be waiting in the main human command prompt. */
bool ab_web_checkpoint_can_save(void);
void wr_web_checkpoint(void);
int rd_web_checkpoint(void);
#endif

#endif
