/* SPDX-License-Identifier: GPL-2.0-only. Execute actual sidecar C code. */
void ab_naming_param_snapshot(struct ab_semantic_event *event,const char *name,const char *type,const struct ab_naming_snapshot *snapshot)
{ab_semantic_param_begin(event,name,type);if(snapshot->json)ab_semantic_json_literal(event,snapshot->json);else event->valid=false;ab_semantic_param_end(event);}
static struct history_info native_rows[16];
static unsigned checks;
#define CHECK(x) do { assert(x);checks++; } while(0)
static void native_append(size_t index,int kind,const char *text,int artifact)
{
 struct history_info *out=&native_rows[index];memset(out,0,sizeof(*out));hist_on(out->type,kind);out->turn=(int32_t)index*100;out->dlev=(int16_t)index;out->clev=10;out->a_idx=(uint8_t)artifact;
 snprintf(out->event,sizeof(out->event),"%s",text);player->hist.next=index+1;
 ab_game_history_added(player,index,out,text);
}
static uint32_t wire_checksum(const uint8_t *bytes,size_t n)
{size_t i;uint32_t h=GH_FNV_OFFSET;for(i=0;i<n;i++)h=hash_byte(h,bytes[i]);return h;}
static void resign_wire(void)
{uint32_t checksum=wire_checksum(wire_bytes,wire_length-4);unsigned i;for(i=0;i<4;i++)wire_bytes[wire_length-4+i]=(uint8_t)(checksum>>(8*i));}
static void reject_without_native_change(const uint8_t *valid,size_t length,size_t offset,bool resign)
{
 struct history_info before[16];char *old=rows[0].reference;memcpy(before,native_rows,sizeof(before));memcpy(wire_bytes,valid,length);wire_length=length;wire_position=0;wire_bytes[offset]^=1;
 if(resign)resign_wire();CHECK(rd_web_game_history()==-1);CHECK(!memcmp(before,native_rows,sizeof(before)));CHECK(rows[0].reference==old);
}
/* Execute the unchanged original custom formatter, not libc's parser.
 * The runner injects the exact source observer call. Reintroducing %zu makes
 * every positive ordinal assertion fail even though libc accepts it. */
static void test_native_history_formatter(void)
{
 size_t i;char rejected[64]="sentinel",widget[64],expected[64];
 CHECK(strnfmt(rejected,sizeof(rejected),"row.%zu.label",(size_t)17)==0);CHECK(rejected[0]==0);
 for(i=0;i<240;i++){
  selected_history_widget(widget,i);snprintf(expected,sizeof(expected),"row.%u.label",(unsigned)i);
  CHECK(widget[0]!=0);CHECK(!strcmp(widget,expected));CHECK(strlen(widget)<sizeof(widget));
 }
}
int main(void)
{
 const char birth[]="Began the quest to destroy Morgoth.";const char level[]="Reached level 10";const char slain[]="Killed Sauron, the Sorcerer";
 char name[]="名前_日本",body[]="literal {monster} untouched",note[90];char artifact_text[]="Found the Long Sword 'Fixture'";
 size_t saved_length,i;uint8_t *saved;struct history_info native_before[16];char *original_reference;
 test_native_history_formatter();
  player->hist.entries=native_rows;player->hist.length=N_ELEMENTS(native_rows);
 ab_game_history_prepare_birth(birth);native_append(0,HIST_PLAYER_BIRTH,birth,0);CHECK(rows[0].kind==GH_BIRTH);
 ab_game_history_prepare_level(10,level);native_append(1,HIST_GAIN_LEVEL,level,0);CHECK(strstr(rows[1].reference,"\"value\":10")!=NULL);
 ab_game_history_prepare_monster("selected-native-name",slain);native_append(2,HIST_SLAY_UNIQUE,slain,0);CHECK(strstr(rows[2].reference,"MonsterDescription")!=NULL);
 snprintf(note,sizeof(note),"-- %s says: \"%s\"",name,body);ab_game_history_prepare_note(1,name,body,note);
 name[0]='X';body[0]='X';native_append(3,HIST_USER_INPUT,note,0);CHECK(strstr(rows[3].reference,"名前_日本")!=NULL);CHECK(strstr(rows[3].reference,"literal {monster} untouched")!=NULL);
 ab_game_history_capture_artifact_name("selected-artifact-buffer");ab_game_history_prepare_artifact(false,artifact_text);native_append(4,HIST_ARTIFACT_KNOWN,artifact_text,7);CHECK(rows[4].kind==GH_FOUND);
 hist_on(native_rows[4].type,HIST_ARTIFACT_LOST);CHECK(bound_native(&rows[4].native,&native_rows[4]));CHECK(kind_matches(rows[4].kind,&native_rows[4]));
 ab_game_history_project_row("gameplay-history","row.4.label",&native_rows[4],4);CHECK(strstr(last_host_event,"angband.game_history.row_lost")!=NULL);CHECK(strstr(last_host_event,"KnownObjectDescription")!=NULL);
 /* English-looking author text is opaque by source identity. */
 native_append(5,HIST_USER_INPUT,"Found a deliberately authored note",0);CHECK(rows[5].kind==GH_UNKNOWN);ab_game_history_project_row("gameplay-history","row.5.label",&native_rows[5],5);CHECK(strstr(last_host_event,"angband.game_history.opaque")!=NULL);
 /* A different buffer cannot steal pending provenance; the matching original
  * note consumes the already-owned copy after a simulated message yield. */
 {char selected[]="-- Note: selected",other[]="-- Note: other";ab_game_history_prepare_note(3,NULL,"selected",selected);native_append(6,HIST_USER_INPUT,other,0);CHECK(rows[6].kind==GH_UNKNOWN);CHECK(pending.event_buffer==selected);native_append(7,HIST_USER_INPUT,selected,0);CHECK(rows[7].kind==GH_NOTE);CHECK(pending.event_buffer==NULL);}
 /* Actual typed source references must retain the source-formatted row widget. */
  {const size_t selected_rows[]={0,3,7};size_t j;struct history_info before[16];memcpy(before,native_rows,sizeof(before));
   for(j=0;j<N_ELEMENTS(selected_rows);j++){char widget[64];size_t ordinal=selected_rows[j];selected_history_widget(widget,ordinal);ab_game_history_project_row("gameplay-history",widget,&native_rows[ordinal],ordinal);CHECK(strstr(last_host_event,widget)!=NULL);CHECK(strstr(last_host_event,"angband.game_history.opaque")==NULL);CHECK(!memcmp(before,native_rows,sizeof(before)));}
  }
  CHECK(total_bytes<GH_MAX_TOTAL);memcpy(native_before,native_rows,sizeof(native_before));wire_length=0;wr_web_game_history();saved_length=wire_length;CHECK(saved_length%4==0);saved=malloc(saved_length);assert(saved);memcpy(saved,wire_bytes,saved_length);
 original_reference=malloc(rows[3].length+1);assert(original_reference);memcpy(original_reference,rows[3].reference,rows[3].length+1);
 ab_game_history_clear(player);CHECK(rows==NULL && row_count==0);CHECK(!memcmp(native_before,native_rows,sizeof(native_before)));wire_position=0;CHECK(rd_web_game_history()==0);CHECK(!memcmp(native_before,native_rows,sizeof(native_before)));CHECK(!strcmp(rows[3].reference,original_reference));CHECK(rows[4].kind==GH_FOUND);CHECK(hist_has(native_rows[4].type,HIST_ARTIFACT_LOST));ab_game_history_project_row("gameplay-history","row.3.label",&native_rows[3],3);CHECK(strstr(last_host_event,"名前_日本")!=NULL);
 reject_without_native_change(saved,saved_length,0,true); /* version */
 reject_without_native_change(saved,saved_length,4,true); /* catalog digest */
 reject_without_native_change(saved,saved_length,36,true); /* row count */
 reject_without_native_change(saved,saved_length,44,true); /* bound turn */
 reject_without_native_change(saved,saved_length,55,true); /* reserved byte */
 reject_without_native_change(saved,saved_length,56,true); /* bound native text */
 reject_without_native_change(saved,saved_length,saved_length-1,false); /* checksum */
 /* Complete but invalid typed references are rejected by the external review
  * boundary before sidecar commit (real Rust validation tested by root). */
 memcpy(wire_bytes,saved,saved_length);wire_length=saved_length;wire_position=0;forced_review_rejection=true;CHECK(rd_web_game_history()==-1);forced_review_rejection=false;CHECK(!memcmp(native_before,native_rows,sizeof(native_before)));
 /* Every strict prefix fails cleanly; native rd_byte asserts if any caller
  * reads beyond remaining bytes, detecting unchecked decoder reads. */
 for(i=0;i<saved_length;i++){memcpy(wire_bytes,saved,i);wire_length=i;wire_position=0;CHECK(rd_web_game_history()==-1);CHECK(!memcmp(native_before,native_rows,sizeof(native_before)));}
 memcpy(wire_bytes,saved,saved_length);wire_length=saved_length;wire_position=0;CHECK(rd_web_game_history()==0);CHECK(row_count==8);CHECK(!memcmp(native_before,native_rows,sizeof(native_before)));
 /* Optional block absent means no guesses, even for a matching English line. */
 ab_game_history_clear(player);ab_game_history_project_row("gameplay-history","row.0.label",&native_rows[0],0);CHECK(strstr(last_host_event,"angband.game_history.opaque")!=NULL);
 CHECK(host_event_count==7);free(saved);free(original_reference);ab_game_history_clear(player);
 printf("{\"actualCHistoryWireChecks\":%u,\"strictPrefixLengthsRejected\":%zu,\"nativeLedgerUnchanged\":true,\"rustReviewBoundaryStubbed\":true,\"actualNativeFormatterOrdinals\":240,\"unsupportedSizeModifierRejected\":true}\n",checks,saved_length);return 0;
}
