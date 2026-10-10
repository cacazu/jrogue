/* SPDX-License-Identifier: GPL-2.0-only. Test ports for native boundaries only.
 * Actual web-game-history.c and web-semantic.c are assembled by the runner.
 * The Rust review boundary is an explicit stub: these tests prove C wire and
 * ownership behavior, not Rust localization acceptance or a campaign. */
#include <assert.h>
#include <stdbool.h>
#include <stdint.h>
#include <stddef.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
/* Original z-form.c is linked separately with its native utility/memory
 * dependencies; this is a declaration, not a formatter replacement. */
size_t strnfmt(char *buf,size_t max,const char *fmt,...);
static void selected_history_widget(char out[64],size_t i)
{char widget[64];/* __SELECTED_HISTORY_WIDGET_FORMAT__ */memcpy(out,widget,sizeof(widget));}
#define N_ELEMENTS(a) (sizeof(a)/sizeof((a)[0]))
#define AB_SEMANTIC_EVENT_MAX_BYTES (128U*1024U)
#define AB_NAMING_SNAPSHOT_MAX_BYTES (128U*1024U)
#define HIST_SIZE 2
#define HIST(a,b) HIST_##a,
enum {
/* __NATIVE_HISTORY_ENUM__ */
HIST_MAX };
#undef HIST
/* __NATIVE_HISTORY_STRUCT__ */
struct player_history { size_t next,length;struct history_info *entries; };
struct player { struct player_history hist; };
static struct player test_player;
static struct player *player=&test_player;
#define hist_has(flags,kind) (((flags)[((kind)-1)/8]&(1U<<(((kind)-1)%8)))!=0)
#define hist_on(flags,kind) ((flags)[((kind)-1)/8]|=(1U<<(((kind)-1)%8)))
#define hist_off(flags,kind) ((flags)[((kind)-1)/8]&=~(1U<<(((kind)-1)%8)))
/* __NATIVE_SEMANTIC_STRUCT__ */
/* __NATIVE_UI_PARAM_STRUCT__ */
struct ab_naming_snapshot { char *json;uint32_t length; };
static uint8_t wire_bytes[4U*1024U*1024U];
static size_t wire_length,wire_position;
static bool forced_review_rejection;
static unsigned host_event_count;
static char last_host_event[131073];
void wr_byte(uint8_t value){assert(wire_length<sizeof(wire_bytes));wire_bytes[wire_length++]=value;}
void wr_u32b(uint32_t value){unsigned i;for(i=0;i<4;i++)wr_byte((uint8_t)(value>>(8*i)));}
void rd_byte(uint8_t *out){assert(wire_position<wire_length);*out=wire_bytes[wire_position++];}
void rd_u32b(uint32_t *out){unsigned i;*out=0;for(i=0;i<4;i++){uint8_t v;rd_byte(&v);*out|=(uint32_t)v<<(8*i);}}
size_t ab_web_save_bytes_remaining(void){assert(wire_position<=wire_length);return wire_length-wire_position;}
const char *ab_rs_message(const char *id){return id;}
void ab_host_message(const char *id,const char *localized){(void)id;(void)localized;}
const char *ab_rs_review_event(const uint8_t *bytes,uint32_t length)
{assert(bytes && length && length<=AB_SEMANTIC_EVENT_MAX_BYTES);return forced_review_rejection?NULL:"reviewed-test-boundary";}
uint32_t ab_rs_review_status(void){return forced_review_rejection?27:0;}
void ab_host_semantic_event(const char *json,uint32_t length,const char *localized)
{assert(length<sizeof(last_host_event));assert(localized);memcpy(last_host_event,json,length);last_host_event[length]=0;host_event_count++;}
/* Explicit external message-storage boundaries. History wire fixtures do
 * not own native message queues, coalescing, eviction or recall sidecars;
 * the separate actual-C recall fixture verifies those behaviors. */
void ab_message_recall_capture_event(const struct ab_semantic_event *event){(void)event;}
void ab_message_recall_pending_discard(void){}
void ab_message_recall_capture_static(const char *id){(void)id;}
void ab_naming_snapshot_release(struct ab_naming_snapshot *s){free(s->json);s->json=NULL;s->length=0;}
static bool naming_test_copy(struct ab_naming_snapshot *s,const char *native_buffer,bool object)
{
 const char *json=object?"{\"schema_version\":2,\"native_max_bytes\":80,\"mode\":0,\"parts\":[{\"kind\":\"literal\",\"name_id\":\"object.artifact.fixture\"}],\"complete\":true}":"{\"schema_version\":2,\"native_max_bytes\":80,\"mode\":0,\"parts\":[{\"kind\":\"race\",\"name_id\":\"monster.fixture.name\"}],\"complete\":true}";
 size_t n=strlen(json);assert(native_buffer);s->json=malloc(n+1);assert(s->json);memcpy(s->json,json,n+1);s->length=(uint32_t)n;return true;
}
bool ab_naming_copy_monster_snapshot(struct ab_naming_snapshot *s,const char *b){return naming_test_copy(s,b,false);}
bool ab_naming_copy_object_snapshot(struct ab_naming_snapshot *s,const char *b){return naming_test_copy(s,b,true);}
void ab_naming_param_snapshot(struct ab_semantic_event *event,const char *name,const char *type,const struct ab_naming_snapshot *snapshot);
void ab_character_export_emit(const char *id,const struct ab_ui_param *p,size_t count){(void)id;(void)p;(void)count;}

void ab_character_export_reject(void){}
