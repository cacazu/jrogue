/* SPDX-License-Identifier: GPL-2.0-only */
#ifndef ANGBAND_WEB_STATIC_TEXT_H
#define ANGBAND_WEB_STATIC_TEXT_H
#ifdef __EMSCRIPTEN__
void ab_static_message(const char *id, int sound);
#define AB_STATIC_MSG(id, sound) ab_static_message((id), (sound))
#else
#define AB_STATIC_MSG(id, sound) ((void)0)
#endif
#endif
