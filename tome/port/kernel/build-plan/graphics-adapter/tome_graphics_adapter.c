/* SPDX-License-Identifier: GPL-3.0-or-later
 * Browser platform compatibility for retained T-Engine 1.7.6 graphics.
 * This file is independently authored; upstream sources remain unchanged.
 */
#include <GL/gl.h>
#include <SDL2/SDL.h>
#include <emscripten.h>
#include <stddef.h>

/* Hooks the actual context's allocation operations. WebGL has no texture
 * level-size query; this records allocation dimensions, never pixel contents.
 * It also sees SDL/other JS uploads which bypass the C glTexImage2D entrypoint.
 */
EM_JS(void, tome_browser_graphics_install, (void), {
  if (typeof GLctx === 'undefined' || !GLctx) return;
  var root = Module['tomeGraphicsAdapter'];
  if (!root) root = Module['tomeGraphicsAdapter'] = { contexts: new WeakMap() };
  if (root.contexts.has(GLctx)) return;
  var ctx = GLctx;
  var state = { textures: new WeakMap(), attributes: [] };
  root.contexts.set(ctx, state);
  var binding = function(target) {
    if (target === 0x0DE1) return ctx.getParameter(0x8069);
    if (target >= 0x8515 && target <= 0x851A) return ctx.getParameter(0x8514);
    return null;
  };
  var remember = function(target, level, width, height, internalFormat) {
    var texture = binding(target);
    if (!texture || level < 0 || width < 0 || height < 0) return;
    var levels = state.textures.get(texture);
    if (!levels) state.textures.set(texture, levels = new Map());
    levels.set(target + ':' + level, { width: width, height: height, internalFormat: internalFormat });
  };
  var hook = function(name, after) {
    var original = ctx[name];
    if (!original) return;
    ctx[name] = function() {
      var result = original.apply(ctx, arguments);
      after(arguments);
      return result;
    };
  };
  hook('texImage2D', function(a) {
    if (a.length >= 9) remember(a[0], a[1], a[3], a[4], a[2]);
    else if (a.length === 6 && a[5]) {
      var image = a[5];
      remember(a[0], a[1], image.videoWidth || image.naturalWidth || image.width,
        image.videoHeight || image.naturalHeight || image.height, a[2]);
    }
  });
  hook('compressedTexImage2D', function(a) { remember(a[0], a[1], a[3], a[4], a[2]); });
  hook('copyTexImage2D', function(a) { remember(a[0], a[1], a[5], a[6], a[2]); });
  hook('texStorage2D', function(a) {
    for (var level = 0; level < a[1]; ++level)
      remember(a[0], level, Math.max(1, a[3] >> level), Math.max(1, a[4] >> level), a[2]);
  });
  hook('generateMipmap', function(a) {
    var target = a[0];
    var texture = binding(target === 0x8513 ? 0x8515 : target);
    var levels = texture && state.textures.get(texture);
    if (!levels) return;
    var targets = target === 0x8513 ? [0x8515, 0x8516, 0x8517, 0x8518, 0x8519, 0x851A] : [target];
    targets.forEach(function(face) {
      var base = levels.get(face + ':0');
      if (!base) return;
      var count = Math.floor(Math.log2(Math.max(base.width, base.height)));
      for (var level = 1; level <= count; ++level)
        remember(face, level, Math.max(1, base.width >> level), Math.max(1, base.height >> level), base.internalFormat);
    });
  });
  /* The original SDL surfaces use desktop component counts (3/4), sized
   * RGB8/RGBA8 internals and BGR/BGRA input. The SDK's WebGL pixel helper does
   * not understand BGR/BGRA, so C uploads must be normalized before it runs.
   * Copying real bytes here preserves alpha and observes the caller's unpack
   * alignment/row length/skips; it never substitutes an empty image.
   */
  state.upload2d = function(subImage, target, level, internalFormat, width, height, border, x, y, format, type, pixels) {
    if (target !== 0x0DE1 && !(target >= 0x8515 && target <= 0x851A)) { GL.recordError(0x0500); return; }
    if (type !== 0x1401 || (format !== 0x1907 && format !== 0x1908 && format !== 0x80E0 && format !== 0x80E1)) {
      GL.recordError(0x0500); return;
    }
    if (level < 0 || width < 0 || height < 0 || border !== 0) { GL.recordError(0x0501); return; }
    var webgl2 = typeof ctx.readBuffer === 'function';
    if (webgl2 && ctx.getParameter(0x88EF)) { GL.recordError(0x0502); return; }
    var sourceChannels = format === 0x1907 || format === 0x80E0 ? 3 : 4;
    var destinationChannels = sourceChannels;
    var destinationInternal = internalFormat;
    if (subImage) {
      var texture = binding(target);
      var levels = texture && state.textures.get(texture);
      var image = levels && levels.get(target + ':' + level);
      if (image) {
        if (image.internalFormat === 0x1907 || image.internalFormat === 0x8051) destinationChannels = 3;
        else if (image.internalFormat === 0x1908 || image.internalFormat === 0x8058) destinationChannels = 4;
        else { GL.recordError(0x0500); return; }
      }
    }
    if (!subImage) {
      if (internalFormat === 3 || internalFormat === 0x1907 || internalFormat === 0x8051) {
        destinationChannels = 3; destinationInternal = webgl2 && internalFormat === 0x8051 ? 0x8051 : 0x1907;
      } else if (internalFormat === 4 || internalFormat === 0x1908 || internalFormat === 0x8058) {
        destinationChannels = 4; destinationInternal = webgl2 && internalFormat === 0x8058 ? 0x8058 : 0x1908;
      } else { GL.recordError(0x0500); return; }
    }
    var destinationFormat = destinationChannels === 3 ? 0x1907 : 0x1908;
    var alignment = ctx.getParameter(0x0CF5);
    var rowLength = webgl2 ? ctx.getParameter(0x0CF2) : 0;
    var skipRows = webgl2 ? ctx.getParameter(0x0CF3) : 0;
    var skipPixels = webgl2 ? ctx.getParameter(0x0CF4) : 0;
    var converted = null;
    if (pixels) {
      pixels = pixels >>> 0;
      var stride = Math.ceil((rowLength || width) * sourceChannels / alignment) * alignment;
      var start = pixels + skipRows * stride + skipPixels * sourceChannels;
      var end = start + Math.max(0, height - 1) * stride + width * sourceChannels;
      if (end > HEAPU8.length || start < 0) { GL.recordError(0x0502); return; }
      try { converted = new Uint8Array(width * height * destinationChannels); }
      catch (error) { GL.recordError(0x0505); return; }
      var reverse = format === 0x80E0 || format === 0x80E1;
      for (var row = 0; row < height; ++row) {
        for (var column = 0; column < width; ++column) {
          var source = start + row * stride + column * sourceChannels;
          var destination = (row * width + column) * destinationChannels;
          converted[destination] = HEAPU8[source + (reverse ? 2 : 0)];
          converted[destination + 1] = HEAPU8[source + 1];
          converted[destination + 2] = HEAPU8[source + (reverse ? 0 : 2)];
          if (destinationChannels === 4) converted[destination + 3] = sourceChannels === 4 ? HEAPU8[source + 3] : 255;
        }
      }
    } else if (subImage && width && height) { GL.recordError(0x0501); return; }
    try {
      ctx.pixelStorei(0x0CF5, 1);
      if (webgl2) { ctx.pixelStorei(0x0CF2, 0); ctx.pixelStorei(0x0CF3, 0); ctx.pixelStorei(0x0CF4, 0); }
      if (subImage) ctx.texSubImage2D(target, level, x, y, width, height, destinationFormat, type, converted);
      else ctx.texImage2D(target, level, destinationInternal, width, height, border, destinationFormat, type, converted);
    } finally {
      ctx.pixelStorei(0x0CF5, alignment);
      if (webgl2) { ctx.pixelStorei(0x0CF2, rowLength); ctx.pixelStorei(0x0CF3, skipRows); ctx.pixelStorei(0x0CF4, skipPixels); }
    }
  };
  /* A sampled texture need not be framebuffer-renderable (for example some
   * RGB/compressed formats). Render its level-zero texels into an RGBA target
   * with an isolated VAO, and restore every WebGL state this draw touches.
   * Upper mip levels have no upstream call sites and deliberately report an
   * unsupported operation when a direct attachment cannot read them.
   */
  state.blitToRgba = function(texture, width, height, framebuffer) {
    var vaoApi;
    if (typeof ctx.createVertexArray === 'function') {
      vaoApi = { create: function() { return ctx.createVertexArray(); },
        bind: function(value) { ctx.bindVertexArray(value); },
        remove: function(value) { ctx.deleteVertexArray(value); } };
    } else {
      var extension = ctx.getExtension('OES_vertex_array_object');
      if (!extension) { GL.recordError(0x0502); return null; }
      vaoApi = { create: function() { return extension.createVertexArrayOES(); },
        bind: function(value) { extension.bindVertexArrayOES(value); },
        remove: function(value) { extension.deleteVertexArrayOES(value); } };
    }
    var saved = { program: ctx.getParameter(0x8B8D), vao: ctx.getParameter(0x85B5),
      buffer: ctx.getParameter(0x8894), viewport: Array.from(ctx.getParameter(0x0BA2)),
      activeTexture: ctx.getParameter(0x84E0), colorMask: Array.from(ctx.getParameter(0x0C23)),
      enabled: [0x0BE2, 0x0BD0, 0x0B71, 0x0B90, 0x0C11, 0x0B44, 0x809E, 0x80A0].concat(
        typeof ctx.bindSampler === 'function' ? [0x8C89] : []).map(function(cap) { return [cap, ctx.isEnabled(cap)]; }) };
    ctx.activeTexture(0x84C0);
    saved.texture0 = ctx.getParameter(0x8069);
    if (typeof ctx.bindSampler === 'function') saved.sampler0 = ctx.getParameter(0x8919);
    var targetTexture = ctx.createTexture();
    var vao = vaoApi.create(), buffer = ctx.createBuffer(), program = ctx.createProgram();
    var vertex = ctx.createShader(0x8B31), fragment = ctx.createShader(0x8B30);
    var samplerParameters;
    var success = false;
    try {
      if (!targetTexture || !vao || !buffer || !program || !vertex || !fragment) {
        GL.recordError(0x0505); return null;
      }
      ctx.bindTexture(0x0DE1, targetTexture);
      ctx.texParameteri(0x0DE1, 0x2801, 0x2600); ctx.texParameteri(0x0DE1, 0x2800, 0x2600);
      ctx.texParameteri(0x0DE1, 0x2802, 0x812F); ctx.texParameteri(0x0DE1, 0x2803, 0x812F);
      ctx.texImage2D(0x0DE1, 0, 0x1908, width, height, 0, 0x1908, 0x1401, null);
      ctx.bindFramebuffer(0x8D40, framebuffer);
      ctx.framebufferTexture2D(0x8D40, 0x8CE0, 0x0DE1, targetTexture, 0);
      if (ctx.checkFramebufferStatus(0x8D40) !== 0x8CD5) { GL.recordError(0x0502); return null; }
      ctx.shaderSource(vertex, 'attribute vec2 position; varying vec2 uv; void main(){ uv=position*0.5+0.5; gl_Position=vec4(position,0.0,1.0); }');
      ctx.shaderSource(fragment, 'precision highp float; varying vec2 uv; uniform sampler2D image; void main(){ gl_FragColor=texture2D(image,uv); }');
      ctx.compileShader(vertex); ctx.compileShader(fragment);
      if (!ctx.getShaderParameter(vertex, 0x8B81) || !ctx.getShaderParameter(fragment, 0x8B81)) {
        GL.recordError(0x0502); return null;
      }
      ctx.attachShader(program, vertex); ctx.attachShader(program, fragment);
      ctx.bindAttribLocation(program, 0, 'position'); ctx.linkProgram(program);
      if (!ctx.getProgramParameter(program, 0x8B82)) { GL.recordError(0x0502); return null; }
      vaoApi.bind(vao);
      ctx.bindBuffer(0x8892, buffer);
      ctx.bufferData(0x8892, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), 0x88E4);
      ctx.enableVertexAttribArray(0); ctx.vertexAttribPointer(0, 2, 0x1406, false, 0, 0);
      ctx.useProgram(program); ctx.uniform1i(ctx.getUniformLocation(program, 'image'), 0);
      ctx.bindTexture(0x0DE1, texture);
      if (typeof ctx.bindSampler === 'function') ctx.bindSampler(0, null);
      samplerParameters = [0x2801, 0x2800, 0x2802, 0x2803].map(function(name) { return [name, ctx.getTexParameter(0x0DE1, name)]; });
      ctx.texParameteri(0x0DE1, 0x2801, 0x2600); ctx.texParameteri(0x0DE1, 0x2800, 0x2600);
      ctx.texParameteri(0x0DE1, 0x2802, 0x812F); ctx.texParameteri(0x0DE1, 0x2803, 0x812F);
      saved.enabled.forEach(function(entry) { ctx.disable(entry[0]); });
      ctx.colorMask(true,true,true,true); ctx.viewport(0,0,width,height);
      ctx.drawArrays(0x0005, 0, 4);
      success = true;
      return targetTexture;
    } finally {
      if (samplerParameters) {
        ctx.bindTexture(0x0DE1, texture);
        samplerParameters.forEach(function(entry) { ctx.texParameteri(0x0DE1, entry[0], entry[1]); });
      }
      ctx.bindTexture(0x0DE1, saved.texture0);
      if (typeof ctx.bindSampler === 'function') ctx.bindSampler(0, saved.sampler0);
      ctx.activeTexture(saved.activeTexture);
      ctx.useProgram(saved.program); vaoApi.bind(saved.vao); ctx.bindBuffer(0x8892, saved.buffer);
      ctx.viewport(saved.viewport[0],saved.viewport[1],saved.viewport[2],saved.viewport[3]);
      ctx.colorMask(saved.colorMask[0],saved.colorMask[1],saved.colorMask[2],saved.colorMask[3]);
      saved.enabled.forEach(function(entry) { if (entry[1]) ctx.enable(entry[0]); else ctx.disable(entry[0]); });
      if (vertex) ctx.deleteShader(vertex); if (fragment) ctx.deleteShader(fragment);
      if (program) ctx.deleteProgram(program); if (buffer) ctx.deleteBuffer(buffer); if (vao) vaoApi.remove(vao);
      if (!success && targetTexture) ctx.deleteTexture(targetTexture);
    }
  };
});

/* Link wrappers scope normalization to original C calls and leave the SDK's
 * own GL imports/procedure-table providers intact. */
EM_JS(void, __wrap_glTexImage2D, (GLenum target, GLint level, GLint internalFormat, GLsizei width, GLsizei height, GLint border, GLenum format, GLenum type, const GLvoid *pixels), {
  tome_browser_graphics_install();
  if (!GLctx) { GL.recordError(0x0502); return; }
  Module['tomeGraphicsAdapter'].contexts.get(GLctx).upload2d(false, target, level, internalFormat, width, height, border, 0, 0, format, type, pixels);
});

EM_JS(void, __wrap_glTexSubImage2D, (GLenum target, GLint level, GLint x, GLint y, GLsizei width, GLsizei height, GLenum format, GLenum type, const GLvoid *pixels), {
  tome_browser_graphics_install();
  if (!GLctx) { GL.recordError(0x0502); return; }
  Module['tomeGraphicsAdapter'].contexts.get(GLctx).upload2d(true, target, level, 0, width, height, 0, x, y, format, type, pixels);
});

/* All upstream attribute-stack calls request GL_VIEWPORT_BIT. That group
 * consists of the viewport and depth range. Unsupported groups fail loudly
 * through the GL error channel; they are never silently discarded.
 */
EM_JS(void, glPushAttrib, (GLbitfield mask), {
  tome_browser_graphics_install();
  if (!GLctx) { GL.recordError(0x0502); return; }
  if (mask & ~0x00000800) { GL.recordError(0x0501); return; }
  var state = Module['tomeGraphicsAdapter'].contexts.get(GLctx);
  if (state.attributes.length >= 16) { GL.recordError(0x0503); return; }
  state.attributes.push({ mask: mask,
    viewport: mask ? Array.from(GLctx.getParameter(0x0BA2)) : null,
    depthRange: mask ? Array.from(GLctx.getParameter(0x0B70)) : null });
});

EM_JS(void, glPopAttrib, (void), {
  tome_browser_graphics_install();
  if (!GLctx) { GL.recordError(0x0502); return; }
  var state = Module['tomeGraphicsAdapter'].contexts.get(GLctx);
  if (!state.attributes.length) { GL.recordError(0x0504); return; }
  var entry = state.attributes.pop();
  if (entry.mask) {
    GLctx.viewport(entry.viewport[0], entry.viewport[1], entry.viewport[2], entry.viewport[3]);
    GLctx.depthRange(entry.depthRange[0], entry.depthRange[1]);
  }
});

/* Replaces the installed SDK's aborting legacy GL size-query entrypoint. */
EM_JS(void, glGetTexLevelParameteriv, (GLenum target, GLint level, GLenum pname, GLint *params), {
  tome_browser_graphics_install();
  if (!GLctx || !params) { GL.recordError(0x0502); return; }
  if (target !== 0x0DE1) { GL.recordError(0x0500); return; }
  if (level < 0) { GL.recordError(0x0501); return; }
  var state = Module['tomeGraphicsAdapter'].contexts.get(GLctx);
  var texture = GLctx.getParameter(0x8069);
  var levels = texture && state.textures.get(texture);
  var image = levels && levels.get(target + ':' + level);
  var result;
  if (pname === 0x1000) result = image ? image.width : 0;
  else if (pname === 0x1001) result = image ? image.height : 0;
  else if (pname === 0x1003) result = image ? image.internalFormat : 0;
  else { GL.recordError(0x0500); return; }
  HEAP32[params >> 2] = result;
});

/* Reads the actual bound texture through a temporary framebuffer, converts
 * the three formats used by core_lua.c, and observes desktop pixel packing.
 * No texture binding, viewport, depth, or simulation/RNG state is changed.
 */
EM_JS(void, glGetTexImage, (GLenum target, GLint level, GLenum format, GLenum type, GLvoid *pixels), {
  tome_browser_graphics_install();
  if (!GLctx || !pixels) { GL.recordError(0x0502); return; }
  if (target !== 0x0DE1 || type !== 0x1401 || (format !== 0x1907 && format !== 0x1908 && format !== 0x80E1)) {
    GL.recordError(0x0500); return;
  }
  if (level < 0) { GL.recordError(0x0501); return; }
  var ctx = GLctx;
  var state = Module['tomeGraphicsAdapter'].contexts.get(ctx);
  var texture = ctx.getParameter(0x8069);
  var levels = texture && state.textures.get(texture);
  var image = levels && levels.get(target + ':' + level);
  if (!image || !image.width || !image.height) { GL.recordError(0x0502); return; }
  var webgl2 = typeof ctx.readBuffer === 'function';
  var pack = ctx.getParameter(0x0D05);
  var rowLength = webgl2 ? ctx.getParameter(0x0D02) : 0;
  var skipRows = webgl2 ? ctx.getParameter(0x0D03) : 0;
  var skipPixels = webgl2 ? ctx.getParameter(0x0D04) : 0;
  if (webgl2 && ctx.getParameter(0x88ED)) { GL.recordError(0x0502); return; }
  var oldDraw = ctx.getParameter(webgl2 ? 0x8CA6 : 0x8CA6);
  var oldRead = webgl2 ? ctx.getParameter(0x8CAA) : oldDraw;
  var temporary = ctx.createFramebuffer();
  var conversionTexture = null;
  if (!temporary) { GL.recordError(0x0505); return; }
  try {
    ctx.bindFramebuffer(0x8D40, temporary);
    ctx.framebufferTexture2D(0x8D40, 0x8CE0, target, texture, level);
    if (ctx.checkFramebufferStatus(0x8D40) !== 0x8CD5) {
      if (level !== 0) { GL.recordError(0x0502); return; }
      conversionTexture = state.blitToRgba(texture, image.width, image.height, temporary);
      if (!conversionTexture) return;
    }
    ctx.pixelStorei(0x0D05, 1);
    if (webgl2) {
      ctx.pixelStorei(0x0D02, 0); ctx.pixelStorei(0x0D03, 0); ctx.pixelStorei(0x0D04, 0);
    }
    var rgba = new Uint8Array(image.width * image.height * 4);
    ctx.readPixels(0, 0, image.width, image.height, 0x1908, 0x1401, rgba);
    var channels = format === 0x1907 ? 3 : 4;
    var stride = Math.ceil((rowLength || image.width) * channels / pack) * pack;
    var start = pixels + skipRows * stride + skipPixels * channels;
    var end = start + (image.height - 1) * stride + image.width * channels;
    if (end > HEAPU8.length || start < 0) { GL.recordError(0x0502); return; }
    for (var y = 0; y < image.height; ++y) {
      for (var x = 0; x < image.width; ++x) {
        var source = (y * image.width + x) * 4;
        var destination = start + y * stride + x * channels;
        HEAPU8[destination] = rgba[source + (format === 0x80E1 ? 2 : 0)];
        HEAPU8[destination + 1] = rgba[source + 1];
        HEAPU8[destination + 2] = rgba[source + (format === 0x80E1 ? 0 : 2)];
        if (channels === 4) HEAPU8[destination + 3] = rgba[source + 3];
      }
    }
  } finally {
    ctx.pixelStorei(0x0D05, pack);
    if (webgl2) {
      ctx.pixelStorei(0x0D02, rowLength); ctx.pixelStorei(0x0D03, skipRows); ctx.pixelStorei(0x0D04, skipPixels);
      ctx.bindFramebuffer(0x8CA9, oldDraw); ctx.bindFramebuffer(0x8CA8, oldRead);
    } else ctx.bindFramebuffer(0x8D40, oldDraw);
    ctx.deleteFramebuffer(temporary);
    if (conversionTexture) ctx.deleteTexture(conversionTexture);
  }
});

typedef void (*tome_gl_proc)(void);
tome_gl_proc glXGetProcAddressARB(const GLubyte *name)
{
  tome_browser_graphics_install();
  return (tome_gl_proc)SDL_GL_GetProcAddress((const char *)name);
}

/* GLX belongs to X11; the browser truthfully has no GLX version/extensions. */
const char *glXGetClientString(void *display, int name)
{
  (void)display; (void)name;
  return NULL;
}
int glXQueryVersion(void *display, int *major, int *minor)
{
  (void)display;
  if (major) *major = 0;
  if (minor) *minor = 0;
  return 0;
}

extern GLenum __real_glewInit(void);
/* Link with --wrap=glewInit. The context initializer is static in the original
 * non-MX TU, so retain the public original initializer rather than inventing
 * feature flags or exposing internals. Its GL phase runs normally. Its GLX
 * phase then reports GLEW_ERROR_GLX_VERSION_11_ONLY when SDL has no GLX entry
 * points; the browser bootstrap must accept only that specific platform status
 * after the real GL phase succeeded, and propagate every other failure.
 */
GLenum __wrap_glewInit(void)
{
  tome_browser_graphics_install();
  return __real_glewInit();
}
