/* SPDX-License-Identifier: GPL-3.0-or-later
 * Source-only optional exports for the original-dialog-view.lua adapter.
 * Link with the actual original native runtime; do not install another Lua VM.
 */
#include <emscripten/emscripten.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include "lua.h"
#include "checkpoint_gate.h"
#include "SDL.h"
extern lua_State *tome_main_get_state(void);
static char ui_error[8192];
static char *ui_response;
EMSCRIPTEN_KEEPALIVE const char *tome_native_ui_last_error(void) { return ui_error; }
/* Input scheduling only; UI projections never call or sample this clock. */
EMSCRIPTEN_KEEPALIVE double tome_native_ui_clock_ms(void) { return (double)SDL_GetTicks(); }
EMSCRIPTEN_KEEPALIVE int tome_native_ui_available(void) {
    lua_State *state=tome_main_get_state();
    if (!state) return 0;
    int top=lua_gettop(state);
    lua_getglobal(state,"__TOME_WEB_UI");
    int available=lua_istable(state,-1);
    lua_settop(state,top);
    return available;
}
static const char *ui_call(const char *method,const char *dialog,const char *target,const char *key) {
    lua_State *state=tome_main_get_state();
    if (!state) { snprintf(ui_error,sizeof(ui_error),"Original Lua state is absent"); return NULL; }
    int top=lua_gettop(state);
    lua_getglobal(state,"__TOME_WEB_UI");
    if (!lua_istable(state,-1)) { snprintf(ui_error,sizeof(ui_error),"Original UI seam is not installed"); lua_settop(state,top); return NULL; }
    lua_getfield(state,-1,method); lua_remove(state,-2);
    if (!lua_isfunction(state,-1)) { snprintf(ui_error,sizeof(ui_error),"Original UI method is absent"); lua_settop(state,top); return NULL; }
    int nargs=0;
    if (dialog) { lua_pushstring(state,dialog);lua_pushstring(state,target?target:"");lua_pushstring(state,key?key:"");nargs=3; }
    if (lua_pcall(state,nargs,1,0)) {
        const char *detail=lua_tostring(state,-1);
        snprintf(ui_error,sizeof(ui_error),"%s: %s",method,detail?detail:"Original callback failed");
        lua_settop(state,top);return NULL;
    }
    size_t length=0; const char *json=lua_tolstring(state,-1,&length);
    if (!json || length>8u*1024u*1024u) { snprintf(ui_error,sizeof(ui_error),"UI JSON absent or exceeds byte limit");lua_settop(state,top);return NULL; }
    char *next=malloc(length+1);
    if (!next) { snprintf(ui_error,sizeof(ui_error),"UI JSON allocation failed");lua_settop(state,top);return NULL; }
    memcpy(next,json,length);next[length]=0;free(ui_response);ui_response=next;
    lua_settop(state,top);return ui_response;
}
EMSCRIPTEN_KEEPALIVE const char *tome_native_ui_snapshot(void) { return ui_call("snapshot_json",NULL,NULL,NULL); }
EMSCRIPTEN_KEEPALIVE const char *tome_native_ui_command(const char *dialog,const char *target,const char *key) {
    if (tome_web_checkpoint_busy()) { snprintf(ui_error,sizeof(ui_error),"save.checkpoint.busy");return NULL; }
    if (!dialog || !key) { snprintf(ui_error,sizeof(ui_error),"UI command arguments are absent");return NULL; }
    return ui_call("command_json",dialog,target,key);
}
