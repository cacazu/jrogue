import fs from 'node:fs';import path from 'node:path';import{fileURLToPath}from'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const file=path.join(root,'logic/ui-menu.c');let source=fs.readFileSync(file,'utf8');
function block(code){return `\r\n#ifdef __EMSCRIPTEN__ /* AB_INTERFACE */\r\n${code}\r\n#endif /* AB_INTERFACE */\r\n`;}
function insert(anchor,code,after=false){const at=source.indexOf(anchor);if(at<0||source.indexOf(anchor,at+1)>=0)throw Error('nonunique controller anchor '+anchor);const pos=at+(after?anchor.length:0);source=source.slice(0,pos)+block(code)+source.slice(pos);}
if(source.includes('ab_if_controller_run('))throw Error('controller integration already present; regenerate interface source first');
// Rust owns scrolling margins/clamping. Keep the original expressions as the
// complete native branch and reconstruct them exactly in the source test.
for(const[signature,skin]of[['static void display_scrolling(',1],['static void object_skin_display(',2]]) {
 const begin=source.indexOf(signature),start=source.indexOf('\t/* Keep a certain distance from the top when possible */',begin);
 const final='\t*top = MAX(*top, 0);\r\n',end=source.indexOf(final,start)+final.length;
 if(begin<0||start<0||end<final.length)throw Error('top source anchor');
 const native=source.slice(start,end);
 source=source.slice(0,start)+block(` *top=ab_rs_menu_top(${skin},cursor,*top,n,rows_per_page);\n if(ab_rs_menu_status())quit_fmt("Rust menu presentation state failed (%u)",(unsigned)ab_rs_menu_status());`)
  +'#ifndef __EMSCRIPTEN__ /* AB_INTERFACE_NATIVE */\r\n'+native+'#endif /* AB_INTERFACE_NATIVE */\r\n'+source.slice(end);
}
insert('/*** MENU RUNNING AND INPUT HANDLING CODE ***/',String.raw`
#include "web-menu-controller.h"
static bool menu_handle_action(struct menu *m,const ui_event *in);
static struct ab_menu_event ab_if_event_copy(const ui_event *event,bool initialized_output) {
 struct ab_menu_event value={0};value.kind=event->type;
 if(event->type==EVT_MOUSE){value.x=event->mouse.x;value.y=event->mouse.y;
  value.button=event->mouse.button;value.mods=event->mouse.mods;}
 else if(initialized_output || event->type==EVT_KBRD || event->type==EVT_SWITCH){value.code=event->key.code;value.mods=event->key.mods;}
 return value;
}
static ui_event ab_if_event_native(struct ab_menu_event value) {
 ui_event event=EVENT_EMPTY;event.type=(ui_event_type)value.kind;
 if(value.kind==EVT_MOUSE){event.mouse.x=(uint8_t)value.x;event.mouse.y=(uint8_t)value.y;
  event.mouse.button=(uint8_t)value.button;event.mouse.mods=(uint8_t)value.mods;}
 else {event.key.code=value.code;event.key.mods=(uint8_t)value.mods;}
 return event;
}
static struct ab_menu_span ab_if_span(const char *value) {
 struct ab_menu_span span={0};size_t len=0;
 if(!value)return span;
 while(len<=4096 && value[len])len++;
 if(len>4096)quit_fmt("Rust menu policy exceeds its byte bound");
 span.bytes=(const uint8_t*)value;span.len=(uint32_t)len;span.present=1;return span;
}
static struct ab_menu_policy ab_if_policy(const struct menu *menu) {
 struct ab_menu_policy policy={0};
 policy.selections=ab_if_span(menu->selections);policy.cmd_keys=ab_if_span(menu->cmd_keys);
 policy.switch_keys=ab_if_span(menu->switch_keys);
 if(menu->inscriptions){policy.inscriptions.bytes=(const uint8_t*)menu->inscriptions;
  policy.inscriptions.len=10;policy.inscriptions.present=1;}
 return policy;
}
static struct ab_menu_facts ab_if_menu_facts(const struct menu *menu,
 uint32_t mode,int notify,bool no_action,int previous_cursor) {
 uint32_t skin=menu->skin==&menu_skin_scroll?1:menu->skin==&menu_skin_object?2:menu->skin==&menu_skin_column?3:0;
 return (struct ab_menu_facts){mode,skin,menu->cursor,menu->top,
  menu->filter_list?menu->filter_count:menu->count,menu->active.col,menu->active.row,
  menu->active.width,menu->active.page_rows,(uint32_t)menu->flags,(uint32_t)notify,
  menu->row_funcs->get_tag?1U:0U,menu->context_hook?1U:0U,
  no_action?1U:0U,previous_cursor};
}
static struct ab_menu_effect ab_if_controller_run(struct menu *menu,
 uint32_t mode,const ui_event *input,const ui_event *initial_output,int notify,bool popup,bool no_action,
 int previous_cursor) {
 struct ab_menu_facts facts=ab_if_menu_facts(menu,mode,notify,no_action,previous_cursor);
 struct ab_menu_policy policy=ab_if_policy(menu);
 struct ab_menu_event event=ab_if_event_copy(input,false);
 struct ab_menu_event output=ab_if_event_copy(initial_output,true);
 uint32_t handle=ab_rs_menu_open(&facts,&policy,&event,&output);
 const struct ab_menu_effect *borrowed;
 struct ab_menu_effect effect;
 if(!handle)quit_fmt("Rust menu controller initialization failed (%u)",(unsigned)ab_rs_menu_status());
 borrowed=ab_rs_menu_effect(handle);
 for(;;){
  struct ab_menu_reply reply={0};ui_event action;int oid,w,h;
  if(!borrowed){uint32_t status=ab_rs_menu_status();ab_rs_menu_close(handle);
   quit_fmt("Rust menu controller integration failed (%u)",(unsigned)status);}
  /* Nested callbacks can reuse Rust's output slot: own this value first. */
  effect=*borrowed;menu->cursor=effect.cursor;menu->top=effect.top;
  if(effect.op==AB_MENU_DONE){ab_rs_menu_close(handle);return effect;}
  switch(effect.op){
   case AB_MENU_SKIN_TAG:reply.value=(unsigned char)menu->skin->get_tag(menu,effect.argument);break;
   case AB_MENU_ROW_TAG:
    oid=menu->filter_list?menu->filter_list[effect.argument]:effect.argument;
    reply.value=(unsigned char)menu->row_funcs->get_tag(menu,oid);break;
   case AB_MENU_VALIDITY:reply.value=is_valid_row(menu,effect.argument);break;
   case AB_MENU_DIRECTION:reply.value=target_dir_allow(input->key,false,effect.argument!=0);break;
   case AB_MENU_ACTION:action=ab_if_event_native(effect.event);reply.value=menu_handle_action(menu,&action);break;
   case AB_MENU_CONTEXT:action=ab_if_event_native(effect.event);
    reply.value=menu->context_hook(menu,input,&action);reply.event=ab_if_event_copy(&action,true);break;
   case AB_MENU_REFRESH:menu_refresh(menu,popup);break;
   case AB_MENU_RESIZE:menu_calc_size(menu);if(menu->row_funcs->resize)menu->row_funcs->resize(menu);break;
   case AB_MENU_TERM_WIDTH:Term_get_size(&w,&h);reply.value=w;break;
   default:ab_rs_menu_close(handle);quit_fmt("Rust menu controller returned an invalid effect");
  }
  reply.facts=ab_if_menu_facts(menu,mode,notify,no_action,previous_cursor);
  reply.policy=ab_if_policy(menu);
  borrowed=ab_rs_menu_reply(handle,&reply);
 }
}
`);
insert('bool menu_handle_mouse(struct menu *menu, const ui_event *in,\r\n\t\tui_event *out)\r\n{',String.raw`
 struct ab_menu_effect effect=ab_if_controller_run(menu,2,in,out,0,false,false,menu->cursor);
 *out=ab_if_event_native(effect.event);return (effect.result&AB_MENU_MOUSE_HANDLED)!=0;
`,true);
insert('bool menu_handle_keypress(struct menu *menu, const ui_event *in,\r\n\t\tui_event *out)\r\n{',String.raw`
 struct ab_menu_effect effect=ab_if_controller_run(menu,1,in,out,0,false,false,menu->cursor);
 *out=ab_if_event_native(effect.event);return (effect.result&AB_MENU_EAT)!=0;
`,true);
insert('\t\tin = inkey_ex();',String.raw`
  struct ab_menu_effect effect=ab_if_controller_run(menu,3,&in,&out,notify,popup,no_act,cursor);
  if(effect.result&AB_MENU_RETURN){
   if(popup)screen_load();ab_if_menu_leave(menu);return ab_if_event_native(effect.event);
  }
  continue;
`,true);
fs.writeFileSync(file,source);
console.log(JSON.stringify({c_controller_adapter:true,original_native_branches_retained:true,controller_effects:10}));
