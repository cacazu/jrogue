/* SPDX-License-Identifier: GPL-2.0-only */
/* Parallel browser ledger provenance. Native history storage is unchanged. */
#include "angband.h"
#include "web-game-history.h"
#ifdef __EMSCRIPTEN__
#include "player-history.h"
#include "savefile.h"
#include "web-naming.h"
#include "web-semantic.h"
#include "web-ui-text.h"
#include "web-character-matrix.h"
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#define GH_MAX_ROWS 65536U
#define GH_MAX_REFERENCE (128U*1024U)
#define GH_MAX_TOTAL (32U*1024U*1024U)
#define GH_WIRE_VERSION 1U
#define GH_FNV_OFFSET UINT32_C(2166136261)
#define GH_FNV_PRIME UINT32_C(16777619)
enum gh_kind { GH_UNKNOWN,GH_BIRTH,GH_LEVEL,GH_UNIQUE,GH_FOUND,GH_MISSED,GH_SAY,GH_ACTION,GH_NOTE };
struct gh_binding { int32_t turn;int16_t dlev,clev;uint8_t aidx;char event[80]; };
struct gh_row { struct gh_binding native;enum gh_kind kind;char *reference;uint32_t length; };
struct gh_pending { struct gh_row value;const char *event_buffer; };
static struct gh_row *rows;
static size_t row_count,row_capacity,total_bytes;
static struct gh_pending pending;
static struct ab_naming_snapshot artifact_name;
static uint32_t gh_status;
#include "../migration/game-history-data/catalog-digest.inc"
extern uint32_t ab_rs_review_status(void);
static const char *kind_id(enum gh_kind kind)
{
 switch(kind) {
 case GH_BIRTH:return "angband.game_history.birth";
 case GH_LEVEL:return "angband.game_history.level";
 case GH_UNIQUE:return "angband.game_history.slain_unique";
 case GH_FOUND:return "angband.game_history.found_artifact";
 case GH_MISSED:return "angband.game_history.missed_artifact";
 case GH_SAY:return "angband.game_history.note_say";
 case GH_ACTION:return "angband.game_history.note_action";
 case GH_NOTE:return "angband.game_history.note";
 default:return NULL;
 }
}
static bool kind_matches(enum gh_kind kind,const struct history_info *row)
{
 switch(kind) {
 case GH_BIRTH:return hist_has(row->type,HIST_PLAYER_BIRTH);
 case GH_LEVEL:return hist_has(row->type,HIST_GAIN_LEVEL);
 case GH_UNIQUE:return hist_has(row->type,HIST_SLAY_UNIQUE);
 case GH_FOUND:case GH_MISSED:
  return row->a_idx && (hist_has(row->type,HIST_ARTIFACT_KNOWN) || hist_has(row->type,HIST_ARTIFACT_UNKNOWN));
 case GH_SAY:case GH_ACTION:case GH_NOTE:return hist_has(row->type,HIST_USER_INPUT);
 default:return kind==GH_UNKNOWN;
 }
}
static void release_row(struct gh_row *row)
{if(row){free(row->reference);memset(row,0,sizeof(*row));}}
static void release_pending(void)
{release_row(&pending.value);pending.event_buffer=NULL;}
static void release_rows(struct gh_row *value,size_t count)
{size_t i;for(i=0;i<count;i++)release_row(&value[i]);free(value);}
void ab_game_history_clear(struct player *p)
{
 if(p!=player)return;
 release_pending();release_rows(rows,row_count);rows=NULL;row_count=0;row_capacity=0;total_bytes=0;
 ab_naming_snapshot_release(&artifact_name);gh_status=0;
}
static void reference_begin(struct ab_semantic_event *event,enum gh_kind kind)
{
 const char *id=kind_id(kind);
 memset(event,0,sizeof(*event));event->valid=id!=NULL;
 ab_semantic_json_literal(event,"{\"id\":");ab_semantic_json_string(event,id);
 ab_semantic_json_literal(event,",\"params\":{");
}
static void reference_finish(struct ab_semantic_event *event,enum gh_kind kind,const char *event_buffer)
{
 if(event->parameter_open)event->valid=false;
 ab_semantic_json_literal(event,"}}");release_pending();
 if(event_buffer && event->valid && event->length<=GH_MAX_REFERENCE) {
  pending.value.kind=kind;pending.value.reference=event->data;pending.value.length=(uint32_t)event->length;
  pending.event_buffer=event_buffer;event->data=NULL;
 }else gh_status=1;
 ab_semantic_event_discard(event);
}
void ab_game_history_prepare_birth(const char *event_buffer)
{struct ab_semantic_event event;reference_begin(&event,GH_BIRTH);reference_finish(&event,GH_BIRTH,event_buffer);}
void ab_game_history_prepare_level(int level,const char *event_buffer)
{
 struct ab_semantic_event event;reference_begin(&event,GH_LEVEL);
 ab_semantic_param_begin(&event,"level","integer");ab_semantic_json_int32(&event,level);ab_semantic_param_end(&event);
 reference_finish(&event,GH_LEVEL,event_buffer);
}
void ab_game_history_prepare_monster(const char *name_buffer,const char *event_buffer)
{
 struct ab_naming_snapshot name={0};struct ab_semantic_event event;
 bool captured=ab_naming_copy_monster_snapshot(&name,name_buffer);
 reference_begin(&event,GH_UNIQUE);if(!captured)event.valid=false;
 ab_naming_param_snapshot(&event,"monster","MonsterDescription",&name);
 ab_naming_snapshot_release(&name);reference_finish(&event,GH_UNIQUE,event_buffer);
}
void ab_game_history_prepare_note(int form,const char *username,const char *body,const char *event_buffer)
{
 enum gh_kind kind=form==1?GH_SAY:form==2?GH_ACTION:form==3?GH_NOTE:GH_UNKNOWN;
 struct ab_semantic_event event;reference_begin(&event,kind);
 if(form==1 || form==2) {
  ab_semantic_param_begin(&event,"name","character_name");ab_semantic_json_string(&event,username);ab_semantic_param_end(&event);
 }
 ab_semantic_param_begin(&event,"text","verbatim_user_text");ab_semantic_json_string(&event,body);ab_semantic_param_end(&event);
 reference_finish(&event,kind,event_buffer);
}
void ab_game_history_capture_artifact_name(const char *name_buffer)
{
 ab_naming_snapshot_release(&artifact_name);
 if(!ab_naming_copy_object_snapshot(&artifact_name,name_buffer))gh_status=1;
}
void ab_game_history_prepare_artifact(bool missed,const char *event_buffer)
{
 enum gh_kind kind=missed?GH_MISSED:GH_FOUND;struct ab_semantic_event event;
 reference_begin(&event,kind);if(!artifact_name.json)event.valid=false;
 ab_naming_param_snapshot(&event,"object","KnownObjectDescription",&artifact_name);
 ab_naming_snapshot_release(&artifact_name);reference_finish(&event,kind,event_buffer);
}
static void bind_native(struct gh_binding *out,const struct history_info *row)
{
 memset(out,0,sizeof(*out));out->turn=row->turn;out->dlev=row->dlev;out->clev=row->clev;out->aidx=row->a_idx;
 /* Native my_strcpy has already selected and truncated event[80]. */
 memcpy(out->event,row->event,strlen(row->event)+1);
}
static bool bound_native(const struct gh_binding *source,const struct history_info *row)
{return source->turn==row->turn && source->dlev==row->dlev && source->clev==row->clev && source->aidx==row->a_idx && !strcmp(source->event,row->event);}
void ab_game_history_added(struct player *p,size_t ordinal,const struct history_info *row,const char *event_buffer)
{
 struct gh_row *out;size_t capacity;struct gh_row *grown;
 if(p!=player || !row)return;
 if(ordinal>=GH_MAX_ROWS){if(pending.event_buffer==event_buffer)release_pending();gh_status=2;return;}
 if(ordinal>=row_capacity) {
  capacity=row_capacity?row_capacity:20;
  while(capacity<=ordinal){if(capacity>GH_MAX_ROWS/2){capacity=GH_MAX_ROWS;break;}capacity*=2;}
  grown=realloc(rows,capacity*sizeof(*rows));
  if(!grown){if(pending.event_buffer==event_buffer)release_pending();gh_status=2;return;}
  memset(grown+row_capacity,0,(capacity-row_capacity)*sizeof(*rows));rows=grown;row_capacity=capacity;
 }
 if(ordinal>=row_count)row_count=ordinal+1;
 out=&rows[ordinal];total_bytes-=out->length;release_row(out);bind_native(&out->native,row);
 if(pending.event_buffer==event_buffer) {
  if(pending.value.reference && kind_matches(pending.value.kind,row) && pending.value.length<=GH_MAX_TOTAL-total_bytes) {
   out->kind=pending.value.kind;out->reference=pending.value.reference;out->length=pending.value.length;
   pending.value.reference=NULL;total_bytes+=out->length;
  }else gh_status=2;
  release_pending();
 }
}
static void event_row_begin(struct ab_semantic_event *event,const char *context,const char *widget,const struct history_info *row)
{
 ab_semantic_event_begin(event,hist_has(row->type,HIST_ARTIFACT_LOST)?"angband.game_history.row_lost":"angband.game_history.row","ui",context,widget,0,-1);
 ab_semantic_param_begin(event,"turn","integer");ab_semantic_json_int32(event,row->turn);ab_semantic_param_end(event);
 ab_semantic_param_begin(event,"depth","integer");ab_semantic_json_int32(event,(int32_t)row->dlev*50);ab_semantic_param_end(event);
}
static void opaque_reference(struct ab_semantic_event *event,const char *text)
{
 ab_semantic_json_literal(event,"{\"id\":\"angband.game_history.opaque\",\"params\":{\"text\":{\"type\":\"verbatim_user_text\",\"value\":");
 ab_semantic_json_string(event,text);ab_semantic_json_literal(event,"}}}");
}
void ab_game_history_project_row(const char *context,const char *widget,const struct history_info *row,size_t ordinal)
{
 struct ab_semantic_event event;const struct gh_row *source=ordinal<row_count?&rows[ordinal]:NULL;
 if(!context || !widget || !row)return;
 event_row_begin(&event,context,widget,row);
 ab_semantic_param_begin(&event,"entry","localized_text");
 if(source && source->reference && bound_native(&source->native,row) && kind_matches(source->kind,row))
  ab_semantic_json_literal(&event,source->reference);
 else {
  /* Legacy text may be displayed explicitly as opaque; a fully localized
   * character download requires complete source provenance for every row. */
  if(!strcmp(context,"character-export"))ab_character_export_reject();
  opaque_reference(&event,row->event);
 }
 ab_semantic_param_end(&event);
 if(!event.valid){gh_status=4;if(!strcmp(context,"character-export"))ab_character_export_reject();}
 ab_semantic_event_emit(&event);
}
void ab_game_history_export_header(void)
{
 ab_character_export_emit("angband.game_history.title",NULL,0);
 ab_character_export_emit("angband.game_history.columns",NULL,0);
}
uint32_t ab_game_history_status(void){return gh_status;}
/* Optional block: every byte is bounds-checked before the native decoder.
 * Metadata commits only after the complete block, digest, binding, typed
 * references and checksum validate. Original history block is unchanged. */
struct gh_wire { uint32_t checksum;bool valid; };
static uint32_t hash_byte(uint32_t hash,uint8_t byte){return (hash^byte)*GH_FNV_PRIME;}
static void write_byte(struct gh_wire *wire,uint8_t byte){wr_byte(byte);wire->checksum=hash_byte(wire->checksum,byte);}
static uint8_t read_byte(struct gh_wire *wire)
{
 uint8_t byte=0;if(!wire->valid || ab_web_save_bytes_remaining()<1){wire->valid=false;return 0;}
 rd_byte(&byte);wire->checksum=hash_byte(wire->checksum,byte);return byte;
}
static void write_u16(struct gh_wire *wire,uint16_t value){write_byte(wire,(uint8_t)value);write_byte(wire,(uint8_t)(value>>8));}
static uint16_t read_u16(struct gh_wire *wire){uint16_t low=read_byte(wire),high=read_byte(wire);return low|(high<<8);}
static void write_u32(struct gh_wire *wire,uint32_t value){unsigned i;for(i=0;i<4;i++)write_byte(wire,(uint8_t)(value>>(i*8)));}
static uint32_t read_u32(struct gh_wire *wire){unsigned i;uint32_t value=0;for(i=0;i<4;i++)value|=(uint32_t)read_byte(wire)<<(i*8);return value;}
static void write_bytes(struct gh_wire *wire,const void *bytes,size_t length)
{const uint8_t *p=bytes;size_t i;for(i=0;i<length;i++)write_byte(wire,p[i]);}
static bool read_bytes(struct gh_wire *wire,void *bytes,size_t length)
{uint8_t *p=bytes;size_t i;if(!wire->valid || length>ab_web_save_bytes_remaining()){wire->valid=false;return false;}for(i=0;i<length;i++)p[i]=read_byte(wire);return wire->valid;}
static void write_pad(struct gh_wire *wire,size_t length){size_t i;for(i=0;i<((4-length%4)%4);i++)write_byte(wire,0);}
static bool read_pad(struct gh_wire *wire,size_t length){size_t i;for(i=0;i<((4-length%4)%4);i++)if(read_byte(wire)!=0)return false;return wire->valid;}
static bool validate_reference(const struct gh_row *source,const struct history_info *native)
{
 struct ab_semantic_event event;char expected[128];size_t prefix;bool valid;
 const char *id=kind_id(source->kind);
 if(!source->length)return source->kind==GH_UNKNOWN && !source->reference;
 if(!id || !kind_matches(source->kind,native) || !source->reference || source->length>GH_MAX_REFERENCE || strlen(source->reference)!=source->length)return false;
 snprintf(expected,sizeof(expected),"{\"id\":\"%s\",\"params\":{",id);prefix=strlen(expected);
 if(source->length<prefix || memcmp(source->reference,expected,prefix))return false;
 event_row_begin(&event,"gameplay-history-validation","row",native);
 ab_semantic_param_begin(&event,"entry","localized_text");ab_semantic_json_literal(&event,source->reference);ab_semantic_param_end(&event);
 /* Review is pure with respect to native state/RNG and has no host callback. */
 ab_semantic_json_literal(&event,"}}");
 valid=event.valid && ab_rs_review_event((const uint8_t *)event.data,(uint32_t)event.length)!=NULL && ab_rs_review_status()==0;
 ab_semantic_event_discard(&event);return valid;
}
void wr_web_game_history(void)
{
 struct gh_wire wire={GH_FNV_OFFSET,true};size_t count=player->hist.next,i;
 if(count>GH_MAX_ROWS)count=GH_MAX_ROWS;
 write_u32(&wire,GH_WIRE_VERSION);write_bytes(&wire,game_history_catalog_digest,sizeof(game_history_catalog_digest));write_u32(&wire,(uint32_t)count);
 for(i=0;i<count;i++) {
  const struct history_info *native=&player->hist.entries[i];const struct gh_row *source=i<row_count?&rows[i]:NULL;
  bool valid=source && source->reference && bound_native(&source->native,native) && kind_matches(source->kind,native);
  size_t length=strlen(native->event);uint32_t reference_length=valid?source->length:0;
  write_u32(&wire,valid?(uint32_t)source->kind:GH_UNKNOWN);
  write_u32(&wire,(uint32_t)native->turn);write_u16(&wire,(uint16_t)native->dlev);write_u16(&wire,(uint16_t)native->clev);
  write_byte(&wire,native->a_idx);write_byte(&wire,(uint8_t)length);write_byte(&wire,0);write_byte(&wire,0);
  write_bytes(&wire,native->event,length);write_pad(&wire,length);
  write_u32(&wire,reference_length);if(reference_length)write_bytes(&wire,source->reference,reference_length);write_pad(&wire,reference_length);
 }
 wr_u32b(wire.checksum);
}
int rd_web_game_history(void)
{
 struct gh_wire wire={GH_FNV_OFFSET,true};struct gh_row *loaded=NULL;size_t count,i,bytes=0,expected=player->hist.next;
 uint32_t version,checksum;uint8_t digest[32];
 if(expected>GH_MAX_ROWS)expected=GH_MAX_ROWS;
 version=read_u32(&wire);if(!read_bytes(&wire,digest,sizeof(digest)) || version!=GH_WIRE_VERSION || memcmp(digest,game_history_catalog_digest,sizeof(digest)))goto failed;
 count=read_u32(&wire);if(!wire.valid || count!=expected || count>GH_MAX_ROWS)goto failed;
 if(count){loaded=calloc(count,sizeof(*loaded));if(!loaded)goto failed;}
 for(i=0;i<count;i++) {
  struct gh_row *out=&loaded[i];uint32_t kind=read_u32(&wire);uint8_t length;
  if(kind>GH_NOTE)goto failed;out->kind=(enum gh_kind)kind;
  out->native.turn=(int32_t)read_u32(&wire);out->native.dlev=(int16_t)read_u16(&wire);out->native.clev=(int16_t)read_u16(&wire);
  out->native.aidx=read_byte(&wire);length=read_byte(&wire);
  if(read_byte(&wire)!=0 || read_byte(&wire)!=0 || !wire.valid || length>=sizeof(out->native.event))goto failed;
  if(!read_bytes(&wire,out->native.event,length) || memchr(out->native.event,0,length) || !read_pad(&wire,length))goto failed;
  out->native.event[length]=0;out->length=read_u32(&wire);
  if(!wire.valid || out->length>GH_MAX_REFERENCE || out->length>GH_MAX_TOTAL-bytes || out->length>ab_web_save_bytes_remaining())goto failed;
  if(out->length) {
   out->reference=malloc((size_t)out->length+1);if(!out->reference)goto failed;
   if(!read_bytes(&wire,out->reference,out->length) || memchr(out->reference,0,out->length))goto failed;
   out->reference[out->length]=0;bytes+=out->length;
  }
  if(!read_pad(&wire,out->length) || !bound_native(&out->native,&player->hist.entries[i]) || !validate_reference(out,&player->hist.entries[i]))goto failed;
 }
 if(!wire.valid || ab_web_save_bytes_remaining()!=4)goto failed;
 rd_u32b(&checksum);if(checksum!=wire.checksum || ab_web_save_bytes_remaining()!=0)goto failed;
 release_rows(rows,row_count);release_pending();rows=loaded;row_count=count;row_capacity=count;total_bytes=bytes;gh_status=0;return 0;
failed:
 release_rows(loaded,loaded?expected:0);gh_status=3;return -1;
}
#endif
