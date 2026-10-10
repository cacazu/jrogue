/* SPDX-License-Identifier: GPL-2.0-only */
#include "angband.h"
#include "web-dynamic-text.h"
#include "web-naming.h"
#include "web-semantic.h"
#ifdef __EMSCRIPTEN__
/* All schemas are generated from a reviewed original producer. No native
 * formatted-English string is inspected or used to identify a translation. */
void ab_dynamic_message_capture(const char *id,const char *schema,int sound,va_list arguments)
{
 struct ab_semantic_event event;
 const char *cursor=schema;
 unsigned int count=0;
 ab_semantic_event_begin(&event,id,"message","command","log",0,sound);
 while (event.valid && *cursor) {
  char name[64];
  size_t length=0;
  char type;
  while (*cursor && *cursor!=':' && length+1<sizeof(name)) name[length++]=*cursor++;
  name[length]='\0';
  if (!length || *cursor++!=':' || ++count>16U) { event.valid=false; break; }
  type=*cursor++;
  if (*cursor++!=';') { event.valid=false; break; }
  switch(type) {
   case 'I':
    ab_semantic_param_begin(&event,name,"int32");
    ab_semantic_json_int32(&event,va_arg(arguments,int));
    break;
   case 'K': {
    int key=va_arg(arguments,int);
    char token[2]={(char)key,'\0'};
    if (key<32 || key>126) { event.valid=false; break; }
    ab_semantic_param_begin(&event,name,"canonical_key");
    ab_semantic_json_string(&event,token);
    break;
   }
   case 'F':
    ab_semantic_param_begin(&event,name,"opaque_file_path");
    ab_semantic_json_string(&event,va_arg(arguments,const char *));
    break;
   case 'M': case 'O': {
    const char *kind=type=='M'?"MonsterDescription":"KnownObjectDescription";
    const char *native_buffer=va_arg(arguments,const char *);
    ab_semantic_param_begin(&event,name,kind);
    ab_naming_copy_json_for_buffer(&event,native_buffer,kind);
    break;
   }
   default: event.valid=false; break;
  }
  ab_semantic_param_end(&event);
 }
 if (event.valid) ab_semantic_event_emit(&event);
 else ab_semantic_event_discard(&event);
}
#endif
