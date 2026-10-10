// Lightweight source/patch checks only. Does not compile or execute C++/WASM.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { PINNED, SOURCE_COMMIT, prepareInputSource, removeInputOverlay } from './generate-overlay.mjs';

const own = path.dirname(fileURLToPath(import.meta.url));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
let assertions = 0;
function check(condition, description) {
  assertions++;
  assert.ok(condition, description);
}
function equal(actual, expected, description) {
  assertions++;
  assert.deepEqual(actual, expected, description);
}

function parsePatch(text) {
  check(text.endsWith('\n') && !text.includes('\r'), 'patch has exact LF/final newline');
  const lines = text.slice(0,-1).split('\n');
  const files = [];
  let cursor = 0;
  while (cursor < lines.length) {
    check(lines[cursor++].startsWith('diff --git '), 'file diff marker');
    if (lines[cursor].startsWith('new file mode ')) cursor++;
    check(lines[cursor].startsWith('--- '), 'old path marker');
    const oldPath = lines[cursor++].slice(4);
    check(lines[cursor].startsWith('+++ '), 'new path marker');
    const newPath = lines[cursor++].slice(4);
    const hunks = [];
    while (cursor < lines.length && !lines[cursor].startsWith('diff --git ')) {
      const match = /^@@ -(\d+),(\d+) \+(\d+),(\d+) @@$/.exec(lines[cursor++]);
      check(match !== null, 'standard unified hunk header');
      const hunk = {oldStart:Number(match[1]),oldCount:Number(match[2]),
        newStart:Number(match[3]),newCount:Number(match[4]),lines:[]};
      while (cursor < lines.length && !lines[cursor].startsWith('@@ ') &&
             !lines[cursor].startsWith('diff --git ')) {
        const line = lines[cursor++];
        check([' ','+','-'].includes(line[0]), 'standard unified hunk line');
        hunk.lines.push(line);
      }
      equal(hunk.lines.filter(line=>line[0] !== '+').length,hunk.oldCount,'old hunk count');
      equal(hunk.lines.filter(line=>line[0] !== '-').length,hunk.newCount,'new hunk count');
      hunks.push(hunk);
    }
    check(hunks.length > 0, 'file has hunks');
    files.push({oldPath,newPath,hunks});
  }
  return files;
}
function stripSide(value) {
  return value === '/dev/null' ? null : value.slice(2);
}
function applyPatch(files, changes, reverse=false) {
  const result = new Map(files);
  for (const file of changes) {
    const from = stripSide(reverse ? file.newPath : file.oldPath);
    const to = stripSide(reverse ? file.oldPath : file.newPath);
    check(from === null ? !result.has(to) : result.has(from), 'patch source existence');
    const source = from === null ? '' : result.get(from);
    check(source === '' || source.endsWith('\n'), 'source ends in LF');
    const sourceLines = source === '' ? [] : source.slice(0,-1).split('\n');
    const output = [];
    let consumed = 0;
    for (const hunk of file.hunks) {
      const start = reverse ? hunk.newStart : hunk.oldStart;
      const targetStart = reverse ? hunk.oldStart : hunk.newStart;
      const offset = start === 0 ? 0 : start-1;
      check(offset >= consumed && offset <= sourceLines.length, 'hunk position is in range');
      output.push(...sourceLines.slice(consumed,offset));
      consumed = offset;
      equal(output.length,targetStart === 0 ? 0 : targetStart-1,'target hunk position');
      for (const line of hunk.lines) {
        const operation = reverse ? ({'+':'-','-':'+',' ':' '})[line[0]] : line[0];
        const content = line.slice(1);
        if (operation !== '+') {
          equal(sourceLines[consumed],content,'patch context/removal matches exact source');
          consumed++;
        }
        if (operation !== '-') output.push(content);
      }
    }
    output.push(...sourceLines.slice(consumed));
    if (from !== null) result.delete(from);
    if (to === null) equal(output.length,0,'reverse addition removes complete file');
    else result.set(to,output.join('\n')+'\n');
  }
  return result;
}

const flag = process.argv.indexOf('--upstream');
check(flag >= 0 && Boolean(process.argv[flag+1]), 'explicit upstream path required');
const upstream = path.resolve(process.argv[flag+1]);
const sources = {};
for (const [filename,expected] of Object.entries(PINNED)) {
  const bytes = await readFile(path.join(upstream,'src',filename));
  equal(sha256(bytes),expected,`pristine ${filename} unchanged`);
  sources[filename] = bytes.toString('utf8');
}
const hook = await readFile(path.join(own,'hook-input-wait.inc'),'utf8');
const header = await readFile(path.join(own,'src/browser_input_snapshot.h'),'utf8');
const cpp = await readFile(path.join(own,'src/browser_input_snapshot.cpp'),'utf8');
const generated = await readFile(path.join(own,'generated/src/input_context.cpp'),'utf8');
const patchBytes = await readFile(path.join(own,'live-input-snapshot.patch'));
const record = JSON.parse(await readFile(path.join(own,'SOURCE-PREPARATION.json'),'utf8'));
equal(record.sourceCommit,SOURCE_COMMIT,'correct upstream identity');
equal(record.status,'source_preparation_only_uncompiled_unconnected','honest source-only status');
equal([record.compilationPerformed,record.runtimeValidationPerformed,record.activeBuildChanged],
  [false,false,false],'no compilation/runtime/build changes claimed');
equal(record.modifiedOriginalFiles,['src/input_context.cpp'],'only original wait TU changes');
equal(record.sourceInputs.map(item=>[item.path.slice(4),item.sha256]),Object.entries(PINNED),'source pins recorded');
equal(record.patch.sha256,sha256(patchBytes),'patch provenance hash');
equal(record.patchedInput.sha256,sha256(Buffer.from(generated)),'generated source provenance hash');
equal(record.hook.sha256,sha256(Buffer.from(hook)),'hook provenance hash');
for (const [name,text] of [['browser_input_snapshot.h',header],['browser_input_snapshot.cpp',cpp]]) {
  equal(await readFile(path.join(own,'generated/src',name),'utf8'),text,'generated module equals reviewed source');
  equal(record.additions.find(item=>item.path === `src/${name}`).sha256,sha256(Buffer.from(text)),'module provenance hash');
}
equal(prepareInputSource(sources['input_context.cpp'],hook),generated,'exact source hook generation');
equal(removeInputOverlay(generated,hook),sources['input_context.cpp'],'all non-hook original bytes preserved');
assertions++;
assert.throws(()=>prepareInputSource(sources['input_context.cpp']+'\n',hook),/hash mismatch/,
  'changed source rejected before output');

const changes = parsePatch(patchBytes.toString('utf8'));
equal(changes.map(file=>stripSide(file.newPath)),
  ['src/input_context.cpp','src/browser_input_snapshot.h','src/browser_input_snapshot.cpp'],'exact three-file patch');
const before = new Map([['src/input_context.cpp',sources['input_context.cpp']]]);
const after = applyPatch(before,changes);
equal(after.get('src/input_context.cpp'),generated,'standard patch produces generated original TU');
equal(after.get('src/browser_input_snapshot.h'),header,'standard patch produces header');
equal(after.get('src/browser_input_snapshot.cpp'),cpp,'standard patch produces module');
equal([...applyPatch(after,changes,true)], [...before],'reverse patch restores original and removes additions');
assertions++;
assert.throws(()=>applyPatch(new Map([['src/input_context.cpp','changed\n'+sources['input_context.cpp']]]),changes),
  /patch context\/removal/,'patch cannot silently apply to changed context');

const exports = ['pin','data','size','release'].map(name=>`cdda_browser_snapshot_${name}`);
equal([...header.matchAll(/\b(cdda_browser_snapshot_\w+)\s*\(/g)].map(match=>match[1]),exports,'four ABI declarations');
equal([...cpp.matchAll(/extern "C" [^\n]*\b(cdda_browser_snapshot_\w+)\s*\(/g)].map(match=>match[1]),exports,'four ABI definitions');
check(!/\b(?:get_input_for_action|get_action_attributes)\s*\(/.test(hook),'hook never calls mutating native resolver');
check(hook.includes('const auto &contexts = inp_mngr.action_contexts;'),'hook reads const original table');
check(hook.includes('contexts.find( default_context_id )') &&
  !hook.includes('contexts.find( "default" )'),'no allocating literal default lookup in noexcept reader');
check(hook.indexOf('return &selected->second.input_events;') < hook.indexOf('const auto defaults'),
  'present local vector selected before default, including empty override');
check(hook.includes('return nullptr;') && !hook.includes('contexts['),'missing action has no table insertion');
check(generated.includes('inp_mngr.set_timeout( timeout );\n    }\n'+hook+
  '    next_action.type = input_event_t::error;'),'hook follows native timeout setup');
check(sources['input.h'].includes('friend class input_context;'),'existing source friendship retained');
check(cpp.includes('*view.category == "STRING_INPUT" ? "raw_utf8" : "native_context"'),
  'only exact original STRING_INPUT gets raw text policy');
check(!/\b(?:rng|rng_get_engine|get_player_input|do_turn|draw_ter|refresh_display)\s*\(/.test(cpp),
  'module contains no gameplay RNG/simulation/input/draw invocation');
check(cpp.includes('max_snapshot_bytes = 256 * 1024') && cpp.includes('max_pins = 16'),
  'byte and pin bounds are explicit');
check(cpp.includes('queueMicrotask') && cpp.includes('catch( error )') && cpp.includes('catch( ignored )'),
  'notification scheduling/callback/logging source guards present');
const noticeExpression = /const notice = Object\.freeze\(\s*(\{[\s\S]*?\})\s*\);/.exec(cpp);
check(noticeExpression !== null,'actual notification expression located');
// Tiny predeclared WASM32 binary: forward(i32,i32) calls env.notice(i32,i32).
// No compiler, engine, Rust artifact, game loop, or stress execution is involved.
const noticeBoundaryBinary = Uint8Array.from([
  0,97,115,109,1,0,0,0,
  1,6,1,96,2,127,127,0,
  2,14,1,3,101,110,118,6,110,111,116,105,99,101,0,0,
  3,2,1,0,
  7,11,1,7,102,111,114,119,97,114,100,0,1,
  10,10,1,8,0,32,0,32,1,16,0,11
]);
let importedHalves;
const noticeBoundaryInstance = new WebAssembly.Instance(new WebAssembly.Module(noticeBoundaryBinary),
  {env:{notice(low,high) { importedHalves = {low,high}; }}});
for (const low of [0,0x7fffffff,0x80000000,0xffffffff]) {
  for (const high of [0,0x7fffffff,0x80000000,0xffffffff]) {
    noticeBoundaryInstance.exports.forward(low,high);
    equal(importedHalves.low,low|0,'actual WASM import exposes signed low i32');
    equal(importedHalves.high,high|0,'actual WASM import exposes signed high i32');
    // Evaluate the producer's actual small notice expression with import values.
    const actual = vm.runInNewContext(`(${noticeExpression[1]})`,
      {...importedHalves,availability:1});
    equal(actual.publicationLow,low,'producer low half normalized to u32');
    equal(actual.publicationHigh,high,'producer high half normalized to u32');
    equal((BigInt(actual.publicationHigh)<<32n)|BigInt(actual.publicationLow),
      (BigInt(high)<<32n)|BigInt(low),'halves retain every publication bit');
  }
}

const evidence = {schemaVersion:1,status:'source_checks_and_isolated_notice_fixture_uncompiled_unconnected',assertions,
  sourceCommit:SOURCE_COMMIT,sourceInputs:5,patchFiles:changes.length,
  patchSha256:sha256(patchBytes),forwardReversePatchExact:true,pristinePinsUnchanged:true,
  notificationHalfCases:16,notificationBoundaryFixture:{bytes:noticeBoundaryBinary.length,
    sha256:sha256(noticeBoundaryBinary),runtimeExecuted:true,scope:'isolated_predeclared_i32_import_only'},
  compilationPerformed:false,runtimeValidationPerformed:true,
  runtimeValidationScope:'isolated_notice_boundary_fixture_only',
  engineRuntimeValidationPerformed:false,rustRuntimeValidationPerformed:false,activeBuildChanged:false};
await writeFile(path.join(own,'SOURCE-CHECKS.json'),JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify(evidence));
