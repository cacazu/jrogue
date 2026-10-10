/* SPDX-License-Identifier: GPL-3.0-or-later
 * SOURCE-ONLY C/Lua platform candidate. All input executes original SDL backend
 * state transitions -> retained_platform_drain -> original on_event/on_tick.
 * No actors, keybindings, RNG, userdata or rules are replaced or synthesized.
 */
#include <emscripten/emscripten.h>
#include <emscripten/html5.h>
#include <math.h>
#include <stdio.h>
#include <string.h>
#include "lua.h"
#include "lauxlib.h"
#include "types.h"
#include "tome_main_platform.h"
#include "retained_platform_drain.h"
#include "checkpoint_gate.h"
#include "original_system_dispatch.h"
#include "sdl_private_input_2_32_10.h"
#include "tome_nested_focus.h"

extern SDL_Window *window;
extern SDL_mutex *renderingLock, *realtimeLock;
extern int current_game, current_keyhandler;
extern bool tickPaused, isActive, exit_engine;
enum { MAX_EVENTS = 8192, MAX_TICKS = 10000, MAX_TEXT = 16384, SLICE_EVENTS = 128 };
enum { IDLE, COLLECTING, DRAINING, TICKING, COMPLETE, FAILED };
static int claimed, phase;
static unsigned int sequence, last_sequence, event_count, system_count, tick_count;
static lua_State *transaction_state;
static const void *transaction_game;
static char output[8192], error_id[160];

static void raw_field(lua_State *L, int index, const char *key) {
    if(index < 0)index=lua_gettop(L)+index+1;
    lua_pushstring(L,key);lua_rawget(L,index);
}
static int tick_end_pending(void) {
    lua_State *L=tome_main_get_state();if(!L||current_game==LUA_NOREF)return -1;
    int top=lua_gettop(L),pending=0;
    lua_rawgeti(L,LUA_REGISTRYINDEX,current_game);
    if(!lua_istable(L,-1)){lua_settop(L,top);return -1;}
    raw_field(L,-1,"on_tick_end_custom");
    if(lua_isnil(L,-1)){lua_pop(L,1);raw_field(L,-1,"on_tick_end");}
    if(lua_istable(L,-1)){raw_field(L,-1,"fcts");if(lua_istable(L,-1))pending=lua_objlen(L,-1)>0;}
    lua_settop(L,top);return pending;
}
static int handler_unicode(void) {
    lua_State *L=tome_main_get_state();if(!L||current_keyhandler==LUA_NOREF)return -1;
    int top=lua_gettop(L),value=-1;lua_rawgeti(L,LUA_REGISTRYINDEX,current_keyhandler);
    if(lua_istable(L,-1)){raw_field(L,-1,"use_unicode");if(lua_isboolean(L,-1))value=lua_toboolean(L,-1)?1:0;}
    lua_settop(L,top);return value;
}
static int focused_unicode(int *dialog_count) {
    return tome_textbox_nested_focused_unicode(dialog_count,NULL);
}
static const void *game_identity(void) {
    lua_State *L=tome_main_get_state();if(!L||current_game==LUA_NOREF)return NULL;
    int top=lua_gettop(L);lua_rawgeti(L,LUA_REGISTRYINDEX,current_game);
    const void *identity=lua_istable(L,-1)?lua_topointer(L,-1):NULL;lua_settop(L,top);return identity;
}
static const char *phase_name(void) {
    static const char *names[]={"idle","collecting","draining","ticking","complete","failed"};return names[phase];
}
static const char *status(void) {
    int w=0,h=0;if(window)SDL_GetWindowSize(window,&w,&h);
    int dialogs=-1,focused=focused_unicode(&dialogs);
    snprintf(output,sizeof(output),"{\"protocol\":1,\"phase\":\"%s\",\"sequence\":%u,\"input_events\":%u,\"system_events\":%u,\"ticks\":%u,\"busy\":%s,\"checkpoint_busy\":%s,\"tick_paused\":%s,\"tick_end_pending\":%d,\"handler_unicode\":%d,\"focused_unicode\":%d,\"dialog_count\":%d,\"text_input_active\":%s,\"window_width\":%d,\"window_height\":%d,\"reboot_pending\":%s,\"exit_requested\":%s,\"error_id\":%s%s%s}",
      phase_name(),sequence,event_count,system_count,tick_count,
      phase==COLLECTING||phase==DRAINING||phase==TICKING||phase==FAILED?"true":"false",
      tome_web_checkpoint_busy()?"true":"false",tickPaused?"true":"false",tick_end_pending(),handler_unicode(),
      focused,dialogs,SDL_IsTextInputActive()?"true":"false",w,h,tome_main_original_reboot_pending()?"true":"false",exit_engine?"true":"false",
      error_id[0]?"\"":"",error_id[0]?error_id:"null",error_id[0]?"\"":"");
    return output; /* C-owned buffer; JS copies immediately with ccall string. */
}
static const char *fault(const char *id) {
    snprintf(error_id,sizeof(error_id),"%s",id);phase=FAILED;return status();
}
static const char *reject(const char *id) {
    /* Invalid callers cannot poison an already valid in-flight transaction. */
    char previous[sizeof(error_id)];memcpy(previous,error_id,sizeof(previous));
    snprintf(error_id,sizeof(error_id),"%s",id);status();
    memcpy(error_id,previous,sizeof(previous));return output;
}
static int live_guard(void) {
    return claimed&&window&&renderingLock&&realtimeLock&&tome_main_get_state()&&game_identity()&&
      !tome_web_checkpoint_busy()&&!exit_engine&&!tome_main_original_reboot_pending()&&
      (!transaction_state||(transaction_state==tome_main_get_state()&&transaction_game==game_identity()));
}
static int valid_modifiers(unsigned int mods) { return !(mods & ~0xffc3u); }
static int valid_text(const char *text) {
    if(!text)return 0;size_t n=strnlen(text,MAX_TEXT+1);if(n>MAX_TEXT)return 0;
    const unsigned char *p=(const unsigned char*)text;size_t i=0;
    while(i<n){unsigned char c=p[i++];unsigned int scalar;size_t extra;
      if(c<0x80){if(c<32||c==127)return 0;continue;}
      if(c>=0xc2&&c<=0xdf){scalar=c&31;extra=1;}
      else if(c>=0xe0&&c<=0xef){scalar=c&15;extra=2;}
      else if(c>=0xf0&&c<=0xf4){scalar=c&7;extra=3;}else return 0;
      if(i+extra>n)return 0;
      for(size_t j=0;j<extra;j++){if((p[i]&0xc0)!=0x80)return 0;scalar=(scalar<<6)|(p[i++]&63);}
      if((extra==1&&scalar<0x80)||(extra==2&&scalar<0x800)||(extra==3&&scalar<0x10000)||
        scalar>0x10ffff||(scalar>=0xd800&&scalar<=0xdfff))return 0;
    }return 1;
}
static int drain_slice(void) {
    if(!live_guard())return 0;
    unsigned int remaining=SLICE_EVENTS;
    while(remaining){
      tome_platform_drain_result result;
      if(!tome_platform_drain_input(remaining,&result))return 0;
      event_count+=result.input_events;remaining-=result.input_events;
      if(event_count+system_count>MAX_EVENTS)return 0;
      if(result.has_system_event){
        ++system_count;--remaining;
        /* Entire original switch, byte-identical: never discard focus, resize,
         * quit, timer, audio or redraw events. These may be effectful. */
        tome_main_dispatch_original_event(&result.system_event);
        if(!live_guard())return 0;
      }else break;
    }
    return SDL_HasEvents(SDL_FIRSTEVENT,SDL_LASTEVENT)?2:1;
}
static const char *after_packet(void) {
    int result=drain_slice();
    if(!result)return fault("error.physical.original_dispatch");
    phase=result==2?DRAINING:COLLECTING;return status();
}
static int packet_guard(unsigned int seq,unsigned int mods) {
    return seq==sequence&&phase==COLLECTING&&valid_modifiers(mods)&&live_guard();
}

EMSCRIPTEN_KEEPALIVE const char *tome_physical_prepare(void) {
    /* Native initialization bypasses desktop boot_lua. Perform only its boot
     * marker reset at the exact fresh stage, before any original Game exists. */
    if(claimed||phase!=IDLE||tome_web_checkpoint_busy()||!window||!renderingLock||!realtimeLock||
      !tome_main_physical_prepare_initial_boot())return reject("error.physical.boot_stage");
    return status();
}

EMSCRIPTEN_KEEPALIVE const char *tome_physical_claim(const char *canvas_selector) {
    if(claimed||tome_web_checkpoint_busy()||!window||!renderingLock||!realtimeLock||!game_identity())
      return reject("error.physical.not_ready");
    if(!canvas_selector||canvas_selector[0]!='#'||strnlen(canvas_selector,129)>128)
      return reject("error.physical.request");
    SDL_version actual;SDL_GetVersion(&actual);
    if(actual.major!=2||actual.minor!=32||actual.patch!=10)return reject("error.physical.sdl_version");
    const char *keys=SDL_GetHint(SDL_HINT_EMSCRIPTEN_KEYBOARD_ELEMENT);
    if(!keys)keys=EMSCRIPTEN_EVENT_TARGET_WINDOW;
    /* Only pinned SDK input callbacks are removed. Keep original focus/blur,
     * resize/fullscreen/visibility/pointer-lock/lifecycle callbacks installed. */
    int callbacks_ok=1;
#define REMOVE_INPUT(call) do { if((call)!=EMSCRIPTEN_RESULT_SUCCESS)callbacks_ok=0; } while(0)
    REMOVE_INPUT(emscripten_set_keydown_callback(keys,NULL,0,NULL));
    REMOVE_INPUT(emscripten_set_keyup_callback(keys,NULL,0,NULL));
    REMOVE_INPUT(emscripten_set_keypress_callback(keys,NULL,0,NULL));
    REMOVE_INPUT(emscripten_set_mousemove_callback(canvas_selector,NULL,0,NULL));
    REMOVE_INPUT(emscripten_set_mousedown_callback(canvas_selector,NULL,0,NULL));
    REMOVE_INPUT(emscripten_set_mouseup_callback(EMSCRIPTEN_EVENT_TARGET_DOCUMENT,NULL,0,NULL));
    REMOVE_INPUT(emscripten_set_mouseenter_callback(canvas_selector,NULL,0,NULL));
    REMOVE_INPUT(emscripten_set_mouseleave_callback(canvas_selector,NULL,0,NULL));
    REMOVE_INPUT(emscripten_set_wheel_callback(canvas_selector,NULL,0,NULL));
    REMOVE_INPUT(emscripten_set_touchstart_callback(canvas_selector,NULL,0,NULL));
    REMOVE_INPUT(emscripten_set_touchend_callback(canvas_selector,NULL,0,NULL));
    REMOVE_INPUT(emscripten_set_touchmove_callback(canvas_selector,NULL,0,NULL));
    REMOVE_INPUT(emscripten_set_touchcancel_callback(canvas_selector,NULL,0,NULL));
#undef REMOVE_INPUT
    if(!callbacks_ok)return fault("error.physical.callbacks");
    SDL_SetKeyboardFocus(window);SDL_SetMouseFocus(window);
    SDL_StartTextInput(); /* Original main.c:1559 platform initialization policy. */
    claimed=1;phase=IDLE;return status();
}
EMSCRIPTEN_KEEPALIVE int tome_physical_busy(void) {
    return phase==COLLECTING||phase==DRAINING||phase==TICKING||phase==FAILED;
}
EMSCRIPTEN_KEEPALIVE const char *tome_physical_status(void) { return status(); }
EMSCRIPTEN_KEEPALIVE const char *tome_physical_backend_state(void) {
    /* Actual SDL-owned state for baseline equivalence checks; never Rust's
     * inferred held state. Getter-only, no PumpEvents or simulation. */
    int count=0,x=0,y=0;const Uint8 *keys=SDL_GetKeyboardState(&count);
    Uint32 buttons=SDL_GetMouseState(&x,&y);
    size_t used=(size_t)snprintf(output,sizeof(output),"{\"protocol\":1,\"modifiers\":%u,\"mouse_x\":%d,\"mouse_y\":%d,\"mouse_buttons\":%u,\"text_input_active\":%s,\"pressed_scancodes\":[",
      (unsigned int)SDL_GetModState(),x,y,(unsigned int)buttons,SDL_IsTextInputActive()?"true":"false");
    int first=1;
    for(int i=0;keys&&i<count&&i<SDL_NUM_SCANCODES;i++)if(keys[i]){
      if(used>=sizeof(output)-32)return "{\"protocol\":1,\"error_id\":\"input.error.output_limit\"}";
      used+=(size_t)snprintf(output+used,sizeof(output)-used,"%s%d",first?"":",",i);first=0;
    }
    snprintf(output+used,sizeof(output)-used,"]}");return output;
}
EMSCRIPTEN_KEEPALIVE const char *tome_physical_begin(unsigned int seq) {
    if(tome_physical_busy()||!seq||seq<=last_sequence||!live_guard())return reject("error.physical.busy");
    sequence=last_sequence=seq;event_count=system_count=tick_count=0;error_id[0]=0;
    transaction_state=tome_main_get_state();transaction_game=game_identity();phase=COLLECTING;
    return after_packet(); /* Process earlier original system events first. */
}
EMSCRIPTEN_KEEPALIVE const char *tome_physical_key(unsigned int seq,int down,int scan,int keycode,unsigned int mods) {
    if(!packet_guard(seq,mods)||(down!=0&&down!=1)||scan<=0||scan>=SDL_NUM_SCANCODES)
      return reject("error.physical.request");
    SDL_SendKeyboardKeyAndKeycode(down?SDL_PRESSED:SDL_RELEASED,(SDL_Scancode)scan,(SDL_Keycode)keycode);
    /* SDL applies modifier transitions itself. Restore this packet's observed
     * post-event browser state before original on_event reads the global mask. */
    SDL_SetModState((SDL_Keymod)mods);return after_packet();
}
EMSCRIPTEN_KEEPALIVE const char *tome_physical_text(unsigned int seq,const char *text,unsigned int mods) {
    if(!packet_guard(seq,mods)||!valid_text(text))return reject("error.physical.text");
    SDL_SetModState((SDL_Keymod)mods);
    SDL_SendKeyboardText(text); /* Official UTF-8-safe 31-byte chunk policy. */
    return after_packet();
}
EMSCRIPTEN_KEEPALIVE const char *tome_physical_motion(unsigned int seq,int relative,int x,int y,unsigned int mods) {
    if(!packet_guard(seq,mods)||(relative!=0&&relative!=1))return reject("error.physical.request");
    SDL_SetModState((SDL_Keymod)mods);SDL_SendMouseMotion(window,0,relative,x,y);return after_packet();
}
EMSCRIPTEN_KEEPALIVE const char *tome_physical_button(unsigned int seq,int down,int button,int x,int y,unsigned int mods) {
    if(!packet_guard(seq,mods)||(down!=0&&down!=1)||button<1||button>16)return reject("error.physical.request");
    SDL_SetModState((SDL_Keymod)mods);
    /* Explicit physical-position update precedes the click; the original
     * backend button primitive itself reads the existing mouse position. */
    SDL_SendMouseMotion(window,0,0,x,y);
    SDL_SendMouseButton(window,0,down?SDL_PRESSED:SDL_RELEASED,(Uint8)button);return after_packet();
}
EMSCRIPTEN_KEEPALIVE const char *tome_physical_wheel(unsigned int seq,float x,float y,int mouse_x,int mouse_y,unsigned int mods) {
    if(!packet_guard(seq,mods)||!isfinite(x)||!isfinite(y)||fabsf(x)>100000||fabsf(y)>100000)
      return reject("error.physical.request");
    SDL_SetModState((SDL_Keymod)mods);SDL_SendMouseMotion(window,0,0,mouse_x,mouse_y);
    SDL_SendMouseWheel(window,0,x,y,SDL_MOUSEWHEEL_NORMAL);return after_packet();
}
EMSCRIPTEN_KEEPALIVE const char *tome_physical_end(unsigned int seq) {
    if(seq!=sequence||phase!=COLLECTING||!live_guard())return reject("error.physical.request");
    phase=TICKING;return status();
}
EMSCRIPTEN_KEEPALIVE const char *tome_physical_pump(unsigned int seq,unsigned int budget) {
    if(seq!=sequence||(phase!=DRAINING&&phase!=TICKING)||!live_guard()||!budget||budget>32)
      return reject("error.physical.request");
    if(phase==DRAINING)return after_packet();
    for(unsigned int i=0;i<budget;i++){
      if(!live_guard())return fault("error.physical.original_state");
      int drained=drain_slice();
      if(!drained)return fault("error.physical.original_dispatch");
      if(drained==2)return status();
      int pending=tick_end_pending();if(pending<0)return fault("error.physical.original_state");
      if(tickPaused&&!pending){phase=COMPLETE;transaction_state=NULL;transaction_game=NULL;return status();}
      if(tick_count>=MAX_TICKS)return fault("error.physical.tick_budget");
      if(tome_platform_step_original()==0){
        /* A real pending onTickEnd queue can coexist with native tickPaused.
         * Preserve the original main's timer-event path (code2), which calls
         * original on_tick while active. Never alter paused/energy/queue/RNG. */
        if(!pending||!isActive)return fault("error.physical.original_gate");
        SDL_Event timer;memset(&timer,0,sizeof(timer));timer.type=SDL_USEREVENT;timer.user.code=2;
        tome_main_dispatch_original_event(&timer);
      }
      ++tick_count;
    }return status();
}
