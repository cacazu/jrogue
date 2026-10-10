/* Added 2026-10-02: isolated Phase7 proposal; NGPL. Not installed.
 * Only private presentation ownership/bytes/args are observed. No native name,
 * state, visibility, command, RNG or locale query occurs here. Original C
 * formatting and window routines remain the sole game/control-flow producers.
 */
#include "hack.h"
#include "nh-buffer-producer.h"
#include <stdint.h>
#include <string.h>

void nh_buf_invalidate(struct nh_buf_owner *owner) {
    if (!owner) return;
    owner->valid=0;owner->args_valid=0;owner->descriptor=NULL;
    owner->count=0;
    memset(owner->args,0,sizeof(owner->args));
    if (owner->generation!=UINT64_MAX) ++owner->generation;
}

uint64_t nh_buf_before_write(struct nh_buf_owner *owner,char *buffer,
                             size_t capacity,const struct nh_text_descriptor *descriptor) {
    if (!owner) return 0;
    nh_buf_invalidate(owner); /* before original overwrite, even same bytes */
    owner->buffer=buffer;owner->capacity=capacity;
    if (!buffer || !descriptor || !capacity || capacity>NH_BUF_BYTES ||
        owner->generation==UINT64_MAX) return 0;
    owner->descriptor=descriptor;owner->args_valid=1;
    return owner->generation;
}

int nh_buf_text_argument(struct nh_buf_owner *owner,size_t index,
                          const char *name,const char *text) {
    size_t length=0;
    uintptr_t source, destination;
    if (!owner || !owner->args_valid || index>=NH_BUF_ARGS || !name || !text) {
        if (owner) owner->args_valid=0;
        return 0;
    }
    /* The original full %s consumes a valid NUL-terminated technical key.
     * No precision/opaque name producer is accepted by this prototype. Read
     * one byte at a time, never memchr a guessed capacity of a smaller input. */
    while (length<NH_BUF_BYTES && text[length]) ++length;
    if (length>=NH_BUF_BYTES) { owner->args_valid=0;return 0; }
    source=(uintptr_t)text;destination=(uintptr_t)owner->buffer;
    if (source>UINTPTR_MAX-length-1 || destination>UINTPTR_MAX-owner->capacity ||
        (source<destination+owner->capacity && destination<source+length+1)) {
        owner->args_valid=0;return 0; /* input/output overlap is not certified */
    }
    memcpy(owner->text[index],text,length+1);
    owner->args[index]=(struct nh_text_argument){.name=name,.kind=NH_TEXT_TEXT,
        .text=owner->text[index],.integer=0,.event_json=NULL,.allow_name_capture=0};
    return 1;
}

void nh_buf_scalar_argument(struct nh_buf_owner *owner,size_t index,
                            const char *name,enum nh_text_argument_kind kind,int64_t value) {
    if (!owner || !owner->args_valid || index>=NH_BUF_ARGS || !name ||
        (kind!=NH_TEXT_INTEGER && kind!=NH_TEXT_UNSIGNED) ||
        (kind==NH_TEXT_UNSIGNED && (value<0 || (uint64_t)value>UINT32_MAX))) {
        if (owner) owner->args_valid=0;
        return;
    }
    owner->args[index]=(struct nh_text_argument){.name=name,.kind=kind,
        .text=NULL,.integer=value,.event_json=NULL,.allow_name_capture=0};
}

void nh_buf_after_write(struct nh_buf_owner *owner,uint64_t generation,size_t count) {
    const char *ending;
    size_t index;
    if (!owner || !generation || generation!=owner->generation ||
        !owner->descriptor || !owner->args_valid || count>NH_BUF_ARGS ||
        !owner->buffer || !owner->capacity || owner->capacity>NH_BUF_BYTES) return;
    for (index=0;index<count;++index)
        if (!owner->args[index].name ||
            (owner->args[index].kind==NH_TEXT_TEXT && !owner->args[index].text)) return;
    /* buffer capacity is the proven original char array extent. A complete
     * original NUL is required; the exact boundary is conservatively rejected
     * because Sprintf supplies no independent truncation-result evidence. */
    ending=(const char *)memchr(owner->buffer,0,owner->capacity);
    if (!ending || (size_t)(ending-owner->buffer)>=owner->capacity-1) return;
    owner->length=(size_t)(ending-owner->buffer);
    memcpy(owner->original,owner->buffer,owner->length+1);
    owner->count=count;owner->valid=1;
}

static struct nh_text_scope *nh_buf_delivery(struct nh_buf_owner *owner,
                                            const char *text,int window) {
    struct nh_text_scope *scope=NULL;
    if (owner && owner->valid && owner->descriptor && text==owner->buffer &&
        owner->generation && owner->generation!=UINT64_MAX &&
        owner->capacity && owner->capacity<=NH_BUF_BYTES &&
        owner->length<owner->capacity && owner->length<NH_BUF_BYTES &&
        !memcmp(text,owner->original,owner->length+1)) {
        /* The comparison is integrity of this exact source-issued owner, not
         * lookup of a completed English message. No generic pointer search. */
        scope=nh_text_begin(owner->descriptor,owner->args,owner->count,window);
    }
    nh_buf_invalidate(owner); /* once-only ticket; no borrowed lifetime */
    if (!scope) nh_text_cancel_pending(); /* OOM/unknown inner output barrier */
    return scope;
}

void nh_buf_putstr(struct nh_buf_owner *owner,winid window,int attr,const char *text) {
    struct nh_text_scope *scope=nh_buf_delivery(owner,text,window);
    struct nh_text_scope *previous=nh_text_emit(scope);
    putstr(window,attr,text); /* exact original API values and attributes */
    nh_text_emit(previous);nh_text_end(scope);
}

void nh_buf_add_menu_str(struct nh_buf_owner *owner,winid window,const char *text) {
    struct nh_text_scope *scope=nh_buf_delivery(owner,text,window);
    add_menu_str(window,text); /* original add_menu claim/filter/row logic */
    nh_text_end(scope);
}

void nh_buf_pline1(struct nh_buf_owner *owner,const char *text) {
    struct nh_text_scope *scope=nh_buf_delivery(owner,text,-1);
    nh_text_forward(scope); /* original vpline claims only actual message */
    pline1(text); /* original filters/Norep/history/sound/urgency remain core */
    nh_text_end(scope);
}
