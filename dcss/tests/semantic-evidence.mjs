// Bounded catalog/source/host verification. Never invokes a compiler or browser.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const heavyHoldRetained = fs.existsSync(path.join(root, 'engine/.hold-link'));
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const results = [];
function run(name, executable, args) {
  const process = spawnSync(executable, args, { cwd: root, encoding: 'utf8', maxBuffer: 1024 * 1024, windowsHide: true });
  if (process.error || process.status !== 0) throw new Error(`${name}: ${process.error || process.stderr || process.stdout}`);
  const text = process.stdout.trim();
  const start = text.lastIndexOf('\n{');
  const result = JSON.parse(start >= 0 ? text.slice(start + 1) : text);
  results.push({ name, result, stdout_sha256: hash(process.stdout), stderr_sha256: hash(process.stderr) });
}
run('canned catalog source/schema probes', process.execPath, ['--max-old-space-size=128', 'tools/check-canned-catalogs.mjs', '--self-test']);
run('startup catalog source/schema probes', process.execPath, ['--max-old-space-size=128', 'tools/check-startup-catalogs.mjs', '--self-test']);
run('independent localization source review', process.execPath, ['--max-old-space-size=128', 'tests/semantic/review-localization.mjs']);
run('semantic host/projection stubs', process.execPath, ['--max-old-space-size=128', 'tests/semantic-protocol.mjs']);
run('current C++ source patch receipt', String.raw`C:\Users\kit\emsdk\python\3.13.3_64bit\python.exe`, ['tools/apply-semantic-patches.py', '--check']);
run('read-only compiler cache accounting', String.raw`C:\Users\kit\emsdk\python\3.13.3_64bit\python.exe`, ['-c',
  "import runpy,hashlib,json; m=runpy.run_path('tools/engine-build.py'); fp=m['compiler_fingerprint'](); pairs=m['units'](); valid=[]; pending=[]; " +
  "[(valid if dest.exists() and dest.with_suffix('.fingerprint').exists() and dest.with_suffix('.fingerprint').read_text()==hashlib.sha256((fp+hashlib.sha256(src.read_bytes()).hexdigest()).encode()).hexdigest() else pending).append(src.name) for src,dest in pairs]; " +
  "print(json.dumps({'compiler_fingerprint':fp,'units':len(pairs),'valid':len(valid),'outstanding':len(pending),'compiler_executed':False}))",
]);
for (const name of ['worker-host', 'main-host', 'timer-order', 'cache-filter']) {
  // Preserved fixtures resolve dcss/... from the containing games directory.
  const result = spawnSync(process.execPath, ['--max-old-space-size=128', path.join(root, `tests/worker/${name}.cjs`)], {
    cwd: path.dirname(root), encoding: 'utf8', windowsHide: true, maxBuffer: 1024 * 1024,
  });
  if (result.error || result.status !== 0) throw new Error(`${name}: ${result.error || result.stderr || result.stdout}`);
  const text = result.stdout.trim();
  const start = text.lastIndexOf('\n{');
  results.push({ name: `retained ${name} fixtures`, result: JSON.parse(start >= 0 ? text.slice(start + 1) : text) });
}
const syntaxFiles = ['engine/library.js', 'web/app.mjs', 'web/core-worker.js', 'web/core-debug.mjs', 'web/semantic-log.mjs', 'tests/semantic-protocol.mjs'];
for (const file of syntaxFiles) {
  const result = spawnSync(process.execPath, ['--check', file], { cwd: root, encoding: 'utf8', windowsHide: true });
  if (result.error || result.status !== 0) throw new Error(`${file}: ${result.error || result.stderr}`);
}
const embedded = { en: {}, ja: {} };
const catalogCounts = [];
for (const group of ['locales/{language}.json', 'locales/entities/species.{language}.json', 'locales/entities/jobs.{language}.json', 'locales/gameplay/canned.{language}.json', 'locales/startup/{language}.json']) {
  let count;
  for (const language of ['en', 'ja']) {
    const file = group.replace('{language}', language);
    const catalog = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
    count = Object.keys(catalog).length;
    for (const [id, entry] of Object.entries(catalog)) {
      if (id in embedded[language]) throw new Error(`duplicate embedded ID ${id}`);
      embedded[language][id] = entry;
    }
  }
  catalogCounts.push({ group, ids_per_language: count });
}
const ids = Object.keys(embedded.en).sort();
if (JSON.stringify(ids) !== JSON.stringify(Object.keys(embedded.ja).sort())) throw new Error('embedded bilingual ID mismatch');
for (const id of ids) {
  const en = embedded.en[id], ja = embedded.ja[id];
  const schema = entry => typeof entry === 'string' ? {} : entry.params;
  if (JSON.stringify(Object.entries(schema(en)).sort()) !== JSON.stringify(Object.entries(schema(ja)).sort())) throw new Error(`parameter schema mismatch ${id}`);
  for (const entry of [en, ja]) if ((typeof entry === 'string' ? entry : entry.text || entry.other).trim().length === 0) throw new Error(`empty text ${id}`);
}
const files = [
  'port/src/semantic.rs', 'port/src/application.rs', 'port/src/display.rs', 'port/src/lib.rs',
  'engine/platform_console.cc', 'engine/library.js', 'engine/semantic-canned.inc',
  'tools/engine-build.py', 'tools/apply-semantic-patches.py', 'tools/check-canned-catalogs.mjs', 'tools/check-startup-catalogs.mjs',
  'web/app.mjs', 'web/core-debug.mjs', 'web/core-worker.js', 'web/semantic-log.mjs', 'web/index.html', 'web/style.css',
  'locales/en.json', 'locales/ja.json',
  'locales/gameplay/canned.en.json', 'locales/gameplay/canned.ja.json', 'locales/gameplay/canned-source-map.json',
  'locales/startup/en.json', 'locales/startup/ja.json', 'locales/startup/source-map.json',
  'tests/semantic-protocol.mjs', 'tests/semantic/review-localization.mjs', 'tests/semantic-evidence.mjs',
  'engine/work/crawl-ref/source/message.cc',
];
const evidence = {
  verified_at: new Date().toISOString(), root,
  upstream_commit: '1eebc1a2892e1c89776a0d7a10691f8dac8d9796',
  scope: 'lightweight source/catalog/host milestone, not runtime integration',
  heavy_hold_retained: heavyHoldRetained, actual_engine_executed: false, actual_rust_executed: false,
  browser_executed: false, published: false,
  javascript_syntax_files_checked: syntaxFiles,
  embedded_catalog_ids_per_language: ids.length, catalog_counts: catalogCounts,
  source_files: files.map(file => { const bytes = fs.readFileSync(path.join(root, file)); return { file, bytes: bytes.length, sha256: hash(bytes) }; }),
  results,
};
fs.writeFileSync(path.join(root, 'tests/semantic-source-evidence.json'), JSON.stringify(evidence, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ ok: true, source_checks: results.length, embedded_catalog_ids_per_language: ids.length,
  artifact: 'tests/semantic-source-evidence.json', actual_engine_executed: false, actual_rust_executed: false, browser_executed: false,
}));
