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
