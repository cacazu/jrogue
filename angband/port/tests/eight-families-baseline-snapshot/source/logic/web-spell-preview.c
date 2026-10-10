/* SPDX-License-Identifier: GPL-2.0-only */
/* Own the selected concise spell facts until the immediately following row. */
#include "web-spell-preview.h"
#ifdef __EMSCRIPTEN__
#include "effects.h"
#include <stdbool.h>
#include <string.h>
struct ab_effect_preview_label { int index; const char *id; };
#include "../migration/spell-preview-data/bindings.inc"
static struct ab_semantic_event preview,special;
static int current_spell=-1;
static unsigned parts;
static bool open;
static void raw_begin(struct ab_semantic_event *json)
{ memset(json,0,sizeof(*json));json->valid=true; }
static void write_integer(struct ab_semantic_event *json,const char *name,int value)
{
 ab_semantic_json_string(json,name);
 ab_semantic_json_literal(json,":{\"type\":\"integer\",\"value\":");
 ab_semantic_json_int32(json,value);ab_semantic_json_literal(json,"}");
}
static void write_ref(struct ab_semantic_event *json,const char *id,
 const char *first,int first_value,const char *second,int second_value)
{
 if(!id){json->valid=false;return;}
 ab_semantic_json_literal(json,"{\"kind\":\"ref\",\"id\":");
 ab_semantic_json_string(json,id);ab_semantic_json_literal(json,",\"params\":{");
 if(first)write_integer(json,first,first_value);
 if(second){if(first)ab_semantic_json_literal(json,",");write_integer(json,second,second_value);}
 ab_semantic_json_literal(json,"}}");
}
static void next_part(void)
{
 if(!open||parts>=512U){preview.valid=false;return;}
 if(parts++)ab_semantic_json_literal(&preview,",");
}
void ab_spell_preview_reset(void)
{
 ab_semantic_event_discard(&preview);ab_semantic_event_discard(&special);
 current_spell=-1;parts=0;open=false;
}
void ab_spell_preview_begin(int spell_index,size_t capacity)
{
 ab_spell_preview_reset();raw_begin(&preview);current_spell=spell_index;open=true;
 if(spell_index<0||!capacity||capacity>65536U){preview.valid=false;return;}
 ab_semantic_json_literal(&preview,"{\"schema_version\":1,\"parts\":[{\"kind\":\"bounded\",\"native_max_bytes\":");
 ab_semantic_json_int32(&preview,(int32_t)capacity);
 ab_semantic_json_literal(&preview,",\"parts\":[");
}
void ab_spell_preview_special(const char *id,const char *parameter,int value,
 size_t capacity)
{
 ab_semantic_event_discard(&special);raw_begin(&special);
 if(!capacity||capacity>65536U){special.valid=false;return;}
 ab_semantic_json_literal(&special,"{\"kind\":\"bounded\",\"native_max_bytes\":");
 ab_semantic_json_int32(&special,(int32_t)capacity);
 ab_semantic_json_literal(&special,",\"parts\":[");
 write_ref(&special,id,parameter,value,NULL,0);
 ab_semantic_json_literal(&special,"]}");
}
void ab_spell_preview_leaf(const char *id,const char *first,int first_value,
 const char *second,int second_value)
{
 if(!open)return;next_part();write_ref(&preview,id,first,first_value,second,second_value);
}
void ab_spell_preview_label(int index)
{
 size_t i;const char *id=NULL;
 for(i=0;i<sizeof(ab_effect_preview_labels)/sizeof(*ab_effect_preview_labels);i++)
  if(ab_effect_preview_labels[i].index==index){id=ab_effect_preview_labels[i].id;break;}
 if(!open)return;next_part();
 if(!id){preview.valid=false;return;}
 ab_semantic_json_literal(&preview,"{\"kind\":\"ref\",\"id\":\"angband.effect_info.spell_preview.label\",\"params\":{\"label\":{\"type\":\"localized_text\",\"value\":{\"id\":");
 ab_semantic_json_string(&preview,id);ab_semantic_json_literal(&preview,"}}}}");
}
void ab_spell_preview_append_special(void)
{
 if(!open)return;next_part();
 if(!special.valid||!special.data){preview.valid=false;return;}
 ab_semantic_json_literal(&preview,special.data);
}
void ab_spell_preview_finish(void)
{
 if(!open)return;
 if(!parts)ab_spell_preview_leaf("angband.effect_info.grammar.empty",NULL,0,NULL,0);
 ab_semantic_json_literal(&preview,"]}]}");open=false;
 ab_semantic_event_discard(&special);
}
void ab_spell_preview_emit(struct ab_semantic_event *event,int spell_index)
{
 ab_semantic_param_begin(event,"description","EffectDescription");
 ab_semantic_json_literal(event,!open&&current_spell==spell_index&&preview.valid&&preview.data?
  preview.data:"{\"schema_version\":0,\"parts\":[]}");
 ab_semantic_param_end(event);ab_semantic_event_emit(event);ab_spell_preview_reset();
}
#endif
