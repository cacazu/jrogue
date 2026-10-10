// Run at the end of core-browser.mjs, after save/resume and mobile checks:
// await verifyLifecycleBrowser({ cdp, until, evidence });
// This module does not launch a browser or change native game state directly.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const upstream = '1eebc1a2892e1c89776a0d7a10691f8dac8d9796';
const sourceProof = [
  ['cmd-keys.h', 163, "{CONTROL('Q'), CMD_QUIT},"],
  ['main.cc', 2463, '|| confirm_prompt("quit", "Are you sure you want to abandon this character%s?",'],
  ['main.cc', 2469, 'ouch(INSTANT_DEATH, KILLED_BY_QUITTING);'],
  ['prompt.cc', 118, 'mprf(MSGCH_PROMPT, "%s (Confirm with \\"%s\\".) ", buf, require);'],
  ['prompt.cc', 122, 'if (strcasecmp(buf, require) != 0)'],
  ['end.cc', 238, 'case KILLED_BY_QUITTING: return game_exit::quit;'],
  ['end.cc', 333, 'more();'],
  ['end.cc', 336, 'display_inventory();'],
  ['invent.cc', 338, 'case 0: str = "Gear: " + slot_description(); break;'],
  ['invent.cc', 348, 'set_title(new InvTitle(this, s.empty() ? "Inventory: " + slot_description()'],
  ['message.cc', 733, 'readkey_more(user);'],
  ['hiscores.cc', 2436, 'desc += terse? "quit" : "Quit the game";'],
  ['end.cc', 355, 'string goodbye_title = make_stringf("Goodbye, %s.", you.your_name.c_str());'],
  ['end.cc', 371, 'goodbye_msg += make_stringf("\\nBest Crawlers - %s\\n",'],
  ['end.cc', 407, 'popup->on_keydown_event([&](const KeyEvent&) { return done = true; });'],
  ['end.cc', 431, 'game_ended(exit_reason);'],
  ['main.cc', 399, 'catch (const game_ended_condition &ge)'],
  ['main.cc', 403, '_reset_game();'],
  ['main.cc', 347, 'end(0);'],
  ['cmd-keys.h', 83, "{'I', CMD_DISPLAY_SPELLS},"],
  ['main.cc', 2244, 'case CMD_DISPLAY_SPELLS:       inspect_spells();         break;'],
  ['spl-cast.cc', 698, 'canned_msg(MSG_NO_SPELLS);'],
];

function evaluate(cdp, callback, ...args) {
  return cdp.eval('(' + callback.toString() + ')(' + args.map(value => JSON.stringify(value)).join(',') + ')');
}

async function fixture() {
  const files = new Map(), receipts = [];
  for (const [name, line, required] of sourceProof) {
    if (!files.has(name)) files.set(name, await readFile(path.join(root, 'upstream/crawl-ref/source', name), 'utf8'));
    const text = files.get(name);
    assert.equal(text.split('\n')[line - 1].trim(), required,
      'official quit fixture source changed: ' + name + ':' + line);
    receipts.push({ file: 'crawl-ref/source/' + name, line, required });
  }
  const hashes = Object.fromEntries(Array.from(files, ([name, text]) =>
    ['crawl-ref/source/' + name, createHash('sha256').update(text).digest('hex')]));
  const ended = {};
  for (const language of ['ja', 'en']) {
    const catalog = JSON.parse(await readFile(path.join(root, 'locales/' + language + '.json'), 'utf8'));
    ended[language] = catalog['status.game_ended'];
    assert.equal(typeof ended[language], 'string');
    assert(ended[language].length > 0);
  }
  return { receipts, hashes, ended };
}

function snapshot(cdp) {
  return evaluate(cdp, function () {
    const frame = __dcssVerification.frame;
    const rows = frame ? Array.from({ length: frame.rows }, (_, row) => frame.cells
      .slice(row * frame.columns, (row + 1) * frame.columns)
      .map(cell => cell.text ?? (cell.glyph ? String.fromCodePoint(cell.glyph) : '')).join('')) : [];
    const probe = window.__dcssLifecycleBrowserProbe;
    return {
      waiting: __dcssCore.waiting, completed: __dcssCore.completed, error: __dcssCore.error,
      frames: __dcssCore.frames, rows, nativeText: rows.join('\n'),
      status: document.querySelector('#status').textContent,
      language: __dcssVerification.language, documentLanguage: document.documentElement.lang,
      player: document.querySelector('#player').value,
      messages: __dcssVerification.semanticMessages, semanticErrors: __dcssVerification.semanticErrors,
      semanticHistory: __dcssVerification.semanticHistory, semanticSession: __dcssVerification.semanticSession,
      lines: Array.from(document.querySelector('#semantic-messages').children, line => ({
        sequence: line.dataset.sequence, session: line.dataset.session, identity: line.dataset.identity,
        text: line.textContent, children: line.childElementCount,
      })),
      announcer: document.querySelector('#semantic-announcer').textContent,
      controls: Array.from(document.querySelectorAll('#core-panel [data-key], #core-save'), control => ({
        id: control.id, key: control.dataset.key ?? null, disabled: control.disabled,
      })),
      completedEvents: probe.completedEvents, errors: probe.errors, terminations: probe.terminations,
      transport: probe.transport,
    };
  });
}

async function dispatch(cdp, key, code, { modifiers = 0, text = key } = {}) {
  await cdp.call('Input.dispatchKeyEvent', { type: 'keyDown', key, code, modifiers, text });
  await cdp.call('Input.dispatchKeyEvent', { type: 'keyUp', key, code, modifiers });
}

async function nextPrompt(cdp, until, previous, label) {
  return until(async () => {
    const current = await snapshot(cdp);
    if (current.error) throw Error(current.error);
    assert.equal(current.completed, false, 'native engine ended before its actual goodbye screen was inspected');
    return current.waiting && current.frames > previous.frames
      && current.nativeText !== previous.nativeText ? current : false;
  }, label);
}

export async function verifyLifecycleBrowser({ cdp, until, evidence }) {
  const official = await fixture();
  const record = evidence.lifecycleBrowser = {
    result: 'running', upstream, fixture: 'ordinary Ctrl-Q, typed quit, native game-over popup',
    controlled_terminal_reason: 'quit', death_verified: false, victory_verified: false,
    wizard_commands_used: false, native_heap_or_state_injection: false,
    local_browser_only: true, source_receipts: official.receipts, source_hashes: official.hashes,
    ending_prompts: [], checks: [],
  };
  const check = label => { record.checks.push(label); evidence.checks.push(label); };
  await evaluate(cdp, function () {
    if (window.__dcssLifecycleBrowserProbe) throw Error('lifecycle probe already installed');
    const probe = { completedEvents: [], errors: [], terminations: 0, transport: [] };
    const postMessage = Worker.prototype.postMessage, terminate = Worker.prototype.terminate;
    const completed = event => probe.completedEvents.push({ status: event.detail.status });
    const failed = event => probe.errors.push({ message: event.detail.message });
    Worker.prototype.postMessage = function (message, ...rest) {
      // Observe the real browser adapter. Do not alter, delay, or copy save data.
      if (message?.type === 'key') probe.transport.push({ type: 'key', key: message.key });
      if (message?.type === 'request') probe.transport.push({ type: 'request', op: message.op });
      return postMessage.call(this, message, ...rest);
    };
    Worker.prototype.terminate = function (...args) {
      probe.terminations++;
      return terminate.apply(this, args);
    };
    window.addEventListener('dcss-core-completed', completed);
    window.addEventListener('dcss-core-error', failed);
    probe.restore = () => {
      Worker.prototype.postMessage = postMessage; Worker.prototype.terminate = terminate;
      window.removeEventListener('dcss-core-completed', completed);
      window.removeEventListener('dcss-core-error', failed);
    };
    window.__dcssLifecycleBrowserProbe = probe;
  });

  try {
    let before = await snapshot(cdp);
    assert.equal(before.completed, false); assert.equal(before.error, null);
    assert.equal(before.waiting, true); assert.equal(before.semanticErrors, 0);
    assert.equal(before.language, 'ja');
    // A save/resume navigation starts a fresh semantic session. Prepare one
    // authentic retained message so terminal-history assertions are meaningful.
    const previousSession = before.semanticSession;
    const previousHistory = before.semanticHistory;
    const previousSequence = previousHistory.filter(entry => entry.session === previousSession)
      .reduce((maximum, entry) => BigInt(entry.event.sequence) > maximum ? BigInt(entry.event.sequence) : maximum, 0n);
    record.prepared_history_context = { session: previousSession, previous_sequence: previousSequence.toString(),
      before: previousHistory };
    await evaluate(cdp, function () { document.querySelector('#console').focus(); });
    await dispatch(cdp, 'I', 'KeyI', { modifiers: 8 });
    before = await until(async () => {
      const value = await snapshot(cdp);
      if (value.error) throw Error(value.error);
      record.prepared_history_context.last_observed = { session: value.semanticSession, history: value.semanticHistory };
      assert.equal(value.semanticSession, previousSession, 'ordinary I must retain the active host session');
      assert.deepEqual(value.semanticHistory.slice(0, previousHistory.length), previousHistory,
        'all prior session-qualified native records must remain unchanged');
      assert.equal(value.semanticErrors, 0);
      return value.waiting && value.semanticHistory.some(entry => entry.session === previousSession
        && BigInt(entry.event.sequence) > previousSequence
        && entry.event.message.id === 'game.canned.no_spells') ? value : false;
    }, 'genuine retained message before terminal fixture');
    const addedEntries = before.semanticHistory.slice(previousHistory.length);
    assert.equal(addedEntries.length, 1); assert.equal(before.semanticErrors, 0);
    assert.equal(addedEntries[0].session, previousSession);
    assert(BigInt(addedEntries[0].event.sequence) > previousSequence, 'fresh event must advance within the active session');
    const added = addedEntries.map(entry => entry.event);
    assert.deepEqual(added[0].message, { id: 'game.canned.no_spells', params: {} });
    assert.equal(added[0].source, 'canned-v1'); assert.equal(added[0].upstream, upstream);
    assert.deepEqual(before.messages, before.semanticHistory.map(entry => entry.event));
    assert.deepEqual(before.lines.map(line => ({ session: line.session, sequence: line.sequence, identity: line.identity })),
      before.semanticHistory.map(entry => ({ session: entry.session, sequence: entry.event.sequence,
        identity: entry.session + ':' + entry.event.sequence })), 'every qualified record retains its distinct DOM identity');
    record.prepared_history_event = added[0];
    record.prepared_history_entry = addedEntries[0];
    record.pre_quit_turn = await evaluate(cdp, async function () { return (await __dcssCore.state()).turn; });
    record.player = before.player;
    await evaluate(cdp, function () { document.querySelector('#console').focus(); });
    await dispatch(cdp, 'q', 'KeyQ', { modifiers: 2, text: '\u0011' });
    let current = await nextPrompt(cdp, until, before, 'genuine Ctrl-Q quit confirmation');
    const confirmation = current.nativeText.replace(/\s+/g, ' ');
    assert(confirmation.includes('Are you sure you want to abandon this character'), 'native abandon prompt must be visible');
    assert(confirmation.includes('Confirm with "quit".'), 'official confirmation requires the full word quit');
    record.confirmation_native_rows = current.rows;
    assert.deepEqual(current.transport.filter(message => message.type === 'key'),
      [{ type: 'key', key: 73 }, { type: 'key', key: 17 }],
      'physical Ctrl-Q must cross Rust as the official control key 17');
    check('Physical Ctrl-Q reaches official abandon-character confirmation through Rust input');

    const confirmationFrame = current;
    for (const letter of 'quit') await dispatch(cdp, letter, 'Key' + letter.toUpperCase());
    await dispatch(cdp, 'Enter', 'Enter', { text: '\r' });
    current = await nextPrompt(cdp, until, confirmationFrame, 'official accepted quit ending UI');
    // Only the source-proven more prompt and final inventory may precede the
    // real goodbye popup. Unknown screens fail; no blind key spam is allowed.
    for (let ordinal = 0; ordinal < 8; ordinal++) {
      if (current.nativeText.includes('Goodbye, ' + before.player + '.')
          && current.nativeText.includes('Best Crawlers -')) break;
      const text = current.nativeText;
      let kind, key, code, typed;
      if (/\b(?:Gear: \d+\/\d+ gear slots|Inventory: \d+\/\d+ gear slots)/.test(text)
          || /\b(?:Potions|Scrolls|Evocable Items):\s+.*Left\/Right to switch category/.test(text)) {
        kind = 'native identified final inventory'; key = 'Escape'; code = 'Escape'; typed = '';
      } else if (text.includes('--more--')) { kind = 'native end-game more'; key = ' '; code = 'Space'; typed = ' '; }
      else throw Error('Unknown official quit ending prompt: ' + JSON.stringify(current.rows));
      record.ending_prompts.push({ kind, native_rows: current.rows, key });
      const previous = current;
      await dispatch(cdp, key, code, { text: typed });
      current = await nextPrompt(cdp, until, previous, 'quit ending prompt ' + (ordinal + 1));
    }
    assert(current.nativeText.includes('Goodbye, ' + before.player + '.'), 'genuine native game-over title must appear');
    assert(current.nativeText.includes('Best Crawlers -'), 'genuine native high-score popup must appear');
    assert(current.nativeText.includes('Quit the game'), 'native score description must identify this controlled quit');
    record.goodbye_native_rows = current.rows;
    record.retained_message_sequences = current.messages.map(event => event.sequence);
    check('Typed quit traverses original more/inventory prompts and the native Quit the game score popup');

    await evaluate(cdp, function () {
      const probe = window.__dcssLifecycleBrowserProbe;
      probe.nodes = Array.from(document.querySelector('#semantic-messages').children);
      probe.terminalTransportStart = probe.transport.length;
      // Queue real terminal input before these requests. The worker must settle
      // all pending requests when native teardown completes, without reopening
      // an engine or calling an export after the session has ended.
      __dcssCore.queue(13);
      probe.terminalRequests = Promise.all(['state', 'repaint', 'save', 'files'].map(op => {
        try {
          return __dcssCore[op]().then(
            () => ({ op, status: 'fulfilled' }),
            error => ({ op, status: 'rejected', error: String(error.message ?? error) }));
        } catch (error) { return { op, status: 'rejected', error: String(error.message ?? error) }; }
      }));
    });
    const ended = await until(async () => {
      const value = await snapshot(cdp);
      if (value.error) throw Error(value.error);
      return value.completed ? value : false;
    }, 'normal original-engine session completion');
    const pending = await evaluate(cdp, async function () { return await window.__dcssLifecycleBrowserProbe.terminalRequests; });
    assert.deepEqual(pending.map(result => [result.op, result.status]),
      ['state', 'repaint', 'save', 'files'].map(op => [op, 'rejected']));
    for (const result of pending) assert.match(result.error, /engine session completed/);
    const terminalTransport = await evaluate(cdp, function () {
      const probe = window.__dcssLifecycleBrowserProbe;
      return probe.transport.slice(probe.terminalTransportStart);
    });
    assert.deepEqual(terminalTransport, [{ type: 'key', key: 13 },
      ...['state', 'repaint', 'save', 'files'].map(op => ({ type: 'request', op }))]);
    record.pending_terminal_requests = pending;
    assert.equal(ended.waiting, false); assert.equal(ended.error, null);
    assert.deepEqual(ended.completedEvents, [{ status: 0 }]);
    assert.deepEqual(ended.errors, []); assert.equal(ended.terminations, 1);
    assert.equal(ended.status, official.ended.ja);
    assert.equal(ended.semanticErrors, 0); assert.deepEqual(ended.messages, current.messages);
    assert(ended.controls.length > 0 && ended.controls.every(control => control.disabled));
    check('Native status0 settles queued requests, releases its Worker once and displays Japanese completion');

    const postCompleted = await evaluate(cdp, async function () {
      const outcomes = [];
      for (const op of ['state', 'repaint', 'save', 'files']) {
        try { await __dcssCore[op](); outcomes.push({ op, status: 'fulfilled' }); }
        catch (error) { outcomes.push({ op, status: 'rejected', error: String(error.message ?? error) }); }
      }
      __dcssCore.queue(46);
      for (const button of document.querySelectorAll('#core-panel [data-key], #core-save')) button.click();
      document.querySelector('#console').focus();
      return outcomes;
    });
    await dispatch(cdp, '.', 'Period');
    assert(postCompleted.every(result => result.status === 'rejected'));
    for (const result of postCompleted) assert.match(result.error, /engine session completed/);
    record.post_completed_requests = postCompleted;
    const closed = await snapshot(cdp);
    assert.deepEqual(closed.transport, ended.transport, 'closed commands and helpers must never reach the terminated Worker');
    assert.equal(closed.frames, ended.frames, 'closed actions must not repaint native state');
    assert.equal(closed.status, official.ended.ja); assert.equal(closed.error, null);
    assert.deepEqual(closed.messages, ended.messages); assert.deepEqual(closed.errors, []);
    check('Completed helpers reject and disabled touch/save plus keyboard/direct queue send no further engine commands');

    for (const language of ['en', 'ja']) {
      await evaluate(cdp, function (value) {
        const select = document.querySelector('#language');
        select.value = value; select.dispatchEvent(new Event('change', { bubbles: true }));
      }, language);
      const localized = await snapshot(cdp);
      assert.equal(localized.language, language); assert.equal(localized.documentLanguage, language);
      assert.equal(localized.status, official.ended[language]);
      assert.equal(localized.completed, true); assert.equal(localized.error, null);
      assert.deepEqual(localized.messages, ended.messages); assert.equal(localized.semanticErrors, 0);
      assert.deepEqual(localized.transport, ended.transport); assert.equal(localized.frames, ended.frames);
      assert.equal(localized.announcer, ended.announcer, 'locale redraw must not announce ended history again');
      assert(localized.controls.every(control => control.disabled));
      assert.equal(await evaluate(cdp, function () {
        return window.__dcssLifecycleBrowserProbe.nodes.every((node, index) =>
          document.querySelector('#semantic-messages').children[index] === node);
      }), true, 'ended session locale changes must retain history DOM nodes');
      assert.equal(await evaluate(cdp, function () {
        return Array.from(document.querySelector('#semantic-messages').children).every((line, index) => {
          const event = __dcssVerification.semanticMessages[index];
          const response = __dcssVerification.call({ op: 'game_message', event });
          return line.childElementCount === 0 && line.dataset.sequence === event.sequence
            && line.textContent === response.text[0];
        });
      }), true, 'ended session history must still render through the current Rust locale');
    }
    check('English/Japanese changes retain localized ended status and immutable session history without engine activity');
    record.normal_exit_status = 0; record.state_read_after_native_teardown = false;
    record.result = 'pass';
    return record;
  } catch (error) {
    record.result = 'fail'; record.error = error.stack;
    throw error;
  } finally {
    await evaluate(cdp, function () {
      window.__dcssLifecycleBrowserProbe?.restore();
      delete window.__dcssLifecycleBrowserProbe;
    });
  }
}
