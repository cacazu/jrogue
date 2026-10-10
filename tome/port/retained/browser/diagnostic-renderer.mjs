// SPDX-License-Identifier: GPL-3.0-or-later
// Pure DOM projection: no native callbacks, input mapping, simulation, or RNG.

export function renderDiagnostic(root, presentation) {
  const labels = presentation.labels;
  const label = id => {
    if (!Object.hasOwn(labels, id)) throw new Error(`Missing semantic UI text: ${id}`);
    return labels[id];
  };
  for (const node of root.querySelectorAll('[data-text-id]')) {
    node.textContent = label(node.dataset.textId);
  }
  const status = root.querySelector('[data-tome-status]');
  if (status) status.textContent = label(presentation.status_id);
  const game = presentation.view?.game;
  const player = game?.player;
  const fields = {
    name: player?.name, turn: game?.turn, life: player?.life,
    max_life: player?.max_life, level: player?.level, energy: player?.energy?.value,
    x: player?.x, y: player?.y,
  };
  for (const node of root.querySelectorAll('[data-tome-field]')) {
    const value = fields[node.dataset.tomeField];
    // Original names and values are unchanged. textContent also protects names
    // containing markup; missing observations remain absent rather than guessed.
    node.textContent = value === undefined || value === null ? '' : String(value);
  }
  for (const button of root.querySelectorAll('[data-tome-command]')) {
    button.disabled = !presentation.view?.ready || presentation.pending_kind !== 0 || presentation.phase === 'failed' || Boolean(presentation.ui?.dialogs.length);
  }
  const dialogRoot = root.querySelector('[data-tome-dialogs]');
  if (dialogRoot) renderOriginalDialogs(dialogRoot, presentation, label);
  root.lang = presentation.locale;
  root.dataset.corePhase = presentation.phase;
}

// These are real original component observations rendered by Rust. Their action
// handles route back to original callbacks; there is no local UI game model.
function renderOriginalDialogs(root, presentation, label) {
  const doc = root.ownerDocument;
  const fragment = doc.createDocumentFragment();
  const makeAction = (dialog, target, key, text) => {
    const button = doc.createElement('button');
    button.type = 'button'; button.textContent = text;
    button.dataset.tomeUiDialog = dialog.handle;
    if (target) button.dataset.tomeUiTarget = target;
    button.dataset.tomeUiKey = key;
    button.disabled = !dialog.active || presentation.pending_kind !== 0 || presentation.phase === 'failed';
    return button;
  };
  for (const dialog of presentation.ui?.dialogs || []) {
    const section = doc.createElement('section');
    section.setAttribute('role', 'dialog'); section.setAttribute('aria-modal', String(dialog.active));
    section.dataset.originalHandle = dialog.handle;
    section.style.maxWidth = 'min(90vw, 80rem)';
    section.style.overflowWrap = 'anywhere';
    if (!dialog.active) section.setAttribute('aria-hidden', 'true');
    if (dialog.title != null) {
      const heading = doc.createElement('h2'); heading.textContent = dialog.title; section.append(heading);
    }
    for (const component of dialog.components) {
      if (component.hidden) continue;
      const container = doc.createElement('div'); container.dataset.originalHandle = component.handle;
      if (component.kind === 'button') {
        if (component.actions.includes('ACCEPT')) container.append(makeAction(dialog, component.handle, 'ACCEPT', component.text || ''));
      } else if (component.kind === 'text') {
        const text = doc.createElement('p'); text.style.whiteSpace = 'pre-wrap'; text.textContent = component.text || ''; container.append(text);
      } else if (component.kind === 'list') {
        const list = doc.createElement('ul');
        for (const item of component.items) {
          const row = doc.createElement('li'); row.textContent = item.text;
          row.setAttribute('aria-current', String(item.index === component.selection)); list.append(row);
        }
        container.append(list);
        for (const [key, id] of [['MOVE_UP', 'ui.dialog.previous'], ['MOVE_DOWN', 'ui.dialog.next'], ['ACCEPT', 'ui.dialog.accept']]) {
          if (component.actions.includes(key)) container.append(makeAction(dialog, component.handle, key, label(id)));
        }
      }
      section.append(container);
    }
    for (const [key, id] of [['ACCEPT', 'ui.dialog.accept'], ['EXIT', 'ui.dialog.exit']]) {
      if (dialog.actions.includes(key)) section.append(makeAction(dialog, null, key, label(id)));
    }
    fragment.append(section);
  }
  root.replaceChildren(fragment);
}
