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
#include "web-replay-environment.h"
#include "web-death-cause.h"
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
    /* V3 serializes the owned bootstrap/continuation at this exact pending
     * terminal request. No native writer, descriptor, redraw or RNG call. */
    if (ab_rs_replay_enabled()) {
        if (ab_host_sync_pending()) {
            ab_host_save_error("save.replay_unavailable");
            return;
        }
        const uint8_t *envelope = ab_rs_replay_save();
        if (envelope) ab_host_save(envelope, ab_rs_save_len());
        else ab_host_save_error("save.replay_unavailable");
        return;
    }
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

static void observe_wait(uint32_t out[AB_REPLAY_WAIT_WORDS], int wait) {
    out[0] = 1; out[1] = wait != 0; out[2] = inkey_scan;
    out[3] = inkey_flag; out[4] = screen_save_depth;
    out[5] = (uint32_t)Term->wid; out[6] = (uint32_t)Term->hgt;
    out[7] = (uint32_t)Term->offset_x; out[8] = (uint32_t)Term->offset_y;
    out[9] = (uint32_t)((Term->key_head + Term->key_size - Term->key_tail) % Term->key_size);
    out[10] = character_generated; out[11] = (uint32_t)turn;
    out[12] = player ? (uint32_t)player->depth : 0;
    out[13] = player ? (uint32_t)player->chp : 0;
    out[14] = player ? (uint32_t)player->grid.x : 0;
    out[15] = player ? (uint32_t)player->grid.y : 0;
    snapshot_rng(out + 16);
}

static int dispatch_event(const uint32_t words[AB_REPLAY_EVENT_WORDS]) {
    if (ab_rs_replay_validate_event(words, AB_REPLAY_EVENT_WORDS))
        quit("Invalid browser terminal event");
    switch (words[0]) {
    case 0: return 0;
    case 1: {
        /* Legacy transport alone retains its historical key-only journal. */
        uint32_t code = words[1], mods = words[2];
        if (!ab_rs_replay_enabled()) {
            uint32_t packed = ab_rs_input(code, mods);
            if (!packed) return -1;
            code = packed & 0x001fffffu; mods = (packed >> 21) & 31u;
        }
        return Term_keypress(code, (uint8_t)mods);
    }
    case 2:
        return Term_mousepress((int)words[3], (int)words[4],
            (char)((words[2] << 4) | words[5]));
    case 3: {
        int result = Term_resize((int)words[6], (int)words[7]);
        if (!result && ab_rs_resize(words[6], words[7]))
            quit("Browser frame resize failed");
        return result;
    }
    case 4: {
        ui_event event;
        memset(&event, 0, sizeof(event));
        event.key.type = EVT_BUTTON; event.key.code = words[1];
        event.key.mods = (uint8_t)words[2];
        return Term_event_push(&event);
    }
    default: return -1;
    }
}

static errr web_xtra(int n, int v) {
    switch (n) {
    case TERM_XTRA_CLEAR: ab_rs_clear(); return 0;
    case TERM_XTRA_FRESH: ab_host_frame(ab_rs_frame()); return 0;
    case TERM_XTRA_FLUSH:
        (void)ab_host_sync_pending();
        if (ab_rs_replay_flush()) quit("Browser replay flush mismatch");
        ab_host_flush(); return 0;
    case TERM_XTRA_EVENT: {
        uint32_t words[AB_REPLAY_EVENT_WORDS] = {0};
        uint32_t observed[AB_REPLAY_WAIT_WORDS], mode;
        finish_checkpoint_restore();
        emit_state();
        observe_wait(observed, v);
        mode = ab_rs_replay_wait(observed, AB_REPLAY_WAIT_WORDS);
        if (mode > 2) quit("Browser replay wait mismatch");
        if (mode == 2) ab_host_replay_target();
        if (mode == 1) {
            if (ab_rs_replay_next(words, AB_REPLAY_EVENT_WORDS))
                quit("Browser replay event mismatch");
            if (v && !words[0]) quit("Invalid blocking replay empty outcome");
        } else {
        do {
            process_save();
            memset(words, 0, sizeof(words));
            if (!ab_host_event(words, AB_REPLAY_EVENT_WORDS) && v)
                emscripten_sleep(16);
        } while (!words[0] && v);
        }
        int native_result = dispatch_event(words);
        uint32_t status = ab_rs_replay_commit(words, AB_REPLAY_EVENT_WORDS, native_result);
        /* A live cap failure blocks saves but does not alter engine input. */
        if (mode == 1 && status) quit("Browser replay delivery mismatch");
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
    ab_dc_registry_reset();
    if (!init_angband()) return 1;
    /* The initial parser setup uses the upstream default RNG. Birth and all
     * later simulation start at the explicitly selected deterministic seed. */
    Rand_quick = false;
    Rand_value = seed;
    Rand_state_init(seed);
    uint32_t bootstrap_rng[38];
    snapshot_rng(bootstrap_rng);
    if (ab_rs_replay_bootstrap_rng(bootstrap_rng, 38))
        quit("Browser replay bootstrap RNG mismatch");
    cmd_get_hook = textui_get_cmd;
    textui_init();
    my_strcpy(savefile, "/data/save/browser", sizeof(savefile));
    play_game(resume ? GAME_LOAD : GAME_NEW);
    textui_cleanup();
    ab_dc_registry_reset();
    cleanup_angband();
    term_nuke(&browser_term);
    return 0;
}
