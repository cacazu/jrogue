/* Modified 2026-10-02: first diagnostic semantic observation; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static inline void nh_phase4_impossible_site_7c8f140635b85e78(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.pickup.simple_look.impossible.simple_look_null.e6417e5d74", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    impossible(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_impossible_site_3c6f5a52c0ef34fa(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.pickup.query_category.impossible.query_category_too_many_categories.373f80276d", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    impossible(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_impossible_site_5503601192ff0458(const char * nh_p0, long nh_p1, long nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.pickup.pickup_object.impossible.pickup_object_count_ld_quan_ld.5dd3d26d39", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_INTEGER, NULL, (int64_t)nh_p1, NULL},
        {"arg_2", NH_TEXT_INTEGER, NULL, (int64_t)nh_p2, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    impossible(nh_p0, nh_p1, nh_p2);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_impossible_site_1fb111ad0e94e55c(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.pickup.in_container.impossible.in_no_gc_current_container.3935d2a7e6", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    impossible(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_impossible_site_93eee46a93dffa52(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.pickup.out_container.impossible.out_no_gc_current_container.49309be3b4", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    impossible(nh_p0);
    nh_text_end(nh_scope);
}
