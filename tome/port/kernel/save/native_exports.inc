/* Source-only additive snippet inside native_browser_init.c AFTER bridge_call.
 * Include checkpoint_gate.h; compile checkpoint_gate.c and rng_sidecar.c.
 * Install tome_web_checkpoint_gate_install(state) after original core init.
 * Add `if (tome_web_checkpoint_busy()) return fail(...);` to external command
 * and baseline draw exports, not to original internal screenshot/redraw calls.
 */
EMSCRIPTEN_KEEPALIVE const char *tome_native_full_save_begin(const char *generation) {
    return bridge_call("full_save_begin_json", generation);
}
EMSCRIPTEN_KEEPALIVE const char *tome_native_full_save_settle(const char *generation) {
    return bridge_call("full_save_settle_json", generation);
}
EMSCRIPTEN_KEEPALIVE const char *tome_native_full_save_poll(void) {
    return bridge_call("full_save_poll_json", NULL);
}
EMSCRIPTEN_KEEPALIVE const char *tome_native_full_save_persisting(const char *generation) {
    return bridge_call("full_save_persisting_json", generation);
}
EMSCRIPTEN_KEEPALIVE const char *tome_native_full_save_committed(const char *generation) {
    return bridge_call("full_save_committed_json", generation);
}
EMSCRIPTEN_KEEPALIVE const char *tome_native_full_save_failed(const char *detail) {
    return bridge_call("full_save_failed_json", detail);
}
EMSCRIPTEN_KEEPALIVE const char *tome_native_resume_poll(void) {
    return bridge_call("resume_poll_json", NULL);
}
EMSCRIPTEN_KEEPALIVE const char *tome_native_resume_restored(const char *generation) {
    return bridge_call("resume_restored_json", generation);
}
EMSCRIPTEN_KEEPALIVE int tome_native_set_resume_request(const char *save_name,
    const char *generation, const char *extra_module_info, const char *profile_name, int rng_layout) {
    if (!initialized_adapter || !save_name || !generation || rng_layout != 1 || tome_web_checkpoint_busy())
        return fail("resume request", "save.resume.invalid_request");
    lua_State *state=tome_main_get_state();
    int top=lua_gettop(state);
    lua_getglobal(state,"game");
    int fresh=lua_isnil(state,-1);
    lua_settop(state,top);
    if (!fresh) return fail("resume request", "save.resume.fresh_vm_required");
    lua_newtable(state);
    lua_pushinteger(state,1); lua_setfield(state,-2,"schema");
    lua_pushstring(state,"baseline_original_resume"); lua_setfield(state,-2,"mode");
    lua_pushinteger(state,rng_layout); lua_setfield(state,-2,"rng_layout");
    lua_pushstring(state,save_name); lua_setfield(state,-2,"save_name");
    lua_pushstring(state,generation); lua_setfield(state,-2,"generation");
    lua_pushstring(state,extra_module_info ? extra_module_info : "no_birth_popup=true");
    lua_setfield(state,-2,"extra_module_info");
    lua_pushstring(state,profile_name ? profile_name : "default"); lua_setfield(state,-2,"profile_name");
    lua_setglobal(state,"__TOME_WEB_RESUME");
    return 1;
}
EMSCRIPTEN_KEEPALIVE int tome_native_start_resume(void) {
    if (!initialized_adapter || tome_web_checkpoint_busy()) return fail("resume", "save.resume.invalid_start_state");
    return check_lua_status("original fullgame resume driver",
        tome_run_original_file(tome_main_get_state(),"/adapter/original-resume-driver.lua"));
}
