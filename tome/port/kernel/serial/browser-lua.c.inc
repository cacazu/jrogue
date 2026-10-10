static int serial_browser_worker_ready(lua_State *L)
{
	lua_pushboolean(L, tome_browser_serial_worker_ready());
	return 1;
}

static int serial_browser_pump(lua_State *L)
{
	lua_Integer entries = luaL_optinteger(L, 1, 4);
	lua_Integer bytes = luaL_optinteger(L, 2, 65536);
	if (entries < 0 || bytes < 0 || (unsigned long long)entries > UINT_MAX || (unsigned long long)bytes > UINT_MAX)
		return luaL_error(L, "browser save pump budgets must fit unsigned int");
	lua_pushinteger(L, tome_browser_serial_pump((unsigned)entries, (unsigned)bytes));
	return 1;
}

static int serial_browser_error(lua_State *L)
{
	const char *error = tome_browser_serial_error();
	if (error) lua_pushstring(L, error);
	else lua_pushnil(L);
	return 1;
}

static int serial_browser_status(lua_State *L)
{
	lua_newtable(L);
#define BROWSER_BOOL(name, value) do { lua_pushboolean(L, (value)); lua_setfield(L, -2, (name)); } while (0)
#define BROWSER_NUMBER(name, value) do { lua_pushnumber(L, (lua_Number)(value)); lua_setfield(L, -2, (name)); } while (0)
	BROWSER_BOOL("ready", tome_browser_serial_worker_ready());
	BROWSER_BOOL("activated", browser_save.activated);
	BROWSER_NUMBER("queued_entries", browser_save.queued_entries);
	BROWSER_BOOL("entry_inflight", browser_save.entry != NULL);
	BROWSER_BOOL("archive_inflight", browser_save.archive != NULL);
	BROWSER_NUMBER("completions", browser_save.completions);
	BROWSER_NUMBER("entries_written", browser_save.entries_written);
	BROWSER_NUMBER("payload_bytes_written", browser_save.payload_bytes_written);
	BROWSER_BOOL("idle", main_save && !browser_save.error && !browser_save.activated &&
		!browser_save.queued_entries && !browser_save.entry && !browser_save.archive);
	if (browser_save.error) lua_pushstring(L, browser_save.message);
	else lua_pushnil(L);
	lua_setfield(L, -2, "error");
#undef BROWSER_BOOL
#undef BROWSER_NUMBER
	return 1;
}
