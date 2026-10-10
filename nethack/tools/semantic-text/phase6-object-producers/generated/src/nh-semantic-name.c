/* Added 2026-10-02: knowledge-safe observations of completed name producers.
 * Distributed under the NetHack General Public License.
 * No game/name/RNG function is called here. Pointer identity selects the exact
 * original public label; byte equality only rejects stale or transformed buffers.
 */
#include "hack.h"
#include "nh-semantic-object-public.h"
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
    nh_object_public_pool_invalidate(pointer, length);
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

/* Added 2026-10-02: source-only public object composition; NGPL.
 * Append after the isolated phase5 registry extension in one generated TU.
 * Identity comes from exact source hook IDs. Byte comparisons reject stale,
 * incomplete, overwritten or unobserved writes; they do not classify English.
 * No obj fields, gameplay functions, naming functions or RNG are read/called.
 */
#include "nh-semantic-object-public.h"

struct nh_object_public_pool {
    uintptr_t start;
    size_t length;
    uint64_t generation;
};
static struct nh_object_public_pool nh_object_pools[NH_OBJECT_PUBLIC_POOLS];
static uint64_t nh_object_pool_generation;
static int nh_object_pool_exhausted;

void
nh_object_public_pool_invalidate(const char *pointer, size_t length)
{
    unsigned i, empty = NH_OBJECT_PUBLIC_POOLS;
    uintptr_t start = (uintptr_t)pointer;
    if (nh_object_pool_exhausted) return;
    if (!pointer || !length || nh_object_pool_generation == UINT64_MAX) {
        nh_object_pool_exhausted = 1;
        return;
    }
    for (i = 0; i < NH_OBJECT_PUBLIC_POOLS; ++i) {
        struct nh_object_public_pool *pool = nh_object_pools + i;
        if (pool->generation && pool->start == start) {
            if (pool->length != length) { nh_object_pool_exhausted = 1; return; }
            pool->generation = ++nh_object_pool_generation;
            return;
        }
        if (!pool->generation && empty == NH_OBJECT_PUBLIC_POOLS) empty = i;
    }
    if (empty == NH_OBJECT_PUBLIC_POOLS) { nh_object_pool_exhausted = 1; return; }
    nh_object_pools[empty].start = start;
    nh_object_pools[empty].length = length;
    nh_object_pools[empty].generation = ++nh_object_pool_generation;
}

static uint64_t
nh_object_public_pool_generation(const char *pointer)
{
    unsigned i;
    uintptr_t position = (uintptr_t)pointer;
    uint64_t result = 0;
    if (!pointer || nh_object_pool_exhausted) return 0;
    for (i = 0; i < NH_OBJECT_PUBLIC_POOLS; ++i) {
        const struct nh_object_public_pool *pool = nh_object_pools + i;
        if (pool->generation && position >= pool->start
            && position - pool->start < pool->length) {
            if (result) return 0; /* Overlapping provenance is ambiguous. */
            result = pool->generation;
        }
    }
    return result;
}

static int
nh_object_public_pool_live(const struct nh_object_public_snapshot *s)
{
    return s->pool_generation
           && s->pool_generation == nh_object_public_pool_generation(s->base.source_pointer);
}

static int
nh_object_public_expected(const struct nh_object_public_snapshot *s,
                           const char *buffer, int zone, size_t capacity)
{
    size_t length, base, suffix;
    if (!s->valid || !nh_object_public_pool_live(s)
        || !capacity || capacity > BUFSZ
        || !nh_grammar_length(buffer, capacity, &length)) return 0;
    if (zone == NH_OBJECT_PREFIX)
        return strlen(s->prefix) == length
               && !memcmp(buffer, s->prefix, length + 1);
    base = s->base.original_length;
    suffix = strlen(s->suffix);
    return buffer == s->base.source_pointer && length == base + suffix
           && !memcmp(buffer, s->base.original, base)
           && !memcmp(buffer + base, s->suffix, suffix + 1);
}

void
nh_object_public_init(struct nh_object_public_snapshot *s, const char *base)
{
    if (!s) return;
    memset(s, 0, sizeof *s);
    nh_text_name_grammar_capture(&s->base, base);
    s->pool_generation = nh_object_public_pool_generation(base);
    s->valid = s->base.valid && s->pool_generation != 0;
}

void
nh_object_public_begin(struct nh_object_public_snapshot *s, const char *buffer,
                       enum nh_object_public_zone zone, size_t capacity)
{
    size_t length;
    if (!s) return;
    s->pending = 0;
    s->captured = 0;
    if ((zone != NH_OBJECT_PREFIX && zone != NH_OBJECT_SUFFIX)
        || !nh_object_public_expected(s, buffer, zone, capacity)
        || !nh_grammar_length(buffer, capacity, &length)) {
        s->valid = 0;
        return;
    }
    memcpy(s->before, buffer, length + 1);
    s->before_length = length;
    s->pending_pointer = buffer;
    s->pending_capacity = capacity;
    if (zone == NH_OBJECT_PREFIX) s->prefix_capacity = capacity;
    s->zone = zone;
    s->pending = 1;
}

long
nh_object_public_long(struct nh_object_public_snapshot *s, long value)
{
    if (s && s->valid && s->pending) {
        s->public_long = value;
        s->captured |= 1;
    }
    return value;
}

int
nh_object_public_int(struct nh_object_public_snapshot *s, unsigned index,
                     int value)
{
    if (s && s->valid && s->pending && index < 2) {
        s->public_int[index] = value;
        s->captured |= 2U << index;
    }
    return value;
}

const char *
nh_object_public_plural(struct nh_object_public_snapshot *s, const char *value)
{
    size_t length;
    if (s && s->valid && s->pending) {
        if (!nh_grammar_length(value, sizeof s->public_plural, &length))
            s->valid = 0;
        else {
            memcpy(s->public_plural, value, length + 1);
            s->captured |= 8;
        }
    }
    return value;
}

static int
nh_object_public_store(struct nh_object_public_snapshot *s,
                       const char *event, int replace_article)
{
    size_t length;
    unsigned index = s->count;
    if (!s->valid || s->used >= sizeof s->pieces
        || !nh_grammar_length(event, NH_OBJECT_PUBLIC_JSON, &length)
        || length + 1 > sizeof s->pieces - s->used) return 0;
    if (replace_article) {
        if (!s->article || s->article_index >= s->count) return 0;
        index = s->article_index;
    }
    else if (index >= NH_OBJECT_PUBLIC_PARTS) return 0;
    s->offset[index] = s->used;
    s->length[index] = length;
    memcpy(s->pieces + s->used, event, length + 1);
    s->used += length + 1;
    if (!replace_article) {
        s->is_prefix[index] = s->zone == NH_OBJECT_PREFIX;
        if (s->is_prefix[index]) ++s->prefix_count;
        ++s->count;
    }
    return 1;
}

static int
nh_object_public_delta(struct nh_object_public_snapshot *s, const char *buffer,
                       size_t expected, char *piece)
{
    size_t length, old;
    if (!s || !s->valid || !s->pending || !nh_object_public_pool_live(s)
        || buffer != s->pending_pointer)
        return 0;
    s->pending = 0;
    old = s->before_length;
    if (!nh_grammar_length(buffer, s->pending_capacity, &length)
        || length < old || length - old != expected
        || expected >= BUFSZ || memcmp(buffer, s->before, old)) return 0;
    memcpy(piece, buffer + old, expected + 1);
    if (s->zone == NH_OBJECT_PREFIX)
        memcpy(s->prefix, buffer, length + 1);
    else {
        size_t suffix = length - s->base.original_length;
        if (length < s->base.original_length || suffix >= sizeof s->suffix)
            return 0;
        memcpy(s->suffix, buffer + s->base.original_length, suffix + 1);
    }
    return 1;
}

void
nh_object_public_literal(struct nh_object_public_snapshot *s, const char *buffer,
                         const char *recipe, size_t bytes, int article)
{
    char piece[BUFSZ], escaped[BUFSZ * 6], event[NH_OBJECT_PUBLIC_JSON];
    int count;
    if (!s) return;
    if (!nh_name_id(recipe)
        || !nh_object_public_delta(s, buffer, bytes, piece)
        || !nh_name_escape(escaped, sizeof escaped, piece)) {
        s->valid = 0;
        return;
    }
    count = snprintf(event, sizeof event,
                     "{\"id\":\"%s\",\"args\":{\"original\":{"
                     "\"type\":\"text\",\"value\":\"%s\"}}}", recipe, escaped);
    if (count < 0 || (size_t)count >= sizeof event
        || !nh_object_public_store(s, event, 0)) { s->valid = 0; return; }
    if (article) {
        if (s->article || s->zone != NH_OBJECT_PREFIX) { s->valid = 0; return; }
        s->article = 1;
        s->article_index = s->count - 1;
    }
}

void
nh_object_public_number(struct nh_object_public_snapshot *s, const char *buffer,
                        const char *recipe, enum nh_object_public_number kind)
{
    char expected[BUFSZ], piece[BUFSZ], escaped[BUFSZ * 6];
    char plural[BUFSZ * 6], event[NH_OBJECT_PUBLIC_JSON];
    int length = -1, count = -1;
    unsigned required = 0;
    if (!s) return;
    if (kind == NH_OBJECT_QUANTITY) {
        required = 1;
        length = snprintf(expected, sizeof expected, "%ld ", s->public_long);
    } else if (kind == NH_OBJECT_ENCHANTMENT) {
        required = 2;
        length = snprintf(expected, sizeof expected, "%+d ", s->public_int[0]);
    } else if (kind == NH_OBJECT_CHARGES) {
        required = 6;
        length = snprintf(expected, sizeof expected, " (%d:%d)",
                          s->public_int[0], s->public_int[1]);
    } else if (kind == NH_OBJECT_CONTENT_COUNT) {
        required = 9;
        length = snprintf(expected, sizeof expected, " containing %ld item%s",
                          s->public_long, s->public_plural);
    }
    /* Reformat only the already public source inputs to verify no truncation.
     * This is an integrity check against this fixed printf source contract,
     * never an English-to-meaning reverse lookup or a new native query. */
    if (!s->valid || (s->captured & required) != required || !required
        || !nh_name_id(recipe) || length < 0
        || (size_t)length >= sizeof expected
        || !nh_object_public_delta(s, buffer, (size_t)length, piece)
        || memcmp(piece, expected, (size_t)length + 1)
        || !nh_name_escape(escaped, sizeof escaped, piece)) {
        s->valid = 0;
        return;
    }
    if (kind == NH_OBJECT_QUANTITY)
        count = snprintf(event, sizeof event,
            "{\"id\":\"%s\",\"args\":{\"original\":{\"type\":\"text\",\"value\":\"%s\"},"
            "\"value\":{\"type\":\"integer\",\"value\":%lld}}}",
            recipe, escaped, (long long)s->public_long);
    else if (kind == NH_OBJECT_ENCHANTMENT)
        count = snprintf(event, sizeof event,
            "{\"id\":\"%s\",\"args\":{\"original\":{\"type\":\"text\",\"value\":\"%s\"},"
            "\"value\":{\"type\":\"integer\",\"value\":%d}}}",
            recipe, escaped, s->public_int[0]);
    else if (kind == NH_OBJECT_CHARGES)
        count = snprintf(event, sizeof event,
            "{\"id\":\"%s\",\"args\":{\"original\":{\"type\":\"text\",\"value\":\"%s\"},"
            "\"recharged\":{\"type\":\"integer\",\"value\":%d},"
            "\"charges\":{\"type\":\"integer\",\"value\":%d}}}",
            recipe, escaped, s->public_int[0], s->public_int[1]);
    else if (nh_name_escape(plural, sizeof plural, s->public_plural))
        count = snprintf(event, sizeof event,
            "{\"id\":\"%s\",\"args\":{\"original\":{\"type\":\"text\",\"value\":\"%s\"},"
            "\"count\":{\"type\":\"integer\",\"value\":%lld},"
            "\"english_plural\":{\"type\":\"text\",\"value\":\"%s\"}}}",
            recipe, escaped, (long long)s->public_long, plural);
    if (count < 0 || (size_t)count >= sizeof event
        || !nh_object_public_store(s, event, 0)) s->valid = 0;
}

void
nh_object_public_article_finish(struct nh_object_public_snapshot *s,
                                const char *prefix)
{
    char escaped[32], event[256];
    size_t length, before, article = 0;
    int count;
    if (!s || !s->valid) return;
    /* Only the original default-article branch marks this observation. Its
     * existing just_an result may be empty, a, or an. No helper is repeated. */
    before = strlen(s->prefix);
    if (!s->article || before < 2 || s->prefix[0] != 'a'
        || s->prefix[1] != ' '
        || !nh_grammar_length(prefix, s->prefix_capacity, &length)) {
        s->valid = 0; return;
    }
    if (length >= 3 && prefix[0] == 'a' && prefix[1] == 'n' && prefix[2] == ' ')
        article = 3;
    else if (length >= 2 && prefix[0] == 'a' && prefix[1] == ' ')
        article = 2;
    if (length != before - 2 + article
        || memcmp(prefix + article, s->prefix + 2, before - 2 + 1)) {
        s->valid = 0; return;
    }
    memcpy(s->prefix, prefix, length + 1);
    if (!article) escaped[0] = '\0';
    else { memcpy(escaped, prefix, article); escaped[article] = '\0'; }
    count = snprintf(event, sizeof event,
        "{\"id\":\"nethack.name.object.public.article\",\"args\":{"
        "\"original\":{\"type\":\"text\",\"value\":\"%s\"}}}", escaped);
    if (count < 0 || (size_t)count >= sizeof event
        || !nh_object_public_store(s, event, 1)) s->valid = 0;
}

static int
nh_object_public_write(char *out, size_t capacity, size_t *used,
                       const char *text, size_t length)
{
    if (*used >= capacity || length >= capacity - *used) return 0;
    memcpy(out + *used, text, length);
    *used += length;
    out[*used] = '\0';
    return 1;
}

void
nh_object_public_bind(struct nh_object_public_snapshot *s, const char *result)
{
    char expected[BUFSZ], escaped[BUFSZ * 6], event[NH_OBJECT_PUBLIC_JSON];
    char key[96];
    struct nh_name_slot *slot;
    size_t prefix, base, suffix, length, used = 0;
    unsigned i, pass, piece = 0;
    int count;
    nh_text_name_invalidate(result);
    if (!s || !s->valid || s->pending || !s->base.source_generation
        || !nh_object_public_pool_live(s)
        || !nh_grammar_length(result, BUFSZ, &length)) return;
    s->valid = 0; /* Consume owned capture exactly once, even on failure. */
    prefix = strlen(s->prefix); base = s->base.original_length;
    suffix = strlen(s->suffix);
    if (prefix + base + suffix >= sizeof expected
        || length != prefix + base + suffix) return;
    memcpy(expected, s->prefix, prefix);
    memcpy(expected + prefix, s->base.original, base);
    memcpy(expected + prefix + base, s->suffix, suffix + 1);
    if (memcmp(result, expected, length + 1)
        || !nh_name_escape(escaped, sizeof escaped, result)) return;
    count = snprintf(event, sizeof event,
        "{\"id\":\"nethack.name.object.public.sequence_%u\",\"args\":{"
        "\"original\":{\"type\":\"text\",\"value\":\"%s\"}", s->count + 1, escaped);
    if (count < 0 || (size_t)count >= sizeof event) return;
    used = (size_t)count;
    /* Flat parts avoid depth proportional to adjective count. The owned base
     * event is inserted between original prefix and suffix observations. */
    for (pass = 0; pass < 3; ++pass) {
        if (pass == 1) {
            count = snprintf(key, sizeof key,
                ",\"part_%u\":{\"type\":\"event\",\"value\":", ++piece);
            if (count < 0 || (size_t)count >= sizeof key
                || !nh_object_public_write(event, sizeof event, &used, key, (size_t)count)
                || !nh_object_public_write(event, sizeof event, &used,
                                           s->base.event, strlen(s->base.event))
                || !nh_object_public_write(event, sizeof event, &used, "}", 1)) return;
        } else for (i = 0; i < s->count; ++i) {
            if ((pass == 0) != (s->is_prefix[i] != 0)) continue;
            count = snprintf(key, sizeof key,
                ",\"part_%u\":{\"type\":\"event\",\"value\":", ++piece);
            if (count < 0 || (size_t)count >= sizeof key
                || !nh_object_public_write(event, sizeof event, &used, key, (size_t)count)
                || !nh_object_public_write(event, sizeof event, &used,
                                           s->pieces + s->offset[i], s->length[i])
                || !nh_object_public_write(event, sizeof event, &used, "}", 1)) return;
        }
    }
    if (!nh_object_public_write(event, sizeof event, &used, "}}", 2)
        || piece != s->count + 1 || nh_name_generation == UINT64_MAX) return;
    slot = &nh_names[nh_name_next++ % NH_NAME_SLOTS];
    slot->pointer = NULL; slot->generation = 0;
    memcpy(slot->event, event, used + 1);
    memcpy(slot->original, result, length + 1);
    slot->generation = ++nh_name_generation;
    slot->pointer = result;
}
