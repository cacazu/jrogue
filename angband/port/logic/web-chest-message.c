/* SPDX-License-Identifier: GPL-2.0-only */
#include "angband.h"
#include "web-chest-message.h"
#ifdef __EMSCRIPTEN__
#include "object.h"
#include "web-semantic.h"
#include <string.h>
#include <stdio.h>
struct chest_binding { int pval;const char *code,*english,*id; };
#include "../migration/chest-message-data/chest-bindings.inc"
struct chest_source { const struct chest_trap *trap;const char *message;const struct chest_binding *binding; };
static struct chest_source chest_sources[6];
static uint32_t chest_status;
void ab_chest_message_reset(void){memset(chest_sources,0,sizeof(chest_sources));chest_status=0;}
void ab_chest_message_register(const struct chest_trap *head)
{
 const struct chest_trap *trap;size_t i;unsigned seen=0;
 ab_chest_message_reset();
 /* Only immutable parsed data is inspected at initialization. English serves
  * as a corpus check after canonical code+pval identity, never a lookup key. */
 for(trap=head;trap;trap=trap->next) {
  if(!trap->msg)continue;
  for(i=0;i<N_ELEMENTS(chest_bindings);i++) {
   const struct chest_binding *b=&chest_bindings[i];
   if(trap->pval!=b->pval || !trap->code || strcmp(trap->code,b->code))continue;
   if(chest_sources[i].trap || strcmp(trap->msg,b->english)){chest_status=1;return;}
   chest_sources[i]=(struct chest_source){trap,trap->msg,b};seen++;break;
  }
  if(i==N_ELEMENTS(chest_bindings)){chest_status=1;return;}
 }
 if(seen!=N_ELEMENTS(chest_bindings))chest_status=1;
}
void ab_chest_message_selected(const struct chest_trap *trap)
{
 size_t i;char widget[48];struct ab_semantic_event event;
 if(!trap)return;
 for(i=0;i<N_ELEMENTS(chest_sources);i++) {
  const struct chest_source *source=&chest_sources[i];
  if(source->trap!=trap || source->message!=trap->msg)continue;
  snprintf(widget,sizeof(widget),"trap.%d.trigger",source->binding->pval);
  ab_semantic_event_begin(&event,source->binding->id,"message","chest-trap",widget,0,MSG_GENERIC);
  ab_semantic_event_emit(&event);return;
 }
 /* Preserve native msg even for explicitly unsupported modified data. */
 chest_status=2;
}
uint32_t ab_chest_message_status(void){return chest_status;}
#endif
