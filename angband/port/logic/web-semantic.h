/* SPDX-License-Identifier: GPL-2.0-only */
/**
 * Semantic notifications for the incremental Angband browser port.
 *
 * Only complete, static messages with no printf arguments use these macros.
 * The original English message and, for AB_MSGT, sound type are preserved.
 * A browser callback receives the semantic ID before the original message can
 * yield for a More prompt. The callback must not change simulation state or RNG.
 * Dynamic descriptors and parameterized messages are not covered by this API.
 */
#ifndef ANGBAND_WEB_SEMANTIC_H
#define ANGBAND_WEB_SEMANTIC_H

#include "message.h"

#ifdef __EMSCRIPTEN__
/* Implemented by the browser's Emscripten JavaScript library. */
extern void ab_host_message(const char *id, const char *localized);
extern const char *ab_rs_message(const char *id);
#endif

void ab_semantic_message(const char *id);

#define AB_MSG(id, english) do { \
	ab_semantic_message(id); \
	msg(english); \
} while (0)

#define AB_MSGT(id, type, english) do { \
	ab_semantic_message(id); \
	msgt(type, english); \
} while (0)


#ifdef __EMSCRIPTEN__
#include <stddef.h>
#include <stdint.h>
#include <stdbool.h>

/* Owned, bounded UTF-8 JSON. All strings are copied before callbacks. */
#define AB_SEMANTIC_EVENT_MAX_BYTES (128U * 1024U)
struct ab_semantic_event {
 char *data;
 size_t length;
 size_t capacity;
 unsigned int parameter_count;
 bool valid;
 bool parameter_open;
 bool ui_control;/* AB_MESSAGE_RECALL_BEGIN */
 bool recall_message;
 size_t recall_id_offset,recall_id_length,recall_params_offset;
/* AB_MESSAGE_RECALL_END */
};

extern const char *ab_rs_review_event(const uint8_t *json, uint32_t length);
extern void ab_host_semantic_event(const char *json, uint32_t length,
 const char *localized);

void ab_semantic_event_begin(struct ab_semantic_event *event, const char *id,
 const char *channel, const char *context, const char *widget,
 int32_t severity, int32_t sound);
void ab_semantic_param_begin(struct ab_semantic_event *event,
 const char *name, const char *type);
void ab_semantic_param_end(struct ab_semantic_event *event);
/* Trusted JSON syntax/controlled literals only; opaque text uses json_string. */
void ab_semantic_json_literal(struct ab_semantic_event *event, const char *syntax);
void ab_semantic_json_string(struct ab_semantic_event *event, const char *text);
void ab_semantic_json_int32(struct ab_semantic_event *event, int32_t value);
void ab_semantic_json_bool(struct ab_semantic_event *event, bool value);
void ab_semantic_event_emit(struct ab_semantic_event *event);
/* id="", channel="ui"; typed UI controls skip Rust, localized="". */
void ab_semantic_event_emit_control(struct ab_semantic_event *event);
void ab_semantic_event_discard(struct ab_semantic_event *event);
#endif /* __EMSCRIPTEN__ */

#endif /* ANGBAND_WEB_SEMANTIC_H */
