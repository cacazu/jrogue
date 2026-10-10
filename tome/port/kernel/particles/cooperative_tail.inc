/* Browser platform scheduling; original effect functions precede this tail. */
#include <stdint.h>
#include <limits.h>
#include "tome_rng_phases.h"
#include "tome_particle_cooperative.h"

extern SDL_GLContext maincontext;
typedef struct tome_retired_particle_lane {
    particle_thread *lane;
    int vm_ready;
    struct tome_retired_particle_lane *next;
} tome_retired_particle_lane;
static tome_retired_particle_lane *retired_head, *retired_tail;
static uint64_t pending_keyframes;
static int pumping, platform_failed, lane_vm_ready;
static particle_thread *initializing_lane;
static const char *particle_error = "engine.particles.none";

static int particle_platform_error(const char *id) {
    particle_error = id;
    platform_failed = 1;
    return 0;
}

/* Installed before the first allocating Lua registration operation. Later
 * the exact original handler uses __threaddata and this same live guard.
 */
static int initialization_panic(lua_State *L) {
    (void)L;
    longjmp(initializing_lane->panicjump, 1);
    return 0;
}

static int initialize_visual_lane(particle_thread *pt) {
    initializing_lane = pt;
    if (setjmp(pt->panicjump) != 0) {
        initializing_lane = NULL;
        return particle_platform_error("engine.particles.lua_panic");
    }
/*__ORIGINAL_WORKER_INITIALIZER__*/
    initializing_lane = NULL;
    lane_vm_ready = 1;
    return 1;
}

static plist *release_item_without_lua(plist *l) {
    plist *next = l->next;
    particles_type *ps = l->ps;
    if (ps) {
        free(ps->texcoords); ps->texcoords = NULL;
        free(ps->vertices); ps->vertices = NULL;
        free(ps->colors); ps->colors = NULL;
        free(ps->particles); ps->particles = NULL;
        free((char *)ps->args); ps->args = NULL;
        free((char *)ps->name_def); ps->name_def = NULL;
        ps->init = FALSE; ps->alive = FALSE; ps->l = NULL;
    }
    free(l);
    return next;
}

/* The original updater already establishes its own live panic guard. Init
 * and death did not; install fresh guards so a cooperative return can never
 * leave them targeting a returned worker/initializer stack frame.
 */
static void initialize_original_emitter_checked(particle_thread *pt, plist *l) {
    if (setjmp(pt->panicjump) == 0) thread_particle_init(pt, l);
    else {
        if (l->ps) l->ps->i_want_to_die = TRUE;
        particle_platform_error("engine.particles.emitter_init_panic");
    }
}
static plist *remove_original_emitter_checked(particle_thread *pt, plist *l) {
    if (setjmp(pt->panicjump) == 0) return thread_particle_die(pt, l);
    particle_platform_error("engine.particles.emitter_cleanup_panic");
    /* In pristine thread_particle_die every Lua operation precedes all C
     * frees. A panic therefore leaves this node's C ownership intact. The VM
     * is faulted and will be closed, so orphan Lua references are not reused.
     */
    return release_item_without_lua(l);
}

/* Keep the extracted traversal text exact while checking the two operations
 * which otherwise use an expired setjmp frame after the first yield.
 */
#define thread_particle_init initialize_original_emitter_checked
#define thread_particle_die remove_original_emitter_checked

static void run_original_keyframe(particle_thread *pt) {
    plist *prev;
    plist *l;
/*__ORIGINAL_KEYFRAME_BODY__*/
}
#undef thread_particle_init
#undef thread_particle_die

static void cleanup_uninitialized_list(particle_thread *pt) {
    plist *l = pt->list;
    while (l) {
        l = release_item_without_lua(l);
    }
    pt->list = NULL;
}

static void drain_retired_lanes(void) {
    while (retired_head) {
        tome_retired_particle_lane *retired = retired_head;
        retired_head = retired->next;
        if (!retired_head) retired_tail = NULL;
        particle_thread *pt = retired->lane;
        if (pt->L && retired->vm_ready) {
            SDL_mutexP(pt->lock);
            plist *l = pt->list;
            while (l) l = remove_original_emitter_checked(pt, l);
            pt->list = NULL;
            SDL_mutexV(pt->lock);
        } else {
            cleanup_uninitialized_list(pt);
        }
        if (pt->L) {
            lua_close(pt->L);
            pt->L = NULL;
        }
        SDL_DestroyMutex(pt->lock);
        free(pt);
        free(retired);
    }
}

void thread_particle_new_keyframes(int nb_keyframes) {
    if (!threads || nb_keyframes <= 0) return;
    if (pending_keyframes > UINT64_MAX - (uint64_t)nb_keyframes) {
        particle_platform_error("engine.particles.keyframe_queue_overflow");
        return;
    }
    pending_keyframes += (uint64_t)nb_keyframes;
}

/*__ORIGINAL_THREAD_ADD__*/

void free_particles_thread(void) {
    if (!threads) return;
    if (pumping) {
        particle_platform_error("engine.particles.lifecycle_reentry");
        return;
    }
    tome_retired_particle_lane *retired = calloc(1, sizeof(*retired));
    if (!retired) {
        particle_platform_error("engine.particles.retirement_allocation_failed");
        return;
    }
    threads[0].running = FALSE;
    retired->lane = threads;
    retired->vm_ready = lane_vm_ready;
    if (retired_tail) retired_tail->next = retired;
    else retired_head = retired;
    retired_tail = retired;
    threads = NULL;
    lane_vm_ready = 0;
    pending_keyframes = 0; /* Original shutdown abandons queued semaphore work. */
    cur_thread = nb_threads = 0;
}

void create_particles_thread(void) {
    if (pumping || platform_failed) {
        particle_platform_error("engine.particles.lifecycle_reentry_or_fault");
        return;
    }
    if (threads) free_particles_thread();
    if (threads) return; /* Retirement allocation failed; do not lose ownership. */
    MAX_THREADS = 1;
    threads = calloc(1, sizeof(*threads));
    if (!threads) {
        particle_platform_error("engine.particles.lane_allocation_failed");
        return;
    }
    threads[0].id = nb_threads++;
    threads[0].lock = SDL_CreateMutex();
    if (!threads[0].lock) {
        free(threads); threads = NULL;
        particle_platform_error("engine.particles.lane_mutex_failed");
        return;
    }
    threads[0].running = TRUE;
    lane_vm_ready = 0;
    cur_thread = 0;
    /* VM initialization is queued for a VISUAL barrier, not the enclosing
     * gameplay Lua callback. No SDL_CreateThread or semaphore is created.
     */
}

int tome_particles_pump(unsigned maximum_keyframes) {
    if (platform_failed) return -1;
    if (maximum_keyframes > INT_MAX) {
        particle_platform_error("engine.particles.invalid_frame_budget");
        return -1;
    }
    if (pumping || tome_rng_phase_current() != TOME_RNG_VISUAL ||
        tome_rng_phase_activity_count()) {
        particle_platform_error("engine.particles.not_visual_barrier");
        return -1;
    }
    if (!maincontext || SDL_GL_GetCurrentContext() != maincontext) {
        particle_platform_error("engine.particles.main_gl_context_required");
        return -1;
    }
    if (!tome_rng_phase_activity_begin(TOME_RNG_VISUAL)) return -1;
    pumping = 1;
    drain_retired_lanes();
    int frames = 0;
    if (platform_failed) goto done;
    if (threads && !threads[0].L && !initialize_visual_lane(&threads[0])) goto done;
    while (threads && pending_keyframes && (unsigned)frames < maximum_keyframes) {
        /* Exactly one original per-keyframe body; no merged/drop-on-budget
         * updates. Pending work is retained for the next application phase.
         */
        run_original_keyframe(&threads[0]);
        --pending_keyframes;
        ++frames;
        if (platform_failed) break;
    }
done:
    pumping = 0;
    if (!tome_rng_phase_activity_end(TOME_RNG_VISUAL)) return -1;
    return platform_failed ? -1 : frames;
}

int tome_particles_prepare_at_barrier(unsigned maximum_keyframes) {
    if (!tome_rng_phase_enter_visual_at_barrier()) return -1;
    int frames = tome_particles_pump(maximum_keyframes);
    if (!tome_rng_phase_leave_visual_at_barrier()) return -1;
    return frames;
}
int tome_particles_shutdown_at_barrier(void) {
    if (pumping || tome_rng_phase_activity_count() ||
        !maincontext || SDL_GL_GetCurrentContext() != maincontext) return -1;
    if (!tome_rng_phase_enter_visual_at_barrier()) return -1;
    if (!tome_rng_phase_activity_begin(TOME_RNG_VISUAL)) {
        tome_rng_phase_leave_visual_at_barrier();
        return -1;
    }
    /* Faulted lanes still retain a cleanup path; gameplay-phase free only
     * queues ownership and never executes worker Lua/GC on the wrong bank.
     */
    free_particles_thread();
    pumping = 1;
    drain_retired_lanes();
    pumping = 0;
    int retired = !threads && !retired_head;
    if (!tome_rng_phase_activity_end(TOME_RNG_VISUAL)) return -1;
    if (!tome_rng_phase_leave_visual_at_barrier()) return -1;
    return retired ? 0 : -1;
}
uint64_t tome_particles_pending_keyframes(void) { return pending_keyframes; }
int tome_particles_visual_idle(void) {
    return !pumping && !pending_keyframes && !retired_head &&
        (!threads || lane_vm_ready);
}
const char *tome_particles_error_id(void) { return particle_error; }
