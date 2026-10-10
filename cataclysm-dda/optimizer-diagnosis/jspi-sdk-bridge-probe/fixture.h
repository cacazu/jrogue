#pragma once

struct ProbeError { int value; const void *identity; };
struct ProbeGuard {
    int id;
    explicit ProbeGuard(int value);
    ~ProbeGuard();
};
using ProbeTarget = int (*)(int, int);
ProbeTarget probe_target();
const void *probe_identity();
int probe_sleep_target(int, int);
int probe_sync_target(int, int);
int probe_callback_target(int, int);
void probe_event(int);

extern "C" {
int probe_direct(int);
int probe_plain(int);
int probe_plain_async(int, int);
int probe_async(int, int);
int probe_indirect(int, int);
int probe_callback(int);
int probe_stats(int);
void probe_reset();
}
