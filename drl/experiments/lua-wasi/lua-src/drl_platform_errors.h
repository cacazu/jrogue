#ifndef DRL_PLATFORM_ERRORS_H
#define DRL_PLATFORM_ERRORS_H
#include "lua.h"
int drl_lua_platform_error(lua_State *L,const char *id,const char *english);
#endif
