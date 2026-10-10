/* Scoped browser ABI for official NetHack 5.0.0; no gameplay mutation.
 * Modified distribution: added 2026-10-02 for the jrogue browser adapter.
 * NetHack upstream copyright and NGPL notices remain in upstream/.
 */
#include "hack.h"
#include "func_tab.h"
#include "dlb.h"
#include <stddef.h>
#include <emscripten/emscripten.h>

/* UUIDs are platform metadata; Web Crypto keeps them separate from core RNG. */
EM_JS(void, nh_browser_uuid, (char *destination, int capacity), {
    const cryptoApi = globalThis.crypto;
    let uuid;
    if (cryptoApi && cryptoApi.randomUUID) { uuid = cryptoApi.randomUUID(); }
    else {
        const bytes = new Uint8Array(16);
        if (!cryptoApi || !cryptoApi.getRandomValues) throw new Error("Web Crypto is required for game UUIDs");
        cryptoApi.getRandomValues(bytes);
        bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
        const hex = Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("");
        uuid = `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
    }
    stringToUTF8(uuid, destination, capacity);
});
void get_nhuuid(void) { if (!svn.nhuuid[0]) nh_browser_uuid(svn.nhuuid, sizeof svn.nhuuid); }
void free_nhuuid(void) { memset(svn.nhuuid, 0, sizeof svn.nhuuid); }

EMSCRIPTEN_KEEPALIVE int nh_input_layout(void) {
    if (gc.Cmd.num_pad) return gc.Cmd.phone_layout ? 2 : 1;
    return gc.Cmd.swap_yz ? 3 : 0;
}
EMSCRIPTEN_KEEPALIVE int nh_abi_input_layout(void) { return nh_input_layout(); }
EMSCRIPTEN_KEEPALIVE int nh_abi_input_state(void) { return program_state.input_state; }
/* Added 2026-10-02: update libc's environment before starting the engine.
 * Emscripten ENV assignments after factory initialization update only JS.
 */
EMSCRIPTEN_KEEPALIVE int nh_abi_setenv(const char *name, const char *value) {
    if (!name || !*name || strchr(name, '=') || !value) return -1;
    return setenv(name, value, 1);
}

EMSCRIPTEN_KEEPALIVE int nh_abi_anything_size(void) { return sizeof(anything); }
EMSCRIPTEN_KEEPALIVE int nh_abi_menu_item_size(void) { return sizeof(menu_item); }
EMSCRIPTEN_KEEPALIVE int nh_abi_menu_item_offset(void) { return offsetof(menu_item, item); }
EMSCRIPTEN_KEEPALIVE int nh_abi_menu_count_offset(void) { return offsetof(menu_item, count); }
EMSCRIPTEN_KEEPALIVE int nh_abi_menu_flags_offset(void) { return offsetof(menu_item, itemflags); }
EMSCRIPTEN_KEEPALIVE int nh_abi_getlin_buffer_size(void) { return BUFSZ; }
EMSCRIPTEN_KEEPALIVE void nh_abi_set_yn_number(int count) { yn_number = count; }

EMSCRIPTEN_KEEPALIVE const char *nh_abi_layout_json(void) {
    static char layout[1024];
    snprintf(layout, sizeof(layout),
             "{\"anythingSize\":%zu,\"menuItemSize\":%zu,\"menuCountOffset\":%zu,\"menuFlagsOffset\":%zu,"
             "\"glyphIdOffset\":%zu,\"glyphCharOffset\":%zu,\"glyphFrameOffset\":%zu,\"glyphFlagsOffset\":%zu,"
             "\"glyphColorOffset\":%zu,\"glyphCustomColorOffset\":%zu,\"extCommandSize\":%zu,\"extNameOffset\":%zu,"
             "\"extDescriptionOffset\":%zu,\"extFlagsOffset\":%zu,\"playerNameSize\":%d,\"lineBufferSize\":%d}",
             sizeof(anything), sizeof(menu_item), offsetof(menu_item, count), offsetof(menu_item, itemflags),
             offsetof(glyph_info, glyph), offsetof(glyph_info, ttychar), offsetof(glyph_info, framecolor),
             offsetof(glyph_info, gm) + offsetof(glyph_map, glyphflags),
             offsetof(glyph_info, gm) + offsetof(glyph_map, sym) + offsetof(struct classic_representation, color),
             offsetof(glyph_info, gm) + offsetof(glyph_map, customcolor), sizeof(struct ext_func_tab),
             offsetof(struct ext_func_tab, ef_txt), offsetof(struct ext_func_tab, ef_desc), offsetof(struct ext_func_tab, flags),
             PL_NSIZ, BUFSZ);
    return layout;
}

EMSCRIPTEN_KEEPALIVE char *nh_abi_readfile(const char *filename) {
    dlb *file;
    long size;
    char *text;
    if (!filename || !(file = dlb_fopen(filename, "r"))) return (char *)0;
    dlb_fseek(file, 0L, SEEK_END);
    size = dlb_ftell(file);
    if (size < 0L || size > 16777216L) { dlb_fclose(file); return (char *)0; }
    dlb_fseek(file, 0L, SEEK_SET);
    text = (char *)malloc((size_t)size + 1);
    if (text) {
        size_t read = dlb_fread(text, 1, (int)size, file);
        text[read] = '\0';
    }
    dlb_fclose(file);
    return text;
}

EMSCRIPTEN_KEEPALIVE int nh_abi_glyph_value(const glyph_info *g, int field) {
    if (!g) return 0;
    switch (field) {
    case 0: return g->glyph;
    case 1: return g->ttychar;
    case 2: return g->framecolor;
    case 3: return g->gm.glyphflags;
    case 4: return g->gm.sym.color;
    case 5: return g->gm.sym.symidx;
    case 6: return g->gm.customcolor;
    case 7: return g->gm.color256idx;
    case 8: return g->gm.tileidx;
#ifdef ENHANCED_SYMBOLS
    case 9: return g->gm.u ? g->gm.u->utf32ch : 0;
#endif
    default: return 0;
    }
}
EMSCRIPTEN_KEEPALIVE const char *nh_abi_glyph_utf8(const glyph_info *g) {
#ifdef ENHANCED_SYMBOLS
    return g && g->gm.u ? (const char *)g->gm.u->utf8str : (const char *)0;
#else
    return (const char *)0;
#endif
}
EMSCRIPTEN_KEEPALIVE int nh_abi_extcmd_count(void) {
    int n = 0;
    while (extcmdlist[n].ef_txt) ++n;
    return n;
}
EMSCRIPTEN_KEEPALIVE const char *nh_abi_extcmd_name(int index) {
    return index >= 0 && index < nh_abi_extcmd_count() ? extcmdlist[index].ef_txt : (const char *)0;
}
EMSCRIPTEN_KEEPALIVE const char *nh_abi_extcmd_description(int index) {
    return index >= 0 && index < nh_abi_extcmd_count() ? extcmdlist[index].ef_desc : (const char *)0;
}
EMSCRIPTEN_KEEPALIVE int nh_abi_extcmd_flags(int index) {
    return index >= 0 && index < nh_abi_extcmd_count() ? extcmdlist[index].flags : 0;
}
EMSCRIPTEN_KEEPALIVE const char *nh_abi_state_json(void) {
    static char state[512];
    snprintf(state, sizeof(state),
             "{\"x\":%d,\"y\":%d,\"hp\":%d,\"hpmax\":%d,\"level\":%d,"
             "\"moves\":%ld,\"dungeon\":%d,\"depth\":%d,\"gold\":%ld,\"roleName\":\"%s\",\"raceName\":\"%s\"}",
             (int)u.ux, (int)u.uy, u.uhp, u.uhpmax, (int)u.ulevel,
             svm.moves, (int)u.uz.dnum, (int)u.uz.dlevel, money_cnt(gi.invent), gu.urole.name.m, gu.urace.noun);
    return state;
}

static unsigned nh_abi_hash(unsigned hash, const void *bytes, size_t count) {
    const unsigned char *p = (const unsigned char *)bytes;
    while (count--) { hash ^= *p++; hash *= 16777619U; }
    return hash;
}
EMSCRIPTEN_KEEPALIVE unsigned nh_abi_state_checksum(void) {
    unsigned hash = 2166136261U;
    struct monst *monster;
    struct obj *object;
    hash = nh_abi_hash(hash, &u, sizeof(u));
    hash = nh_abi_hash(hash, &svm.moves, sizeof(svm.moves));
    hash = nh_abi_hash(hash, &svl.level, sizeof(svl.level));
    for (monster = fmon; monster; monster = monster->nmon)
        hash = nh_abi_hash(hash, monster, sizeof(*monster));
    for (object = fobj; object; object = object->nobj)
        hash = nh_abi_hash(hash, object, sizeof(*object));
    for (object = gi.invent; object; object = object->nobj)
        hash = nh_abi_hash(hash, object, sizeof(*object));
    return hash;
}

/* Canonical scalar digest, excluding addresses, padding, display caches, RNG.
 * Intended to verify a same-version saved world across fresh WASM instances.
 */
static unsigned nh_abi_hash_word(unsigned hash, uint64 word) {
    int byte;
    for (byte = 0; byte < 8; ++byte) {
        hash ^= (unsigned)(word & 255U); hash *= 16777619U; word >>= 8;
    }
    return hash;
}
#define WORLD_FIELD(value) hash = nh_abi_hash_word(hash, (uint64)(value))
static unsigned nh_abi_hash_objects(unsigned hash, struct obj *object, int depth) {
    if (depth > 64) return nh_abi_hash_word(hash, 0xBADU);
    for (; object; object = object->nobj) {
        WORLD_FIELD(object->o_id); WORLD_FIELD(object->otyp); WORLD_FIELD(object->quan);
        WORLD_FIELD(object->spe); WORLD_FIELD(object->blessed); WORLD_FIELD(object->cursed);
        WORLD_FIELD(object->known); WORLD_FIELD(object->dknown); WORLD_FIELD(object->bknown);
        WORLD_FIELD(object->rknown); WORLD_FIELD(object->unpaid); WORLD_FIELD(object->owornmask);
        WORLD_FIELD(object->where); WORLD_FIELD(object->ox); WORLD_FIELD(object->oy);
        WORLD_FIELD(object->corpsenm); WORLD_FIELD(object->oeaten);
        hash = nh_abi_hash_objects(hash, object->cobj, depth + 1);
        WORLD_FIELD(0xFFFFFFFFU);
    }
    return hash;
}
EMSCRIPTEN_KEEPALIVE unsigned nh_abi_world_checksum(void) {
    unsigned hash = 2166136261U;
    struct monst *monster;
    int x, y;
    WORLD_FIELD(u.ux); WORLD_FIELD(u.uy); WORLD_FIELD(u.uhp); WORLD_FIELD(u.uhpmax);
    WORLD_FIELD(u.ulevel); WORLD_FIELD(u.uexp); WORLD_FIELD(u.uhunger);
    WORLD_FIELD(svm.moves); WORLD_FIELD(u.uz.dnum); WORLD_FIELD(u.uz.dlevel);
    for (x = 0; x < COLNO; ++x) for (y = 0; y < ROWNO; ++y) {
        WORLD_FIELD(levl[x][y].typ); WORLD_FIELD(levl[x][y].lit);
        WORLD_FIELD(levl[x][y].waslit); WORLD_FIELD(levl[x][y].seenv);
    }
    for (monster = fmon; monster; monster = monster->nmon) {
        WORLD_FIELD(monster->m_id); WORLD_FIELD(monster->mx); WORLD_FIELD(monster->my);
        WORLD_FIELD(monster->mhp); WORLD_FIELD(monster->mhpmax); WORLD_FIELD(monsndx(monster->data));
        WORLD_FIELD(monster->m_lev); WORLD_FIELD(monster->mtame); WORLD_FIELD(monster->mpeaceful);
        WORLD_FIELD(monster->mcan); WORLD_FIELD(monster->msleeping); WORLD_FIELD(monster->mfrozen);
    }
    hash = nh_abi_hash_objects(hash, fobj, 0);
    hash = nh_abi_hash_objects(hash, gi.invent, 0);
    return hash;
}
#undef WORLD_FIELD
