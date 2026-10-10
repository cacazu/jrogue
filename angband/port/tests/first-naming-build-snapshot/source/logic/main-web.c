/* Angband 4.2.6 browser adapter. GPL-2.0-only; original copyright remains
 * in every retained upstream file. No simulation or RNG is performed by
 * the Rust renderer or browser draw callback. */
#include "angband.h"
#include "init.h"
#include "game-world.h"
#include "player.h"
#include "savefile.h"
#include "ui-display.h"
#include "ui-game.h"
#include "ui-input.h"
#include "ui-init.h"
#include "ui-output.h"
#include "ui-prefs.h"
#include "web-checkpoint.h"
#include <emscripten.h>
#include <locale.h>

extern void ab_rs_clear(void);
extern void ab_rs_text(int x, int y, int n, int color, const uint32_t *s);
extern void ab_rs_wipe(int x, int y, int n);
extern void ab_rs_cursor(int x, int y);
extern const char *ab_rs_frame(void);
extern uint32_t ab_rs_input(uint32_t code, uint32_t mods);
extern const uint8_t *ab_rs_save_wrap(const uint8_t *bytes, uint32_t len);
extern uint32_t ab_rs_save_len(void);
extern uint32_t ab_rs_checkpoint_rng(const uint32_t *values, uint32_t len);
extern uint32_t ab_rs_take_restored_rng(uint32_t *out, uint32_t len);

extern uint32_t ab_host_key(void);
extern void ab_host_flush(void);
extern void ab_host_frame(const char *json);
extern void ab_host_state(const char *json);
extern void ab_host_save(const uint8_t *bytes, uint32_t len);
extern void ab_host_save_error(const char *id);

static term browser_term;
static int save_requested;
static uint32_t restored_rng[38];
static bool restore_rng_pending;
_Static_assert(RAND_DEG == 32, "Versioned browser RNG checkpoint shape");

static void snapshot_rng(uint32_t out[38]) {
    out[0] = (uint32_t)Rand_quick;
    out[1] = Rand_value;
    out[2] = state_i;
    out[3] = z0;
    out[4] = z1;
    out[5] = z2;
    for (int i = 0; i < RAND_DEG; ++i) out[6 + i] = STATE[i];
}

static void finish_checkpoint_restore(void) {
    if (!restore_rng_pending || !character_generated || !inkey_flag ||
        screen_save_depth != 0) return;
    if (!ab_web_checkpoint_loaded) {
        ab_host_save_error("save.invalid");
        quit("Missing browser checkpoint block");
    }
    Rand_quick = restored_rng[0] != 0;
    Rand_value = restored_rng[1];
    state_i = restored_rng[2];
    z0 = restored_rng[3]; z1 = restored_rng[4]; z2 = restored_rng[5];
    for (int i = 0; i < RAND_DEG; ++i) STATE[i] = restored_rng[6 + i];
    restore_rng_pending = false;
    ab_web_checkpoint_restore_requested = false;
}

static uint32_t rng_hash(void) {
    uint32_t h = 2166136261u;
    h = (h ^ Rand_value) * 16777619u;
    h = (h ^ state_i) * 16777619u;
    h = (h ^ z0) * 16777619u;
    h = (h ^ z1) * 16777619u;
    h = (h ^ z2) * 16777619u;
    h = (h ^ (uint32_t)Rand_quick) * 16777619u;
    for (int i = 0; i < RAND_DEG; ++i) h = (h ^ STATE[i]) * 16777619u;
    return h;
}

static void emit_state(void) {
    char json[2048];
    int written = snprintf(json, sizeof(json),
      "{\"turn\":%d,\"depth\":%d,\"hp\":%d,\"maxhp\":%d,\"x\":%d,\"y\":%d,\"rng_hash\":%u,\"generated\":%s,\"command\":%s,\"rng\":[%u,%u,%u,%u,%u,%u",
      turn, player ? player->depth : 0, player ? player->chp : 0,
      player ? player->mhp : 0, player ? player->grid.x : 0,
      player ? player->grid.y : 0, rng_hash(),
      character_generated ? "true" : "false", inkey_flag ? "true" : "false",
      (unsigned)Rand_quick, Rand_value, state_i, z0, z1, z2);
    for (int i = 0; i < RAND_DEG && written > 0 && (size_t)written < sizeof(json); ++i) {
        int count = snprintf(json + written, sizeof(json) - (size_t)written, ",%u", STATE[i]);
        if (count < 0) return;
        written += count;
    }
    if (written < 0 || (size_t)written + 3 >= sizeof(json)) return;
    snprintf(json + written, sizeof(json) - (size_t)written, "]}");
    ab_host_state(json);
}

/* A native save is only valid at a command boundary. Never silently save
 * a different position while an item/direction/birth prompt is pending. */
static void process_save(void) {
    if (!save_requested) return;
    save_requested = 0;
    if (!character_generated || !inkey_flag || screen_save_depth != 0 ||
        !ab_web_checkpoint_can_save()) {
        ab_host_save_error("save.not_ready");
        return;
    }
    uint32_t checkpoint_rng[38];
    snapshot_rng(checkpoint_rng);
    if (ab_rs_checkpoint_rng(checkpoint_rng, 38) != 0 || !savefile_save(savefile)) {
        ab_host_save_error("save.failed");
        return;
    }
    FILE *f = fopen(savefile, "rb");
    if (!f) { ab_host_save_error("save.failed"); return; }
    if (fseek(f, 0, SEEK_END) || ftell(f) < 0) {
        fclose(f); ab_host_save_error("save.failed"); return;
    }
    long size = ftell(f);
    rewind(f);
    if (size <= 0 || size > 16 * 1024 * 1024) {
        fclose(f); ab_host_save_error("save.failed"); return;
    }
    uint8_t *bytes = malloc((size_t)size);
    if (!bytes) { fclose(f); ab_host_save_error("save.failed"); return; }
    size_t read = fread(bytes, 1, (size_t)size, f);
    fclose(f);
    if (read == (size_t)size) {
        const uint8_t *envelope = ab_rs_save_wrap(bytes, (uint32_t)size);
        if (envelope) ab_host_save(envelope, ab_rs_save_len());
        else ab_host_save_error("save.failed");
    } else ab_host_save_error("save.failed");
    free(bytes);
}

static errr web_xtra(int n, int v) {
    switch (n) {
    case TERM_XTRA_CLEAR: ab_rs_clear(); return 0;
    case TERM_XTRA_FRESH: ab_host_frame(ab_rs_frame()); return 0;
    case TERM_XTRA_FLUSH: ab_host_flush(); return 0;
    case TERM_XTRA_EVENT: {
        uint32_t packed;
        finish_checkpoint_restore();
        emit_state();
        do {
            process_save();
            packed = ab_host_key();
            if (!packed && v) emscripten_sleep(16);
        } while (!packed && v);
        if (packed) {
            packed = ab_rs_input(packed & 0x001fffffu, (packed >> 21) & 31u);
            if (packed) Term_keypress(packed & 0x001fffffu, (packed >> 21) & 31u);
        }
        return 0;
    }
    case TERM_XTRA_DELAY:
        if (v > 0) emscripten_sleep((unsigned int)(v > 100 ? 100 : v));
        return 0;
    default: return 0;
    }
}

static errr web_cursor(int x, int y) { ab_rs_cursor(x, y); return 0; }
static errr web_wipe(int x, int y, int n) { ab_rs_wipe(x, y, n); return 0; }
static errr web_text(int x, int y, int n, int a, const wchar_t *s) {
    _Static_assert(sizeof(wchar_t) == sizeof(uint32_t), "Wasm wchar_t ABI");
    ab_rs_text(x, y, n, a, (const uint32_t *)s); return 0;
}

EMSCRIPTEN_KEEPALIVE void ab_request_save(void) { save_requested = 1; }

EMSCRIPTEN_KEEPALIVE int ab_run(uint32_t seed, int resume) {
    restore_rng_pending = resume && ab_rs_take_restored_rng(restored_rng, 38) == 0;
    ab_web_checkpoint_restore_requested = restore_rng_pending;
    ab_web_checkpoint_loaded = false;
    setlocale(LC_ALL, "C.UTF-8");
    term_init(&browser_term, 100, 32, 512);
    browser_term.xtra_hook = web_xtra;
    browser_term.curs_hook = web_cursor;
    browser_term.wipe_hook = web_wipe;
    browser_term.text_hook = web_text;
    browser_term.never_bored = true;
    Term_activate(&browser_term);
    angband_term[0] = &browser_term;
    ANGBAND_SYS = "web";
    init_file_paths("/data/", "/data/", "/data/");
    create_needed_dirs();
    init_display();
    if (!init_angband()) return 1;
    /* The initial parser setup uses the upstream default RNG. Birth and all
     * later simulation start at the explicitly selected deterministic seed. */
    Rand_quick = false;
    Rand_value = seed;
    Rand_state_init(seed);
    cmd_get_hook = textui_get_cmd;
    textui_init();
    my_strcpy(savefile, "/data/save/browser", sizeof(savefile));
    play_game(resume ? GAME_LOAD : GAME_NEW);
    textui_cleanup();
    cleanup_angband();
    term_nuke(&browser_term);
    return 0;
}
