#include "fixture.h"
#include <emscripten.h>

namespace { const int identity_token = 0x5a1; }
const void *probe_identity() { return &identity_token; }

EM_ASYNC_JS(int, probe_host_async, (int mode, int value), {
    const state = globalThis.jspiSdkHost;
    state.events.push('host-enter:' + mode);
    return await new Promise((resolve, reject) => setTimeout(() => {
        state.events.push('host-timer:' + mode);
        if (mode === 3) reject(state.rejection);
        else {
            if (mode === 4) {
                try {
                    const returned = Module['_probe_callback'](5);
                    state.callback = { returned, isPromise: returned instanceof Promise };
                } catch (error) {
                    state.callback = { error: { name: error.name, message: error.message } };
                    reject(error);
                    return;
                }
            }
            resolve(value + 20);
        }
    }, 10));
});
extern "C" EMSCRIPTEN_KEEPALIVE int probe_plain_async(int mode, int value) {
    return probe_host_async(mode, value);
}

int probe_sleep_target(int, int value) {
    ProbeGuard guard(2);
    emscripten_sleep(10);
    return value + 10;
}
int probe_sync_target(int mode, int value) {
    ProbeGuard guard(4);
    if (mode == 0) return probe_sleep_target(0, value);
    if (mode == 1 || mode == 5) {
        if (mode == 5) emscripten_sleep(10);
        throw ProbeError{value, probe_identity()};
    }
    return probe_host_async(mode, value);
}
int probe_callback_target(int, int value) { return value + 100; }
ProbeTarget probe_target() {
    static ProbeTarget volatile target = &probe_sync_target;
    return target;
}
