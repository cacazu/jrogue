/* SPDX-License-Identifier: GPL-2.0-only */
/* Source provenance follows native message nodes. It never drives gameplay. */
#ifdef __EMSCRIPTEN__
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include "web-message-recall.h"
#ifndef AB_MESSAGE_RECALL_TEST
#include "message.h"
#include "savefile.h"
#include "web-semantic.h"
#else
#include "../migration/message-recall-storage-data/fixture-api.h"
#endif

struct descriptor { size_t bytes,id_length,params_length; char *id,*params; };
struct group { struct descriptor *source; uint16_t count; };
struct ab_message_recall_row {
 unsigned int groups;
 bool unavailable,truncated;
 struct ab_message_recall_row *newer,*older;
 struct group values[AB_MESSAGE_RECALL_GROUP_LIMIT];
};
static struct descriptor *pending;
static struct ab_message_recall_row *allocated_rows;
static bool pending_ambiguous;
static size_t owned;
static char recalled[AB_SEMANTIC_EVENT_MAX_BYTES + 1U];
static const char *render(const struct descriptor *source);
static bool id_valid(const char *id,size_t length) {
 size_t i;bool dot=false;
 if(!length || length>1024U || id[0]<'a' || id[0]>'z')return false;
 for(i=0;i<length;i++) {
  unsigned char c=(unsigned char)id[i];
  if(c=='.') { if(!i || i+1==length || id[i-1]=='.')return false;dot=true; }
  else if(!((c>='a'&&c<='z')||(c>='0'&&c<='9')||c=='_'))return false;
 }
 return dot;
}
static struct descriptor *descriptor_new(const char *id,size_t id_length,
 const char *params,size_t params_length) {
 struct descriptor *result;size_t bytes;
 if(!id || !params || !id_valid(id,id_length) || params_length<2U ||
  params_length>AB_SEMANTIC_EVENT_MAX_BYTES || params[0]!='{' || params[params_length-1]!='}' ||
  memchr(id,0,id_length) || memchr(params,0,params_length))return NULL;
 bytes=sizeof(*result)+id_length+1U+params_length+1U;
 if(bytes>AB_MESSAGE_RECALL_OWNED_LIMIT-owned)return NULL;
 result=malloc(bytes);if(!result)return NULL;
 owned+=bytes;result->bytes=bytes;result->id_length=id_length;result->params_length=params_length;
 result->id=(char*)(result+1);result->params=result->id+id_length+1U;
 memcpy(result->id,id,id_length);result->id[id_length]=0;
 memcpy(result->params,params,params_length);result->params[params_length]=0;
 return result;
}
static void descriptor_free(struct descriptor *value) {
 if(value) { owned-=value->bytes;free(value); }
}
static bool same(const struct descriptor *left,const struct descriptor *right) {
 return left && right && left->id_length==right->id_length &&
  left->params_length==right->params_length &&
  !memcmp(left->id,right->id,left->id_length) && !memcmp(left->params,right->params,left->params_length);
}
void ab_message_recall_pending_discard(void) {
 descriptor_free(pending);pending=NULL;pending_ambiguous=false;
}
static void pending_accept(struct descriptor *value) {
 if(pending_ambiguous) { descriptor_free(value);return; }
 if(pending && !same(pending,value)) {
  descriptor_free(value);descriptor_free(pending);pending=NULL;pending_ambiguous=true;return;
 }
 if(pending)descriptor_free(value);else pending=value;
 if(!value)pending_ambiguous=true;
}
void ab_message_recall_capture_event(const struct ab_semantic_event *event) {
 size_t id_start,id_length,params_start,params_length;
 if(!event || !event->valid || !event->recall_message)return;
 id_start=event->recall_id_offset;id_length=event->recall_id_length;
 params_start=event->recall_params_offset;
 if(id_length<2U || id_start+id_length>event->length || params_start>=event->length ||
  event->data[id_start]!='"' || event->data[id_start+id_length-1]!='"') {
  pending_accept(NULL);return;
 }
 params_length=event->length-params_start-1U;
 pending_accept(descriptor_new(event->data+id_start+1U,id_length-2U,
  event->data+params_start,params_length));
}
void ab_message_recall_capture_static(const char *id) {
 struct descriptor *source=id?descriptor_new(id,strlen(id),"{}",2U):NULL;
 if(source && !render(source)) { descriptor_free(source);source=NULL; }
 pending_accept(source);
}
static void append_source(struct ab_message_recall_row **address,struct descriptor *source) {
 struct ab_message_recall_row *row=*address;struct group *previous;
 if(!row) {
  if(sizeof(*row)>AB_MESSAGE_RECALL_OWNED_LIMIT-owned || !(row=calloc(1,sizeof(*row)))) {
   descriptor_free(source);return;
  }
  owned+=sizeof(*row);*address=row;
  row->older=allocated_rows;
  if(allocated_rows)allocated_rows->newer=row;
  allocated_rows=row;
 }
 if(row->truncated) { descriptor_free(source);return; }
 if(!source)row->unavailable=true;
 previous=row->groups?&row->values[row->groups-1U]:NULL;
 if(previous && ((same(previous->source,source))||(!previous->source&&!source)) && previous->count<UINT16_MAX) {
  previous->count++;descriptor_free(source);return;
 }
 if(row->groups==AB_MESSAGE_RECALL_GROUP_LIMIT) {
  row->unavailable=true;row->truncated=true;descriptor_free(source);return;
 }
 row->values[row->groups].source=source;row->values[row->groups].count=1U;row->groups++;
}
void ab_message_recall_append(struct ab_message_recall_row **row) {
 struct descriptor *source=pending;
 pending=NULL;
 if(pending_ambiguous) { descriptor_free(source);source=NULL; }
 pending_ambiguous=false;append_source(row,source);
}
void ab_message_recall_row_free(struct ab_message_recall_row *row) {
 unsigned i;if(!row)return;
 for(i=0;i<row->groups;i++)descriptor_free(row->values[i].source);
 if(row->newer)row->newer->older=row->older;else allocated_rows=row->older;
 if(row->older)row->older->newer=row->newer;
 owned-=sizeof(*row);free(row);
}
void ab_message_recall_reset(void) {
 ab_message_recall_pending_discard();
 while(allocated_rows)ab_message_recall_row_free(allocated_rows);
 recalled[0]=0;
}
size_t ab_message_recall_owned_bytes(void) { return owned; }
unsigned int ab_message_recall_group_count(uint16_t age) {
 struct ab_message_recall_row *row=ab_message_recall_row_at(age);return row?row->groups:0U;
}
static bool descriptor_event(struct ab_semantic_event *event,const struct descriptor *source,
 const char *context,const char *widget) {
 if(!source || !context || !widget)return false;
 ab_semantic_event_begin(event,source->id,"ui",context,widget,0,-1);
 /* The serializer has already opened params. Copy its source-owned object
  * body verbatim, then let the serializer close it once. */
 if(source->params_length>2U) {
  char *body=malloc(source->params_length-1U);
  if(!body) { ab_semantic_event_discard(event);return false; }
  memcpy(body,source->params+1U,source->params_length-2U);body[source->params_length-2U]=0;
  ab_semantic_json_literal(event,body);free(body);
 }
 if(!event->valid) { ab_semantic_event_discard(event);return false; }
 return true;
}
static const char *render(const struct descriptor *source) {
 struct ab_semantic_event event;const char *text;
 if(!descriptor_event(&event,source,"message-recall","validation"))return NULL;
 ab_semantic_json_literal(&event,"}}");
 text=event.valid?ab_rs_review_event((const uint8_t*)event.data,(uint32_t)event.length):NULL;
 ab_semantic_event_discard(&event);return text;
}
static bool row_available(uint16_t age,const struct ab_message_recall_row *row) {
 uint32_t count=0;unsigned i;
 if(!row || row->unavailable || row->truncated || !row->groups)return false;
 for(i=0;i<row->groups;i++)count+=row->values[i].count;
 /* Allocation failure may have omitted an early source group. A later
  * allocation must never make that pre-existing native row look complete. */
 return count==message_count(age);
}
bool ab_message_recall_emit(uint16_t age,const char *context,const char *widget) {
 struct ab_message_recall_row *row=ab_message_recall_row_at(age);unsigned i;
 if(!row_available(age,row) || !context || !widget || strlen(widget)>160U)return false;
 /* Validate every part before emitting: partial output must not imply complete provenance. */
 for(i=0;i<row->groups;i++)if(!render(row->values[i].source))return false;
 for(i=0;i<row->groups;i++) {
  struct ab_semantic_event event;char key[192];
  int length=i?snprintf(key,sizeof(key),"%s.part.%u",widget,i):snprintf(key,sizeof(key),"%s",widget);
  if(length<0 || (size_t)length>=sizeof(key))return false;
  if(!descriptor_event(&event,row->values[i].source,context,key))return false;
  ab_semantic_event_emit(&event);
  if(row->values[i].count>1U) {
   length=snprintf(key,sizeof(key),"%s.part.%u.repeat",widget,i);
   if(length<0 || (size_t)length>=sizeof(key))return false;
   ab_semantic_event_begin(&event,"angband.message_recall.segment_repeat","ui",context,key,0,-1);
   ab_semantic_param_begin(&event,"count","integer");
   ab_semantic_json_int32(&event,row->values[i].count);ab_semantic_param_end(&event);
   ab_semantic_event_emit(&event);
  }
 }
 return true;
}
const char *ab_message_recall_text(uint16_t age) {
 struct ab_message_recall_row *row=ab_message_recall_row_at(age);size_t used=0;unsigned i;
 if(!row_available(age,row))return NULL;
 recalled[0]=0;
 for(i=0;i<row->groups;i++) {
  const char *text=render(row->values[i].source);size_t length;
  if(!text)return NULL;length=strlen(text);
  if(length+(i?1U:0U)>AB_SEMANTIC_EVENT_MAX_BYTES-used)return NULL;
  if(i)recalled[used++]='\n';memcpy(recalled+used,text,length);used+=length;recalled[used]=0;
  if(row->values[i].count>1U) {
   struct ab_semantic_event event;
   ab_semantic_event_begin(&event,"angband.message_recall.segment_repeat","ui","message-recall","validation",0,-1);
   ab_semantic_param_begin(&event,"count","integer");ab_semantic_json_int32(&event,row->values[i].count);
   ab_semantic_param_end(&event);ab_semantic_json_literal(&event,"}}");
   text=event.valid?ab_rs_review_event((const uint8_t*)event.data,(uint32_t)event.length):NULL;
   ab_semantic_event_discard(&event);if(!text)return NULL;length=strlen(text);
   if(length+1U>AB_SEMANTIC_EVENT_MAX_BYTES-used)return NULL;
   recalled[used++]=' ';memcpy(recalled+used,text,length);used+=length;recalled[used]=0;
  }
 }
 return recalled;
}

/* A bounded, checksum-protected optional v1 sidecar. Original message blocks
 * retain their native 80-row/oldest-first/count-loss/127-byte-load behavior. */
#define WIRE_MAGIC UINT32_C(0x31524d41)
#define HASH_OFFSET UINT32_C(2166136261)
static uint32_t wire_hash;
static size_t wire_count;
static uint32_t hash_byte(uint32_t hash,uint8_t value) { return (hash^value)*UINT32_C(16777619); }
static void write_byte(uint8_t value) { wr_byte(value);wire_hash=hash_byte(wire_hash,value);wire_count++; }
static void write_u32(uint32_t value) { unsigned i;for(i=0;i<4;i++)write_byte((uint8_t)(value>>(i*8))); }
static void write_u16(uint16_t value) { write_byte((uint8_t)value);write_byte((uint8_t)(value>>8)); }
static void write_data(const char *data,size_t length) { size_t i;for(i=0;i<length;i++)write_byte((uint8_t)data[i]); }
static bool read_byte(uint8_t *out) {
 if(ab_web_save_bytes_remaining()<1U)return false;rd_byte(out);wire_hash=hash_byte(wire_hash,*out);wire_count++;return true;
}
static bool read_u32(uint32_t *out) {
 unsigned i;uint8_t v;*out=0;for(i=0;i<4;i++) { if(!read_byte(&v))return false;*out|=(uint32_t)v<<(i*8); }return true;
}
static bool read_u16(uint16_t *out) {
 uint8_t a,b;if(!read_byte(&a)||!read_byte(&b))return false;*out=(uint16_t)(a|((uint16_t)b<<8));return true;
}
static bool read_data(char *out,size_t length) {
 size_t i;uint8_t v;if(length>ab_web_save_bytes_remaining())return false;
 for(i=0;i<length;i++) { if(!read_byte(&v))return false;out[i]=(char)v; }return true;
}
void wr_web_message_recall(void) {
 uint16_t num=messages_num(),ordinal;
 if(num>80U)num=80U;
 wire_hash=HASH_OFFSET;wire_count=0;write_u32(WIRE_MAGIC);
 write_data(AB_MESSAGE_RECALL_CATALOG_SHA256,64U);write_u16(num);
 for(ordinal=0;ordinal<num;ordinal++) {
  uint16_t age=(uint16_t)(num-1U-ordinal);const char *native=message_str(age);
  size_t length=strlen(native);struct ab_message_recall_row *row=ab_message_recall_row_at(age);
  struct descriptor *source=row && row->groups && !row->truncated?row->values[row->groups-1U].source:NULL;
  if(length>127U)length=127U;
  write_u16(ordinal);write_u16(message_type(age));write_u16((uint16_t)length);write_data(native,length);
  write_byte(source?1U:0U);
  if(source) {
   write_u16((uint16_t)source->id_length);write_u32((uint32_t)source->params_length);
   write_data(source->id,source->id_length);write_data(source->params,source->params_length);
  }
 }
 wr_u32b(wire_hash);
 wire_count+=4U;
 /* Native next_blockheader rounds every block to four bytes. Include the
  * same checked 'x' padding here so the sidecar has an exact bounded length. */
 while(wire_count%4U) { wr_byte('x');wire_count++; }
}
int rd_web_message_recall(void) {
 struct ab_message_recall_row *rows[80]={0};char natives[80][128];uint16_t types[80],counts[80]={0};
 uint16_t num,ordinal,expected_ordinal,type,native_length,id_length;uint32_t magic,params_length,checksum;
 unsigned runs=0,i;char digest[65]={0};uint8_t bound;int result=-1;
 wire_hash=HASH_OFFSET;wire_count=0;
 if(!read_u32(&magic)||magic!=WIRE_MAGIC||!read_data(digest,64U)||
  memcmp(digest,AB_MESSAGE_RECALL_CATALOG_SHA256,64U)||!read_u16(&num)||num>80U)goto done;
 for(ordinal=0;ordinal<num;ordinal++) {
  struct descriptor *source=NULL;char native[128]={0};char *id=NULL,*params=NULL;
  if(!read_u16(&expected_ordinal)||expected_ordinal!=ordinal||!read_u16(&type)||
   !read_u16(&native_length)||native_length>127U||!read_data(native,native_length)||
   memchr(native,0,native_length)||!read_byte(&bound)||bound>1U)goto done;
  if(bound) {
   if(!read_u16(&id_length)||!id_length||id_length>1024U||!read_u32(&params_length)||
    params_length<2U||params_length>AB_SEMANTIC_EVENT_MAX_BYTES||
    (size_t)id_length+params_length>ab_web_save_bytes_remaining())goto done;
   id=malloc((size_t)id_length+1U);params=malloc((size_t)params_length+1U);
   if(!id||!params) { free(id);free(params);goto done; }
   if(!read_data(id,id_length)||!read_data(params,params_length)) { free(id);free(params);goto done; }
   id[id_length]=0;params[params_length]=0;
   source=descriptor_new(id,id_length,params,params_length);free(id);free(params);
   if(!source||!render(source)) { descriptor_free(source);goto done; }
  }
  /* Match the original oldest-first add() calls and their native coalescing. */
  if(!runs || types[runs-1U]!=type || strcmp(natives[runs-1U],native)) {
   strcpy(natives[runs],native);types[runs]=type;runs++;
  }
  counts[runs-1U]++;append_source(&rows[runs-1U],source);
  if(!rows[runs-1U] || rows[runs-1U]->truncated)goto done;
 }
 if(ab_web_save_bytes_remaining()<4U)goto done;
 rd_u32b(&checksum);if(checksum!=wire_hash)goto done;wire_count+=4U;
 while(wire_count%4U) {
  uint8_t padding;
  if(ab_web_save_bytes_remaining()<1U)goto done;
  rd_byte(&padding);if(padding!='x')goto done;wire_count++;
 }
 if(ab_web_save_bytes_remaining()!=0U)goto done;
 if(messages_num()!=runs)goto done;
 for(i=0;i<runs;i++) {
  uint16_t age=(uint16_t)(runs-1U-i);
  if(message_type(age)!=types[i] || message_count(age)!=counts[i] || strcmp(message_str(age),natives[i]))goto done;
 }
 /* Everything is validated; committing pointers has no allocations/failures. */
 for(i=0;i<runs;i++) { ab_message_recall_row_replace((uint16_t)(runs-1U-i),rows[i]);rows[i]=NULL; }
 result=0;
done:
 for(i=0;i<80U;i++)ab_message_recall_row_free(rows[i]);
 return result;
}
#endif
