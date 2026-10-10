// Authored fixture: ordinary Wasm instructions, no Emscripten or game binary.
export function makeProbeModule() {
  const uleb = value => { const bytes = []; do { const byte = value & 127; value >>>= 7; bytes.push(byte | (value ? 128 : 0)); } while (value); return bytes; };
  const string = text => { const bytes = [...new TextEncoder().encode(text)]; return [...uleb(bytes.length), ...bytes]; };
  const section = (id, bytes) => [id, ...uleb(bytes.length), ...bytes];
  const body = bytes => [...uleb(bytes.length + 1), 0, ...bytes];
  return new Uint8Array([
    0, 97, 115, 109, 1, 0, 0, 0,
    ...section(1, [1, 0x60, 1, 0x7f, 1, 0x7f]), // (i32) -> i32
    ...section(2, [2, ...string('env'), ...string('wait'), 0, 0, ...string('env'), ...string('relay'), 0, 0]),
    ...section(3, [3, 0, 0, 0]),
    ...section(7, [3, ...string('run'), 0, 2, ...string('sync'), 0, 3, ...string('through_js'), 0, 4]),
    ...section(10, [3,
      ...body([0x20, 0, 0x10, 0, 0x41, 1, 0x6a, 0x0b]), // wait(value) + 1
      ...body([0x20, 0, 0x41, 2, 0x6a, 0x0b]), // value + 2
      ...body([0x20, 0, 0x10, 1, 0x41, 1, 0x6a, 0x0b]) // relay(value) + 1
    ])
  ]);
}

export async function runProbe() {
  const result = { startedAt: new Date().toISOString(), userAgent: navigator.userAgent,
    features: { Suspending: typeof WebAssembly.Suspending, promising: typeof WebAssembly.promising,
      SuspendError: typeof WebAssembly.SuspendError }, assertions: [], observations: [], unhandledRejections: [] };
  const unhandled = event => { result.unhandledRejections.push(String(event.reason)); event.preventDefault(); };
  addEventListener('unhandledrejection', unhandled);
  const check = (name, passed, details) => { result.assertions.push({ name, passed: Boolean(passed), details }); if (!passed) throw new Error(name); };
  try {
    check('JSPI APIs exist without enabling a Chrome JSPI flag', result.features.Suspending === 'function' && result.features.promising === 'function', result.features);
    const bytes = makeProbeModule();
    result.wasmBytes = [...bytes];
    check('Tiny authored ordinary-Wasm module validates', WebAssembly.validate(bytes), { bytes: bytes.length });
    const module = new WebAssembly.Module(bytes);
    const events = [];
    let relay = () => 0;
    const sentinel = new Error('jspi-probe-rejection');
    const wait = value => {
      events.push('import-enter:' + value);
      return new Promise((resolve, reject) => setTimeout(() => {
        events.push('import-settle:' + value);
        value < 0 ? reject(sentinel) : resolve(value * 10);
      }, value === 7 ? 25 : (31 - value % 32) % 7));
    };
    const instance = new WebAssembly.Instance(module, { env: { wait: new WebAssembly.Suspending(wait), relay: value => relay(value) } });
    const run = WebAssembly.promising(instance.exports.run);
    events.push('caller-before');
    const pending = run(7);
    check('Promising export immediately returns a Promise', pending instanceof Promise, null);
    events.push('caller-after');
    setTimeout(() => events.push('host-event-loop-timer'), 0);
    const value = await pending;
    events.push('caller-resolved:' + value);
    check('Real asynchronous suspend/resume returns the imported resolved value', value === 71, { value });
    check('Browser event loop runs while the Wasm continuation is suspended', events.indexOf('host-event-loop-timer') > events.indexOf('caller-after') && events.indexOf('host-event-loop-timer') < events.indexOf('caller-resolved:71'), events);
    check('Continuation resumes after Promise settlement', events.indexOf('import-settle:7') < events.indexOf('caller-resolved:71'), events);
    result.observations.push({ name: 'suspend-resume-order', events: [...events] });
    let rejected;
    try { await run(-1); } catch (error) { rejected = error; }
    check('Imported rejection rejects the exported Promise with the same error object', rejected === sentinel, { name: rejected?.name, message: rejected?.message });
    const rapid = Array.from({ length: 32 }, (_, index) => run(index));
    check('Ordinary synchronous Wasm remains callable while other continuations suspend', instance.exports.sync(40) === 42, null);
    const rapidValues = await Promise.all(rapid);
    check('32 rapid concurrent suspensions each resume with their own value', rapidValues.every((value, index) => value === index * 10 + 1), rapidValues);
    const synchronous = WebAssembly.promising(instance.exports.sync)(40);
    check('Promising wrapper also returns a Promise for a synchronous export', synchronous instanceof Promise && await synchronous === 42, null);
    const throughJS = WebAssembly.promising(instance.exports.through_js);
    relay = value => instance.exports.sync(value);
    check('Wasm to ordinary JavaScript to synchronous Wasm reentry succeeds', await throughJS(10) === 13, null);
    relay = value => instance.exports.run(value);
    let crossing;
    try { await throughJS(11); } catch (error) { crossing = error; }
    check('Suspending across an ordinary JavaScript frame is rejected', crossing instanceof WebAssembly.SuspendError, { name: crossing?.name, message: crossing?.message });
    result.observations.push({ name: 'ordinary-js-frame-suspension-limit', nameOfError: crossing?.name, message: crossing?.message });
    let direct;
    try { instance.exports.run(12); } catch (error) { direct = error; }
    check('Unwrapped entry cannot suspend without a promising boundary', direct instanceof WebAssembly.SuspendError, { name: direct?.name, message: direct?.message });
    const nestedInstance = new WebAssembly.Instance(module, { env: {
      wait: new WebAssembly.Suspending(wait),
      relay: new WebAssembly.Suspending(async value => (await run(value)) + 3)
    } });
    const nested = WebAssembly.promising(nestedInstance.exports.through_js);
    check('A suspending import may await a separately promising nested Wasm entry', await nested(13) === 135, null);
    let nestedRejection;
    try { await nested(-2); } catch (error) { nestedRejection = error; }
    check('Nested explicitly wrapped Promise rejection propagates', nestedRejection === sentinel, { name: nestedRejection?.name, message: nestedRejection?.message });
    await new Promise(resolve => setTimeout(resolve, 50));
    check('All rejected Promises are handled; no unhandledrejection event', result.unhandledRejections.length === 0, result.unhandledRejections);
    result.status = 'passed';
  } catch (error) { result.status = 'failed'; result.error = { name: error.name, message: error.message, stack: error.stack }; }
  finally { removeEventListener('unhandledrejection', unhandled); result.finishedAt = new Date().toISOString(); }
  return result;
}

window.jspiProbeResult = await runProbe();
document.getElementById('result').textContent = JSON.stringify(window.jspiProbeResult, null, 2);
