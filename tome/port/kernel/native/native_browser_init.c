/* SPDX-License-Identifier: GPL-3.0-or-later
 * Browser bootstrap adapter around the actual original C and Lua modules.
 * This initial bootstrap uses original SDL/OpenGL presentation for comparison.
 * Rust display/input/environment consume read-only Lua snapshots afterwards.
 */
#include <emscripten/emscripten.h>
#include <sys/stat.h>
#include <unistd.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include "lauxlib.h"
#include "display.h"
#include "main.h"
#include "music.h"
#include "physfs.h"
#include "SFMT.h"
#include "retained_registry.h"
#include "tome_rng_snapshot.h"
#include "tome_normal_snapshot.h"
#include "tome_libc_rng_snapshot.h"
#include "tome_combined_rng_snapshot.h"
#include "checkpoint_gate.h"

extern lua_State *tome_main_get_state(void);
extern int tome_main_attach_state(lua_State *state);
extern int tome_main_initialize_core_metadata(void);
extern SDL_mutex *renderingLock, *realtimeLock;
extern SDL_GLContext maincontext;
extern SDL_Window *window;
extern int max_texture_size, nb_cpus;
extern bool no_sound, shaders_active;

static char error_text[8192];
static char *response;
static int initialized_adapter;
enum { SFMT_BYTES=2524, NORMAL_BYTES=36, LIBC_BYTES=28, RNG_BYTES=SFMT_BYTES+NORMAL_BYTES+LIBC_BYTES };
static char rng_hex[RNG_BYTES*2+1];

static int fail(const char *phase, const char *detail) {
    snprintf(error_text, sizeof(error_text), "%s: %s", phase, detail ? detail : "unknown error");
    fprintf(stderr, "TOME_NATIVE_ERROR=%s\n", error_text);
    return 0;
}
static int check_lua_status(const char *phase, int status) {
    if (!status) return 1;
    lua_State *state=tome_main_get_state();
    int result=fail(phase, lua_tostring(state, -1));
    lua_pop(state, 1);
    return result;
}
EMSCRIPTEN_KEEPALIVE const char *tome_native_last_error(void) { return error_text; }

EMSCRIPTEN_KEEPALIVE int tome_native_init(void) {
    if (initialized_adapter) return fail("initialize", "adapter already initialized");
    mkdir("/persist", 0700);
    setenv("HOME", "/persist", 1);
    override_home=strdup("/persist");
    no_connectivity=TRUE;
    no_steam=TRUE;
    no_sound=TRUE;
    safe_mode=TRUE; /* Original --safe-mode policy for initial real-core proof. */
    nb_cpus=1;
    /* Match original main's required RNG initialization before Lua boot, with
     * an explicit replay seed instead of wall time. The driver seeds its real
     * original birth boundary; original Gaussian cache semantics are retained.
     */
    init_gen_rand(176);
    if (!tome_main_initialize_core_metadata()) return fail("core metadata", "original initialization rejected");
    if (SDL_Init(SDL_INIT_VIDEO|SDL_INIT_TIMER|SDL_INIT_JOYSTICK)) return fail("SDL", SDL_GetError());
    renderingLock=SDL_CreateMutex();
    realtimeLock=SDL_CreateMutex();
    if (!renderingLock || !realtimeLock) return fail("SDL mutex", SDL_GetError());
    if (TTF_Init()) return fail("TTF", TTF_GetError());
    if (!(IMG_Init(IMG_INIT_PNG)&IMG_INIT_PNG)) return fail("image PNG", IMG_GetError());
    SDL_GL_SetAttribute(SDL_GL_CONTEXT_MAJOR_VERSION, 2);
    SDL_GL_SetAttribute(SDL_GL_CONTEXT_MINOR_VERSION, 0);
    SDL_GL_SetAttribute(SDL_GL_DOUBLEBUFFER, 1);
    window=SDL_CreateWindow("Tales of Maj'Eyal retained core",0,0,1280,720,SDL_WINDOW_OPENGL|SDL_WINDOW_SHOWN);
    if (!window) return fail("window", SDL_GetError());
    maincontext=SDL_GL_CreateContext(window);
    if (!maincontext) return fail("GL context", SDL_GetError());
    SDL_GL_MakeCurrent(window, maincontext);
    GLenum glew_status=glewInit();
    if (glew_status != GLEW_OK && glew_status != GLEW_ERROR_GLX_VERSION_11_ONLY) return fail("GLEW", (const char *)glewGetErrorString(glew_status));
    screen=SDL_GetWindowSurface(window);
    if (!screen) return fail("SDL surface", SDL_GetError());
    glGetIntegerv(GL_MAX_TEXTURE_SIZE,&max_texture_size);
    fbo_active=FALSE;
    multitexture_active=FALSE;
    shaders_active=FALSE;
    resizeWindow(1280,720);
    init_openal(); /* Real OpenAL backend; original no_sound option prevents playback. */
    if (!PHYSFS_init("/original/t-engine")) return fail("PhysFS initialize", PHYSFS_getLastError());
    if (!PHYSFS_mount("/original/bootstrap","/bootstrap",1)) return fail("bootstrap mount", PHYSFS_getLastError());
    if (!PHYSFS_mount("/unpacked/game","/",0)) return fail("source mounts", PHYSFS_getLastError());
    if (!PHYSFS_mount("/adapter","/adapter",1)) return fail("adapter mount", PHYSFS_getLastError());
    if (chdir("/original")) return fail("working directory", "trusted original VFS directory absent");
    lua_State *state=lua_open();
    if (!state) return fail("Lua VM", "allocation failed");
    if (!tome_main_attach_state(state)) { lua_close(state); return fail("Lua VM", "original state attachment rejected"); }
    if (!check_lua_status("original module registration", tome_open_original_modules(state))) return 0;
    physfs_reset_dir_allowed(state);
    tome_initialize_original_globals(state,"/original/t-engine");
    if (!check_lua_status("original bootstrap", tome_run_original_bootstrap(state))) return 0;
    if (!tome_web_checkpoint_gate_install(state)) return fail("checkpoint gate", "original core.game registration absent");
    lua_newtable(state);
    lua_pushstring(state,"/original/game"); lua_setfield(state,-2,"root_game");
    lua_pushstring(state,"/unpacked/game"); lua_setfield(state,-2,"unpacked_game");
    lua_pushnumber(state,176); lua_setfield(state,-2,"seed");
    lua_setglobal(state,"__TOME_WEB_SETTINGS");
    initialized_adapter=1;
    fprintf(stdout,"TOME_NATIVE_MODULES_READY=1\n");
    return 1;
}
EMSCRIPTEN_KEEPALIVE int tome_native_start(void) {
    if (!initialized_adapter) return fail("start", "original modules are not initialized");
    return check_lua_status("original game boot driver", tome_run_original_file(tome_main_get_state(),"/adapter/real-core-probe.lua"));
}
/* Opt-in diagnostic fresh-profile localization. The host creates a fresh
 * guest MEMFS, initializes the actual Rust catalogue, and registers its C/Lua
 * callbacks first. Persisted profiles require a separate hydrated preference
 * path; this export must never be used to override a saved language choice.
 */
static int enable_semantic_before_config(void) {
    if (!initialized_adapter) return fail("semantic fresh profile", "native initialization required");
    lua_State *state=tome_main_get_state();
    int top=lua_gettop(state);
    lua_getglobal(state,"__TOME_SEMANTIC_RESOLVE");
    if (!lua_isfunction(state,-1)) { lua_settop(state,top);return fail("semantic fresh profile", "actual Rust resolver is not registered"); }
    lua_pop(state,1);
    lua_getglobal(state,"package");lua_getfield(state,-1,"loaded");lua_getfield(state,-1,"config");
    if (!lua_isnil(state,-1)) { lua_settop(state,top);return fail("semantic fresh profile", "original configuration already loaded"); }
    lua_settop(state,top);
    lua_getglobal(state,"__TOME_WEB_SETTINGS");
    if (!lua_istable(state,-1)) { lua_settop(state,top);return fail("semantic fresh profile", "original settings table absent"); }
    const char *fields[]={"semantic_bootstrap","semantic_module","semantic_options","semantic_observer"};
    const char *paths[]={"/adapter/localization/native_semantic_bootstrap.lua","/adapter/localization/semantic_i18n.lua",
        "/adapter/localization/native_semantic_options.lua","/adapter/localization/native_i18n_install.lua"};
    for (size_t i=0;i<4;i++) {lua_pushstring(state,paths[i]);lua_setfield(state,-2,fields[i]);}
    lua_pushboolean(state,1);lua_setfield(state,-2,"locale_preferences_ready");
    lua_settop(state,top);return 1;
}
EMSCRIPTEN_KEEPALIVE int tome_native_enable_semantic_fresh(void) {
    return enable_semantic_before_config();
}
/* The host validates the immutable durable generation and copies its runtime
 * home before setting the accepted original resume request. The observer reads
 * the original hydrated configuration; no preferred locale is overwritten. */
EMSCRIPTEN_KEEPALIVE int tome_native_enable_semantic_resume(const char *preferred_locale) {
    if (!preferred_locale || !*preferred_locale || strnlen(preferred_locale,25)>24)
        return fail("semantic resume", "save.resume.locale_metadata_required");
    for (const char *p=preferred_locale;*p;p++)
        if (!((*p>='a'&&*p<='z')||(*p>='A'&&*p<='Z')||(*p>='0'&&*p<='9')||*p=='_'||*p=='-'))
            return fail("semantic resume", "save.resume.invalid_locale_metadata");
    if (!initialized_adapter || tome_web_checkpoint_busy())
        return fail("semantic resume", "save.resume.invalid_start_state");
    lua_State *state=tome_main_get_state();int top=lua_gettop(state);
    lua_getglobal(state,"game");int fresh=lua_isnil(state,-1);lua_pop(state,1);
    lua_getglobal(state,"__TOME_WEB_RESUME");
    int accepted=lua_istable(state,-1);
    if (accepted) {
        lua_getfield(state,-1,"mode");const char *mode=lua_tostring(state,-1);
        accepted=mode&&!strcmp(mode,"baseline_original_resume");lua_pop(state,1);
    }
    lua_settop(state,top);
    if (!fresh || !accepted) return fail("semantic resume", "save.resume.validated_request_required");
    if (!enable_semantic_before_config()) return 0;
    lua_getglobal(state,"__TOME_WEB_SETTINGS");
    lua_pushstring(state,preferred_locale);lua_setfield(state,-2,"preferred_locale");
    lua_settop(state,top);
    return 1;
}
EMSCRIPTEN_KEEPALIVE int tome_native_configure_character_name(const char *name) {
    if (!initialized_adapter || !name || strnlen(name,26)==0 || strnlen(name,26)>25)
        return fail("character configuration", "safe proof name must contain 1 to 25 bytes");
    for (const char *p=name;*p;p++)
        if (!((*p>='a'&&*p<='z')||(*p>='A'&&*p<='Z')||(*p>='0'&&*p<='9')||*p=='_'||*p=='-'))
            return fail("character configuration", "safe proof name has an unsupported byte");
    lua_State *state=tome_main_get_state();int top=lua_gettop(state);
    lua_getglobal(state,"package");lua_getfield(state,-1,"loaded");lua_getfield(state,-1,"config");
    if (!lua_isnil(state,-1)) {lua_settop(state,top);return fail("character configuration","original configuration already loaded");}
    lua_settop(state,top);lua_getglobal(state,"__TOME_WEB_SETTINGS");
    if (!lua_istable(state,-1)) {lua_settop(state,top);return fail("character configuration","settings table absent");}
    lua_pushstring(state,name);lua_setfield(state,-2,"player_name");lua_settop(state,top);return 1;
}
/* Comparison-only original renderer. Original display includes FOV/WASD and
 * visual RNG side effects; this export is deliberately not a purity claim.
 * The production Rust renderer must consume the separated observation seam.
 */
EMSCRIPTEN_KEEPALIVE int tome_native_draw_baseline(void) {
    if (tome_web_checkpoint_busy()) return fail("original draw", "save.checkpoint.busy");
    if (!initialized_adapter || !tome_main_get_state() || !maincontext || !window)
        return fail("original draw", "original GL and Lua state are not ready");
    redraw_now(redraw_type_normal);
    return 1;
}
static const char *bridge_call(const char *method, const char *command) {
    if (!initialized_adapter) { fail("bridge", "original modules are not initialized"); return NULL; }
    lua_State *state=tome_main_get_state();
    int top=lua_gettop(state);
    lua_getglobal(state,"__TOME_WEB");
    if (!lua_istable(state,-1)) { lua_settop(state,top); fail("bridge", "original boot bridge absent"); return NULL; }
    lua_getfield(state,-1,method);
    lua_remove(state,-2);
    if (!lua_isfunction(state,-1)) { lua_settop(state,top); fail("bridge", "original boot method absent"); return NULL; }
    if (command) lua_pushstring(state,command);
    int status=lua_pcall(state, command?1:0, 1, 0);
    if (!check_lua_status(method,status)) { lua_settop(state,top); return NULL; }
    size_t length;
    const char *json=lua_tolstring(state,-1,&length);
    if (!json || length>8388608) { lua_settop(state,top); fail("bridge", "snapshot is absent or exceeds byte limit"); return NULL; }
    char *next=malloc(length+1);
    if (!next) { lua_settop(state,top); fail("bridge", "snapshot allocation failed"); return NULL; }
    memcpy(next,json,length); next[length]=0;
    free(response); response=next;
    lua_settop(state,top);
    return response;
}
EMSCRIPTEN_KEEPALIVE const char *tome_native_snapshot(void) { return bridge_call("snapshot_json",NULL); }
EMSCRIPTEN_KEEPALIVE const char *tome_native_command(const char *command) {
    if (tome_web_checkpoint_busy()) { fail("original command", "save.checkpoint.busy");return NULL; }
    return bridge_call("command_json",command);
}
EMSCRIPTEN_KEEPALIVE const char *tome_native_localization(void) { return bridge_call("localization_json",NULL); }

#include "native_exports.inc"

/* The browser host owns a single-flight quiescent call boundary. These exports
 * copy all original random state; they never advance RNG and are not game saves.
 * A future worker backend must acquire its explicit barrier before calling.
 */
EMSCRIPTEN_KEEPALIVE const char *tome_native_rng_snapshot_hex(void) {
    uint8_t bytes[RNG_BYTES];
    static const char digits[]="0123456789abcdef";
    if (!initialized_adapter) { fail("RNG snapshot", "original state is not initialized"); return NULL; }
    if (!tome_rng_snapshot_write(bytes,SFMT_BYTES) ||
        !tome_normal_snapshot_write(bytes+SFMT_BYTES,NORMAL_BYTES) ||
        !tome_libc_rng_snapshot_write(bytes+SFMT_BYTES+NORMAL_BYTES,LIBC_BYTES)) {
        fail("RNG snapshot", "original state export failed"); return NULL;
    }
    for (size_t i=0;i<RNG_BYTES;i++) {
        rng_hex[i*2]=digits[bytes[i]>>4]; rng_hex[i*2+1]=digits[bytes[i]&15];
    }
    rng_hex[RNG_BYTES*2]=0;
    return rng_hex;
}
static int hex_nibble(char digit) {
    if (digit>='0' && digit<='9') return digit-'0';
    if (digit>='a' && digit<='f') return digit-'a'+10;
    return -1;
}
EMSCRIPTEN_KEEPALIVE int tome_native_rng_restore_hex(const char *hex) {
    uint8_t bytes[RNG_BYTES];
    if (!initialized_adapter || !hex || strnlen(hex,RNG_BYTES*2+1)!=RNG_BYTES*2)
        return fail("RNG restore", "invalid state length or phase");
    for (size_t i=0;i<RNG_BYTES;i++) {
        int high=hex_nibble(hex[i*2]),low=hex_nibble(hex[i*2+1]);
        if (high<0 || low<0) return fail("RNG restore", "invalid hexadecimal state");
        bytes[i]=(uint8_t)((high<<4)|low);
    }
    if (!tome_combined_rng_restore(bytes,SFMT_BYTES,bytes+SFMT_BYTES,NORMAL_BYTES,
        bytes+SFMT_BYTES+NORMAL_BYTES,LIBC_BYTES))
        return fail("RNG restore", "original state envelope rejected");
    return 1;
}
