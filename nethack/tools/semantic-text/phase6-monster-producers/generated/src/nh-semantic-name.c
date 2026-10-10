/* Added 2026-10-02: knowledge-safe observations of completed name producers.
 * Distributed under the NetHack General Public License.
 * No game/name/RNG function is called here. Pointer identity selects the exact
 * original public label; byte equality only rejects stale or transformed buffers.
 */
#include "hack.h"
#include "nh-semantic-name.h"
#include "nh-semantic-monster-labels.h"
#include "nh-semantic-object-labels.h"
#include <stdio.h>
#include <stdint.h>

#define NH_NAME_SLOTS 32
#define NH_NAME_JSON 4096
struct nh_name_slot {
    const char *pointer;
    uint64_t generation;
    char original[BUFSZ];
    char event[NH_NAME_JSON];
};
static struct nh_name_slot nh_names[NH_NAME_SLOTS];
static unsigned nh_name_next;
static uint64_t nh_name_generation;

void nh_text_name_invalidate(const char *pointer) {
    unsigned i;
    for (i = 0; i < NH_NAME_SLOTS; ++i)
        if (nh_names[i].pointer == pointer) {
            nh_names[i].pointer = NULL; nh_names[i].generation = 0;
        }
}

void nh_text_name_invalidate_range(const char *pointer, size_t length) {
    unsigned i;
    uintptr_t start = (uintptr_t)pointer;
    for (i = 0; i < NH_NAME_SLOTS; ++i) {
        uintptr_t candidate = (uintptr_t)nh_names[i].pointer;
        if (candidate >= start && candidate - start < length) {
            nh_names[i].pointer = NULL; nh_names[i].generation = 0;
        }
    }
}

static int nh_name_escape(char *result, size_t capacity, const char *text) {
    static const char hex[] = "0123456789abcdef";
    size_t used = 0;
    const unsigned char *next = (const unsigned char *)text;
    if (!text || !capacity) return 0;
    while (*next) {
        unsigned char c = *next++;
        size_t count = c < 0x20 ? 6 : (c == '"' || c == '\\' ? 2 : 1);
        if (used + count >= capacity) return 0;
        if (count == 6) {
            result[used++] = '\\'; result[used++] = 'u';
            result[used++] = '0'; result[used++] = '0';
            result[used++] = hex[c >> 4]; result[used++] = hex[c & 15];
        } else {
            if (count == 2) result[used++] = '\\';
            result[used++] = (char)c;
        }
    }
    result[used] = '\0';
    return 1;
}

static int nh_name_id(const char *text) {
    size_t i;
    if (!text || text[0] < 'a' || text[0] > 'z') return 0;
    for (i = 0; text[i]; ++i) {
        unsigned char c = (unsigned char)text[i];
        if (i >= 160 || !((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9')
                         || c == '.' || c == '_')) return 0;
    }
    return 1;
}

static void nh_name_bind_label(const char *buffer, const char *recipe, const char *label) {
    char escaped[BUFSZ * 6];
    struct nh_name_slot *slot;
    size_t length;
    int count;
    if (!buffer || !nh_name_id(recipe) || !nh_name_id(label)) return;
    length = strlen(buffer);
    if (length >= BUFSZ || !nh_name_escape(escaped, sizeof escaped, buffer)) return;
    nh_text_name_invalidate(buffer);
    slot = &nh_names[nh_name_next++ % NH_NAME_SLOTS];
    slot->pointer = NULL; slot->generation = 0;
    count = snprintf(slot->event, sizeof slot->event,
        "{\"id\":\"%s\",\"args\":{"
        "\"original\":{\"type\":\"text\",\"value\":\"%s\"},"
        "\"name\":{\"type\":\"text_id\",\"value\":\"%s\"}}}",
        recipe, escaped, label);
    if (count < 0 || (size_t)count >= sizeof slot->event) return;
    memcpy(slot->original, buffer, length + 1);
    if (nh_name_generation == UINT64_MAX) return;
    slot->generation = ++nh_name_generation;
    slot->pointer = buffer;
}

void nh_text_name_object(const char *buffer, const char *recipe, int public_index,
                         enum nh_name_object_field field, const char *public_label) {
    const char *selected;
    if (public_index < 0 || public_index >= NUM_OBJECTS) return;
    if (field == NH_NAME_OBJECT_NAME) selected = obj_descr[public_index].oc_name;
    else if (field == NH_NAME_OBJECT_APPEARANCE) selected = obj_descr[public_index].oc_descr;
    else return;
    if (!selected || selected != public_label) return;
    nh_name_bind_label(buffer, recipe, nh_semantic_object_labels[public_index][field]);
}

void nh_text_name_generic(const char *buffer, const char *label) {
    nh_name_bind_label(buffer, "nethack.name.object.label", label);
}

static const char *nh_monster_label(const struct permonst *selected,
                                   const char *public_name) {
    int gender, index;
    const char *result = NULL;
    if (!selected || !public_name) return NULL;
    index = (int)selected->pmidx;
    if (index < LOW_PM || index > HIGH_PM || selected != &mons[index]) return NULL;
    for (gender = 0; gender < NUM_MGENDERS; ++gender) {
        const char *candidate;
        if (selected->pmnames[gender] != public_name) continue;
        candidate = nh_semantic_monster_labels[index][gender];
        if (!candidate) continue;
        /* Compilers may pool equal literals. Ambiguous gender labels fail closed. */
        if (result && strcmp(result, candidate)) return NULL;
        result = candidate;
    }
    return result;
}

void nh_text_name_monster(const char *buffer, const struct permonst *selected,
                          const char *public_name, const char *article,
                          int invisible, int saddled) {
    const char *label = nh_monster_label(selected, public_name);
    struct nh_name_slot *slot;
    size_t length;
    int n;
    if (!buffer || !article || !label) return;
    /* Only an exact upstream article prefix reaches this ordinary-name hook. */
    if (strcmp(article, "") && strcmp(article, "a ") && strcmp(article, "an ")
        && strcmp(article, "the ") && strcmp(article, "your ")) return;
    length = strlen(buffer);
    if (length >= BUFSZ) return;
    nh_text_name_invalidate(buffer);
    slot = &nh_names[nh_name_next++ % NH_NAME_SLOTS];
    slot->pointer = NULL; slot->generation = 0;
    n = snprintf(slot->event, sizeof(slot->event),
        "{\"id\":\"nethack.name.monster\",\"args\":{"
        "\"article\":{\"type\":\"text\",\"value\":\"%s\"},"
        "\"invisible\":{\"type\":\"text_id\",\"value\":\"%s\"},"
        "\"saddled\":{\"type\":\"text_id\",\"value\":\"%s\"},"
        "\"name\":{\"type\":\"text_id\",\"value\":\"%s\"}}}",
        article, invisible ? "nethack.name.adjective.invisible" : "nethack.name.empty",
        saddled ? "nethack.name.adjective.saddled" : "nethack.name.empty", label);
    if (n < 0 || (size_t)n >= sizeof(slot->event)) return;
    memcpy(slot->original, buffer, length + 1);
    if (nh_name_generation == UINT64_MAX) return;
    slot->generation = ++nh_name_generation;
    slot->pointer = buffer;
}

const char *nh_text_name_event(const char *public_text) {
    unsigned i;
    if (!public_text) return NULL;
    for (i = 0; i < NH_NAME_SLOTS; ++i) {
        struct nh_name_slot *slot = nh_names + i;
        if (slot->pointer == public_text) {
            if (!strcmp(slot->original, public_text)) return slot->event;
            slot->pointer = NULL; slot->generation = 0;
        }
    }
    return NULL;
}

/* Added 2026-10-02: source-only article/case propagation; NGPL.
 * Appended only to a separate generated copy of nh-semantic-name.c.
 * No original gameplay/name/grammar/RNG function is called here. Pointer
 * identity and byte/generation integrity reject stale observations; they
 * never identify a name by reverse-matching English. */
#include "nh-semantic-name-grammar.h"

static int
nh_grammar_length(const char *text, size_t bound, size_t *length)
{
    size_t n;
    if (!text || !length) return 0;
    for (n = 0; n < bound; ++n) {
        if (!text[n]) { *length = n; return 1; }
    }
    return 0;
}

void
nh_text_name_grammar_capture(struct nh_name_grammar_snapshot *snapshot,
                             const char *source)
{
    const char *event;
    size_t length, event_length;
    unsigned i;
    if (!snapshot) return;
    snapshot->valid = 0;
    snapshot->source_pointer = NULL;
    snapshot->source_generation = 0;
    if (!source) return;
    /* The existing lookup proves source pointer and public bytes agree with
     * that exact live registry generation before original buffer allocation. */
    if (!nh_grammar_length(source, sizeof snapshot->original, &length) || !length)
        return;
    event = nh_text_name_event(source);
    if (!event || !nh_grammar_length(event, sizeof snapshot->event, &event_length))
        return;
    for (i = 0; i < NH_NAME_SLOTS; ++i) {
        struct nh_name_slot *slot = nh_names + i;
        if (slot->pointer != source || slot->event != event || !slot->generation)
            continue;
        memcpy(snapshot->original, source, length + 1);
        memcpy(snapshot->event, event, event_length + 1);
        snapshot->original_length = length;
        snapshot->source_pointer = source;
        snapshot->source_generation = slot->generation;
        snapshot->valid = 1;
        return;
    }
}

static void
nh_grammar_bind(const struct nh_name_grammar_snapshot *snapshot,
                const char *result, const char *recipe)
{
    char escaped[BUFSZ * 6];
    struct nh_name_slot *slot;
    size_t length;
    int count;
    if (!snapshot->source_generation || !nh_name_id(recipe)
        || !nh_grammar_length(result, BUFSZ, &length)
        || !nh_name_escape(escaped, sizeof escaped, result)) return;
    slot = &nh_names[nh_name_next++ % NH_NAME_SLOTS];
    slot->pointer = NULL;
    slot->generation = 0;
    count = snprintf(slot->event, sizeof slot->event,
        "{\"id\":\"%s\",\"args\":{"
        "\"original\":{\"type\":\"text\",\"value\":\"%s\"},"
        "\"inner\":{\"type\":\"event\",\"value\":%s}}}",
        recipe, escaped, snapshot->event);
    if (count < 0 || (size_t)count >= sizeof slot->event
        || nh_name_generation == UINT64_MAX) return;
    memcpy(slot->original, result, length + 1);
    slot->generation = ++nh_name_generation;
    slot->pointer = result;
}

void
nh_text_name_grammar_append(struct nh_name_grammar_snapshot *snapshot,
                            const char *result, const char *source,
                            size_t original_capacity, const char *recipe)
{
    size_t source_length, result_length;
    int captured = snapshot && snapshot->valid;
    /* Consume a local snapshot once. Never leave a descriptor for a failed
     * transformed output, including an unchanged first-byte case transform. */
    if (snapshot) snapshot->valid = 0;
    nh_text_name_invalidate(result);
    if (!captured || source != snapshot->source_pointer
        || !nh_grammar_length(source, BUFSZ, &source_length)
        || source_length != snapshot->original_length
        || memcmp(source, snapshot->original, source_length + 1)
        || source_length > original_capacity
        || !nh_grammar_length(result, BUFSZ, &result_length)
        || result_length < source_length
        || memcmp(result + result_length - source_length,
                  snapshot->original, source_length + 1)) return;
    nh_grammar_bind(snapshot, result, recipe);
}

void
nh_text_name_grammar_case(struct nh_name_grammar_snapshot *snapshot,
                          const char *result, enum nh_name_grammar_case mode,
                          const char *recipe)
{
    size_t length;
    unsigned char first;
    int captured = snapshot && snapshot->valid;
    if (snapshot) snapshot->valid = 0;
    nh_text_name_invalidate(result);
    if (!captured || !nh_grammar_length(result, BUFSZ, &length)
        || length != snapshot->original_length || !length
        || memcmp(result + 1, snapshot->original + 1, length)) return;
    /* Verify only the original ASCII case operation, without calling highc
     * or lowc again. UTF-8/non-ASCII bytes remain exactly as originally shown. */
    first = (unsigned char)snapshot->original[0];
    if (mode == NH_NAME_GRAMMAR_UPPER) {
        if (result != snapshot->source_pointer) return;
        if (first >= 'a' && first <= 'z') first -= 'a' - 'A';
    } else if (mode == NH_NAME_GRAMMAR_LOWER) {
        if (first >= 'A' && first <= 'Z') first += 'a' - 'A';
    } else return;
    if ((unsigned char)result[0] != first) return;
    nh_grammar_bind(snapshot, result, recipe);
}

/* Added 2026-10-02: source-only bounded public monster composition; NGPL.
 * Append to the Phase5 extended nh-semantic-name.c, in the same translation
 * unit as its private checked registry helpers. No name/game/RNG calls.
 * Observed byte comparisons reject overwrites/clipping. Source branch hooks,
 * never completed-English lookup, choose every descriptor. */
#include "nh-semantic-monster-composite.h"

static int nh_mc_copy(char *out, size_t bound, const char *source) {
    size_t length;
    if (!nh_grammar_length(source, bound, &length)) return 0;
    memcpy(out, source, length + 1);
    return 1;
}

static int nh_mc_append(char *out, size_t bound, const char *source) {
    size_t length, extra;
    if (!nh_grammar_length(out, bound, &length)
        || !nh_grammar_length(source, bound, &extra)
        || extra >= bound - length) return 0;
    memcpy(out + length, source, extra + 1);
    return 1;
}

static int nh_mc_equals(const char *observed, const char *expected) {
    size_t length, expected_length;
    return nh_grammar_length(observed, BUFSZ, &length)
        && nh_grammar_length(expected, BUFSZ, &expected_length)
        && length == expected_length
        && !memcmp(observed, expected, length + 1);
}

static int nh_mc_escape(char *out, size_t bound, const char *source) {
    size_t length;
    return nh_grammar_length(source, BUFSZ, &length)
        && nh_name_escape(out, bound, source);
}

static void nh_mc_bind(const char *result, const char *event) {
    size_t length, event_length;
    struct nh_name_slot *slot;
    /* Invalidation happens even when a new presentation observation fails. */
    nh_text_name_invalidate(result);
    if (!nh_grammar_length(result, BUFSZ, &length)
        || !nh_grammar_length(event, NH_NAME_JSON, &event_length)
        || nh_name_generation == UINT64_MAX) return;
    slot = &nh_names[nh_name_next++ % NH_NAME_SLOTS];
    slot->pointer = NULL;
    slot->generation = 0;
    memcpy(slot->original, result, length + 1);
    memcpy(slot->event, event, event_length + 1);
    slot->generation = ++nh_name_generation;
    slot->pointer = result;
}

void nh_text_monster_begin(struct nh_monster_composite *owner, const char *adjective) {
    if (!owner) return;
    owner->prefix_valid = owner->body_valid = 0;
    owner->invisible = owner->saddled = 0;
    owner->leaf_id = owner->leaf_original = NULL;
    owner->has_adjective = adjective != NULL;
    owner->adjective.valid = 0;
    owner->prefix[0] = owner->body_original[0] = owner->body_event[0] = '\0';
    if (adjective) nh_text_name_grammar_capture(&owner->adjective, adjective);
}

void nh_text_monster_prefix(struct nh_monster_composite *owner, const char *result,
                            int invisible, int saddled) {
    char expected[BUFSZ] = "";
    if (!owner) return;
    owner->prefix_valid = 0;
    owner->invisible = !!invisible;
    owner->saddled = !!saddled;
    /* A present empty adjective is intentionally distinct from NULL. */
    if (owner->has_adjective
        && (!owner->adjective.valid
            || !nh_mc_append(expected, sizeof expected, owner->adjective.original)
            || !nh_mc_append(expected, sizeof expected, " "))) return;
    if ((invisible && !nh_mc_append(expected, sizeof expected, "invisible "))
        || (saddled && !nh_mc_append(expected, sizeof expected, "saddled "))
        || !nh_mc_equals(result, expected)
        || !nh_mc_copy(owner->prefix, sizeof owner->prefix, expected)) return;
    owner->prefix_valid = 1;
}

static int nh_mc_body(struct nh_monster_composite *owner, const char *result,
                       const char *body) {
    char expected[BUFSZ];
    if (!owner) return 0;
    owner->body_valid = 0;
    if (!owner->prefix_valid || !nh_mc_copy(expected, sizeof expected, owner->prefix)
        || !nh_mc_append(expected, sizeof expected, body)
        || !nh_mc_equals(result, expected)
        || !nh_mc_copy(owner->body_original, sizeof owner->body_original, body)) return 0;
    return 1;
}

const char *nh_text_monster_leaf(struct nh_monster_composite *owner,
                                 const char *id, const char *original) {
    if (owner) { owner->leaf_id = id; owner->leaf_original = original; }
    return original;
}

void nh_text_monster_leaf_finish(struct nh_monster_composite *owner, const char *result) {
    char event[NH_NAME_JSON], escaped[BUFSZ * 6];
    int count;
    nh_text_name_invalidate(result);
    if (!owner || !nh_name_id(owner->leaf_id)
        || !nh_mc_equals(result, owner->leaf_original)
        || !nh_mc_escape(escaped, sizeof escaped, result)) return;
    count = snprintf(event, sizeof event,
        "{\"id\":\"nethack.name.monster.phase6.label\",\"args\":{"
        "\"original\":{\"type\":\"text\",\"value\":\"%s\"},"
        "\"name\":{\"type\":\"text_id\",\"value\":\"%s\"}}}",
        escaped, owner->leaf_id);
    if (count < 0 || (size_t)count >= sizeof event) return;
    nh_mc_bind(result, event);
}

void nh_text_monster_label(struct nh_monster_composite *owner, const char *result,
                           const struct permonst *selected, const char *public_name) {
    char escaped[BUFSZ * 6];
    const char *label = nh_monster_label(selected, public_name);
    int count;
    if (owner) owner->body_valid = 0;
    if (!owner || !nh_mc_body(owner, result, public_name) || !label
        || !nh_mc_escape(escaped, sizeof escaped, public_name)) return;
    count = snprintf(owner->body_event, sizeof owner->body_event,
        "{\"id\":\"nethack.name.monster.phase6.label\",\"args\":{"
        "\"original\":{\"type\":\"text\",\"value\":\"%s\"},"
        "\"name\":{\"type\":\"text_id\",\"value\":\"%s\"}}}", escaped, label);
    owner->body_valid = count >= 0 && (size_t)count < sizeof owner->body_event;
}

void nh_text_monster_proper(struct nh_monster_composite *owner, const char *result,
                            const char *name) {
    char escaped[BUFSZ * 6];
    int count;
    if (owner) owner->body_valid = 0;
    if (!owner || !nh_mc_body(owner, result, name)
        || !nh_mc_escape(escaped, sizeof escaped, name)) return;
    count = snprintf(owner->body_event, sizeof owner->body_event,
        "{\"id\":\"nethack.name.monster.phase6.proper\",\"args\":{"
        "\"original\":{\"type\":\"text\",\"value\":\"%s\"}}}", escaped);
    owner->body_valid = count >= 0 && (size_t)count < sizeof owner->body_event;
}

void nh_text_monster_called(struct nh_monster_composite *owner, const char *result,
                            const struct permonst *selected, const char *public_name,
                            const char *name) {
    char body[BUFSZ] = "", escaped[BUFSZ * 6];
    struct nh_name_grammar_snapshot certified_name;
    const char *label = nh_monster_label(selected, public_name);
    int count;
    if (owner) owner->body_valid = 0;
    /* MGIVENNAME may mix a personal name and generated rank. Only its
     * original creator can certify those pieces; this consumer never guesses
     * by querying is_mplayer, reading real fields or parsing English. */
    nh_text_name_grammar_capture(&certified_name, name);
    if (!owner || !label || !nh_mc_append(body, sizeof body, public_name)
        || !nh_mc_append(body, sizeof body, " called ")
        || !nh_mc_append(body, sizeof body, name)
        || !nh_mc_body(owner, result, body)
        || !nh_mc_escape(escaped, sizeof escaped, body)
        || !certified_name.valid) return;
    count = snprintf(owner->body_event, sizeof owner->body_event,
        "{\"id\":\"nethack.name.monster.phase6.called\",\"args\":{"
        "\"original\":{\"type\":\"text\",\"value\":\"%s\"},"
        "\"name\":{\"type\":\"event\",\"value\":%s},"
        "\"kind\":{\"type\":\"text_id\",\"value\":\"%s\"}}}", escaped, certified_name.event, label);
    owner->body_valid = count >= 0 && (size_t)count < sizeof owner->body_event;
}

void nh_text_monster_ghost(struct nh_monster_composite *owner, const char *result,
                           const char *name, const char *selected_suffix) {
    char body[BUFSZ] = "", escaped[BUFSZ * 6], proper[BUFSZ * 6];
    int count;
    if (owner) owner->body_valid = 0;
    if (!owner || !nh_mc_append(body, sizeof body, selected_suffix)
        || !nh_mc_append(body, sizeof body, " ghost")
        || !nh_mc_body(owner, result, body)
        || !nh_mc_escape(escaped, sizeof escaped, body)
        || !nh_mc_escape(proper, sizeof proper, name)) return;
    count = snprintf(owner->body_event, sizeof owner->body_event,
        "{\"id\":\"nethack.name.monster.phase6.ghost\",\"args\":{"
        "\"original\":{\"type\":\"text\",\"value\":\"%s\"},"
        "\"owner\":{\"type\":\"text\",\"value\":\"%s\"}}}", escaped, proper);
    owner->body_valid = count >= 0 && (size_t)count < sizeof owner->body_event;
}

void nh_text_monster_nested(struct nh_monster_composite *owner, const char *result,
                            const char *selected_public_result) {
    struct nh_name_grammar_snapshot selected;
    if (owner) owner->body_valid = 0;
    if (!owner || !nh_mc_body(owner, result, selected_public_result)) return;
    nh_text_name_grammar_capture(&selected, selected_public_result);
    if (!selected.valid
        || !nh_mc_copy(owner->body_event, sizeof owner->body_event, selected.event)) return;
    owner->body_valid = 1;
}

void nh_text_monster_finish(struct nh_monster_composite *owner, const char *result,
                            int article, const char *selected_article) {
    char expected[BUFSZ] = "", escaped[BUFSZ * 6], event[NH_NAME_JSON];
    const char *ownership = "nethack.name.empty";
    const char *adjective = "{\"id\":\"nethack.name.empty\",\"args\":{}}";
    int count;
    nh_text_name_invalidate(result);
    if (!owner || !owner->prefix_valid || !owner->body_valid) return;
    /* The source's final ARTICLE switch, not a rendered-English matcher,
     * selects ownership. Exact native article bytes only prove integrity. */
    if (article == ARTICLE_YOUR) {
        if (strcmp(selected_article, "your ")) return;
        ownership = "nethack.name.monster.phase6.your";
    } else if (article == ARTICLE_THE) {
        if (strcmp(selected_article, "the ")) return;
    } else if (article == ARTICLE_A) {
        if (strcmp(selected_article, "a ") && strcmp(selected_article, "an ")) return;
    } else if (*selected_article) return;
    if (!nh_mc_append(expected, sizeof expected, selected_article)
        || !nh_mc_append(expected, sizeof expected, owner->prefix)
        || !nh_mc_append(expected, sizeof expected, owner->body_original)
        || !nh_mc_equals(result, expected)
        || !nh_mc_escape(escaped, sizeof escaped, result)) return;
    if (owner->has_adjective) adjective = owner->adjective.event;
    count = snprintf(event, sizeof event,
        "{\"id\":\"nethack.name.monster.phase6.composite\",\"args\":{"
        "\"original\":{\"type\":\"text\",\"value\":\"%s\"},"
        "\"ownership\":{\"type\":\"text_id\",\"value\":\"%s\"},"
        "\"adjective\":{\"type\":\"event\",\"value\":%s},"
        "\"invisible\":{\"type\":\"text_id\",\"value\":\"%s\"},"
        "\"saddled\":{\"type\":\"text_id\",\"value\":\"%s\"},"
        "\"body\":{\"type\":\"event\",\"value\":%s}}}",
        escaped, ownership, adjective,
        owner->invisible ? "nethack.name.adjective.invisible" : "nethack.name.empty",
        owner->saddled ? "nethack.name.adjective.saddled" : "nethack.name.empty",
        owner->body_event);
    if (count < 0 || (size_t)count >= sizeof event) return;
    nh_mc_bind(result, event);
}

void nh_text_monster_shop(struct nh_monster_composite *owner, const char *result,
                          const char *proper_name, const struct permonst *selected,
                          const char *public_name, int adjective_branch,
                          int extended_branch, int invisible_branch) {
    char expected[BUFSZ] = "", escaped[BUFSZ * 6], proper[BUFSZ * 6], event[NH_NAME_JSON];
    const char *label = "nethack.name.empty";
    const char *adjective = "{\"id\":\"nethack.name.empty\",\"args\":{}}";
    int count;
    nh_text_name_invalidate(result);
    if (!owner) return;
    if (adjective_branch) {
        if (!owner->has_adjective || !owner->adjective.valid
            || !nh_mc_append(expected, sizeof expected, "the ")
            || !nh_mc_append(expected, sizeof expected, owner->adjective.original)
            || !nh_mc_append(expected, sizeof expected, " ")) return;
        adjective = owner->adjective.event;
    }
    if (!nh_mc_append(expected, sizeof expected, proper_name)) return;
    if (extended_branch) {
        label = nh_monster_label(selected, public_name);
        if (!label || !nh_mc_append(expected, sizeof expected, " the ")
            || (invisible_branch && !nh_mc_append(expected, sizeof expected, "invisible "))
            || !nh_mc_append(expected, sizeof expected, public_name)) return;
    } else if (invisible_branch) return;
    if (!nh_mc_equals(result, expected)
        || !nh_mc_escape(escaped, sizeof escaped, result)
        || !nh_mc_escape(proper, sizeof proper, proper_name)) return;
    count = snprintf(event, sizeof event,
        "{\"id\":\"%s\",\"args\":{"
        "\"original\":{\"type\":\"text\",\"value\":\"%s\"},"
        "\"name\":{\"type\":\"text\",\"value\":\"%s\"},"
        "\"adjective\":{\"type\":\"event\",\"value\":%s},"
        "\"invisible\":{\"type\":\"text_id\",\"value\":\"%s\"},"
        "\"kind\":{\"type\":\"text_id\",\"value\":\"%s\"}}}",
        extended_branch ? "nethack.name.monster.phase6.shopkeeper_titled"
                        : "nethack.name.monster.phase6.shopkeeper", escaped, proper, adjective,
        invisible_branch ? "nethack.name.adjective.invisible" : "nethack.name.empty", label);
    if (count < 0 || (size_t)count >= sizeof event) return;
    nh_mc_bind(result, event);
}

void nh_text_monster_copy(const char *result, const char *selected_public_result) {
    struct nh_name_grammar_snapshot selected;
    /* Capture first: result and input may alias; invalidation must not erase
     * the source descriptor before its owned event is copied. */
    nh_text_name_grammar_capture(&selected, selected_public_result);
    nh_text_name_invalidate(result);
    if (!selected.valid || !nh_mc_equals(result, selected.original)) return;
    nh_mc_bind(result, selected.event);
}

void nh_text_monster_selected_random(const char *result,
                                     const struct permonst *selected,
                                     const char *selected_name) {
    struct nh_monster_composite owner;
    nh_text_monster_begin(&owner, NULL);
    nh_text_monster_prefix(&owner, "", 0, 0);
    nh_text_monster_label(&owner, result, selected, selected_name);
    nh_text_monster_finish(&owner, result, ARTICLE_NONE, "");
}
