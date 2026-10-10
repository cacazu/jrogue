/* Modified 2026-10-02: original selected-format semantic observations; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static const struct nh_text_descriptor nh_phase4_dynamic_format_3a9284046e157606 = {"nethack.message.dynamic.trap.trapeffect_web.pline.you_take_a_walk_on_your_web.1720553386", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN};

static const struct nh_text_descriptor nh_phase4_dynamic_format_e6c2c8c8f0d21aee = {"nethack.message.dynamic.trap.trapeffect_web.pline.there_is_a_spider_web_here.bf84fed56e", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN};

static inline void nh_phase4_dynamic_site_5f36c94fd3d1a25e(struct nh_phase4_format_value nh_p0) {
    struct nh_text_scope *nh_scope = nh_text_begin(nh_p0.descriptor, NULL, 0, -1);
    pline(nh_p0.original);
    nh_text_end(nh_scope);
}

static const struct nh_text_descriptor nh_phase4_dynamic_format_781022db4c61117a = {"nethack.message.dynamic.trap.trapeffect_anti_magic.you_feel.unbearably_torpid.8adbccdc57", "You_feel", NH_TEXT_MESSAGE, NH_TEXT_FEEL};

static const struct nh_text_descriptor nh_phase4_dynamic_format_af1975101a71efc8 = {"nethack.message.dynamic.trap.trapeffect_anti_magic.you_feel.very_lethargic.b57b7baaa2", "You_feel", NH_TEXT_MESSAGE, NH_TEXT_FEEL};

static const struct nh_text_descriptor nh_phase4_dynamic_format_161667936c03b914 = {"nethack.message.dynamic.trap.trapeffect_anti_magic.you_feel.sluggish.8754bcc26c", "You_feel", NH_TEXT_MESSAGE, NH_TEXT_FEEL};

static inline void nh_phase4_dynamic_site_cf6f6ca0e62dcf4e(struct nh_phase4_format_value nh_p0) {
    struct nh_text_scope *nh_scope = nh_text_begin(nh_p0.descriptor, NULL, 0, -1);
    You_feel(nh_p0.original);
    nh_text_end(nh_scope);
}

static const struct nh_text_descriptor nh_phase4_dynamic_format_cdace2ad05cc2a52 = {"nethack.message.dynamic.trap.climb_pit.norep.you_ve_fallen_and_you_can_t.c8e684126a", "Norep", NH_TEXT_MESSAGE, NH_TEXT_PLAIN};

static const struct nh_text_descriptor nh_phase4_dynamic_format_041f3d37075c331d = {"nethack.message.dynamic.trap.climb_pit.norep.you_are_still_in_a_pit.5fb27e3c3b", "Norep", NH_TEXT_MESSAGE, NH_TEXT_PLAIN};

static inline void nh_phase4_dynamic_site_693e9661e3e0d31b(struct nh_phase4_format_value nh_p0) {
    struct nh_text_scope *nh_scope = nh_text_begin(nh_p0.descriptor, NULL, 0, -1);
    Norep(nh_p0.original);
    nh_text_end(nh_scope);
}

static const struct nh_text_descriptor nh_phase4_dynamic_format_09cce12113123dec = {"nethack.message.dynamic.trap.domagictrap.you_hear.the_moon_howling_at_you.1d464099ac", "You_hear", NH_TEXT_MESSAGE, NH_TEXT_HEAR};

static const struct nh_text_descriptor nh_phase4_dynamic_format_9f80f1e5651d0d72 = {"nethack.message.dynamic.trap.domagictrap.you_hear.distant_howling.51821d9983", "You_hear", NH_TEXT_MESSAGE, NH_TEXT_HEAR};

static inline void nh_phase4_dynamic_site_848a16874e95a1de(struct nh_phase4_format_value nh_p0) {
    struct nh_text_scope *nh_scope = nh_text_begin(nh_p0.descriptor, NULL, 0, -1);
    You_hear(nh_p0.original);
    nh_text_end(nh_scope);
}

static const struct nh_text_descriptor nh_phase4_dynamic_format_5020d0c83f0c2ee3 = {"nethack.message.dynamic.trap.domagictrap.you.smell_hamburgers.cf97eb913f", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN};

static const struct nh_text_descriptor nh_phase4_dynamic_format_5ce843f58e7596c3 = {"nethack.message.dynamic.trap.domagictrap.you.smell_charred_flesh.dbaa744689", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN};

static inline void nh_phase4_dynamic_site_bd2677d405f34457(struct nh_phase4_format_value nh_p0) {
    struct nh_text_scope *nh_scope = nh_text_begin(nh_p0.descriptor, NULL, 0, -1);
    You(nh_p0.original);
    nh_text_end(nh_scope);
}

static const struct nh_text_descriptor nh_phase4_dynamic_format_c3d5561b17324d24 = {"nethack.message.dynamic.trap.chest_trap.you.set_it_off.d8943c6c92", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN};

static const struct nh_text_descriptor nh_phase4_dynamic_format_c771ea7586c44c20 = {"nethack.message.dynamic.trap.chest_trap.you.trigger_a_trap.15b165f033", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN};

static inline void nh_phase4_dynamic_site_83dbca8944158f77(struct nh_phase4_format_value nh_p0) {
    struct nh_text_scope *nh_scope = nh_text_begin(nh_p0.descriptor, NULL, 0, -1);
    You(nh_p0.original);
    nh_text_end(nh_scope);
}
