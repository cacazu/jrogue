#include <emscripten/em_js.h>
// Transparent test hardware leaf. The actual original handle_input is on the
// stack; this synchronous host callback uses only the four observer exports.
// It is separate from production deferred notifications, SDL/IME and Asyncify.
EM_JS(void, cdda_context_browser_wait_leaf, (uint32_t index), {
    const observe = globalThis.cddaOriginalContextWaitLeaf;
    if (typeof observe !== 'function') throw new Error('original-context wait leaf not installed');
    // Keep actual C++ handler/RAII completion observable when separate Rust traps.
    // This leaf records observer errors and sends no commands.
    try { observe(index >>> 0); }
    catch (error) { globalThis.cddaOriginalContextWaitLeafError = error; }
});

// Focused harness: actual official class headers and selected original members.
// Scripted event acquisition and nested menu are explicit platform/UI leaves.
// They are not SDL hardware, the original keybindings UI, or full engine proof.
#include <algorithm>
#include <array>
#include <cstdint>
#include <memory>
#include <stdexcept>
#include <string>
#include <vector>
#include "input_context.h"
#include "input.h"
#include "game.h"
#include "ui_manager.h"
#include "browser_input_snapshot.h"

input_manager inp_mngr;
// No game instance is constructed or language toggle invoked. The official type
// is retained, and Clang no_destroy avoids linking the full game destructor.
[[clang::no_destroy]] std::unique_ptr<game> g;
extern int inputdelay;

namespace {
struct captured_record {
    std::string bytes;
    size_t default_actions = 0;
    int effective_timeout = 0;
};
struct harness_state {
    uint32_t case_id = 0;
    uint32_t polls = 0;
    bool nested = false;
    bool nested_done = false;
    bool keycode_available = true;
    bool gamepad = false;
    size_t before_default = 0;
    size_t after_default = 0;
    uint32_t held_pin = 0;
    int nested_result = 0;
    bool coordinates = false;
    std::string action;
    std::string failure;
    input_event raw;
    std::vector<captured_record> records;
};
harness_state state;
void demand(bool condition, const char *message) {
    if (!condition) throw std::runtime_error(message);
}
input_event key(int code, input_event_t type = input_event_t::keyboard_code) {
    input_event event(code, type);
    event.mouse_pos = point(0, 0);
    return event;
}
}

// Harness-only definition of the official declared friend. The original
// keybindings_ui definition and full input_context.o are NOT linked into this
// executable, so there is no competing class definition or changed class header.
class keybindings_ui {
public:
    static void reset() { inp_mngr.action_contexts.clear(); inp_mngr.basic_action_contexts.clear(); }
    static void bind(const std::string &category, const std::string &action,
                     std::vector<input_event> events) {
        inp_mngr.action_contexts[category][action].input_events = std::move(events);
    }
    static size_t defaults() {
        const auto where = inp_mngr.action_contexts.find("default");
        return where == inp_mngr.action_contexts.end() ? 0 : where->second.size();
    }
    static bool has_default(const std::string &action) {
        const auto where = inp_mngr.action_contexts.find("default");
        return where != inp_mngr.action_contexts.end() && where->second.count(action) != 0;
    }
    using table_copy = input_manager::t_action_contexts;
    static table_copy table() { return inp_mngr.action_contexts; }
    static bool unchanged(const table_copy &before) {
        const auto &after = inp_mngr.action_contexts;
        if (before.size() != after.size()) return false;
        auto left = before.begin(); auto right = after.begin();
        for (; left != before.end(); ++left, ++right) {
            if (left->first != right->first || left->second.size() != right->second.size()) return false;
            auto a = left->second.begin(); auto b = right->second.begin();
            for (; a != left->second.end(); ++a, ++b) {
                const auto &x = a->second; const auto &y = b->second;
                if (a->first != b->first || x.is_user_created != y.is_user_created ||
                    !(x.name == y.name) || x.input_events.size() != y.input_events.size()) return false;
                for (size_t n = 0; n < x.input_events.size(); ++n) {
                    const auto &e = x.input_events[n]; const auto &f = y.input_events[n];
                    if (!(e == f) || !(e.mouse_pos == f.mouse_pos) || e.text != f.text ||
                        e.edit != f.edit || e.edit_refresh != f.edit_refresh) return false;
                }
            }
        }
        return true;
    }
    static bool coordinates(const input_context &context) { return context.coordinate_input_received; }
};

namespace {
std::string snapshot() {
    const uint32_t handle = cdda_browser_snapshot_pin(1);
    demand(handle != 0, "actual original-class wait did not publish a snapshot");
    struct release_pin { uint32_t handle; ~release_pin() { cdda_browser_snapshot_release(handle); } } release{handle};
    const auto *data = cdda_browser_snapshot_data(handle);
    const size_t size = cdda_browser_snapshot_size(handle);
    demand(data != nullptr && size != 0 && size <= 262144, "actual snapshot pin bytes invalid");
    return std::string(reinterpret_cast<const char *>(data), size);
}
void capture() {
    const size_t before = keybindings_ui::defaults();
    const auto tables = keybindings_ui::table();
    const int timeout = inp_mngr.get_timeout();
    state.records.push_back({snapshot(), before, timeout});
    cdda_context_browser_wait_leaf(static_cast<uint32_t>(state.records.size() - 1));
    demand(keybindings_ui::defaults() == before && keybindings_ui::unchanged(tables) && inp_mngr.get_timeout() == timeout,
           "observation modified native action tables or timeout");
}
void nested_wait() {
    demand(!state.nested, "unexpected recursively scripted leaf");
    state.nested = true;
    input_context child("KEYBINDINGS", keyboard_mode::keychar);
    child.register_action("TEXT.CONFIRM");
    keybindings_ui::bind("KEYBINDINGS", "TEXT.CONFIRM", {key('x', input_event_t::keyboard_char)});
    state.nested_result = child.handle_input(7) == "TEXT.CONFIRM" ? 1 : -1;
    state.nested = false;
    state.nested_done = true;
    capture(); // actual scope destructor just restored and republished parent
}
}

bool is_keycode_mode_supported() { return state.keycode_available; }
bool gamepad_available() { return state.gamepad; }
void game::toggle_language_to_en() { throw std::runtime_error("unexercised game language leaf"); }
namespace ui_manager {
void invalidate_all_ui_adaptors() { throw std::runtime_error("unexercised UI invalidation leaf"); }
void redraw_invalidated() { throw std::runtime_error("unexercised UI redraw leaf"); }
}
action_id input_context::display_menu(bool) {
    demand(state.case_id == 8, "original full keybinding menu is outside this executable");
    demand(inp_mngr.get_timeout() == -1, "original help branch did not reset timeout");
    nested_wait();
    return ACTION_NULL;
}

input_event input_manager::get_input_event(keyboard_mode preferred) {
    ++state.polls;
    // toggle_language_to_en is always bound to an empty list by the harness. No
    // scripted event can match it, and the original unconstructed game is unused.
    if (state.case_id == 15) {
        demand(cdda_browser_snapshot_pin(1) == 0, "over-limit original context was partially published");
        return key('q');
    }
    capture();
    if (state.nested) {
        demand(preferred == keyboard_mode::keychar, "original nested keyboard preference changed");
        if (state.case_id == 7) keybindings_ui::bind("LIVE_CONTEXT", "OPEN", {key('r')});
        return key('x', input_event_t::keyboard_char);
    }
    if (state.case_id == 7 && !state.nested_done) {
        nested_wait();
        return key('r');
    }
    if (state.case_id == 13) throw std::runtime_error("scripted platform polling failure");
    if (state.case_id == 14) {
        state.held_pin = cdda_browser_snapshot_pin(1);
        demand(state.held_pin != 0, "held snapshot pin missing");
        for (unsigned i = 0; i < 5; ++i) capture();
    }
    switch (state.case_id) {
        case 1: case 14: return key('q');
        case 2: return key('z');
        case 3: return key('e');
        case 4: return key('c');
        case 5:
            return state.polls == 1 ? key(static_cast<int>(MouseInput::Move), input_event_t::mouse) : key('q');
        case 6: { input_event event; event.type = input_event_t::timeout; event.mouse_pos = point(0,0); return event; }
        case 8: return key('?');
        case 9: {
            input_event event = key(13, input_event_t::keyboard_char);
            event.text = u8"QA_Kit_日本🐈";
            event.edit = u8"編集中";
            event.edit_refresh = true;
            event.mouse_pos = point(37,51);
            return event;
        }
        case 10: {
            input_event event = key('m');
            event.modifiers = {keymod_t::ctrl, keymod_t::shift};
            event.text = "raw text ignored for equality";
            return event;
        }
        case 11: return key(static_cast<int>(MouseInput::Move), input_event_t::mouse);
        case 12: return key('q');
        default: throw std::runtime_error("unknown scripted original-context case");
    }
}

extern "C" int cdda_context_run(uint32_t id) noexcept {
    try {
        demand(id >= 1 && id <= 15, "unknown focused case");
        if (state.held_pin != 0) cdda_browser_snapshot_release(state.held_pin);
        state = harness_state{};
        state.case_id = id;
        keybindings_ui::reset();
        keybindings_ui::bind("default", "toggle_language_to_en", {});
        keybindings_ui::bind("default", "OPEN", {key('d')});
        keybindings_ui::bind("default", "PAUSE", {key('.')});
        keybindings_ui::bind("default", "LOCAL_EMPTY", {key('e')});
        keybindings_ui::bind("LIVE_CONTEXT", "OPEN", {key('q')});
        keybindings_ui::bind("LIVE_CONTEXT", "LOCAL_EMPTY", {});
        inp_mngr.set_timeout(41);
        input_context context(id == 9 ? "STRING_INPUT" : "LIVE_CONTEXT",
                              id == 9 ? keyboard_mode::keychar : keyboard_mode::keycode);
        context.register_action("OPEN");
        context.register_action("PAUSE");
        context.register_action("LOCAL_EMPTY");
        context.register_action("MISSING_NATIVE_ACTION");
        if (id == 2 || id == 3 || id == 5 || id == 11) context.register_action("ANY_INPUT");
        if (id == 4) {
            context.register_action("FIRST_COLLISION"); context.register_action("SECOND_COLLISION");
            keybindings_ui::bind("LIVE_CONTEXT", "FIRST_COLLISION", {key('c')});
            keybindings_ui::bind("LIVE_CONTEXT", "SECOND_COLLISION", {key('c')});
        }
        if (id == 8) {
            context.register_action("HELP_KEYBINDINGS");
            keybindings_ui::bind("default", "HELP_KEYBINDINGS", {key('?')});
        }
        if (id == 9) {
            context.register_action("TEXT.CONFIRM");
            keybindings_ui::bind("STRING_INPUT", "TEXT.CONFIRM", {key(13,input_event_t::keyboard_char)});
        }
        if (id == 10) {
            auto binding = key('m'); binding.modifiers = {keymod_t::ctrl,keymod_t::shift};
            keybindings_ui::bind("LIVE_CONTEXT", "OPEN", {binding});
        }
        if (id == 11) context.register_action("COORDINATE");
        if (id == 12) {
            context.set_timeout(9); context.reset_timeout();
            state.keycode_available = false;
            demand(!context.is_event_type_enabled(input_event_t::keyboard_code) &&
                   context.is_event_type_enabled(input_event_t::keyboard_char), "original capability fallback failed");
            state.keycode_available = true;
            demand(context.is_event_type_enabled(input_event_t::keyboard_code) &&
                   !context.is_event_type_enabled(input_event_t::keyboard_char), "original capability support failed");
            demand(!context.is_event_type_enabled(input_event_t::error) &&
                   context.is_event_type_enabled(input_event_t::timeout), "original event capability defaults failed");
        }
        if (id == 15) for (unsigned n = 0; n < 2048; ++n) context.register_action("SOURCE_ACTION_"+std::to_string(n));
        demand(context.is_registered_action("toggle_language_to_en"), "official constructor registration changed");
        const size_t before_dup = keybindings_ui::defaults();
        context.register_action("OPEN"); // actual original registration deduplicates
        demand(keybindings_ui::defaults() == before_dup, "registration modified manager tables");
        state.before_default = keybindings_ui::defaults();
        if (id == 13) {
            bool threw = false;
            try { context.handle_input(9); } catch (const std::runtime_error &error) {
                threw = std::string(error.what()) == "scripted platform polling failure";
            }
            demand(threw && inp_mngr.get_timeout() == 9, "original exception timeout limitation changed");
            state.action = "SCRIPTED_PLATFORM_EXCEPTION";
        } else {
            if (id == 6) context.set_timeout(0);
            state.action = (id == 6 || id == 12) ? context.handle_input() : context.handle_input(9);
            state.raw = context.get_raw_input();
            demand(inp_mngr.get_timeout() == 41 && inputdelay == 41, "original normal timeout restoration failed");
        }
        state.coordinates = keybindings_ui::coordinates(context);
        state.after_default = keybindings_ui::defaults();
        demand(cdda_browser_snapshot_pin(1) == 0, "outer original wait left active snapshot");
        if (state.held_pin != 0) {
            const auto *data = cdda_browser_snapshot_data(state.held_pin);
            const auto size = cdda_browser_snapshot_size(state.held_pin);
            demand(data != nullptr && std::string(reinterpret_cast<const char*>(data),size) == state.records.front().bytes,
                   "owned native pin changed after original wait exit");
        }
        return 1;
    } catch (const std::exception &error) {
        state.failure = error.what(); return -1;
    } catch (...) { state.failure = "unknown focused original-context failure"; return -2; }
}
extern "C" const uint8_t *cdda_context_record_data(uint32_t index) noexcept {
    return index < state.records.size() ? reinterpret_cast<const uint8_t*>(state.records[index].bytes.data()) : nullptr;
}
extern "C" size_t cdda_context_record_size(uint32_t index) noexcept { return index < state.records.size() ? state.records[index].bytes.size() : 0; }
extern "C" uint32_t cdda_context_record_count() noexcept { return static_cast<uint32_t>(state.records.size()); }
extern "C" int cdda_context_record_timeout(uint32_t index) noexcept { return index < state.records.size() ? state.records[index].effective_timeout : -999; }
extern "C" uint32_t cdda_context_record_defaults(uint32_t index) noexcept { return index < state.records.size() ? static_cast<uint32_t>(state.records[index].default_actions) : 0; }
extern "C" const uint8_t *cdda_context_action_data() noexcept { return reinterpret_cast<const uint8_t*>(state.action.data()); }
extern "C" size_t cdda_context_action_size() noexcept { return state.action.size(); }
extern "C" const uint8_t *cdda_context_text_data() noexcept { return reinterpret_cast<const uint8_t*>(state.raw.text.data()); }
extern "C" size_t cdda_context_text_size() noexcept { return state.raw.text.size(); }
extern "C" const uint8_t *cdda_context_edit_data() noexcept { return reinterpret_cast<const uint8_t*>(state.raw.edit.data()); }
extern "C" size_t cdda_context_edit_size() noexcept { return state.raw.edit.size(); }
extern "C" const uint8_t *cdda_context_failure_data() noexcept { return reinterpret_cast<const uint8_t*>(state.failure.data()); }
extern "C" size_t cdda_context_failure_size() noexcept { return state.failure.size(); }
extern "C" uint32_t cdda_context_metric(uint32_t index) noexcept {
    switch(index) {
        case 0: return static_cast<uint32_t>(state.before_default);
        case 1: return static_cast<uint32_t>(state.after_default);
        case 2: return state.polls;
        case 3: return state.nested_result == 1 ? 1 : 0;
        case 4: return state.coordinates ? 1 : 0;
        case 5: return static_cast<uint32_t>(inp_mngr.get_timeout());
        case 6: return state.raw.edit_refresh ? 1 : 0;
        case 7: return keybindings_ui::has_default("MISSING_NATIVE_ACTION") ? 1 : 0;
        default: return 0;
    }
}
