// Reuse the compiled unchanged original Lua parser. No rebuild, game execution,
// fake native bindings, or large source/asset preload is needed for this check.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';

const taskDir = path.dirname(fileURLToPath(import.meta.url));
const buildDir = path.join(taskDir, 'syntax-build');
const driver = fs.readFileSync(path.join(taskDir, 'real-core-probe.lua'));
const parserJs = path.join(buildDir, 'syntax.js');
const context = vm.createContext({
  console, process, Buffer, WebAssembly, TextDecoder, TextEncoder,
  setTimeout, clearTimeout, setInterval, clearInterval,
  __dirname: buildDir, __filename: parserJs,
  require: createRequire(parserJs), module: {exports:{}}, exports: {},
  driverBytes: new Uint8Array(driver),
});
vm.runInContext(`
  var Module = {
    onRuntimeInitialized: function () {
      FS.writeFile('/real-core-probe.lua', driverBytes);
    }
  };
`, context, {filename:'parser-input-adapter.js'});
console.log('TOME_PARSE_INPUT_SHA256='+createHash('sha256').update(driver).digest('hex'));
vm.runInContext(fs.readFileSync(parserJs,'utf8'),context,{filename:parserJs});
