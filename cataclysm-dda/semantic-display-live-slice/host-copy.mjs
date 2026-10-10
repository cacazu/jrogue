// Platform-only owned copy for cdda-help-observation/1. No input or simulation authority.
export const SOURCE_COMMIT = '7b2efa5cea38e4d4d97dd0e63b28b9148623da59';
export const MAX_BYTES = 262144;
const U64_MAX = (1n << 64n) - 1n;
function word(value) {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) throw new Error('notice word');
  return value;
}
function publication(value) {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]{0,19})$/.test(value)) throw new Error('publication');
  const result = BigInt(value);
  if (result > U64_MAX) throw new Error('publication overflow');
  return result;
}
export function copyHelpBytes(module) {
  let handle = 0;
  try {
    // Emscripten exports i32 words; normalize to unsigned only at this WASM boundary.
    handle = module._cdda_help_snapshot_pin() >>> 0;
    if (handle === 0) throw new Error('help pin unavailable');
    const pointer = module._cdda_help_snapshot_data(handle) >>> 0;
    const size = module._cdda_help_snapshot_size(handle) >>> 0;
    // Exports can grow WASM memory. Acquire the current view after all calls.
    const heap = module.HEAPU8;
    if (!(heap instanceof Uint8Array) || pointer === 0 || size === 0 || size > MAX_BYTES ||
        pointer > heap.length || size > heap.length - pointer) throw new Error('help memory bounds');
    return heap.slice(pointer, pointer + size);
  } finally {
    if (handle !== 0) module._cdda_help_snapshot_release(handle);
  }
}
export function createHelpTracker({ module, buildId, acceptOwned }) {
  if (typeof buildId !== 'string' || !buildId || new TextEncoder().encode(buildId).length > 16384 ||
      typeof acceptOwned !== 'function') throw new Error('help consumer identity');
  let highest = 0n;
  let terminal = false;
  let current = null;
  let failure = null;
  let receiving = false;
  let reentered = false;
  const clear = reason => { current = null; failure = reason; };
  return Object.freeze({
    receive(notice) {
      if (terminal) return false;
      if (receiving) { reentered = true; clear('reentrant help consumer'); return false; }
      receiving = true;
      reentered = false;
      try {
        if (!notice || notice.kind !== 3) throw new Error('help notice kind');
        const sequence = (BigInt(word(notice.publicationHigh)) << 32n) | BigInt(word(notice.publicationLow));
        const availability = word(notice.availability);
        if (![1, 2, 3].includes(availability)) throw new Error('help availability');
        if (availability === 3) {
          if (sequence !== 0n) throw new Error('terminal help sequence');
          terminal = true; clear('terminal'); return false;
        }
        if (sequence < highest) return false;
        if (availability === 2) { highest = sequence; clear('unavailable'); return false; }
        if (sequence === 0n) throw new Error('available zero publication');
        const bytes = copyHelpBytes(module);
        const raw = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
        if (!raw || raw.interface !== 'cdda-help-observation/1' || raw.schema_version !== 1 ||
            raw.source_commit !== SOURCE_COMMIT || raw.engine_build_id !== buildId ||
            typeof raw.available !== 'boolean') throw new Error('help envelope identity');
        const copiedSequence = publication(raw.publication_sequence);
        // A later native publication may replace latest before a deferred notice arrives.
        if (copiedSequence < sequence || copiedSequence < highest || copiedSequence === 0n) {
          throw new Error('stale help bytes');
        }
        highest = copiedSequence;
        // This hook must invoke the real Rust parser synchronously in the integrated host.
        // Fixture callbacks establish transport policy only, never Rust acceptance.
        const accepted = acceptOwned(bytes.slice(), buildId);
        // Read each untrusted result field once; getters may also attempt reentry.
        const acceptedThen = accepted?.then;
        const acceptedPublication = accepted?.publication;
        const acceptedAvailable = accepted?.available;
        if (reentered) throw new Error('reentrant help consumer');
        if (!accepted || typeof acceptedThen === 'function' || acceptedPublication !== copiedSequence ||
            acceptedAvailable !== raw.available) throw new Error('help consumer rejection');
        if (!raw.available) { clear('unavailable'); return false; }
        current = Object.freeze({ publication: copiedSequence, bytes: bytes.slice() });
        failure = null;
        return true;
      } catch (error) {
        clear(error instanceof Error ? error.message : 'help failure');
        return false;
      } finally { receiving = false; }
    },
    snapshot() { return current === null ? null : Object.freeze({ publication: current.publication, bytes: current.bytes.slice() }); },
    status() { return Object.freeze({ highest, terminal, available: current !== null, failure, commandAuthorization: 'denied' }); },
  });
}
