/* SPDX-License-Identifier: GPL-3.0-or-later */
#ifndef TOME_NATIVE_YESNO_ROUNDTRIP_H
#define TOME_NATIVE_YESNO_ROUNDTRIP_H
/* Borrowed C buffer, copied by host immediately. Valid until the next successful
 * roundtrip JSON export; NULL indicates failure. Existing UI exports have their
 * own distinct borrowed buffer. Host owns exclusive original-VM call scheduling. */
const char *tome_native_ui_roundtrip_install(void);
const char *tome_native_ui_roundtrip_open(const char *locale);
const char *tome_native_ui_roundtrip_status(void);
const char *tome_native_ui_roundtrip_verify_closed(const char *expected);
const char *tome_native_ui_roundtrip_verify_stale(void);
const char *tome_native_ui_roundtrip_last_error(void);
#endif
