/* SPDX-License-Identifier: GPL-2.0-only */
/* Link the actual message.c/save.c/load.c/serializer/storage. Only the platform,
 * formatter, event sink and byte stream are replaced at their public boundary. */
#include "../../logic/angband.h"
#include "../../logic/player.h"
#include "../../logic/game-event.h"
#include "../../logic/savefile.h"
#include "../../logic/web-semantic.h"
#include "../../logic/web-message-recall.h"
#include "../../logic/z-rand.h"
#include <emscripten.h>
#include <assert.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
struct player *player;
static unsigned emitted;
static uint8_t bytes[16U*1024U*1024U];
static size_t size,position,checksum_offset;
void event_signal_message(game_event_type type,int message_type,const char *string) {
 (void)type;(void)message_type;(void)string;
}
void ab_host_message(const char *id,const char *localized) { (void)id;(void)localized;emitted++; }
void ab_host_semantic_event(const char *json,uint32_t length,const char *localized) {
 (void)json;(void)length;(void)localized;emitted++;
}
const char *ab_rs_message(const char *id) { return id; }
EM_JS(const char*,ab_rs_review_event,(const uint8_t *json,uint32_t length),{
 try {
  const event=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(HEAPU8.subarray(json,json+length)));
  if(event.schema_version!==1 || !event.params || typeof event.params!=='object')return 0;
  let value;
  if(event.id==='fixture.alpha'||event.id==='fixture.beta') {
   if(Object.keys(event.params).length!==0)return 0;
   value=event.id==='fixture.alpha'?'アルファ':'ベータ';
  } else if(event.id==='fixture.file') {
   const param=event.params.text;
   if(Object.keys(event.params).length!==1 || !param || param.type!=='verbatim_user_text' || typeof param.value!=='string')return 0;
   value=param.value;
  } else if(event.id==='angband.message_recall.segment_repeat') {
   const param=event.params.count;
   if(Object.keys(event.params).length!==1 || !param || param.type!=='integer' || !Number.isInteger(param.value))return 0;
   value=`（${param.value}回繰り返し）`;
  } else return 0;
  if(value.includes('\0'))return 0;
  if(Module.fixtureText)_free(Module.fixtureText);
  const encoded=new TextEncoder().encode(value);
  Module.fixtureText=_malloc(encoded.byteLength+1);
  HEAPU8.set(encoded,Module.fixtureText);
  HEAPU8[Module.fixtureText+encoded.byteLength]=0;
  return Module.fixtureText;
 } catch {return 0;}
});
void wr_byte(uint8_t value) { assert(size<sizeof(bytes));bytes[size++]=value; }
void wr_u16b(uint16_t value) { wr_byte(value);wr_byte(value>>8); }
void wr_s16b(int16_t value) { wr_u16b((uint16_t)value); }
void wr_u32b(uint32_t value) { unsigned i;checksum_offset=size;for(i=0;i<4;i++)wr_byte(value>>(i*8)); }
void wr_string(const char *value) { do {wr_byte((uint8_t)*value);}while(*value++); }
void rd_byte(uint8_t *value) { assert(position<size);*value=bytes[position++]; }
void rd_u16b(uint16_t *value) { uint8_t a,b;rd_byte(&a);rd_byte(&b);*value=(uint16_t)(a|((uint16_t)b<<8)); }
void rd_s16b(int16_t *value) { uint16_t temporary;rd_u16b(&temporary);*value=(int16_t)temporary; }
void rd_u32b(uint32_t *value) { unsigned i;uint8_t byte;*value=0;for(i=0;i<4;i++){rd_byte(&byte);*value|=(uint32_t)byte<<(i*8);} }
void rd_string(char *value,int maximum) { uint8_t byte;int used=0;do {rd_byte(&byte);if(byte&&used<maximum-1)value[used++]=(char)byte;}while(byte);value[used]=0; }
size_t ab_web_save_bytes_remaining(void) { return size-position; }
static void fresh(void) { messages_free();messages_init(); }
static void bound(const char *id,const char *native) { ab_semantic_message(id);msg("%s",native); }
static void typed(const char *opaque,const char *native) {
 struct ab_semantic_event event;
 ab_semantic_event_begin(&event,"fixture.file","message","command","log",0,0);
 ab_semantic_param_begin(&event,"text","verbatim_user_text");ab_semantic_json_string(&event,opaque);
 ab_semantic_param_end(&event);ab_semantic_event_emit(&event);msg("%s",native);
}
static void checksum(void) {
 uint32_t hash=UINT32_C(2166136261);size_t i;
 for(i=0;i<checksum_offset;i++)hash=(hash^bytes[i])*UINT32_C(16777619);
 for(i=0;i<4U;i++)bytes[checksum_offset+i]=(uint8_t)(hash>>(i*8));
}
static unsigned find_bytes(const char *text) {
 size_t i,n=strlen(text);for(i=0;i+n<size;i++)if(!memcmp(bytes+i,text,n))return (unsigned)i;
 assert(!"fixture byte marker missing");return 0;
}
EMSCRIPTEN_KEEPALIVE int ab_message_recall_fixture_run(void) {
 unsigned i,before;size_t memory;char buffer[256],opaque[128];uint8_t *native_saved,*sidecar_saved;size_t native_size,sidecar_size;
 uint32_t rng[37];bool quick;
 player=calloc(1,sizeof(*player));assert(player);
 /* Capture before package init must be discarded by the unchanged msg failure. */
 ab_semantic_message("fixture.alpha");assert(ab_message_recall_owned_bytes()>0);
 msg("orphan");assert(ab_message_recall_owned_bytes()==0);
 messages_init();
 bound("fixture.alpha","same");bound("fixture.alpha","same");
 assert(messages_num()==1&&message_count(0)==2&&ab_message_recall_group_count(0)==1);
 assert(strstr(ab_message_recall_text(0),"アルファ")&&strstr(ab_message_recall_text(0),"2回"));
 bound("fixture.beta","same");assert(messages_num()==1&&message_count(0)==3&&ab_message_recall_group_count(0)==2);
 assert(strstr(ab_message_recall_text(0),"アルファ")&&strstr(ab_message_recall_text(0),"ベータ"));
 /* Pure re-emission never consumes the next actual producer. */
 ab_semantic_message("fixture.beta");memory=ab_message_recall_owned_bytes();before=emitted;
 Rand_state_init(1234U);memcpy(rng,STATE,sizeof(STATE));rng[32]=state_i;rng[33]=z0;rng[34]=z1;rng[35]=z2;rng[36]=Rand_value;quick=Rand_quick;
 assert(ab_message_recall_text(0));assert(emitted==before&&ab_message_recall_owned_bytes()==memory);
 assert(ab_message_recall_emit(0,"fixture-ui","row.0.name"));assert(ab_message_recall_owned_bytes()==memory);
 assert(!memcmp(rng,STATE,sizeof(STATE))&&rng[32]==state_i&&rng[33]==z0&&rng[34]==z1&&rng[35]==z2&&rng[36]==Rand_value&&quick==Rand_quick);
 msg("next");assert(!strcmp(ab_message_recall_text(0),"ベータ"));
 fresh();bound("fixture.alpha","same");msg("same");
 assert(message_count(0)==2&&!ab_message_recall_text(0)&&!ab_message_recall_emit(0,"fixture-ui","row.0.name"));
 fresh();strcpy(opaque,"外部名 Alice 日本語");typed(opaque,"native source");strcpy(opaque,"changed");
 assert(!strcmp(ab_message_recall_text(0),"外部名 Alice 日本語"));
 fresh();for(i=0;i<65535U;i++)bound("fixture.alpha","count");
 assert(messages_num()==1&&message_count(0)==65535U&&ab_message_recall_group_count(0)==1);
 bound("fixture.alpha","count");assert(messages_num()==2&&message_count(0)==1&&message_count(1)==65535U);
 fresh();for(i=0;i<2050U;i++){snprintf(buffer,sizeof(buffer),"row %u",i);bound("fixture.alpha",buffer);}
 assert(messages_num()==2048U&&!strcmp(message_str(2047),"row 2"));
 fresh();for(i=0;i<65U;i++)bound(i%2U?"fixture.beta":"fixture.alpha","same");
 assert(message_count(0)==65U&&ab_message_recall_group_count(0)==64U&&!ab_message_recall_text(0));
 /* Actual native saver omits repetitions; actual native loader clips to127 bytes. */
 fresh();memset(buffer,'x',127U);strcpy(buffer+127U,"A");bound("fixture.alpha",buffer);
 strcpy(buffer+127U,"B");bound("fixture.beta",buffer);
 bound("fixture.alpha","repeated");bound("fixture.alpha","repeated");bound("fixture.alpha","repeated");
 typed("保持する外部名","last");size=position=0;wr_messages();native_size=size;
 native_saved=malloc(size);memcpy(native_saved,bytes,size);
 size=position=0;wr_web_message_recall();sidecar_size=size;sidecar_saved=malloc(size);memcpy(sidecar_saved,bytes,size);
 fresh();size=native_size;position=0;memcpy(bytes,native_saved,size);assert(rd_messages()==0);
 assert(messages_num()==3&&message_count(0)==1&&message_count(1)==1&&message_count(2)==2);
 assert(strlen(message_str(2))==127U&&!ab_message_recall_text(0));
 size=sidecar_size;position=0;memcpy(bytes,sidecar_saved,size);assert(rd_web_message_recall()==0);
 assert(!strcmp(ab_message_recall_text(0),"保持する外部名"));
 assert(!strcmp(ab_message_recall_text(1),"アルファ"));
 assert(strstr(ab_message_recall_text(2),"アルファ")&&strstr(ab_message_recall_text(2),"ベータ"));
 /* Reject each malformed field atomically, even when its checksum is valid. */
 memory=ab_message_recall_owned_bytes();
 for(i=0;i<7U;i++) {
  unsigned index;size=sidecar_size;position=0;memcpy(bytes,sidecar_saved,size);
  switch(i) {
   case 0:bytes[checksum_offset+3U]^=1U;break;
   case 1:bytes[4]^=1U;checksum();break;
   case 2:bytes[70]^=1U;checksum();break; /* first ordinal */
   case 3:bytes[76]^=1U;checksum();break; /* first native binding */
   case 4:index=find_bytes("fixture.alpha");memcpy(bytes+index+8U,"gamma",5U);checksum();break;
   case 5:index=find_bytes("verbatim_user_text");bytes[index]='!';checksum();break;
   default:size--;break;
  }
  assert(rd_web_message_recall()==-1&&ab_message_recall_owned_bytes()==memory);
  assert(!strcmp(ab_message_recall_text(0),"保持する外部名")&&message_count(2)==2);
 }
 free(native_saved);free(sidecar_saved);fresh();assert(ab_message_recall_owned_bytes()==0);
 /* Byte budget overflow is observable without changing native queue behavior. */
 {
  char *large=malloc(65537U);memset(large,'a',65536U);large[65536U]=0;
  for(i=0;i<700U;i++){snprintf(buffer,sizeof(buffer),"large %u",i);typed(large,buffer);assert(ab_message_recall_owned_bytes()<=AB_MESSAGE_RECALL_OWNED_LIMIT);}
  assert(messages_num()==700U);free(large);
 }
 messages_free();assert(ab_message_recall_owned_bytes()==0);free(player);player=NULL;
 return 0;
}
