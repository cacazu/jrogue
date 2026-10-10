/* GPL-2.0-only. Browser biography metadata; original English remains domain state. */
#include "angband.h"
#include "web-history.h"
#ifdef __EMSCRIPTEN__
#include "cmd-core.h"
#include "player.h"
#include "savefile.h"
#define AB_BIOGRAPHY_WIRE_VERSION 1U
#define AB_HISTORY_PENDING_LIMIT 20U
#define AB_HISTORY_FNV_OFFSET UINT32_C(2166136261)
#define AB_HISTORY_FNV_PRIME UINT32_C(16777619)
struct ab_history_record { uint16_t chart, cutoff, successor; const char *id, *english; };
#include "web-history-data.h"
static struct ab_history_snapshot current_history;
static struct ab_history_snapshot last_generation;
struct ab_history_pending {
 const struct command *command;
 const char *argument;
 struct ab_history_snapshot source;
};
static struct ab_history_pending pending_history[AB_HISTORY_PENDING_LIMIT];
static uint32_t history_hash_byte(uint32_t hash, uint8_t value) { return (hash ^ value) * AB_HISTORY_FNV_PRIME; }
static bool history_text_binding(const char *text, uint32_t *length, uint32_t *hash) {
 uint32_t count = 0, checksum = AB_HISTORY_FNV_OFFSET;
 if(!text)return false;
 while(text[count]) {
  if(count >= AB_HISTORY_MAX_NATIVE_BYTES)return false;
  checksum=history_hash_byte(checksum,(uint8_t)text[count]);count++;
 }
 *length=count;*hash=checksum;return true;
}
static const struct ab_history_record *history_record(uint16_t chart, uint16_t cutoff) {
 size_t i;
 for(i=0;i<N_ELEMENTS(ab_history_records);i++)
  if(ab_history_records[i].chart==chart && ab_history_records[i].cutoff==cutoff)return &ab_history_records[i];
 return NULL;
}
static bool history_start_allowed(uint16_t start) {
 switch(start) { case 1:case 4:case 5:case 7:case 10:case 13:case 16:case 19:case 21:case 23:return true;default:return false; }
}
static void history_unknown(struct ab_history_snapshot *out) { memset(out,0,sizeof(*out)); }
bool ab_history_snapshot_matches(const struct ab_history_snapshot *source, const char *native) {
 uint32_t length,hash;uint16_t expected;size_t offset=0,i;
 if(!source || source->origin>AB_HISTORY_AUTHORED || source->count>AB_HISTORY_MAX_CHOICES)return false;
 if(source->origin==AB_HISTORY_UNKNOWN)
  return !source->start_chart && !source->count && !source->native_length && !source->native_hash;
 if(!history_text_binding(native,&length,&hash) || length!=source->native_length || hash!=source->native_hash)return false;
 if(source->origin==AB_HISTORY_AUTHORED)return !source->start_chart && !source->count;
 if(!history_start_allowed(source->start_chart) || !source->count)return false;
 expected=source->start_chart;
 for(i=0;i<source->count;i++) {
  const struct ab_history_record *record=history_record(source->choices[i].chart,source->choices[i].cutoff);
  size_t bytes;
  if(!record || record->chart!=expected)return false;
  bytes=strlen(record->english);
  if(bytes>length-offset || strncmp(native+offset,record->english,bytes))return false;
  offset+=bytes;expected=record->successor;
 }
 return !expected && offset==length;
}
void ab_history_capture_begin(struct ab_history_snapshot *out,const struct history_chart *start) {
 history_unknown(out);
 if(start && start->idx<=UINT16_MAX && history_start_allowed((uint16_t)start->idx)) {
  out->origin=AB_HISTORY_GENERATED;out->start_chart=(uint16_t)start->idx;
 }
}
void ab_history_capture_choice(struct ab_history_snapshot *out,const struct history_chart *chart,const struct history_entry *entry) {
 const struct ab_history_record *record;
 uint16_t expected;const struct ab_history_record *previous;
 if(out->origin!=AB_HISTORY_GENERATED)return;
 if(!chart || !entry || chart->idx>UINT16_MAX || entry->roll<1 || entry->roll>100 || out->count>=AB_HISTORY_MAX_CHOICES) { history_unknown(out);return; }
 record=history_record((uint16_t)chart->idx,(uint16_t)entry->roll);
 previous=out->count?history_record(out->choices[out->count-1].chart,out->choices[out->count-1].cutoff):NULL;
 if(out->count && !previous) { history_unknown(out);return; }
 expected=previous?previous->successor:out->start_chart;
 if(!record || record->chart!=expected || record->successor!=entry->isucc ||
  (entry->succ?entry->succ->idx:0)!=record->successor || !entry->text || strcmp(entry->text,record->english)) { history_unknown(out);return; }
 out->choices[out->count].chart=record->chart;out->choices[out->count].cutoff=record->cutoff;out->count++;
}
void ab_history_capture_finish(struct ab_history_snapshot *out,const char *native) {
 if(out->origin!=AB_HISTORY_GENERATED || !history_text_binding(native,&out->native_length,&out->native_hash) || !ab_history_snapshot_matches(out,native))history_unknown(out);
 last_generation=*out;
}
void ab_history_last_generation(struct ab_history_snapshot *out) { *out=last_generation; }
void ab_history_apply_last_generation(const char *native) { ab_history_set_current(&last_generation,native); }
void ab_history_current_snapshot(struct ab_history_snapshot *out) {
 *out=current_history;
 if(!player || !ab_history_snapshot_matches(out,player->history))history_unknown(out);
}
void ab_history_set_current(const struct ab_history_snapshot *source,const char *native) {
 if(source && ab_history_snapshot_matches(source,native))current_history=*source;
 else history_unknown(&current_history);
}
void ab_history_reset_current(void) { history_unknown(&current_history); }
void ab_history_reset_all(void) { history_unknown(&current_history);history_unknown(&last_generation);memset(pending_history,0,sizeof(pending_history)); }
const char *ab_history_catalog_sha256(void) { return AB_HISTORY_CATALOG_SHA256; }
static const char *history_command_argument(const struct command *cmd) {
 size_t i;
 if(!cmd || cmd->code!=CMD_HISTORY_CHOICE)return NULL;
 for(i=0;i<CMD_MAX_ARGS;i++)if(cmd->arg[i].type==arg_STRING && !strcmp(cmd->arg[i].name,"history"))return cmd->arg[i].data.string;
 return NULL;
}
static void history_tag(const struct command *cmd,const struct ab_history_snapshot *source) {
 const char *argument=history_command_argument(cmd);size_t i,slot=AB_HISTORY_PENDING_LIMIT;
 if(!argument)return;
 for(i=0;i<N_ELEMENTS(pending_history);i++) {
  if(pending_history[i].command==cmd) { slot=i;break; }
  if(!pending_history[i].command && slot==AB_HISTORY_PENDING_LIMIT)slot=i;
 }
 if(slot==AB_HISTORY_PENDING_LIMIT)return;
 pending_history[slot].command=cmd;pending_history[slot].argument=argument;
 if(source && ab_history_snapshot_matches(source,argument))pending_history[slot].source=*source;
 else history_unknown(&pending_history[slot].source);
}
void ab_history_tag_generated(const struct command *cmd,const struct ab_history_snapshot *source) { history_tag(cmd,source); }
void ab_history_tag_edit(const struct command *cmd,const char *edited,const char *previous) {
 struct ab_history_snapshot source;
 if(edited && previous && !strcmp(edited,previous) && ab_history_snapshot_matches(&current_history,previous))source=current_history;
 else {
  history_unknown(&source);
  if(edited && previous && strcmp(edited,previous) && history_text_binding(edited,&source.native_length,&source.native_hash))source.origin=AB_HISTORY_AUTHORED;
 }
 history_tag(cmd,&source);
}
void ab_history_apply_command(const struct command *cmd,const char *native) {
 const char *argument=history_command_argument(cmd);size_t i;
 history_unknown(&current_history);
 for(i=0;i<N_ELEMENTS(pending_history);i++)if(pending_history[i].command==cmd) {
  if(pending_history[i].argument==argument)ab_history_set_current(&pending_history[i].source,native);
  memset(&pending_history[i],0,sizeof(pending_history[i]));return;
 }
}
/* Every new-block read checks the remaining native buffer before rd_byte. */
struct history_wire { uint32_t checksum;bool valid; };
static void history_write_byte(struct history_wire *wire,uint8_t value) { wr_byte(value);wire->checksum=history_hash_byte(wire->checksum,value); }
static void history_write_u16(struct history_wire *wire,uint16_t value) { history_write_byte(wire,(uint8_t)value);history_write_byte(wire,(uint8_t)(value>>8)); }
static void history_write_u32(struct history_wire *wire,uint32_t value) { unsigned i;for(i=0;i<4;i++)history_write_byte(wire,(uint8_t)(value>>(i*8))); }
static uint8_t history_read_byte(struct history_wire *wire) {
 uint8_t value=0;if(!wire->valid || ab_web_save_bytes_remaining()<1) { wire->valid=false;return 0; }
 rd_byte(&value);wire->checksum=history_hash_byte(wire->checksum,value);return value;
}
static uint16_t history_read_u16(struct history_wire *wire) { uint16_t low=history_read_byte(wire),high=history_read_byte(wire);return low|(high<<8); }
static uint32_t history_read_u32(struct history_wire *wire) { unsigned i;uint32_t value=0;for(i=0;i<4;i++)value|=((uint32_t)history_read_byte(wire))<<(i*8);return value; }
void wr_web_biography(void) {
 struct ab_history_snapshot source;struct history_wire wire={AB_HISTORY_FNV_OFFSET,true};size_t i;
 ab_history_current_snapshot(&source);
 history_write_u32(&wire,AB_BIOGRAPHY_WIRE_VERSION);history_write_u32(&wire,AB_HISTORY_GRAMMAR_VERSION);
 history_write_byte(&wire,source.origin);
 /* Native block readers include external 4-byte alignment padding. Keep this
  * payload intrinsically aligned: three checked reserved bytes after origin. */
 for(i=0;i<3;i++)history_write_byte(&wire,0);
 history_write_u16(&wire,source.start_chart);history_write_u16(&wire,source.count);
 for(i=0;i<N_ELEMENTS(ab_history_catalog_digest);i++)history_write_byte(&wire,ab_history_catalog_digest[i]);
 history_write_u32(&wire,source.native_length);history_write_u32(&wire,source.native_hash);
 for(i=0;i<source.count;i++) { history_write_u16(&wire,source.choices[i].chart);history_write_u16(&wire,source.choices[i].cutoff); }
 wr_u32b(wire.checksum);
}
int rd_web_biography(void) {
 struct ab_history_snapshot source;struct history_wire wire={AB_HISTORY_FNV_OFFSET,true};uint32_t version,grammar,checksum;size_t i;
 history_unknown(&source);
 version=history_read_u32(&wire);grammar=history_read_u32(&wire);
 if(!wire.valid || version!=AB_BIOGRAPHY_WIRE_VERSION || grammar!=AB_HISTORY_GRAMMAR_VERSION)return -1;
 source.origin=history_read_byte(&wire);
 for(i=0;i<3;i++)if(history_read_byte(&wire)!=0)return -1;
 source.start_chart=history_read_u16(&wire);source.count=history_read_u16(&wire);
 if(!wire.valid || source.origin>AB_HISTORY_AUTHORED || source.count>AB_HISTORY_MAX_CHOICES)return -1;
 for(i=0;i<N_ELEMENTS(ab_history_catalog_digest);i++)if(history_read_byte(&wire)!=ab_history_catalog_digest[i])return -1;
 source.native_length=history_read_u32(&wire);source.native_hash=history_read_u32(&wire);
 if(!wire.valid || source.native_length>AB_HISTORY_MAX_NATIVE_BYTES || ab_web_save_bytes_remaining()!=(size_t)source.count*4+4)return -1;
 for(i=0;i<source.count;i++) { source.choices[i].chart=history_read_u16(&wire);source.choices[i].cutoff=history_read_u16(&wire); }
 if(!wire.valid || ab_web_save_bytes_remaining()!=4)return -1;
 rd_u32b(&checksum);
 if(checksum!=wire.checksum || ab_web_save_bytes_remaining()!=0 || !player || !ab_history_snapshot_matches(&source,player->history))return -1;
 if(source.origin==AB_HISTORY_GENERATED && (!player->race || !player->race->history || source.start_chart!=player->race->history->idx))return -1;
 current_history=source;return 0;
}
#endif
