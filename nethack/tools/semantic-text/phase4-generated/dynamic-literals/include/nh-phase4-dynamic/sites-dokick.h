/* Modified 2026-10-02: original selected-format semantic observations; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static const struct nh_text_descriptor nh_phase4_dynamic_format_2d9bb0c35a2122c8 = {"nethack.message.dynamic.dokick.ghitm.verbalize.drop_the_rest_and_follow_me.de6a3e1dcd", "verbalize", NH_TEXT_MESSAGE, NH_TEXT_QUOTED};

static const struct nh_text_descriptor nh_phase4_dynamic_format_ccb886c3697ad3df = {"nethack.message.dynamic.dokick.ghitm.verbalize.you_still_have_hidden_gold_drop_it.ea37cde841", "verbalize", NH_TEXT_MESSAGE, NH_TEXT_QUOTED};

static const struct nh_text_descriptor nh_phase4_dynamic_format_be52ac1a2294ab35 = {"nethack.message.dynamic.dokick.ghitm.verbalize.i_ll_take_care_of_that_please.ede60f1bd5", "verbalize", NH_TEXT_MESSAGE, NH_TEXT_QUOTED};

static const struct nh_text_descriptor nh_phase4_dynamic_format_53c287c520ff0102 = {"nethack.message.dynamic.dokick.ghitm.verbalize.i_ll_take_that_now_get_moving.40c7fd0ad0", "verbalize", NH_TEXT_MESSAGE, NH_TEXT_QUOTED};

static inline void nh_phase4_dynamic_site_b28f98a847d4692e(struct nh_phase4_format_value nh_p0) {
    struct nh_text_scope *nh_scope = nh_text_begin(nh_p0.descriptor, NULL, 0, -1);
    verbalize(nh_p0.original);
    nh_text_end(nh_scope);
}
