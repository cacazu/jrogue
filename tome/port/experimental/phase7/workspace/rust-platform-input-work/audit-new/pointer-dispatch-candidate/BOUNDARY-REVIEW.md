# Pointer collection versus serialized native dispatch

Independent source-only review. No implementation edits, test/build/browser/runtime, event injection or native execution. Reads included the frozen host/bridge and the separate resize contract candidate. Recommendations below remain unimplemented/unverified by this reviewer.

## Inspected source identities

Workspace root: `C:\Users\kit\Documents\Codex\2026-10-02\task-10`.

| Source | SHA-256 read during review |
| --- | --- |
| `rust-platform-input-work/browser/focused-input-host.mjs` | `c012ff1de6a60c21e2a3ac4d4a2f63a963e4422665c14d35734b09cc60a67658` |
| `rust-platform-input-work/browser/original-physical-input.mjs` | `0b72cfbd56b0e0e438b34184596811fbccc9951c65c372f93ec4cc85f6ea38d3` |
| `rust-platform-input-work/audit-new/resize-candidate/native-canvas-contract.mjs` | `badcc513925448efc141c94cd8a1450d97f5cea25725ff7f68c0b00c459eb8f3` |

Original source provenance remains ToME 1.7.6, commit `624a67329fe2ad440c5b344785a9c73fcf22ae63`; these inspected host files are derivatives, not upstream game logic.

## Concrete busy-collection failure

The host intentionally continues collecting genuine DOM events while native dispatch is underway. `FocusedInputHost.apply:68–88` maps once and appends packets to its FIFO. `flush:195–212` holds inFlight across both `await original.dispatch(packets)` and `await onSettled(status)`, then consumes any newly queued packets. `OriginalPhysicalInput.dispatch:60–80` sets running true and yields during draining/ticking pumps; collect:42–48 also yields while draining. Another DOM callback can consequently run while either wrapper or actual native input status is busy.

The separate resize candidate's `admittedPointerPoint:90–93` calls the full `assertNativeDisplayContract`. That assertion rejects native input_busy/checkpoint_busy at line 64 and physicalStatus.busy at lines 80–82. If it is installed directly around the frozen `point(event)` in each collector, a legitimate motion or mouseup during this interval throws before mapping. Listener guard at host:51 catches it and invokes fail:45–48, which marks failed and disables acceptance. This is not a resize violation; it is normal collection during a serialized transaction. A mouseup can be lost before Rust observes/releases its held button.

The completed-frame contract must therefore not be a prerequisite for DOM coordinate collection. Likewise, adding `if (host.busy) return` in a collector would lose actual releases and actions. Awaiting quiescence and mapping a stored event later would instead use dispatch-time layout and violates the requested event-time coordinate contract.

## Precise boundary split

### 1. Synchronous event-time collection

At the actual DOM callback, observe and copy the current client coordinates, canvas content rectangle, relative movement, button masks and modifiers. Acquire fresh physical dimensions from a narrow readonly platform observation (`SDL_GetWindowSize` plus actual canvas/drawing-buffer identity and size); do not rely only on `original.latest` at frozen host:57/61, because that is the result of an earlier bridge call.

Collection must check the leased real canvas/selector identity, finite positive physical dimensions, actual buffer/physical SDL agreement and usable content rectangle. It must not require native input idle, completed original frame, Game logical size, tick settlement, root viewport or default framebuffer. Those conditions can legitimately be in transition between serialized native calls and are irrelevant to capturing an already occurred physical event. A narrow SDL/canvas geometry getter should avoid Lua game-table inspection, surface refresh, context binding, event pumping, drawing and resize.

In the same synchronous callback, build the original typed Input point with those copied dimensions/rectangle and invoke the actual Rust mapper exactly once. Store the returned concrete SDL-coordinate packet objects in encounter order. Retain physical geometry/version metadata separately for diagnostics if useful, but do not modify the native packet schema without an explicitly reviewed adapter change. Do not retain the DOM Event as a promise of coordinates to be computed after an await. Do not regenerate Text, MouseMotion, MouseButton or Wheel packets during flush.

CSS-only scale changes are naturally handled by reading the current content rectangle for each event while keeping the actual native physical window dimensions. The same event must use one internally consistent observation; no awaits, timers or DOM callbacks may interleave its geometry capture and Rust mapping. All native observation calls remain outside independent Rust/native-heap purity comparison brackets because C getters write their scratch/stack.

### 2. Serialized native dispatch admission

Only the existing FIFO dispatch owner may acquire native input admission. At an established completed original root-frame boundary, refresh actual native physical status/display contract and apply the full native idle/checkpoint, source logical zoom, context/default-framebuffer and viewport checks. This is a native ownership check; the owner's own host.inFlight Boolean must not be mistaken for an unrelated competing transaction when performing this internal boundary check.

Dispatch the captured packet batch unchanged, in order, exactly once. Preserve the bridge's original per-packet inject -> drain-before-next-packet behavior: `dispatch:68–69` awaits collect around each packet, and the packet method at 50–56 forwards its already captured x/y or wheel mouse_x/y directly. Re-evaluating a packet's old client coordinates against a new DOM rectangle is prohibited. Replay after a rejection, synthetic clicks, an extra corrective motion, and RNG/state rollback are also prohibited.

The bridge is intentionally busy during its original drain/tick work. New DOM events should append to the pending FIFO during its yields; they must not recursively acquire native admission. `flush:200–208` then dispatches them after the previous transaction and original onSettled work finish. Save/checkpoint acquisition continues through the reviewed suspendAndDrain path, not a separate parallel pointer bridge.

### 3. Actual completed-frame observation

`OriginalPhysicalInput.dispatch:77` proves native complete/idle/tick_end_pending zero/tick_paused, but it does not itself render a root frame. The frozen host comment at 204–206 deliberately delegates effectful frame refresh to onSettled. Current physical-play-browser.mjs:298–300 calls originalVisualFrame, then awaits the real session snapshot; physical-play-owner.mjs:49–56 forwards that callback and updates cached UI gates only when host.inFlight clears. A source-only observer cannot establish that every caller's onSettled rendered the correct root frame. The integrating candidate must explicitly identify its completed original frame slot; do not infer it from `busy === false`, a requestAnimationFrame callback, a cached status, or successful JSON parsing.

## Release and failure handling

Keep the document mouseup collector active: frozen host:123–126 does not early-return when acceptance/focus is lost, allowing a held release to reach Rust. Window blur and external focus change at 140–142 produce actual held-state release packets. suspendAndDrain:215–219 disables new acceptance, maps a Blur, and drains the resulting releases. Preserve those semantics while splitting geometry checks; do not put an idle/full-display gate ahead of them.

For normal busy collection, fresh valid geometry should map the actual mouseup normally. If physical geometry is genuinely unavailable/corrupt, the implementation must distinguish that fault from busy: stop admission of new spatial presses/wheel/motion, retain already queued work, and still allow held releases/Blur to reach the mapper and serialized dispatcher. Existing mapper MouseButton handling in rust/src/lib.rs:104–119 permits a held Up after focus loss and, for an invalid point, uses the held button's last captured position (109–112). Blur:139–148 emits original held-key/button release packets. That is an explicit existing release fallback, not remapping or invented mouse motion. An implementation that throws in point() before mapping bypasses this safeguard.

A full display mismatch should not indiscriminately suppress release-only packets needed to relinquish already held SDL state. Define that recovery/teardown path explicitly, with real original serialized native admission, and keep it distinct from accepting new spatial actions against an unproven frame. Do not silently clear Rust state or SDL globals. If the original native owner is fatally failed and cannot accept even releases, report that failure and require fresh-session recovery; do not claim successful release.

The frozen queue bound at host:76–79 is another real limit: overflow occurs after Rust has observed the event and fails the host, requiring a fresh owner. The busy-boundary correction must not claim universal no-loss behavior while retaining that behavior. Before broad release guarantees, provide pre-admission capacity/reserved release capacity or another bounded reviewed failure path that retains releases. Do not coalesce/drop mapped packets, especially release, motion or wheel packets, merely to satisfy a bound; original motion callbacks can carry gameplay/UI meaning.

## Resize and viewport assumptions still unproven

1. **Event chronology versus native SDK resize callbacks.** Fresh physical geometry establishes what was measured for each event, not the relative ordering of queued original system events and independently collected host input. SDK callbacks may queue resize events while the host delays its own packets. A later native dispatch must retain actual original system-event chronology rather than reorder a resize ahead of an earlier pointer packet by accident. The full original dispatcher/drain source and actual variant need separate evidence for this ordering. Do not repair it by re-mapping old coordinates or replaying a click.
2. **Source resolution changes caused by earlier input.** A legitimate original command may resize/change zoom before a later queued pointer packet is processed. Keep that packet's event-time SDL coordinates just as captured; demanding every packet match the current geometry version, or converting it a second time, changes original queued-input behavior. The coordinate epoch is evidence/diagnostics, not permission to fabricate a different event. A verified original event-boundary lease or explicitly serialized original resolution transition is needed where multiple native/CSS owners can change geometry.
3. **Async physical observation freshness.** If a getter is called before a yield and its result reused after it, it is no longer event-time geometry. A cached drawing buffer width or source physical status alone is insufficient. Use one synchronous callback observation.
4. **Viewport is temporary state.** Original FBO passes can legitimately install a nonroot viewport/framebuffer. A collection-time viewport equality assertion is wrong; a full assertion after a proven original root frame remains useful. It should check original maincontext/default framebuffer, not just dimensions.
5. **Content rectangle math.** Current host:59–60 adds clientLeft/clientTop to getBoundingClientRect.left/top and uses clientWidth/clientHeight. This is coherent for its current untransformed border-only layout. CSS transforms or padding require a reviewed content-rectangle calculation in client-coordinate space; native window dimensions alone cannot fix a bad rectangle.
6. **Native size versus draw buffer.** Fix the #canvas selector lease before native factory/startup, as independently audited. Collection must not paper over a physical buffer mismatch with CSS scaling or a guessed 1280x720/800x600 fallback.

## Parent validation to perform later

No checks were executed here. Validate genuine mouse down, a deliberately yielding original drain/tick, then move/up before completion; assert exact FIFO packets and one original button release. Include focus loss/Blur during dispatch, save suspend/drain, CSS rectangle movement/scale between distinct events, original resolution/zoom transitions, native system-event ordering, root-frame-only viewport checks, and queue-capacity failure. Compare actual SDL owned state and original callback effects; avoid test-double dispatch evidence or player mutation.
