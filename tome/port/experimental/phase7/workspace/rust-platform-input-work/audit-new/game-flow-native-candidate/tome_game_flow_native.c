/* SPDX-License-Identifier: GPL-3.0-or-later
 * Separate-profile diagnostic bridge. No actor/rule/RNG/render/save methods.
 * All Lua stack/output allocations are OUTSIDE pure Rust/native heap brackets.
 * Borrowed output is copied immediately by ccall; next query overwrites it.
 */
#include <emscripten/emscripten.h>
#include <stdio.h>
#include <string.h>
#include "lua.h"
#include "lauxlib.h"
#include "types.h"
#include "tome_main_platform.h"
#include "retained_platform_drain.h"
#include "checkpoint_gate.h"
extern int current_game;
extern bool tickPaused, exit_engine;
extern int tome_physical_busy(void);
/* Same generated original-main lifecycle export used by physical_input.c. */
extern int tome_main_original_reboot_pending(void);
static lua_State *installed_state;
static int observer_ref=LUA_NOREF,attach_attempted,hooks_attached;
static const void *attached_game;
static char failure[160],output[131072];
static void raw_field(lua_State *L,int at,const char *name) {
    if(at<0)at=lua_gettop(L)+at+1;
    lua_pushstring(L,name);lua_rawget(L,at);
}
static void raw_global(lua_State *L,const char *name) {
    lua_pushstring(L,name);lua_rawget(L,LUA_GLOBALSINDEX);
}
static int failed(const char *id) {
    snprintf(failure,sizeof(failure),"%s",id);return 0;
}
static const void *game_identity(lua_State *L) {
    const void *identity=NULL;
    int top=lua_gettop(L);
    if(current_game!=LUA_NOREF){
      lua_rawgeti(L,LUA_REGISTRYINDEX,current_game);
      if(lua_istable(L,-1)){
        raw_global(L,"game");
        if(lua_istable(L,-1)&&lua_rawequal(L,-1,-2))identity=lua_topointer(L,-1);
      }
    }
    lua_settop(L,top);return identity;
}
/* Raw source-owned onTickEnd queue, never execute/clear a callback. Unknown
 * layouts fail closed. Matches actual original physical dispatch queue fields. */
static int pending_work(lua_State *L) {
    int top=lua_gettop(L),pending=1;
    lua_rawgeti(L,LUA_REGISTRYINDEX,current_game);
    if(lua_istable(L,-1)){
      raw_field(L,-1,"on_tick_end_custom");
      if(lua_isnil(L,-1)){lua_pop(L,1);raw_field(L,-1,"on_tick_end");}
      if(lua_isnil(L,-1))pending=0;
      else if(lua_istable(L,-1)){
        raw_field(L,-1,"fcts");
        if(lua_istable(L,-1))pending=lua_objlen(L,-1)>0;
      }
    }
    lua_settop(L,top);return pending;
}
static int birth_completed(lua_State *L) {
    int top=lua_gettop(L),ready=0;
    raw_global(L,"__TOME_WEB");
    if(lua_istable(L,-1)){
      raw_field(L,-1,"ready");
      ready=lua_isboolean(L,-1)&&lua_toboolean(L,-1);
    }
    lua_settop(L,top);return ready;
}
static int module_method(lua_State *L,const char *name) {
    lua_rawgeti(L,LUA_REGISTRYINDEX,observer_ref);
    if(!lua_istable(L,-1))return 0;
    raw_field(L,-1,name);lua_remove(L,-2);return lua_isfunction(L,-1);
}
static int quiescent(lua_State *L) {
    return L&&L==installed_state&&observer_ref!=LUA_NOREF&&
      current_game!=LUA_NOREF&&tickPaused&&!exit_engine&&!tome_physical_busy()&&
      !tome_web_checkpoint_busy()&&!tome_main_original_reboot_pending()&&
      game_identity(L)&&birth_completed(L)&&!pending_work(L);
}
EMSCRIPTEN_KEEPALIVE const char *tome_game_flow_error(void) {return failure;}
/* AFTER real native init, BEFORE original start/loader. Evaluation only creates
 * our own diagnostic module/global; it requires no class, actor or map. Fresh
 * original classes and real birth callbacks are not replaced. One install/VM. */
EMSCRIPTEN_KEEPALIVE int tome_game_flow_install(const char *source,unsigned int length) {
    lua_State *L=tome_main_get_state();failure[0]=0;
    if(!L||observer_ref!=LUA_NOREF||current_game!=LUA_NOREF||exit_engine||
      tome_physical_busy()||tome_web_checkpoint_busy()||tome_main_original_reboot_pending())
      return failed("game_flow.error.stage");
    if(!source||!length||length>65536u||memchr(source,0,length))
      return failed("game_flow.error.source");
    int top=lua_gettop(L);
    if(!lua_checkstack(L,32))return failed("game_flow.error.install");
    raw_global(L,"__TOME_WEB_GAME_FLOW");
    int absent=lua_isnil(L,-1);lua_pop(L,1);
    if(!absent){lua_settop(L,top);return failed("game_flow.error.stage");}
    if(luaL_loadbuffer(L,source,length,"@/adapter/game-flow/visible-flow-observer.lua")||
      lua_pcall(L,0,1,0)||!lua_istable(L,-1)){
      lua_settop(L,top);return failed("game_flow.error.install");
    }
    int module=lua_gettop(L);raw_field(L,module,"install");
    if(!lua_isfunction(L,-1)||lua_pcall(L,0,1,0)||!lua_istable(L,-1)||
      !lua_rawequal(L,module,-1)){
      lua_settop(L,top);return failed("game_flow.error.install");
    }
    lua_pop(L,1); /* return from module.install; original returned module stays */
    observer_ref=luaL_ref(L,LUA_REGISTRYINDEX);installed_state=L;
    lua_settop(L,top);return 1;
}
/* AFTER actual birth callback and original pending input/tick/frame boundary.
 * Adds only three nil-return source-native hook listeners. This is explicit
 * diagnostic preparation, not a snapshot/view, and cannot be retried partially.
 * An error requires a new document/VM; no hook graph rollback is attempted. */
EMSCRIPTEN_KEEPALIVE int tome_game_flow_attach_hooks(void) {
    lua_State *L=tome_main_get_state();failure[0]=0;
    if(attach_attempted||!quiescent(L))return failed("game_flow.error.stage");
    int top=lua_gettop(L);
    if(!lua_checkstack(L,32))return failed("game_flow.error.hooks");
    /* The reviewed chronology attaches before modal navigation/gameplay. */
    lua_rawgeti(L,LUA_REGISTRYINDEX,current_game);raw_field(L,-1,"dialogs");
    int no_dialogs=lua_istable(L,-1)&&lua_objlen(L,-1)==0;
    lua_settop(L,top);
    if(!no_dialogs)return failed("game_flow.error.stage");
    if(!module_method(L,"install_causal_hooks")){
      lua_settop(L,top);return failed("game_flow.error.hooks");
    }
    attach_attempted=1;
    if(lua_pcall(L,0,1,0)||!lua_isboolean(L,-1)||!lua_toboolean(L,-1)){
      lua_settop(L,top);return failed("game_flow.error.hooks");
    }
    hooks_attached=1;attached_game=game_identity(L);
    lua_settop(L,top);return 1;
}
/* Calls only our source-audited finite raw-read snapshot encoder. No scheduler,
 * actor getter, canSee/FOV/reaction/name, native graphics or rule/RNG callback.
 * Original input/frame/save must settle first; no implicit ticks or recovery. */
EMSCRIPTEN_KEEPALIVE const char *tome_game_flow_snapshot_json(unsigned int target_uid) {
    lua_State *L=tome_main_get_state();failure[0]=0;
    if(!hooks_attached||!quiescent(L)||game_identity(L)!=attached_game){
      failed("game_flow.error.stage");return NULL;
    }
    int top=lua_gettop(L);
    if(!lua_checkstack(L,32)||!module_method(L,"snapshot_json")){
      lua_settop(L,top);failed("game_flow.error.observer");return NULL;
    }
    lua_pushnumber(L,(lua_Number)target_uid);
    if(lua_pcall(L,1,1,0)||lua_type(L,-1)!=LUA_TSTRING){
      lua_settop(L,top);failed("game_flow.error.response");return NULL;
    }
    size_t length=0;const char *text=lua_tolstring(L,-1,&length);
    if(!text||!length||length>=sizeof(output)||memchr(text,0,length)){
      lua_settop(L,top);failed("game_flow.error.response");return NULL;
    }
    memcpy(output,text,length);output[length]=0;
    lua_settop(L,top);return output;
}