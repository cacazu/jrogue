/* SPDX-License-Identifier: GPL-3.0-or-later
 * Exercises the exact EM_JS bodies using a GL state recorder. This verifies
 * adapter algorithms/contracts; it is explicitly not a real-browser test.
 */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const directory = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(directory, 'tome_graphics_adapter.c'), 'utf8');
const extracted = [...source.matchAll(/EM_JS\(void, (\w+), \(([^\n]*)\), \{([\s\S]*?)^\}\);/gm)];
assert.equal(extracted.length, 7);
const constants = { TEXTURE_2D: 0xDE1, TEXTURE_BINDING_2D: 0x8069, FRAMEBUFFER: 0x8D40, FRAMEBUFFER_BINDING: 0x8CA6, READ_FRAMEBUFFER: 0x8CA8, DRAW_FRAMEBUFFER: 0x8CA9, READ_FRAMEBUFFER_BINDING: 0x8CAA, PACK_ALIGNMENT: 0xD05, PACK_ROW_LENGTH: 0xD02, PACK_SKIP_ROWS: 0xD03, PACK_SKIP_PIXELS: 0xD04, PIXEL_PACK_BUFFER_BINDING: 0x88ED, VIEWPORT: 0xBA2, DEPTH_RANGE: 0xB70 };
function fixture(webgl2 = false) {
  const texture = {}, previousDraw = {}, previousRead = {};
  const parameters = new Map([[constants.TEXTURE_BINDING_2D, texture], [constants.FRAMEBUFFER_BINDING, previousDraw], [constants.READ_FRAMEBUFFER_BINDING, previousRead], [constants.PACK_ALIGNMENT, 4], [constants.PACK_ROW_LENGTH, 0], [constants.PACK_SKIP_ROWS, 0], [constants.PACK_SKIP_PIXELS, 0], [constants.PIXEL_PACK_BUFFER_BINDING, null], [constants.VIEWPORT, [3, 4, 200, 100]], [constants.DEPTH_RANGE, [0.2, 0.8]]]);
  const pixels = new Uint8Array([1,2,3,4, 5,6,7,8, 9,10,11,12, 13,14,15,16]);
  parameters.set(0x8B8D, {}); parameters.set(0x85B5, {}); parameters.set(0x8894, {});
  parameters.set(0x84E0, 0x84C0); parameters.set(0x0C23, [true,false,true,false]); parameters.set(0x8919, {});
  parameters.set(0x0CF5,4); parameters.set(0x0CF2,0); parameters.set(0x0CF3,0); parameters.set(0x0CF4,0); parameters.set(0x88EF,null);
  const enabled = new Map([0x0BE2,0x0BD0,0x0B71,0x0B90,0x0C11,0x0B44,0x809E,0x80A0,0x8C89].map((value,index) => [value, index % 2 === 0]));
  const textureBindings = new Map([[0x84C0, texture]]);
  const context = { getParameter: name => name === constants.TEXTURE_BINDING_2D ? textureBindings.get(parameters.get(0x84E0)) : parameters.get(name),
    texImage2D(...args) { context.lastUpload=args; context.getParameter(constants.TEXTURE_BINDING_2D).pixels = args[8] || new Uint8Array(args[3]*args[4]*4); },
    texSubImage2D(...args) { context.lastSubUpload=args; },
    compressedTexImage2D() {}, copyTexImage2D() {}, generateMipmap() {},
    viewport: (...args) => parameters.set(constants.VIEWPORT, args),
    depthRange: (...args) => parameters.set(constants.DEPTH_RANGE, args),
    pixelStorei: (name, value) => parameters.set(name, value),
    createFramebuffer: () => ({}), deleteFramebuffer: framebuffer => { framebuffer.deleted = true; },
    framebufferTexture2D: (target, attachment, target2d, attached) => { context.attached = attached; },
    checkFramebufferStatus: () => context.attached?.sampleOnly ? 0x8CD6 : 0x8CD5,
    readPixels: (x, y, width, height, format, type, output) => output.set(context.attached.pixels),
    bindFramebuffer(target, framebuffer) {
      if (target === constants.FRAMEBUFFER || target === constants.DRAW_FRAMEBUFFER) parameters.set(constants.FRAMEBUFFER_BINDING, framebuffer);
      if (target === constants.FRAMEBUFFER || target === constants.READ_FRAMEBUFFER) parameters.set(constants.READ_FRAMEBUFFER_BINDING, framebuffer);
    },
    createTexture: () => ({}), deleteTexture: value => { value.deleted = true; },
    activeTexture: value => parameters.set(0x84E0,value),
    bindTexture: (target,value) => textureBindings.set(parameters.get(0x84E0),value),
    getTexParameter(target,name) { const value = context.getParameter(constants.TEXTURE_BINDING_2D); return value.sampler?.get(name) ?? 0x2601; },
    texParameteri(target,name,value) { const t = context.getParameter(constants.TEXTURE_BINDING_2D); (t.sampler ||= new Map()).set(name,value); },
    createBuffer: () => ({}), deleteBuffer() {}, bindBuffer: (target,value) => parameters.set(0x8894,value), bufferData() {},
    createProgram: () => ({}), deleteProgram() {}, useProgram: value => parameters.set(0x8B8D,value),
    createShader: () => ({}), deleteShader() {}, shaderSource() {}, compileShader() {},
    getShaderParameter: () => !context.forceShaderFailure, getProgramParameter: () => true,
    attachShader() {}, bindAttribLocation() {}, linkProgram() {}, getUniformLocation: () => ({}), uniform1i() {},
    enableVertexAttribArray() {}, vertexAttribPointer() {},
    colorMask: (...values) => parameters.set(0x0C23,values),
    isEnabled: name => enabled.get(name), enable: name => enabled.set(name,true), disable: name => enabled.set(name,false),
    drawArrays() { context.attached.pixels.set(context.getParameter(constants.TEXTURE_BINDING_2D).pixels); context.draws = (context.draws || 0) + 1; },
    getExtension: name => name === 'OES_vertex_array_object' ? {
      createVertexArrayOES: () => ({}), bindVertexArrayOES: value => parameters.set(0x85B5,value), deleteVertexArrayOES() {} } : null,
  };
  if (webgl2) {
    context.readBuffer = () => {}; context.texStorage2D = () => {};
    context.createVertexArray = () => ({}); context.bindVertexArray = value => parameters.set(0x85B5,value); context.deleteVertexArray = () => {};
    context.bindSampler = (unit,value) => parameters.set(0x8919,value);
  }
  const errors = [], heap = new ArrayBuffer(4096);
  const sandbox = { Module: {}, GLctx: context, GL: { recordError: value => errors.push(value) }, HEAPU8: new Uint8Array(heap), HEAP32: new Int32Array(heap), console };
  vm.createContext(sandbox);
  for (const [, name, declaration, body] of extracted) {
    const names = declaration === 'void' ? '' : declaration.split(',').map(item => /([A-Za-z_]\w*)\s*$/.exec(item)[1]).join(',');
    vm.runInContext(`function ${name}(${names}) {${body}\n}\n`, sandbox);
  }
  sandbox.tome_browser_graphics_install();
  context.texImage2D(constants.TEXTURE_2D, 0, 0x1908, 2, 2, 0, 0x1908, 0x1401, pixels);
  return { sandbox, context, parameters, errors, pixels, texture, previousDraw, previousRead, enabled, textureBindings };
}
const results = [];
for (const webgl2 of [false, true]) {
  const f = fixture(webgl2), a = f.sandbox;
  a.glGetTexLevelParameteriv(constants.TEXTURE_2D, 0, 0x1000, 32);
  a.glGetTexLevelParameteriv(constants.TEXTURE_2D, 0, 0x1001, 36);
  assert.deepEqual(Array.from(a.HEAP32.slice(8, 10)), [2, 2]);
  const before = new Map([...f.parameters].map(([key,value]) => [key, Array.isArray(value) ? [...value] : value]));
  a.HEAPU8.fill(0xEE);
  a.glGetTexImage(constants.TEXTURE_2D, 0, 0x1908, 0x1401, 128);
  assert.deepEqual(Array.from(a.HEAPU8.slice(128,144)), Array.from(f.pixels));
  assert.deepEqual(f.parameters, before);
  a.glGetTexImage(constants.TEXTURE_2D, 0, 0x80E1, 0x1401, 160);
  assert.deepEqual(Array.from(a.HEAPU8.slice(160,176)), [3,2,1,4,7,6,5,8,11,10,9,12,15,14,13,16]);
  a.glGetTexImage(constants.TEXTURE_2D, 0, 0x1907, 0x1401, 192);
  assert.deepEqual(Array.from(a.HEAPU8.slice(192,206)), [1,2,3,5,6,7,0xEE,0xEE,9,10,11,13,14,15]);
  assert.deepEqual(f.parameters, before);
  if (webgl2) {
    f.parameters.set(constants.PACK_ROW_LENGTH, 4); f.parameters.set(constants.PACK_SKIP_ROWS, 1); f.parameters.set(constants.PACK_SKIP_PIXELS, 1);
    a.glGetTexImage(constants.TEXTURE_2D, 0, 0x1908, 0x1401, 256);
    assert.deepEqual(Array.from(a.HEAPU8.slice(276,284)), [1,2,3,4,5,6,7,8]);
    assert.deepEqual(Array.from(a.HEAPU8.slice(292,300)), [9,10,11,12,13,14,15,16]);
    assert.equal(f.parameters.get(constants.PACK_ROW_LENGTH), 4);
    assert.equal(f.parameters.get(constants.PACK_SKIP_ROWS), 1);
    assert.equal(f.parameters.get(constants.PACK_SKIP_PIXELS), 1);
    assert.equal(f.parameters.get(constants.FRAMEBUFFER_BINDING), f.previousDraw);
    assert.equal(f.parameters.get(constants.READ_FRAMEBUFFER_BINDING), f.previousRead);
  }
  const originalViewport = [...f.parameters.get(constants.VIEWPORT)], originalDepth = [...f.parameters.get(constants.DEPTH_RANGE)];
  a.glPushAttrib(0x800); f.context.viewport(0,0,10,20); f.context.depthRange(0,1);
  a.glPushAttrib(0x800); f.context.viewport(0,0,4,5);
  a.glPopAttrib(); assert.deepEqual(f.parameters.get(constants.VIEWPORT), [0,0,10,20]);
  a.glPopAttrib(); assert.deepEqual(Array.from(f.parameters.get(constants.VIEWPORT)), originalViewport);
  assert.deepEqual(Array.from(f.parameters.get(constants.DEPTH_RANGE)), originalDepth);
  a.glPopAttrib(); assert.equal(f.errors.pop(), 0x504);
  a.glPushAttrib(0x100); assert.equal(f.errors.pop(), 0x501);
  for(let i=0;i<16;i++) a.glPushAttrib(0x800);
  a.glPushAttrib(0x800); assert.equal(f.errors.pop(), 0x503);
  for(let i=0;i<16;i++) a.glPopAttrib();
  assert.equal(f.errors.length, 0);
  f.texture.sampleOnly = true;
  const savedEnabled = new Map(f.enabled), savedParameters = new Map(f.parameters);
  f.texture.sampler = new Map([[0x2801,0x2703], [0x2800,0x2601], [0x2802,0x2901], [0x2803,0x2901]]);
  const savedSampler = new Map(f.texture.sampler);
  a.glGetTexImage(constants.TEXTURE_2D, 0, 0x1908, 0x1401, 512);
  const fallbackOffset = webgl2 ? 532 : 512;
  assert.deepEqual(Array.from(a.HEAPU8.slice(fallbackOffset,fallbackOffset+8)), [1,2,3,4,5,6,7,8]);
  assert.equal(f.context.draws,1);
  assert.deepEqual(f.parameters,savedParameters);
  assert.deepEqual(f.enabled,savedEnabled);
  assert.deepEqual(f.texture.sampler,savedSampler);
  assert.equal(f.textureBindings.get(0x84C0),f.texture);
  assert.equal(f.errors.length,0);
  f.context.forceShaderFailure = true;
  a.glGetTexImage(constants.TEXTURE_2D, 0, 0x1908, 0x1401, 640);
  assert.equal(f.errors.pop(),0x502);
  assert.deepEqual(f.parameters,savedParameters);
  assert.deepEqual(f.enabled,savedEnabled);
  assert.deepEqual(f.texture.sampler,savedSampler);
  f.context.generateMipmap(constants.TEXTURE_2D);
  a.glGetTexLevelParameteriv(constants.TEXTURE_2D, 1, 0x1000, 40); assert.equal(a.HEAP32[10],1);
  a.HEAPU8.set([3,2,1,4,7,6,5,8,11,10,9,12,15,14,13,16],768);
  a.__wrap_glTexImage2D(constants.TEXTURE_2D,0,4,2,2,0,0x80E1,0x1401,768);
  assert.equal(f.context.lastUpload[2],0x1908);
  assert.equal(f.context.lastUpload[6],0x1908);
  assert.deepEqual(Array.from(f.context.lastUpload[8]),Array.from(f.pixels));
  assert.equal(f.parameters.get(0x0CF5),4);
  a.HEAPU8.set([3,2,1,7,6,5,0xEE,0xEE,11,10,9,15,14,13],832);
  a.__wrap_glTexImage2D(constants.TEXTURE_2D,0,0x8051,2,2,0,0x80E0,0x1401,832);
  assert.equal(f.context.lastUpload[2],webgl2?0x8051:0x1907);
  assert.equal(f.context.lastUpload[6],0x1907);
  assert.deepEqual(Array.from(f.context.lastUpload[8]),[1,2,3,5,6,7,9,10,11,13,14,15]);
  a.__wrap_glTexSubImage2D(constants.TEXTURE_2D,0,0,0,2,2,0x80E1,0x1401,768);
  assert.equal(f.context.lastSubUpload[6],0x1907);
  assert.deepEqual(Array.from(f.context.lastSubUpload[8]),[1,2,3,5,6,7,9,10,11,13,14,15]);
  assert.equal(f.parameters.get(0x0CF5),4);
  assert.equal(f.errors.length,0);
  results.push({ recorder: webgl2 ? 'WebGL2 contract' : 'WebGL1 contract', dimensions: true, rgbaRgbBgra: true, packAlignment: true, stateRestoration: true, nestedAttributes: true, explicitErrors: true, mipDimensions: true, rgbaBlitStateRestoration: true, shaderFailureRestoration: true, rgbaBgraBgrUpload: true, desktopInternalFormats: true, unpackAlignmentRestoration: true });
}
const report = { adapterSource: 'tome_graphics_adapter.c', method: 'Exact EM_JS bodies evaluated against a state/pixel recorder; not browser graphics execution.', passed: true, results };
fs.writeFileSync(path.join(directory,'logic-test-report.json'), JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
