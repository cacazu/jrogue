// Display-only projection of source-tagged messages. It owns no engine control.
// Rust validates checkpoint sources, ordering, bounds, params and both locales.
const UPSTREAM = '1eebc1a2892e1c89776a0d7a10691f8dac8d9796';

export class SemanticLog {
  #events = [];
  #session = '1';
  #lastSequence = 0n;
  #capacity;
  #boundary;

  constructor(boundary, capacity = 200) {
    if (typeof boundary !== 'function' || !Number.isSafeInteger(capacity) || capacity < 1 || capacity > 1000) {
      throw new TypeError('invalid semantic log configuration');
    }
    this.#boundary = boundary;
    this.#capacity = capacity;
  }

  append(event) {
    const response = this.#boundary({ op: 'game_message', event });
    const validated = structuredClone(response.value.event);
    const sequence = BigInt(validated.sequence);
    if (sequence <= this.#lastSequence) throw new Error('semantic event sequence was repeated or reordered');
    this.#lastSequence = sequence;
    this.#events.push({ session: this.#session, event: validated });
    if (this.#events.length > this.#capacity) this.#events.shift();
    return { session: this.#session, event: structuredClone(validated), text: response.text[0] };
  }

  restore(checkpoint = null) {
    // One Rust transaction validates every record and renders it before any
    // projection changes. No C++ callbacks, input, pauses or hooks are replayed.
    const response = this.#boundary({ op: 'semantic_checkpoint', checkpoint, resume: true });
    const validated = structuredClone(response.value.checkpoint);
    if (!Array.isArray(validated.events) || response.text.length !== validated.events.length) {
      throw new Error('invalid semantic checkpoint boundary response');
    }
    const retained = validated.events.slice(-this.#capacity);
    const rendered = retained.map((entry, index) => ({
      ...structuredClone(entry),
      text: response.text[validated.events.length - retained.length + index],
    }));
    if (rendered.some(entry => typeof entry.text !== 'string')) {
      throw new Error('invalid semantic checkpoint rendering');
    }
    // The new session has no native observations yet. Its real source counter
    // will start at one; all old exact sequences remain in their own segments.
    this.#events = retained;
    this.#session = validated.session;
    this.#lastSequence = 0n;
    return rendered;
  }

  checkpoint() {
    // Files/history are joined and validated again by pack_native before put().
    return { version: 1, upstream: UPSTREAM, session: this.#session,
      events: structuredClone(this.#events) };
  }

  render() {
    // Locale changes render descriptors quietly; they cannot execute gameplay.
    return this.#events.map(({ session, event }) => ({
      session, event: structuredClone(event),
      text: this.#boundary({ op: 'game_message', event }).text[0],
    }));
  }

  // Preserve the existing diagnostic API. Session-qualified history is separate.
  snapshot() { return this.#events.map(entry => structuredClone(entry.event)); }
  history() { return structuredClone(this.#events); }
  get length() { return this.#events.length; }
  get session() { return this.#session; }
}
