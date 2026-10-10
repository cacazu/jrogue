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
    char original[BUFSZ];
    char event[NH_NAME_JSON];
};
static struct nh_name_slot nh_names[NH_NAME_SLOTS];
static unsigned nh_name_next;

void nh_text_name_invalidate(const char *pointer) {
    unsigned i;
    for (i = 0; i < NH_NAME_SLOTS; ++i)
        if (nh_names[i].pointer == pointer) nh_names[i].pointer = NULL;
}

void nh_text_name_invalidate_range(const char *pointer, size_t length) {
    unsigned i;
    uintptr_t start = (uintptr_t)pointer;
    for (i = 0; i < NH_NAME_SLOTS; ++i) {
        uintptr_t candidate = (uintptr_t)nh_names[i].pointer;
        if (candidate >= start && candidate - start < length)
            nh_names[i].pointer = NULL;
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
    slot->pointer = NULL;
    count = snprintf(slot->event, sizeof slot->event,
        "{\"id\":\"%s\",\"args\":{"
        "\"original\":{\"type\":\"text\",\"value\":\"%s\"},"
        "\"name\":{\"type\":\"text_id\",\"value\":\"%s\"}}}",
        recipe, escaped, label);
    if (count < 0 || (size_t)count >= sizeof slot->event) return;
    memcpy(slot->original, buffer, length + 1);
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
    slot->pointer = NULL;
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
    slot->pointer = buffer;
}

const char *nh_text_name_event(const char *public_text) {
    unsigned i;
    if (!public_text) return NULL;
    for (i = 0; i < NH_NAME_SLOTS; ++i) {
        struct nh_name_slot *slot = nh_names + i;
        if (slot->pointer == public_text) {
            if (!strcmp(slot->original, public_text)) return slot->event;
            slot->pointer = NULL;
        }
    }
    return NULL;
}
