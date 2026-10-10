// Browser adapter for an owned Rust presentation model. No source widget,
// gameplay descriptor, lifetime, scalar, stat, spell or menu composition here.
import { PALETTE } from './core.js';

export const MAX_MODEL_BYTES = 8 * 1024 * 1024;
const MAX_STRING_BYTES = 128 * 1024;
const encoder = new TextEncoder();
const empty = { schema_version: 1, locale: 'ja', state_summary: '', sections: [], messages: [], message_ids: [], missing_ids: [], semantic: { scopes: [], messages: [] } };
const text = value => typeof value === 'string' && encoder.encode(value).length <= MAX_STRING_BYTES;
const code = value => value === null || (Number.isInteger(value) && value > 0 && value <= 0x10ffff && !(value >= 0xd800 && value <= 0xdfff));

export function parsePresentationModel(input) {
  const json = typeof input === 'string' ? input : JSON.stringify(input);
  if (typeof json !== 'string' || encoder.encode(json).length > MAX_MODEL_BYTES) throw new Error('presentation model size');
  const model = JSON.parse(json);
  const pending = [[model, 0]];
  let nodes = 0;
  while (pending.length) {
    const [value, depth] = pending.pop();
    if (++nodes > 500000 || depth > 48) throw new Error('presentation model complexity');
    if (typeof value === 'string' && !text(value)) throw new Error('presentation model string size');
    if (value && typeof value === 'object') {
      for (const [key, item] of Object.entries(value)) {
        if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('presentation model key');
        pending.push([item, depth + 1]);
      }
      Object.freeze(value);
    }
  }
  if (model?.input_max_bytes !== undefined && model.input_max_bytes !== null && !(Number.isInteger(model.input_max_bytes) && model.input_max_bytes >= 0 && model.input_max_bytes <= 65536)) throw new Error('presentation input byte limit');
  if (!model || model.schema_version !== 1 || !['en', 'ja'].includes(model.locale) || !text(model.state_summary)) throw new Error('presentation model version');
  if (!Array.isArray(model.sections) || model.sections.length > 64 || !Array.isArray(model.messages) || model.messages.length > 4) throw new Error('presentation model collections');
  if (!Array.isArray(model.message_ids) || model.message_ids.length > 100 || !model.message_ids.every(text)
      || !Array.isArray(model.missing_ids) || model.missing_ids.length > 100 || !model.missing_ids.every(text)) throw new Error('presentation message metadata');
  if (!model.semantic || !Array.isArray(model.semantic.scopes) || !Array.isArray(model.semantic.messages)) throw new Error('presentation diagnostics');
  let blocks = 0;
  for (const section of model.sections) {
    if (!section || !text(section.key) || !text(section.heading) || !Array.isArray(section.blocks)) throw new Error('presentation section');
    for (const block of section.blocks) {
      if (++blocks > 16384 || !block || !text(block.key)) throw new Error('presentation blocks');
      if (block.kind === 'paragraph') {
        if (!text(block.text) || typeof block.selected !== 'boolean' || !code(block.activation_key)
            || !(block.color === null || (Number.isInteger(block.color) && block.color >= 0 && block.color < PALETTE.length))) throw new Error('presentation paragraph');
        if (block.runs !== undefined && (!Array.isArray(block.runs) || block.runs.length > 32769
            || !block.runs.every(run => run && text(run.text) && typeof run.highlighted === 'boolean')
            || block.runs.map(run => run.text).join('') !== block.text)) throw new Error('presentation text runs');
      } else if (block.kind === 'table') {
        if (!text(block.class_name) || !/^[a-z][a-z0-9-]{0,63}$/.test(block.class_name)
            || !Array.isArray(block.headers) || block.headers.length > 32 || !block.headers.every(text)
            || !Array.isArray(block.rows) || block.rows.length > 512
            || !block.rows.every(row => Array.isArray(row) && row.length === block.headers.length && row.every(text))) throw new Error('presentation table');
      } else throw new Error('presentation block kind');
    }
  }
  if (!model.messages.every(message => message && text(message.id) && text(message.text))) throw new Error('presentation message');
  return model;
}

export const EMPTY_PRESENTATION_MODEL = parsePresentationModel(empty);

export function renderPresentationModel(container, model, onActivate = null, document_ = document) {
  container.replaceChildren();
  for (const section of model.sections) {
    const element = document_.createElement('section');
    if (section.heading) {
      const heading = document_.createElement('h3');
      heading.textContent = section.heading;
      element.append(heading);
    }
    for (const block of section.blocks) {
      if (block.kind === 'paragraph') {
        const row = document_.createElement(block.activation_key === null ? 'p' : 'button');
        if (block.runs?.length) {
          for (const run of block.runs) {
            const span = document_.createElement(run.highlighted ? 'mark' : 'span');
            span.textContent = run.text;
            row.append(span);
          }
        } else row.textContent = block.text;
        row.className = block.selected ? 'semantic-row selected' : 'semantic-row';
        if (block.selected) row.setAttribute('aria-current', 'true');
        if (block.color !== null) row.style.color = PALETTE[block.color];
        if (block.activation_key !== null) {
          row.type = 'button';
          row.addEventListener('click', () => onActivate?.(block.activation_key));
        }
        element.append(row);
      } else if (block.kind === 'table') {
        const table = document_.createElement('table');
        table.className = block.class_name;
        const header = document_.createElement('tr');
        for (const text of block.headers) {
          const cell = document_.createElement('th');
          cell.textContent = text;
          header.append(cell);
        }
        table.append(header);
        for (const values of block.rows) {
          const row = document_.createElement('tr');
          for (const [index, text] of values.entries()) {
            const cell = document_.createElement(index === 0 ? 'th' : 'td');
            cell.textContent = text;
            row.append(cell);
          }
          table.append(row);
        }
        element.append(table);
      }
    }
    container.append(element);
  }
}

export function renderPresentationMessages(container, model, document_ = document) {
  container.replaceChildren();
  for (const message of model.messages) {
    const row = document_.createElement('p');
    row.textContent = message.text;
    container.append(row);
  }
}
