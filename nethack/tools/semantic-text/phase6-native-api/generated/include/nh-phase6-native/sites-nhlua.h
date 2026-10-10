/* Modified 2026-10-02: proposed native text delivery observations; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static inline void nh_phase6_native_site_f56588ec43cac68e(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.nhlua.nhl_variable.panic.nh_luacore_not_inited.45232b8bfb", "panic", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    panic(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_6f81250797db5566(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.nhlua.get_nh_lua_variables.panic.nh_luacore_not_inited.45232b8bfb", "panic", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    panic(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_5f861295ad6eaf9e(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.nhlua.nhl_callback.panic.nh_luacore_not_inited.45232b8bfb", "panic", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    panic(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_c7f6fba437623939(const char * nh_p0, int nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.nhlua.nhl_pcall.panic.lua_time_exceeded_d_s.167088b752", "panic", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_INTEGER, NULL, (int64_t)nh_p1, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL, 0},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    panic(nh_p0, nh_p1, nh_text_captured_text(nh_scope, 1, nh_p2));
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_4f79e617b7ba5b67(long nh_p0, const char * nh_p1, int nh_p2, const char * nh_p3, long nh_p4) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.nhlua.nhl_pcall.livelog_printf.luastats_pcal_d_s_ld.1398413c79", "livelog_printf", NH_TEXT_DEFERRED, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_INTEGER, NULL, (int64_t)nh_p2, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p3, 0, NULL, 0},
        {"arg_3", NH_TEXT_INTEGER, NULL, (int64_t)nh_p4, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 3, -1);
    livelog_printf(nh_p0, nh_p1, nh_p2, nh_text_captured_text(nh_scope, 1, nh_p3), nh_p4);
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_d5b6b547d0bb42fa(long nh_p0, const char * nh_p1, int nh_p2, const char * nh_p3, unsigned long nh_p4) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.nhlua.nhl_pcall.livelog_printf.luastats_pmem_d_s_lu.d269298247", "livelog_printf", NH_TEXT_DEFERRED, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_INTEGER, NULL, (int64_t)nh_p2, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p3, 0, NULL, 0},
        {"arg_3", NH_TEXT_UNSIGNED, NULL, (int64_t)nh_p4, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 3, -1);
    livelog_printf(nh_p0, nh_p1, nh_p2, nh_text_captured_text(nh_scope, 1, nh_p3), nh_p4);
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_7dc93e66596343fe(const char * nh_p0, int nh_p1, const char * nh_p2, const char * nh_p3) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.nhlua.nhl_pcall_handle.panic.lua_error_d_s_s.bd9e9b6374", "panic", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_INTEGER, NULL, (int64_t)nh_p1, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL, 0},
        {"arg_3", NH_TEXT_TEXT, nh_p3, 0, NULL, 0},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 3, -1);
    panic(nh_p0, nh_p1, nh_text_captured_text(nh_scope, 1, nh_p2), nh_text_captured_text(nh_scope, 2, nh_p3));
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_66ba7c01713ec55e(const char * nh_p0, int nh_p1, int nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.nhlua.nhl_init.panic.sandbox_doesn_t_know_this_lua_version.09a8d40128", "panic", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_INTEGER, NULL, (int64_t)nh_p1, NULL},
        {"arg_2", NH_TEXT_INTEGER, NULL, (int64_t)nh_p2, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    panic(nh_p0, nh_p1, nh_p2);
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_8df07c6a0b8a518d(long nh_p0, const char * nh_p1, int nh_p2, const char * nh_p3, long nh_p4) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.nhlua.nhl_done.livelog_printf.luastats_done_d_s_ld.9968230e1c", "livelog_printf", NH_TEXT_DEFERRED, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_INTEGER, NULL, (int64_t)nh_p2, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p3, 0, NULL, 0},
        {"arg_3", NH_TEXT_INTEGER, NULL, (int64_t)nh_p4, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 3, -1);
    livelog_printf(nh_p0, nh_p1, nh_p2, nh_text_captured_text(nh_scope, 1, nh_p3), nh_p4);
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_717263910f9f09d1(long nh_p0, const char * nh_p1, int nh_p2, const char * nh_p3, unsigned long nh_p4) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.nhlua.nhl_done.livelog_printf.luastats_dmem_d_s_lu.568ad70b56", "livelog_printf", NH_TEXT_DEFERRED, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_INTEGER, NULL, (int64_t)nh_p2, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p3, 0, NULL, 0},
        {"arg_3", NH_TEXT_UNSIGNED, NULL, (int64_t)nh_p4, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 3, -1);
    livelog_printf(nh_p0, nh_p1, nh_p2, nh_text_captured_text(nh_scope, 1, nh_p3), nh_p4);
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_c6ecb2246df8cb77(const char * nh_p0, int nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.nhlua.start_luapat.panic.start_luapat_d.cdaf1926b6", "panic", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_INTEGER, NULL, (int64_t)nh_p1, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    panic(nh_p0, nh_p1);
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_b915c6d0cb953ce4(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.nhlua.nhll_openlibs.panic.can_t_hook_io_open.b151cfbfea", "panic", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    panic(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_d4689fc200332091(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.nhlua.nhl_panic.panic.unprotected_error_in_call_to_lua_api.3f8747a4a5", "panic", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL, 0},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    panic(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_c2fbe0cf35b3b298(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.nhlua.nhll_newstate.panic.null_lua_newstate.31bfc61d1f", "panic", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    panic(nh_p0);
    nh_text_end(nh_scope);
}
