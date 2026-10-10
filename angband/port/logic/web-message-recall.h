/* SPDX-License-Identifier: GPL-2.0-only */
#ifndef ANGBAND_WEB_MESSAGE_RECALL_H
#define ANGBAND_WEB_MESSAGE_RECALL_H
#ifdef __EMSCRIPTEN__
#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>
#ifndef AB_MESSAGE_RECALL_CATALOG_SHA256
#define AB_MESSAGE_RECALL_CATALOG_SHA256 "faab635d405883e6267ca26e11dff406ee7df19ab951c4287d55054e7d807418"
#endif
#define AB_MESSAGE_RECALL_GROUP_LIMIT 64U
#define AB_MESSAGE_RECALL_OWNED_LIMIT (32U * 1024U * 1024U)
struct ab_semantic_event;
struct ab_message_recall_row;
void ab_message_recall_capture_event(const struct ab_semantic_event *event);
void ab_message_recall_capture_static(const char *id);
void ab_message_recall_pending_discard(void);
void ab_message_recall_append(struct ab_message_recall_row **row);
void ab_message_recall_row_free(struct ab_message_recall_row *row);
void ab_message_recall_reset(void);
bool ab_message_recall_emit(uint16_t age,const char *context,const char *widget);
const char *ab_message_recall_text(uint16_t age);
/* Implemented beside the native private message_t queue. */
struct ab_message_recall_row *ab_message_recall_row_at(uint16_t age);
void ab_message_recall_row_replace(uint16_t age,struct ab_message_recall_row *row);
void wr_web_message_recall(void);
int rd_web_message_recall(void);
/* Read-only diagnostics for bounded ownership acceptance. */
size_t ab_message_recall_owned_bytes(void);
unsigned int ab_message_recall_group_count(uint16_t age);
#endif
#endif
