/* Modified 2026-10-02: additive phase-four source observations; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static inline void nh_phase4_site_d222574894649494(coordxy nh_p0, coordxy nh_p1, const char * nh_p2, const char * nh_p3) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.display.show_glyph.pline_xy.s.3ffc64bb85", "pline_xy", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p3, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline_xy(nh_p0, nh_p1, nh_p2, nh_text_captured_text(nh_scope, 0, nh_p3));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_6a0713052b9217c2(const char * nh_p0, const char * nh_p1, int nh_p2, int nh_p3, const char * nh_p4, const char * nh_p5, const char * nh_p6, const char * nh_p7) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.display.error4.pline.set_wall_state_s_d_d_s.9b34996855", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_INTEGER, NULL, (int64_t)nh_p2, NULL},
        {"arg_3", NH_TEXT_INTEGER, NULL, (int64_t)nh_p3, NULL},
        {"arg_4", NH_TEXT_TEXT, nh_p4, 0, NULL},
        {"arg_5", NH_TEXT_TEXT, nh_p5, 0, NULL},
        {"arg_6", NH_TEXT_TEXT, nh_p6, 0, NULL},
        {"arg_7", NH_TEXT_TEXT, nh_p7, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 7, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_p2, nh_p3, nh_text_captured_text(nh_scope, 3, nh_p4), nh_text_captured_text(nh_scope, 4, nh_p5), nh_text_captured_text(nh_scope, 5, nh_p6), nh_text_captured_text(nh_scope, 6, nh_p7));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_2b012b2ed3fbba0c(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.display.set_wall_state.pline.set_wall_type_wall_mode_problems_with.cd34fa5e67", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_4cc5840859b1aa75(const char * nh_p0, const char * nh_p1, int nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.display.set_wall_state.pline.s_d.204d7f1947", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_INTEGER, NULL, (int64_t)nh_p2, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_p2);
    nh_text_end(nh_scope);
}
