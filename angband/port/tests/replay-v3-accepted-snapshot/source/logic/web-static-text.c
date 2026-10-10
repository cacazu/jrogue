/* SPDX-License-Identifier: GPL-2.0-only */
#include "angband.h"
#include "web-static-text.h"
#include "web-semantic.h"
#ifdef __EMSCRIPTEN__
void ab_static_message(const char *id, int sound)
{
    struct ab_semantic_event event;
    ab_semantic_event_begin(&event, id, "message", "command", "log", 0, sound);
    ab_semantic_event_emit(&event);
}
#endif
