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
