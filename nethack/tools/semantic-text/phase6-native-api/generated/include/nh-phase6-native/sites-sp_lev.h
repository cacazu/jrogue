/* Modified 2026-10-02: proposed native text delivery observations; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static inline void nh_phase6_native_site_52271e3ad49f8a3b(const char * nh_p0, int nh_p1, int nh_p2, int nh_p3, int nh_p4) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.sp_lev.mapfrag_get.panic.outside_mapfrag_i_i_wanted_i_i.c9f2bf4e80", "panic", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_INTEGER, NULL, (int64_t)nh_p1, NULL},
        {"arg_2", NH_TEXT_INTEGER, NULL, (int64_t)nh_p2, NULL},
        {"arg_3", NH_TEXT_INTEGER, NULL, (int64_t)nh_p3, NULL},
        {"arg_4", NH_TEXT_INTEGER, NULL, (int64_t)nh_p4, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 4, -1);
    panic(nh_p0, nh_p1, nh_p2, nh_p3, nh_p4);
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_c728b69e39fba37a(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.sp_lev.get_room_loc.panic.get_room_loc_can_t_find_a.3ed2a3776e", "panic", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    panic(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_01446f8e6d0bf2e4(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.sp_lev.get_free_room_loc.panic.get_free_room_loc_can_t_find.cdfdcf4923", "panic", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    panic(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_6c401bbe8fc0b423(const char * nh_p0, int nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.sp_lev.create_monster.panic.create_monster_unknown_monster_class_c.25d82feac4", "panic", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_INTEGER, NULL, (int64_t)nh_p1, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    panic(nh_p0, nh_p1);
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_26b70d0107964fae(const char * nh_p0, int nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.sp_lev.create_object.panic.create_object_unexpected_object_class_c.1d82a1419f", "panic", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_INTEGER, NULL, (int64_t)nh_p1, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    panic(nh_p0, nh_p1);
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_4c96aecc1f60b442(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.sp_lev.search_door.panic.search_door_bad_wall.e85024420d", "panic", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    panic(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_7897375f6e543683(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.sp_lev.lspo_room.panic.too_deeply_nested_rooms.fe6b2a93b6", "panic", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    panic(nh_p0);
    nh_text_end(nh_scope);
}
