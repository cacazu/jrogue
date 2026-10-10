/**
 * @file
 * @brief Functions used to print messages.
**/

#include "AppHdr.h"

#include "message.h"

#include <sstream>

#include "areas.h"
#include "colour.h"
#include "delay.h"
#include "english.h"
#include "hints.h"
#include "initfile.h"
#include "libutil.h"
#include "luaterp.h"
#include "macro.h"
#include "menu.h"
#include "monster.h"
#include "mon-util.h"
#include "notes.h"
#include "output.h"
#include "religion.h"
#include "scroller.h"
#include "sound.h"
#include "state.h"
#include "stringutil.h"
#include "tiles-build-specific.h"
#include "tag-version.h"
#include "unwind.h"
#include "view.h"

// BEGIN jrogue semantic-canned adapter v1
// adapter-sha256: 960b1e0f26fd550a3075fe7a89649de78ed9dfe44afdf7207f52788d6b0196c8
// Source-origin canned-message observation. GPL-2.0-or-later.
// Inline into message.cc; never place this file under engine/work/source.
// This adapter retains canonical English messaging and every gameplay branch.

#if defined(__EMSCRIPTEN__)
extern "C" void dcss_semantic_canned(const char *id, int turn, int channel,
                                    int param, int colour, bool join,
                                    bool nojoin, bool more, bool flash,
                                    bool shout) __attribute__((weak));
#endif

namespace {
const char *_dcss_canned_pending_id = nullptr;

class _dcss_canned_scope
{
    const char *previous;
public:
    explicit _dcss_canned_scope(const char *id)
        : previous(_dcss_canned_pending_id)
    {
        _dcss_canned_pending_id = id;
    }
    ~_dcss_canned_scope() { _dcss_canned_pending_id = previous; }
    _dcss_canned_scope(const _dcss_canned_scope&) = delete;
    _dcss_canned_scope& operator=(const _dcss_canned_scope&) = delete;
};

template<typename Printer>
void _dcss_canned_print(const char *id, Printer print)
{
    const _dcss_canned_scope scope(id);
    print();
}

const char *_dcss_canned_take_pending()
{
    const char *id = _dcss_canned_pending_id;
    _dcss_canned_pending_id = nullptr;
    return id;
}

void _dcss_canned_accepted(const char *id, int turn, int channel, int param,
                           int colour, bool join, bool nojoin, bool more,
                           bool flash, bool shout)
{
#if defined(__EMSCRIPTEN__)
    if (!id || !dcss_semantic_canned)
        return;
    // The platform must catch JS callback failures and forbid engine reentry.
    // No text, RNG, message filtering, history, or game rules are changed here.
    dcss_semantic_canned(id, turn, channel, param, colour, join, nojoin,
                        more, flash, shout);
#else
    (void)id; (void)turn; (void)channel; (void)param; (void)colour;
    (void)join; (void)nojoin; (void)more; (void)flash; (void)shout;
#endif
}
} // namespace
// END jrogue semantic-canned adapter v1

static void _mpr(string text, msg_channel_type channel=MSGCH_PLAIN, int param=0,
                 bool nojoin=false, bool cap=true);

void mpr(const string &text)
{
    _mpr(text);
}

void mpr_nojoin(msg_channel_type channel, string text)
{
    _mpr(text, channel, 0, true);
}

static bool _ends_in_punctuation(const string& text)
{
    if (text.size() == 0)
        return false;
    switch (text[text.size() - 1])
    {
    case '.':
    case '!':
    case '?':
    case ',':
    case ';':
    case ':':
        return true;
    default:
        return false;
    }
}

// BEGIN jrogue canned-native display v3 (future, not active)
// Canonical English remains the sole source of original control and save data.
#if defined(__EMSCRIPTEN__) && !defined(USE_TILE_LOCAL)
extern "C" int dcss_host_startup_text(const char*, const char*, char*, int);
NORETURN void end(int, bool, const char*, ...);
extern "C" int dcss_native_history_begin(int) __attribute__((weak));
extern "C" int dcss_native_history_row(int, int, int, int, const char*, int, int) __attribute__((weak));
extern "C" int dcss_native_history_segment(int, int, const char*, int, const char*, int, int, int, int, int) __attribute__((weak));
extern "C" void dcss_native_history_end(int) __attribute__((weak));
extern "C" int dcss_native_history_restore_row(int, const char*, int, int, int, int) __attribute__((weak));
extern "C" int dcss_native_history_restore_segment(int, int, char*, int, char*, int, int*) __attribute__((weak));
extern "C" int dcss_native_history_restore_begin(int) __attribute__((weak));
extern "C" int dcss_native_history_restore_end() __attribute__((weak));
#endif
static bool _dcss_restore_display_hold = false;

struct _dcss_display_segment
{
    string canonical;
    string id;
    int colour = LIGHTGREY;
    bool shout = false;
    bool capitalise = false;
    bool filtered = false;

    _dcss_display_segment() = default;

    _dcss_display_segment(string canonical_value, string id_value)
        : canonical(std::move(canonical_value)), id(std::move(id_value)) {}

    _dcss_display_segment(string canonical_value, string id_value, int colour_value,
                          bool shout_value, bool capitalise_value, bool filtered_value)
        : canonical(std::move(canonical_value)), id(std::move(id_value)),
          colour(colour_value), shout(shout_value), capitalise(capitalise_value),
          filtered(filtered_value) {}
};

static bool _dcss_known_canned_id(const string& id)
{
    static const char* const ids[] = {
        "game.canned.something_appears.at_feet",
        "game.canned.something_appears.before_you",
        "game.canned.nothing_happens",
        "game.canned.you_unaffected",
        "game.canned.you_resist",
        "game.canned.you_partially_resist",
        "game.canned.too_berserk",
        "game.canned.too_confused",
        "game.canned.present_form",
        "game.canned.nothing_carried",
        "game.canned.cannot_do_yet",
        "game.canned.ok",
        "game.canned.unthinking_act",
        "game.canned.nothing_there",
        "game.canned.nothing_close_enough",
        "game.canned.spell_fizzles",
        "game.canned.huh",
        "game.canned.empty_handed_already.mouth",
        "game.canned.empty_handed_already.claws",
        "game.canned.empty_handed_already.tentacles",
        "game.canned.empty_handed_already.hands",
        "game.canned.empty_handed_now.mouth",
        "game.canned.empty_handed_now.claws",
        "game.canned.empty_handed_now.tentacles",
        "game.canned.empty_handed_now.hands",
        "game.canned.you_blink",
        "game.canned.strange_stasis",
        "game.canned.no_spells",
        "game.canned.mana_increase",
        "game.canned.mana_decrease",
        "game.canned.disoriented",
        "game.canned.detect_nothing",
        "game.canned.cannot_move",
        "game.canned.you_die",
        "game.canned.ghostly_outline",
        "game.canned.full_health",
        "game.canned.full_magic",
        "game.canned.gain_health",
        "game.canned.gain_magic",
        "game.canned.magic_drain.hp_casting",
        "game.canned.magic_drain.magic_energy",
        "game.canned.something_in_way",
        "game.canned.cannot_see",
        "game.canned.god_declines",
        "game.canned.no_available_space",
    };
    for (const char* known : ids)
        if (id == known)
            return true;
    return false;
}

static string _dcss_render_segment(const _dcss_display_segment& segment)
{
#if defined(__EMSCRIPTEN__) && !defined(USE_TILE_LOCAL)
    if (segment.id.empty() || segment.filtered)
        return segment.canonical; // Unconverted/raw or original fake-language mode.
    char text[512] = {};
    const int length = _dcss_known_canned_id(segment.id)
        ? dcss_host_startup_text(segment.id.c_str(), "{}", text, sizeof(text)) : -1;
    if (length <= 0 || length >= static_cast<int>(sizeof(text))
        || text[length] != '\0' || string(text, length).find('\0') != string::npos)
    {
        fprintf(stderr, "Native canned localization failed.\n");
        end(1, false, nullptr);
    }
    formatted_string fs = formatted_string::parse_string(
        "<" + colour_to_str(segment.colour) + ">" + string(text, length));
    if (segment.shout)
        fs.all_caps();
    else if (segment.capitalise)
        fs.capitalise();
    // Never rerun filter_lang: original fake-language filtering may draw RNG.
    return fs.to_colour_string();
#else
    return segment.canonical;
#endif
}
// END jrogue canned-native display v3

struct message_particle
{
    string text;        /// text of message (tagged string...)
    int repeats;        /// Number of times the message is in succession (x2)
    // Ephemeral source descriptors: intentionally absent from native serialization.
    string _dcss_id;
    int _dcss_colour = LIGHTGREY;
    bool _dcss_shout = false;
    bool _dcss_capitalise = false;
    bool _dcss_filtered = false;

    string pure_text() const
    {
        return formatted_string::parse_string(text).tostring();
    }

    string with_repeats() const
    {
        // TODO: colour the repeats indicator?
        string rep = "";
        if (repeats > 1)
            rep = make_stringf(" x%d", repeats);
        return text + rep;
    }

    string pure_text_with_repeats() const
    {
        string rep = "";
        if (repeats > 1)
            rep = make_stringf(" x%d", repeats);
        return pure_text() + rep;
    }

    /**
     * If this is followed by another message particle on the same line,
     * should there be a semicolon between them?
     */
    bool needs_semicolon() const
    {
        return repeats > 1 || !_ends_in_punctuation(pure_text());
    }
};

struct message_line
{
    msg_channel_type    channel;        // message channel
    int                 param;          // param for channel (god, enchantment)
    vector<message_particle> messages;  // a set of possibly-repeated messages
    int                 turn;
    bool                join;          /// may we merge this message w/others?
    // Restored rendering segments never replace original canonical particles.
    vector<_dcss_display_segment> _dcss_overlay;

    message_line() : channel(NUM_MESSAGE_CHANNELS), param(0), turn(-1),
                     join(true)
    {
    }

    message_line(string msg, msg_channel_type chan, int par, bool jn)
     : channel(chan), param(par), turn(you.num_turns)
    {
        messages = { { msg, 1 } };
        // Don't join long messages.
        join = jn && strwidth(last_msg().pure_text()) < 40;
    }

    // Constructor for restored messages.
    message_line(string text, msg_channel_type chan, int par, int trn)
     : channel(chan), param(par), messages({{ text, 1 }}), turn(trn),
       join(false)
    {
    }

    operator bool() const
    {
        return !messages.empty();
    }

    const message_particle& last_msg() const
    {
        return messages.back();
    }

    // Tries to condense the argument into this message.
    // Either *this needs to be an empty item, or it must be the
    // same as the argument.
    bool merge(const message_line& other)
    {
        if (! *this)
        {
            *this = other;
            return true;
        }
        if (!other)
            return true;


        if (crawl_state.game_is_arena())
            return false; // dangerous for hacky code (looks at EOL for '!'...)
        if (!Options.msg_condense_repeats)
            return false;
        if (other.channel != channel || other.param != param)
            return false;
        if (other.messages.size() > 1)
        {
            return false; // not gonna try to handle this complexity
                          // shouldn't come up...
        }

        if (Options.msg_condense_repeats
            && other.last_msg().text == last_msg().text)
        {
            // Keep canonical repeat decisions; never infer an ID for an untagged repeat.
            if (messages.back()._dcss_id != other.last_msg()._dcss_id
                || messages.back()._dcss_colour != other.last_msg()._dcss_colour
                || messages.back()._dcss_shout != other.last_msg()._dcss_shout
                || messages.back()._dcss_capitalise != other.last_msg()._dcss_capitalise
                || messages.back()._dcss_filtered != other.last_msg()._dcss_filtered)
                messages.back()._dcss_id.clear();
            if (!_dcss_overlay.empty()
                && !(_dcss_overlay.size() == 1
                     && _dcss_overlay[0].id == other.last_msg()._dcss_id
                     && _dcss_overlay[0].colour == other.last_msg()._dcss_colour
                     && _dcss_overlay[0].shout == other.last_msg()._dcss_shout
                     && _dcss_overlay[0].capitalise == other.last_msg()._dcss_capitalise
                     && _dcss_overlay[0].filtered == other.last_msg()._dcss_filtered))
                _dcss_overlay.clear();
            messages.back().repeats += other.last_msg().repeats;
            return true;
        }
        else if (Options.msg_condense_short
                 && turn == other.turn
                 && join && other.join
                 && _ends_in_punctuation(last_msg().pure_text())
                  == _ends_in_punctuation(other.last_msg().pure_text()))
            // punct check is a hack to avoid pickup messages merging with
            // combat on the same turn - should find a nicer heuristic
        {
            // "; " or " "?
            const int seplen = last_msg().needs_semicolon() ? 2 : 1;
            const int total_len = pure_len() + seplen + other.pure_len();
            if (total_len > (int)msgwin_line_length())
                return false;

            // merge in other's messages; they'll be delimited when printing.
            messages.insert(messages.end(),
                            other.messages.begin(), other.messages.end());
            return true;
        }

        return false;
    }

    /// What's the length of the actual combined text of the particles, not
    /// including non-rendering text (<red> etc)?
    int pure_len() const
    {
        // could we do this more functionally?
        int len = 0;
        for (auto &msg : messages)
        {
            if (len > 0) // not first msg
                len += msg.needs_semicolon() ? 2 : 1; // " " vs "; "
            len += strwidth(msg.pure_text_with_repeats());
        }
        return len;
    }

    /// The full string, with elements joined as appropriate.
    string full_text() const
    {
        string text = "";
        bool needs_semicolon = false;
        for (auto &msg : messages)
        {
            if (!text.empty())
            {
                text += make_stringf("<lightgrey>%s </lightgrey>",
                                     needs_semicolon ? ";" : "");
            }
            text += msg.with_repeats();
            needs_semicolon = msg.needs_semicolon();
        }
        return text;
    }

    vector<_dcss_display_segment> _dcss_segments() const
    {
        vector<_dcss_display_segment> result;
        if (!_dcss_overlay.empty() && messages.size() == 1)
        {
            result = _dcss_overlay;
            if (messages[0].repeats > 1)
                result.push_back({make_stringf(" x%d", messages[0].repeats), ""});
            return result;
        }
        bool previous_semicolon = false;
        for (const auto& particle : messages)
        {
            if (!result.empty())
                result.push_back({make_stringf("<lightgrey>%s </lightgrey>",
                                              previous_semicolon ? ";" : ""), ""});
            result.push_back({particle.text, particle._dcss_id, particle._dcss_colour,
                              particle._dcss_shout, particle._dcss_capitalise,
                              particle._dcss_filtered});
            if (particle.repeats > 1)
                result.push_back({make_stringf(" x%d", particle.repeats), ""});
            previous_semicolon = particle.needs_semicolon();
        }
        return result;
    }

    string _dcss_display_text() const
    {
        string result;
        for (const auto& segment : _dcss_segments())
            result += _dcss_render_segment(segment);
        return result;
    }

    string pure_text_with_repeats() const
    {
        return formatted_string::parse_string(full_text()).tostring();
    }
};

static int _mod(int num, int denom)
{
    ASSERT(denom > 0);
    div_t res = div(num, denom);
    return res.rem >= 0 ? res.rem : res.rem + denom;
}

template <typename T, int SIZE>
class circ_vec
{
    T data[SIZE];

    int end;   // first unfilled index
    bool has_circled;
    // TODO: properly track the tail, and make this into a real data
    // structure with an iterator and whatnot

    static void inc(int* index)
    {
        ASSERT_RANGE(*index, 0, SIZE);
        *index = _mod(*index + 1, SIZE);
    }

    static void dec(int* index)
    {
        ASSERT_RANGE(*index, 0, SIZE);
        *index = _mod(*index - 1, SIZE);
    }

public:
    circ_vec() : end(0), has_circled(false) {}

    void clear()
    {
        end = 0;
        has_circled = false;
        for (int i = 0; i < SIZE; ++i)
            data[i] = T();
    }

    int size() const
    {
        return SIZE;
    }

    int filled_size() const
    {
        if (has_circled)
            return SIZE;
        else
            return end;
    }

    T& operator[](int i)
    {
        ASSERT(_mod(i, SIZE) < size());
        return data[_mod(end + i, SIZE)];
    }

    const T& operator[](int i) const
    {
        ASSERT(_mod(i, SIZE) < size());
        return data[_mod(end + i, SIZE)];
    }

    void push_back(const T& item)
    {
        data[end] = item;
        inc(&end);
        if (end == 0)
            has_circled = true;
    }

    void roll_back(int n)
    {
        for (int i = 0; i < n; ++i)
        {
            dec(&end);
            data[end] = T();
        }
        // don't bother to worry about has_circled in this case
        // TODO: properly track the tail
    }

    /**
     * Append the contents of `buf` to the current buffer.
     * If `buf` has cycled, this will overwrite the entire contents of `this`.
     */
    void append(const circ_vec<T, SIZE> buf)
    {
        const int buf_size = buf.filled_size();
        for (int i = 0; i < buf_size; i++)
            push_back(buf[i - buf_size]);
    }
};

static void readkey_more(bool user_forced=false);

// Types of message prefixes.
// Higher values override lower.
enum class prefix_type
{
    none,
    turn_start,
    turn_end,
    new_cmd, // new command, but no new turn
    new_turn,
    full_more,   // single-character more prompt (full window)
    other_more,  // the other type of --more-- prompt
};

// Could also go with coloured glyphs.
static cglyph_t _prefix_glyph(prefix_type p)
{
    cglyph_t g;
    switch (p)
    {
    case prefix_type::turn_start:
        g.ch = Options.show_newturn_mark ? '-' : ' ';
        g.col = LIGHTGRAY;
        break;
    case prefix_type::turn_end:
    case prefix_type::new_turn:
        g.ch = Options.show_newturn_mark ? '_' : ' ';
        g.col = LIGHTGRAY;
        break;
    case prefix_type::new_cmd:
        g.ch = Options.show_newturn_mark ? '_' : ' ';
        g.col = DARKGRAY;
        break;
    case prefix_type::full_more:
        g.ch = '+';
        g.col = channel_to_colour(MSGCH_PROMPT);
        break;
    case prefix_type::other_more:
        g.ch = '+';
        g.col = LIGHTRED;
        break;
    default:
        g.ch = ' ';
        g.col = LIGHTGRAY;
        break;
    }
    return g;
}

static bool _pre_more();

static bool _temporary = false;

class message_window
{
    int next_line;
    int temp_line;     // starting point of temporary messages
    int input_line;    // last line-after-input
    vector<formatted_string> lines;
    vector<formatted_string> _dcss_display_lines; // Pure rendering; controls use lines.
    prefix_type prompt; // current prefix prompt

    int height() const
    {
        return crawl_view.msgsz.y;
    }

    int use_last_line() const
    {
        return first_col_more();
    }

    int width() const
    {
        return crawl_view.msgsz.x;
    }

    void out_line(const formatted_string& line, const formatted_string& display, int n) const
    {
        const formatted_string& visible = _dcss_restore_display_hold ? line : display;
        cgotoxy(1, n + 1, GOTO_MSG);
        visible.display();
        cprintf("%*s", max(0, width() - visible.width()), "");
    }

    // Place cursor at end of last non-empty line to handle prompts.
    // TODO: might get rid of this by clearing the whole window when writing,
    //       and then just writing the actual non-empty lines.
    void place_cursor()
    {
        // XXX: the screen may have resized since the last time we
        //  called lines.resize(). Consider only the last height()
        //  lines if this has happened.
        const int diff = max(int(lines.size()) - height(), 0);

        int i;
        for (i = lines.size() - 1; i >= diff && lines[i].width() == 0; --i)
            ;
        if (i >= diff)
        {
            // If there was room, put the cursor at the end of that line.
            // Otherwise, put it at the beginning of the next line.
            if ((int) lines[i].width() < crawl_view.msgsz.x)
                cgotoxy(lines[i].width() + 1, i - diff + 1, GOTO_MSG);
            else if (i - diff + 2 <= height())
                cgotoxy(1, i - diff + 2, GOTO_MSG);
            else
            {
                // Scroll to make room for the next line, then redraw.
                scroll(1);
                // Results in a recursive call to place_cursor!  But scroll()
                // made lines[height()] empty, so that recursive call shouldn't
                // hit this case again.
                show();
                return;
            }
        }
        else
        {
            // If there were no lines, put the cursor at the upper left.
            cgotoxy(1, 1, GOTO_MSG);
        }
    }

    // Whether to show msgwin-full more prompts.
    bool more_enabled() const
    {
        return crawl_state.show_more_prompt
               && (Options.clear_messages || Options.show_more);
    }

    int make_space(int n)
    {
        int space = out_height() - next_line;

        if (space >= n)
            return 0;

        int s = 0;
        if (input_line > 0)
        {
            s = min(input_line, n - space);
            scroll(s);
            space += s;
        }

        if (space >= n)
            return s;

        if (more_enabled())
            more(true);

        // We could consider just scrolling off after --more--;
        // that would require marking the last message before
        // the prompt.
        if (!Options.clear_messages && !more_enabled())
        {
            scroll(n - space);
            return s + n - space;
        }
        else
        {
            clear();
            return height();
        }
    }

    void add_line(const formatted_string& line, const formatted_string& display)
    {
        resize(); // TODO: get rid of this
        lines[next_line] = line;
        _dcss_display_lines[next_line] = display;
        next_line++;
    }

    void output_prefix(prefix_type p)
    {
        if (!use_first_col())
            return;
        if (p <= prompt)
            return;
        prompt = p;
        if (next_line > 0)
        {
            formatted_string line;
            line.add_glyph(_prefix_glyph(prompt));
            lines[next_line-1].del_char();
            line += lines[next_line-1];
            lines[next_line-1] = line;
            formatted_string display;
            display.add_glyph(_prefix_glyph(prompt));
            _dcss_display_lines[next_line-1].del_char();
            display += _dcss_display_lines[next_line-1];
            _dcss_display_lines[next_line-1] = display;
        }
        show();
    }

public:
    message_window()
        : next_line(0), temp_line(0), input_line(0), prompt(prefix_type::none)
    {
        clear_lines(); // initialize this->lines
    }

    void resize()
    {
        // if this is resized to 0, bad crashes will happen. N.b. I have no idea
        // if this issue is what the following note is about:
        // XXX: broken (why?)
        lines.resize(max(height(), 1));
        _dcss_display_lines.resize(max(height(), 1));
    }

    unsigned int out_width() const
    {
        return width() - (use_first_col() ? 1 : 0);
    }

    unsigned int out_height() const
    {
        return height() - (use_last_line() ? 0 : 1);
    }

    void clear_lines()
    {
        lines.clear();
        lines.resize(height());
        _dcss_display_lines.clear();
        _dcss_display_lines.resize(height());
    }

    bool first_col_more() const
    {
        return Options.small_more;
    }

    bool use_first_col() const
    {
        return !Options.clear_messages;
    }

    void set_starting_line()
    {
        // TODO: start at end (sometimes?)
        next_line = 0;
        input_line = 0;
        temp_line = 0;
    }

    void clear()
    {
        clear_lines();
        set_starting_line();
        show();
    }

    void scroll(int n)
    {
        // We might be asked to scroll off everything by the line reader.
        if (next_line < n)
            n = next_line;

        int i;
        for (i = 0; i < height() - n; ++i)
        {
            lines[i] = lines[i + n];
            _dcss_display_lines[i] = _dcss_display_lines[i + n];
        }
        for (; i < height(); ++i)
        {
            lines[i].clear();
            _dcss_display_lines[i].clear();
        }
        next_line -= n;
        temp_line -= n;
        input_line -= n;
    }

    // write to screen (without refresh)
    void show()
    {
        // skip if there is no layout yet
        if (width() <= 0)
            return;

        // XXX: this should not be necessary as formatted_string should
        //      already do it
        textcolour(LIGHTGREY);

        // XXX: the screen may have resized since the last time we
        //  called lines.resize(). Consider only the last height()
        //  lines if this has happened.
        const int diff = max(int(lines.size()) - height(), 0);

        for (size_t i = diff; i < lines.size(); ++i)
            out_line(lines[i], _dcss_display_lines[i], i - diff);
        place_cursor();
#ifdef USE_TILE
        tiles.set_need_redraw();
#endif
    }

    // temporary: to be overwritten with next item, e.g. new turn
    //            leading dash or prompt without response
    void add_item(string text, prefix_type first_col = prefix_type::none,
                  bool temporary = false, string display_text = "")
    {
        prompt = prefix_type::none; // reset prompt
        if (display_text.empty())
            display_text = text;

        vector<formatted_string> newlines;
        linebreak_string(text, out_width());
        formatted_string::parse_string_to_multiple(text, newlines);
        // Only canonical rows drive make_space/more/scroll/input decisions.
        vector<formatted_string> display_rows;
        linebreak_string(display_text, out_width());
        formatted_string::parse_string_to_multiple(display_text, display_rows);
        if (display_rows.size() > newlines.size() && !newlines.empty())
        {
            display_rows.resize(newlines.size());
            display_rows.back() = display_rows.back().chop(max(0, int(out_width()) - 3));
            display_rows.back() += formatted_string("...", LIGHTMAGENTA);
        }
        display_rows.resize(newlines.size());
        size_t display_row = 0;

        for (const formatted_string &nl : newlines)
        {
            make_space(1);
            formatted_string line;
            if (use_first_col())
                line.add_glyph(_prefix_glyph(first_col));
            line += nl;
            formatted_string display;
            if (use_first_col())
                display.add_glyph(_prefix_glyph(first_col));
            display += display_rows[display_row++];
            add_line(line, display);
        }

        if (!temporary)
            reset_temp();

        show();
    }

    void roll_back()
    {
        temp_line = max(temp_line, 0);
        for (int i = temp_line; i < next_line; ++i)
        {
            lines[i].clear();
            _dcss_display_lines[i].clear();
        }
        next_line = temp_line;
    }

    /**
     * Consider any formerly-temporary messages permanent.
     */
    void reset_temp()
    {
        temp_line = next_line;
    }

    void got_input()
    {
        input_line = next_line;
    }

    void new_cmdturn(bool new_turn)
    {
        output_prefix(new_turn ? prefix_type::new_turn : prefix_type::new_cmd);
    }

    bool any_messages()
    {
        return next_line > input_line;
    }

    /*
     * Handling of more prompts (both types).
     */
    void more(bool full, bool user=false)
    {
        rng::generator rng(rng::UI);

        if (_pre_more())
            return;

        if (you.running)
        {
            mouse_control mc(MOUSE_MODE_MORE);
            redraw_screen();
            update_screen();
        }
        else
        {
            print_stats();
            update_screen();
            show();
        }

        if (user)
            flush_input_buffer(FLUSH_FORCE_MORE);

        int last_row = crawl_view.msgsz.y;
        if (first_col_more())
        {
            cgotoxy(1, last_row, GOTO_MSG);
            cglyph_t g = _prefix_glyph(full ? prefix_type::full_more : prefix_type::other_more);
            formatted_string f;
            f.add_glyph(g);
            f.display();
            // Move cursor back for nicer display.
            cgotoxy(1, last_row, GOTO_MSG);
            // Need to read_key while cursor_control in scope.
            cursor_control con(true);
            readkey_more();
        }
        else
        {
            cgotoxy(use_first_col() ? 2 : 1, last_row, GOTO_MSG);
            textcolour(channel_to_colour(MSGCH_PROMPT));
            if (crawl_state.game_is_hints())
            {
                string more_str = "--more-- Press Space ";
                if (is_tiles())
                    more_str += "or click ";
                more_str += "to continue. You can later reread messages with "
                            "Ctrl-P.";
                cprintf(more_str.c_str());
            }
            else
                cprintf("--more--");

            readkey_more(user);
        }
    }
};

message_window msgwin;

void display_message_window()
{
    msgwin.show();
}

void clear_message_window()
{
    msgwin = message_window();
}

void scroll_message_window(int n)
{
    msgwin.scroll(n);
    msgwin.show();
}

bool any_messages()
{
    return msgwin.any_messages();
}

typedef circ_vec<message_line, NUM_STORED_MESSAGES> store_t;

class message_store
{
    store_t msgs;
    message_line prev_msg;
    bool last_of_turn;
    int temp; // number of temporary messages

#ifdef USE_TILE_WEB
    int unsent; // number of messages not yet sent to the webtiles client
    int client_rollback;
    bool send_ignore_one;
#endif

public:
    message_store() : last_of_turn(false), temp(0)
#ifdef USE_TILE_WEB
                      , unsent(0), client_rollback(0), send_ignore_one(false)
#endif
    {}

    void add(const message_line& msg)
    {
        string orig_full_text = msg.full_text();

        if (!(msg.channel != MSGCH_PROMPT && prev_msg.merge(msg)))
        {
            flush_prev();
            prev_msg = msg;
            if (msg.channel == MSGCH_PROMPT || _temporary)
                flush_prev();
            }

            // If we play sound, wait until the corresponding message is printed
            // in case we intend on holding up output that comes after.
            //
            // FIXME This doesn't work yet, and causes the game to play the sound,
            // THEN display the text. This appears to only be solvable by reworking
            // the way the game outputs messages, as the game it prints messages
            // one line at a time, not one message at a time.
            //
            // However, it should only print one message at a time when it really
            // needs to, i.e. an sound that interrupts the game. Otherwise it is
            // more efficient to print text together.
#ifdef USE_SOUND
            play_sound(check_sound_patterns(orig_full_text));
#endif
    }

    void store_msg(const message_line& msg, const vector<_dcss_display_segment>* preview = nullptr)
    {
        prefix_type p = prefix_type::none;
        msgs.push_back(msg);
        if (_temporary)
            temp++;
        else
            reset_temp();
#ifdef USE_TILE_WEB
        // ignore this message until it's actually displayed in case we run out
        // of space and have to display --more-- instead
        unwind_bool dontsend(send_ignore_one, true);
#endif
        if (crawl_state.io_inited && crawl_state.game_started)
        {
            message_line render_msg = msg;
            if (preview)
                render_msg._dcss_overlay = *preview;
            msgwin.add_item(msg.full_text(), p, _temporary, render_msg._dcss_display_text());
        }
    }

    void roll_back()
    {
#ifdef USE_TILE_WEB
        client_rollback = max(0, temp - unsent);
        unsent = max(0, unsent - temp);
#endif
        msgs.roll_back(temp);
        temp = 0;
    }

    void reset_temp()
    {
        temp = 0;
    }

    void flush_prev()
    {
        if (!prev_msg)
            return;
        message_line msg = prev_msg;
        // Clear prev_msg before storing it, since
        // writing out to the message window might
        // in turn result in a recursive flush_prev.
        prev_msg = message_line();
#ifdef USE_TILE_WEB
        unsent++;
#endif
        store_msg(msg);
        if (last_of_turn)
        {
            msgwin.new_cmdturn(true);
            last_of_turn = false;
        }
    }

    void new_turn()
    {
        if (prev_msg)
            last_of_turn = true;
        else
            msgwin.new_cmdturn(true);
    }

    // XXX: this should not need to exist
    const store_t& get_store()
    {
        return msgs;
    }

    void append_store(store_t store)
    {
        msgs.append(store);
        const int msgs_to_print = store.filled_size();
#ifdef USE_TILE_WEB
        unwind_bool dontsend(send_ignore_one, true);
#endif
        for (int i = 0; i < msgs_to_print; i++)
            msgwin.add_item(msgs[i - msgs_to_print].full_text(), prefix_type::none, false,
                            msgs[i - msgs_to_print]._dcss_display_text());
    }

    void _dcss_apply_restore_overlays(const vector<vector<_dcss_display_segment>>& pending)
    {
#if defined(__EMSCRIPTEN__) && !defined(USE_TILE_LOCAL)
        const int count = msgs.filled_size();
        if (pending.size() < size_t(count))
        {
            fprintf(stderr, "Native history overlay count failed.\n");
            end(1, false, nullptr);
        }
        const size_t offset = pending.size() - count;
        // Verify the entire set before mutating even one private stored overlay.
        for (int index = 0; index < count; ++index)
        {
            string canonical;
            for (const auto& segment : pending[offset + index])
                canonical += segment.canonical;
            if (!pending[offset + index].empty()
                && canonical != msgs[index - count].full_text())
            {
                fprintf(stderr, "Native history overlay set coherence failed.\n");
                end(1, false, nullptr);
            }
        }
        for (int index = 0; index < count; ++index)
            msgs[index - count]._dcss_overlay = pending[offset + index];
#else
        (void)pending;
#endif
    }

    void clear()
    {
        msgs.clear();
        prev_msg = message_line();
        last_of_turn = false;
        temp = 0;
#ifdef USE_TILE_WEB
        unsent = 0;
#endif
    }

#ifdef USE_TILE_WEB
    void send()
    {
        if (unsent == 0 || (send_ignore_one && unsent == 1))
            return;

        if (client_rollback > 0)
        {
            tiles.json_write_int("rollback", client_rollback);
            client_rollback = 0;
        }
        tiles.json_open_array("messages");
        for (int i = -unsent; i < (send_ignore_one ? -1 : 0); ++i)
        {
            message_line& msg = msgs[i];
            tiles.json_open_object();
            tiles.json_write_string("text", msg.full_text());
            tiles.json_write_int("turn", msg.turn);
            tiles.json_write_int("channel", msg.channel);
            tiles.json_close_object();
        }
        tiles.json_close_array();
        unsent = send_ignore_one ? 1 : 0;
    }
#endif
};

// Circular buffer for keeping past messages.
message_store buffer;

#ifdef USE_TILE_WEB
bool _more = false, _last_more = false;

void webtiles_send_messages()
{
    // defer sending any messages to client in this form until a game is
    // started up. It's still possible to send them as a popup. When this is
    // eventually called, it'll send any queued messages.
    if (!crawl_state.io_inited || !crawl_state.game_started)
        return;
    tiles.json_open_object();
    tiles.json_write_string("msg", "msgs");
    tiles.json_treat_as_empty();
    if (_more != _last_more)
    {
        tiles.json_write_bool("more", _more);
        _last_more = _more;
    }
    buffer.send();
    tiles.json_close_object(true);
    tiles.finish_message();
}

void webtiles_send_more_text(string txt)
{
    if (!crawl_state.io_inited || !crawl_state.game_started)
        return;
    tiles.json_open_object();
    tiles.json_write_string("msg", "msgs");
    tiles.json_treat_as_empty();
    tiles.json_write_bool("more", txt.size());
    tiles.json_write_string("more_text", txt);
    tiles.json_close_object(true);
    tiles.finish_message();
}

#else
void webtiles_send_more_text(string) { }
#endif

static FILE* _msg_dump_file = nullptr;

static msg_colour_type prepare_message(const string& imsg,
                                       msg_channel_type channel,
                                       int param,
                                       bool allow_suppress=true);


namespace msg
{
    static bool suppress_messages = false;
    static unordered_set<tee *> current_message_tees;
    static maybe_bool _msgs_to_stderr = maybe_bool::maybe;

    static bool _suppressed()
    {
        return suppress_messages;
    }

    /**
     * RAII logic for controlling echoing to stderr.
     * @param f the new state:
     *   true: always echo to stderr (mainly used for debugging)
     *   maybe_bool::maybe: use default logic, based on mode, io state, etc
     *   false: never echo to stderr (for suppressing error echoing during
     *             startup, e.g. for first-pass initfile processing)
     */
    force_stderr::force_stderr(maybe_bool f)
        : prev_state(_msgs_to_stderr)
    {
        _msgs_to_stderr = f;
    }

    force_stderr::~force_stderr()
    {
        _msgs_to_stderr = prev_state;
    }


    bool uses_stderr(msg_channel_type channel)
    {
        if (_msgs_to_stderr.is_bool())
            return bool(_msgs_to_stderr);

        // else, maybe_bool::maybe:

        if (channel == MSGCH_ERROR)
        {
            return !crawl_state.io_inited // one of these is not like the others
                || crawl_state.test || crawl_state.script
                || crawl_state.build_db
                || crawl_state.map_stat_gen || crawl_state.obj_stat_gen;
        }
        return false;
    }

    tee::tee()
        : target(nullptr)
    {
        current_message_tees.insert(this);
    }

    tee::tee(string &_target)
        : target(&_target)
    {
        current_message_tees.insert(this);
    }

    void tee::force_update()
    {
        if (target)
            *target += get_store();
        store.clear();
    }

    tee::~tee()
    {
        force_update();
        current_message_tees.erase(this);
    }

    void tee::append(const string &s, msg_channel_type /*ch*/)
    {
        // could use a more c++y external interface -- but that just complicates things
        store << s;
    }

    void tee::append_line(const string &s, msg_channel_type ch)
    {
        append(s + "\n", ch);
    }

    string tee::get_store() const
    {
        return store.str();
    }

    static void _append_to_tees(const string &s, msg_channel_type ch)
    {
        for (auto tee : current_message_tees)
            tee->append(s, ch);
    }

    suppress::suppress()
        : msuppressed(suppress_messages),
          channel(NUM_MESSAGE_CHANNELS),
          prev_colour(MSGCOL_NONE)
    {
        suppress_messages = true;
    }

    // Push useful RAII conditional logic into a constructor
    // Won't override an outer suppressing msg::suppress
    suppress::suppress(bool really_suppress)
        : msuppressed(suppress_messages),
          channel(NUM_MESSAGE_CHANNELS),
          prev_colour(MSGCOL_NONE)
    {
        suppress_messages = suppress_messages || really_suppress;
    }

    // Mute just one channel. Mainly useful for hiding debug spam in various
    // circumstances.
    suppress::suppress(msg_channel_type _channel)
        : msuppressed(suppress_messages),
          channel(_channel),
          prev_colour(Options.channels[channel])
    {
        // don't change global suppress_messages for this case
        ASSERT(channel < NUM_MESSAGE_CHANNELS);
        Options.channels[channel] = MSGCOL_MUTED;
    }

    suppress::~suppress()
    {
        suppress_messages = msuppressed;
        if (channel < NUM_MESSAGE_CHANNELS)
            Options.channels[channel] = prev_colour;
    }
}

msg_colour_type msg_colour(int col)
{
    return static_cast<msg_colour_type>(col);
}

static int colour_msg(msg_colour_type col)
{
    if (col == MSGCOL_MUTED)
        return DARKGREY;
    else
        return static_cast<int>(col);
}

// Returns a colour or MSGCOL_MUTED.
static msg_colour_type channel_to_msgcol(msg_channel_type channel, int param)
{
    msg_colour_type ret;

    switch (Options.channels[channel])
    {
    case MSGCOL_PLAIN:
        // Note that if the plain channel is muted, then we're protecting
        // the player from having that spread to other channels here.
        // The intent of plain is to give non-coloured messages, not to
        // suppress them.
        if (Options.channels[MSGCH_PLAIN] >= MSGCOL_DEFAULT)
            ret = MSGCOL_LIGHTGREY;
        else
            ret = Options.channels[MSGCH_PLAIN];
        break;

    case MSGCOL_DEFAULT:
    case MSGCOL_ALTERNATE:
        switch (channel)
        {
        case MSGCH_GOD:
            ret = (Options.channels[channel] == MSGCOL_DEFAULT)
                   ? msg_colour(god_colour(static_cast<god_type>(param)))
                   : msg_colour(god_message_altar_colour(static_cast<god_type>(param)));
            break;

        case MSGCH_DURATION:
            ret = MSGCOL_LIGHTBLUE;
            break;

        case MSGCH_DANGER:
            ret = MSGCOL_RED;
            break;

        case MSGCH_WARN:
        case MSGCH_ERROR:
            ret = MSGCOL_LIGHTRED;
            break;

        case MSGCH_INTRINSIC_GAIN:
            ret = MSGCOL_GREEN;
            break;

        case MSGCH_RECOVERY:
            ret = MSGCOL_LIGHTGREEN;
            break;

        case MSGCH_TALK:
        case MSGCH_TALK_VISUAL:
        case MSGCH_HELL_EFFECT:
            ret = MSGCOL_WHITE;
            break;

        case MSGCH_MUTATION:
        case MSGCH_MONSTER_WARNING:
            ret = MSGCOL_LIGHTRED;
            break;

        case MSGCH_MONSTER_SPELL:
        case MSGCH_MONSTER_ENCHANT:
        case MSGCH_FRIEND_SPELL:
        case MSGCH_FRIEND_ENCHANT:
            ret = MSGCOL_LIGHTMAGENTA;
            break;

        case MSGCH_TUTORIAL:
        case MSGCH_ORB:
        case MSGCH_BANISHMENT:
            ret = MSGCOL_MAGENTA;
            break;

        case MSGCH_MONSTER_DAMAGE:
            ret =  ((param == MDAM_DEAD)               ? MSGCOL_RED :
                    (param >= MDAM_SEVERELY_DAMAGED)   ? MSGCOL_LIGHTRED :
                    (param >= MDAM_MODERATELY_DAMAGED) ? MSGCOL_YELLOW
                                                       : MSGCOL_LIGHTGREY);
            break;

        case MSGCH_PROMPT:
            ret = MSGCOL_CYAN;
            break;

        case MSGCH_DIAGNOSTICS:
        case MSGCH_MULTITURN_ACTION:
        case MSGCH_DECOR_FLAVOUR:
        case MSGCH_MONSTER_TIMEOUT:
            ret = MSGCOL_DARKGREY; // makes it easier to ignore at times -- bwr
            break;

        case MSGCH_PLAIN:
        case MSGCH_FRIEND_ACTION:
        case MSGCH_EQUIPMENT:
        case MSGCH_EXAMINE:
        case MSGCH_EXAMINE_FILTER:
        case MSGCH_DGL_MESSAGE:
        default:
            ret = param > 0 ? msg_colour(param) : MSGCOL_LIGHTGREY;
            break;
        }
        break;

    case MSGCOL_MUTED:
        ret = MSGCOL_MUTED;
        break;

    default:
        // Setting to a specific colour is handled here, special
        // cases should be handled above.
        if (channel == MSGCH_MONSTER_DAMAGE)
        {
            // A special case right now for monster damage (at least until
            // the init system is improved)... selecting a specific
            // colour here will result in only the death messages coloured.
            if (param == MDAM_DEAD)
                ret = Options.channels[channel];
            else if (Options.channels[MSGCH_PLAIN] >= MSGCOL_DEFAULT)
                ret = MSGCOL_LIGHTGREY;
            else
                ret = Options.channels[MSGCH_PLAIN];
        }
        else
            ret = Options.channels[channel];
        break;
    }

    return ret;
}

int channel_to_colour(msg_channel_type channel, int param)
{
    return colour_msg(channel_to_msgcol(channel, param));
}

void do_message_print(msg_channel_type channel, int param, bool cap,
                             bool nojoin, const char *format, va_list argp)
{
    va_list ap;
    va_copy(ap, argp);
    char buff[200];
    size_t len = vsnprintf(buff, sizeof(buff), format, argp);
    if (len < sizeof(buff))
        _mpr(buff, channel, param, nojoin, cap);
    else
    {
        char *heapbuf = (char*)malloc(len + 1);
        vsnprintf(heapbuf, len + 1, format, ap);
        _mpr(heapbuf, channel, param, nojoin, cap);
        free(heapbuf);
    }
    va_end(ap);
}

void mprf_nocap(msg_channel_type channel, int param, const char *format, ...)
{
    va_list argp;
    va_start(argp, format);
    do_message_print(channel, param, false, false, format, argp);
    va_end(argp);
}

void mprf_nocap(msg_channel_type channel, const char *format, ...)
{
    va_list argp;
    va_start(argp, format);
    do_message_print(channel, channel == MSGCH_GOD ? you.religion : 0,
                     false, false, format, argp);
    va_end(argp);
}

void mprf_nocap(const char *format, ...)
{
    va_list argp;
    va_start(argp, format);
    do_message_print(MSGCH_PLAIN, 0, false, false, format, argp);
    va_end(argp);
}

void mprf(msg_channel_type channel, int param, const char *format, ...)
{
    va_list argp;
    va_start(argp, format);
    do_message_print(channel, param, true, false, format, argp);
    va_end(argp);
}

void mprf(msg_channel_type channel, const char *format, ...)
{
    va_list argp;
    va_start(argp, format);
    do_message_print(channel, channel == MSGCH_GOD ? you.religion : 0,
                     true, false, format, argp);
    va_end(argp);
}

void mprf(const char *format, ...)
{
    va_list argp;
    va_start(argp, format);
    do_message_print(MSGCH_PLAIN, 0, true, false, format, argp);
    va_end(argp);
}

void mprf_nojoin(msg_channel_type channel, const char *format, ...)
{
    va_list argp;
    va_start(argp, format);
    do_message_print(channel, channel == MSGCH_GOD ? you.religion : 0,
                     true, true, format, argp);
    va_end(argp);
}

void mprf_nojoin(const char *format, ...)
{
    va_list argp;
    va_start(argp, format);
    do_message_print(MSGCH_PLAIN, 0, true, true, format, argp);
    va_end(argp);
}

#ifdef DEBUG_DIAGNOSTICS
void dprf(const char *format, ...)
{
    if (Options.quiet_debug_messages[DIAG_NORMAL] || you.suppress_wizard)
        return;

    va_list argp;
    va_start(argp, format);
    do_message_print(MSGCH_DIAGNOSTICS, 0, false, false, format, argp);
    va_end(argp);
}

void dprf(diag_type param, const char *format, ...)
{
    if (Options.quiet_debug_messages[param] || you.suppress_wizard)
        return;

    va_list argp;
    va_start(argp, format);
    do_message_print(MSGCH_DIAGNOSTICS, param, false, false, format, argp);
    va_end(argp);
}
#endif

static bool _check_option(const string& line, msg_channel_type channel,
                          const vector<message_filter>& option)
{
    if (crawl_state.generating_level)
        return false;
    return any_of(begin(option),
                  end(option),
                  bind(mem_fn(&message_filter::is_filtered),
                       placeholders::_1, channel, line));
}

static bool _check_more(const string& line, msg_channel_type channel)
{
    // Try to avoid mores during level excursions, they are glitchy at best.
    // TODO: this is sort of an emergency check, possibly it should
    // crash here in order to find the real bug?
    if (!you.on_current_level)
        return false;
    return _check_option(line, channel, Options.force_more_message);
}

static bool _check_flash_screen(const string& line, msg_channel_type channel)
{
    // absolutely never flash during a level excursion, things will go very
    // badly. TODO: this is sort of an emergency check, possibly it should
    // crash here in order to find the real bug?
    if (!you.on_current_level)
        return false;
    return _check_option(line, channel, Options.flash_screen_message);
}

static bool _check_join(const string& /*line*/, msg_channel_type channel)
{
    switch (channel)
    {
    case MSGCH_EQUIPMENT:
        return false;
    default:
        break;
    }
    return true;
}

static void _debug_channel_arena(msg_channel_type channel)
{
    switch (channel)
    {
    case MSGCH_PROMPT:
    case MSGCH_GOD:
    case MSGCH_DURATION:
    case MSGCH_RECOVERY:
    case MSGCH_INTRINSIC_GAIN:
    case MSGCH_MUTATION:
    case MSGCH_EQUIPMENT:
    case MSGCH_FLOOR_ITEMS:
    case MSGCH_MULTITURN_ACTION:
    case MSGCH_EXAMINE:
    case MSGCH_EXAMINE_FILTER:
    case MSGCH_ORB:
    case MSGCH_TUTORIAL:
        die("Invalid channel '%s' in arena mode",
                 channel_to_str(channel).c_str());
        break;
    default:
        break;
    }
}

bool strip_channel_prefix(string &text, msg_channel_type &channel, bool silence)
{
    string::size_type pos = text.find(":");
    if (pos == string::npos)
        return false;

    string param = text.substr(0, pos);
    bool sound = false;

    if (param == "WARN")
        channel = MSGCH_WARN, sound = true;
    else if (param == "VISUAL WARN")
        channel = MSGCH_WARN;
    else if (param == "SOUND")
        channel = MSGCH_SOUND, sound = true;
    else if (param == "VISUAL")
        channel = MSGCH_TALK_VISUAL;
    else if (param == "SPELL")
        channel = MSGCH_MONSTER_SPELL, sound = true;
    else if (param == "VISUAL SPELL")
        channel = MSGCH_MONSTER_SPELL;
    else if (param == "ENCHANT")
        channel = MSGCH_MONSTER_ENCHANT, sound = true;
    else if (param == "VISUAL ENCHANT")
        channel = MSGCH_MONSTER_ENCHANT;
    else
    {
        param = replace_all(param, " ", "_");
        lowercase(param);
        int ch = str_to_channel(param);
        if (ch == -1)
            return false;
        channel = static_cast<msg_channel_type>(ch);
    }

    if (sound && silence)
        text = "";
    else
        text = text.substr(pos + 1);
    return true;
}

void msgwin_set_temporary(bool temp)
{
    flush_prev_message();
    _temporary = temp;
    if (!temp)
    {
        buffer.reset_temp();
        msgwin.reset_temp();
    }
}

msgwin_temporary_mode::msgwin_temporary_mode()
    : previous(_temporary)
{
    msgwin_set_temporary(true);
}

msgwin_temporary_mode::~msgwin_temporary_mode()
{
    // RAII behaviour: embedding instances of this class within each other
    // will only reset the mode once they are all cleared.
    msgwin_set_temporary(previous);
}

void msgwin_clear_temporary()
{
    buffer.roll_back();
    msgwin.roll_back();
}

static int _last_msg_turn = -1; // Turn of last message.

static void _mpr(string text, msg_channel_type channel, int param, bool nojoin,
                 bool cap)
{
    static bool _doing_c_message_hook = false;
    const char *_dcss_canned_id = _dcss_canned_take_pending();

    rng::generator rng(rng::UI);

    if (_msg_dump_file != nullptr)
        fprintf(_msg_dump_file, "%s\n", text.c_str()); // should this strip color tags?

    if (crawl_state.game_crashed)
        return;

    if (crawl_state.game_is_valid_type() && crawl_state.game_is_arena())
        _debug_channel_arena(channel);

#ifdef DEBUG_FATAL
    if (channel == MSGCH_ERROR)
        die_noline("%s", formatted_string::parse_string(text).tostring().c_str());
#endif

    if (msg::uses_stderr(channel))
        fprintf(stderr, "%s\n", formatted_string::parse_string(text).tostring().c_str());

    if (channel == MSGCH_GOD && param == 0)
        param = you.religion;

    // Ugly hack.
    if (channel == MSGCH_DIAGNOSTICS || channel == MSGCH_ERROR)
        cap = false;

    // if the message would be muted, handle any tees before bailing. The
    // actual color for MSGCOL_MUTED ends up as darkgrey in any tees.
    msg_colour_type colour = prepare_message(text, channel, param);

    string col = colour_to_str(colour_msg(colour));
    // lack of a closing tag is intentional: this is a valid color string and
    // makes fewer assumptions about `text` this way.
    // TODO: this doesn't override any opening color in `text`...
    text = "<" + col + ">" + text; // XXX

    msg::_append_to_tees(text + "\n", channel);

    if (colour == MSGCOL_MUTED && crawl_state.io_inited)
    {
        if (channel == MSGCH_PROMPT)
            msgwin.show();
        return;
    }

    // TODO: running this hook from here is still pretty crazy, maybe it should
    // be batched and done in the main game loop? But doing it this way at least
    // does let us directly detect recursion.
    if (!_doing_c_message_hook)
    {
        unwind_bool no_reentry(_doing_c_message_hook, true);
        clua.callfn("c_message", "ss", text.c_str(),
                                        channel_to_str(channel).c_str());
    }

    bool domore = _check_more(text, channel);
    bool do_flash_screen = _check_flash_screen(text, channel);
    bool join = !domore && !nojoin && _check_join(text, channel);

    // Must do this before converting to formatted string and back;
    // that doesn't preserve close tags!

    formatted_string fs = formatted_string::parse_string(text);

    // TODO: this kind of check doesn't really belong in logging code...
    const bool _dcss_canned_shout = you.duration[DUR_QUAD_DAMAGE] != 0;
    if (_dcss_canned_shout)
        fs.all_caps(); // No sound, so we simulate the reverb with all caps.
    else if (cap)
        fs.capitalise();
    if (channel != MSGCH_ERROR && channel != MSGCH_DIAGNOSTICS)
        fs.filter_lang();
    text = fs.to_colour_string();

    message_line msg = message_line(text, channel, param, join);
    if (_dcss_canned_id && !msg.messages.empty())
    {
        msg.messages[0]._dcss_id = _dcss_canned_id;
        msg.messages[0]._dcss_colour = colour_msg(colour) & 15;
        msg.messages[0]._dcss_shout = _dcss_canned_shout;
        msg.messages[0]._dcss_capitalise = cap;
        msg.messages[0]._dcss_filtered = !Options.fake_langs.empty();
    }
    buffer.add(msg);
    _dcss_canned_accepted(_dcss_canned_id, msg.turn,
                           static_cast<int>(msg.channel), msg.param,
                           colour_msg(colour) & 15, msg.join, nojoin,
                           domore, do_flash_screen, _dcss_canned_shout);

    if (!crawl_state.io_inited)
        return;

    _last_msg_turn = msg.turn;

    if (channel == MSGCH_ERROR)
        interrupt_activity(activity_interrupt::force);

    if (!crawl_state.parsing_rc
        && (channel == MSGCH_PROMPT || channel == MSGCH_ERROR))
    {
        set_more_autoclear(false);
    }

    if (domore)
        more(true);

    if (do_flash_screen)
        flash_view_delay(UA_ALWAYS_ON, YELLOW, 50);

}

static string show_prompt(string prompt)
{
    mprf(MSGCH_PROMPT, "%s", prompt.c_str());

    // FIXME: duplicating mpr code.
    msg_colour_type colour = prepare_message(prompt, MSGCH_PROMPT, 0);
    return colour_string(prompt, colour_msg(colour));
}

static string _prompt;
void msgwin_prompt(string prompt)
{
    msgwin_set_temporary(true);
    _prompt = show_prompt(prompt);
}

void msgwin_reply(string reply)
{
    msgwin_clear_temporary();
    msgwin_set_temporary(false);
    reply = replace_all(reply, "<", "<<");
    mprf(MSGCH_PROMPT, "%s<lightgrey>%s</lightgrey>", _prompt.c_str(), reply.c_str());
    msgwin.got_input();
}

void msgwin_got_input()
{
    msgwin.got_input();
}

int msgwin_get_line(string prompt, char *buf, int len,
                    input_history *mh, const string &fill)
{
    bool use_popup = !crawl_state.need_save || ui::has_layout();

    int ret;
    if (use_popup)
    {
        mouse_control mc(MOUSE_MODE_PROMPT);

        linebreak_string(prompt, 79);
        msg_colour_type colour = prepare_message(prompt, MSGCH_PROMPT, 0);
        const auto colour_prompt = formatted_string(prompt, colour_msg(colour));

        bool done = false;
        auto vbox = make_shared<ui::Box>(ui::Widget::VERT);
        auto popup = make_shared<ui::Popup>(vbox);

        vbox->add_child(make_shared<ui::Text>(colour_prompt + "\n"));

        auto input = make_shared<ui::TextEntry>();
        input->set_sync_id("input");
        input->set_text(fill);
        input->set_input_history(mh);
#ifndef USE_TILE_LOCAL
        input->max_size().width = 20;
#endif
        vbox->add_child(input);

        popup->on_hotkey_event([&](const ui::KeyEvent& ev) {
            const int lastch = ev.key();
            if (ui::key_exits_popup(lastch, false))
            {
                ret = CK_ESCAPE; // XX hardcoding
                return done = true;
            }
            switch (lastch)
            {
            case CK_ENTER:
                ret = 0;
                return done = true;
            default:
                return done = false;
            }
        });

#ifdef USE_TILE_WEB
        tiles.json_open_object();
        tiles.json_write_string("prompt", colour_prompt.to_colour_string(colour_msg(colour)));
        tiles.push_ui_layout("msgwin-get-line", 0);
        popup->on_layout_pop([](){ tiles.pop_ui_layout(); });
#endif
        ui::run_layout(std::move(popup), done, input);

        strncpy(buf, input->get_text().c_str(), len - 1);
        buf[len - 1] = '\0';
    }
    else
    {
        if (!prompt.empty())
            msgwin_prompt(prompt);
        ret = cancellable_get_line(buf, len, mh, nullptr, fill);
        msgwin_reply(buf);
    }

    return ret;
}

void msgwin_new_turn()
{
    buffer.new_turn();
}

void msgwin_new_cmd()
{
#ifndef USE_TILE_LOCAL
    if (crawl_state.smallterm)
        return;
#endif

    flush_prev_message();
    bool new_turn = (you.num_turns > _last_msg_turn);
    msgwin.new_cmdturn(new_turn);
}

unsigned int msgwin_line_length()
{
    return msgwin.out_width();
}

unsigned int msgwin_lines()
{
    return msgwin.out_height();
}

// mpr() an arbitrarily long list of strings without truncation or risk
// of overflow.
void mpr_comma_separated_list(const string &prefix,
                              const vector<string> &list,
                              const string &andc,
                              const string &comma,
                              const msg_channel_type channel,
                              const int param)
{
    string out = prefix;

    for (int i = 0, size = list.size(); i < size; i++)
    {
        out += list[i];

        if (size > 0 && i < (size - 2))
            out += comma;
        else if (i == (size - 2))
            out += andc;
        else if (i == (size - 1))
            out += ".";
    }
    _mpr(out, channel, param);
}

// Checks whether a given message contains patterns relevant for
// notes, stop_running or sounds and handles these cases.
static void mpr_check_patterns(const string& message,
                               msg_channel_type channel,
                               int param)
{
    if (crawl_state.generating_level)
        return;
    for (const text_pattern &pat : Options.note_messages)
    {
        if (channel == MSGCH_EQUIPMENT || channel == MSGCH_FLOOR_ITEMS
            || channel == MSGCH_MULTITURN_ACTION
            || channel == MSGCH_EXAMINE || channel == MSGCH_EXAMINE_FILTER
            || channel == MSGCH_TUTORIAL || channel == MSGCH_DGL_MESSAGE)
        {
            continue;
        }

        if (pat.matches(message))
        {
            take_note(Note(NOTE_MESSAGE, channel, param, message));
            break;
        }
    }

    if (channel != MSGCH_DIAGNOSTICS && channel != MSGCH_EQUIPMENT)
    {
        interrupt_activity(activity_interrupt::message,
                           channel_to_str(channel) + ":" + message);
    }
}

static bool channel_message_history(msg_channel_type channel)
{
    switch (channel)
    {
    case MSGCH_PROMPT:
    case MSGCH_EQUIPMENT:
    case MSGCH_EXAMINE_FILTER:
        return false;
    default:
        return true;
    }
}

// Returns the default colour of the message, or MSGCOL_MUTED if
// the message should be suppressed.
static msg_colour_type prepare_message(const string& imsg,
                                       msg_channel_type channel,
                                       int param,
                                       bool allow_suppress)
{
    if (allow_suppress && msg::_suppressed())
        return MSGCOL_MUTED;

    if (you.num_turns > 0 && silenced(you.pos())
        && (channel == MSGCH_SOUND || channel == MSGCH_TALK))
    {
        return MSGCOL_MUTED;
    }

    msg_colour_type colour = channel_to_msgcol(channel, param);

    if (colour != MSGCOL_MUTED)
        mpr_check_patterns(imsg, channel, param);

    if (!crawl_state.generating_level)
    {
        for (const message_colour_mapping &mcm : Options.message_colour_mappings)
        {
            if (mcm.valid() && mcm.message.is_filtered(channel, imsg))
            {
                colour = mcm.colour;
                break;
            }
        }
    }

    return colour;
}

void flush_prev_message()
{
    buffer.flush_prev();
}

void clear_messages(bool force)
{
    if (!crawl_state.io_inited)
        return;
    // Unflushed message will be lost with clear_messages,
    // so they shouldn't really exist, but some of the delay
    // code appears to do this intentionally.
    // ASSERT(!buffer.have_prev());
    flush_prev_message();

    msgwin.got_input(); // Consider old messages as read.

    // TODO: this doesn't seem to be implemented on webtiles?
    if (Options.clear_messages || force)
        msgwin.clear();

    // TODO: we could indicate indicate clear_messages with a different
    //       leading character than '-'.
}

static bool autoclear_more = false;

void set_more_autoclear(bool on)
{
    autoclear_more = on;
}

static void readkey_more(bool user_forced)
{
    if (autoclear_more)
        return;
    int keypress = 0;
#ifdef USE_TILE_WEB
    unwind_bool unwind_more(_more, true);
#endif
    mouse_control mc(MOUSE_MODE_MORE);

    do
    {
        keypress = getch_ck();
        if (keypress == CK_REDRAW)
        {
            redraw_screen();
            update_screen();
            continue;
        }
    }
    while (keypress != ' ' && keypress != '\r' && keypress != '\n'
           && keypress != CK_NUMPAD_ENTER
           && !key_is_escape(keypress)
           && (user_forced || keypress != CK_MOUSE_CLICK));

    if (key_is_escape(keypress))
        set_more_autoclear(true);
}

/**
 * more() preprocessing.
 *
 * @return Whether the more prompt should be skipped.
 */
static bool _pre_more()
{
    if (crawl_state.game_crashed || crawl_state.seen_hups)
        return true;

#ifdef DEBUG_DIAGNOSTICS
    if (you.running)
        return true;
#endif

    if (crawl_state.game_is_arena())
    {
        delay(Options.view_delay);
        return true;
    }

    if (crawl_state.is_replaying_keys())
        return true;

#ifdef WIZARD
    if (luaterp_running())
        return true;
#endif

    if (!crawl_state.show_more_prompt || msg::_suppressed())
        return true;

    return false;
}

void more(bool user_forced)
{
    rng::generator rng(rng::UI);

    if (!crawl_state.io_inited)
        return;
    flush_prev_message();
    msgwin.more(false, user_forced);
    clear_messages();
}

void canned_msg(canned_message_type which_message)
{
    switch (which_message)
    {
        case MSG_SOMETHING_APPEARS:
        {
            const bool _dcss_canned_at_feet = player_has_feet();
            _dcss_canned_print(_dcss_canned_at_feet ? "game.canned.something_appears.at_feet" : "game.canned.something_appears.before_you", [&]() {
                mprf("Something appears %s!",
                     _dcss_canned_at_feet ? "at your feet" : "before you");
            });
            break;
        }
        case MSG_NOTHING_HAPPENS:
            _dcss_canned_print("game.canned.nothing_happens", [&]() {
                mpr("Nothing appears to happen.");
            });
            break;
        case MSG_YOU_UNAFFECTED:
            _dcss_canned_print("game.canned.you_unaffected", [&]() {
                mpr("You are unaffected.");
            });
            break;
        case MSG_YOU_RESIST:
            _dcss_canned_print("game.canned.you_resist", [&]() {
                mpr("You resist.");
            });
            learned_something_new(HINT_YOU_RESIST);
            break;
        case MSG_YOU_PARTIALLY_RESIST:
            _dcss_canned_print("game.canned.you_partially_resist", [&]() {
                mpr("You partially resist.");
            });
            break;
        case MSG_TOO_BERSERK:
            _dcss_canned_print("game.canned.too_berserk", [&]() {
                mpr("You are too berserk!");
            });
            crawl_state.cancel_cmd_repeat();
            break;
        case MSG_TOO_CONFUSED:
            _dcss_canned_print("game.canned.too_confused", [&]() {
                mpr("You are too confused!");
            });
            break;
        case MSG_PRESENT_FORM:
            _dcss_canned_print("game.canned.present_form", [&]() {
                mpr("You can't do that in your present form.");
            });
            crawl_state.cancel_cmd_repeat();
            break;
        case MSG_NOTHING_CARRIED:
            _dcss_canned_print("game.canned.nothing_carried", [&]() {
                mpr("You aren't carrying anything.");
            });
            crawl_state.cancel_cmd_repeat();
            break;
        case MSG_CANNOT_DO_YET:
            _dcss_canned_print("game.canned.cannot_do_yet", [&]() {
                mpr("You can't do that yet.");
            });
            crawl_state.cancel_cmd_repeat();
            break;
        case MSG_OK:
            _dcss_canned_print("game.canned.ok", [&]() {
                mprf(MSGCH_PROMPT, "Okay, then.");
            });
            crawl_state.cancel_cmd_repeat();
            break;
        case MSG_UNTHINKING_ACT:
            _dcss_canned_print("game.canned.unthinking_act", [&]() {
                mpr("Why would you want to do that?");
            });
            crawl_state.cancel_cmd_repeat();
            break;
        case MSG_NOTHING_THERE:
            _dcss_canned_print("game.canned.nothing_there", [&]() {
                mpr("There's nothing there!");
            });
            crawl_state.cancel_cmd_repeat();
            break;
        case MSG_NOTHING_CLOSE_ENOUGH:
            _dcss_canned_print("game.canned.nothing_close_enough", [&]() {
                mpr("There's nothing close enough!");
            });
            crawl_state.cancel_cmd_repeat();
            break;
        case MSG_SPELL_FIZZLES:
            _dcss_canned_print("game.canned.spell_fizzles", [&]() {
                mpr("The spell fizzles.");
            });
            break;
        case MSG_HUH:
            _dcss_canned_print("game.canned.huh", [&]() {
                mprf(MSGCH_EXAMINE_FILTER, "Huh?");
            });
            crawl_state.cancel_cmd_repeat();
            break;
        case MSG_EMPTY_HANDED_ALREADY:
        case MSG_EMPTY_HANDED_NOW:
        {
            const char* when =
            (which_message == MSG_EMPTY_HANDED_ALREADY ? "already" : "now");
            if (you.has_mutation(MUT_NO_GRASPING))
                _dcss_canned_print(which_message == MSG_EMPTY_HANDED_ALREADY ? "game.canned.empty_handed_already.mouth" : "game.canned.empty_handed_now.mouth", [&]() {
                    mprf("Your mouth is %s empty.", when);
                });
            else if (you.has_usable_claws(true))
                _dcss_canned_print(which_message == MSG_EMPTY_HANDED_ALREADY ? "game.canned.empty_handed_already.claws" : "game.canned.empty_handed_now.claws", [&]() {
                    mprf("You are %s empty-clawed.", when);
                });
            else if (you.has_usable_tentacles(true))
                _dcss_canned_print(which_message == MSG_EMPTY_HANDED_ALREADY ? "game.canned.empty_handed_already.tentacles" : "game.canned.empty_handed_now.tentacles", [&]() {
                    mprf("You are %s empty-tentacled.", when);
                });
            else
                _dcss_canned_print(which_message == MSG_EMPTY_HANDED_ALREADY ? "game.canned.empty_handed_already.hands" : "game.canned.empty_handed_now.hands", [&]() {
                    mprf("You are %s empty-handed.", when);
                });
            break;
        }
        case MSG_YOU_BLINK:
            _dcss_canned_print("game.canned.you_blink", [&]() {
                mpr("You blink.");
            });
            break;
        case MSG_STRANGE_STASIS:
            _dcss_canned_print("game.canned.strange_stasis", [&]() {
                mpr("You feel a strange sense of stasis.");
            });
            break;
        case MSG_NO_SPELLS:
            _dcss_canned_print("game.canned.no_spells", [&]() {
                mpr("You don't know any spells.");
            });
            break;
        case MSG_MANA_INCREASE:
            _dcss_canned_print("game.canned.mana_increase", [&]() {
                mpr("You feel your magic capacity increase.");
            });
            break;
        case MSG_MANA_DECREASE:
            _dcss_canned_print("game.canned.mana_decrease", [&]() {
                mpr("You feel your magic capacity decrease.");
            });
            break;
        case MSG_DISORIENTED:
            _dcss_canned_print("game.canned.disoriented", [&]() {
                mpr("You feel momentarily disoriented.");
            });
            break;
        case MSG_DETECT_NOTHING:
            _dcss_canned_print("game.canned.detect_nothing", [&]() {
                mpr("You detect nothing.");
            });
            break;
        case MSG_CANNOT_MOVE:
            _dcss_canned_print("game.canned.cannot_move", [&]() {
                mpr("You cannot move.");
            });
            break;
        case MSG_YOU_DIE:
            _dcss_canned_print("game.canned.you_die", [&]() {
                mpr_nojoin(MSGCH_PLAIN, "You die...");
            });
            break;
        case MSG_GHOSTLY_OUTLINE:
            _dcss_canned_print("game.canned.ghostly_outline", [&]() {
                mpr("You see a ghostly outline there, and the spell fizzles.");
            });
            break;
        case MSG_FULL_HEALTH:
            _dcss_canned_print("game.canned.full_health", [&]() {
                mpr("Your health is already full.");
            });
            break;
        case MSG_FULL_MAGIC:
            _dcss_canned_print("game.canned.full_magic", [&]() {
                mpr("Your reserves of magic are already full.");
            });
            break;
        case MSG_GAIN_HEALTH:
            _dcss_canned_print("game.canned.gain_health", [&]() {
                mpr("You feel better.");
            });
            break;
        case MSG_GAIN_MAGIC:
            _dcss_canned_print("game.canned.gain_magic", [&]() {
                mpr("You feel your power returning.");
            });
            break;
        case MSG_MAGIC_DRAIN:
        {
            if (you.has_mutation(MUT_HP_CASTING))
                _dcss_canned_print("game.canned.magic_drain.hp_casting", [&]() {
                    mpr("You feel momentarily drained.");
                });
            else
                _dcss_canned_print("game.canned.magic_drain.magic_energy", [&]() {
                    mprf(MSGCH_WARN, "You suddenly feel drained of magical energy!");
                });
            break;
        }
        case MSG_SOMETHING_IN_WAY:
            _dcss_canned_print("game.canned.something_in_way", [&]() {
                mpr("There's something in the way.");
            });
            break;
        case MSG_CANNOT_SEE:
            _dcss_canned_print("game.canned.cannot_see", [&]() {
                mpr("You can't see that place.");
            });
            break;
        case MSG_GOD_DECLINES:
            _dcss_canned_print("game.canned.god_declines", [&]() {
                mpr("Your god isn't willing to do this for you now.");
            });
            break;
        case MSG_NO_AVAILABLE_SPACE:
            _dcss_canned_print("game.canned.no_available_space", [&]() {
                mpr("There is no available space!");
            });
            break;
    }
}

// Note that this function *completely* blocks messaging for monsters
// distant or invisible to the player ... look elsewhere for a function
// permitting output of "It" messages for the invisible {dlb}
// Intentionally avoids info and str_pass now. - bwr
bool simple_monster_message(const monster& mons, const char *event,
                            bool need_possessive,
                            msg_channel_type channel,
                            int param,
                            description_level_type descrip)
{
    if (you.see_cell(mons.pos())
        && (channel == MSGCH_MONSTER_SPELL || channel == MSGCH_FRIEND_SPELL
            || mons.visible_to(&you)))
    {
        string msg = mons.name(descrip);
        if (need_possessive)
            msg = apostrophise(msg);
        msg += event;

        if (channel == MSGCH_PLAIN && mons.wont_attack())
            channel = MSGCH_FRIEND_ACTION;

        mprf(channel, param, "%s", msg.c_str());
        return true;
    }

    return false;
}

string god_speaker(god_type which_deity)
{
    if (which_deity == GOD_WU_JIAN)
       return "The Council";
    else
       return uppercase_first(god_name(which_deity));
}

// yet another wrapper for mpr() {dlb}:
void simple_god_message(const char *event, bool need_possessive,
                        god_type which_deity)
{
    string msg = god_speaker(which_deity);
    if (need_possessive)
        msg = apostrophise(msg);
    msg += event;

    god_speaks(which_deity, msg.c_str());
}

void wu_jian_sifu_message(const char *event)
{
    string msg;
    msg = uppercase_first(string("Sifu ") + wu_jian_random_sifu_name() + event);
    god_speaks(GOD_WU_JIAN, msg.c_str());
}

static bool is_channel_dumpworthy(msg_channel_type channel)
{
    return channel != MSGCH_EQUIPMENT
           && channel != MSGCH_DIAGNOSTICS
           && channel != MSGCH_TUTORIAL;
}

void clear_message_store()
{
    buffer.clear();
}

string get_last_messages(int mcount, bool full)
{
    flush_prev_message();

    string text;
    // XXX: should use some message_history iterator here
    const store_t& msgs = buffer.get_store();
    // XXX: loop wraps around otherwise. This could be done better.
    mcount = min(mcount, NUM_STORED_MESSAGES);
    for (int i = -1; mcount > 0; --i)
    {
        const message_line msg = msgs[i];
        if (!msg)
            break;
        if (full || is_channel_dumpworthy(msg.channel))
        {
            string line = msg.pure_text_with_repeats();
            string wrapped;
            while (!line.empty())
                wrapped += wordwrap_line(line, 79, false, true) + "\n";
            text = wrapped + text;
        }
        mcount--;
    }

    // An extra line of clearance.
    if (!text.empty())
        text += "\n";
    return text;
}

bool recent_error_messages()
{
    // TODO: track whether player has seen error messages so this can be
    // more generally useful?
    flush_prev_message();

    const store_t& msgs = buffer.get_store();
    int mcount = NUM_STORED_MESSAGES;
    for (int i = -1; mcount > 0; --i, --mcount)
    {
        const message_line msg = msgs[i];
        if (!msg)
            break;
        if (msg.channel == MSGCH_ERROR)
            return true;
    }
    return false;
}

// We just write out the whole message store including empty/unused
// messages. They'll be ignored when restoring.
static void _dcss_capture_history_rows(const store_t& rows)
{
#if defined(__EMSCRIPTEN__) && !defined(USE_TILE_LOCAL)
    if (!dcss_native_history_begin || !dcss_native_history_row
        || !dcss_native_history_segment || !dcss_native_history_end)
        return;
    bool okay = dcss_native_history_begin(rows.size()) == 1;
    for (int ordinal = 0; okay && ordinal < rows.size(); ++ordinal)
    {
        const message_line& row = rows[ordinal];
        const string canonical = row.full_text();
        const auto segments = row._dcss_segments();
        okay = dcss_native_history_row(ordinal, int(row.channel), row.param, row.turn,
                                      canonical.c_str(), canonical.size(), segments.size()) == 1;
        for (size_t index = 0; okay && index < segments.size(); ++index)
        {
            const auto& segment = segments[index];
            okay = dcss_native_history_segment(ordinal, index,
                segment.canonical.c_str(), segment.canonical.size(),
                segment.id.c_str(), segment.id.size(), segment.colour,
                segment.shout, segment.capitalise, segment.filtered) == 1;
        }
    }
    dcss_native_history_end(okay ? 1 : 0);
#else
    (void)rows;
#endif
}

static vector<_dcss_display_segment> _dcss_restore_history_row(int ordinal, const message_line& row)
{
#if defined(__EMSCRIPTEN__) && !defined(USE_TILE_LOCAL)
    if (!dcss_native_history_restore_row || !dcss_native_history_restore_segment)
        return {}; // Explicit legacy/no-sidecar history, never inferred from English.
    const string canonical = row.full_text();
    const int count = dcss_native_history_restore_row(ordinal, canonical.c_str(),
        canonical.size(), int(row.channel), row.param, row.turn);
    if (count == 0)
        return {};
    bool okay = count > 0 && count <= 256;
    vector<_dcss_display_segment> overlay;
    string reconstructed;
    for (int index = 0; okay && index < count; ++index)
    {
        vector<char> text(32769, 0);
        char id[81] = {};
        int metadata[4] = {};
        const int length = dcss_native_history_restore_segment(ordinal, index,
            text.data(), text.size(), id, sizeof(id), metadata);
        const string id_buffer(id, sizeof(id));
        const size_t id_end = id_buffer.find('\0');
        const string source_id = id_buffer.substr(0, id_end);
        okay = length >= 0 && length < int(text.size()) && text[length] == '\0'
            && string(text.data(), length).find('\0') == string::npos
            && id_end != string::npos
            && (source_id.empty() || _dcss_known_canned_id(source_id))
            && metadata[0] >= 0 && metadata[0] <= 15
            && metadata[1] >= 0 && metadata[1] <= 1
            && metadata[2] >= 0 && metadata[2] <= 1
            && metadata[3] >= 0 && metadata[3] <= 1;
        if (okay)
        {
            overlay.push_back({string(text.data(), length), source_id, metadata[0],
                               bool(metadata[1]), bool(metadata[2]), bool(metadata[3])});
            reconstructed += overlay.back().canonical;
        }
    }
    if (!okay || reconstructed != canonical)
    {
        fprintf(stderr, "Native semantic history coherence failed.\n");
        end(1, false, nullptr);
    }
    return overlay;
#else
    (void)ordinal; (void)row;
    return {};
#endif
}

static void _dcss_restore_history_begin(int count)
{
#if defined(__EMSCRIPTEN__) && !defined(USE_TILE_LOCAL)
    if (dcss_native_history_restore_begin && dcss_native_history_restore_begin(count) != 1)
    {
        fprintf(stderr, "Native history restore row count failed.\n");
        end(1, false, nullptr);
    }
#else
    (void)count;
#endif
}

static void _dcss_restore_history_end()
{
#if defined(__EMSCRIPTEN__) && !defined(USE_TILE_LOCAL)
    if (dcss_native_history_restore_end && dcss_native_history_restore_end() != 1)
    {
        fprintf(stderr, "Native history restore coverage failed.\n");
        end(1, false, nullptr);
    }
#endif
}

void save_messages(writer& outf)
{
    store_t msgs = buffer.get_store();
    _dcss_capture_history_rows(msgs);
    marshallInt(outf, msgs.size());
    for (int i = 0; i < msgs.size(); ++i)
    {
        marshallString4(outf, msgs[i].full_text());
        marshallInt(outf, msgs[i].channel);
        marshallInt(outf, msgs[i].param);
        marshallInt(outf, msgs[i].turn);
    }
}

void load_messages(reader& inf)
{
    unwind_bool save_more(crawl_state.show_more_prompt, false);

    // assumes that the store was cleared at the beginning of _restore_game!
    flush_prev_message();
    store_t load_msgs = buffer.get_store(); // copy of messages during loading
    clear_message_store();

    vector<vector<_dcss_display_segment>> _dcss_pending_overlays;
    {
    unwind_bool _dcss_hold(_dcss_restore_display_hold, true);
    int num = unmarshallInt(inf);
    _dcss_restore_history_begin(num);
    for (int i = 0; i < num; ++i)
    {
        string text;
        unmarshallString4(inf, text);

        msg_channel_type channel = (msg_channel_type) unmarshallInt(inf);
        int           param      = unmarshallInt(inf);
#if TAG_MAJOR_VERSION == 34
        if (inf.getMinorVersion() < TAG_MINOR_MESSAGE_REPEATS)
                                   unmarshallInt(inf); // was 'repeats'
#endif
        int           turn       = unmarshallInt(inf);

        message_line msg(message_line(text, channel, param, turn));
        if (msg)
        {
            _dcss_pending_overlays.push_back(_dcss_restore_history_row(i, msg));
            buffer.store_msg(msg, &_dcss_pending_overlays.back());
        }
    }
    _dcss_restore_history_end();
    buffer._dcss_apply_restore_overlays(_dcss_pending_overlays);
    }
    msgwin.show(); // Pure redraw after the complete overlay set is validated/committed.
    flush_prev_message();
    buffer.append_store(load_msgs);
    clear_messages(); // check for Options.message_clear
}

static void _replay_messages_core(formatted_scroller &hist)
{
    flush_prev_message();

    const store_t msgs = buffer.get_store();
    formatted_string lines;
    for (int i = 0; i < msgs.size(); ++i)
        if (channel_message_history(msgs[i].channel))
        {
            string text = msgs[i]._dcss_display_text();
            if (!text.size())
                continue;
            linebreak_string(text, cgetsize(GOTO_CRT).x - 1);
            vector<formatted_string> parts;
            formatted_string::parse_string_to_multiple(text, parts, 80);
            for (unsigned int j = 0; j < parts.size(); ++j)
            {
                prefix_type p = prefix_type::none;
                if (j == parts.size() - 1 && i + 1 < msgs.size()
                    && msgs[i+1].turn > msgs[i].turn)
                {
                    p = prefix_type::turn_end;
                }
                if (!lines.empty())
                    lines.add_glyph('\n');
                lines.add_glyph(_prefix_glyph(p));
                lines += parts[j];
            }
        }

    hist.add_formatted_string(lines);
    hist.show();
}

void replay_messages()
{
    formatted_scroller hist(FS_START_AT_END | FS_PREWRAPPED_TEXT);
    hist.set_more();

    _replay_messages_core(hist);
}

void replay_messages_during_startup()
{
    formatted_scroller hist(FS_PREWRAPPED_TEXT);
    hist.set_more();
    hist.set_more(formatted_string::parse_string(
            "<cyan>Press Esc to close, arrows/pgup/pgdn to scroll.</cyan>"));
    hist.set_title(formatted_string::parse_string(recent_error_messages()
        ? "<yellow>Crawl encountered errors during initialization:</yellow>"
        : "<yellow>Initialization log:</yellow>"));
    _replay_messages_core(hist);
}

void set_msg_dump_file(FILE* file)
{
    _msg_dump_file = file;
}

// XX unclear why we have both this and an overload of mpr that takes a
// formatted_string
void formatted_mpr(const formatted_string& fs,
                   msg_channel_type channel, int param)
{
    _mpr(fs.to_colour_string(), channel, param);
}
