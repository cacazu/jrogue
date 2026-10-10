/* SPDX-License-Identifier: GPL-2.0-only */
/* Pure, source-identified help capture. No file parsing, simulation or RNG here. */
#ifdef __EMSCRIPTEN__
#include "angband.h"
#include "web-help-text.h"
#include "web-ui-text.h"
#include "web-semantic.h"
#include "web-help-data.h"
#include "ui-input.h"

extern int32_t ab_rs_help_match(uint32_t file, uint32_t logical_line,
 const uint8_t *query, uint32_t query_length, uint32_t case_sensitive);
static bool help_editor_active;

void ab_help_init(struct ab_help_view *view) {
 if (!view) return;
 view->file_index = -1;
 view->first_line = 0;
 view->page_capacity = 0;
 view->page_open = false;
}

void ab_help_bundled(struct ab_help_view *view, const char *filename) {
 size_t i;
 if (!view || !filename) return;
 view->file_index = -1;
 for (i = 0; i < N_ELEMENTS(ab_help_files); i++) {
  if (!strcmp(ab_help_files[i].filename, filename)) {
   view->file_index = (int)i;
   break;
  }
 }
}

void ab_help_verify_size(struct ab_help_view *view, int logical_count) {
 if (!view || view->file_index < 0) return;
 if (logical_count < 0 || (size_t)logical_count != ab_help_files[view->file_index].count)
  view->file_index = -1;
}

static void help_control(const char *widget) {
 struct ab_semantic_event event;
 ab_semantic_event_begin(&event, "", "ui", "help", widget, 0, -1);
 ab_semantic_event_emit_control(&event);
}

static void help_row_key(int row, uint32_t key) {
 char widget[64];
 struct ab_semantic_event event;
 strnfmt(widget, sizeof(widget), "__row:%d", row);
 ab_semantic_event_begin(&event, "", "ui", "help", widget, 0, -1);
 if (key) {
  ab_semantic_param_begin(&event, "activation_key", "integer");
  ab_semantic_json_int32(&event, (int32_t)key);
  ab_semantic_param_end(&event);
 }
 ab_semantic_event_emit_control(&event);
}

static void help_page_begin(struct ab_help_view *view) {
 if (!view || view->page_open) return;
 ab_ui_scope_begin("help", true);
 view->page_open = true;
 if (view->file_index < 0) {
  /* Replacement begins first: old bundled rows cannot leak into an external file. */
  help_control("__unsupported:document");
 }
}

void ab_help_row(struct ab_help_view *view, int logical_line, int visible_row) {
 char widget[64];
 const struct ab_help_file_data *file;
 if (!view || logical_line < 0 || visible_row < 0 || visible_row > 511) return;
 help_page_begin(view);
 if (view->file_index < 0) return;
 file = &ab_help_files[view->file_index];
 if ((size_t)logical_line >= file->count) {
  /* Capture rejects a source-identity mismatch instead of guessing from buf. */
  view->file_index = -1;
  help_control("__unsupported:document");
  return;
 }
 strnfmt(widget, sizeof(widget), "row:%d", visible_row);
 ab_ui_static("help", widget, file->ids[logical_line]);
 if (file->activation_keys[logical_line]) help_row_key(visible_row, file->activation_keys[logical_line]);
}

static void help_control_integer(struct ab_semantic_event *event, const char *name, int value) {
 ab_semantic_param_begin(event, name, "integer");
 ab_semantic_json_int32(event, (int32_t)value);
 ab_semantic_param_end(event);
}
static void help_control_string(struct ab_semantic_event *event, const char *name,
 const char *type, const char *value) {
 ab_semantic_param_begin(event, name, type);
 ab_semantic_json_string(event, value ? value : "");
 ab_semantic_param_end(event);
}
static void help_control_boolean(struct ab_semantic_event *event, const char *name, bool value) {
 ab_semantic_param_begin(event, name, "boolean");
 ab_semantic_json_bool(event, value);
 ab_semantic_param_end(event);
}

void ab_help_title(struct ab_help_view *view, const char *build_identity,
 int first, int page_capacity, int total, bool menu, bool case_sensitive,
 const char *find_query, const char *highlight_query) {
 struct ab_semantic_event event;
 struct ab_ui_param caption[1], params[5];
 const char *filename;
 size_t action;
 if (!view) return;
 help_page_begin(view);
 if (view->file_index < 0) return;
 filename = ab_help_files[view->file_index].filename;
 view->first_line = first;
 view->page_capacity = page_capacity;
 caption[0] = AB_UI_OPAQUE("filename", "opaque_file_path", filename);
 params[0] = AB_UI_OPAQUE("build", "opaque_build_identity", build_identity);
 params[1] = AB_UI_NESTED("caption", "help.caption.file", caption, 1);
 params[2] = AB_UI_INT("first", first);
 params[3] = AB_UI_INT("last", first + page_capacity);
 params[4] = AB_UI_INT("total", total);
 ab_ui_emit("help", "title", "help.title", params, N_ELEMENTS(params));
 /* Application facts stay outside the reviewed formatter and carry no English. */
 ab_semantic_event_begin(&event, "", "ui", "help", "__help_page", 0, -1);
 help_control_string(&event, "filename", "opaque_file_path", filename);
 help_control_integer(&event, "first", first);
 help_control_integer(&event, "total", total);
 help_control_integer(&event, "page_capacity", page_capacity);
 help_control_boolean(&event, "menu", menu);
 help_control_boolean(&event, "case_sensitive", case_sensitive);
 help_control_string(&event, "find_query", "verbatim_user_text", find_query);
 help_control_string(&event, "highlight_query", "verbatim_user_text", highlight_query);
 ab_semantic_event_emit_control(&event);
 /* New reviewed mobile controls dispatch only original implemented native keys. */
 for (action = 0; action < N_ELEMENTS(ab_help_actions); action++) {
  char widget[64];
  int row = (int)ab_help_files[view->file_index].count + (int)action;
  strnfmt(widget, sizeof(widget), "row:%d", row);
  ab_ui_static("help", widget, ab_help_actions[action].id);
  help_row_key(row, ab_help_actions[action].activation_key);
 }
}

void ab_help_prompt(struct ab_help_view *view, const char *id) {
 if (!view || view->file_index < 0 || !id) return;
 ab_ui_static("help", "prompt", id);
}

void ab_help_page_finish(struct ab_help_view *view) {
 if (!view || !view->page_open) return;
 ab_ui_scope_end();
 view->page_open = false;
}

void ab_help_leave(struct ab_help_view *view) {
 ab_help_page_finish(view);
 ab_ui_reset("help");
}

void ab_help_cannot_open(const char *filename) {
 struct ab_ui_param param = AB_UI_OPAQUE("filename", "opaque_file_path", filename);
 ab_ui_scope_begin("help", true);
 ab_ui_emit("help", "error", "help.error.cannot_open", &param, 1);
 ab_ui_scope_end();
}

int32_t ab_help_matches(const struct ab_help_view *view, int logical_line,
 const char *query, bool case_sensitive) {
 size_t length;
 if (!view || view->file_index < 0) return 2;
 if (logical_line < 0 || !query) return -201;
 length = strlen(query);
 if (length > 79) return -202;
 return ab_rs_help_match((uint32_t)view->file_index, (uint32_t)logical_line,
  (const uint8_t *)query, (uint32_t)length, case_sensitive ? 1U : 0U);
}

static bool help_keypress(char *buffer, size_t buffer_size, size_t *cursor,
 size_t *length, struct keypress key, bool first_time) {
 /* The shared default editor delegates one key to pure Rust, including DELETE. */
 bool done = askfor_aux_keypress(buffer, buffer_size, cursor, length, key, first_time);
 if (help_editor_active) ab_ui_input("query", buffer, "verbatim_user_text");
 return done;
}

bool ab_help_askfor(struct ab_help_view *view, char *buffer, size_t buffer_size) {
 bool accepted;
 bool captured = view && view->file_index >= 0;
 if (captured) {
  size_t action;
  const struct ab_help_file_data *file = &ab_help_files[view->file_index];
  ab_ui_scope_begin("help", false);
  /* Disable page/menu actions while their native keys mean editor input. */
  for (action = 0; action < N_ELEMENTS(ab_help_actions); action++) {
   char widget[64];
   int row = (int)file->count + (int)action;
   strnfmt(widget, sizeof(widget), "row:%d", row);
   ab_ui_clear(widget);
   strnfmt(widget, sizeof(widget), "__row:%d", row);
   ab_ui_clear(widget);
  }
  for (action = 0; action < file->count; action++) {
   int visible = (int)action - view->first_line;
   if (file->activation_keys[action] && visible >= 0 && visible < view->page_capacity)
    help_row_key(visible, 0);
  }
  ab_ui_input("query", buffer, "verbatim_user_text");
  /* Prompt and current opaque draft are visible before the editor waits. */
  ab_ui_scope_commit();
 }
 help_editor_active = captured;
 accepted = askfor_aux(buffer, buffer_size, help_keypress);
 help_editor_active = false;
 if (captured) {
  ab_ui_clear("query");
  ab_ui_scope_end();
 }
 return accepted;
}
#endif /* __EMSCRIPTEN__ */
