/* SPDX-License-Identifier: GPL-3.0-or-later
 * Source-only additive exports for a genuine original yesnoPopup roundtrip.
 * Link with the original native runtime and existing native_ui_exports.c.
 * No new Lua VM, loader, game, dialog, SDL loop, save or RNG is created here.
 */
#include <emscripten/emscripten.h>
#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include "lua.h"
#include "lauxlib.h"
#include "native_yesno_roundtrip.h"
#include "checkpoint_gate.h"

extern lua_State *tome_main_get_state(void);
static char error_text[8192];
static char *response;
static int busy;

EMSCRIPTEN_KEEPALIVE const char *tome_native_ui_roundtrip_last_error(void) {
    return error_text;
}
static void error_detail(const char *method, const char *detail) {
    snprintf(error_text,sizeof(error_text),"%s: %s",method,detail?detail:"Original callback failed");
}
static lua_State *begin(int *top) {
    if (busy) { error_detail("roundtrip","Reentrant native roundtrip call is rejected"); return NULL; }
    lua_State *state=tome_main_get_state();
    if (!state) { error_detail("roundtrip","Original Lua VM is absent"); return NULL; }
    busy=1;
    *top=lua_gettop(state);
    return state;
}
static const char *finish(lua_State *state,int top,const char *method,int status) {
    const char *result=NULL;
    if (status) {
        error_detail(method,lua_tostring(state,-1));
    } else if (lua_type(state,-1)!=LUA_TSTRING) {
        error_detail(method,"Copied JSON response is absent");
    } else {
        size_t length=0;
        const char *json=lua_tolstring(state,-1,&length);
        if (length>8u*1024u*1024u) {
            error_detail(method,"Copied JSON exceeds byte limit");
        } else {
            char *next=malloc(length+1);
            if (!next) error_detail(method,"Copied JSON allocation failed");
            else {
                memcpy(next,json,length);
                next[length]=0;
                free(response);
                response=next;
                error_text[0]=0;
                result=response;
            }
        }
    }
    lua_settop(state,top);
    busy=0;
    return result;
}
static int push_method(lua_State *state,const char *method) {
    lua_getglobal(state,"__TOME_WEB_UI_ROUNDTRIP");
    if (!lua_istable(state,-1)) {
        lua_pop(state,1);
        lua_pushliteral(state,"Original roundtrip module is not installed in the current VM");
        return 0;
    }
    lua_getfield(state,-1,method);
    lua_remove(state,-2);
    if (!lua_isfunction(state,-1)) {
        lua_pop(state,1);
        lua_pushliteral(state,"Original roundtrip method is absent");
        return 0;
    }
    return 1;
}
static const char *call(const char *method,const char *arg) {
    int top;
    lua_State *state=begin(&top);
    if (!state) return NULL;
    if (!push_method(state,method)) return finish(state,top,method,1);
    int nargs=0;
    if (arg) { lua_pushstring(state,arg); nargs=1; }
    return finish(state,top,method,lua_pcall(state,nargs,1,0));
}
EMSCRIPTEN_KEEPALIVE const char *tome_native_ui_roundtrip_install(void) {
    int top;
    lua_State *state=begin(&top);
    if (!state) return NULL;
    /* Query the current VM every time. Never cache a borrowed Lua table/stack
     * pointer or treat an old native state address as a lifecycle generation. */
    lua_getglobal(state,"__TOME_WEB_UI_ROUNDTRIP");
    int installed=lua_istable(state,-1);
    lua_pop(state,1);
    if (!installed) {
        int status=luaL_loadfile(state,"/adapter/original-yesno-roundtrip.lua");
        if (!status) status=lua_pcall(state,0,1,0);
        if (status) return finish(state,top,"install",status);
        lua_pop(state,1); /* returned module; actual same-VM global owns it */
    }
    if (!push_method(state,"status_json")) return finish(state,top,"install",1);
    return finish(state,top,"install",lua_pcall(state,0,1,0));
}
EMSCRIPTEN_KEEPALIVE const char *tome_native_ui_roundtrip_open(const char *locale) {
    if (tome_web_checkpoint_busy()) { error_detail("open","save.checkpoint.busy");return NULL; }
    if (locale && strcmp(locale,"ja") && strcmp(locale,"en")) {
        error_detail("open","Only ja/en locale is supported"); return NULL;
    }
    return call("open",locale?locale:"ja");
}
EMSCRIPTEN_KEEPALIVE const char *tome_native_ui_roundtrip_status(void) {
    return call("status_json",NULL);
}
EMSCRIPTEN_KEEPALIVE const char *tome_native_ui_roundtrip_verify_closed(const char *expected) {
    if (!expected || (strcmp(expected,"true") && strcmp(expected,"false") && strcmp(expected,"nil"))) {
        error_detail("verify_closed","Expected true/false/nil callback value is required"); return NULL;
    }
    return call("verify_closed",expected);
}
EMSCRIPTEN_KEEPALIVE const char *tome_native_ui_roundtrip_verify_stale(void) {
    return call("verify_stale",NULL);
}
