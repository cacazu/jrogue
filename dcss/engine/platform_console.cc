// Browser console adapter. Copyright 2026 jrogue contributors; GPL-2.0-or-later.
// The official gameplay engine remains in engine/work; rendering never draws RNG.
#include "AppHdr.h"
#include <cstdarg>
#include <cstdio>
#include <cstring>
#include <vector>
#include "cio.h"
#include "clua.h"
#include "colour.h"
#include "files.h"
#include "libconsole.h"
#include "player.h"
#include "random.h"
#include "state.h"
#include "store.h"
#include "unicode.h"
#include "viewgeom.h"
#include <emscripten/emscripten.h>

extern "C" {
void dcss_host_frame(const uint32_t *, int, int, int, int, int);
int dcss_host_read_key();
int dcss_host_has_key();
void dcss_host_delay(int);
void dcss_host_semantic(const char*);
}
// Versioned display observation; never called by redraw or native history load.
extern "C" void dcss_semantic_canned(const char* id, int turn, int channel,
    int param, int colour, bool join, bool nojoin, bool more, bool flash, bool shout) {
    static uint64_t sequence = 0;
    // Source IDs are authored ASCII. Avoid JSON injection and sequence wrapping.
    if (!id || !*id || std::strlen(id) > 128 || sequence == UINT64_MAX) return;
    for (const char* p = id; *p; ++p)
        if (!((*p >= 'a' && *p <= 'z') || (*p >= '0' && *p <= '9')
              || *p == '.' || *p == '_')) return;
    char event[1024];
    const int length = std::snprintf(event, sizeof(event),
        "{\"version\":1,\"source\":\"canned-v1\","
        "\"upstream\":\"1eebc1a2892e1c89776a0d7a10691f8dac8d9796\","
        "\"sequence\":\"%llu\",\"turn\":%d,\"channel\":%d,\"param\":%d,"
        "\"colour\":%d,\"join\":%s,\"nojoin\":%s,\"more\":%s,\"flash\":%s,"
        "\"shout\":%s,\"message\":{\"id\":\"%s\",\"params\":{}}}",
        static_cast<unsigned long long>(sequence + 1), turn, channel, param, colour,
        join ? "true" : "false", nojoin ? "true" : "false",
        more ? "true" : "false", flash ? "true" : "false", shout ? "true" : "false", id);
    if (length <= 0 || static_cast<size_t>(length) >= sizeof(event)) return;
    ++sequence;
    dcss_host_semantic(event);
}
namespace {
constexpr int columns = 80;
constexpr int lines = 30;
uint32_t cells[columns * lines * 3];
std::vector<char32_t> combining[columns * lines];
int cx = 0, cy = 0, foreground = LIGHTGREY, background = BLACK;
bool cursor = false, headless = false;
void write_cell(int x, int y, uint32_t ch) {
    if (x < 0 || y < 0 || x >= columns || y >= lines) return;
    const int off = (y * columns + x) * 3;
    cells[off] = ch;
    combining[y * columns + x].clear();
    cells[off+1] = foreground;
    cells[off+2] = background;
}
}
bool in_headless_mode() { return headless; }
void enter_headless_mode() { headless = true; }
void console_startup() { clrscr_sys(); }
void console_shutdown() { update_screen(); }
int get_number_of_cols() { return columns; }
int get_number_of_lines() { return lines; }
int num_to_lines(int n) { return n; }
void set_mouse_enabled(bool) {}
void set_cursor_enabled(bool enabled) { cursor = enabled; }
bool is_cursor_enabled() { return cursor; }
void textcolour(int c) { foreground = c; }
void textbackground(int c) { background = c; }
COLOURS default_hover_colour() { return LIGHTGREY; }
lib_display_info::lib_display_info() : type("jrogue browser console"), term("wasm"), fg_colors(16), bg_colors(16) {}
void gotoxy_sys(int x, int y) { cx = x-1; cy = y-1; }
int wherex() { return cx+1; }
int wherey() { return cy+1; }
void fakecursorxy(int x, int y) { gotoxy_sys(x,y); }
void clear_to_end_of_line() {
    const int old_fg = foreground, old_bg = background;
    foreground = LIGHTGREY; background = BLACK;
    for (int x = cx; x < columns; ++x) write_cell(x, cy, ' ');
    foreground = old_fg; background = old_bg;
}
void clrscr_sys() {
    cx = cy = 0; foreground = LIGHTGREY; background = BLACK;
    for (int y=0; y<lines; ++y) for (int x=0; x<columns; ++x) write_cell(x,y,' ');
}
void putwch(char32_t chr) {
    if (!chr) chr = ' ';
    if (chr == '\r') { cx = 0; return; }
    if (chr == '\n') { cx = 0; cy = std::min(cy+1, lines-1); return; }
    if (chr == '\b') { cx = std::max(0,cx-1); return; }
    const int width = std::max(0,wcwidth(chr));
    if (width == 0) {
        int previous = cy * columns + cx - 1;
        while (previous >= 0 && cells[previous * 3] == 0) --previous;
        if (previous >= 0 && previous < columns * lines)
            combining[previous].push_back(chr);
        return;
    }
    write_cell(cx,cy,chr);
    if (width == 2) write_cell(cx+1, cy, 0);
    cx += width;
    if (cx >= columns) { cx=0; cy=std::min(cy+1,lines-1); }
}
void cprintf(const char *format, ...) {
    char buffer[8192]; va_list args; va_start(args,format);
    vsnprintf(buffer,sizeof(buffer),format,args); va_end(args);
    char *p = buffer; char32_t ch;
    while (int n = utf8towc(&ch,p)) { p+=n; putwch(ch); }
}
void puttext(int x, int y, const crawl_view_buffer &buf) {
    const screen_cell_t *cell = buf;
    for (int row=0; row<buf.size().y; ++row) {
        cgotoxy(x,y+row);
        for (int col=0; col<buf.size().x; ++col,++cell) put_colour_ch(cell->colour,cell->glyph);
    }
}
void update_screen() { dcss_host_frame(cells,columns,lines,cx,cy,cursor); }
int getch_ck() { update_screen(); return dcss_host_read_key(); }
bool kbhit() { return dcss_host_has_key() != 0; }
void delay(unsigned int ms) {
    update_screen();
    if (ms && !crawl_state.disables[DIS_DELAY]) dcss_host_delay(ms);
}
extern "C" {
EMSCRIPTEN_KEEPALIVE const char *dcss_clusters_json() {
    static std::string json;
    json = "[";
    bool first = true;
    for (int cell = 0; cell < columns * lines; ++cell) {
        if (combining[cell].empty()) continue;
        if (!first) json += ",";
        first = false;
        json += "{\"cell\":" + std::to_string(cell) + ",\"text\":\"";
        const auto append = [&](char32_t chr) {
            char encoded[8];
            const int size = wctoutf8(encoded, chr);
            for (int i = 0; i < size; ++i) {
                const unsigned char byte = encoded[i];
                if (byte == '"' || byte == '\\') json += '\\';
                if (byte < 32) {
                    char escape[7];
                    snprintf(escape, sizeof(escape), "\\u%04x", byte);
                    json += escape;
                } else json += encoded[i];
            }
        };
        append(cells[cell * 3]);
        for (char32_t mark : combining[cell]) append(mark);
        json += "\"}";
    }
    json += "]";
    return json.c_str();
}
EMSCRIPTEN_KEEPALIVE void dcss_repaint() { update_screen(); }
EMSCRIPTEN_KEEPALIVE int dcss_save() {
    if (!you.save || !crawl_state.game_started || !crawl_state.need_save
        || !you.on_current_level || you.entering_level || you.hp <= 0) return 0;
    // A browser checkpoint must include the current level. The official
    // save_game(false) writes player chunks only; native turn checkpoints
    // explicitly save_level first (main.cc), as do save-and-exit checkpoints.
    clua.save_persist();
    save_level(level_id::current());
    save_game(false);
    return 1;
}
EMSCRIPTEN_KEEPALIVE const char *dcss_snapshot_json() {
    static char data[32768];
    int offset = snprintf(data,sizeof(data), "{\"engine\":\"dcss-0.34.1\",\"x\":%d,\"y\":%d,\"hp\":%d,\"maxHp\":%d,\"turn\":%d,\"xl\":%d,\"branch\":%d,\"depth\":%d,\"seed\":\"%llu\",\"rng\":[",
             you.pos().x,you.pos().y,you.hp,you.hp_max,you.num_turns,you.experience_level,static_cast<int>(you.where_are_you),you.depth,
             static_cast<unsigned long long>(you.game_seed));
    const auto states = rng::get_states();
    const CrawlVector generators = rng::generators_to_vector();
    for (size_t i=0; i<states.size(); ++i) {
        const CrawlVector &generator = generators[i].get_vector();
        offset += snprintf(data+offset,sizeof(data)-offset,
                "%s{\"state\":\"%llu\",\"sequence\":\"%llu\",\"draws\":\"%llu\"}", i ? "," : "",
                static_cast<unsigned long long>(generator[0].get_int64()),
                static_cast<unsigned long long>(generator[1].get_int64()),
                static_cast<unsigned long long>(states[i]));
    }
    snprintf(data+offset,sizeof(data)-offset,"]}");
    return data;
}
}
