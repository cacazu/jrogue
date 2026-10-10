import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const commit = '7b2efa5cea38e4d4d97dd0e63b28b9148623da59';
const root = `C:/Users/kit/gameme/jnethack/jrouge/cataclysm-dda/upstream/Cataclysm-DDA-${commit}/`;
const specs = [['src/main_menu.cpp', [[531, 537], [590, 595], [1001, 1015]]], ['src/game.cpp', [[594, 606], [787, 801]]]];
const sourceFiles = [];
for (const [path, ranges] of specs) {
  const bytes = await readFile(root + path), lines = bytes.toString('utf8').split(/\r?\n/);
  sourceFiles.push({ path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'),
    excerpts: ranges.map(([startLine, endLine]) => ({ startLine, endLine,
      lines: lines.slice(startLine - 1, endLine).map((text, index) => ({ line: startLine + index, text })) })) });
}
const precedingPath = 'browser-qa/source-stage-clarification.json', precedingBytes = await readFile(precedingPath);
const record = {
  schema: 'cdda-browser-startup-core-load-stage-addendum', version: 1, createdAt: new Date().toISOString(),
  upstream: { tag: '0.I-1', commit },
  precedingClarification: { path: precedingPath, sha256: createHash('sha256').update(precedingBytes).digest('hex') },
  immutableHistoricalReportsEdited: false, browserStarted: false, compilerStarted: false,
  sourceRelations: [
    'main_menu::opening_screen calls init_strings; init_strings calls g->load_core_data before the menu input loop.',
    'game::load_core_data unloads dynamic data, then calls load_data_from_dir(PATH_INFO::jsondir(), "core").',
    'After a custom world has been picked, main_menu calls g->setup; setup displays a core-data loading popup, reloads core data, and loads world mod files.'
  ],
  metricLabelCorrection: {
    run: 'browser-qa/output/2026-10-02T19-30-37-264Z', at: '2026-10-02T19:31:26.564Z',
    observedLinearMemoryBytes: 536870912, observedJsHeapUsedBytes: 10548896,
    correctScope: 'Completed native Japanese menu, before the later custom-world Enter command and unobserved setup step.',
    excludesClaim: 'This is not a measurement before all core JSON loading; source places an earlier core load before the menu.'
  },
  conclusion: 'Actual failure is still resource-guard termination during attempted custom-world Enter work. No screenshot/stack proves entry into world-generation drawing, setup reload, a compiler phase, or a particular allocation owner.',
  sourceFiles
};
const output = 'browser-qa/startup-core-load-stage-addendum.json';
await writeFile(output, JSON.stringify(record, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output, sha256: createHash('sha256').update(await readFile(output)).digest('hex'), browserStarted: false }, null, 2));
