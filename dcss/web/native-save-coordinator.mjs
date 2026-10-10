// Native capture is reserved when save() is called, preserving Worker/input
// arrival order. The immutable files/history reply is packed and committed in
// save-call order; rejected packs never reach the storage adapter.
export function createNativeSaveCoordinator({ capture, pack, commit, signal }) {
  if ([capture, pack, commit].some(value => typeof value !== 'function')) {
    throw new TypeError('invalid native save coordinator');
  }
  let tail = Promise.resolve();
  const active = () => {
    if (signal?.aborted) throw signal.reason ?? new Error('engine session ended');
  };
  return function save() {
    let captured;
    try {
      active();
      // Both handlers attach immediately. A reserved native request can reject
      // while an earlier save is still committing, without becoming unhandled.
      captured = Promise.resolve(capture()).then(
        checkpoint => ({ ok: true, checkpoint }),
        error => ({ ok: false, error }),
      );
    } catch (error) {
      captured = Promise.resolve({ ok: false, error });
    }
    const operation = tail.then(async () => {
      active();
      const result = await captured;
      active();
      if (!result.ok) throw result.error;
      const save = pack(result.checkpoint);
      if (typeof save !== 'string') throw new Error('native pack did not return a save string');
      active();
      await commit(save);
      active();
      return save;
    });
    // A failed attempt releases the commit queue; each caller keeps its own
    // outcome. The Worker independently serializes the native save helpers.
    tail = operation.catch(() => {});
    return operation;
  };
}
