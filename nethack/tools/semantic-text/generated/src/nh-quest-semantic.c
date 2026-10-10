/* Added 2026-10-02: bounded quest presentation capture; NGPL.
 * Original quest.lua, selection RNG, name producers, modifiers, English
 * window lines, filtering and message history remain authoritative.
 * This observer copies values only after their original native production.
 */
#include "hack.h"
#include "nh-quest-semantic.h"
#include <limits.h>

#define NH_QUEST_MAX_ARGS 64
#define NH_QUEST_MAX_STRING 65536
#define NH_QUEST_MAX_LINES 4096
struct nh_quest_binding { const char *name; char code, modifier; };
struct nh_quest_descriptor {
    const char *section, *message_id, *field, *id, *source_template;
    uint32_t item_index;
    const struct nh_quest_binding *bindings;
    size_t count;
};
#include "nh-quest-semantic-data.h"

struct nh_quest_group {
    struct nh_quest_group *parent;
    const struct nh_quest_descriptor *descriptor;
    struct nh_text_descriptor text_descriptor;
    struct nh_text_argument arguments[NH_QUEST_MAX_ARGS];
    char *values[NH_QUEST_MAX_ARGS];
    uint32_t sequence, line_index, line_count;
    int invalid;
};
static struct nh_quest_group *nh_quest_active;
static uint32_t nh_quest_sequence; /* presentation only; reset by a fresh module */

static char *nh_quest_copy(const char *source, size_t count) {
    char *copy;
    if (!source || count > NH_QUEST_MAX_STRING) return NULL;
    copy=(char *)malloc(count + 1);
    if (copy) { memcpy(copy,source,count);copy[count]='\0'; }
    return copy;
}
static size_t nh_quest_length(const char *source) {
    size_t count=0;
    if (!source) return NH_QUEST_MAX_STRING + 1;
    while (count <= NH_QUEST_MAX_STRING && source[count]) ++count;
    return count;
}
static uint32_t nh_quest_lines(const char *source, int *invalid) {
    size_t offset=0, length=nh_quest_length(source);
    uint32_t count=0;
    if (length > NH_QUEST_MAX_STRING) { *invalid=1;return 0; }
    while (offset < length) {
        size_t n=0;
        while (n < BUFSZ - 1 && offset + n < length && source[offset+n] != '\n') ++n;
        /* Official delivery skips one byte after every copynchars segment.
         * A too-long unbroken segment is therefore ineligible for whole
         * paragraph replacement; its exact original rows still display. */
        if (offset + n < length && source[offset+n] != '\n') *invalid=1;
        offset+=n+1;
        if (++count > NH_QUEST_MAX_LINES) { *invalid=1;return 0; }
    }
    return count;
}
struct nh_quest_group *nh_quest_begin(const char *section,const char *message_id,
                                     uint32_t item_index,const char *source) {
    struct nh_quest_group *group=(struct nh_quest_group *)calloc(1,sizeof(*group));
    size_t i;
    if (!group) { nh_quest_active=NULL;return NULL; } /* never inherit an outer quest */
    group->parent=nh_quest_active;nh_quest_active=group;
    for (i=0;i<sizeof(nh_quest_descriptors)/sizeof(nh_quest_descriptors[0]);++i) {
        const struct nh_quest_descriptor *d=nh_quest_descriptors+i;
        if (d->item_index == item_index && !strcmp(d->section,section) &&
            !strcmp(d->message_id,message_id) && strcmp(d->field,"synopsis")) {
            group->descriptor=d;break;
        }
    }
    if (!group->descriptor || nh_quest_sequence == UINT32_MAX) group->invalid=1;
    else {
        const struct nh_quest_descriptor *d=group->descriptor;
        size_t length=nh_quest_length(source);
        group->sequence=++nh_quest_sequence;
        group->text_descriptor.id=d->id;group->text_descriptor.api="questpgr";
        group->text_descriptor.helper=NH_TEXT_PLAIN;
        /* Byte integrity verifies a source-selected descriptor. The lookup
         * above uses section/msgid/index only, never completed English. */
        if (length > NH_QUEST_MAX_STRING || strcmp(source,d->source_template) ||
            d->count > NH_QUEST_MAX_ARGS) group->invalid=1;
        else group->line_count=nh_quest_lines(source,&group->invalid);
        if (!group->line_count) group->invalid=1;
    }
    return group;
}
void nh_quest_end(struct nh_quest_group *group) {
    size_t i;
    if (!group) return;
    if (nh_quest_active == group) nh_quest_active=group->parent;
    else nh_quest_active=NULL;
    for (i=0;i<NH_QUEST_MAX_ARGS;++i) free(group->values[i]);
    free(group);
}
static void nh_quest_value(char code,char modifier,const char *source,size_t length) {
    struct nh_quest_group *group=nh_quest_active;
    size_t i;
    if (!group || group->invalid) return;
    if (length > NH_QUEST_MAX_STRING) { group->invalid=1;return; }
    for (i=0;i<group->descriptor->count;++i) {
        const struct nh_quest_binding *b=group->descriptor->bindings+i;
        if (b->code != code || b->modifier != modifier) continue;
        if (group->values[i]) {
            if (strlen(group->values[i]) != length || memcmp(group->values[i],source,length))
                group->invalid=1; /* one slot cannot represent conflicting native observations */
        } else {
            group->values[i]=nh_quest_copy(source,length);
            if (!group->values[i]) group->invalid=1;
        }
    }
}
void nh_quest_base(char code,const char *source) {
    nh_quest_value(code,'\0',source,nh_quest_length(source));
}
void nh_quest_modified(char code,char modifier,const char *source,size_t length) {
    nh_quest_value(code,modifier,source,length);
}
struct nh_text_scope *nh_quest_line(enum nh_text_kind kind,int window,const char *decoded) {
    struct nh_quest_group *group=nh_quest_active;
    struct nh_text_scope *scope;
    struct nh_text_quest_context context;
    size_t i, count=0;
    int complete=1;
    if (!group || group->invalid || group->line_index >= group->line_count) {
        nh_text_cancel_pending();return NULL;
    }
    for (i=0;i<group->descriptor->count;++i) {
        struct nh_text_argument *a;
        if (!group->values[i]) { complete=0;continue; }
        a=group->arguments+count++;
        a->name=group->descriptor->bindings[i].name;a->kind=NH_TEXT_TEXT;
        a->text=group->values[i];a->integer=0;a->event_json=NULL;
    }
    group->text_descriptor.kind=kind;
    scope=nh_text_begin(&group->text_descriptor,group->arguments,count,window);
    if (!scope) return NULL;
    memset(&context,0,sizeof(context));
    context.sequence=group->sequence;context.line_index=group->line_index;
    context.line_count=group->line_count;context.item_index=group->descriptor->item_index;
    context.window=window;context.final=(group->line_index+1 == group->line_count);
    context.capture_complete=complete;context.section=group->descriptor->section;
    context.message_id=group->descriptor->message_id;context.field=group->descriptor->field;
    context.source_template=group->descriptor->source_template;context.decoded_line=decoded;
    nh_text_quest(scope,&context);
    return scope;
}
void nh_quest_line_done(struct nh_text_scope *scope) {
    nh_text_end(scope);
    if (nh_quest_active && nh_quest_active->line_index < UINT32_MAX)
        ++nh_quest_active->line_index;
}
