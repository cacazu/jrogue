import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Source and completed evidence only. No browser, compiler, server, or dataset reads.
const directory = path.dirname(fileURLToPath(import.meta.url));
const commit = '7b2efa5cea38e4d4d97dd0e63b28b9148623da59';
const upstream = `C:/Users/kit/gameme/jnethack/jrouge/cataclysm-dda/upstream/Cataclysm-DDA-${commit}`;
const specs = [
  ['src/main_menu.cpp', [[990, 1024]]],
  ['src/worldfactory.cpp', [[176, 200], [454, 475], [1494, 1535], [1697, 1705], [1749, 1755]]],
  ['src/cursesport.cpp', [[65, 95]]],
  ['src/ui_manager.cpp', [[358, 367]]],
  ['src/sdltiles.cpp', [[230, 248], [3834, 3846]]],
  ['src/cata_imgui.cpp', [[412, 418], [429, 450], [557, 573]]],
  ['src/third-party/imgui/imgui_impl_sdlrenderer2.cpp', [[113, 122], [241, 264]]]
];
const sourceFiles = [];
for (const [filename, ranges] of specs) {
  const bytes = await readFile(path.join(upstream, filename));
  const lines = bytes.toString('utf8').split(/\r?\n/);
  sourceFiles.push({ filename, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'),
    excerpts: ranges.map(([startLine, endLine]) => ({ startLine, endLine,
      lines: lines.slice(startLine - 1, endLine).map((text, index) => ({ line: startLine + index, text })) })) });
}
const historicalFiles = [];
for (const filename of ['output/2026-10-02T19-14-25-977Z/evidence.json', 'output/2026-10-02T19-30-37-264Z/evidence.json', '../evidence/local-browser-reference.json']) {
  const bytes = await readFile(path.join(directory, filename));
  historicalFiles.push({ filename, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
}
const record = {
  format: 'cdda-browser-source-stage-clarification', version: 1, createdAt: new Date().toISOString(),
  source: { upstream: 'https://github.com/CleverRaven/Cataclysm-DDA', tag: '0.I-1', commit, pristinePath: upstream },
  scope: 'Read-only source inference correcting stage labels; historical reports remain immutable.',
  actualObservation: {
    run: 'output/2026-10-02T19-30-37-264Z', completedNativeState: 'Japanese main menu with custom new-game selection',
    command: 'Enter', commandAt: '2026-10-02T19:32:36.329Z',
    nextCompletedNativeScreenshot: null, nativeStack: null, allocationStack: null,
    outcome: 'Owned resource guard stopped Chrome after physical memory fell below 2 GiB; no engine crash was observed.'
  },
  sourceRelations: [
    'main_menu.cpp calls world_generator->pick_world before g->setup. Successful custom selection is therefore not proof that setup/load-game-data has begun.',
    'On a fresh profile with no eligible worlds, pick_world returns make_new_world(show_prompt); show_prompt=true enters show_worldgen_basic before saving the world.',
    'show_worldgen_basic allocates a catacurses confirmation window, registers input, gathers WORLDGEN sliders, and uses a redraw callback plus ui_manager::redraw before handling input.',
    'catacurses::newwin allocates a WINDOW and resizes its row/cell vectors to the requested terminal dimensions. No allocation size or stack was observed in the failed session.',
    'The generic ui_adaptor redraw path calls imclient->new_frame when a frame has not started. This path also serves earlier UI redraws, so the source does not identify a new ImGui allocation uniquely associated with custom world entry.',
    'SDL font initialization calls imclient->load_fonts. The loader builds the font atlas only when FontDefault is null. The SDL renderer NewFrame creates device objects only when FontTexture is absent.',
    'The renderer font texture is sized by ImGui GetTexDataAsRGBA32 and created with SDL_CreateTexture. No runtime atlas width/height, texture count, or allocation stack was captured.',
    'show_worldgen_basic uses the ImGui world-name popup only after confirming the name row. That further command was not observed in the failed run.'
  ],
  conclusion: 'The observed stage is attempted native custom-world entry after Enter, with unknown allocation/CPU cause. Data loading, Liftoff/TurboFan compilation, ImGui/font atlas, canvas/texture growth, or unrelated global-memory ownership cannot be attributed from existing evidence.',
  possibleFutureEvidence: [
    'New guard records exact per-process creation identity, Chrome process type, private bytes, working set, CPU time, thread count, and global committed/limit counters.',
    'Capture native-state screenshot, current linear memory, JS heap, canvas backing/CSS and bounded available host texture metadata when the event loop responds.',
    'Do not use CPUProfiler in the Liftoff/lazy candidate because profiling may trigger tier-up. No stack capture has been implemented or executed.'
  ],
  limitations: ['Source relations are inference, not a native runtime trace.', 'No compiler thread attribution exists in historical guards.', 'No browser or compiler was started for this clarification.'],
  sourceFiles, historicalFiles
};
const destination = path.join(directory, 'source-stage-clarification.json');
await writeFile(destination, JSON.stringify(record, null, 2) + '\n', { flag: 'wx' });
await appendFile(path.join(directory, 'cheap-memory-checks.jsonl'), JSON.stringify({
  at: '2026-10-02T19:56:06.2122011Z', availableBytes: 6845423616, committedBytes: 20307189760,
  commitLimitBytes: 29331869696, freeCommitBytes: 9024679936,
  operation: 'read-only-memory-only', launchGateBytes: { physical: 7 * 1024 ** 3, commit: 9 * 1024 ** 3 },
  fit: false, browserStarted: false, profileCreated: false, largeHashesRead: false
}) + '\n');
console.log(JSON.stringify({ destination, sourceFiles: sourceFiles.length, sourceBytes: sourceFiles.reduce((sum, file) => sum + file.bytes, 0), historicalFiles: historicalFiles.length, browserStarted: false }, null, 2));
