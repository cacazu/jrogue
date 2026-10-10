/* Browser presentation of immutable upstream descriptors. Changed 2026-10-02. */
import { COLORS, utf8Limit } from './shim-host.mjs';

const STATUS_KEYS = ['title','strength','dexterity','constitution','intelligence','wisdom','charisma','alignment','score','capacity','gold','energy','energy_max','level','armor_class','monster_level','turns','hunger','hit_points','hit_points_max','location','experience','conditions','weapon','armor','terrain','version'];
const DIRECTIONS = [[-1,-1,'↖'],[0,-1,'↑'],[1,-1,'↗'],[-1,0,'←'],[0,0,'·'],[1,0,'→'],[-1,1,'↙'],[0,1,'↓'],[1,1,'↘']];
const ACTIONS = [['ui.inventory','i'],['ui.pickup',','],['ui.search','s'],['ui.open','o'],['ui.close','c'],['ui.eat','e'],['ui.quaff','q'],['ui.read','r'],['ui.wield','w'],['ui.wear','W'],['ui.takeoff','T'],['ui.drop','d'],['ui.apply','a'],['ui.zap','z'],['ui.fire','f'],['ui.throw','t'],['ui.cast','Z'],['ui.upstairs','<'],['ui.downstairs','>'],['ui.extended','#'],['ui.look',':'],['ui.help','?'],['ui.escape','Escape'],['ui.enter','Enter']];

function node(tag,className,text = '') {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

/** DOM never inspects hidden engine state; only windowport public descriptors. */
export class DomUI {
  constructor(catalog) {
    this.catalog = catalog;
    this.locale = 'ja';
    this.layers = null;
    this.host = null;
    this.modalKey = null;
    this.activeDialog = null;
    this.statusEvent = null;
    this.failedSemanticRecords = new WeakSet();
    this.questPresentations = new WeakMap();
    this.semanticFormattingFailures = 0;
    this.messages = [];
    this.lastFrame = {cells:[],status:[]};
    this.cursorPosition = null;
    this.dirtyFrame = false;
    this.renderQueued = false;
    this.els = Object.fromEntries(['messages','status','canvas','map-viewport','game-state','modal','modal-title','modal-body','modal-actions','touch-directions','touch-actions','raw-command','raw-form','run-mode','history','save','start','restore','export','import','locale','notice','tutorial'].map(id => [id,document.getElementById(id)]));
    this.context = this.els.canvas.getContext('2d');
    this.buildControls();
    this.installInput();
    this.translateUI();
    new ResizeObserver(() => this.drawMap()).observe(this.els['map-viewport']);
  }
  t(id,args = {}) {
    if (this.layers) return this.layers.format(id,args,this.locale);
    const template = this.catalog[this.locale]?.[id];
    if (template === undefined) throw new Error(`Missing browser UI ID: ${id}`);
    return template.replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g,(_,key) => String(args[key] ?? `{${key}}`));
  }
  renderEvent(event) {
    if (event?.semantic) {
      // A quest template is a whole paragraph. Partial rows retain native text;
      // only a complete source-bound group can request the pure formatter.
      if (event.context.quest && !event.questComplete) return {text:event.sourceText,usedFallback:true,translation:'quest-original-pending'};
      try {
        const rendered = this.layers.formatEvent({event:{id:event.id,args:event.args},context:event.context},this.locale);
        return {...rendered,translation:rendered.usedFallback ? 'semantic-english-fallback' : `semantic-${this.locale}`};
      } catch {
        // Source-selected metadata is never reconstructed from the English text.
        // Unavailable IDs/variants/ABI retain the exact original visible message.
        if (!this.failedSemanticRecords.has(event)) { this.failedSemanticRecords.add(event); this.semanticFormattingFailures++; }
        return {text:event.sourceText,usedFallback:true,translation:'semantic-unavailable-fallback'};
      }
    }
    return {text:event?.translated ? this.t(event.id,event.args) : event?.args?.text ?? '',usedFallback:!event?.translated,translation:event?.translated ? `ui-${this.locale}` : 'upstream-english'};
  }
  textOf(event) { return this.renderEvent(event).text; }
  questGroupCompleted(token,event) {
    this.questPresentations.set(token,event);
    this.renderMessages();
    this.activeDialog?.bindings.forEach(update => update());
  }
  questGroupInvalidated(token) {
    this.questPresentations.delete(token);
    this.renderMessages();
    this.activeDialog?.bindings.forEach(update => update());
  }
  /** Replace only a complete, contiguous set of the same immutable rows. */
  presentationRows(rows) {
    const output = [];
    for (let index=0;index<rows.length;index++) {
      const row = rows[index];
      const event = row.event ?? row;
      const complete = event.questGroup ? this.questPresentations?.get(event.questGroup) : null;
      const originals = complete?.originalRows;
      if (originals && originals.every((original,offset) => (rows[index+offset]?.event ?? rows[index+offset]) === original.event)) {
        const rendered = this.renderEvent(complete);
        if (rendered.translation !== 'semantic-unavailable-fallback') {
          output.push({...row,event:complete,rendered}); index += originals.length-1; continue;
        }
      }
      output.push(row);
    }
    return output;
  }
  bindEventText(element,event,prefix = '',suffix = '') {
    const update = () => {
      const rendered = this.renderEvent(event);
      element.textContent = prefix + rendered.text + suffix;
      element.dataset.translation = rendered.translation;
      if (event?.semantic) element.dataset.semanticTextId = event.id;
    };
    update(); this.activeDialog?.bindings.push(update); return element;
  }
  bindUiText(element,id,args = {},prefix = '',suffix = '') {
    const update = () => { element.textContent = prefix + this.t(id,args) + suffix; };
    update(); this.activeDialog?.bindings.push(update); return element;
  }
  bind(host,layers) { this.host = host; this.layers = layers; this.translateUI(); }
  translateUI() {
    document.documentElement.lang = this.locale;
    document.querySelectorAll('[data-text-id]').forEach(element => { element.textContent = this.t(element.dataset.textId); });
    document.querySelectorAll('[data-title-id]').forEach(element => { element.title = this.t(element.dataset.titleId); });
    this.els.locale.value = this.locale;
    this.renderStatus();
    this.drawMap();
    this.renderMessages();
    this.activeDialog?.bindings.forEach(update => update());
  }
  buildControls() {
    DIRECTIONS.forEach(([dx,dy,label]) => {
      const button = node('button','direction',label);
      button.type = 'button';
      button.setAttribute('aria-label',`${dx}, ${dy}`);
      button.addEventListener('click',() => {
        if (!this.host) return;
        const code = dx === 0 && dy === 0 ? 46 : this.layers.direction(dx,dy,this.modalKey ? false : this.els['run-mode'].checked,this.modalKey ? 1 : 0,this.host.inputLayout);
        if (this.modalKey) {
          if (this.host.pendingKind === 'question') this.modalKey({key:String.fromCharCode(code),preventDefault() {},target:null,ctrlKey:false,altKey:false,shiftKey:false,metaKey:false});
          return;
        }
        if (code >= 0) this.host.inbox.send({type:'key',code});
      });
      this.els['touch-directions'].append(button);
    });
    ACTIONS.forEach(([id,key]) => {
      const button = node('button','action');
      button.dataset.textId = id;
      button.type = 'button';
      button.addEventListener('click',() => this.sendKey(key));
      this.els['touch-actions'].append(button);
    });
  }
  installInput() {
    this.els.locale.addEventListener('change',() => { this.locale = this.els.locale.value; this.translateUI(); });
    document.addEventListener('keydown',event => {
      if (event.isComposing || event.key === 'Process' || event.repeat) return;
      if (this.modalKey) { this.modalKey(event); return; }
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
      if (!this.host || this.host.exited || !['command','key'].includes(this.host.pendingKind)) return;
      const modifiers = (event.ctrlKey ? 1 : 0) | (event.altKey ? 2 : 0) | (event.shiftKey ? 4 : 0) | (event.metaKey ? 8 : 0);
      const code = this.keycode(event.key,modifiers,0);
      if (code >= 0) { event.preventDefault(); this.host.inbox.send({type:'key',code}); }
    });
    this.els['raw-form'].addEventListener('submit',event => {
      event.preventDefault();
      if (!this.host || this.modalKey) return;
      for (const char of this.els['raw-command'].value) {
        const code = this.layers.keycode(char,0,0);
        if (code >= 0) this.host.inbox.send({type:'key',code});
      }
      this.els['raw-command'].value = '';
      this.els.canvas.focus();
    });
    this.els.canvas.addEventListener('click',event => {
      if (!this.host || this.host.pendingKind !== 'command' || this.modalKey) return;
      const rect = this.els.canvas.getBoundingClientRect();
      const x = Math.floor((event.clientX - rect.left)/rect.width*79) + 1;
      const y = Math.floor((event.clientY - rect.top)/rect.height*21);
      if (x > 0 && x < 80 && y >= 0 && y < 21) this.host.inbox.send({type:'click',x,y,mod:event.shiftKey ? 2 : 1});
    });
    this.els.history.addEventListener('click',async () => {
      if (!this.modalKey) await this.history(this.messages.filter(row => !row.noHistory));
    });
    this.els.save.addEventListener('click',() => {
      if (this.host?.pendingKind === 'command' && !this.modalKey) this.sendKey('S');
      else this.notice(this.t('ui.save_finish_prompt'));
    });
  }
  sendKey(key) {
    if (this.modalKey) {
      this.modalKey({key,preventDefault() {},target:null,ctrlKey:false,altKey:false,shiftKey:false,metaKey:false}); return;
    }
    if (!this.host || this.host.exited) return;
    const code = this.layers.keycode(key,0,0);
    if (code >= 0) this.host.inbox.send({type:'key',code});
  }
  keycode(key,modifiers,context) {
    if (modifiers & 8) return -2;
    const direction = {ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1],Home:[-1,-1],PageUp:[1,-1],End:[-1,1],PageDown:[1,1]}[key];
    if (direction && (this.host?.inputLayout || context === 5)) return this.layers.direction(...direction,context === 5 ? false : !!(modifiers & 4),context === 5 ? 1 : context,this.host?.inputLayout ?? 0);
    return this.layers.keycode(key,modifiers,context);
  }
  notice(text) { this.els.notice.textContent = text; }
  initialized() { this.notice(this.t('ui.loaded')); }
  waiting(kind) {
    this.els['game-state'].textContent = kind ? this.t(`ui.wait_${['command','key','question','text','menu','extended','more','display','history'].includes(kind) ? kind : 'key'}`) : this.t('ui.running');
    this.els.save.disabled = kind !== 'command';
  }
  exited() {
    this.els['game-state'].textContent = this.t('ui.ended');
    this.els.save.disabled = true;
    this.els.start.disabled = false;
    this.els.restore.disabled = false;
    this.els.export.disabled = false;
    this.els.tutorial.disabled = false;
  }
  message(event,attr = 0) {
    const noHistory = !!(attr & (globalThis.nethackGlobal?.constants?.ATTR?.ATR_NOHISTORY ?? 32));
    const urgent = !!(attr & (globalThis.nethackGlobal?.constants?.ATTR?.ATR_URGENT ?? 16));
    if (this.messages.at(-1)?.noHistory) this.messages.pop();
    this.messages.push(Object.freeze({event,attr,noHistory,urgent}));
    if (this.messages.length > 1000) this.messages.shift();
    this.renderMessages();
  }
  clearMessage() { /* Keep scrollback even when upstream clears current line. */ }
  renderMessages() {
    const bottom = this.els.messages.scrollHeight - this.els.messages.scrollTop - this.els.messages.clientHeight < 32;
    this.els.messages.replaceChildren(...this.presentationRows(this.messages.slice(-80)).map(row => {
      const event = row.event ?? row;
      const rendered = row.rendered ?? this.renderEvent(event);
      const element = node('p',(row.attr & 15) === 1 ? 'bold' : '',rendered.text);
      element.dataset.translation = rendered.translation;
      element.dataset.noHistory = String(Boolean(row.noHistory));
      if (event.semantic) element.dataset.semanticTextId = event.id;
      if (row.urgent) element.setAttribute('role','alert');
      return element;
    }));
    if (bottom || this.messages.at(-1)?.urgent) this.els.messages.scrollTop = this.els.messages.scrollHeight;
  }
  frame(frame) { this.lastFrame = frame; if (frame.status.length) this.statusEvent = null; this.drawMap(); this.renderStatus(); }
  dirty() {
    if (this.renderQueued) return;
    this.renderQueued = true;
    requestAnimationFrame(() => { this.renderQueued = false; if (this.host) this.frame(this.host.frame()); });
  }
  drawMap() {
    const canvas = this.els.canvas;
    const available = this.els['map-viewport'].clientWidth;
    const cellWidth = Math.max(9,Math.min(15,Math.floor(available/79)));
    const cellHeight = Math.round(cellWidth * 1.8);
    const width = cellWidth * 79;
    const height = cellHeight * 21;
    const scale = window.devicePixelRatio || 1;
    canvas.width = Math.round(width*scale);
    canvas.height = Math.round(height*scale);
    canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
    const ctx = this.context;
    ctx.setTransform(scale,0,0,scale,0,0);
    ctx.fillStyle = '#0d1115'; ctx.fillRect(0,0,width,height);
    ctx.font = `${cellHeight-3}px "Cascadia Mono", "Consolas", monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const cell of this.lastFrame.cells) {
      const x = (cell.x-1)*cellWidth;
      const y = cell.y*cellHeight;
      const pet = !!(cell.flags & (globalThis.nethackGlobal?.constants?.MG?.MG_PET ?? 16));
      if (pet) { ctx.fillStyle = '#193a2e'; ctx.fillRect(x,y,cellWidth,cellHeight); }
      ctx.fillStyle = COLORS[cell.color] ?? COLORS[7];
      ctx.fillText(cell.char,x+cellWidth/2,y+cellHeight/2);
    }
    if (this.cursorPosition) {
      ctx.strokeStyle = '#efc680'; ctx.lineWidth = 1;
      ctx.strokeRect((this.cursorPosition.x-1)*cellWidth+0.5,this.cursorPosition.y*cellHeight+0.5,cellWidth-1,cellHeight-1);
    }
    canvas.dataset.cells = String(this.lastFrame.cells.length);
    const heroFlag = globalThis.nethackGlobal?.constants?.MG?.MG_HERO ?? 1;
    const hero = this.lastFrame.cells.find(cell => cell.flags & heroFlag);
    const viewport = this.els['map-viewport'];
    if (hero) {
      const heroKey = `${hero.x},${hero.y}:${viewport.clientWidth}`;
      if (heroKey !== this.lastHeroKey) {
        const position = (hero.x-0.5)*cellWidth;
        if (position < viewport.scrollLeft+cellWidth*2 || position > viewport.scrollLeft+viewport.clientWidth-cellWidth*2) {
          viewport.scrollLeft = Math.max(0,position-viewport.clientWidth/2);
        }
        this.lastHeroKey = heroKey;
      }
    }
  }
  cursor(x,y) { this.cursorPosition = {x,y}; }
  clip(x,y) {
    // Scroll only; reuses descriptors and never calls game/RNG exports.
    const canvas = this.els.canvas;
    const viewport = this.els['map-viewport'];
    viewport.scrollLeft = Math.max(0,(x-1)/79*canvas.clientWidth-viewport.clientWidth/2);
  }
  renderStatus() {
    if (this.statusEvent && !this.lastFrame.status.length) { this.els.status.textContent = this.textOf(this.statusEvent); return; }
    this.els.status.replaceChildren(...this.lastFrame.status.filter(row => row.enabled !== false).map(row => {
      const value = row.condition ? this.conditionText(row.value) : (row.event ? this.textOf(row.event) : String(row.value)).replace(/\\G[0-9a-fA-F]{8}/g,'$');
      const label = row.labelEvent?.semantic ? this.textOf(row.labelEvent) : this.t(`ui.status_${STATUS_KEYS[row.index] ?? 'unknown'}`);
      const element = node('span','stat',row.index === 0 || row.index === 20 || row.condition ? value : `${label} ${value}`);
      element.style.color = COLORS[row.color & 255] ?? COLORS[7];
      element.dataset.field = String(row.index);
      if (row.event?.semantic) { element.dataset.semanticTextId = row.event.id; element.dataset.translation = this.renderEvent(row.event).translation; }
      return element;
    }));
  }
  conditionText(mask) {
    const constants = globalThis.nethackGlobal?.constants?.CONDITION ?? {};
    return Object.entries(constants).filter(([,bit]) => (mask & bit) !== 0).map(([key]) => this.t(`ui.condition_${key.slice(8).toLowerCase()}`)).join(' ');
  }
  statusText(event) { this.statusEvent = event; this.els.status.textContent = this.textOf(event); }
  bell() { this.els['game-state'].classList.add('bell'); setTimeout(() => this.els['game-state'].classList.remove('bell'),150); }
  async delay() { await new Promise(resolve => setTimeout(resolve,35)); }
  async dialog(title,build) {
    if (this.modalKey) throw new Error('Concurrent browser dialogs are forbidden');
    const previousFocus = document.activeElement;
    this.activeDialog = {bindings:[]};
    const updateTitle = () => { this.els['modal-title'].textContent = typeof title === 'function' ? title() : typeof title === 'object' ? this.textOf(title) : title; };
    updateTitle(); this.activeDialog.bindings.push(updateTitle);
    this.els['modal-body'].replaceChildren();
    this.els['modal-actions'].replaceChildren();
    return new Promise(resolve => {
      let finished = false;
      const finish = value => {
        if (finished) return;
        finished = true;
        this.modalKey = null;
        this.activeDialog = null;
        this.els.modal.close();
        this.els.modal.removeEventListener('cancel',cancel);
        if (previousFocus?.isConnected) previousFocus.focus();
        resolve(value);
      };
      const cancel = event => { event.preventDefault(); finish(null); };
      this.els.modal.addEventListener('cancel',cancel);
      const addButton = (id,value,callback) => {
        const button = node('button','',this.t(id));
        this.bindUiText(button,id);
        button.type = 'button';
        button.addEventListener('click',callback ?? (() => finish(value)));
        this.els['modal-actions'].append(button);
        return button;
      };
      const key = build({body:this.els['modal-body'],finish,addButton});
      this.modalKey = key ?? (event => {
        if (event.key === 'Escape') { event.preventDefault(); finish(null); }
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); finish(13); }
      });
      this.els.modal.showModal();
      (this.els['modal-body'].querySelector('[data-autofocus]') ?? this.els['modal-body'].querySelector('input,button') ?? this.els['modal-actions'].querySelector('button'))?.focus();
    });
  }
  async more() {
    const result = await this.dialog(() => this.t('ui.more'),({body,finish,addButton}) => {
      const paragraph = node('p','');
      const update = () => { const row = this.presentationRows(this.messages).at(-1); paragraph.textContent = row ? (row.rendered ?? this.renderEvent(row.event ?? row)).text : ''; };
      update(); this.activeDialog.bindings.push(update); body.append(paragraph);
      addButton('ui.continue',32);
      return event => {
        if (event.key === 'Escape') { event.preventDefault(); finish(27); }
        else if (event.key.length === 1 || event.key === 'Enter') { event.preventDefault(); finish(event.key === 'Enter' ? 13 : event.key.charCodeAt(0)); }
      };
    });
    return result ?? 27;
  }
  async document({title,lines,items}) {
    await this.dialog(() => (typeof title === 'function' ? title() : typeof title === 'object' ? this.textOf(title) : title) || this.t('ui.document'),({body,addButton}) => {
      const pre = node('pre','document-lines');
      const update = () => { pre.textContent = this.presentationRows(lines).map(row => (row.rendered ?? this.renderEvent(row.event ?? row)).text).join('\n'); };
      update(); this.activeDialog.bindings.push(update);
      body.append(pre);
      for (const item of items) body.append(this.bindEventText(node('p',''),item.event,item.accelerator ? `${String.fromCharCode(item.accelerator)}  ` : ''));
      addButton('ui.close_dialog',13);
    });
  }
  async history(events) {
    await this.document({title:() => this.t('ui.history'),lines:events.map(row => ({event:row.event ?? row,attr:0})),items:[]});
  }
  async text({id,prompt,maxBytes}) {
    return this.dialog(() => id ? this.t(id) : this.textOf(prompt),({body,finish,addButton}) => {
      const field = node('input','text-editor');
      field.type = 'text'; field.autocomplete = 'off'; field.spellcheck = false;
      const hint = node('p','hint');
      let edited = false;
      const updateHint = () => { hint.textContent = edited ? this.t('ui.utf8_usage',{count:new TextEncoder().encode(field.value).length,max:maxBytes-1}) : this.t('ui.utf8_limit',{count:maxBytes-1}); };
      updateHint(); this.activeDialog.bindings.push(updateHint);
      field.addEventListener('input',() => { if (!field.matches(':focus')) return; edited = true; updateHint(); });
      body.append(field,hint);
      const submit = () => {
        try { finish(utf8Limit(this.layers.textInsert(field.value),maxBytes)); }
        catch (error) { field.setCustomValidity(error.message); field.reportValidity(); }
      };
      field.addEventListener('input',() => field.setCustomValidity(''));
      addButton('ui.confirm',null,submit); addButton('ui.cancel',null);
      return event => {
        if (event.isComposing || event.key === 'Process') return;
        if (event.key === 'Enter') { event.preventDefault(); submit(); }
        if (event.key === 'Escape') { event.preventDefault(); finish(null); }
      };
    });
  }
  async question({prompt,responses,defaultCode}) {
    const choices = (responses ?? '').split('\u001b')[0];
    const result = await this.dialog(() => this.textOf(prompt),({body,finish,addButton}) => {
      let countField = null;
      if (!responses) {
        const directions = node('div','directions question-directions');
        DIRECTIONS.forEach(([dx,dy,label]) => {
          const button = node('button','direction',label); button.type = 'button';
          button.setAttribute('aria-label',`${dx}, ${dy}`);
          button.addEventListener('click',() => finish(dx === 0 && dy === 0 ? 46 : this.layers.direction(dx,dy,false,1,this.host.inputLayout)));
          directions.append(button);
        });
        body.append(directions);
        const raw = node('input','question-key'); raw.type = 'text'; raw.maxLength = 1; raw.autocomplete = 'off'; raw.setAttribute('aria-label',this.t('ui.raw_command'));
        const send = this.bindUiText(node('button',''),'ui.send'); send.type = 'button';
        send.addEventListener('click',() => { const code = this.layers.keycode(raw.value,0,5); if (code >= 0) finish(code); });
        body.append(raw,send);
        for (const [label,code] of [['↑ <',60],['↓ >',62]]) {
          const button = node('button','choice',label); button.type = 'button'; button.addEventListener('click',() => finish(code)); body.append(button);
        }
      }
      if (choices.includes('#')) {
        countField = node('input','count-editor'); countField.type = 'number'; countField.min = '0'; countField.max = '2147483647'; countField.value = '1';
        countField.setAttribute('aria-label',this.t('ui.count'));
        body.append(countField);
      }
      const submitChar = char => {
        if (char === '#') {
          const count = Number(countField.value);
          if (!Number.isInteger(count) || count < 0 || count > 2147483647 || countField.value === '') {
            countField.setCustomValidity(this.t('ui.invalid_count')); countField.reportValidity(); return;
          }
          countField.setCustomValidity(''); finish({code:35,count});
        } else finish(char.charCodeAt(0));
      };
      countField?.addEventListener('input',() => countField.setCustomValidity(''));
      for (const char of choices) {
        const label = ({y:'ui.yes',n:'ui.no',q:'ui.cancel',a:'ui.all'})[char];
        const button = label ? this.bindUiText(node('button','choice'),label,{},'',` (${char})`) : node('button','choice',char);
        button.type = 'button';
        button.addEventListener('click',() => submitChar(char));
        body.append(button);
      }
      addButton('ui.cancel',choices.includes('q') ? 113 : choices.includes('n') ? 110 : defaultCode || 27);
      return event => {
        if (event.key === 'Escape') { event.preventDefault(); finish(choices.includes('q') ? 113 : choices.includes('n') ? 110 : defaultCode || 27); }
        else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (defaultCode === 35) submitChar('#'); else finish(defaultCode || 13); }
        else if (!responses) {
          const modifiers = (event.ctrlKey ? 1 : 0) | (event.altKey ? 2 : 0) | (event.shiftKey ? 4 : 0) | (event.metaKey ? 8 : 0);
          const code = this.keycode(event.key,modifiers,5);
          if (code >= 0) { event.preventDefault(); finish(code); }
        }
        else if (event.key.length === 1 && choices.includes(event.key)) {
          if (event.target === countField && /[0-9]/.test(event.key)) return;
          event.preventDefault(); submitChar(event.key);
        }
      };
    });
    return result ?? (choices.includes('q') ? 113 : choices.includes('n') ? 110 : defaultCode || 27);
  }
  async menu({how,prompt,items,lines}) {
    this.els.modal.dataset.pickMode = String(how);
    return this.dialog(() => this.textOf(prompt) || this.t('ui.menu'),({body,finish,addButton}) => {
      const selected = new Map();
      const controls = new Map();
      const accelerators = new Map();
      const groupAccelerators = new Map();
      const countFields = new Map();
      const rowElements = new Map();
      const filter = node('input','menu-filter'); filter.type = 'search'; filter.setAttribute('aria-label',this.t('ui.filter_menu')); filter.placeholder = this.t('ui.filter_menu');
      const updateFilter = () => { const query = filter.value.toLocaleLowerCase(); rowElements.forEach(row => { row.hidden = !row.textContent.toLocaleLowerCase().includes(query); }); };
      filter.addEventListener('input',updateFilter);
      body.append(filter);
      const used = new Set(items.filter(item => item.selectable && item.accelerator).map(item => item.accelerator));
      const available = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(char => char.charCodeAt(0)).filter(code => !used.has(code));
      let pendingCount = '';
      const readCount = field => {
        const count = field.value === '' ? -1 : Number(field.value);
        if (count !== -1 && (!Number.isInteger(count) || count < 1 || count > 2147483647)) {
          field.setCustomValidity(this.t('ui.invalid_count')); field.reportValidity(); return null;
        }
        field.setCustomValidity(''); return count;
      };
      const result = () => {
        const rows = [];
        for (const [index] of selected) {
          const count = readCount(countFields.get(index));
          if (count === null) return null;
          rows.push({index,count});
        }
        return rows;
      };
      const confirm = () => { const rows = result(); if (rows !== null) finish(rows); };
      const choose = (index,count = -1) => {
        if (how === 0) return;
        if (how === 1) { finish([{index,count}]); return; }
        if (selected.has(index)) selected.delete(index); else selected.set(index,count);
        controls.get(index).checked = selected.has(index);
      };
      for (const row of lines) body.append(this.bindEventText(node('p',''),row.event));
      items.forEach((item,index) => {
        if (!item.selectable || how === 0) {
          const line = this.bindEventText(node('p',item.selectable ? 'menu-display-row' : 'menu-heading'),item.event,item.selectable && item.accelerator ? `${String.fromCharCode(item.accelerator)}  ` : '');
          rowElements.set(index,line); body.append(line); return;
        }
        const accel = item.accelerator || available.shift() || 0;
        if (accel) accelerators.set(accel,index);
        if (item.groupAccelerator) {
          const group = groupAccelerators.get(item.groupAccelerator) ?? []; group.push(index); groupAccelerators.set(item.groupAccelerator,group);
        }
        const row = node('label','menu-row');
        const control = node('input',''); control.type = how === 1 ? 'radio' : 'checkbox'; control.name = 'menu-choice'; control.checked = item.selected;
        if (controls.size === 0) control.dataset.autofocus = 'true';
        if (item.selected && (how !== 1 || selected.size === 0)) selected.set(index,-1);
        controls.set(index,control);
        const content = node('span','');
        content.style.color = COLORS[item.color] ?? COLORS[7];
        this.bindEventText(content,item.event,`${accel ? String.fromCharCode(accel) : String.fromCodePoint(0x2022)}  `);
        const count = node('input','menu-count'); count.type = 'number'; count.min = '1'; count.max = '2147483647'; count.placeholder = this.t('ui.all'); count.setAttribute('aria-label',this.t('ui.count'));
        countFields.set(index,count);
        control.addEventListener('change',() => {
          if (how === 1) { selected.clear(); selected.set(index,-1); const amount = readCount(count); if (amount !== null) finish([{index,count:amount}]); }
          else if (control.checked) selected.set(index,count.value ? Number(count.value) : -1); else selected.delete(index);
        });
        count.addEventListener('input',() => { count.setCustomValidity(''); if (selected.has(index)) selected.set(index,count.value ? Number(count.value) : -1); });
        row.append(control,content,count); body.append(row);
        rowElements.set(index,row);
      });
      addButton(how === 0 ? 'ui.close_dialog' : 'ui.confirm',null,confirm);
      this.activeDialog.bindings.push(updateFilter);
      addButton('ui.cancel',null);
      if (how === 2) {
        addButton('ui.select_all',null,() => { controls.forEach((control,index) => { selected.set(index,-1); control.checked = true; }); });
        addButton('ui.select_none',null,() => { selected.clear(); controls.forEach(control => { control.checked = false; }); });
      }
      return event => {
        if (event.key === 'Escape') { event.preventDefault(); finish(null); return; }
        if (event.key === 'Enter') { event.preventDefault(); confirm(); return; }
        if (event.target === filter) return;
        if (event.target instanceof HTMLInputElement && event.target.type === 'number') return;
        if (['PageUp','PageDown','Home','End','^','|','<','>'].includes(event.key)) {
          event.preventDefault();
          if (['Home','^'].includes(event.key)) body.scrollTop = 0;
          else if (['End','|'].includes(event.key)) body.scrollTop = body.scrollHeight;
          else body.scrollTop += ['PageUp','<'].includes(event.key) ? -body.clientHeight : body.clientHeight;
          return;
        }
        if (event.key === ':') { event.preventDefault(); filter.focus(); return; }
        if (event.key === ' ' && how === 0) { event.preventDefault(); finish([]); return; }
        if (/^[0-9]$/.test(event.key)) { event.preventDefault(); pendingCount = (pendingCount + event.key).slice(0,10); return; }
        if (event.key.length !== 1) return;
        const code = event.key.charCodeAt(0);
        if (accelerators.has(code)) { event.preventDefault(); choose(accelerators.get(code),pendingCount ? Math.min(2147483647,Number(pendingCount)) || -1 : -1); pendingCount = ''; return; }
        if (groupAccelerators.has(code)) { event.preventDefault(); for (const index of groupAccelerators.get(code)) choose(index); return; }
        if (how === 2 && ['.','-','@',',','\\','~'].includes(event.key)) {
          event.preventDefault();
          const page = [',','\\','~'].includes(event.key);
          const operation = event.key === ',' ? '.' : event.key === '\\' ? '-' : event.key === '~' ? '@' : event.key;
          const bounds = body.getBoundingClientRect();
          controls.forEach((control,index) => {
            const row = rowElements.get(index); const position = row.getBoundingClientRect();
            if (page && (row.hidden || position.bottom <= bounds.top || position.top >= bounds.bottom)) return;
            if (operation === '.' || (operation === '@' && !selected.has(index) && !(items[index].flags & 2))) selected.set(index,-1);
            else if (operation === '-' || (operation === '@' && selected.has(index) && !(items[index].flags & 2))) selected.delete(index);
            control.checked = selected.has(index);
          });
        }
      };
    });
  }
  async extended(commands) {
    const value = await this.dialog(() => this.t('ui.extended'),({body,finish,addButton}) => {
      const filter = node('input','text-editor'); filter.type = 'search'; filter.autocomplete = 'off'; filter.setAttribute('aria-label',this.t('ui.filter_commands'));
      const list = node('div','extended-list');
      const render = () => {
        const text = filter.value.toLowerCase();
        list.replaceChildren(...commands.filter(command => `${command.name} ${command.description}`.toLowerCase().includes(text)).map(command => {
          const button = node('button','extended-row',`#${command.name} — ${command.description}`);
          button.type = 'button'; button.dataset.index = String(command.index);
          button.addEventListener('click',() => finish(command.index)); return button;
        }));
      };
      filter.addEventListener('input',render); body.append(filter,list); render(); addButton('ui.cancel',-1);
      return event => {
        if (event.key === 'Escape') { event.preventDefault(); finish(-1); }
        if (event.key === 'Enter') {
          event.preventDefault();
          const match = commands.find(command => command.name === filter.value) ?? commands.filter(command => command.name.startsWith(filter.value))[0];
          if (match) finish(match.index);
        }
      };
    });
    return value ?? -1;
  }
}
