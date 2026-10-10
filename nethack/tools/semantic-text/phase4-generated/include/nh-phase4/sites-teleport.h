/* Modified 2026-10-02: additive phase-four source observations; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static inline void nh_phase4_site_cab843b0c5d7b24d(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.teleport.teleds.you.materialize_in_s_location.9262035c78", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    You(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_b39000d40db9e223(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.teleport.teleport_pet.your.leash_goes_slack.46704cb812", "Your", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    Your(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_e88d5242462d37db(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.teleport.scrolltele.pline.a_mysterious_force_prevents_you_from_teleporting.55cafd0dfa", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_8f21ea45845ebc00(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.teleport.scrolltele.you_feel.disoriented_for_a_moment.9675a6e6ef", "You_feel", NH_TEXT_MESSAGE, NH_TEXT_FEEL
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You_feel(nh_p0);
    nh_text_end(nh_scope);
}

static inline char nh_phase4_site_3178b76d455ebcc3(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.teleport.scrolltele.y_n.override.9338f3067c", "y_n", NH_TEXT_QUESTION, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    char nh_result = y_n(nh_p0);
    nh_text_end(nh_scope);
    return nh_result;
}

static inline void nh_phase4_site_d12946f148ee8b90(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.teleport.scrolltele.pline.being_unconscious_you_cannot_control_your_teleport.7de0c687bd", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_b4027819821a74f0(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.teleport.scrolltele.pline.where_do_s_want_to_be_teleported.c2dd709b29", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_b801091cb95527c9(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.teleport.scrolltele.pline.sorry.5133537462", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_18d8097701f900c0(winid nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.teleport.dotelecmd.end_menu.which_way_do_you_want_to_teleport.77333d8d30", "end_menu", NH_TEXT_MENU_END, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    end_menu(nh_p0, nh_p1);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline char nh_phase4_site_0b8b5b3aef2ca015(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.teleport.dotele.y_n.there_is_a_level_teleporter_here_trigger.ae60f4c13e", "y_n", NH_TEXT_QUESTION, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    char nh_result = y_n(nh_p0);
    nh_text_end(nh_scope);
    return nh_result;
}

static inline void nh_phase4_site_ad31cd7a7f445d31(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.teleport.dotele.pline.this_is_a_vault_teleport_usable_once.59d6457315", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline char nh_phase4_site_8f90059fdc973d2c(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.teleport.dotele.y_n.jump_in.fdf118db8b", "y_n", NH_TEXT_QUESTION, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    char nh_result = y_n(nh_p0);
    nh_text_end(nh_scope);
    return nh_result;
}

static inline void nh_phase4_site_ff4fa77d6a7d7f73(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.teleport.dotele.you.s_onto_the_teleportation_trap.db0e891b6e", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    You(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_07e5659bb24dbdb3(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.teleport.dotele.you.s.3ffc64bb85", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    You(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_48c3130f9cbc0846(const char * nh_p0, const char * nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.teleport.dotele.you.s_s.aabb0be3ec", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    You(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_9d439d587b814e9e(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.teleport.dotele.you.s.f684c73cba", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    You(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_e1b0298c7889b2e0(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.teleport.level_tele.you_feel.very_disoriented_for_a_moment.77919cd742", "You_feel", NH_TEXT_MESSAGE, NH_TEXT_FEEL
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You_feel(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_5a3927b657ea84e4(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.teleport.level_tele.pline.oops.aa67d1d867", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline char nh_phase4_site_0968893a2364dc64(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.teleport.level_tele.ynq.go_to_nowhere_are_you_sure.6849c0f903", "ynq", NH_TEXT_QUESTION, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    char nh_result = ynq(nh_p0);
    nh_text_end(nh_scope);
    return nh_result;
}

static inline void nh_phase4_site_5e93e84ac9318c2e(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.teleport.level_tele.you.s_in_agony_as_your_body_begins.a6c22db147", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    You(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_908020400d88a82a(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.teleport.level_tele.you.cease_to_exist.9e526e2f7e", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_1b15e4c885b51eae(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.teleport.level_tele.your.possessions_land_on_the_s_with_a.88fd06f416", "Your", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    Your(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_e48526175ddaf3b4(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.teleport.level_tele.pline.an_energized_cloud_of_dust_begins_to.98200d796c", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_837620136c745be4(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.teleport.level_tele.your.body_rematerializes_s.14554bba4a", "Your", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    Your(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_00f17fab4b723e87(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.teleport.level_tele.you.arrive_in_heaven.752390d0cb", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_9904ecf503757bc5(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.teleport.level_tele.verbalize.thou_art_early_but_we_ll_admit.e048a1bf67", "verbalize", NH_TEXT_MESSAGE, NH_TEXT_QUOTED
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    verbalize(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_f2a49c389901e357(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.teleport.level_tele.you_feel.deliriously_happy.06a1ec927c", "You_feel", NH_TEXT_MESSAGE, NH_TEXT_FEEL
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You_feel(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_15376f78c5e4bb00(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.teleport.level_tele.pline.in_fact_you_re_on_cloud.809f6db599", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_30aeb410eab846af(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.teleport.level_tele.you.are_now_high_above_the_clouds.8690cf0a36", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_36f0849756c1ea5e(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.teleport.level_tele.pline.unfortunately_you_don_t_know_how_to.64ce8662d5", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_6b73484ac24b6235(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.teleport.level_tele.you.plummet_a_few_thousand_feet_to_your.5ca1e7351f", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_4afc36605f43ef25(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.teleport.level_tele.you.s.3ffc64bb85", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    You(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_831e169031c1d48e(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.teleport.level_tele.pline.sorry.5133537462", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_2245dd4a820b2bd5(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.teleport.domagicportal.you.activated_a_magic_portal.bb298af28f", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_f31437ecb0e66e52(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.teleport.domagicportal.you_feel.dizzy_for_a_moment_but_nothing_happens.1c1e063470", "You_feel", NH_TEXT_MESSAGE, NH_TEXT_FEEL
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You_feel(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_01bece55015d552a(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.teleport.tele_trap.you_feel.a_wrenching_sensation.1c534d0463", "You_feel", NH_TEXT_MESSAGE, NH_TEXT_FEEL
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You_feel(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_7cfac2b9538d0821(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.teleport.level_tele_trap.you.s_a_level_teleport_trap.d44b90eb5e", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    You(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_88e1e3bbef03adf9(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.teleport.level_tele_trap.you_feel.a_wrenching_sensation.1c534d0463", "You_feel", NH_TEXT_MESSAGE, NH_TEXT_FEEL
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You_feel(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_c79274ae3c306d12(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.teleport.level_tele_trap.you.briefly_feel_s.92f8288ef4", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    You(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_cd9344cf73b029b9(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.teleport.level_tele_trap.you_feel.sdisoriented.7900e5f919", "You_feel", NH_TEXT_MESSAGE, NH_TEXT_FEEL
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    You_feel(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_b26c40774be3dbdb(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.teleport.rloc_to_core.pline.s_vanishes.3a91a4739e", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_a4ed3ff3fd269f98(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.teleport.rloc_to_core.you.and_s_teleport_together.009a1f0904", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    You(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_a7ef3a20b8fb9065(const char * nh_p0, const char * nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.teleport.rloc_to_core.pline.s_vanishes_and_reappears_s.4e1594725e", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_d221eb25ca7b2915(const char * nh_p0, const char * nh_p1, const char * nh_p2, const char * nh_p3, const char * nh_p4) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.teleport.rloc_to_core.pline.s_s_s_s.c84c2fbb41", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
        {"arg_3", NH_TEXT_TEXT, nh_p3, 0, NULL},
        {"arg_4", NH_TEXT_TEXT, nh_p4, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 4, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2), nh_text_captured_text(nh_scope, 2, nh_p3), nh_text_captured_text(nh_scope, 3, nh_p4));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_49bb4552d5d52aee(const char * nh_p0, const char * nh_p1, int nh_p2, int nh_p3) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.teleport.control_mon_tele.pline.teleport_s_d_d_where.7e993657fb", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_INTEGER, NULL, (int64_t)nh_p2, NULL},
        {"arg_3", NH_TEXT_INTEGER, NULL, (int64_t)nh_p3, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 3, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_p2, nh_p3);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_b95efdc395495e13(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.teleport.control_mon_tele.pline.s_destination.edd60646c3", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_ba2d503ea6ba2ea0(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.teleport.mtele_trap.pline.s_seems_disoriented.44cfb718b1", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_e72a69c650a0b91c(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.teleport.mtele_trap.pline.s_suddenly_disappears.639a94a79e", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_419b35c2f81be46b(struct monst * nh_p0, const char * nh_p1, const char * nh_p2, const char * nh_p3) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.teleport.mlevel_tele_trap.pline_mon.s_avoids_the_s.59b42a55db", "pline_mon", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p2, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p3, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    pline_mon(nh_p0, nh_p1, nh_text_captured_text(nh_scope, 0, nh_p2), nh_text_captured_text(nh_scope, 1, nh_p3));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_b01382cd49c1c976(struct monst * nh_p0, const char * nh_p1, const char * nh_p2, const char * nh_p3) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.teleport.mlevel_tele_trap.pline_mon.suddenly_s_s.712f1fdf6d", "pline_mon", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p2, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p3, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    pline_mon(nh_p0, nh_p1, nh_text_captured_text(nh_scope, 0, nh_p2), nh_text_captured_text(nh_scope, 1, nh_p3));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_8a307e3434dd0d96(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.teleport.u_teleport_mon.pline.a_mysterious_force_prevents_you_teleporting_s.1549700f57", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_0819603033edbb19(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.teleport.u_teleport_mon.pline.s_resists_your_magic.a7486d2f36", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_98307946a7e3342c(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.teleport.u_teleport_mon.you.are_no_longer_inside_s.f6bd3d43e9", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    You(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}
