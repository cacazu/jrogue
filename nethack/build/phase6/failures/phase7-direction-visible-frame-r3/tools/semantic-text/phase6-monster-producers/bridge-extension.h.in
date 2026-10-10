/* Added 2026-10-02: isolated public monster observations; NGPL.
 * Proposal only: append the C implementation after the Phase5 registry.
 * No application, compiler, native execution or ABI deployment is implied. */
#ifndef JROGUE_NH_SEMANTIC_MONSTER_COMPOSITE_H
#define JROGUE_NH_SEMANTIC_MONSTER_COMPOSITE_H
#include "nh-semantic-name-grammar.h"

struct nh_monster_composite {
    struct nh_name_grammar_snapshot adjective;
    char prefix[BUFSZ];
    char body_original[BUFSZ];
    char body_event[NH_NAME_GRAMMAR_JSON];
    const char *leaf_id, *leaf_original;
    int prefix_valid, body_valid, has_adjective, invisible, saddled;
};
void nh_text_monster_begin(struct nh_monster_composite *, const char *);
void nh_text_monster_prefix(struct nh_monster_composite *, const char *, int, int);
const char *nh_text_monster_leaf(struct nh_monster_composite *, const char *, const char *);
void nh_text_monster_leaf_finish(struct nh_monster_composite *, const char *);
void nh_text_monster_label(struct nh_monster_composite *, const char *,
                           const struct permonst *, const char *);
/* Reserved for a future original creator-certified proper-name producer.
 * x_monnam consumers do not certify an arbitrary MGIVENNAME as proper text. */
void nh_text_monster_proper(struct nh_monster_composite *, const char *, const char *);
void nh_text_monster_called(struct nh_monster_composite *, const char *,
                            const struct permonst *, const char *, const char *);
void nh_text_monster_ghost(struct nh_monster_composite *, const char *,
                           const char *, const char *);
void nh_text_monster_nested(struct nh_monster_composite *, const char *, const char *);
void nh_text_monster_finish(struct nh_monster_composite *, const char *, int, const char *);
void nh_text_monster_shop(struct nh_monster_composite *, const char *, const char *,
                          const struct permonst *, const char *, int, int, int);
void nh_text_monster_copy(const char *, const char *);
void nh_text_monster_selected_random(const char *, const struct permonst *, const char *);
#endif
