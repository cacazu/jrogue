/* SPDX-License-Identifier: GPL-3.0-or-later
 * Additive genuine-original-UI diagnostics. Build ONLY a separate fresh profile.
 * All returned strings are borrowed; JS copies immediately. Not heap-pure:
 * stack/scratch writes and glyph-cache queries belong outside the Rust bracket.
 */
#include <emscripten/emscripten.h>
#include <stdio.h>
#include <string.h>
#include "lua.h"
#include "lauxlib.h"
#include "types.h"
#include "SDL_ttf.h"
#include "tome_main_platform.h"
#include "checkpoint_gate.h"
#include "tome_nested_focus.h"
extern int current_game;
extern bool tickPaused;
extern int tome_physical_busy(void);
static lua_State *installed_state;
static int fixture_ref=LUA_NOREF;
static char failure[512],output[131072],fixture_copy[98304];
static void raw_field(lua_State *L,int at,const char *name) {
    if(at<0)at=lua_gettop(L)+at+1;
    lua_pushstring(L,name);lua_rawget(L,at);
}
static int failed(const char *id) {snprintf(failure,sizeof(failure),"%s",id);return 0;}
static int loaded_class(lua_State *L,const char *name) {
    int top=lua_gettop(L),loaded=1;lua_getglobal(L,"package");
    if(lua_istable(L,-1)){raw_field(L,-1,"loaded");if(lua_istable(L,-1)){
      raw_field(L,-1,name);loaded=!lua_isnil(L,-1);
    }}
    lua_settop(L,top);return loaded;
}
static int pending_work(lua_State *L) {
    int top=lua_gettop(L),pending=1;
    lua_rawgeti(L,LUA_REGISTRYINDEX,current_game);
    if(lua_istable(L,-1)){
      raw_field(L,-1,"on_tick_end_custom");
      if(lua_isnil(L,-1)){lua_pop(L,1);raw_field(L,-1,"on_tick_end");}
      if(lua_isnil(L,-1))pending=0;
      else if(lua_istable(L,-1)){raw_field(L,-1,"fcts");if(lua_istable(L,-1))pending=lua_objlen(L,-1)>0;}
    }
    lua_settop(L,top);return pending;
}
static int ready(lua_State *L) {
    return L&&L==installed_state&&fixture_ref!=LUA_NOREF&&current_game!=LUA_NOREF&&
        tickPaused&&!tome_physical_busy()&&!tome_web_checkpoint_busy()&&!pending_work(L)&&
        !tome_main_original_reboot_pending();
}
static int method(lua_State *L,const char *name) {
    lua_rawgeti(L,LUA_REGISTRYINDEX,fixture_ref);
    if(!lua_istable(L,-1))return 0;
    raw_field(L,-1,name);lua_remove(L,-2);return lua_isfunction(L,-1);
}
EMSCRIPTEN_KEEPALIVE const char *tome_textbox_native_error(void) {return failure;}
EMSCRIPTEN_KEEPALIVE int tome_textbox_native_install(const char *source,unsigned int length) {
    lua_State *L=tome_main_get_state();failure[0]=0;
    if(!L||installed_state==L||current_game!=LUA_NOREF||tome_physical_busy()||tome_web_checkpoint_busy()||
      !source||!length||length>65536u)return failed("textbox.error.stage");
    int top=lua_gettop(L);
    if(loaded_class(L,"engine.ui.Textbox")||loaded_class(L,"engine.ui.UIGroup")){
      lua_settop(L,top);return failed("textbox.error.overlay");
    }
    if(luaL_loadbuffer(L,source,length,"@/adapter/textbox/native-textbox-fixture.lua")||
      lua_pcall(L,0,1,0)||!lua_istable(L,-1)){
      lua_settop(L,top);return failed("textbox.error.install");
    }
    fixture_ref=luaL_ref(L,LUA_REGISTRYINDEX);installed_state=L;
    lua_settop(L,top);return 1;
}
EMSCRIPTEN_KEEPALIVE int tome_textbox_native_open(const char *initial,const char *title,
    const char *field_title,const char *cancel_text) {
    lua_State *L=tome_main_get_state();failure[0]=0;
    if(!ready(L)||!initial||!title||!field_title||!cancel_text||
      strnlen(initial,16385)>16384||strnlen(title,4097)>4096||
      strnlen(field_title,4097)>4096||strnlen(cancel_text,4097)>4096)
      return failed("textbox.error.stage");
    int top=lua_gettop(L);
    if(!method(L,"open")){lua_settop(L,top);return failed("textbox.error.install");}
    lua_pushstring(L,initial);lua_pushstring(L,title);lua_pushstring(L,field_title);lua_pushstring(L,cancel_text);
    if(lua_pcall(L,4,1,0)||!lua_isboolean(L,-1)||!lua_toboolean(L,-1)){
      /* Keep semantic failures rather than exposing arbitrary traceback in UI. */
      const char *reason=lua_type(L,-1)==LUA_TSTRING?lua_tostring(L,-1):NULL;
      if(reason&&strncmp(reason,"textbox.error.",14)==0&&strlen(reason)<sizeof(failure))
        snprintf(failure,sizeof(failure),"%s",reason);
      else failed("textbox.error.open");
      lua_settop(L,top);return 0;
    }
    lua_settop(L,top);return 1; /* Focus work must now settle through original ticks. */
}
EMSCRIPTEN_KEEPALIVE int tome_textbox_native_close(void) {
    lua_State *L=tome_main_get_state();failure[0]=0;if(!ready(L))return failed("textbox.error.stage");
    int top=lua_gettop(L);if(!method(L,"close")){lua_settop(L,top);return failed("textbox.error.install");}
    if(lua_pcall(L,0,1,0)){lua_settop(L,top);return failed("textbox.error.close");}
    int closed=lua_isboolean(L,-1)&&lua_toboolean(L,-1);lua_settop(L,top);
    return closed?1:failed("textbox.error.close");
}
static int glyphs(lua_State *L,int indices[3]) {
    indices[0]=indices[1]=indices[2]=0;
    if(!method(L,"font")||lua_pcall(L,0,1,0))return 0;
    if(lua_type(L,-1)!=LUA_TUSERDATA||lua_objlen(L,-1)!=sizeof(TTF_Font*))return 0;
    int object=lua_gettop(L);
    if(!lua_getmetatable(L,object))return 0;
    lua_pushliteral(L,"sdl{font}");lua_rawget(L,LUA_REGISTRYINDEX);
    int correct=lua_istable(L,-1)&&lua_rawequal(L,-1,-2);lua_pop(L,2);
    if(!correct)return 0;
    TTF_Font **held=(TTF_Font**)lua_touserdata(L,object);if(!held||!*held)return 0;
    /* The newly constructed active fixture retains this genuine userdata. It
     * never calls font.close, substitutes fonts, yields or tears down here. */
    indices[0]=TTF_GlyphIsProvided(*held,0x65e5);
    indices[1]=TTF_GlyphIsProvided(*held,0x672c);
    indices[2]=TTF_GlyphIsProvided(*held,0x8a9e);
    return 1;
}
EMSCRIPTEN_KEEPALIVE const char *tome_textbox_native_status(void) {
    lua_State *L=tome_main_get_state();failure[0]=0;
    if(!ready(L)){failed("textbox.error.stage");return NULL;}
    int top=lua_gettop(L);
    if(!method(L,"status_json")||lua_pcall(L,0,1,0)||lua_type(L,-1)!=LUA_TSTRING){
      lua_settop(L,top);failed("textbox.error.status");return NULL;
    }
    size_t n=0;const char *text=lua_tolstring(L,-1,&n);
    if(!text||n>=sizeof(fixture_copy)){lua_settop(L,top);failed("textbox.error.status");return NULL;}
    memcpy(fixture_copy,text,n);fixture_copy[n]=0;lua_settop(L,top);
    int indices[3],known=glyphs(L,indices);lua_settop(L,top);
    const char *focus=tome_textbox_focus_status();
    int length=snprintf(output,sizeof(output),
      "{\"protocol\":1,\"fixture\":%s,\"focus\":%s,\"font\":{\"known\":%s,\"glyph_65e5\":%d,\"glyph_672c\":%d,\"glyph_8a9e\":%d,\"complete_bmp_probe\":%s}}",
      fixture_copy,focus,known?"true":"false",indices[0],indices[1],indices[2],
      known&&indices[0]>0&&indices[1]>0&&indices[2]>0?"true":"false");
    if(length<0||(size_t)length>=sizeof(output)){failed("textbox.error.status");return NULL;}
    return output;
}