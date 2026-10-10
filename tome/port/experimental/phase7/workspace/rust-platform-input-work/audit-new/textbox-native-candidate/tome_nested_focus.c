/* SPDX-License-Identifier: GPL-3.0-or-later
 * Additive observer: bounded raw reads of original focus wrappers. No callbacks,
 * metamethods, focus changes, input dispatch, gameplay mutation, RNG or draw.
 * Scratch/stack writes occur OUTSIDE the independent Rust/native heap bracket.
 */
#include <emscripten/emscripten.h>
#include <stdio.h>
#include "lua.h"
#include "lauxlib.h"
#include "tome_main_platform.h"
#include "tome_nested_focus.h"
extern int current_game, current_keyhandler, current_mousehandler;
static void raw_field(lua_State *L, int at, const char *name) {
    if(at<0)at=lua_gettop(L)+at+1;
    lua_pushstring(L,name);lua_rawget(L,at);
}
int tome_textbox_nested_focused_unicode(int *dialog_count, int *depth) {
    lua_State *L=tome_main_get_state();int count=-1, traversed=0, result=-1;
    if(dialog_count)*dialog_count=count;if(depth)*depth=traversed;
    if(!L||current_game==LUA_NOREF)return -1;
    int top=lua_gettop(L);const void *seen[32];
    if(!lua_checkstack(L,110))return -1;
    lua_rawgeti(L,LUA_REGISTRYINDEX,current_game);
    if(!lua_istable(L,-1))goto done;
    raw_field(L,-1,"dialogs");if(!lua_istable(L,-1))goto done;
    size_t length=lua_objlen(L,-1);if(length>2147483647u)goto done;
    count=(int)length;if(!count)goto done;
    lua_rawgeti(L,-1,count);if(!lua_istable(L,-1))goto done;
    for(int n=0;n<32;n++) {
        const void *identity=lua_topointer(L,-1);
        for(int k=0;k<n;k++)if(seen[k]==identity)goto done;
        seen[n]=identity;
        raw_field(L,-1,"focus_ui");
        if(lua_isnil(L,-1)) {
            lua_pop(L,1);if(!traversed)goto done;
            raw_field(L,-1,"key");if(!lua_istable(L,-1))goto done;
            raw_field(L,-1,"use_unicode");
            if(lua_isboolean(L,-1))result=lua_toboolean(L,-1)?1:0;
            goto done;
        }
        if(!lua_istable(L,-1))goto done;
        raw_field(L,-1,"ui");if(!lua_istable(L,-1))goto done;
        ++traversed;
        /* The genuine child remains strongly referenced by the original graph
         * and this stack throughout the synchronous raw traversal. */
    }
done:
    lua_settop(L,top);if(dialog_count)*dialog_count=count;if(depth)*depth=traversed;
    return result; /* -1 means unknown, never guess false/true. */
}
static const void *reference_identity(lua_State *L,int reference) {
    if(!L||reference==LUA_NOREF||reference==LUA_REFNIL)return NULL;
    int top=lua_gettop(L);lua_rawgeti(L,LUA_REGISTRYINDEX,reference);
    const void *p=lua_istable(L,-1)?lua_topointer(L,-1):NULL;
    lua_settop(L,top);return p;
}
EMSCRIPTEN_KEEPALIVE const char *tome_textbox_focus_status(void) {
    static char text[512];int count=-1,depth=0;
    int unicode=tome_textbox_nested_focused_unicode(&count,&depth);
    lua_State *L=tome_main_get_state();
    snprintf(text,sizeof(text),"{\"protocol\":1,\"focused_unicode\":%d,\"dialog_count\":%d,\"focus_depth\":%d,\"key_owner\":\"%p\",\"mouse_owner\":\"%p\",\"game_owner\":\"%p\"}",
        unicode,count,depth,reference_identity(L,current_keyhandler),
        reference_identity(L,current_mousehandler),reference_identity(L,current_game));
    return text; /* Borrowed observer buffer; copy immediately. */
}
