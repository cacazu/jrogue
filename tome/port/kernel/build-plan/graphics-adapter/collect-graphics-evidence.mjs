/* SPDX-License-Identifier: GPL-3.0-or-later */
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const directory = path.dirname(fileURLToPath(import.meta.url));
const compileExitArg = process.argv.indexOf('--compile-exit');
const compileExit = compileExitArg >= 0 ? Number(process.argv[compileExitArg+1]) : null;
const files = ['tome_graphics_adapter.c','tome_graphics_adapter.o','test-graphics-logic.mjs','logic-test-report.json','make-browser-test.mjs','graphics-browser-test.html'];
const report = {
  schemaVersion:1,
  compiler:'Installed Emscripten Clang 6.0.8', target:'wasm32-unknown-emscripten',
  compileCommand:{executable:'C:\\Users\\kit\\emsdk\\upstream\\bin\\clang.exe',arguments:['--target=wasm32-unknown-emscripten','--sysroot=C:\\Users\\kit\\emsdk\\upstream\\emscripten\\cache\\sysroot','-std=c11','-O2','-Wall','-Wextra','-Werror','-c','tome_graphics_adapter.c','-o','tome_graphics_adapter.o'],measuredExitCode:compileExit,observation:'Provide --compile-exit only after actually compiling the current revision. Existing object and old reports may describe an earlier readback-only version.'},
  linkFlags:['-Wl,--wrap=glewInit','-Wl,--wrap=glTexImage2D','-Wl,--wrap=glTexSubImage2D','-sLEGACY_GL_EMULATION=1','-lm'],
  files:files.map(name=>{const bytes=fs.readFileSync(path.join(directory,name));return {name,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};}),
  contracts:JSON.parse(fs.readFileSync(path.join(directory,'logic-test-report.json'),'utf8')),
  emJsNamingEvidence:{source:'C:\\Users\\kit\\emsdk\\upstream\\emscripten\\tools\\emscripten.py',line:796,observation:'Installed compiler emits EM_JS function names without an underscore prefix; exact production/test bodies use those names.'},
  realBrowserGraphics:{executed:false,reason:'Parent memory hold; real-WebGL harness prepared and syntax-checked, browser/full-engine integration remains parent-owned.'},
  upstreamModified:false,
};
fs.writeFileSync(path.join(directory,'graphics-adapter-evidence.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({files:report.files,contractTestsPassed:report.contracts.passed,realBrowserExecuted:false}));
