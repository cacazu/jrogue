/* SPDX-License-Identifier: GPL-2.0-only */
/* Source-bound browser help projections; native English terminal is unchanged. */
#ifndef ANGBAND_WEB_HELP_TEXT_H
#define ANGBAND_WEB_HELP_TEXT_H
#ifdef __EMSCRIPTEN__
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
struct ab_help_view {
 int file_index;
 int first_line;
 int page_capacity;
 bool page_open;
};
void ab_help_init(struct ab_help_view *view);
/* Called only for the original ANGBAND_DIR_HELP fallback, not arbitrary files. */
void ab_help_bundled(struct ab_help_view *view, const char *canonical_filename);
void ab_help_verify_size(struct ab_help_view *view, int logical_count);
void ab_help_row(struct ab_help_view *view, int logical_line, int visible_row);
void ab_help_title(struct ab_help_view *view, const char *build_identity,
 int first, int page_capacity, int total, bool menu, bool case_sensitive,
 const char *find_query, const char *highlight_query);
void ab_help_prompt(struct ab_help_view *view, const char *reviewed_id);
/* Must flush the visible page before native inkey()/askfor_aux() can wait. */
void ab_help_page_finish(struct ab_help_view *view);
void ab_help_leave(struct ab_help_view *view);
void ab_help_cannot_open(const char *opaque_filename);
/* 0/1 localized result, 2 original native fallback, negative invalid capture. */
int32_t ab_help_matches(const struct ab_help_view *view, int logical_line,
 const char *opaque_query, bool case_sensitive);
/* Original UTF-8 editor/keypress handling plus pure committed draft callbacks. */
bool ab_help_askfor(struct ab_help_view *view, char *buffer, size_t buffer_size);
#endif
#endif
