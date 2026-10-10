/* SPDX-License-Identifier: GPL-3.0-or-later
 * Generates an adapted copy; never modifies the official upstream source.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const directory = path.dirname(fileURLToPath(import.meta.url));
const upstreamRoot = process.argv[2] || 'C:/Users/kit/gameme/jnethack/jrouge/tome/upstream/t-engine4-src-1.7.6';
const upstreamPath = path.join(upstreamRoot, 'src/serial.c');
const original = fs.readFileSync(upstreamPath);
const upstream = original.toString('utf8');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const replaceOnce = (text, before, after) => {
  if (text.split(before).length !== 2) throw Error('Expected exactly one replacement anchor: '+before.slice(0,80));
  return text.replace(before, after);
};
const graphStart = 'static const char *get_name(lua_State *L, serial_type *s, int idx)';
const graphEnd = 'static int serial_order_realsave(lua_State *L)';
const graph = upstream.slice(upstream.indexOf(graphStart), upstream.indexOf(graphEnd));
if (!graph || !graph.includes('push_save(s->zf, s->zfname, filename, s->buf, s->bufpos);')) throw Error('Original graph region not found');
const entryStart = upstream.indexOf('\t\t\t/* Init the zip entry */');
const entryEnd = upstream.indexOf('\n\t\t\tif (err == ZIP_OK)',entryStart);
if (entryStart < 0 || entryEnd < entryStart) throw Error('Original ZIP entry metadata not found');
const entry = upstream.slice(entryStart,entryEnd).split('\n').map(line => line.replace(/^\t\t\t/,'\t')).join('\n');
const workerTemplate = fs.readFileSync(path.join(directory,'browser-worker.c.inc'),'utf8');
const worker = replaceOnce(workerTemplate,'@UPSTREAM_ENTRY_OPEN@',entry);
const lua = fs.readFileSync(path.join(directory,'browser-lua.c.inc'),'utf8');
let adapted = replaceOnce(upstream,'#include "physfsrwops.h"','#include "physfsrwops.h"\n#include <limits.h>\n#include <stdint.h>');
const state = `
/* Browser platform state; graph records and ZIP format remain upstream. */
static struct {
  save_queue *entry;
  zipFile *archive;
  char *archive_name;
  size_t offset, queued_entries, completions;
  uint64_t entries_written, payload_bytes_written;
  int entry_open, activated, error;
  char message[1024];
} browser_save;
static int browser_save_fail(const char *operation, const char *name, int code);
`;
adapted = replaceOnce(adapted,'static zipFile *last_zf = NULL;','static zipFile *last_zf = NULL;\n'+state);
adapted = replaceOnce(adapted,'\tsave_queue *q = malloc(sizeof(save_queue));\n\tq->zf = zf;',
  '\tsave_queue *q = malloc(sizeof(save_queue));\n\tif (!q) { browser_save_fail("allocate save entry", zfname, ZIP_INTERNALERROR); free(payload); return; }\n\tq->zf = zf;');
adapted = replaceOnce(adapted,'\tq->payload_len = payload_len;',
  '\tq->payload_len = payload_len;\n\tif (!q->zfname || !q->filename) {\n\t\tbrowser_save_fail("allocate save entry names", zfname, ZIP_INTERNALERROR);\n\t\tfree(q->zfname); free(q->filename); free(q->payload); free(q); return;\n\t}');
adapted = replaceOnce(adapted,'\tsave_queue *q = malloc(sizeof(save_queue));\n\tq->zfname = strdup(zipname);',
  '\tsave_queue *q = malloc(sizeof(save_queue));\n\tif (!q) { browser_save_fail("allocate save completion", zipname, ZIP_INTERNALERROR); return; }\n\tq->zfname = strdup(zipname);\n\tif (!q->zfname) { browser_save_fail("allocate save completion name", zipname, ZIP_INTERNALERROR); free(q); return; }');
for (const mutex of ['lock_iqueue','lock_oqueue']) {
  for (const operation of ['P','V']) {
    const line = '\tSDL_mutex'+operation+'(main_save->'+mutex+');\n';
    if (adapted.split(line).length !== 3) throw Error('Expected two original '+line.trim()+' lines');
    adapted = adapted.split(line).join('');
  }
}
adapted = replaceOnce(adapted,'\tmain_save->iqueue_tail = q;','\tmain_save->iqueue_tail = q;\n\t++browser_save.queued_entries;');
adapted = replaceOnce(adapted,'\tmain_save->oqueue_tail = q;','\tmain_save->oqueue_tail = q;\n\t++browser_save.completions;');
adapted = replaceOnce(adapted,'\t\tlua_pushstring(L, q->zfname);','\t\t--browser_save.completions;\n\t\tlua_pushstring(L, q->zfname);');
const workerStart = adapted.indexOf('void finish_zip(const char *zipname)');
const workerEnd = adapted.indexOf('/********************************************************************\n ** Main thread',workerStart);
if (workerStart < 0 || workerEnd < workerStart) throw Error('Original worker replacement boundaries not found');
adapted = adapted.slice(0,workerStart)+worker+'\n\n'+adapted.slice(workerEnd);
adapted = replaceOnce(adapted,'\ts->zf = zf;','\tif (!zf) {\n\t\tbrowser_save_fail("zipOpen", zfname, ZIP_ERRNO);\n\t\treturn luaL_error(L, "%s", browser_save.message);\n\t}\n\ts->zf = zf;');
adapted = replaceOnce(adapted,'\tSDL_SemPost(main_save->wait_iqueue);','\tif (browser_save.error) return luaL_error(L, "%s", browser_save.message);\n\tif (!main_save) return luaL_error(L, "browser save worker is not initialized");\n\tbrowser_save.activated = 1;');
adapted = replaceOnce(adapted,'static const struct luaL_Reg seriallib[]',lua+'\n\nstatic const struct luaL_Reg seriallib[]');
adapted = replaceOnce(adapted,'\t{"new", serial_new},','\t{"browserWorkerReady", serial_browser_worker_ready},\n\t{"browserPump", serial_browser_pump},\n\t{"browserStatus", serial_browser_status},\n\t{"browserError", serial_browser_error},\n\t{"new", serial_new},');
const adaptedGraph = adapted.slice(adapted.indexOf(graphStart),adapted.indexOf(graphEnd));
if (adaptedGraph !== graph) throw Error('Graph serialization changed');
if (/SDL_CreateThread|SDL_SemWait|SDL_SemPost|SDL_CreateSemaphore|SDL_CreateMutex|SDL_mutex[PV]\(/.test(adapted)) throw Error('Unsupported worker primitive retained');
fs.writeFileSync(path.join(directory,'serial_browser.c'),adapted);
const report = {
  schema_version:1, upstream_version:'1.7.6', upstream_tag:'tome-1.7.6', upstream_commit:'624a67329fe2ad440c5b344785a9c73fcf22ae63',
  upstream_path:upstreamPath, upstream_sha256:sha256(original), output:'serial_browser.c', output_sha256:sha256(adapted),
  upstream_modified:false, graph_serialization:{byte_identical:true,start:graphStart,end:graphEnd,sha256:sha256(graph),bytes:Buffer.byteLength(graph)},
  zip_entry_metadata:{copied_from_upstream:true,source_sha256:sha256(upstream.slice(entryStart,entryEnd)),normalized_indentation_sha256:sha256(entry)},
  changes:['SDL worker, locks, semaphore replaced with one browser-owned queue pump','Existing ZIP entry metadata and compression parameters retained exactly','Payload streams in bounded chunks of at most 65536 bytes without added flush operations','Actual ZIP/PhysFS and queue allocation failures reported before posting any completion','Actual .tmp suffix checked with length guard','Existing popSaveReturn remains the sole completion consumer','Lua status/pump APIs added; graph serialization byte-identical','Failed original zipOpen becomes checked Lua error'],
  validation:{generation_only:true,compile_run:false,tests_run:false,browser_run:false},
  limits:['Host must serialize graph collection and pump under an exclusive save barrier','ZIP entry open/close and archive central-directory close/rename are atomic API steps; byte/entry budgets do not guarantee a wall-time bound','Terminal errors require caller recovery/reinitialization; adapter does not report failed work as completion','MEMFS success is not IndexedDB durability; host persistence callback must complete before browser save acknowledgement']
};
fs.writeFileSync(path.join(directory,'provenance.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({source:report.output,sha256:report.output_sha256,graph_bytes:report.graph_serialization.bytes,compile_run:false,tests_run:false,browser_run:false}));
