/* SPDX-License-Identifier: GPL-3.0-or-later */
#ifndef TOME_BROWSER_SERIAL_PLATFORM_H
#define TOME_BROWSER_SERIAL_PLATFORM_H
/* One owner: the browser adapter, under its exclusive save barrier.
 * pump: 0 idle, 1 pending/unactivated queue, -1 terminal error.
 * It does not consume completion names from core.serial.popSaveReturn.
 */
int tome_browser_serial_worker_ready(void);
int tome_browser_serial_pump(unsigned max_entries, unsigned max_bytes);
const char *tome_browser_serial_error(void);
#endif
