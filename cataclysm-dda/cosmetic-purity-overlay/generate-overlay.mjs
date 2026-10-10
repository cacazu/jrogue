import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const own = path.dirname(fileURLToPath(import.meta.url));
const staging = path.dirname(own);
const upstream = process.env.CDDA_PRISTINE_ROOT ??
  'C:/Users/kit/gameme/jnethack/jrouge/cataclysm-dda/upstream/Cataclysm-DDA-7b2efa5cea38e4d4d97dd0e63b28b9148623da59';
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const commit = '7b2efa5cea38e4d4d97dd0e63b28b9148623da59';
const audit = JSON.parse(fs.readFileSync(path.join(staging, 'determinism-audit/SOURCE-MANIFEST.json')));
if (audit.upstream_commit !== commit) throw new Error('audit commit differs');
const paths = ['src/cata_tiles.cpp', 'src/overmap_ui.cpp', 'src/overmap.h', 'src/rng.cpp',
  'src/rng.h', 'src/weighted_list.h', 'src/weather.h', 'src/character_id.h',
  'src/character.h', 'src/character.cpp'];
const originals = new Map();
const pins = paths.map(source => {
  const bytes = fs.readFileSync(path.join(upstream, source));
  const expected = audit.files.find(entry => entry.source === source);
  if (!expected || expected.bytes !== bytes.length || expected.sha256 !== sha(bytes)) {
    throw new Error(`pinned source differs: ${source}`);
  }
  originals.set(source, bytes.toString('utf8'));
  return { source, bytes: bytes.length, sha256: sha(bytes) };
});

const weatherOld = '            seed = rng_bits(); // Doesn\'t need to be deterministic\n';
const weatherNew = '            // Pure observed-frame calculation; native sprite/animation selection stays below.\n' +
  '            seed = cdda_presentation_v1::weather_seed( found_id,\n' +
  '                    { pos.x(), pos.y(), pos.z() }, { screen_pos.x, screen_pos.y } );\n';
const nearbyOld = '                    // Randomly change to new NPC\'s color\n' +
  '                    if( iter->second.color != np_color && one_in( iter->second.count ) ) {\n';
const followerOld = '                // Randomly change to new NPC\'s color\n' +
  '                if( iter->second.color != np_color && one_in( iter->second.count ) ) {\n';
function npcReplacement(indent, pass) {
  return `${indent}// Pure presentation decision; native admission/order/count/color remain unchanged.\n` +
    `${indent}if( iter->second.color != np_color &&\n` +
    `${indent}    cdda_presentation_v1::accept_npc_color( static_cast<int>( iter->second.count ),\n` +
    `${indent}            { orig.x(), orig.y(), orig.z() },\n` +
    `${indent}            { cursor_pos.x(), cursor_pos.y(), cursor_pos.z() },\n` +
    `${indent}            { pos.x(), pos.y(), pos.z() }, np->getID().get_value(),\n` +
    `${indent}            cdda_presentation_v1::npc_pass::${pass} ) ) {\n`;
}
const specifications = [
  { source: 'src/cata_tiles.cpp', old: '#include "cata_tiles.h"\n',
    replacement: '#include "cata_tiles.h"\n#include "cdda_presentation_hash.h"\n' },
  { source: 'src/cata_tiles.cpp', old: weatherOld, replacement: weatherNew },
  { source: 'src/overmap_ui.cpp', old: '#include "overmap_ui.h"\n',
    replacement: '#include "overmap_ui.h"\n#include "cdda_presentation_hash.h"\n' },
  { source: 'src/overmap_ui.cpp', old: nearbyOld, replacement: npcReplacement('                    ', 'nearby') },
  { source: 'src/overmap_ui.cpp', old: followerOld, replacement: npcReplacement('                ', 'followers') },
];
const bySource = new Map();
for (const specification of specifications) {
  const original = originals.get(specification.source);
  const at = original.indexOf(specification.old);
  if (at < 0 || original.indexOf(specification.old, at + 1) >= 0) throw new Error('anchor not unique');
  const startLine = original.slice(0, at).split('\n').length;
  const record = { ...specification, startLine, oldLineCount: specification.old.split('\n').length - 1,
    newLineCount: specification.replacement.split('\n').length - 1 };
  if (!bySource.has(specification.source)) bySource.set(specification.source, []);
  bySource.get(specification.source).push(record);
}

let patch = '';
const outputs = [];
for (const [source, edits] of bySource) {
  edits.sort((a, b) => a.startLine - b.startLine);
  const original = originals.get(source), lines = original.split('\n');
  patch += `diff --git a/${source} b/${source}\n--- a/${source}\n+++ b/${source}\n`;
  let offset = 0;
  for (const edit of edits) {
    const before = Math.min(3, edit.startLine - 1);
    const after = Math.min(3, lines.length - 1 - (edit.startLine - 1 + edit.oldLineCount));
    const start = edit.startLine - before, newStart = start + offset;
    patch += `@@ -${start},${before + edit.oldLineCount + after} +${newStart},${before + edit.newLineCount + after} @@\n`;
    for (const line of lines.slice(start - 1, edit.startLine - 1)) patch += ` ${line}\n`;
    for (const line of edit.old.slice(0, -1).split('\n')) patch += `-${line}\n`;
    for (const line of edit.replacement.slice(0, -1).split('\n')) patch += `+${line}\n`;
    for (const line of lines.slice(edit.startLine - 1 + edit.oldLineCount,
      edit.startLine - 1 + edit.oldLineCount + after)) patch += ` ${line}\n`;
    offset += edit.newLineCount - edit.oldLineCount;
  }
  let generated = original;
  for (const edit of edits) generated = generated.replace(edit.old, edit.replacement);
  const target = path.join(own, 'generated', source);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, generated);
  outputs.push({ source, bytes: Buffer.byteLength(generated), sha256: sha(generated) });
}
const header = fs.readFileSync(path.join(own, 'cpp/cdda_presentation_hash.h'), 'utf8');
const newSource = 'src/cdda_presentation_hash.h';
patch += `diff --git a/${newSource} b/${newSource}\nnew file mode 100644\n--- /dev/null\n+++ b/${newSource}\n`;
patch += `@@ -0,0 +1,${header.split('\n').length - 1} @@\n`;
for (const line of header.slice(0, -1).split('\n')) patch += `+${line}\n`;
fs.writeFileSync(path.join(own, 'cosmetic-purity.patch'), patch);
fs.writeFileSync(path.join(own, 'source-pins.json'), JSON.stringify({ upstream_commit: commit,
  upstream_tag: '0.I-1', official_repository: 'https://github.com/CleverRaven/Cataclysm-DDA', files: pins }, null, 2) + '\n');
fs.writeFileSync(path.join(own, 'SOURCE-PREPARATION.json'), JSON.stringify({ schema: 1,
  upstream_commit: commit, status: 'SOURCE_ONLY_UNAPPLIED_UNCOMPILED_UNCONNECTED',
  modified_original_cpp_files: [...bySource.keys()], modified_original_header_files: [],
  new_native_files: [newSource], native_class_layout_or_signature_changes: false,
  native_rng_sites_replaced: [
    { source: 'src/cata_tiles.cpp', line: 2882, original: 'rng_bits()', purpose: 'WEATHER sprite seed' },
    { source: 'src/overmap_ui.cpp', line: 691, original: 'one_in(iter->second.count)', purpose: 'nearby NPC display color' },
    { source: 'src/overmap_ui.cpp', line: 741, original: 'one_in(iter->second.count)', purpose: 'follower NPC display color' }],
  explicit_inputs: { weather: ['resolved found_id UTF-8 bytes', 'bubble tile x/y/z', 'computed screen x/y'],
    npc: ['native signed chance after native count conversion', 'view origin x/y/z', 'cursor x/y/z',
      'admitted NPC absolute OMT x/y/z', 'character_id integer', 'nearby/followers branch tag'] },
  patch: { path: 'cosmetic-purity.patch', bytes: Buffer.byteLength(patch), sha256: sha(patch) },
  generated: outputs,
  native_compiled: false, rust_compiled: false, native_rust_connected: false,
  browser_tested: false, full_game_render_purity_verified: false,
  pristine_rng_trace_compatible: false, gameplay_rng_draws_removed_only_at_reviewed_cosmetic_sites: true,
  existing_sources_or_build_modified: false,
}, null, 2) + '\n');
fs.copyFileSync(path.join(staging, 'help-semantic-slice/LICENSE-UPSTREAM.txt'),
  path.join(own, 'LICENSE-UPSTREAM.txt'));
console.log(JSON.stringify({ status: 'source prepared only', pins: pins.length, original_cpp_files: 2,
  original_headers: 0, cosmetic_sites: 3, patch_bytes: Buffer.byteLength(patch), patch_sha256: sha(patch) }));
