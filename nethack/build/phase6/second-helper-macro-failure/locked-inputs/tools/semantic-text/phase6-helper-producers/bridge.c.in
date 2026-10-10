/* Added 2026-10-02; source-only proposal, NGPL. Preserve all upstream notices.
 * This file has not been compiled or approved for runtime integration. */
#include "hack.h"
#include "nh-phase6-helper.h"
#include "nh-phase6-helper-labels.h"
#include <string.h>

/* All covered native outputs are immutable selected literals, shorter than
 * this bound. Copying guards original-output integrity; bytes never select an
 * identity. Each automatic scope lives only for one original helper call. */
#define NH_PHASE6_PUBLIC_BYTES 96
struct nh_phase6_helper_scope {
    struct nh_phase6_helper_scope *parent;
    enum nh_phase6_helper_kind expected;
    const char *original;
    const char *leaf_id;
    char original_bytes[NH_PHASE6_PUBLIC_BYTES];
    size_t original_length;
    unsigned observations;
    int valid;
};
/* NetHack's existing synchronous engine owns this thread. This is a live scope
 * chain, never a registry/cache. A threaded/reentrant port must provide its own
 * engine-context or thread-local scope root before runtime approval. */
static struct nh_phase6_helper_scope *nh_phase6_current_scope;

static int
nh_phase6_bounded_length(const char *s, size_t bound, size_t *length)
{
    size_t n;
    if (!s)
        return 0;
    for (n = 0; n < bound; ++n)
        if (!s[n]) {
            *length = n;
            return 1;
        }
    return 0;
}

static void
nh_phase6_observe(enum nh_phase6_helper_kind producer, const char *original,
                  const char *leaf_id)
{
    struct nh_phase6_helper_scope *s = nh_phase6_current_scope;
    size_t n;
    if (!s || s->expected != producer)
        return;
    /* Multiple same-kind completions make this result ambiguous. Never choose
     * the last registered static pointer or match it by English spelling. */
    if (s->observations) {
        s->observations = 2;
        s->valid = 0;
        return;
    }
    s->observations = 1;
    if (!leaf_id || !*leaf_id
        || !nh_phase6_bounded_length(original, sizeof s->original_bytes, &n))
        return;
    s->original = original;
    s->leaf_id = leaf_id;
    s->original_length = n;
    memcpy(s->original_bytes, original, n + 1);
    s->valid = 1;
}

static void
nh_phase6_open(struct nh_phase6_helper_scope *s,
               enum nh_phase6_helper_kind expected)
{
    memset(s, 0, sizeof *s);
    s->expected = expected;
    s->parent = nh_phase6_current_scope;
    nh_phase6_current_scope = s;
}

struct nh_phase6_helper_value
nh_phase6_fallback_value(const char *original)
{
    struct nh_phase6_helper_value result;
    memset(&result, 0, sizeof result);
    result.original = original;
    return result;
}

struct nh_phase6_helper_value
nh_phase6_leaf_value(const char *original, const char *leaf_id)
{
    struct nh_phase6_helper_value result = nh_phase6_fallback_value(original);
    const char prefix[] = "{\"id\":\"";
    const char suffix[] = "\",\"args\":{}}";
    size_t n, i;
    /* IDs come from generated source constants, never user text. Reject any
     * future non-ID byte instead of serializing it into a JSON string. */
    if (!original || !leaf_id
        || !nh_phase6_bounded_length(leaf_id, sizeof result.event_json, &n)
        || !n || sizeof prefix - 1 + n + sizeof suffix > sizeof result.event_json)
        return result;
    for (i = 0; i < n; ++i) {
        unsigned char c = (unsigned char) leaf_id[i];
        if (!((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9')
              || c == '.' || c == '_'))
            return result;
    }
    memcpy(result.event_json, prefix, sizeof prefix - 1);
    memcpy(result.event_json + sizeof prefix - 1, leaf_id, n);
    memcpy(result.event_json + sizeof prefix - 1 + n, suffix, sizeof suffix);
    result.event_valid = 1;
    return result;
}

static struct nh_phase6_helper_value
nh_phase6_close(struct nh_phase6_helper_scope *s, const char *original)
{
    struct nh_phase6_helper_value result = nh_phase6_fallback_value(original);
    /* No source scope escapes its wrapper. The pointer and copied bytes test
     * completed-result integrity only; they do not select or find a label. */
    if (nh_phase6_current_scope == s) {
        nh_phase6_current_scope = s->parent;
        if (s->valid && s->observations == 1 && s->original == original
            && !memcmp(s->original_bytes, original, s->original_length + 1))
            result = nh_phase6_leaf_value(original, s->leaf_id);
    } else {
        /* A protocol error must never produce a descriptor. Restore only the
         * saved live parent; no engine query or fatal gameplay action. */
        nh_phase6_current_scope = s->parent;
    }
    return result;
}

const char *
nh_phase6_selected_const(enum nh_phase6_helper_kind producer,
                         const char *original, const char *leaf_id)
{
    nh_phase6_observe(producer, original, leaf_id);
    return original;
}

const char *
nh_phase6_selected_table(enum nh_phase6_helper_kind producer,
                         const char *const *table, const char *const *ids,
                         size_t count, int index)
{
    /* The original trusted native array selection occurs exactly once.
     * Checking descriptor bounds never substitutes a different native value. */
    const char *original = table[index];
    nh_phase6_observe(producer, original,
                      index >= 0 && (size_t) index < count ? ids[index] : 0);
    return original;
}

struct nh_phase6_helper_value
nh_phase6_table_value(const char *const *table, const char *const *ids,
                      size_t count, int index)
{
    const char *original = table[index];
    return nh_phase6_leaf_value(original,
                                index >= 0 && (size_t) index < count
                                    ? ids[index] : 0);
}

struct nh_phase6_helper_value
nh_phase6_pronoun_table_value(const struct Gender *table, int index,
                             enum nh_phase6_pronoun_field field)
{
    const char *original = 0;
    const char *leaf_id = 0;
    /* The native index predicate/RNG has already run in the original macro
     * argument. Read just its selected native public field once. Never export
     * the row, true gender, visibility, hallucination, adj or filecode. */
    switch (field) {
    case NH_PHASE6_PRONOUN_SUBJECT:
        original = table[index].he;
        if (index >= 0 && index < 4) leaf_id = nh_phase6_ids_genders_he[index];
        break;
    case NH_PHASE6_PRONOUN_OBJECT:
        original = table[index].him;
        if (index >= 0 && index < 4) leaf_id = nh_phase6_ids_genders_him[index];
        break;
    case NH_PHASE6_PRONOUN_POSSESSIVE:
        original = table[index].his;
        if (index >= 0 && index < 4) leaf_id = nh_phase6_ids_genders_his[index];
        break;
    default:
        return nh_phase6_fallback_value(original);
    }
    return nh_phase6_leaf_value(original, leaf_id);
}

struct nh_phase6_helper_value
nh_phase6_body_part_value(int part)
{
    struct nh_phase6_helper_scope scope;
    const char *original;
    nh_phase6_open(&scope, NH_PHASE6_BODY);
    original = body_part(part);
    return nh_phase6_close(&scope, original);
}

struct nh_phase6_helper_value
nh_phase6_mbodypart_value(struct monst *mon, int part)
{
    struct nh_phase6_helper_scope scope;
    const char *original;
    nh_phase6_open(&scope, NH_PHASE6_BODY);
    original = mbodypart(mon, part);
    return nh_phase6_close(&scope, original);
}

struct nh_phase6_helper_value
nh_phase6_hcolor_value(const char *preference)
{
    struct nh_phase6_helper_scope scope;
    const char *original;
    nh_phase6_open(&scope, NH_PHASE6_COLOR);
    original = hcolor(preference);
    return nh_phase6_close(&scope, original);
}

struct nh_phase6_helper_value
nh_phase6_hliquid_value(const char *preference)
{
    struct nh_phase6_helper_scope scope;
    const char *original;
    nh_phase6_open(&scope, NH_PHASE6_LIQUID);
    original = hliquid(preference);
    return nh_phase6_close(&scope, original);
}

struct nh_phase6_helper_value
nh_phase6_locomotion_value(const struct permonst *ptr, const char *def)
{
    struct nh_phase6_helper_scope scope;
    const char *original;
    nh_phase6_open(&scope, NH_PHASE6_LOCOMOTION);
    original = locomotion(ptr, def);
    return nh_phase6_close(&scope, original);
}

struct nh_phase6_helper_value
nh_phase6_stagger_value(const struct permonst *ptr, const char *def)
{
    struct nh_phase6_helper_scope scope;
    const char *original;
    nh_phase6_open(&scope, NH_PHASE6_STAGGER);
    original = stagger(ptr, def);
    return nh_phase6_close(&scope, original);
}
