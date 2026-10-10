/* SPDX-License-Identifier: GPL-3.0-or-later
 * SOURCE-ONLY candidate for the pinned Emscripten 6.0.8 LEGACY_GL_EMULATION
 * CPU-array boundary. Original C/Lua dispatch, rules, input and RNG unchanged.
 * Install only after actual native init and before original game start/draw.
 * Source rationale and required actual-browser checks are in MODAL-RENDER-AUDIT.md.
 */
#include <emscripten/emscripten.h>
#include <stdio.h>
#include "lua.h"
#include "lauxlib.h"
#include "tome_main_platform.h"
#include "checkpoint_gate.h"
extern int current_game;
extern int tome_physical_busy(void);

EM_JS(int, tome_planar_refresh_install_js, (void), {
  if (typeof GLImmediate === 'undefined' || typeof GLctx === 'undefined' || !GLctx ||
      typeof GLImmediate.prepareClientAttributes !== 'function' ||
      !Array.isArray(GLImmediate.clientAttributes) ||
      !Array.isArray(GLImmediate.enabledClientAttributes)) return -1;
  if (Module['tomePlanarClientArrayRefresh']) return -4;
  // Do not repair an already rendered session from possibly mutated private
  // descriptors. A fresh pre-start installation is the reviewed boundary.
  if (GLImmediate.vertexCounter !== 0 || GLImmediate.restrideBuffer) return -3;
  var original = GLImmediate.prepareClientAttributes;
  var metrics = {installed:true, prepares:0, refreshes:0, restored:0, bypasses:0};
  var increment = function(name) { metrics[name] = Math.min(1000000000, metrics[name] + 1); };
  GLImmediate.prepareClientAttributes = function(count, beginEnd) {
    increment('prepares');
    // Preserve SDK begin/end and real GPU-array paths exactly. This patch is
    // limited to CPU client arrays submitted by retained original draw calls.
    if (beginEnd || GLctx.currentArrayBufferBinding) {
      increment('bypasses');
      return original.apply(this, arguments);
    }
    var pointers = [];
    for (var i = 0; i < this.enabledClientAttributes.length; ++i) {
      if (this.enabledClientAttributes[i]) {
        var attribute = this.clientAttributes[i];
        if (!attribute || typeof attribute.pointer !== 'number')
          throw new Error('render.error.client_array_contract');
        pointers.push({attribute:attribute, pointer:attribute.pointer});
      }
    }
    // Desktop client arrays reread current CPU bytes on every draw even if
    // pointer/size descriptors are unchanged. The pinned SDK needs this flag
    // to recopy planar arrays rather than reusing its previous temporary data.
    this.modifiedClientAttributes = true;
    increment('refreshes');
    try {
      return original.apply(this, arguments);
    } finally {
      // SDK's planar preparation overwrites descriptor pointers while computing
      // its temporary interleaved buffer. Keep its offset/stride/vertexPointer
      // output for this GPU draw; restore only the original CPU input pointers
      // so the next preparation can observe unchanged original addresses.
      for (var saved of pointers) saved.attribute.pointer = saved.pointer;
      increment('restored');
    }
  };
  Module['tomePlanarClientArrayRefresh'] = metrics;
  return 1;
});

EMSCRIPTEN_KEEPALIVE int tome_planar_client_array_refresh_install(void) {
    if(tome_web_checkpoint_busy()||tome_physical_busy())return -2;
    if(!tome_main_get_state()||current_game!=LUA_NOREF)return -3;
    return tome_planar_refresh_install_js();
}

EM_JS(int, tome_planar_refresh_metric_js, (int field), {
  var value = Module['tomePlanarClientArrayRefresh'];
  if (!value) return 0;
  var names = ['installed','prepares','refreshes','restored','bypasses'];
  return field >= 0 && field < names.length ? Number(value[names[field]]) : 0;
});

EMSCRIPTEN_KEEPALIVE const char *tome_planar_client_array_refresh_status(void) {
    static char result[256];
    snprintf(result,sizeof(result),"{\"protocol\":1,\"installed\":%s,\"prepares\":%d,\"refreshes\":%d,\"restored\":%d,\"bypasses\":%d}",
      tome_planar_refresh_metric_js(0)?"true":"false",tome_planar_refresh_metric_js(1),
      tome_planar_refresh_metric_js(2),tome_planar_refresh_metric_js(3),tome_planar_refresh_metric_js(4));
    return result; /* Borrowed C-owned response; copy immediately. Getter only. */
}
