#include "fixture.h"
#include <cstdlib>
#include <emscripten.h>

namespace {
int alive = 0, destroyed = 0, caught = 0, identity_ok = 0, rethrow_ok = 0;
int callback_result = 0, last_result = 0, completed = 0, trace_length = 0;
int trace[64] = {};
}
void probe_event(int event) { if (trace_length < 64) trace[trace_length++] = event; }
ProbeGuard::ProbeGuard(int value) : id(value) { ++alive; probe_event(id); }
ProbeGuard::~ProbeGuard() { --alive; ++destroyed; probe_event(-id); }

extern "C" EMSCRIPTEN_KEEPALIVE void probe_reset() {
    alive = destroyed = caught = identity_ok = rethrow_ok = callback_result = last_result = completed = trace_length = 0;
}
extern "C" EMSCRIPTEN_KEEPALIVE int probe_stats(int field) {
    switch (field) {
        case 0: return alive; case 1: return destroyed; case 2: return caught;
        case 3: return identity_ok; case 4: return rethrow_ok; case 5: return callback_result;
        case 6: return last_result; case 7: return completed; case 8: return trace_length;
        default: return field >= 100 && field < 164 ? trace[field - 100] : -9999;
    }
}
extern "C" EMSCRIPTEN_KEEPALIVE int probe_direct(int value) {
    ProbeGuard guard(1);
    return probe_sleep_target(0, value);
}
extern "C" EMSCRIPTEN_KEEPALIVE int probe_plain(int value) {
    // Positive entry-boundary control: no try/catch or cleanup scope.
    emscripten_sleep(10);
    return value + 10;
}
extern "C" EMSCRIPTEN_KEEPALIVE int probe_async(int mode, int value) {
    ProbeGuard guard(6);
    // A direct call isolates EM_ASYNC_JS result/rejection from the indirect bridge.
    try { return probe_sync_target(mode, value); }
    catch (...) { ++caught; return -777; }
}
extern "C" EMSCRIPTEN_KEEPALIVE int probe_indirect(int mode, int value) {
    ProbeGuard guard(3);
    try {
        // Separate translation unit, no LTO, and volatile pointer storage.
        // The caller must retain the legacy exception-aware indirect call.
        return probe_target()(mode, value);
    } catch (const ProbeError &error) {
        ++caught;
        identity_ok = error.value == value && error.identity == probe_identity();
        const ProbeError *original = &error;
        try { throw; } catch (const ProbeError &same) { rethrow_ok = &same == original; }
        return error.value + 100;
    } catch (...) {
        ++caught;
        return -777;
    }
}
extern "C" EMSCRIPTEN_KEEPALIVE int probe_callback(int value) {
    ProbeGuard guard(5);
    try {
        ProbeTarget volatile callback = &probe_callback_target;
        callback_result = callback(0, value);
        return callback_result;
    } catch (...) { return -888; }
}
int main(int argc, char **argv) {
    probe_reset();
    const int route = argc > 1 ? std::atoi(argv[1]) : 0;
    if (route == 0) {
        last_result = probe_plain(20);
        completed = 1;
        return 0;
    }
    {
        ProbeGuard guard(9);
        if (route == 1) last_result = probe_indirect(0, 20);
        else if (route == 2) last_result = probe_indirect(1, 20);
        else last_result = probe_async(4, 20);
        completed = 1;
    }
    return 0;
}
