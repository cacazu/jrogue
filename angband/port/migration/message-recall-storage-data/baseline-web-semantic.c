/* SPDX-License-Identifier: GPL-2.0-only */
#include "web-semantic.h"

void ab_semantic_message(const char *id)
{
#ifdef __EMSCRIPTEN__
	ab_host_message(id, ab_rs_message(id));
#else
	/* Native builds retain the unmodified English message path. */
	(void)id;
#endif
}

#ifdef __EMSCRIPTEN__
#include <stdlib.h>
#include <string.h>
#include <stdio.h>

static bool ab_semantic_reserve(struct ab_semantic_event *event, size_t count)
{
 size_t needed, capacity;
 char *grown;
 if (!event->valid) return false;
 if (count > AB_SEMANTIC_EVENT_MAX_BYTES - event->length) {
  event->valid = false;
  return false;
 }
 needed = event->length + count + 1;
 if (needed <= event->capacity) return true;
 capacity = event->capacity ? event->capacity : 512;
 while (capacity < needed) {
  if (capacity > (AB_SEMANTIC_EVENT_MAX_BYTES + 1) / 2) {
   capacity = AB_SEMANTIC_EVENT_MAX_BYTES + 1;
   break;
  }
  capacity *= 2;
 }
 grown = realloc(event->data, capacity);
 if (!grown) {
  event->valid = false;
  return false;
 }
 event->data = grown;
 event->capacity = capacity;
 return true;
}

static void ab_semantic_append(struct ab_semantic_event *event,
 const char *bytes, size_t count)
{
 if (!ab_semantic_reserve(event, count)) return;
 memcpy(event->data + event->length, bytes, count);
 event->length += count;
 event->data[event->length] = '\0';
}

void ab_semantic_json_literal(struct ab_semantic_event *event, const char *syntax)
{
 if (!syntax) { event->valid = false; return; }
 ab_semantic_append(event, syntax, strlen(syntax));
}

static bool ab_semantic_utf8_valid(const unsigned char *text)
{
 const unsigned char *start = text;
 while (*text) {
  if ((size_t)(text - start) >= AB_SEMANTIC_EVENT_MAX_BYTES) return false;
  unsigned char lead = *text++;
  unsigned int remaining;
  uint32_t scalar;
  uint32_t minimum;
  if (lead < 0x80) continue;
  if (lead >= 0xc2 && lead <= 0xdf) {
   remaining = 1; scalar = lead & 0x1f; minimum = 0x80;
  } else if (lead >= 0xe0 && lead <= 0xef) {
   remaining = 2; scalar = lead & 0x0f; minimum = 0x800;
  } else if (lead >= 0xf0 && lead <= 0xf4) {
   remaining = 3; scalar = lead & 0x07; minimum = 0x10000;
  } else return false;
  while (remaining--) {
   unsigned char next = *text++;
   if (next < 0x80 || next > 0xbf) return false;
   scalar = (scalar << 6) | (next & 0x3f);
  }
  if (scalar < minimum || scalar > 0x10ffff ||
   (scalar >= 0xd800 && scalar <= 0xdfff)) return false;
 }
 return true;
}

void ab_semantic_json_string(struct ab_semantic_event *event, const char *text)
{
 const unsigned char *cursor = (const unsigned char *)(text ? text : "");
 static const char hex[] = "0123456789abcdef";
 if (!ab_semantic_utf8_valid(cursor)) { event->valid = false; return; }
 ab_semantic_json_literal(event, "\"");
 while (event->valid && *cursor) {
  unsigned char c = *cursor++;
  if (c == '"' || c == '\\') {
   char escaped[2] = {'\\', (char)c};
   ab_semantic_append(event, escaped, 2);
  } else if (c < 0x20) {
   char escaped[6] = {'\\', 'u', '0', '0', hex[c >> 4], hex[c & 15]};
   ab_semantic_append(event, escaped, 6);
  } else {
   char raw = (char)c;
   ab_semantic_append(event, &raw, 1);
  }
 }
 ab_semantic_json_literal(event, "\"");
}

void ab_semantic_json_int32(struct ab_semantic_event *event, int32_t value)
{
 char decimal[32];
 int count = snprintf(decimal, sizeof(decimal), "%ld", (long)value);
 if (count < 0 || (size_t)count >= sizeof(decimal)) {
  event->valid = false;
  return;
 }
 ab_semantic_append(event, decimal, (size_t)count);
}

void ab_semantic_json_bool(struct ab_semantic_event *event, bool value)
{
 ab_semantic_json_literal(event, value ? "true" : "false");
}

void ab_semantic_event_begin(struct ab_semantic_event *event, const char *id,
 const char *channel, const char *context, const char *widget,
 int32_t severity, int32_t sound)
{
 memset(event, 0, sizeof(*event));
 event->valid = id && channel && context && widget &&
  (!strcmp(channel, "message") || !strcmp(channel, "ui"));
 event->ui_control = event->valid && !id[0] && !strcmp(channel, "ui");
 ab_semantic_json_literal(event, "{\"schema_version\":1,\"id\":");
 ab_semantic_json_string(event, id);
 ab_semantic_json_literal(event, ",\"channel\":");
 ab_semantic_json_string(event, channel);
 ab_semantic_json_literal(event, ",\"context\":");
 ab_semantic_json_string(event, context);
 ab_semantic_json_literal(event, ",\"widget\":");
 ab_semantic_json_string(event, widget);
 ab_semantic_json_literal(event, ",\"severity\":");
 ab_semantic_json_int32(event, severity);
 ab_semantic_json_literal(event, ",\"sound\":");
 ab_semantic_json_int32(event, sound);
 ab_semantic_json_literal(event, ",\"params\":{");
}

void ab_semantic_param_begin(struct ab_semantic_event *event,
 const char *name, const char *type)
{
 if (event->parameter_open || !name || !type || !name[0] || !type[0]) {
  event->valid = false;
  return;
 }
 if (event->parameter_count) ab_semantic_json_literal(event, ",");
 ab_semantic_json_string(event, name);
 ab_semantic_json_literal(event, ":{\"type\":");
 ab_semantic_json_string(event, type);
 ab_semantic_json_literal(event, ",\"value\":");
 event->parameter_open = true;
 event->parameter_count++;
}

void ab_semantic_param_end(struct ab_semantic_event *event)
{
 if (!event->parameter_open) { event->valid = false; return; }
 ab_semantic_json_literal(event, "}");
 event->parameter_open = false;
}

void ab_semantic_event_discard(struct ab_semantic_event *event)
{
 free(event->data);
 memset(event, 0, sizeof(*event));
}

static void ab_semantic_event_finish(struct ab_semantic_event *event,
 bool control)
{
 const char *localized;
 if (event->parameter_open || (control &&
  !event->ui_control)) event->valid = false;
 ab_semantic_json_literal(event, "}}");
 if (event->valid) {
  localized = control ? "" : ab_rs_review_event((const uint8_t *)event->data,
   (uint32_t)event->length);
  /* Rust failure is explicit: NULL is forwarded without English lookup. */
  ab_host_semantic_event(event->data, (uint32_t)event->length, localized);
 }
 ab_semantic_event_discard(event);
}

void ab_semantic_event_emit(struct ab_semantic_event *event)
{
 ab_semantic_event_finish(event, false);
}

void ab_semantic_event_emit_control(struct ab_semantic_event *event)
{
 ab_semantic_event_finish(event, true);
}
#endif /* __EMSCRIPTEN__ */
