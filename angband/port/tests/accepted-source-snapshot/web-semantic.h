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

#endif /* ANGBAND_WEB_SEMANTIC_H */
