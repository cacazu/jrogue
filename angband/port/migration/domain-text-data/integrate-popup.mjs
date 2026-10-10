// SPDX-License-Identifier: GPL-2.0-only
import {integrateEdits,scoped,beforeCall} from './integrate.mjs';
integrateEdits(new Map([
 ['ui-output.c',source=>scoped(source,'struct keypress textui_textblock_show(',body=>body.replace('return (ch);','return /* AB_DOMAIN_INLINE_BEGIN */(AB_DOMAIN_CAPTURE(ab_domain_info_display_end(tb)), /* AB_DOMAIN_INLINE_END */(ch)/* AB_DOMAIN_INLINE_BEGIN */)/* AB_DOMAIN_INLINE_END */;'))],
 ['z-textblock.c',source=>scoped(source,'void textblock_free(',body=>beforeCall(body,'mem_free(tb->text);','ab_domain_info_forget(tb)'))],
]),'popup-integration-evidence.json','popup-source-baseline');
