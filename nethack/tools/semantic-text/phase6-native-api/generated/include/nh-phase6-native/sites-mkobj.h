/* Modified 2026-10-02: proposed native text delivery observations; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static inline void nh_phase6_native_site_567527f7a6669674(const char * nh_p0, const char * nh_p1, long nh_p2, long nh_p3) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.mkobj.splitobj.panic.splitobj_cobj_s_num_ld_quan_ld.fbb12adb85", "panic", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL, 0},
        {"arg_2", NH_TEXT_INTEGER, NULL, (int64_t)nh_p2, NULL},
        {"arg_3", NH_TEXT_INTEGER, NULL, (int64_t)nh_p3, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 3, -1);
    panic(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_p2, nh_p3);
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_52079e09994363d3(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.mkobj.replace_object.panic.replace_object_obj_position.c71b0aaa3f", "panic", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    panic(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_5eb603eb94650112(const char * nh_p0, int nh_p1, int nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.mkobj.mksobj_init.panic.mksobj_tried_to_make_type_d_class.df28ddb6f5", "panic", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_INTEGER, NULL, (int64_t)nh_p1, NULL},
        {"arg_2", NH_TEXT_INTEGER, NULL, (int64_t)nh_p2, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    panic(nh_p0, nh_p1, nh_p2);
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_881b1e4805e1146a(const char * nh_p0, const char * nh_p1, int nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.mkobj.place_object.panic.place_object_obj_s_d_not_free.2b6c376656", "panic", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL, 0},
        {"arg_2", NH_TEXT_INTEGER, NULL, (int64_t)nh_p2, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    panic(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_p2);
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_46012e53d52129b1(const char * nh_p0, int nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.mkobj.remove_object.panic.remove_object_obj_where_d_not_on.98e13c74c7", "panic", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_INTEGER, NULL, (int64_t)nh_p1, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    panic(nh_p0, nh_p1);
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_8cb34bcc2718a694(const char * nh_p0, int nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.mkobj.obj_extract_self.panic.obj_extract_self_where_d.d4004f7a49", "panic", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_INTEGER, NULL, (int64_t)nh_p1, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    panic(nh_p0, nh_p1);
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_19871ba26f561248(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.mkobj.extract_nobj.panic.extract_nobj_object_lost.3ee81d2762", "panic", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    panic(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_4ec097f13f4a9eb2(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.mkobj.extract_nexthere.panic.extract_nexthere_object_lost.4599a8a001", "panic", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    panic(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_27c468d0ec0903ba(const char * nh_p0, int nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.mkobj.add_to_minv.panic.add_to_minv_obj_where_d_not.bcf7f5b58d", "panic", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_INTEGER, NULL, (int64_t)nh_p1, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    panic(nh_p0, nh_p1);
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_e59688f7177cef69(const char * nh_p0, int nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.mkobj.add_to_container.panic.add_to_container_obj_where_d_not.1359c6a2a5", "panic", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_INTEGER, NULL, (int64_t)nh_p1, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    panic(nh_p0, nh_p1);
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_ae37c2d9afc6353c(const char * nh_p0, int nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.mkobj.add_to_migration.panic.add_to_migration_obj_where_d_not.b48846986c", "panic", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_INTEGER, NULL, (int64_t)nh_p1, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    panic(nh_p0, nh_p1);
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_605ee8f2d43ddc97(const char * nh_p0, int nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.mkobj.add_to_buried.panic.add_to_buried_obj_where_d_not.7817e0b77b", "panic", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_INTEGER, NULL, (int64_t)nh_p1, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    panic(nh_p0, nh_p1);
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_8c7540b7245a0167(const char * nh_p0, int nh_p1, int nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.mkobj.dealloc_obj.panic.dealloc_obj_obj_not_free_type_d.580376c386", "panic", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_INTEGER, NULL, (int64_t)nh_p1, NULL},
        {"arg_2", NH_TEXT_INTEGER, NULL, (int64_t)nh_p2, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    panic(nh_p0, nh_p1, nh_p2);
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_2bd2948cc08cdf48(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.mkobj.dealloc_obj.panic.dealloc_obj_with_nobj.5c9087d1e7", "panic", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    panic(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_460a415ed9472344(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.mkobj.dealloc_obj.panic.dealloc_obj_with_cobj.6f904341f7", "panic", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    panic(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_7491f69f7077e80a(const char * nh_p0, int nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.mkobj.dobjsfree.panic.dobjsfree_obj_where_d_not_obj_deleted.ea44ffa06e", "panic", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_INTEGER, NULL, (int64_t)nh_p1, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    panic(nh_p0, nh_p1);
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_49d2d7e158973935(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.mkobj.check_contained.panic.failed_sanity_check_container_holds_itself.27483d3da5", "panic", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    panic(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_c6a3924f6a446444(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.mkobj.check_contained.panic.failed_sanity_check_container_holds_its_parent.bff2c4fe3f", "panic", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    panic(nh_p0);
    nh_text_end(nh_scope);
}
