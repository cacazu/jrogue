// Declarations only. This file does not start a browser or execute a fixture.
export const cases = [
  { id: 'default-main-sleep', entry: 'main', route: 0, value: 30, alive: 0, destroyed: 0 },
  { id: 'main-indirect-sleep-raii', entry: 'main', route: 1, value: 30, alive: 0, destroyed: 4 },
  { id: 'main-sync-cpp-catch', entry: 'main', route: 2, value: 120, alive: 0, destroyed: 3, caught: 1, identity: true },
  { id: 'plain-explicit-sleep', entry: 'probe_plain', args: [20], value: 30, alive: 0, destroyed: 0, unwrappedSuspension: true },
  { id: 'direct-sleep-raii', entry: 'probe_direct', args: [20], value: 30, alive: 0, destroyed: 2, unwrappedSuspension: true },
  { id: 'sync-indirect-cpp-catch', entry: 'probe_indirect', args: [1, 20], value: 120, alive: 0, destroyed: 2, caught: 1, identity: true },
  { id: 'indirect-sleep-raii', entry: 'probe_indirect', args: [0, 20], value: 30, alive: 0, destroyed: 3, unwrappedSuspension: true },
  { id: 'indirect-delayed-cpp-catch', entry: 'probe_indirect', args: [5, 20], value: 120, alive: 0, destroyed: 2, caught: 1, identity: true, unwrappedSuspension: true },
  { id: 'plain-async-import-resolution', entry: 'probe_plain_async', args: [2, 20], value: 40, alive: 0, destroyed: 0, unwrappedSuspension: true },
  { id: 'plain-async-import-rejection', entry: 'probe_plain_async', args: [3, 20], rejection: true, alive: 0, destroyed: 0, unwrappedSuspension: true },
  { id: 'async-import-resolution-raii', entry: 'probe_async', args: [2, 20], value: 40, alive: 0, destroyed: 2, unwrappedSuspension: true },
  { id: 'async-import-rejection-raii', entry: 'probe_async', args: [3, 20], rejection: true, alive: 0, destroyed: 2, unwrappedSuspension: true },
  { id: 'indirect-async-import-resolution', entry: 'probe_indirect', args: [2, 20], value: 40, alive: 0, destroyed: 2, unwrappedSuspension: true },
  { id: 'async-synchronous-callback-reentry', entry: 'probe_plain_async', args: [4, 20], value: 40, alive: 0, destroyed: 1, callback: true, unwrappedSuspension: true }
];
