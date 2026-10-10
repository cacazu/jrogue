/* SPDX-License-Identifier: GPL-3.0-or-later. Source-only additive fixture host. */
const utf8 = new TextEncoder();
export class NativeTextboxError extends Error {
  constructor(textId) { super(textId); this.textId = textId; }
}
function failed(module, fallback) {
  const id = module.ccall('tome_textbox_native_error','string',[],[]);
  throw new NativeTextboxError(id || fallback);
}
function copyJson(module, name) {
  const text = module.ccall(name,'string',[],[]);
  if (!text) failed(module,'textbox.error.status');
  let value; try { value=JSON.parse(text); } catch { throw new NativeTextboxError('textbox.error.status'); }
  if (value?.protocol!==1) throw new NativeTextboxError('textbox.error.status');
  return value;
}
/** Fresh original init completed, original.start has NOT run. Fetch happens
 * outside any action/purity bracket; this source is deferred until open(). */
export async function installNativeTextboxFixture(module, sourceURL) {
  const response=await fetch(sourceURL);
  if (!response.ok) throw new NativeTextboxError('textbox.error.install');
  const bytes=new Uint8Array(await response.arrayBuffer());
  let source; try { source=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes); }
  catch { throw new NativeTextboxError('textbox.error.install'); }
  const encoded=utf8.encode(source);
  if (bytes.length===0 || bytes.length>65536 || encoded.length!==bytes.length || !encoded.every((b,i)=>b===bytes[i]))
    throw new NativeTextboxError('textbox.error.install');
  if (module.ccall('tome_textbox_native_install','number',['string','number'],[source,bytes.length])!==1)
    failed(module,'textbox.error.install');
}
/** Explicitly settle the original pending focus/onTickEnd work. Native begin/end
 * accept zero physical packets; the ordinary dispatch API intentionally does
 * not. This bounded diagnostic seam does not fabricate a key, SDL text, actor
 * action, WAIT, game time or RNG. It drains actual original queued events and
 * uses the same original native pump/state machine as dispatch(). */
export async function settlePendingOriginalFocus(original) {
  if (!original || original.busy || typeof original.call!=='function' ||
      typeof original.collect!=='function' || typeof original.yieldTurn!=='function' ||
      original.sequence>=0xffffffff) throw new NativeTextboxError('textbox.error.stage');
  const sequence=++original.sequence;
  original.running=true;
  try {
    let status=await original.collect(original.call('begin',['number'],[sequence]),sequence);
    if (status.phase!=='collecting') throw new NativeTextboxError('textbox.error.stage');
    status=original.call('end',['number'],[sequence]);
    let pumps=0;
    while (status.phase==='ticking') {
      if (++pumps>12000) throw new NativeTextboxError('textbox.error.settle');
      await original.yieldTurn();
      status=original.call('pump',['number','number'],[sequence,16]);
    }
    if (status.phase!=='complete' || status.busy || status.tick_end_pending!==0 || !status.tick_paused)
      throw new NativeTextboxError('textbox.error.settle');
    return status;
  } finally { original.running=false; }
}

/** All fixture mutations use the same retained physical transaction owner.
 * Supply the real root frame callback used by the variant, not a mock draw.
 * status()/focus() are copied native diagnostics outside the Rust heap bracket.
 */
export class NativeTextboxFixture {
  constructor({module,inputHost,original,onOriginalFrame}) {
    if (!module || !inputHost || !original || typeof onOriginalFrame!=='function')
      throw new NativeTextboxError('textbox.error.request');
    Object.assign(this,{module,inputHost,original,onOriginalFrame});
    this.running=false;
  }
  status() { return copyJson(this.module,'tome_textbox_native_status'); }
  focus() { return copyJson(this.module,'tome_textbox_focus_status'); }
  async mutate(call) {
    if (this.running) throw new NativeTextboxError('textbox.error.stage');
    this.running=true;
    try {
      await this.inputHost.suspendAndDrain();
      if (call()!==1) failed(this.module,'textbox.error.open');
      // Actual onTickEnd Unicode focus work, via the unchanged native dispatcher.
      const settled=await settlePendingOriginalFocus(this.original);
      await this.onOriginalFrame(settled);
      const status=this.status();
      this.inputHost.resume();
      return status;
    } catch(error) {
      // A failed fixture/frame can leave genuine pending work with busy=false.
      // Keep admission suspended. Only the caller's explicit verified completed
      // original frame or fresh document may recover; no automatic replay/resume.
      throw error;
    } finally { this.running=false; }
  }
  open(initial, labels) {
    if (typeof initial!=='string' || !labels || !['title','field','cancel'].every(k=>typeof labels[k]==='string'))
      throw new NativeTextboxError('textbox.error.request');
    // C string ABI cannot represent NUL, and TextEncoder must not silently
    // replace an unpaired surrogate in an external value or translated label.
    for (const value of [initial,labels.title,labels.field,labels.cancel]) {
      if (value.includes('\0') || new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(utf8.encode(value))!==value)
        throw new NativeTextboxError('textbox.error.request');
    }
    return this.mutate(()=>this.module.ccall('tome_textbox_native_open','number',
      ['string','string','string','string'],[initial,labels.title,labels.field,labels.cancel]));
  }
  close() {
    return this.mutate(()=>this.module.ccall('tome_textbox_native_close','number',[],[]));
  }
}