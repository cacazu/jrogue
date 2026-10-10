// Small source-preparation tool. Never builds or modifies pristine/active sources.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const own = path.dirname(fileURLToPath(import.meta.url));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export const SOURCE_COMMIT = '7b2efa5cea38e4d4d97dd0e63b28b9148623da59';
export const PINNED = Object.freeze({
  'input_context.cpp': 'b097561a600be533c16f298a87897962d14b13de3f9d87e0de47123a9739972a',
  'input_context.h': '08ca8d31ca1dbba5206170b9ae342f422eaf1b502af38fd4f8bc215136497ce5',
  'input.cpp': '6b06bb6ba17f11bae0be60b86f42958e9120bf3254cf888ed87bacec2ea23582',
  'input.h': '56d8db0e9fdf18c07620ddf23fb690bca05fed8f5d4ef3218ed5678174e58416',
  'input_enums.h': 'fb0c91d86f087686e27333dea99df2708f142e397f80a4852788aa8a1762705c'
});
const include = '#include "browser_input_snapshot.h"\n';
const functionStart = 'const std::string &input_context::handle_input( const int timeout )\n{\n';
const anchor = '    next_action.type = input_event_t::error;\n';
function once(text, target, replacement) {
  const first = text.indexOf(target);
  if (first < 0 || text.indexOf(target, first + target.length) >= 0) throw Error(`Source anchor is not unique: ${target}`);
  return text.slice(0,first) + replacement + text.slice(first+target.length);
}
export function prepareInputSource(original, hook) {
  if (sha256(Buffer.from(original)) !== PINNED['input_context.cpp']) throw Error('Original input_context.cpp hash mismatch');
  if (original.includes('\r') || hook.includes('\r') || !hook.endsWith('\n')) throw Error('Expected exact LF source/hook');
  const start = original.indexOf(functionStart);
  if (start < 0 || original.indexOf(functionStart,start+1) >= 0) throw Error('Expected exact single handle_input overload');
  const position = original.indexOf(anchor,start);
  const originalTail = original.slice(start);
  if (position < start || position > start + 320) throw Error('Hook is not after original timeout setup');
  const timeoutPrefix = '    const int old_timeout = inp_mngr.get_timeout();\n    if( timeout >= 0 ) {\n        inp_mngr.set_timeout( timeout );\n    }\n';
  if (!originalTail.startsWith(functionStart + timeoutPrefix)) throw Error('Native timeout setup changed');
  let result = original.slice(0,position) + hook + original.slice(position);
  result = once(result, '#include "input_context.h"\n', '#include "input_context.h"\n' + include);
  return result;
}
export function removeInputOverlay(patched, hook) {
  return once(once(patched, include, ''), hook, '');
}
function addedFilePatch(name, text) {
  if (!text.endsWith('\n')) throw Error(`Missing final newline: ${name}`);
  const lines = text.slice(0,-1).split('\n');
  return `diff --git a/src/${name} b/src/${name}\nnew file mode 100644\n--- /dev/null\n+++ b/src/${name}\n@@ -0,0 +1,${lines.length} @@\n` + lines.map(line=>'+'+line).join('\n')+'\n';
}
export function sourcePatch(original, hook, modules) {
  const lines = original.slice(0,-1).split('\n');
  const marker = lines.indexOf('    next_action.type = input_event_t::error;');
  const hookLines = hook.slice(0,-1).split('\n');
  if (marker < 3 || lines[0] !== '#include "input_context.h"') throw Error('Unexpected insertion lines');
  let patch = 'diff --git a/src/input_context.cpp b/src/input_context.cpp\n--- a/src/input_context.cpp\n+++ b/src/input_context.cpp\n';
  patch += '@@ -1,2 +1,3 @@\n ' + lines[0] + '\n+' + include.slice(0,-1) + '\n ' + lines[1] + '\n';
  const start = marker-3;
  patch += `@@ -${start+1},5 +${start+2},${5+hookLines.length} @@\n`;
  patch += lines.slice(start,marker).map(line=>' '+line).join('\n')+'\n';
  patch += hookLines.map(line=>'+'+line).join('\n')+'\n';
  patch += lines.slice(marker,marker+2).map(line=>' '+line).join('\n')+'\n';
  for (const [name,text] of Object.entries(modules)) patch += addedFilePatch(name,text);
  return patch;
}
export async function generate(upstreamRoot) {
  const inputs = {};
  for (const [filename,expected] of Object.entries(PINNED)) {
    const bytes = await readFile(path.join(upstreamRoot,'src',filename));
    if (sha256(bytes) !== expected) throw Error(`Pinned source hash mismatch: ${filename}`);
    inputs[filename] = bytes;
  }
  const hook = await readFile(path.join(own,'hook-input-wait.inc'),'utf8');
  const modules = Object.fromEntries(await Promise.all(['browser_input_snapshot.h','browser_input_snapshot.cpp'].map(async name=>
    [name,await readFile(path.join(own,'src',name),'utf8')])));
  const original = inputs['input_context.cpp'].toString('utf8');
  const patched = prepareInputSource(original,hook);
  if (removeInputOverlay(patched,hook) !== original) throw Error('Overlay did not reverse byte-for-byte');
  const generated = path.join(own,'generated','src');
  await mkdir(generated,{recursive:true});
  await writeFile(path.join(generated,'input_context.cpp'),patched);
  for (const [name,text] of Object.entries(modules)) await writeFile(path.join(generated,name),text);
  const patch = sourcePatch(original,hook,modules);
  await writeFile(path.join(own,'live-input-snapshot.patch'),patch);
  const record = {schemaVersion:1,status:'source_preparation_only_uncompiled_unconnected',sourceCommit:SOURCE_COMMIT,
    sourceInputs:Object.entries(inputs).map(([name,bytes])=>({path:`src/${name}`,bytes:bytes.length,sha256:sha256(bytes)})),
    modifiedOriginalFiles:['src/input_context.cpp'],
    unchangedOriginalDependencies:['src/input_context.h','src/input.cpp','src/input.h','src/input_enums.h'],
    additions:Object.entries(modules).map(([name,text])=>({path:`src/${name}`,bytes:Buffer.byteLength(text),sha256:sha256(Buffer.from(text))})),
    hook:{path:'hook-input-wait.inc',sha256:sha256(Buffer.from(hook))},
    patchedInput:{path:'generated/src/input_context.cpp',bytes:Buffer.byteLength(patched),sha256:sha256(Buffer.from(patched))},
    patch:{path:'live-input-snapshot.patch',bytes:Buffer.byteLength(patch),sha256:sha256(Buffer.from(patch))},
    reversibleByteForByte:true,compilationPerformed:false,runtimeValidationPerformed:false,activeBuildChanged:false};
  await writeFile(path.join(own,'SOURCE-PREPARATION.json'),JSON.stringify(record,null,2)+'\n');
  return record;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const flag = process.argv.indexOf('--upstream');
  if (flag < 0 || !process.argv[flag+1]) throw Error('Pass --upstream with the exact pristine source directory');
  const record = await generate(path.resolve(process.argv[flag+1]));
  console.log(JSON.stringify({status:record.status,sourceInputs:record.sourceInputs.length,
    modifiedOriginalFiles:record.modifiedOriginalFiles,patch:record.patch,reversibleByteForByte:true}));
}
