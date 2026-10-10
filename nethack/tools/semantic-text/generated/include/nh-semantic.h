/* Added 2026-10-02: source-selected semantic observations for NetHack 5.0.
 * Integration code distributed under the NGPL; preserve upstream notices.
 * This bridge owns only presentation memory. It never calls name producers,
 * game commands, rendering, RNG, or locale-dependent gameplay functions.
 */
#ifndef JROGUE_NH_SEMANTIC_H
#define JROGUE_NH_SEMANTIC_H
#include <stddef.h>
#include <stdint.h>

enum nh_text_kind { NH_TEXT_MESSAGE, NH_TEXT_MENU_ROW, NH_TEXT_PUTSTR,
                    NH_TEXT_MENU_END, NH_TEXT_QUESTION, NH_TEXT_RAW,
                    NH_TEXT_DEFERRED };
enum nh_text_helper { NH_TEXT_PLAIN, NH_TEXT_FEEL, NH_TEXT_HEAR,
                      NH_TEXT_SEE, NH_TEXT_QUOTED };
enum nh_text_argument_kind { NH_TEXT_TEXT, NH_TEXT_INTEGER, NH_TEXT_UNSIGNED };
struct nh_text_descriptor {
    const char *id;
    const char *api;
    enum nh_text_kind kind;
    enum nh_text_helper helper;
};
struct nh_text_argument {
    const char *name;
    enum nh_text_argument_kind kind;
    const char *text;
    int64_t integer;
    const char *event_json; /* owned nested public-name event; text stays original English */
};
struct nh_text_quest_context {
    uint32_t sequence, line_index, line_count, item_index;
    int final, capture_complete, window;
    const char *section, *message_id, *field, *source_template, *decoded_line;
};
struct nh_text_scope;

struct nh_text_scope *nh_text_begin(const struct nh_text_descriptor *,
                                  const struct nh_text_argument *, size_t, int);
void nh_text_end(struct nh_text_scope *);
const char *nh_text_captured_text(const struct nh_text_scope *, size_t,
                                  const char *);
struct nh_text_scope *nh_text_claim(enum nh_text_kind);
void nh_text_cancel_pending(void);
void nh_text_forward(struct nh_text_scope *);
struct nh_text_scope *nh_text_emit(struct nh_text_scope *);
void nh_text_location(struct nh_text_scope *, const char *);
void nh_text_truncated(struct nh_text_scope *);
void nh_text_quest(struct nh_text_scope *, const struct nh_text_quest_context *);
const char *nh_abi_semantic_event(const char *, int);
#endif
