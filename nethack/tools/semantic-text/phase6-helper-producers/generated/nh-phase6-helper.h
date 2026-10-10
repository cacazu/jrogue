/* Added 2026-10-02; source-only proposal under the NetHack General Public License.
 * No original helper API or gameplay state is replaced by this header. */
#ifndef JROGUE_NH_PHASE6_HELPER_H
#define JROGUE_NH_PHASE6_HELPER_H
#include <stddef.h>

/* One returned value owns its descriptor. Its array survives by-value copying;
 * do not replace it with a pointer to the array inside a returned temporary. */
#define NH_PHASE6_HELPER_JSON 192
struct nh_phase6_helper_value {
    const char *original;
    char event_json[NH_PHASE6_HELPER_JSON];
    int event_valid;
};
enum nh_phase6_helper_kind {
    NH_PHASE6_BODY,
    NH_PHASE6_COLOR,
    NH_PHASE6_LIQUID,
    NH_PHASE6_LOCOMOTION,
    NH_PHASE6_STAGGER
};
struct monst;
struct permonst;
struct Gender;
enum nh_phase6_pronoun_field {
    NH_PHASE6_PRONOUN_SUBJECT,
    NH_PHASE6_PRONOUN_OBJECT,
    NH_PHASE6_PRONOUN_POSSESSIVE
};

/* Source-call replacements keep the original argument expressions unchanged.
 * Each wrapper opens an automatic expected-helper scope and calls the original
 * function exactly once. The event is usable only for that completed result. */
struct nh_phase6_helper_value nh_phase6_body_part_value(int);
struct nh_phase6_helper_value nh_phase6_mbodypart_value(struct monst *, int);
struct nh_phase6_helper_value nh_phase6_hcolor_value(const char *);
struct nh_phase6_helper_value nh_phase6_hliquid_value(const char *);
struct nh_phase6_helper_value nh_phase6_locomotion_value(const struct permonst *,
                                                       const char *);
struct nh_phase6_helper_value nh_phase6_stagger_value(const struct permonst *,
                                                   const char *);

/* Called only at originally selected native returns. The original array index
 * is evaluated once, including any original display-RNG call. The bridge does
 * not query game state, anatomy, name builders, native predicates, or RNG. */
const char *nh_phase6_selected_const(enum nh_phase6_helper_kind,
                                   const char *, const char *);
const char *nh_phase6_selected_table(enum nh_phase6_helper_kind,
                                   const char *const *, const char *const *,
                                   size_t, int);

/* Macro branch adapters have no live native scope and return owned values
 * directly. Their call sites retain the original predicate/index expression.
 * No original helper is rerun or inferred from bytes. */
struct nh_phase6_helper_value nh_phase6_leaf_value(const char *, const char *);
struct nh_phase6_helper_value nh_phase6_table_value(const char *const *,
                                                 const char *const *,
                                                 size_t, int);
struct nh_phase6_helper_value nh_phase6_fallback_value(const char *);
/* Source macro replacement receives its original computed index once. Only
 * the originally selected public field is read, not adj/filecode/allow or a
 * monster/hero gender. Input case/possessive grammar must remain explicit. */
struct nh_phase6_helper_value nh_phase6_pronoun_table_value(const struct Gender *,
                                                          int,
                                                          enum nh_phase6_pronoun_field);
#endif
