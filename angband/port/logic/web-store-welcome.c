/* SPDX-License-Identifier: GPL-2.0-only */
/* Pure selected store text. No native text comparisons, queries or RNG. */
#include "angband.h"
#include "web-store-welcome.h"
#ifdef __EMSCRIPTEN__
#include "web-semantic.h"
#include "web-ui-text.h"
#include "../migration/store-welcome-message-data/web-store-welcome-data.h"
#define SW_COUNT(a) (sizeof(a)/sizeof((a)[0]))
enum sw_customer_kind { SW_CUSTOMER_NONE,SW_CUSTOMER_TITLE,SW_CUSTOMER_PLAYER,SW_CUSTOMER_VALUED };
static enum sw_customer_kind customer_kind;
static const char *customer_id,*hint_id;
static int hint_ordinal;
void ab_sw_forget(void){customer_kind=SW_CUSTOMER_NONE;customer_id=NULL;hint_id=NULL;hint_ordinal=-1;}
void ab_sw_clear(void){
 struct ab_semantic_event e;ab_sw_forget();
 ab_semantic_event_begin(&e,"","ui","store","__clear:welcome",0,-1);
 ab_semantic_event_emit_control(&e);
}
void ab_sw_hint_begin(void){hint_id=NULL;hint_ordinal=0;}
void ab_sw_hint_select(int native_list_ordinal){hint_ordinal=native_list_ordinal;}
const char *ab_sw_hint_result(int native_count,const char *native_hint){
 hint_id=NULL;
 if(native_count==(int)SW_COUNT(ab_sw_hint_ids) && hint_ordinal>=0 && (size_t)hint_ordinal<SW_COUNT(ab_sw_hint_ids))
  hint_id=ab_sw_hint_ids[hint_ordinal];
 return native_hint;
}
const char *ab_sw_hint_message(size_t native_format_index,const char *native_hint){
 const char *id=hint_id;hint_id=NULL;hint_ordinal=-1;
 if(native_format_index==0 && id){
  struct ab_ui_param p=AB_UI_REF("hint",id);struct ab_semantic_event e;
  ab_ui_emit("store","welcome","store.welcome.hint",&p,1);
  /* One semantic timeline event for the one original msg(); UI is separate. */
  ab_semantic_event_begin(&e,"store.welcome.hint","message","store","welcome",0,-1);
  ab_semantic_param_begin(&e,"hint","localized_text");
  ab_semantic_json_literal(&e,"{\"id\":");ab_semantic_json_string(&e,id);ab_semantic_json_literal(&e,"}");
  ab_semantic_param_end(&e);ab_semantic_event_emit(&e);
 }
 return native_hint;
}
int ab_sw_title_rank(unsigned int cidx,int native_rank){
 customer_kind=SW_CUSTOMER_TITLE;customer_id=ab_ui_title_id((int)cidx,native_rank);return native_rank;
}
const char *ab_sw_customer_player(const char *native_name){
 customer_kind=SW_CUSTOMER_PLAYER;customer_id=NULL;return native_name;
}
const char *ab_sw_customer_valued(const char *native_name){
 customer_kind=SW_CUSTOMER_VALUED;customer_id="store.welcome.customer.valued";return native_name;
}
const char *ab_sw_greeting(size_t native_index,const char *native_owner,const char *native_customer,const char *native_formatted){
 struct ab_ui_param p[2],name;size_t n=1;
 if(native_index==0 || native_index>=SW_COUNT(ab_sw_greeting_ids)){ab_sw_forget();return native_formatted;}
 p[0]=AB_UI_OPAQUE("owner","verbatim_user_text",native_owner);
 if(native_index>=4){
  if(customer_kind==SW_CUSTOMER_PLAYER){
   name=AB_UI_OPAQUE("name","character_name",native_customer);
   p[1]=AB_UI_NESTED("customer","store.welcome.customer.player",&name,1);
  }else if((customer_kind==SW_CUSTOMER_TITLE || customer_kind==SW_CUSTOMER_VALUED) && customer_id){
   p[1]=AB_UI_REF("customer",customer_id);
  }else{ab_sw_forget();return native_formatted;}
  n=2;
 }
 ab_ui_emit("store","welcome",ab_sw_greeting_ids[native_index],p,n);
 ab_sw_forget();return native_formatted;
}
#endif
