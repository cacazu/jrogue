/* Modified 2026-10-02: proposed native text delivery observations; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static inline void nh_phase6_native_site_d75ff269e83a88c6(const char * nh_p0, int nh_p1, int nh_p2, int nh_p3) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.light.save_light_sources.panic.counted_d_light_sources_wrote_d_range.95aea1c79a", "panic", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_INTEGER, NULL, (int64_t)nh_p1, NULL},
        {"arg_2", NH_TEXT_INTEGER, NULL, (int64_t)nh_p2, NULL},
        {"arg_3", NH_TEXT_INTEGER, NULL, (int64_t)nh_p3, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 3, -1);
    panic(nh_p0, nh_p1, nh_p2, nh_p3);
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_5a1746c286550722(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.light.relink_light_sources.panic.relink_light_sources_no_id_mapping.ac14e819d2", "panic", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    panic(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_5c31e66648d3bc87(const char * nh_p0, int nh_p1, unsigned int nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.light.relink_light_sources.panic.relink_light_sources_can_t_find_c.c6fbddb0fc", "panic", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_INTEGER, NULL, (int64_t)nh_p1, NULL},
        {"arg_2", NH_TEXT_UNSIGNED, NULL, (int64_t)nh_p2, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    panic(nh_p0, nh_p1, nh_p2);
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_eb76583e740f4ab1(const char * nh_p0, int nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.light.relink_light_sources.panic.relink_light_sources_bad_type_d.dc6d150746", "panic", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_INTEGER, NULL, (int64_t)nh_p1, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    panic(nh_p0, nh_p1);
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_3cd1930255b0643f(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.light.light_sources_sanity_check.panic.insane_light_source_no_id.41765fcd2b", "panic", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    panic(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_f969d5b2f3171163(const char * nh_p0, unsigned int nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.light.light_sources_sanity_check.panic.insane_light_source_can_t_find_obj.2dab58e6ae", "panic", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_UNSIGNED, NULL, (int64_t)nh_p1, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    panic(nh_p0, nh_p1);
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_6dc3041c59816129(const char * nh_p0, unsigned int nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.light.light_sources_sanity_check.panic.insane_light_source_can_t_find_mon.afc8ddef6b", "panic", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_UNSIGNED, NULL, (int64_t)nh_p1, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    panic(nh_p0, nh_p1);
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_3f4b586889309fa7(const char * nh_p0, int nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.light.light_sources_sanity_check.panic.insane_light_source_bad_ls_type_d.7995c7a1f0", "panic", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_INTEGER, NULL, (int64_t)nh_p1, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    panic(nh_p0, nh_p1);
    nh_text_end(nh_scope);
}
