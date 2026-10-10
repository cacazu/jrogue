/* Added 2026-10-02: proposal-only native delivery observations; NGPL.
 * No locale, name, RNG, command, predicate or hidden-state query is made.
 * Original English C calls, buffers, files and journal records remain intact.
 */
#include "hack.h"
#include "nh-native-api.h"
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

struct nh_native_text_value nh_native_value(const char *original,const char *event) {
    struct nh_native_text_value value={original,event};return value;
}

static struct nh_text_scope *nh_native_config_scope(struct nh_text_scope *owner,
    const struct nh_text_descriptor *descriptor, struct nh_native_text_value label,
    const char *line, int line_number, const char *message,struct nh_native_text_value punct) {
    char *event=nh_text_native_event_copy(owner);
    struct nh_text_scope *scope;
    struct nh_text_argument args[4]={{"label",NH_TEXT_TEXT,label.original,0,label.event,0},
                                   {"message",NH_TEXT_TEXT,message,0,event,0},
                                   {"punct",NH_TEXT_TEXT,punct.original,0,punct.event,0}};
    size_t count=3;
    char line_event[192];
    if (!event || !label.event || !punct.event) { free(event);return NULL; }
    if (line) {
        args[3]=(struct nh_text_argument){"line",NH_TEXT_TEXT,line,0,NULL,0};
        if (line_number>0) {
            int n=snprintf(line_event,sizeof line_event,
                "{\"id\":\"nethack.native.config.line\",\"args\":{\"number\":{\"type\":\"integer\",\"value\":%d}}}",line_number);
            if (n<=0 || (size_t)n>=sizeof line_event) { free(event);return NULL; }
            args[3].event_json=line_event;
        } else if (*line) { free(event);return NULL; }
        ++count;
    }
    scope=nh_text_begin(descriptor,args,count,-1);free(event);return scope;
}

void nh_native_config_plain(struct nh_text_scope *owner,const char *format,
    struct nh_native_text_value label,const char *message,struct nh_native_text_value punct) {
    static const struct nh_text_descriptor descriptor={"nethack.native.config.plain","config_error_add",NH_TEXT_MESSAGE,NH_TEXT_PLAIN};
    struct nh_text_scope *scope=nh_native_config_scope(owner,&descriptor,label,NULL,0,message,punct);
    if (!scope) nh_text_cancel_pending();
    nh_text_forward(scope);
    pline(format,label.original,message,punct.original);
    nh_text_end(scope);
}

void nh_native_config_framed(struct nh_text_scope *owner,const char *format,
    struct nh_native_text_value label,const char *line,int line_number,
    const char *message,struct nh_native_text_value punct) {
    static const struct nh_text_descriptor descriptor={"nethack.native.config.framed","config_error_add",NH_TEXT_MESSAGE,NH_TEXT_PLAIN};
    struct nh_text_scope *scope=nh_native_config_scope(owner,&descriptor,label,line,line_number,message,punct);
    if (!scope) nh_text_cancel_pending();
    nh_text_forward(scope);
    pline(format,label.original,line,message,punct.original);
    nh_text_end(scope);
}

/* Journal sidecars stay private in C. A saved/restored node without source
 * provenance has no semantic record. No live-log file result emits UI data. */
#define NH_NATIVE_LOG_RECORDS 4096U
#define NH_NATIVE_LOG_BYTES (8U*1024U*1024U)
struct nh_native_log_record {
    const void *key;
    char *text,*event;
    size_t bytes;
    uint64_t epoch;
    struct nh_native_log_record *next;
};
static struct nh_native_log_record *nh_native_logs;
static struct nh_native_log_capture_state nh_native_log_pending;
static size_t nh_native_log_count,nh_native_log_bytes;
static uint64_t nh_native_log_epoch;

struct nh_native_log_capture_state nh_native_log_capture(struct nh_text_scope *owner,const char *expected_text) {
    struct nh_native_log_capture_state previous=nh_native_log_pending;
    nh_native_log_pending.owner=owner;nh_native_log_pending.expected_text=expected_text;return previous;
}
void nh_native_log_restore(struct nh_native_log_capture_state previous) {
    nh_native_log_pending=previous;
}

void nh_native_log_forget(const void *key) {
    struct nh_native_log_record **link=&nh_native_logs;
    while (*link) {
        struct nh_native_log_record *record=*link;
        if (record->key!=key) { link=&record->next;continue; }
        *link=record->next;--nh_native_log_count;nh_native_log_bytes-=record->bytes;
        free(record->text);free(record->event);free(record);return;
    }
}

void nh_native_log_bind(const void *key,const char *text) {
    struct nh_native_log_record *record;
    char *event;
    size_t length,bytes;
    nh_native_log_forget(key); /* pointer reuse, including raw restore, fails closed */
    if (!key || !text || !nh_native_log_pending.owner || text!=nh_native_log_pending.expected_text ||
        nh_native_log_count>=NH_NATIVE_LOG_RECORDS ||
        nh_native_log_epoch==UINT64_MAX) return;
    length=strlen(text);
    if (length>=BUFSZ*2-1) return;
    event=nh_text_native_event_copy(nh_native_log_pending.owner);
    if (!event) return;
    bytes=sizeof(*record)+length+1+strlen(event)+1;
    if (bytes>NH_NATIVE_LOG_BYTES-nh_native_log_bytes) { free(event);return; }
    record=(struct nh_native_log_record *)calloc(1,sizeof(*record));
    if (!record) { free(event);return; }
    record->text=(char *)malloc(length+1);
    if (!record->text) { free(event);free(record);return; }
    memcpy(record->text,text,length+1);
    record->key=key;record->event=event;record->bytes=bytes;record->epoch=++nh_native_log_epoch;
    record->next=nh_native_logs;nh_native_logs=record;
    ++nh_native_log_count;nh_native_log_bytes+=bytes;
}

struct nh_text_scope *nh_native_log_line(const void *key,const char *text,long turn,
                                       int window,const char *original_line) {
    struct nh_native_log_record *record;
    static const struct nh_text_descriptor descriptor={"nethack.native.chronicle.line","livelog_printf",NH_TEXT_PUTSTR,NH_TEXT_PLAIN};
    struct nh_text_argument args[2]={{"turn",NH_TEXT_INTEGER,NULL,0,NULL,0},
                                   {"message",NH_TEXT_TEXT,NULL,0,NULL,0}};
    if (!text || !original_line || strlen(original_line)>=BUFSZ-1) return NULL;
    for (record=nh_native_logs;record;record=record->next) {
        if (record->key!=key) continue;
        if (!record->epoch || strcmp(record->text,text)) return NULL; /* exact original record integrity only */
        args[0].integer=(int64_t)turn;args[1].text=text;args[1].event_json=record->event;
        return nh_text_begin(&descriptor,args,2,window);
    }
    return NULL;
}
