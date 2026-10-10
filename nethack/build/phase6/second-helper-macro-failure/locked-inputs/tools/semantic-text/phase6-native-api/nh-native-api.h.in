/* Added 2026-10-02: proposal-only native delivery observations; NGPL. */
#ifndef JROGUE_NH_NATIVE_API_H
#define JROGUE_NH_NATIVE_API_H
#include "nh-semantic.h"

/* All labels below come from the original selected literal branch. */
struct nh_native_text_value { const char *original, *event; };
struct nh_native_text_value nh_native_value(const char *, const char *);
void nh_native_config_plain(struct nh_text_scope *, const char *,
                            struct nh_native_text_value, const char *,
                            struct nh_native_text_value);
void nh_native_config_framed(struct nh_text_scope *, const char *,
                             struct nh_native_text_value, const char *, int,
                             const char *, struct nh_native_text_value);

/* Internal C copy only; never exported or delivered before actual output. */
char *nh_text_native_event_copy(const struct nh_text_scope *);
struct nh_text_scope *nh_text_native_claim(enum nh_text_kind, const char *, const char *);
struct nh_native_log_capture_state { struct nh_text_scope *owner; const char *expected_text; };
struct nh_native_log_capture_state nh_native_log_capture(struct nh_text_scope *, const char *);
void nh_native_log_restore(struct nh_native_log_capture_state);
void nh_native_log_bind(const void *, const char *);
void nh_native_log_forget(const void *);
struct nh_text_scope *nh_native_log_line(const void *, const char *, long,
                                        int, const char *);
#endif
