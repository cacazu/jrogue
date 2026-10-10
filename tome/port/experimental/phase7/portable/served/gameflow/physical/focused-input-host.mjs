/* SPDX-License-Identifier: GPL-3.0-or-later. Separate source-only host variant.
 * Keeps the frozen mapper/native dispatcher and packet ordering unchanged.
 */
import {FocusedInputHost} from '/physical/focused-input-host-base.mjs';
import {PhysicalInputError} from '/physical/physical-input-wasm.mjs';
import {readNativeDisplayContract,assertNativeDisplayContract}
  from '/physical/native-canvas-contract.mjs';
const positive=n=>Number.isSafeInteger(n)&&n>0;
function fault(id) { throw new PhysicalInputError(id); }

/** DOM collection is synchronous between native calls, even while an earlier
 * logical transaction awaits its next pump. Busy flags are deliberately NOT a
 * geometry assertion. No native draw/input/tick/resize or repaired coordinates.
 */
export function collectPointerProjection(module,canvas,event) {
  const c=readNativeDisplayContract(module);
  if (!(canvas instanceof HTMLCanvasElement) || canvas.ownerDocument!==document ||
      canvas.id!=='canvas' || document.querySelector('#canvas')!==canvas ||
      module.canvas!==canvas || c.selector_matches!==true || c.context_matches!==true)
    fault('platform.resize.selector');
  const widths=[c.window_width,c.screen_width,c.canvas_width,c.drawing_buffer_width,canvas.width];
  const heights=[c.window_height,c.screen_height,c.canvas_height,c.drawing_buffer_height,canvas.height];
  if (!widths.every(positive)||!heights.every(positive)||
      !widths.every(n=>n===widths[0])||!heights.every(n=>n===heights[0]))
    fault('platform.resize.dimensions');
  const rect=canvas.getBoundingClientRect(),style=getComputedStyle(canvas);
  if (style.transform!=='none' || !Number.isFinite(event.clientX)||!Number.isFinite(event.clientY)||
      !Number.isFinite(rect.left)||!Number.isFinite(rect.top)||
      !positive(canvas.clientWidth)||!positive(canvas.clientHeight))
    fault('platform.pointer.projection');
  return Object.freeze({client_x:event.clientX,client_y:event.clientY,
    rect:Object.freeze({left:rect.left+canvas.clientLeft,top:rect.top+canvas.clientTop,
      width:canvas.clientWidth,height:canvas.clientHeight}),
    window_width:widths[0],window_height:heights[0]});
}

/** Explicit variant: call completedOriginalFrame() after the real initial frame
 * BEFORE start(). onSettled must perform the same actual original frame/refresh
 * as the tested variant. This class never schedules a hidden game action/frame.
 *
 * Full frame gates run before each serialized batch and after the caller's
 * real original onSettled frame. DOM Up/Move collect throughout an awaited
 * transaction and remain concrete FIFO packets. Never remap queued points.
 */
export class SerializedPointerHost extends FocusedInputHost {
  constructor(options) {
    super(options);
    this.completedFrameRevision=0;
    this.lastFrameGeometry=null;
  }
  completedOriginalFrame() {
    const geometry=assertNativeDisplayContract(this.canvas,
      readNativeDisplayContract(this.original.module),this.original.status());
    this.lastFrameGeometry=geometry;
    this.completedFrameRevision++;
    return Object.freeze({revision:this.completedFrameRevision,...geometry});
  }
  start() {
    if (!this.lastFrameGeometry) fault('platform.pointer.frame');
    return super.start();
  }
  point(event) {
    if (!this.lastFrameGeometry) fault('platform.pointer.frame');
    // Existing Rust receives this fresh event-time projection exactly once.
    return collectPointerProjection(this.original.module,this.canvas,event);
  }
  async flush() {
    if (this.failed) throw new PhysicalInputError('input.error.host');
    if (this.inFlight) return this.inFlight;
    if (this.frame) {cancelAnimationFrame(this.frame);this.frame=null;}
    this.inFlight=(async()=>{
      while (this.queue.length) {
        // Do not remove the queue before proving native batch admission.
        if (!this.lastFrameGeometry) fault('platform.pointer.frame');
        assertNativeDisplayContract(this.canvas,
          readNativeDisplayContract(this.original.module),this.original.status());
        const packets=this.queue.splice(0);
        this.queuedBytes=0;
        const status=await this.original.dispatch(packets);
        await this.onSettled(status); // Genuine original root frame, caller-owned.
        this.completedOriginalFrame();
        this.updateFocus(this.original.latest);
      }
    })();
    try {await this.inFlight;}
    catch(error) {this.fail(error);throw error;}
    finally {this.inFlight=null;}
    return this.original.latest;
  }
}