/* Added 2026-10-02: bounded, source-selected semantic text observations.
 * Integration code distributed under the NGPL; preserve upstream notices.
 * Original English remains the sole input to core history, filtering, sound,
 * logs and helper functions. This file owns only presentation allocations.
 */
#include "hack.h"
#include "nh-semantic.h"
#include "nh-semantic-name.h"
#include <inttypes.h>
#include <limits.h>
#include <emscripten/emscripten.h>

#define NH_TEXT_MAX_ARGS 64
#define NH_TEXT_MAX_STRING 65536
#define NH_TEXT_MAX_JSON 262144
#define NH_TEXT_MAX_ID 160
_Static_assert(sizeof(long) == 4 && sizeof(int) == 4,
               "Semantic integer transport currently requires the verified C32 target");

struct nh_text_scope {
    struct nh_text_scope *parent;
    const struct nh_text_descriptor *descriptor;
    struct nh_text_argument *arguments;
    size_t count;
    int window, pending, invalid;
    const char *variant;
    char *location, *json;
    struct nh_text_quest_context *quest;
};
struct nh_text_writer { char *data; size_t used, capacity; int invalid; };
static struct nh_text_scope *nh_text_active, *nh_text_forwarded, *nh_text_emission;

/* NUL terminates the same public C string consumed by upstream printf.
 * Embedded control characters are escaped below; invalid UTF-8 fails closed.
 */
static int nh_text_utf8(const char *text, size_t *length) {
    const unsigned char *p=(const unsigned char *)text;
    size_t n=0, i=0;
    if (!text) return 0;
    while (n <= NH_TEXT_MAX_STRING && p[n]) ++n;
    if (n > NH_TEXT_MAX_STRING) return 0;
    while (i < n) {
        unsigned c=p[i++], need=0, low=0x80, high=0xbf;
        if (c < 0x80) continue;
        if (c >= 0xc2 && c <= 0xdf) need=1;
        else if (c >= 0xe0 && c <= 0xef) {
            need=2;
            if (c == 0xe0) low=0xa0;
            if (c == 0xed) high=0x9f;
        } else if (c >= 0xf0 && c <= 0xf4) {
            need=3;
            if (c == 0xf0) low=0x90;
            if (c == 0xf4) high=0x8f;
        } else return 0;
        if (i + need > n || p[i] < low || p[i] > high) return 0;
        ++i;
        while (--need) { if (p[i] < 0x80 || p[i] > 0xbf) return 0; ++i; }
    }
    *length=n;
    return 1;
}
static char *nh_text_copy(const char *text) {
    size_t length;
    char *copy;
    if (!nh_text_utf8(text, &length)) return NULL;
    copy=(char *)malloc(length + 1);
    if (copy) memcpy(copy,text,length + 1);
    return copy;
}
static int nh_text_ascii_id(const char *text) {
    size_t i;
    if (!text || text[0] < 'a' || text[0] > 'z') return 0;
    for (i=0;text[i];++i) {
        unsigned char c=(unsigned char)text[i];
        if (i >= NH_TEXT_MAX_ID || !((c >= 'a' && c <= 'z') ||
            (c >= '0' && c <= '9') || c == '_' || c == '.')) return 0;
    }
    return i != 0;
}
static void nh_text_append(struct nh_text_writer *w,const char *s,size_t n) {
    size_t need=w->used + n + 1, capacity;
    char *data;
    if (w->invalid) return;
    if (need > NH_TEXT_MAX_JSON) { w->invalid=1; return; }
    if (need > w->capacity) {
        capacity=w->capacity ? w->capacity : 256;
        while (capacity < need) capacity*=2;
        if (capacity > NH_TEXT_MAX_JSON) capacity=NH_TEXT_MAX_JSON;
        data=(char *)realloc(w->data,capacity);
        if (!data) { w->invalid=1; return; }
        w->data=data;w->capacity=capacity;
    }
    memcpy(w->data + w->used,s,n);w->used+=n;w->data[w->used]='\0';
}
static void nh_text_literal(struct nh_text_writer *w,const char *s) {
    nh_text_append(w,s,strlen(s));
}
static void nh_text_string(struct nh_text_writer *w,const char *text) {
    static const char hex[]="0123456789abcdef";
    size_t length, i;
    if (!nh_text_utf8(text,&length)) { w->invalid=1; return; }
    nh_text_literal(w,"\"");
    for (i=0;i<length;++i) {
        unsigned char c=(unsigned char)text[i];
        if (c == '"' || c == '\\') {
            char escaped[2]={'\\',(char)c};nh_text_append(w,escaped,2);
        } else if (c < 0x20) {
            char escaped[6]={'\\','u','0','0',hex[c>>4],hex[c&15]};
            nh_text_append(w,escaped,6);
        } else nh_text_append(w,text+i,1);
    }
    nh_text_literal(w,"\"");
}
static const char *nh_text_variant(enum nh_text_helper helper) {
    switch (helper) {
    case NH_TEXT_FEEL: return Unaware ? "dream" : "plain";
    case NH_TEXT_HEAR: return Underwater ? "underwater" : (Unaware ? "dream" : "plain");
    case NH_TEXT_SEE: return Unaware ? "dream" : (Blind ? "blind" : "plain");
    case NH_TEXT_QUOTED: return "quoted";
    default: return "plain";
    }
}
static void nh_text_json(struct nh_text_scope *scope) {
    struct nh_text_writer w={0};
    size_t i;
    free(scope->json);scope->json=NULL;
    if (scope->invalid) return;
    nh_text_literal(&w,"{\"event\":{\"id\":");nh_text_string(&w,scope->descriptor->id);
    nh_text_literal(&w,",\"args\":{");
    for (i=0;i<scope->count;++i) {
        const struct nh_text_argument *a=scope->arguments+i;
        if (i) nh_text_literal(&w,",");
        nh_text_string(&w,a->name);nh_text_literal(&w,":{\"type\":");
        nh_text_string(&w,a->kind == NH_TEXT_TEXT ? (a->event_json ? "event" : "text") :
                       (a->kind == NH_TEXT_UNSIGNED ? "unsigned" : "integer"));
        nh_text_literal(&w,",\"value\":");
        if (a->kind == NH_TEXT_TEXT) {
            if (a->event_json) nh_text_literal(&w,a->event_json);
            else nh_text_string(&w,a->text);
        }
        else {
            char number[32];int n=snprintf(number,sizeof(number),"%" PRId64,a->integer);
            if (n <= 0 || (size_t)n >= sizeof(number)) w.invalid=1;
            else nh_text_append(&w,number,(size_t)n);
        }
        nh_text_literal(&w,"}");
    }
    nh_text_literal(&w,"}},\"context\":{\"api\":");nh_text_string(&w,scope->descriptor->api);
    nh_text_literal(&w,",\"helperVariant\":");nh_text_string(&w,scope->variant);
    if (scope->location) {
        nh_text_literal(&w,",\"locationPrefix\":");nh_text_string(&w,scope->location);
    }
    if (scope->quest) {
        const struct nh_text_quest_context *q=scope->quest;
        char numbers[192];
        int n=snprintf(numbers,sizeof(numbers),
            ",\"quest\":{\"sequence\":%" PRIu32 ",\"lineIndex\":%" PRIu32
            ",\"lineCount\":%" PRIu32 ",\"itemIndex\":%" PRIu32
            ",\"window\":%d,\"final\":%s,\"captureComplete\":%s",
            q->sequence,q->line_index,q->line_count,q->item_index,q->window,
            q->final ? "true" : "false",q->capture_complete ? "true" : "false");
        if (n <= 0 || (size_t)n >= sizeof(numbers)) w.invalid=1;
        else nh_text_append(&w,numbers,(size_t)n);
        nh_text_literal(&w,",\"resolvedSection\":");nh_text_string(&w,q->section);
        nh_text_literal(&w,",\"resolvedMessageId\":");nh_text_string(&w,q->message_id);
        nh_text_literal(&w,",\"field\":");nh_text_string(&w,q->field);
        nh_text_literal(&w,",\"sourceTemplate\":");nh_text_string(&w,q->source_template);
        nh_text_literal(&w,",\"decodedLine\":");nh_text_string(&w,q->decoded_line);
        nh_text_literal(&w,"}");
    }
    nh_text_literal(&w,"}}");
    if (w.invalid) { free(w.data);scope->invalid=1; }
    else scope->json=w.data;
}
struct nh_text_scope *nh_text_begin(const struct nh_text_descriptor *d,
                                   const struct nh_text_argument *arguments,
                                   size_t count,int window) {
    struct nh_text_scope *scope;
    size_t i;
    if (!d || count > NH_TEXT_MAX_ARGS || (count && !arguments)) {
        nh_text_cancel_pending();return NULL;
    }
    scope=(struct nh_text_scope *)calloc(1,sizeof(*scope));
    if (!scope) { nh_text_cancel_pending();return NULL; }
    scope->parent=nh_text_active;scope->descriptor=d;scope->count=count;
    scope->window=window;scope->pending=1;scope->variant=nh_text_variant(d->helper);
    scope->invalid=!nh_text_ascii_id(d->id);
    if (count) {
        scope->arguments=(struct nh_text_argument *)calloc(count,sizeof(*scope->arguments));
        if (!scope->arguments) { scope->count=0;scope->invalid=1; }
        else for (i=0;i<count;++i) {
            struct nh_text_argument *a=scope->arguments+i;
            *a=arguments[i];
            if (!nh_text_ascii_id(a->name)) scope->invalid=1;
            if (a->kind == NH_TEXT_TEXT) {
                /* Snapshot descriptor before copying the original pointer.
                 * The registry already chose the public name at its native
                 * producer; this lookup performs no name call or RNG. */
                const char *event=arguments[i].event_json;
                if (!event) event=nh_text_name_event(a->text);
                a->event_json=event ? nh_text_copy(event) : NULL;
                if (event && !a->event_json) scope->invalid=1;
                a->text=nh_text_copy(a->text);
                if (!a->text) scope->invalid=1;
            } else if (a->kind == NH_TEXT_INTEGER) {
                if (a->integer < INT32_MIN || a->integer > INT32_MAX) scope->invalid=1;
            } else if (a->kind == NH_TEXT_UNSIGNED) {
                if (a->integer < 0 || (uint64_t)a->integer > UINT32_MAX) scope->invalid=1;
            } else scope->invalid=1;
        }
    }
    nh_text_json(scope);nh_text_active=scope;
    return scope;
}
const char *nh_text_captured_text(const struct nh_text_scope *scope,size_t index,
                                  const char *original) {
    if (scope && index < scope->count && scope->arguments[index].kind == NH_TEXT_TEXT && scope->arguments[index].text)
        return scope->arguments[index].text;
    return original;
}
void nh_text_end(struct nh_text_scope *scope) {
    size_t i;
    if (!scope) return;
    if (nh_text_active == scope) nh_text_active=scope->parent;
    else nh_text_active=NULL; /* fail closed instead of leaking a stale owner */
    if (nh_text_forwarded == scope) nh_text_forwarded=NULL;
    if (nh_text_emission == scope) nh_text_emission=NULL;
    for (i=0;i<scope->count;++i) if (scope->arguments[i].kind == NH_TEXT_TEXT) {
        free((void *)scope->arguments[i].text);
        free((void *)scope->arguments[i].event_json);
    }
    if (scope->quest) {
        free((void *)scope->quest->section);free((void *)scope->quest->message_id);
        free((void *)scope->quest->field);free((void *)scope->quest->source_template);
        free((void *)scope->quest->decoded_line);free(scope->quest);
    }
    free(scope->arguments);free(scope->location);free(scope->json);free(scope);
}
struct nh_text_scope *nh_text_claim(enum nh_text_kind kind) {
    struct nh_text_scope *scope;
    if (kind == NH_TEXT_MESSAGE && nh_text_forwarded) {
        scope=nh_text_forwarded;nh_text_forwarded=NULL;return scope;
    }
    scope=nh_text_active;
    if (!scope || !scope->pending || scope->descriptor->kind != kind) return NULL;
    scope->pending=0;return scope;
}
void nh_text_cancel_pending(void) {
    /* If an inner wrapper cannot allocate its owner, its original emission
     * must not consume an outer wrapper's pending ID. Degrade that observer
     * to English while keeping scope lifetimes and engine control intact. */
    if (nh_text_active) nh_text_active->pending=0;
    nh_text_forwarded=NULL;
}
void nh_text_forward(struct nh_text_scope *scope) { nh_text_forwarded=scope; }
struct nh_text_scope *nh_text_emit(struct nh_text_scope *scope) {
    struct nh_text_scope *previous=nh_text_emission;
    nh_text_emission=scope;return previous;
}
void nh_text_location(struct nh_text_scope *scope,const char *location) {
    if (!scope) return;
    free(scope->location);scope->location=nh_text_copy(location);
    if (!scope->location) scope->invalid=1;
    nh_text_json(scope);
}
void nh_text_truncated(struct nh_text_scope *scope) {
    if (scope) scope->invalid=1;
}
void nh_text_quest(struct nh_text_scope *scope,const struct nh_text_quest_context *q) {
    struct nh_text_quest_context *copy;
    if (!scope || !q || scope->quest) return;
    if (!q->field || !q->section || !q->message_id || !q->source_template || !q->decoded_line ||
        !q->sequence || !q->line_count || q->line_count > 4096 ||
        q->line_index >= q->line_count ||
        !!q->final != (q->line_index + 1 == q->line_count) ||
        (strcmp(q->field,"text") && strcmp(q->field,"item")) ||
        ((!strcmp(q->field,"text")) != (q->item_index == 0))) {
        scope->invalid=1;return;
    }
    copy=(struct nh_text_quest_context *)calloc(1,sizeof(*copy));
    if (!copy) { scope->invalid=1;return; }
    *copy=*q;scope->quest=copy;
    copy->section=nh_text_copy(q->section);copy->message_id=nh_text_copy(q->message_id);
    copy->field=nh_text_copy(q->field);copy->source_template=nh_text_copy(q->source_template);
    copy->decoded_line=nh_text_copy(q->decoded_line);
    if (!copy->section || !copy->message_id || !copy->field ||
        !copy->source_template || !copy->decoded_line ||
        strlen(copy->section) > NH_TEXT_MAX_ID || strlen(copy->message_id) > NH_TEXT_MAX_ID)
        scope->invalid=1;
    nh_text_json(scope);
}
EMSCRIPTEN_KEEPALIVE const char *nh_abi_semantic_event(const char *callback,int window) {
    const struct nh_text_scope *s=nh_text_emission;
    enum nh_text_kind kind;
    int raw;
    if (!s || s->invalid || !s->json || !callback) return NULL;
    if (s->quest && (strcmp(callback,"shim_putstr") || window != s->quest->window)) return NULL;
    kind=s->descriptor->kind;
    raw=!strcmp(callback,"shim_raw_print") || !strcmp(callback,"shim_raw_print_bold");
    if (kind == NH_TEXT_MESSAGE && ((!strcmp(callback,"shim_putstr") && window == WIN_MESSAGE) || (raw && window == -1))) return s->json;
    if (kind == NH_TEXT_RAW && raw && window == -1) return s->json;
    if (kind == NH_TEXT_PUTSTR && !strcmp(callback,"shim_putstr") && window == s->window) return s->json;
    if (kind == NH_TEXT_MENU_ROW && !strcmp(callback,"shim_add_menu") && window == s->window) return s->json;
    if (kind == NH_TEXT_MENU_END && !strcmp(callback,"shim_end_menu") && window == s->window) return s->json;
    if (kind == NH_TEXT_QUESTION && ((!strcmp(callback,"shim_yn_function") && window == -1) || !strcmp(callback,"shim_end_menu"))) return s->json;
    return NULL;
}
