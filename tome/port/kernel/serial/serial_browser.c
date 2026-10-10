/*
    TE4 - T-Engine 4
    Copyright (C) 2009 - 2018 Nicolas Casalini

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.

    Nicolas Casalini "DarkGod"
    darkgod@te4.org
*/
#include "display.h"
#include "lua.h"
#include "lauxlib.h"
#include "lualib.h"
#include "auxiliar.h"
#include "types.h"
#include "serial.h"
#include "script.h"
#include "main.h"
#include "physfs.h"
#include "physfsrwops.h"
#include <limits.h>
#include <stdint.h>

/********************************************************************
 ** Save thread
 * This simply takes a list of buffers & zip files to save and do it
 ********************************************************************/
struct s_save_queue_type {
	zipFile *zf;
	char *zfname;
	char *filename;
	char *payload;
	size_t payload_len;
	struct s_save_queue_type *next;
};
typedef struct s_save_queue_type save_queue;

typedef struct {
	SDL_Thread *thread;
	bool running;

	save_queue *iqueue_head, *iqueue_tail;
	SDL_mutex *lock_iqueue;
	SDL_sem *wait_iqueue;

	save_queue *oqueue_head, *oqueue_tail;
	SDL_mutex *lock_oqueue;
} save_type;

static save_type *main_save = NULL;
static char *last_zipname = NULL;
static zipFile *last_zf = NULL;

/* Browser platform state; graph records and ZIP format remain upstream. */
static struct {
  save_queue *entry;
  zipFile *archive;
  char *archive_name;
  size_t offset, queued_entries, completions;
  uint64_t entries_written, payload_bytes_written;
  int entry_open, activated, error;
  char message[1024];
} browser_save;
static int browser_save_fail(const char *operation, const char *name, int code);


static void push_save(zipFile *zf, const char *zfname, const char *filename, char *payload, size_t payload_len)
{
	save_queue *q = malloc(sizeof(save_queue));
	if (!q) { browser_save_fail("allocate save entry", zfname, ZIP_INTERNALERROR); free(payload); return; }
	q->zf = zf;
	q->zfname = strdup(zfname);
	q->filename = strdup(filename);
	q->payload = payload;
	q->payload_len = payload_len;
	if (!q->zfname || !q->filename) {
		browser_save_fail("allocate save entry names", zfname, ZIP_INTERNALERROR);
		free(q->zfname); free(q->filename); free(q->payload); free(q); return;
	}

	if (!(main_save->iqueue_tail)) main_save->iqueue_head = q;
	else main_save->iqueue_tail->next = q;
	q->next = NULL;
	main_save->iqueue_tail = q;
	++browser_save.queued_entries;

	return;
}

static save_queue *pop_save()
{
	save_queue *q = NULL;
	if (main_save->iqueue_head)
	{
		q = main_save->iqueue_head;
		if (q) main_save->iqueue_head = q->next;
		if (!main_save->iqueue_head) main_save->iqueue_tail = NULL;
	}

	return q;
}

static void push_save_return(const char *zipname)
{
#ifdef STEAM_TE4
	if (!no_steam) steam_write_save(zipname);
#endif

	save_queue *q = malloc(sizeof(save_queue));
	if (!q) { browser_save_fail("allocate save completion", zipname, ZIP_INTERNALERROR); return; }
	q->zfname = strdup(zipname);
	if (!q->zfname) { browser_save_fail("allocate save completion name", zipname, ZIP_INTERNALERROR); free(q); return; }

	if (!(main_save->oqueue_tail)) main_save->oqueue_head = q;
	else main_save->oqueue_tail->next = q;
	q->next = NULL;
	main_save->oqueue_tail = q;
	++browser_save.completions;
}

static int pop_save_return(lua_State *L)
{
	save_queue *q = NULL;
	if (main_save->oqueue_head)
	{
		q = main_save->oqueue_head;
		if (q) main_save->oqueue_head = q->next;
		if (!main_save->oqueue_head) main_save->oqueue_tail = NULL;
	}

	if (q)
	{
		--browser_save.completions;
		lua_pushstring(L, q->zfname);
		free(q->zfname);
		free(q);
	}
	else
		lua_pushnil(L);

	return 1;
}


/* Browser-owned sequential save worker. GPL-3.0-or-later.
 * This replaces scheduling only; graph serialization remains upstream code.
 * No completion name is posted until ZIP close and final rename succeed.
 */
static int browser_save_fail(const char *operation, const char *name, int code)
{
	if (!browser_save.error) {
		browser_save.error = 1;
		snprintf(browser_save.message, sizeof(browser_save.message),
			"%s failed for %s (code %d)", operation, name ? name : "(none)", code);
	}
	return -1;
}

static int browser_save_physfs_fail(const char *operation, const char *name)
{
	const char *detail = PHYSFS_getLastError();
	if (!browser_save.error) {
		browser_save.error = 1;
		snprintf(browser_save.message, sizeof(browser_save.message),
			"%s failed for %s: %s", operation, name ? name : "(none)",
			detail ? detail : "PhysFS returned failure without a message");
	}
	return -1;
}

static int browser_save_finish_zip(const char *zipname)
{
	size_t len = strlen(zipname);
	if (len >= 4 && strcmp(zipname + len - 4, ".tmp") == 0) {
		char *newname = strdup(zipname);
		if (!newname) return browser_save_fail("allocate final save name", zipname, ZIP_INTERNALERROR);
		newname[len - 4] = '\0';
		if (PHYSFS_exists(newname) && !PHYSFS_delete(newname)) {
			browser_save_physfs_fail("delete previous save", newname);
			free(newname);
			return -1;
		}
		if (!PHYSFS_rename(zipname, newname)) {
			browser_save_physfs_fail("rename completed save", zipname);
			free(newname);
			return -1;
		}
		push_save_return(newname);
		free(newname);
	} else {
		push_save_return(zipname);
	}
	return browser_save.error ? -1 : 0;
}

/* Retain the externally visible upstream symbol with checked semantics. */
void finish_zip(const char *zipname)
{
	(void)browser_save_finish_zip(zipname);
}

static int browser_save_close_archive(void)
{
	zipFile *zf = browser_save.archive;
	char *name = browser_save.archive_name;
	int err;
	if (!zf) return 0;
	browser_save.archive = NULL;
	browser_save.archive_name = NULL;
	err = zipClose(zf, NULL);
	if (err != ZIP_OK) {
		browser_save_fail("zipClose", name, err);
		free(name);
		return -1;
	}
	printf("Saved zipname %s\n", name);
	err = browser_save_finish_zip(name);
	free(name);
	return err;
}

static int browser_save_begin_entry(save_queue *q)
{
	zipFile *zf = browser_save.archive;
	/* BEGIN EXACT UPSTREAM ZIP ENTRY METADATA/COMPRESSION BLOCK */
	/* Init the zip entry */
	int err=0;
	int opt_compress_level = 4;
	zip_fileinfo zi;
	unsigned long crcFile=0;
	zi.tmz_date.tm_sec = zi.tmz_date.tm_min = zi.tmz_date.tm_hour =
	zi.tmz_date.tm_mday = zi.tmz_date.tm_mon = zi.tmz_date.tm_year = 0;
	zi.dosDate = 0;
	zi.internal_fa = 0;
	zi.external_fa = 0;
	err = zipOpenNewFileInZip3(zf, q->filename, &zi,
		NULL,0,NULL,0,NULL /* comment*/,
		(opt_compress_level != 0) ? Z_DEFLATED : 0,
		opt_compress_level,0,
		-MAX_WBITS, DEF_MEM_LEVEL, Z_DEFAULT_STRATEGY,
		NULL,crcFile);
	/* END EXACT UPSTREAM ZIP ENTRY METADATA/COMPRESSION BLOCK */
	if (err != ZIP_OK) return browser_save_fail("zipOpenNewFileInZip3", q->filename, err);
	browser_save.entry_open = 1;
	return 0;
}

int tome_browser_serial_worker_ready(void)
{
	return main_save != NULL && !browser_save.error;
}

/* queued_entries excludes the current entry; completion names are not work.
 * A zero budget never starts, writes, closes, renames, or consumes anything.
 */
int tome_browser_serial_pump(unsigned max_entries, unsigned max_bytes)
{
	unsigned completed = 0;
	size_t written = 0;
	if (browser_save.error) return -1;
	if (!main_save) return browser_save_fail("save worker initialization", NULL, ZIP_INTERNALERROR);
	if (!browser_save.activated || !max_entries || !max_bytes)
		return (browser_save.queued_entries || browser_save.entry || browser_save.archive || browser_save.activated) ? 1 : 0;
	while (completed < max_entries && written < max_bytes) {
		if (!browser_save.entry) {
			save_queue *q = main_save->iqueue_head;
			if (!q) {
				if (browser_save_close_archive() < 0) return -1;
				if (last_zipname) free(last_zipname);
				last_zipname = NULL;
				last_zf = NULL;
				browser_save.activated = 0;
				return 0;
			}
			if (browser_save.archive && strcmp(browser_save.archive_name, q->zfname)) {
				if (browser_save_close_archive() < 0) return -1;
			}
			q = pop_save();
			--browser_save.queued_entries;
			browser_save.entry = q;
			browser_save.offset = 0;
			if (!browser_save.archive) {
				if (!q->zf) return browser_save_fail("zipOpen", q->zfname, ZIP_ERRNO);
				browser_save.archive = q->zf;
				browser_save.archive_name = strdup(q->zfname);
				if (!browser_save.archive_name)
					return browser_save_fail("allocate active archive name", q->zfname, ZIP_INTERNALERROR);
				printf("Saving zipname %s\n", q->zfname);
			}
			if (browser_save_begin_entry(q) < 0) return -1;
		}
		{
			save_queue *q = browser_save.entry;
			size_t remaining = q->payload_len - browser_save.offset;
			if (remaining) {
				size_t chunk = remaining;
				int err;
				if (chunk > max_bytes - written) chunk = max_bytes - written;
				if (chunk > 65536) chunk = 65536;
				err = zipWriteInFileInZip(browser_save.archive,
					q->payload + browser_save.offset, (unsigned)chunk);
				if (err != ZIP_OK) return browser_save_fail("zipWriteInFileInZip", q->filename, err);
				browser_save.offset += chunk;
				written += chunk;
				browser_save.payload_bytes_written += chunk;
			}
			if (browser_save.offset == q->payload_len) {
				int err = zipCloseFileInZip(browser_save.archive);
				if (err != ZIP_OK) return browser_save_fail("zipCloseFileInZip", q->filename, err);
				browser_save.entry_open = 0;
				free(q->payload);
				free(q->zfname);
				free(q->filename);
				free(q);
				browser_save.entry = NULL;
				browser_save.offset = 0;
				++browser_save.entries_written;
				++completed;
			}
		}
	}
	return 1;
}

const char *tome_browser_serial_error(void)
{
	return browser_save.error ? browser_save.message : NULL;
}

/* Keep the upstream initializer name for luaopen_serial, but allocate no
 * SDL thread, mutex, or semaphore. This queue has one browser owner. */
void create_save_thread(void)
{
	if (main_save) return;
	main_save = calloc(1, sizeof(save_type));
	if (!main_save) {
		browser_save_fail("allocate save queue", NULL, ZIP_INTERNALERROR);
		return;
	}
	main_save->running = TRUE;
	printf("Creating browser sequential save queue\n");
}


/********************************************************************
 ** Main thread
 * Takes a table, serialiaze it to memory and register it in the save thread
 ********************************************************************/
static int serial_new(lua_State *L)
{
	const char *zfname = lua_tostring(L, 1);
	luaL_checktype(L, 2, LUA_TFUNCTION);
	luaL_checktype(L, 3, LUA_TFUNCTION);
	if (!lua_isnil(L, 4) && !lua_istable(L, 4)) { lua_pushstring(L, "argument 4 is not nil or table"); lua_error(L); }
	if (!lua_isnil(L, 5) && !lua_istable(L, 5)) { lua_pushstring(L, "argument 5 is not nil or table"); lua_error(L); }
	if (!lua_isnil(L, 6) && !lua_istable(L, 6)) { lua_pushstring(L, "argument 6 is not nil or table"); lua_error(L); }

	int d2_ref = luaL_ref(L, LUA_REGISTRYINDEX);
	int d_ref = luaL_ref(L, LUA_REGISTRYINDEX);
	int a_ref = luaL_ref(L, LUA_REGISTRYINDEX);
	int fadd_ref = luaL_ref(L, LUA_REGISTRYINDEX);
	int fname_ref = luaL_ref(L, LUA_REGISTRYINDEX);

	serial_type *s = (serial_type*)lua_newuserdata(L, sizeof(serial_type));
	auxiliar_setclass(L, "core{serial}", -1);

	zipFile *zf = NULL;
	if (!last_zipname || strcmp(last_zipname, zfname)) {
		zf = zipOpen(zfname, APPEND_STATUS_CREATE);
		last_zf = zf;
		if (last_zipname) free(last_zipname);
		last_zipname = strdup(zfname);
	} else {
		zf = last_zf;
	}

	if (!zf) {
		browser_save_fail("zipOpen", zfname, ZIP_ERRNO);
		return luaL_error(L, "%s", browser_save.message);
	}
	s->zf = zf;
	s->zfname = zfname;
	s->fname = fname_ref;
	s->fadd = fadd_ref;
	s->allow = a_ref;
	s->disallow = d_ref;
	s->disallow2 = d2_ref;

	return 1;
}

static int serial_free(lua_State *L)
{
	serial_type *s = (serial_type*)auxiliar_checkclass(L, "core{serial}", 1);
	luaL_unref(L, LUA_REGISTRYINDEX, s->fname);
	luaL_unref(L, LUA_REGISTRYINDEX, s->fadd);
	luaL_unref(L, LUA_REGISTRYINDEX, s->allow);
	luaL_unref(L, LUA_REGISTRYINDEX, s->disallow);
	luaL_unref(L, LUA_REGISTRYINDEX, s->disallow2);
	lua_pushnumber(L, 1);
	return 1;
}

static const char *get_name(lua_State *L, serial_type *s, int idx)
{
	lua_rawgeti(L, LUA_REGISTRYINDEX, s->fname);
	lua_pushvalue(L, idx - 1);
	lua_call(L, 1, 1);
	const char *name = lua_tostring(L, -1);
	lua_pop(L, 1);
	return name;
}

static void add_process(lua_State *L, serial_type *s, int idx)
{
	lua_rawgeti(L, LUA_REGISTRYINDEX, s->fadd);
	lua_pushvalue(L, idx - 1);
	lua_call(L, 1, 0);
}

static void writeTblFixed(serial_type *s, const char *data, long len) {
	if (len + s->bufpos >= s->buflen) {
		char *newbuf = malloc(s->buflen * 2);
		memcpy(newbuf, s->buf, s->buflen);
		free(s->buf);
		s->buf = newbuf;
		s->buflen = s->buflen * 2;
	}
	memcpy(s->buf + s->bufpos, data, len);
	s->bufpos += len;
}
#define writeTbl(s, data) { writeTblFixed(s, data, strlen(data)); }

static void tbl_dump_string(serial_type *s, const char *str, size_t l)
{
	while (l--) {
		switch (*str) {
		case '"': case '\\': case '\n': {
			writeTblFixed(s, "\\", 1);
			writeTblFixed(s, str, 1);
			break;
		}
		case '\r': {
			writeTblFixed(s, "\\r", 2);
			break;
		}
		case '\0': {
			writeTblFixed(s, "\\000", 4);
			break;
		}
		default: {
			writeTblFixed(s, str, 1);
			break;
		}
		}
		str++;
	}
}

static int tbl_dump_function(lua_State *L, const void* p, size_t sz, void* ud)
{
	serial_type *s = (serial_type*)ud;
//	fwrite(p, sz, 1, stdout);
//	zipWriteInFileInZip(s->zf, p, sz);
	tbl_dump_string(s, p, sz);
	return 0;
}

static void tbl_basic_serialize(lua_State *L, serial_type *s, int type, int idx)
{
	if (type == LUA_TBOOLEAN) {
		if (lua_toboolean(L, idx)) { writeTblFixed(s, "true", 4); }
		else { writeTblFixed(s, "false", 5); }
	} else if (type == LUA_TNUMBER) {
		lua_pushvalue(L, idx);
		size_t len;
		const char *n = lua_tolstring(L, -1, &len);
		writeTblFixed(s, n, len);
		lua_pop(L, 1);
	} else if (type == LUA_TSTRING) {
		size_t len;
		const char *str = lua_tolstring(L, idx, &len);
		writeTblFixed(s, "\"", 1);
		tbl_dump_string(s, str, len);
		writeTblFixed(s, "\"", 1);
	} else if (type == LUA_TFUNCTION) {
		writeTblFixed(s, "loadstring(\"", 12);
		lua_dump(L, tbl_dump_function, s);
		writeTblFixed(s, "\")", 2);
	} else if (type == LUA_TTABLE) {
		lua_pushstring(L, "__CLASSNAME");
		lua_rawget(L, idx - 1);
		// This is an object, register for saving later
		if (!lua_isnil(L, -1))
		{
			lua_pop(L, 1);
			writeTblFixed(s, "loadObject('", 12);
			writeTbl(s, get_name(L, s, idx));
			writeTblFixed(s, "')", 2);
			add_process(L, s, idx);
		}
		// This is just a table, save it
		else
		{
			lua_pop(L, 1);
			int ktype, etype;

			writeTblFixed(s, "{", 1);
			/* table is in the stack at index 't' */
			lua_pushnil(L);  /* first key */

			while (lua_next(L, idx - 1) != 0)
			{
				ktype = lua_type(L, -2);
				etype = lua_type(L, -1);

				// Only save allowed types
				if (
					((ktype == LUA_TBOOLEAN) || (ktype == LUA_TNUMBER) || (ktype == LUA_TSTRING) || (ktype == LUA_TFUNCTION) || (ktype == LUA_TTABLE)) &&
					((etype == LUA_TBOOLEAN) || (etype == LUA_TNUMBER) || (etype == LUA_TSTRING) || (etype == LUA_TFUNCTION) || (etype == LUA_TTABLE))
					)
				{
					writeTblFixed(s, "[", 1);
					tbl_basic_serialize(L, s, ktype, -2);
					writeTblFixed(s, "]=", 2);
					tbl_basic_serialize(L, s, etype, -1);
					writeTblFixed(s, ",\n", 2);
				}

				/* removes 'value'; keeps 'key' for next iteration */
				lua_pop(L, 1);
			}
			writeTblFixed(s, "}\n", 2);
		}
	} else {
		printf("*WARNING* can not save value of type %s\n", lua_typename(L, type));
	}
}

static int serial_tozip(lua_State *L)
{
	serial_type *s = (serial_type*)auxiliar_checkclass(L, "core{serial}", 1);

	int ktype, etype;
	bool skip;

	/* Allows & disallows */
	lua_rawgeti(L, LUA_REGISTRYINDEX, s->allow);     // -5
	lua_rawgeti(L, LUA_REGISTRYINDEX, s->disallow);  // -4
	lua_rawgeti(L, LUA_REGISTRYINDEX, s->disallow2); // -3

	/* table is in the stack at index 't' */
	lua_pushvalue(L, 2);  /* table */
	lua_pushnil(L);  /* first key */

	const char *filename = get_name(L, s, -2);

	/* Init the buffer */
	s->buf = malloc(2 * 1024);
	s->buflen = 2 * 1024;
	s->bufpos = 0;

	writeTblFixed(s, "d={}\n", 5);
	writeTblFixed(s, "setLoaded('", 11);
	writeTbl(s, get_name(L, s, -2));
	writeTblFixed(s, "', d)\n", 6);
	while (lua_next(L, -2) != 0)
	{
		skip = FALSE;
		ktype = lua_type(L, -2);
		etype = lua_type(L, -1);

		if (s->allow != LUA_REFNIL)
		{
			lua_pushvalue(L, -2); lua_rawget(L, -7);
			skip = lua_isnil(L, -1); lua_pop(L, 1);
		}
		else if (s->disallow != LUA_REFNIL)
		{
			lua_pushvalue(L, -2); lua_rawget(L, -6);
			skip = !lua_isnil(L, -1); lua_pop(L, 1);
		}
		if (s->disallow2 != LUA_REFNIL)
		{
			lua_pushvalue(L, -2); lua_rawget(L, -5);
			skip = !lua_isnil(L, -1); lua_pop(L, 1);
		}

		if (!skip)
		{
			writeTblFixed(s, "d[", 2);
			tbl_basic_serialize(L, s, ktype, -2);
			writeTblFixed(s, "]=", 2);
			tbl_basic_serialize(L, s, etype, -1);
			writeTblFixed(s, "\n", 1);
		}

		/* removes 'value'; keeps 'key' for next iteration */
		lua_pop(L, 1);
	}
	writeTblFixed(s, "\nreturn d", 9);

	push_save(s->zf, s->zfname, filename, s->buf, s->bufpos);

	lua_pushboolean(L, TRUE);
	return 1;
}

static int serial_order_realsave(lua_State *L) 
{
	if (browser_save.error) return luaL_error(L, "%s", browser_save.message);
	if (!main_save) return luaL_error(L, "browser save worker is not initialized");
	browser_save.activated = 1;
	return 0;	
}


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


static const struct luaL_Reg seriallib[] =
{
	{"browserWorkerReady", serial_browser_worker_ready},
	{"browserPump", serial_browser_pump},
	{"browserStatus", serial_browser_status},
	{"browserError", serial_browser_error},
	{"new", serial_new},
	{"threadSave", serial_order_realsave},
	{"popSaveReturn", pop_save_return},
	{NULL, NULL},
};

static const struct luaL_Reg serial_reg[] =
{
	{"__gc", serial_free},
	{"toZip", serial_tozip},
	{NULL, NULL},
};

int luaopen_serial(lua_State *L)
{
	auxiliar_newclass(L, "core{serial}", serial_reg);
	luaL_openlib(L, "core.serial", seriallib, 0);
	lua_pop(L, 1);

	create_save_thread();

	return 1;
}
