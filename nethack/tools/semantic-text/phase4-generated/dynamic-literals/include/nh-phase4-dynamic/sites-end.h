/* Modified 2026-10-02: original selected-format semantic observations; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static const struct nh_text_descriptor nh_phase4_dynamic_format_8e4d7ccc51b83fce = {"nethack.message.dynamic.end.file_scope.you.turn_to_stone.aff42c18f7", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN};

static const struct nh_text_descriptor nh_phase4_dynamic_format_83699be368e6ad2e = {"nethack.message.dynamic.end.file_scope.you.die.df11a8ff9e", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN};

static inline void nh_phase4_dynamic_site_4952d507b8f5409a(struct nh_phase4_format_value nh_p0) {
    struct nh_text_scope *nh_scope = nh_text_begin(nh_p0.descriptor, NULL, 0, -1);
    You(nh_p0.original);
    nh_text_end(nh_scope);
}

static const struct nh_text_descriptor nh_phase4_dynamic_format_926b37782c4684e4 = {"nethack.message.dynamic.end.va_decl.raw_print.postgame_wrapup_disrupted.ae128f57dd", "raw_print", NH_TEXT_RAW, NH_TEXT_PLAIN};

static const struct nh_text_descriptor nh_phase4_dynamic_format_30fb62b34ad97d31 = {"nethack.message.dynamic.end.va_decl.raw_print.program_initialization_has_failed.c216a3268f", "raw_print", NH_TEXT_RAW, NH_TEXT_PLAIN};

static const struct nh_text_descriptor nh_phase4_dynamic_format_e67ffaf63ee20a7b = {"nethack.message.dynamic.end.va_decl.raw_print.suddenly_the_dungeon_collapses.5d5f05f5f4", "raw_print", NH_TEXT_RAW, NH_TEXT_PLAIN};

static inline void nh_phase4_dynamic_site_b47e9065b528f145(struct nh_phase4_format_value nh_p0) {
    struct nh_text_scope *nh_scope = nh_text_begin(nh_p0.descriptor, NULL, 0, -1);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    raw_print(nh_p0.original);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}
