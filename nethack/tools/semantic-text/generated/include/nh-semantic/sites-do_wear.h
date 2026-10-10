/* Modified 2026-10-02: source-selected semantic presentation bridge; upstream preserved below. */
#ifndef JROGUE_SITES_DO_WEAR_H
#define JROGUE_SITES_DO_WEAR_H
#include "nh-semantic.h"

static inline void nh_text_site_5518cc2e3a24538c(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.do_wear.accessory_or_armor_on.you_cant.wear_that.703d121d42", "You_cant", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You_cant(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_text_site_9d1b38a5ef8507e2(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.do_wear.accessory_or_armor_on.your.s_are_too_slippery_to_remove_so.dd7f9643f9", "Your", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    Your(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_text_site_15f7a7b36370d8df(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.do_wear.amulet_off.you.can_breathe_more_easily.547f0841dc", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_text_site_f824ef7a4bdb6d89(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.do_wear.amulet_on.you.are_no_longer_bothered_by_the_poison.60fa9ffd49", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_text_site_ae919b68de713acd(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.do_wear.armor_or_accessory_off.you.are_not_wearing_that.375b6d9ed3", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_text_site_df0baf3bd1f61195(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.do_wear.canwearobj.you.can_t_wear_any_armor_in_your.7b8213a781", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_text_site_0c9819c9c3c5a0cb(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.do_wear.canwearobj.you.cannot_wear_a_shield_while_wielding_two.b0915fba2f", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_text_site_6309ee7e8bf6f551(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.do_wear.canwearobj.you.have_no_feet.eab596a7a3", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_text_site_fbd75d346a895623(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.do_wear.canwearobj.you.have_too_many_hooves_to_wear_s.6b182f7bad", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    You(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_text_site_985aed9d15814c2c(const char * nh_p0, const char * nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.do_wear.canwearobj.your.s_are_too_slippery_to_pull_on.156e9138b5", "Your", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    Your(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2));
    nh_text_end(nh_scope);
}

static inline void nh_text_site_73e979a4dca93352(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.do_wear.canwearobj.your.s_is_attached_to_the_buried_ball.8d45e833d0", "Your", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    Your(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_text_site_875906d3140118b6(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.do_wear.cursed.pline.despite_your_slippery_s_you_can_t.aec03e0722", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_text_site_7f71834a418399f3(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.do_wear.disintegrate_arm.urgent_pline.your_s_crumbles_and_turns_to_dust.b635ebebe8", "urgent_pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    urgent_pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_text_site_88424583842aaaff(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.do_wear.disintegrate_arm.urgent_pline.your_s_crumbles_away.129e7f56dc", "urgent_pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    urgent_pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_text_site_26850a4e87bea0ab(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.do_wear.disintegrate_arm.urgent_pline.your_s_crumbles_into_tiny_threads_and.f33754544f", "urgent_pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    urgent_pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_text_site_04f8490c8ab9d5fd(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.do_wear.disintegrate_arm.urgent_pline.your_s_disintegrate.f7326a5217", "urgent_pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    urgent_pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_text_site_364bedeabb189ab8(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.do_wear.disintegrate_arm.urgent_pline.your_s_turns_to_dust_and_is.ecd96a2b89", "urgent_pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    urgent_pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_text_site_41e4790e68928770(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.do_wear.disintegrate_arm.urgent_pline.your_s_vanish.d0a813f4cc", "urgent_pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    urgent_pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_text_site_1f34402a9bb89889(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.do_wear.do_takeoff.you.are_no_longer_wielding_either_weapon.fa2c1a4359", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_text_site_3b81a81aedf5d480(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.do_wear.do_takeoff.you.no_longer_have_ammunition_readied.414e6e57f2", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_text_site_a445c3a63899faea(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.do_wear.doddoremarm.you.are_not_wearing_anything.6eb63fff66", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_text_site_955409deb6d4c252(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.do_wear.doremring.pline.not_wearing_any_accessories_or_armor.7daf82513c", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_text_site_c9dd81afd798f723(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.do_wear.dotakeoff.pline.not_wearing_any_armor_or_accessories.b81c89bc07", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_text_site_3a3ac5c684684e1c(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.do_wear.dowear.you.are_already_wearing_a_full_complement_of.29c404f25c", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_text_site_90f86134983d3fba(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.do_wear.helmet_on.pline.my_brain_hurts.2d2f4b680a", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_text_site_77232877d52cd979(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.do_wear.menu_remarm.there.is_nothing_else_you_can_remove_or.fa7bb5bb2d", "There", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    There(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_text_site_eadf06be687cdf95(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.do_wear.select_off.pline_the.ring_is_stuck.5edd366f2c", "pline_The", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline_The(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_text_site_0434b94dddb73aae(const char * nh_p0, const char * nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.do_wear.select_off.you.are_unable_to_take_off_your_s.be53fd8585", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    You(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2));
    nh_text_end(nh_scope);
}

#endif
