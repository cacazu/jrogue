/* Modified 2026-10-02: original selected-format semantic observations; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static const struct nh_text_descriptor nh_phase4_dynamic_format_287bf547d45903ff = {"nethack.message.dynamic.wizard.cuss.verbalize.even_now_thy_life_force_ebbs_s.5d1412e501", "verbalize", NH_TEXT_MESSAGE, NH_TEXT_QUOTED};

static const struct nh_text_descriptor nh_phase4_dynamic_format_335428ff70ab67d8 = {"nethack.message.dynamic.wizard.cuss.verbalize.savor_thy_breath_s_it_be_thy.a6737fc734", "verbalize", NH_TEXT_MESSAGE, NH_TEXT_QUOTED};

static inline void nh_phase4_dynamic_site_8772a07244da249d(struct nh_phase4_format_value nh_p0, const char * nh_p1) {
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(nh_p0.descriptor, nh_arguments, 1, -1);
    verbalize(nh_p0.original, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static const struct nh_text_descriptor nh_phase4_dynamic_format_7a8909e781ef920f = {"nethack.message.dynamic.wizard.cuss.verbalize.i_shall_return.65b27ffe07", "verbalize", NH_TEXT_MESSAGE, NH_TEXT_QUOTED};

static const struct nh_text_descriptor nh_phase4_dynamic_format_0ad4010a25d41429 = {"nethack.message.dynamic.wizard.cuss.verbalize.i_ll_be_back.db6f0e7427", "verbalize", NH_TEXT_MESSAGE, NH_TEXT_QUOTED};

static inline void nh_phase4_dynamic_site_9dc08862c69ce029(struct nh_phase4_format_value nh_p0) {
    struct nh_text_scope *nh_scope = nh_text_begin(nh_p0.descriptor, NULL, 0, -1);
    verbalize(nh_p0.original);
    nh_text_end(nh_scope);
}
