/* SPDX-License-Identifier: GPL-3.0-or-later
 * Synchronous original Lua -> browser host -> Rust WASM semantic resolver.
 * Parameters are never formatted or translated here. The retained Lua seam
 * owns original tformat, native specials and active native locale contracts.
 */
#include <emscripten/emscripten.h>
#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include "lua.h"
#include "lauxlib.h"
extern lua_State *tome_main_get_state(void);
static char semantic_error[8192];

EM_JS(int, tome_semantic_host_ready, (), {
    return !!(Module.tomeSemanticResolver && Module.tomeSemanticResolver.ready);
});
EM_JS(unsigned int, tome_semantic_begin, (const char *source,const char *tag,const char *file,double line,const char *locale), {
    var host=Module.tomeSemanticResolver;
    if (!host || !host.ready) return 0;
    return host.beginResolve(UTF8ToString(source),UTF8ToString(tag),file?UTF8ToString(file):null,line,UTF8ToString(locale));
});
EM_JS(unsigned int, tome_semantic_begin_supplement, (const char *id), {
    var host=Module.tomeSemanticResolver;
    return host && host.ready ? host.beginSupplement(UTF8ToString(id)) : 0;
});
EM_JS(unsigned int, tome_semantic_begin_policy, (const char *id), {
    var host=Module.tomeSemanticResolver;
    return host && host.ready ? host.beginPolicy(UTF8ToString(id)) : 0;
});
EM_JS(int, tome_semantic_has_result, (unsigned int handle), {
    return !!Module.tomeSemanticResolver.hasResult(handle);
});
EM_JS(int, tome_semantic_has_supplement, (unsigned int handle), {
    return !!Module.tomeSemanticResolver.hasSupplement(handle);
});
EM_JS(int, tome_semantic_has_policy, (unsigned int handle), {
    return !!Module.tomeSemanticResolver.hasPolicy(handle);
});
EM_JS(unsigned int, tome_semantic_policy_argument, (unsigned int handle), {
    return Module.tomeSemanticResolver.policyArgument(handle);
});
EM_JS(unsigned int, tome_semantic_policy_array_count, (unsigned int handle,unsigned int array), {
    return Module.tomeSemanticResolver.policyArray(handle,array).length;
});
EM_JS(int, tome_semantic_policy_array_size, (unsigned int handle,unsigned int array,unsigned int index), {
    var value=Module.tomeSemanticResolver.policyArray(handle,array)[index];
    return typeof value === 'string' ? lengthBytesUTF8(value) : -1;
});
EM_JS(int, tome_semantic_policy_array_copy, (unsigned int handle,unsigned int array,unsigned int index,char *target,unsigned int capacity), {
    var value=Module.tomeSemanticResolver.policyArray(handle,array)[index];
    if (typeof value !== 'string' || lengthBytesUTF8(value)+1 > capacity) return 0;
    stringToUTF8(value,target,capacity);return 1;
});
EM_JS(int, tome_semantic_string_size, (unsigned int handle,unsigned int field), {
    var value=Module.tomeSemanticResolver.string(handle,field);
    return typeof value === 'string' ? lengthBytesUTF8(value) : -1;
});
EM_JS(int, tome_semantic_copy_string, (unsigned int handle,unsigned int field,char *target,unsigned int capacity), {
    var value=Module.tomeSemanticResolver.string(handle,field);
    if (typeof value !== 'string' || lengthBytesUTF8(value)+1 > capacity) return 0;
    stringToUTF8(value,target,capacity);
    return 1;
});
EM_JS(unsigned int, tome_semantic_order_count, (unsigned int handle), {
    return Module.tomeSemanticResolver.orderLength(handle);
});
EM_JS(unsigned int, tome_semantic_order_index, (unsigned int handle,unsigned int index), {
    return Module.tomeSemanticResolver.order(handle,index);
});
EM_JS(int, tome_semantic_flag, (unsigned int handle,unsigned int field), {
    return !!Module.tomeSemanticResolver.flag(handle,field);
});
EM_JS(void, tome_semantic_release, (unsigned int handle), {
    if (Module.tomeSemanticResolver) Module.tomeSemanticResolver.release(handle);
});

/* Push an independent Lua string, including a legitimate empty JA template.
 * Every temporary C allocation and JS lease is released before normal return.
 */
static int push_result_string(lua_State *state,unsigned int handle,unsigned int field) {
    int length=tome_semantic_string_size(handle,field);
    if (length<0 || length>4*1024*1024) return 0;
    char *bytes=malloc((size_t)length+1);
    if (!bytes) return 0;
    if (!tome_semantic_copy_string(handle,field,bytes,(unsigned int)length+1)) { free(bytes);return 0; }
    lua_pushlstring(state,bytes,(size_t)length);
    free(bytes);return 1;
}
static int push_failure(lua_State *state,unsigned int handle,const char *fallback) {
    lua_pushnil(state);
    if (!handle || !push_result_string(state,handle,0)) lua_pushstring(state,fallback);
    if (handle) tome_semantic_release(handle);
    return 2;
}
static const char *checked_native_text(lua_State *state,int index,const char *fallback) {
    if (lua_isnoneornil(state,index)) return fallback;
    size_t length=0;
    const char *text=luaL_checklstring(state,index,&length);
    if (strlen(text)!=length) luaL_error(state,"Semantic source fields cannot contain embedded NUL bytes");
    return text;
}
static int semantic_resolve(lua_State *state) {
    const char *source=checked_native_text(state,1,NULL);
    if (!source) return luaL_error(state,"Semantic source string required");
    const char *tag=checked_native_text(state,2,"_t");
    const char *file=checked_native_text(state,3,NULL);
    double line=lua_isnumber(state,4)?lua_tonumber(state,4):-1;
    const char *locale=checked_native_text(state,5,"ja_JP");
    int top=lua_gettop(state);
    unsigned int handle=tome_semantic_begin(source,tag,file,line,locale);
    if (!handle || !tome_semantic_has_result(handle)) return push_failure(state,handle,"resolver_not_ready");
    lua_newtable(state);
    const char *fields[]={"id","template","owner","tag"};
    for (unsigned int index=0;index<4;index++) {
        if (!push_result_string(state,handle,index+1)) {
            lua_settop(state,top);return push_failure(state,handle,"semantic_string_copy_failed");
        }
        lua_setfield(state,-2,fields[index]);
    }
    unsigned int count=tome_semantic_order_count(handle);
    if (count>65536) { lua_settop(state,top);return push_failure(state,handle,"semantic_argument_order_limit"); }
    lua_createtable(state,(int)count,0);
    for (unsigned int index=0;index<count;index++) {
        lua_pushnumber(state,tome_semantic_order_index(handle,index));lua_rawseti(state,-2,(int)index+1);
    }
    lua_setfield(state,-2,"args_order");
    const char *flags[]={"missing_official_japanese","delegate_native_special","delegate_native_format_review"};
    for (unsigned int index=0;index<3;index++) {
        lua_pushboolean(state,tome_semantic_flag(handle,index));lua_setfield(state,-2,flags[index]);
    }
    tome_semantic_release(handle);
    return 1;
}
static int semantic_supplement(lua_State *state) {
    const char *id=checked_native_text(state,1,NULL);
    if (!id) return luaL_error(state,"Semantic ID string required");
    unsigned int handle=tome_semantic_begin_supplement(id);
    if (!handle || !tome_semantic_has_supplement(handle)) return push_failure(state,handle,"no_reviewed_supplement");
    if (!push_result_string(state,handle,5)) return push_failure(state,handle,"semantic_string_copy_failed");
    tome_semantic_release(handle);
    return 1;
}
static int semantic_policy(lua_State *state) {
    const char *id=checked_native_text(state,1,NULL); int top=lua_gettop(state);
    if (!id) return luaL_error(state,"Semantic ID string required");
    unsigned int handle=tome_semantic_begin_policy(id);
    if (!handle || !tome_semantic_has_policy(handle)) return push_failure(state,handle,"no_reviewed_format_policy");
    lua_newtable(state);
    const char *fields[]={"kind","review_status","source","tag","target","semantic_id"};
    for (unsigned int index=0;index<6;index++) {
        if (!push_result_string(state,handle,index+6)) { lua_settop(state,top);return push_failure(state,handle,"semantic_policy_copy_failed"); }
        lua_setfield(state,-2,fields[index]);
    }
    lua_pushnumber(state,tome_semantic_policy_argument(handle));lua_setfield(state,-2,"argument_index");
    /* Rust accepts only the two explicitly reviewed policies with this false flag. */
    lua_pushboolean(state,0);lua_setfield(state,-2,"delegate_native_format_review");
    lua_pushboolean(state,1);lua_setfield(state,-2,"native_special_and_effective_order_checks_required");
    const char *arrays[]={"source_specifiers","target_specifiers","source_types","target_types"};
    for (unsigned int array=0;array<4;array++) {
        unsigned int count=tome_semantic_policy_array_count(handle,array);
        if (count>16) { lua_settop(state,top);return push_failure(state,handle,"semantic_policy_array_limit"); }
        lua_createtable(state,(int)count,0);
        for (unsigned int index=0;index<count;index++) {
            int length=tome_semantic_policy_array_size(handle,array,index);
            if (length<0 || length>256) { lua_settop(state,top);return push_failure(state,handle,"semantic_policy_array_value"); }
            char bytes[257];
            if (!tome_semantic_policy_array_copy(handle,array,index,bytes,sizeof(bytes))) { lua_settop(state,top);return push_failure(state,handle,"semantic_policy_copy_failed"); }
            lua_pushlstring(state,bytes,(size_t)length);lua_rawseti(state,-2,(int)index+1);
        }
        lua_setfield(state,-2,arrays[array]);
    }
    tome_semantic_release(handle);return 1;
}

EMSCRIPTEN_KEEPALIVE const char *tome_native_semantic_last_error(void) { return semantic_error; }
EMSCRIPTEN_KEEPALIVE int tome_native_semantic_register(void) {
    lua_State *state=tome_main_get_state();
    if (!state) { snprintf(semantic_error,sizeof(semantic_error),"Original Lua state is absent; initialize native runtime first");return 0; }
    if (!tome_semantic_host_ready()) { snprintf(semantic_error,sizeof(semantic_error),"Initialize the actual Rust semantic WASM catalogue first");return 0; }
    lua_pushcfunction(state,semantic_resolve);lua_setglobal(state,"__TOME_SEMANTIC_RESOLVE");
    lua_pushcfunction(state,semantic_supplement);lua_setglobal(state,"__TOME_SEMANTIC_SUPPLEMENT");
    lua_pushcfunction(state,semantic_policy);lua_setglobal(state,"__TOME_SEMANTIC_FORMAT_POLICY");
    semantic_error[0]=0;
    return 1;
}
