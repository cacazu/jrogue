/* Modified 2026-10-02: first diagnostic semantic observation; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static inline void nh_phase4_impossible_site_c50b10d77efca74a(const char * nh_p0, int nh_p1, int nh_p2, long nh_p3, long nh_p4, int nh_p5, unsigned int nh_p6, unsigned int nh_p7) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.dogmove.dog_eat.impossible.dog_eat_pet_apport_d_d_ld.a10d64d33b", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_INTEGER, NULL, (int64_t)nh_p1, NULL},
        {"arg_2", NH_TEXT_INTEGER, NULL, (int64_t)nh_p2, NULL},
        {"arg_3", NH_TEXT_INTEGER, NULL, (int64_t)nh_p3, NULL},
        {"arg_4", NH_TEXT_INTEGER, NULL, (int64_t)nh_p4, NULL},
        {"arg_5", NH_TEXT_INTEGER, NULL, (int64_t)nh_p5, NULL},
        {"arg_6", NH_TEXT_UNSIGNED, NULL, (int64_t)nh_p6, NULL},
        {"arg_7", NH_TEXT_UNSIGNED, NULL, (int64_t)nh_p7, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 7, -1);
    impossible(nh_p0, nh_p1, nh_p2, nh_p3, nh_p4, nh_p5, nh_p6, nh_p7);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_impossible_site_88f2b0a7aa67dc9b(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.dogmove.dog_move.impossible.dog_move_for_non_pet.67d9a4b1c3", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    impossible(nh_p0);
    nh_text_end(nh_scope);
}
