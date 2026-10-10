// Actual-browser history witnesses; this module never launches a browser.
// Parent harness owns navigation, engine startup, and sequential execution.
import assert from 'node:assert/strict';
function evaluate(cdp, callback, ...args) {
  return cdp.eval('(' + callback.toString() + ')(' + args.map(value => JSON.stringify(value)).join(',') + ')');
}
const UPSTREAM = '1eebc1a2892e1c89776a0d7a10691f8dac8d9796';
const legacyWitnesses = new WeakMap();

export async function installHistoryObserverProbe(cdp) {
  function install() {
    const probe = { callbacks: 0, restoreCalls: 0, restoreCallbackDeltas: [], events: [], bootFiles: null };
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      postMessage(message, ...args) {
        if (message?.type === 'request' && message.op === 'boot') {
          probe.bootFiles = structuredClone(message.files);
        }
        return super.postMessage(message, ...args);
      }
    };
    let harness;
    Object.defineProperty(window, '__dcssHistoryObserverProbe', { value: probe, configurable: true });
    Object.defineProperty(window, '__dcssVerification', {
      configurable: true, get() { return harness; },
      set(value) {
        harness = value;
        const accept = value.acceptCoreMessage;
        value.acceptCoreMessage = function (event) {
          probe.callbacks++; probe.events.push(structuredClone(event));
          return accept.call(this, event);
        };
        const restore = value.restoreCoreHistory;
        value.restoreCoreHistory = function (checkpoint) {
          const before = probe.callbacks;
          const result = restore.call(this, checkpoint);
          probe.restoreCalls++; probe.restoreCallbackDeltas.push(probe.callbacks - before);
          return result;
        };
      },
    });
  }
  await cdp.call('Page.addScriptToEvaluateOnNewDocument', { source: '(' + install.toString() + ')()' });
}

export async function verifySemanticHistorySave({ cdp, evidence, save }) {
  const portable = await evaluate(cdp, function (serialized) {
    const outer = JSON.parse(serialized);
    const checked = __dcssVerification.call({ op: 'unpack_native', save: serialized }).value;
    return { version: outer.version, kind: outer.kind, upstream: outer.upstream,
      files: checked.files, checkpoint: checked.semantic,
      current: __dcssVerification.semanticHistory,
      probe: window.__dcssHistoryObserverProbe,
      legacy: (() => {
        const before = JSON.stringify(checked.files);
        const payload = JSON.stringify({ files: checked.files });
        let hash = 0xcbf29ce484222325n;
        for (const byte of new TextEncoder().encode(payload)) {
          hash = BigInt.asUintN(64, (hash ^ BigInt(byte)) * 0x100000001b3n);
        }
        const legacy = JSON.stringify({ format: outer.format, version: 1, abi: outer.abi,
          upstream: outer.upstream, kind: 'native-dcss-file-set-v1',
          checksum: hash.toString(16).padStart(16, '0'), payload });
        const imported = __dcssVerification.call({ op: 'unpack_native', save: legacy }).value;
        if (imported.semantic != null || JSON.stringify(imported.files) !== before) {
          throw Error('Actual Rust legacy-v1 import changed native bytes or imported history');
        }
        return legacy;
      })() };
  }, save);
  assert.equal(portable.version, 2); assert.equal(portable.kind, 'native-dcss-file-set-v2');
  assert.equal(portable.upstream, UPSTREAM);
  assert.equal(portable.checkpoint.version, 1); assert.equal(portable.checkpoint.upstream, UPSTREAM);
  assert(portable.checkpoint.events.length > 0, 'ordinary source observation must precede the save witness');
  assert.deepEqual(portable.checkpoint.events, portable.current);
  for (const entry of portable.checkpoint.events) {
    assert.match(entry.session, /^[1-9][0-9]*$/);
    assert.match(entry.event.sequence, /^[1-9][0-9]*$/);
    assert(BigInt(entry.event.sequence) <= 0xffffffffffffffffn);
    assert.equal(entry.event.source, 'canned-v1'); assert.equal(entry.event.upstream, UPSTREAM);
    assert(!Object.hasOwn(entry, 'text')); assert(!Object.hasOwn(entry.event, 'rendered'));
  }
  assert.equal(portable.probe.restoreCalls, 1);
  assert.deepEqual(portable.probe.restoreCallbackDeltas, [0]);
  legacyWitnesses.set(cdp, { save: portable.legacy, files: portable.files });
  const record = evidence.semanticHistory = {
    result: 'saved-awaiting-resume', envelope_version: 2,
    source: 'canned-v1', checkpoint: portable.checkpoint,
    native_bytes: portable.files.reduce((total, file) => total + file.bytes.length, 0),
    native_file_paths: portable.files.map(file => file.path),
    checks: ['Actual Rust native v2 stores bounded raw semantic descriptors with exact source/u64 identities'],
    diagnostic_counts_persisted: false, native_sequence_renumbered: false,
  };
  evidence.checks.push(record.checks[0]);
  return record;
}

// Invoke after the parent has checked its saved/next-command PCG comparison.
// An ordinary I may consume native UI RNG; the purity comparison begins after
// that authentic command, never assumes its native behavior is RNG-free.
export async function verifySemanticHistoryResume({ cdp, until, evidence, triggerNewEvent = true }) {
  const record = evidence.semanticHistory;
  assert(record?.checkpoint, 'save witness required');
  const before = await evaluate(cdp, async function () {
    return { history: __dcssVerification.semanticHistory, session: __dcssVerification.semanticSession,
      errors: __dcssVerification.semanticErrors, state: await __dcssCore.state(),
      announcer: document.querySelector('#semantic-announcer').textContent,
      probe: structuredClone(window.__dcssHistoryObserverProbe) };
  });
  assert.equal(before.session, String(BigInt(record.checkpoint.session) + 1n));
  assert.deepEqual(before.history.slice(0, record.checkpoint.events.length), record.checkpoint.events);
  assert.equal(before.errors, 0);
  assert.equal(before.probe.restoreCalls, 1);
  assert.deepEqual(before.probe.restoreCallbackDeltas, [0], 'history restore must never replay source callbacks');
  assert.equal(before.probe.callbacks, before.history.filter(entry => entry.session === before.session).length);
  if (before.probe.callbacks === 0) assert.equal(before.announcer, '', 'old observations must remain quiet');
  record.checks.push('Fresh native Worker restores old session descriptors without observer callbacks or diagnostic-count replay');

  if (triggerNewEvent) {
    const previous = before.history.filter(entry => entry.session === before.session).at(-1)?.event.sequence ?? '0';
    await evaluate(cdp, function () { document.querySelector('#console').focus(); });
    await cdp.call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'I', code: 'KeyI', text: 'I', modifiers: 8 });
    await cdp.call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'I', code: 'KeyI', modifiers: 8 });
    await until(() => evaluate(cdp, function (session, sequence) {
      if (__dcssCore.error) throw Error(__dcssCore.error);
      return __dcssCore.waiting && __dcssVerification.semanticHistory.some(entry =>
        entry.session === session && BigInt(entry.event.sequence) > BigInt(sequence)
        && entry.event.message.id === 'game.canned.no_spells');
    }, before.session, previous), 'new resumed source event in its own observer session');
    const fresh = await evaluate(cdp, function () { return __dcssVerification.semanticHistory.at(-1); });
    assert.equal(fresh.session, before.session);
    if (previous === '0') assert.equal(fresh.event.sequence, '1');
    assert.equal(fresh.event.source, 'canned-v1');
    record.new_native_event = fresh;
    record.checks.push('Ordinary resumed I admits exact native sequence one in a new host session without dropping saved history');
  }
  const baseline = await evaluate(cdp, async function () {
    return { state: await __dcssCore.state(), history: __dcssVerification.semanticHistory,
      checkpoint: __dcssVerification.semanticCheckpoint(), callbacks: __dcssHistoryObserverProbe.callbacks,
      announcer: document.querySelector('#semantic-announcer').textContent };
  });
  assert.equal(baseline.state.rng.length, 45);
  for (const selected of ['en', 'ja', 'en']) {
    const observed = await evaluate(cdp, async function (language) {
      const selector = document.querySelector('#language');
      selector.value = language; selector.dispatchEvent(new Event('change', { bubbles: true }));
      const history = __dcssVerification.semanticHistory;
      const rendered = history.map(entry => ({
        identity: entry.session + ':' + entry.event.sequence,
        response: __dcssVerification.call({ op: 'game_message', event: entry.event }),
        runs: __dcssVerification.call({ op: 'text_runs', message: entry.event.message }).value,
      }));
      const lines = Array.from(document.querySelector('#semantic-messages').children, node => ({
        identity: node.dataset.identity, text: node.textContent, children: node.childElementCount,
      }));
      return { state: await __dcssCore.state(), history, lines, rendered,
        checkpoint: __dcssVerification.semanticCheckpoint(),
        callbacks: __dcssHistoryObserverProbe.callbacks,
        announcer: document.querySelector('#semantic-announcer').textContent, language: document.documentElement.lang };
    }, selected);
    assert.equal(observed.language, selected);
    assert.deepEqual(observed.state, baseline.state, 'locale render must preserve all45 native words/draws');
    assert.deepEqual(observed.history, baseline.history);
    assert.deepEqual(observed.checkpoint, baseline.checkpoint);
    assert.equal(observed.callbacks, baseline.callbacks);
    assert.equal(observed.announcer, baseline.announcer);
    assert.equal(new Set(observed.lines.map(line => line.identity)).size, observed.lines.length);
    assert.deepEqual(observed.lines.map(line => line.identity), observed.rendered.map(entry => entry.identity));
    for (const entry of observed.rendered) {
      const line = observed.lines.find(value => value.identity === entry.identity);
      assert.equal(line.children, 0); assert.equal(line.text, entry.response.text[0]);
      assert.equal(entry.runs.runs.map(run => run.text).join(''), entry.runs.text);
      if (!entry.response.value.event.shout) assert.equal(entry.runs.text, line.text);
    }
  }
  record.checks.push('Restored JA/EN plain runs, session-qualified DOM lines and quiet locale redraw preserve raw history and all45 PCG states');
  record.result = 'pass';
  evidence.checks.push(...record.checks.slice(1));
  return record;
}


// A separate genuine native reload from the actual Rust-validated legacy wire.
// Existing v2 continuation comparison remains intact before this fresh Worker.
export async function verifyLegacyNativeResume({ cdp, until, evidence, base }) {
  const legacy = legacyWitnesses.get(cdp);
  assert(legacy, 'actual legacy import witness must be prepared from the native save');
  await evaluate(cdp, async function (save) {
    const checked = __dcssVerification.call({ op: 'unpack_native', save }).value;
    if (checked.semantic != null) throw Error('legacy import unexpectedly contains semantic history');
    const { put } = await import('/web/storage.mjs');
    await put('dcss.native-development.v1', save);
  }, legacy.save);
  await cdp.call('Page.navigate', { url: base + '?resume=1' });
  await until(() => evaluate(cdp, async function (turn) {
    return Boolean(window.__dcssCore?.waiting) && (await __dcssCore.state()).turn === turn;
  }, evidence.saved.turn), 'actual legacy-v1 native reload');
  const restored = await evaluate(cdp, async function () {
    return { state: await __dcssCore.state(), history: __dcssVerification.semanticHistory,
      session: __dcssVerification.semanticSession, errors: __dcssVerification.semanticErrors,
      bootFiles: __dcssHistoryObserverProbe.bootFiles,
      restoreDeltas: __dcssHistoryObserverProbe.restoreCallbackDeltas,
      announcer: document.querySelector('#semantic-announcer').textContent };
  });
  const logical = value => ({ ...value, rng: value.rng.map(({ draws, ...stream }) => stream) });
  assert.deepEqual(logical(restored.state), logical(evidence.saved));
  assert.deepEqual(restored.bootFiles, legacy.files, 'Rust-decoded v1 bytes must be passed to the fresh Worker unchanged');
  assert.deepEqual(restored.history, []); assert.equal(restored.session, '1');
  assert.equal(restored.errors, 0); assert.equal(restored.announcer, '');
  assert.deepEqual(restored.restoreDeltas, [0]);
  await evaluate(cdp, function () { __dcssCore.queue(46); });
  await until(() => evaluate(cdp, async function (turn) {
    return __dcssCore.waiting && (await __dcssCore.state()).turn > turn;
  }, evidence.saved.turn), 'legacy-v1 next native wait command');
  const next = await evaluate(cdp, async function () { return __dcssCore.state(); });
  assert.deepEqual(logical(next), logical(evidence.expectedNext));
  evidence.legacyNativeV1 = { result: 'pass', actualRustImport: true, actualFreshNativeResume: true,
    rawNativeBytesUnchanged: true, emptySemanticHistory: true, observerCallbacksReplayed: false,
    state: restored.state, next, diagnosticDrawCountsExcludedOnlyAcrossResume: true };
  evidence.checks.push('Actual legacy native-v1 import restores unchanged bytes, empty history, all45 PCG words and deterministic next wait');
}
