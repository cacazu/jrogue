/* Modified 2026-10-02: source-selected semantic presentation bridge; upstream preserved below. */
#ifndef JROGUE_SITES_ALLMAIN_H
#define JROGUE_SITES_ALLMAIN_H
#include "nh-semantic.h"

static inline void nh_text_site_5654d720fb448086(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.allmain.moveloop_core.urgent_pline.the_amulet_is_bestowing_a_wish_upon.c4e82786da", "urgent_pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    urgent_pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_text_site_6f5d25d820d72a16(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.allmain.moveloop_core.urgent_pline.the_dungeon_capitulates.20eac40c70", "urgent_pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    urgent_pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_text_site_288126c3226f0299(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.allmain.moveloop_preamble.pline.be_careful_new_moon_tonight.06d5042511", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_text_site_34e4e1d4bb83c533(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.allmain.moveloop_preamble.pline.watch_out_bad_things_can_happen_on.a271f6cc43", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_text_site_99bfc68ba79ccbd6(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.allmain.moveloop_preamble.you.are_lucky_full_moon_tonight.1c230d36ff", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_text_site_ee6ccec311dd3f72(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.allmain.stop_occupation.you.stop_s.829b50d1c7", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    You(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_text_site_f3484d4b1256466b(long nh_p0, const char * nh_p1, const char * nh_p2, const char * nh_p3) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.allmain.welcome.livelog_printf.s_the_s_entered_the_dungeon.f14300d72c", "livelog_printf", NH_TEXT_DEFERRED, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p2, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p3, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    livelog_printf(nh_p0, nh_p1, nh_text_captured_text(nh_scope, 0, nh_p2), nh_text_captured_text(nh_scope, 1, nh_p3));
    nh_text_end(nh_scope);
}

static inline void nh_text_site_8365540677742a2a(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.allmain.welcome.pline.nethack_is_filmed_in_front_of_an.4ee7288dc9", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

#endif
