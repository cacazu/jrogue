# Proposed owner-local browser seams

These snippets are not applied. They belong inside the existing closures in `port/web/game.mjs`; an external routine cannot inspect their private state. Source SHA-256 at reconciled review: `f0d07da0444d49d9cac73acb12e6643726628838f360bf39c7f951f4782dfc01`. Reconcile source drift before integration.

Import the authored codec into a build-reviewed location. Add an ordinary method beside `append/poll/clear` inside `createEventQueue`:

```js
copyReadOnlyOwnerFields() {
  return {
    packets: packets.map(packet => ({bytes: packet.bytes.slice(), receipt: packet.receipt})),
    lastEnqueuedReceipt, consumedReceipt, consumedPacketCount, textReceipt,
  };
},
```

Add an ordinary method beside `begin/release/presented/reset` inside `createKeyPressQueue`:

```js
copyReadOnlyOwnerFields() {
  return {
    jobs: jobs.map(job => ({
      token: job.token, event: job.event, tap: job.tap,
      released: job.released, acknowledged: job.acknowledged,
      stage: job.stage, receipt: job.receipt,
    })),
    nextToken, presentedReceipt,
  };
},
```

The event DTO is already frozen by the owner; the codec inspects its own property descriptors and rejects accessors, symbols, nested values or unsupported numeric types. The copied queue/job arrays preserve existing order and have no reference to the live packet bytes. No `poll`, `peek`, `clear`, `pump`, `dispatch`, `presented`, `release`, rendering, clock or input-normalization call occurs.

Inside the top-level game owner, expose a probe method beside the existing paused-only `probe()`:

```js
inputWitness() {
  if (!paused || !host?.running) throw new Error("probe.error.not_frozen");
  return capturePlatformInput({
    frozen: true,
    fifo: queue.copyReadOnlyOwnerFields(),
    keys: virtualKeys.copyReadOnlyOwnerFields(),
  }, reviewedCapacity);
},
```

`reviewedCapacity` is a parent-selected, measured capture budget. Capture native and input sections synchronously in this same suspended turn, with no `await` between them. The current `paused` flag indicates JSPI suspension; it does not prove the absence of a partially executed command or live modal stack local. The full witness therefore remains partial.

Do not use `queue.length`, `pending` or the existing receipt getters as substitutes for the packet sequence. Do not call Pascal `CommandEventPending`: it polls/discards ignored events and can invoke `OnEvent`. Pascal `TCommand` dispatch is immediate; this browser FIFO is an IO-event queue, not a native command queue.

The separate deferred-key queue can legitimately change during presentation acknowledgment. Compare it as input/control evidence, separate from gameplay purity; a draw replay that neither acknowledges a new native frame nor enqueues input should preserve both sections. Held keyboard/mouse/pointer state, Rust input-normalizer state, IME composition, driver/modifier state and modal layers still need their own ledger.

The reconciled FIFO also retains nullable `textReceipt`: after kind-10 text delivery, `poll`/`pending` are gated until `presented(receipt)` acknowledges it. Capture its presence and value directly. Packet count/bytes and consumed counters alone cannot distinguish a deliverable queue from one waiting for text presentation.
