import { cases } from './cases.mjs';
const query = new URLSearchParams(location.search);
const variant = query.get('variant');
const specification = cases.find(item => item.id === query.get('case'));
const result = { status: 'running', variant, specification, events: [], assertions: [], errors: [], startedAt: new Date().toISOString() };
globalThis.jspiSdkHost = { events: result.events, rejection: new Error('sdk-jspi-rejection-identity'), callback: null };
const rejectEvents = [];
addEventListener('unhandledrejection', event => { rejectEvents.push({ name: event.reason?.name, message: String(event.reason?.message || event.reason) }); event.preventDefault(); });
const assert = (name, passed, actual) => result.assertions.push({ name, passed: Boolean(passed), actual });
let module;
try {
  if (!['default', 'explicit'].includes(variant) || !specification) throw new Error('Choose a declared case and build variant.');
  const { default: factory } = await import('./build/' + variant + '/probe.mjs');
  const options = { noInitialRun: specification.entry !== 'main', arguments: [String(specification.route ?? 0)],
    print: text => result.events.push('stdout:' + text), printErr: text => result.events.push('stderr:' + text),
    onRuntimeInitialized() { result.events.push('runtime-initialized'); },
    postRun: [() => result.events.push('post-run')], onAbort(reason) { result.errors.push({ abort: String(reason) }); } };
  let caught;
  try {
    module = await factory(options);
    if (specification.entry !== 'main') {
      module._probe_reset();
      const returned = module['_' + specification.entry](...specification.args);
      result.returnedPromise = returned instanceof Promise;
      result.value = await returned;
    }
  } catch (error) { caught = error; result.error = { name: error?.name, message: String(error?.message || error), sameRejection: error === jspiSdkHost.rejection }; }
  module ||= options;
  if (specification.entry === 'main') {
    const deadline = Date.now() + 1500;
    while (!result.events.includes('post-run') && !rejectEvents.length && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
  }
  if (typeof module._probe_stats === 'function') {
    const fields = ['alive', 'destroyed', 'caught', 'identity_ok', 'rethrow_ok', 'callback_result', 'last_result', 'completed', 'trace_length'];
    result.native = Object.fromEntries(fields.map((name, index) => [name, module._probe_stats(index)]));
    result.native.trace = Array.from({ length: Math.min(result.native.trace_length, 64) }, (_, index) => module._probe_stats(index + 100));
  }
  await new Promise(resolve => setTimeout(resolve, 30));
  result.unhandledRejections = rejectEvents;
  if (variant === 'default' && specification.entry !== 'main' && specification.unwrappedSuspension) {
    assert('An unselected yielding export is blocked at the promising entry boundary', caught?.name === 'SuspendError', result.error);
    result.classification = 'expected-unselected-export-limit';
  } else {
    assert('Entry outcome has the declared return or rejection identity', specification.rejection ? caught === jspiSdkHost.rejection : !caught && (specification.entry === 'main' ? result.native?.last_result : result.value) === specification.value, { value: result.value, error: result.error });
    assert('Native RAII scopes unwind and preserve destructor count', result.native?.alive === specification.alive && result.native?.destroyed === specification.destroyed, result.native);
    if (specification.caught) assert('C++ exception type, payload, identity and rethrow object are preserved', result.native?.caught === specification.caught && result.native?.identity_ok === 1 && result.native?.rethrow_ok === 1, result.native);
    if (specification.callback) assert('Synchronous C++ callback reentry preserves an immediate scalar result', jspiSdkHost.callback?.returned === 105 && jspiSdkHost.callback?.isPromise === false && result.native?.callback_result === 105, jspiSdkHost.callback);
    if (specification.entry === 'main') assert('Default main completes before postRun', result.native?.completed === 1 && result.events.includes('post-run'), result.events);
    else assert('Explicit selection preserves promised versus synchronous export behavior', result.returnedPromise === (variant === 'explicit'), result.returnedPromise);
    result.classification = 'sdk-compatibility-gate';
  }
  assert('No rejected Promise escapes the host handler', rejectEvents.length === 0, rejectEvents);
  result.status = result.assertions.every(item => item.passed) ? 'passed' : 'failed';
} catch (error) { result.status = 'failed'; result.error = { name: error.name, message: error.message }; }
result.finishedAt = new Date().toISOString();
globalThis.jspiSdkCaseResult = result;
document.getElementById('result').textContent = JSON.stringify(result, null, 2);
