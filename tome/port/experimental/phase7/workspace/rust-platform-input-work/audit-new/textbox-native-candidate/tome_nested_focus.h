/* SPDX-License-Identifier: GPL-3.0-or-later */
#ifndef TOME_NESTED_FOCUS_H
#define TOME_NESTED_FOCUS_H
int tome_textbox_nested_focused_unicode(int *dialog_count, int *depth);
const char *tome_textbox_focus_status(void);
#endif
