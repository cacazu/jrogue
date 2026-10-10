/* GPL-2.0-only. Source-identified biography provenance, browser only. */
#ifndef ANGBAND_WEB_HISTORY_H
#define ANGBAND_WEB_HISTORY_H
#include "h-basic.h"
#ifdef __EMSCRIPTEN__
#define AB_HISTORY_GRAMMAR_VERSION 1U
#define AB_HISTORY_MAX_CHOICES 32U
#define AB_HISTORY_MAX_NATIVE_BYTES 65535U
enum ab_history_origin { AB_HISTORY_UNKNOWN = 0, AB_HISTORY_GENERATED = 1, AB_HISTORY_AUTHORED = 2 };
struct ab_history_choice { uint16_t chart; uint16_t cutoff; };
struct ab_history_snapshot {
 uint8_t origin;
 uint16_t start_chart;
 uint16_t count;
 uint32_t native_length;
 uint32_t native_hash;
 struct ab_history_choice choices[AB_HISTORY_MAX_CHOICES];
};
struct history_chart;
struct history_entry;
struct command;
/* Capture the original already-selected entry. None of these APIs rolls RNG. */
void ab_history_capture_begin(struct ab_history_snapshot *out, const struct history_chart *start);
void ab_history_capture_choice(struct ab_history_snapshot *out, const struct history_chart *chart, const struct history_entry *entry);
void ab_history_capture_finish(struct ab_history_snapshot *out, const char *native_text);
void ab_history_last_generation(struct ab_history_snapshot *out);
void ab_history_apply_last_generation(const char *native_text);
/* POD copies move alongside native roller/quickstart history copies. */
void ab_history_current_snapshot(struct ab_history_snapshot *out);
void ab_history_set_current(const struct ab_history_snapshot *snapshot, const char *native_text);
void ab_history_reset_current(void);
void ab_history_reset_all(void);
bool ab_history_snapshot_matches(const struct ab_history_snapshot *snapshot, const char *native_text);
/* Tags bind to the actual command slot and its owned string allocation. */
void ab_history_tag_generated(const struct command *cmd, const struct ab_history_snapshot *source);
void ab_history_tag_edit(const struct command *cmd, const char *edited, const char *previous);
void ab_history_apply_command(const struct command *cmd, const char *native_text);
/* Separate optional save block. Absent legacy blocks retain UNKNOWN origin. */
void wr_web_biography(void);
int rd_web_biography(void);
const char *ab_history_catalog_sha256(void);
#endif
#endif
