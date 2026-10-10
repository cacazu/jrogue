/* SPDX-License-Identifier: GPL-3.0-or-later */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const directory = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(directory,'tome_graphics_adapter.c'),'utf8');
const functions = [...source.matchAll(/EM_JS\(void, (\w+), \(([^\n]*)\), \{([\s\S]*?)^\}\);/gm)].map(([,name,parameters,body]) => {
  const names = parameters === 'void' ? '' : parameters.split(',').map(item => /([A-Za-z_]\w*)\s*$/.exec(item)[1]).join(',');
  return `function ${name}(${names}) {${body}\n}`;
}).join('\n');
const tests = `
var GLctx, Module = {}, errors = [];
var GL = { recordError: function(value) { errors.push(value); } };
var heap = new ArrayBuffer(1024*1024), HEAPU8 = new Uint8Array(heap), HEAP32 = new Int32Array(heap);
${functions}
function equal(actual,expected,label) {
  if (JSON.stringify(Array.from(actual)) !== JSON.stringify(Array.from(expected))) throw Error(label+': '+Array.from(actual)+' != '+Array.from(expected));
}
function check(value,label) { if (!value) throw Error(label); }
function exercise(contextName) {
  var canvas = document.createElement('canvas'); canvas.width=64; canvas.height=64;
  document.getElementById('canvases').appendChild(canvas);
  var ctx = canvas.getContext(contextName, { antialias:false, alpha:true, preserveDrawingBuffer:true });
  if (!ctx) return {context:contextName,skipped:true,reason:'Context unavailable'};
  GLctx = ctx; errors=[]; tome_browser_graphics_install();
  var rgba = new Uint8Array([1,2,3,4, 5,6,7,8, 9,10,11,12, 13,14,15,16]);
  var source = ctx.createTexture(); ctx.bindTexture(ctx.TEXTURE_2D,source);
  ctx.texParameteri(ctx.TEXTURE_2D,ctx.TEXTURE_MIN_FILTER,ctx.NEAREST);
  ctx.texParameteri(ctx.TEXTURE_2D,ctx.TEXTURE_MAG_FILTER,ctx.NEAREST);
  ctx.texParameteri(ctx.TEXTURE_2D,ctx.TEXTURE_WRAP_S,ctx.CLAMP_TO_EDGE);
  ctx.texParameteri(ctx.TEXTURE_2D,ctx.TEXTURE_WRAP_T,ctx.CLAMP_TO_EDGE);
  ctx.pixelStorei(ctx.UNPACK_ALIGNMENT,1);
  ctx.texImage2D(ctx.TEXTURE_2D,0,ctx.RGBA,2,2,0,ctx.RGBA,ctx.UNSIGNED_BYTE,rgba);
  ctx.pixelStorei(ctx.PACK_ALIGNMENT,4);
  ctx.viewport(3,4,42,32); ctx.depthRange(0.25,0.75);
  var previous = ctx.createFramebuffer(); ctx.bindFramebuffer(ctx.FRAMEBUFFER,previous);
  var previousRead = null;
  if (contextName==='webgl2') { previousRead=ctx.createFramebuffer();ctx.bindFramebuffer(ctx.READ_FRAMEBUFFER,previousRead); }
  glGetTexLevelParameteriv(ctx.TEXTURE_2D,0,0x1000,32); glGetTexLevelParameteriv(ctx.TEXTURE_2D,0,0x1001,36);
  equal(HEAP32.slice(8,10),[2,2],'dimensions');
  HEAPU8.fill(0xEE);
  glGetTexImage(ctx.TEXTURE_2D,0,ctx.RGBA,ctx.UNSIGNED_BYTE,128);
  equal(HEAPU8.slice(128,144),rgba,'RGBA actual texels');
  glGetTexImage(ctx.TEXTURE_2D,0,0x80E1,ctx.UNSIGNED_BYTE,160);
  equal(HEAPU8.slice(160,176),[3,2,1,4,7,6,5,8,11,10,9,12,15,14,13,16],'BGRA channel mapping');
  glGetTexImage(ctx.TEXTURE_2D,0,ctx.RGB,ctx.UNSIGNED_BYTE,192);
  equal(HEAPU8.slice(192,206),[1,2,3,5,6,7,0xEE,0xEE,9,10,11,13,14,15],'RGB alignment');
  check(ctx.getParameter(ctx.FRAMEBUFFER_BINDING)===previous,'framebuffer restoration');
  if(contextName==='webgl2') check(ctx.getParameter(ctx.READ_FRAMEBUFFER_BINDING)===previousRead,'read framebuffer restoration');
  check(ctx.getParameter(ctx.TEXTURE_BINDING_2D)===source,'texture binding restoration');
  check(ctx.getParameter(ctx.PACK_ALIGNMENT)===4,'pack restoration');
  equal(ctx.getParameter(ctx.VIEWPORT),[3,4,42,32],'viewport preservation');
  glPushAttrib(0x800);ctx.viewport(0,0,2,2);ctx.depthRange(0,1);glPushAttrib(0x800);ctx.viewport(1,1,1,1);
  glPopAttrib();equal(ctx.getParameter(ctx.VIEWPORT),[0,0,2,2],'nested viewport');
  glPopAttrib();equal(ctx.getParameter(ctx.VIEWPORT),[3,4,42,32],'viewport stack');
  equal(ctx.getParameter(ctx.DEPTH_RANGE),[0.25,0.75],'depth range stack');
  var before = { viewport:Array.from(ctx.getParameter(ctx.VIEWPORT)), program:ctx.getParameter(ctx.CURRENT_PROGRAM), buffer:ctx.getParameter(ctx.ARRAY_BUFFER_BINDING), activeTexture:ctx.getParameter(ctx.ACTIVE_TEXTURE), mask:Array.from(ctx.getParameter(ctx.COLOR_WRITEMASK)), blend:ctx.isEnabled(ctx.BLEND), dither:ctx.isEnabled(ctx.DITHER) };
  var originalStatus=ctx.checkFramebufferStatus, forced=true;
  ctx.checkFramebufferStatus=function(target) { if(forced){forced=false;return ctx.FRAMEBUFFER_INCOMPLETE_ATTACHMENT;}return originalStatus.call(ctx,target); };
  glGetTexImage(ctx.TEXTURE_2D,0,ctx.RGBA,ctx.UNSIGNED_BYTE,256);
  ctx.checkFramebufferStatus=originalStatus;
  equal(HEAPU8.slice(256,272),rgba,'forced conversion branch, real GPU texels');
  equal(ctx.getParameter(ctx.VIEWPORT),before.viewport,'blit viewport restoration');
  equal(ctx.getParameter(ctx.COLOR_WRITEMASK),before.mask,'blit color mask restoration');
  check(ctx.getParameter(ctx.CURRENT_PROGRAM)===before.program,'blit program restoration');
  check(ctx.getParameter(ctx.ARRAY_BUFFER_BINDING)===before.buffer,'blit buffer restoration');
  check(ctx.getParameter(ctx.ACTIVE_TEXTURE)===before.activeTexture,'blit active texture restoration');
  check(ctx.isEnabled(ctx.BLEND)===before.blend&&ctx.isEnabled(ctx.DITHER)===before.dither,'blit enable restoration');
  var rgbTexture=ctx.createTexture();ctx.bindTexture(ctx.TEXTURE_2D,rgbTexture);
  ctx.texParameteri(ctx.TEXTURE_2D,ctx.TEXTURE_MIN_FILTER,ctx.NEAREST);ctx.texParameteri(ctx.TEXTURE_2D,ctx.TEXTURE_MAG_FILTER,ctx.NEAREST);
  ctx.texParameteri(ctx.TEXTURE_2D,ctx.TEXTURE_WRAP_S,ctx.CLAMP_TO_EDGE);ctx.texParameteri(ctx.TEXTURE_2D,ctx.TEXTURE_WRAP_T,ctx.CLAMP_TO_EDGE);
  ctx.texImage2D(ctx.TEXTURE_2D,0,ctx.RGB,2,2,0,ctx.RGB,ctx.UNSIGNED_BYTE,new Uint8Array([1,2,3,5,6,7,9,10,11,13,14,15]));
  glGetTexImage(ctx.TEXTURE_2D,0,ctx.RGBA,ctx.UNSIGNED_BYTE,320);
  equal(HEAPU8.slice(320,336),[1,2,3,255,5,6,7,255,9,10,11,255,13,14,15,255],'RGB actual texture');
  var legacyTexture=ctx.createTexture();ctx.bindTexture(ctx.TEXTURE_2D,legacyTexture);
  ctx.texParameteri(ctx.TEXTURE_2D,ctx.TEXTURE_MIN_FILTER,ctx.NEAREST);ctx.texParameteri(ctx.TEXTURE_2D,ctx.TEXTURE_MAG_FILTER,ctx.NEAREST);
  ctx.texParameteri(ctx.TEXTURE_2D,ctx.TEXTURE_WRAP_S,ctx.CLAMP_TO_EDGE);ctx.texParameteri(ctx.TEXTURE_2D,ctx.TEXTURE_WRAP_T,ctx.CLAMP_TO_EDGE);
  ctx.pixelStorei(ctx.UNPACK_ALIGNMENT,4);
  HEAPU8.set([3,2,1,4,7,6,5,8,11,10,9,12,15,14,13,16],2048);
  __wrap_glTexImage2D(ctx.TEXTURE_2D,0,4,2,2,0,0x80E1,ctx.UNSIGNED_BYTE,2048);
  glGetTexImage(ctx.TEXTURE_2D,0,ctx.RGBA,ctx.UNSIGNED_BYTE,448);
  equal(HEAPU8.slice(448,464),rgba,'desktop 4/BGRA C upload');
  HEAPU8.set([3,2,1,7,6,5,0xEE,0xEE,11,10,9,15,14,13],2080);
  __wrap_glTexImage2D(ctx.TEXTURE_2D,0,0x8051,2,2,0,0x80E0,ctx.UNSIGNED_BYTE,2080);
  glGetTexImage(ctx.TEXTURE_2D,0,ctx.RGBA,ctx.UNSIGNED_BYTE,480);
  equal(HEAPU8.slice(480,496),[1,2,3,255,5,6,7,255,9,10,11,255,13,14,15,255],'RGB8/BGR C upload with padded input rows');
  __wrap_glTexSubImage2D(ctx.TEXTURE_2D,0,0,0,2,2,0x80E1,ctx.UNSIGNED_BYTE,2048);
  glGetTexImage(ctx.TEXTURE_2D,0,ctx.RGBA,ctx.UNSIGNED_BYTE,512);
  equal(HEAPU8.slice(512,528),[1,2,3,255,5,6,7,255,9,10,11,255,13,14,15,255],'BGRA subimage into RGB storage');
  check(ctx.getParameter(ctx.UNPACK_ALIGNMENT)===4,'unpack alignment restoration');
  var nonRenderableTest='Not applicable to this context';
  if(contextName==='webgl') {
    var luminance=ctx.createTexture();ctx.bindTexture(ctx.TEXTURE_2D,luminance);
    ctx.texParameteri(ctx.TEXTURE_2D,ctx.TEXTURE_MIN_FILTER,ctx.NEAREST);ctx.texParameteri(ctx.TEXTURE_2D,ctx.TEXTURE_MAG_FILTER,ctx.NEAREST);
    ctx.texParameteri(ctx.TEXTURE_2D,ctx.TEXTURE_WRAP_S,ctx.CLAMP_TO_EDGE);ctx.texParameteri(ctx.TEXTURE_2D,ctx.TEXTURE_WRAP_T,ctx.CLAMP_TO_EDGE);
    /* The preceding upload restores UNPACK_ALIGNMENT=4. Two 2-byte rows
     * therefore need a 4-byte stride, including padding before row two. */
    ctx.texImage2D(ctx.TEXTURE_2D,0,ctx.LUMINANCE,2,2,0,ctx.LUMINANCE,ctx.UNSIGNED_BYTE,new Uint8Array([32,64,0,0,128,255]));
    check(ctx.getError()===ctx.NO_ERROR,'Luminance allocation with padded input rows');
    glGetTexImage(ctx.TEXTURE_2D,0,ctx.RGBA,ctx.UNSIGNED_BYTE,384);
    equal(HEAPU8.slice(384,400),[32,32,32,255,64,64,64,255,128,128,128,255,255,255,255,255],'non-renderable luminance GPU conversion');
    nonRenderableTest='Luminance sampling to real RGBA framebuffer passed';
    ctx.deleteTexture(luminance);
  }
  check(errors.length===0,'Adapter GL errors: '+errors);
  check(ctx.getError()===ctx.NO_ERROR,'Real WebGL errors');
  ctx.bindFramebuffer(ctx.FRAMEBUFFER,null);ctx.deleteFramebuffer(previous);if(previousRead)ctx.deleteFramebuffer(previousRead);
  ctx.deleteTexture(source);ctx.deleteTexture(rgbTexture);ctx.deleteTexture(legacyTexture);
  return {context:contextName,passed:true,actualGpuReadback:true,rgba:true,rgb:true,bgra:true,packAlignment:true,nestedViewport:true,desktopCUploads:true,bgraBgrChannelConversion:true,unpackAlignment:true,shaderFallback:'Forced failure of source attachment; actual shader compilation, GPU draw and readback',nonRenderableTest:nonRenderableTest,scope:'Exact production EM_JS executed in real WebGL with a JS ArrayBuffer heap; not compiled full-engine integration.'};
}
var report={passed:false,method:'Real browser WebGL; exact production EM_JS bodies; independent JS heap fixture',results:[]};
try { report.results.push(exercise('webgl'));report.results.push(exercise('webgl2'));report.passed=report.results.some(x=>x.passed)&&report.results.every(x=>x.passed||x.skipped); }
catch(error) { report.error=error.stack||String(error); }
window.tomeGraphicsTestReport=report; document.getElementById('report').textContent=JSON.stringify(report,null,2);
document.title=report.passed?'PASS graphics adapter':'FAIL graphics adapter';
`;
new vm.Script(tests);
const html = '<!doctype html><html lang="en"><meta charset="utf-8"><title>Graphics adapter test</title><style>body{font-family:system-ui;margin:24px}canvas{border:1px solid #777;margin-right:16px}pre{white-space:pre-wrap}</style><h1>Retained graphics adapter verification</h1><p>Exact production EM_JS, real WebGL GPU operations, independent heap fixture. Full engine integration remains separate.</p><div id="canvases"></div><pre id="report">Running</pre><script>'+tests+'</script></html>';
fs.writeFileSync(path.join(directory,'graphics-browser-test.html'),html);
console.log(JSON.stringify({file:'graphics-browser-test.html',bytes:Buffer.byteLength(html),syntaxCheck:'passed',browserExecuted:false}));
