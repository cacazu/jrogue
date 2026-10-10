/* SPDX-License-Identifier: GPL-3.0-or-later */
#ifndef TOME_GAME_FLOW_NATIVE_H
#define TOME_GAME_FLOW_NATIVE_H
/* Caller passes a trusted UTF8 Lua module before original loader/start. */
int tome_game_flow_install(const char *source,unsigned int length);
/* Explicit post-birth diagnostic preparation, never called by a view. */
int tome_game_flow_attach_hooks(void);
/* Borrowed buffer copied before any subsequent bridge call; no free. */
const char *tome_game_flow_snapshot_json(unsigned int target_uid);
/* Semantic ID from last failed bridge action, read only after failure. */
const char *tome_game_flow_error(void);
#endif