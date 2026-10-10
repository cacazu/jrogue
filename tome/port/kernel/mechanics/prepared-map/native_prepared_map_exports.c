/* SPDX-License-Identifier: GPL-3.0-or-later
 * Source-only optional ABI. Actual main VM, no extra loader/game/render loop.
 */
#include "display.h"
#include "types.h"
#include "lua.h"
#include "lauxlib.h"
#include "tome_prepared_map_capture.h"
#include "checkpoint_gate.h"
#include <emscripten/emscripten.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <limits.h>
extern lua_State *tome_main_get_state(void);
static char error_text[8192];
static char *response;
static int busy;
EMSCRIPTEN_KEEPALIVE const char *tome_native_prepared_map_last_error(void) {return error_text;}
EMSCRIPTEN_KEEPALIVE int tome_native_prepared_map_install(void) {
    lua_State *L=tome_main_get_state();
    if (!L || busy || tome_web_checkpoint_busy()) {snprintf(error_text,sizeof(error_text),"Original VM is absent/busy or save/resume exclusion is held");return 0;}
    busy=1; int top=lua_gettop(L);
    lua_getglobal(L,"__TOME_WEB_PREPARED_MAP");
    int installed=lua_istable(L,-1); lua_pop(L,1);
    int status=0;
    if (!installed) {
        status=luaL_loadfile(L,"/adapter/original-map-packet.lua");
        if (!status) status=lua_pcall(L,0,1,0);
    }
    if (status) snprintf(error_text,sizeof(error_text),"%s",lua_tostring(L,-1)?lua_tostring(L,-1):"Original packet module failed");
    else error_text[0]=0;
    lua_settop(L,top);busy=0;return status?0:1;
}
static const char *call(const char *method,int nargs,double epoch,double budget) {
    lua_State *L=tome_main_get_state();
    if (!L || busy) {snprintf(error_text,sizeof(error_text),"Original VM is absent/busy");return NULL;}
    if (!strcmp(method,"begin_json") && tome_web_checkpoint_busy()) {
        snprintf(error_text,sizeof(error_text),"Original save/resume checkpoint exclusion is held");return NULL;
    }
    busy=1;int top=lua_gettop(L);
    lua_getglobal(L,"__TOME_WEB_PREPARED_MAP");
    if (!lua_istable(L,-1)) {snprintf(error_text,sizeof(error_text),"Original packet adapter is absent");goto failed;}
    lua_getfield(L,-1,method);lua_remove(L,-2);
    if (!lua_isfunction(L,-1)) {snprintf(error_text,sizeof(error_text),"Original packet method is absent");goto failed;}
    if (nargs>0) lua_pushnumber(L,epoch);
    if (nargs>1) lua_pushnumber(L,budget);
    if (lua_pcall(L,nargs,1,0)) {snprintf(error_text,sizeof(error_text),"%s",lua_tostring(L,-1)?lua_tostring(L,-1):"Original packet method failed");goto failed;}
    if (lua_type(L,-1)!=LUA_TSTRING) {snprintf(error_text,sizeof(error_text),"Packet metadata JSON is absent");goto failed;}
    size_t length=0;const char *json=lua_tolstring(L,-1,&length);
    if (length>8192) {snprintf(error_text,sizeof(error_text),"Packet metadata exceeds byte limit");goto failed;}
    char *next=malloc(length+1);
    if (!next) {snprintf(error_text,sizeof(error_text),"Packet metadata allocation failed");goto failed;}
    memcpy(next,json,length);next[length]=0;free(response);response=next;
    lua_settop(L,top);busy=0;error_text[0]=0;return response;
failed:
    lua_settop(L,top);busy=0;return NULL;
}
EMSCRIPTEN_KEEPALIVE const char *tome_native_prepared_map_begin(double epoch,double byte_budget) {
    return call("begin_json",2,epoch,byte_budget);
}
EMSCRIPTEN_KEEPALIVE const char *tome_native_prepared_map_seal(double epoch) {
    return call("seal_json",1,epoch,0);
}
EMSCRIPTEN_KEEPALIVE const char *tome_native_prepared_map_status(void) {
    return call("status_json",0,0,0);
}
EMSCRIPTEN_KEEPALIVE const char *tome_native_prepared_map_release(void) {
    return call("release_json",0,0,0);
}
EMSCRIPTEN_KEEPALIVE const unsigned char *tome_native_prepared_map_packet_ptr(void) {
    size_t length=0;
    return tome_prepared_map_packet(tome_main_get_state(),&length);
}
EMSCRIPTEN_KEEPALIVE unsigned tome_native_prepared_map_packet_size(void) {
    size_t length=0;
    if (!tome_prepared_map_packet(tome_main_get_state(),&length) || length>UINT_MAX) return 0;
    return (unsigned)length;
}
