/* SPDX-License-Identifier: GPL-3.0-or-later */
#ifndef TOME_PARTICLE_COOPERATIVE_H
#define TOME_PARTICLE_COOPERATIVE_H
#include <stdint.h>

/* No SDL threads/semaphores and no GL context ownership transfer. Original
 * emitter, generator, updater, integration and drawing functions remain in
 * the generated source. One queued keyframe is one complete original list
 * traversal; initialization occupies its original first traversal.
 */
int tome_particles_pump(unsigned maximum_keyframes);
int tome_particles_prepare_at_barrier(unsigned maximum_keyframes);
int tome_particles_shutdown_at_barrier(void);
uint64_t tome_particles_pending_keyframes(void);
int tome_particles_visual_idle(void);
const char *tome_particles_error_id(void);

/* Application-owned VISUAL phase and current original main GL context are
 * required by pump. prepare_at_barrier owns one checked enter/pump/leave pair.
 * Shutdown retires and drains even a faulted lane before GL/PhysFS teardown;
 * call after the original main Lua state's particle userdata GC is complete.
 * It returns 0 on complete retirement, -1 on phase/ownership failure. Original public
 * create/free/thread_add/thread_particle_new_keyframes symbols are retained.
 * This is effectful visual preparation, not a renderer-purity interface.
 */
#endif
