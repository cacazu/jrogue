// Prepare exact-header/native Rust parity sources. This launches no build or game.
import { readFile, writeFile, mkdir, lstat, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(here);
const output = path.join(here, 'prepared');
const planPath = path.join(root, 'full-engine-overlay-plan/v2/FULL-INTEGRATION-PLAN.json');
const planHash = '208c9b5dffb6822752dc155e80fb7ad187fd9735fccb80ab9eb0264655546b03';
const rustRoot = path.join(root, 'cosmetic-purity-overlay/rust');
const rustHash = '6345cd38f0718eb4a98eaced43506afdd9ea1d4ce7d32404563af9d38ff75bcc';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const require = (value, reason) => { if (!value) throw new Error(reason); };
const pin = (file, bytes) => ({ path: file, bytes: bytes.length, sha256: hash(bytes) });
const ordinary = async file => {
  const state = await lstat(file);
  require(state.isFile() && !state.isSymbolicLink(), `not an ordinary source: ${file}`);
  return readFile(file);
};
const checked = async (file, expected) => {
  const bytes = await ordinary(file);
  require(hash(bytes) === expected, `source pin changed: ${file}`);
  return bytes;
};
const planBytes = await checked(planPath, planHash);
const plan = JSON.parse(planBytes);
const parity = plan.cosmetic.nativeParityFixture;
require(parity.expectedChecks === 23 && parity.weatherCases === 3 &&
  parity.npcNearbyCases === 8 && parity.npcFollowerCases === 8 &&
  parity.rejectionCases === 3 && parity.repetitionCheck === 1, 'frozen case closure');
const cppBytes = await checked(parity.source.path, parity.source.sha256);
const expectedBytes = await checked(parity.expected.path, parity.expected.sha256);
const headerPath = path.join(root, 'full-engine-overlay-plan/v2/candidate-e3ff38d8bc59cf07ddbb48ce/sources/src/cdda_presentation_hash.h');
const headerBytes = await checked(headerPath, '0890d1f7d5f71e4c350bac4de826ed20145984d6fd57e8683d0b0a56c8e377b2');
const libPath = path.join(rustRoot, 'src/lib.rs');
const libBytes = await checked(libPath, rustHash);
const expected = JSON.parse(expectedBytes);
require(expected.weather.length === 3 && expected.npc.length === 16 &&
  expected.rejection.length === 3, 'golden record closure');
const int32 = value => Number.isInteger(value) && value >= -2147483648 && value <= 2147483647;
const uint32 = value => Number.isInteger(value) && value >= 0 && value <= 4294967295;
const position = (value, count) => {
  require(Array.isArray(value) && value.length === count && value.every(int32), 'exact native position');
  return `[${value.join(', ')}]`;
};
const word = value => { require(uint32(value), 'uint32 golden'); return `${value}_u32`; };
const statements = ['fn main() {', '    let mut checks = 0_u32;', '    let mut failed = 0_u32;'];
const records = [];
expected.weather.forEach((row, index) => {
  require(typeof row.input.resolved_tile_id === 'string', 'raw tile ID');
  const bytes = Buffer.from(row.input.resolved_tile_id, 'utf8');
  const literal = `[${[...bytes].map(value => `${value}_u8`).join(', ')}]`;
  statements.push(`    let text_${index} = ${literal};`,
    `    let weather_${index} = weather_seed(&WeatherFrame {`,
    `        resolved_tile_id: std::str::from_utf8(&text_${index}).expect("frozen UTF-8"),`,
    `        tile_position: ${position(row.input.tile_position, 3)},`,
    `        screen_position: ${position(row.input.screen_position, 2)},`,
    '    });', '    checks += 1;',
    `    if weather_${index} != ${word(row.cppExpectedSeed)} { failed += 1; }`,
    `    println!("{{\\\"weather\\\":${index},\\\"seed\\\":{}}}", weather_${index});`);
  records.push({ weather: index, seed: row.cppExpectedSeed });
});
expected.npc.forEach((row, index) => {
  require(int32(row.input.npc_id) && int32(row.input.native_chance) &&
    [1, 2].includes(row.input.pass) && typeof row.accepted === 'boolean', 'typed NPC case');
  statements.push(`    let frame_${index} = NpcCollisionFrame {`,
    `        origin: ${position(row.input.origin, 3)},`,
    `        cursor: ${position(row.input.cursor, 3)},`,
    `        position: ${position(row.input.position, 3)},`,
    `        npc_id: ${row.input.npc_id}, native_chance: ${row.input.native_chance},`,
    `        pass: NpcPass::${row.input.pass === 1 ? 'Nearby' : 'Followers'},`,
    '    };', `    let key_${index} = npc_key(&frame_${index});`,
    `    let accepted_${index} = accept_npc_color(&frame_${index});`, '    checks += 1;',
    `    if key_${index} != ${word(row.key)} || accepted_${index} != ${row.accepted} { failed += 1; }`,
    `    println!("{{\\\"npc\\\":${index},\\\"key\\\":{},\\\"accepted\\\":{}}}", key_${index}, accepted_${index});`);
  records.push({ npc: index, key: row.key, accepted: row.accepted });
});
expected.rejection.forEach((row, index) => {
  require(row.bound >= 2 && row.bound <= 2147483647, 'native private bound contract');
  statements.push(`    let bounded_${index} = bounded_word(${word(row.key)},`,
    `        std::num::NonZeroU32::new(${word(row.bound)}).expect("frozen positive bound"));`,
    '    checks += 1;', `    if bounded_${index} != ${word(row.value)} { failed += 1; }`,
    `    println!("{{\\\"rejection\\\":${index},\\\"value\\\":{}}}", bounded_${index});`);
  records.push({ rejection: index, value: row.value });
});
statements.push('    let frame = WeatherFrame { resolved_tile_id: "weather_rain", tile_position: [7, -9, 0], screen_position: [30, 14] };',
  '    let repeated = weather_seed(&frame);', '    for chance in 2..80 {',
  '        let _ = accept_npc_color(&NpcCollisionFrame { origin: [15, -8, 0], cursor: [16, -7, 0], position: [20, -4, 0], npc_id: 123, native_chance: chance, pass: NpcPass::Followers });',
  '        if weather_seed(&frame) != repeated { failed += 1; }', '    }',
  '    checks += 1;', '    println!("{{\\\"summary\\\":true,\\\"checks\\\":{},\\\"failed\\\":{}}}", checks, failed);',
  '    if failed != 0 { std::process::exit(1); }', '}', '');
records.push({ summary: true, checks: 23, failed: 0 });
require(records.length === 23, 'exact output record count');
const stdoutBytes = Buffer.from(records.map(record => JSON.stringify(record)).join('\n') + '\n');
const harnessBytes = Buffer.from(statements.join('\n'));
const mainBytes = Buffer.concat([libBytes, Buffer.from('\ninclude!("parity-harness.rs");\n')]);
require(mainBytes.subarray(0, libBytes.length).equals(libBytes), 'authoritative Rust prefix');
try { await lstat(output); throw new Error('prepared output already exists; no overwrite'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const outputs = [];
const write = async (relative, bytes) => {
  const target = path.join(output, relative);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes, { flag: 'wx' });
  require((await readFile(target)).equals(bytes), 'prepared readback');
  outputs.push(pin(target, bytes));
};
await write('cpp/fixture.cpp', cppBytes);
await write('cpp/cdda_presentation_hash.h', headerBytes);
await write('expected.json', expectedBytes);
await write('expected-stdout.txt', stdoutBytes);
await write('rust/src/authoritative-lib.rs', libBytes);
await write('rust/src/main.rs', mainBytes);
await write('rust/src/parity-harness.rs', harnessBytes);
const RustSourcePins = [pin(libPath, libBytes)];
for (const entry of await readdir(path.join(rustRoot, 'src'), { withFileTypes: true })) {
  if (entry.name === 'lib.rs') continue;
  require(entry.isFile() && !entry.isSymbolicLink(), 'ordinary frozen Rust sibling');
  const source = path.join(rustRoot, 'src', entry.name);
  const bytes = await ordinary(source);
  RustSourcePins.push(pin(source, bytes));
  await write(`rust/src/${entry.name}`, bytes);
}
const manifest = {
  schemaVersion: 1, status: 'source-prepared-no-build-or-runtime',
  sourceCommit: '7b2efa5cea38e4d4d97dd0e63b28b9148623da59',
  frozenSourcePlan: pin(planPath, planBytes),
  cppOriginal: pin(parity.source.path, cppBytes), headerOriginal: pin(headerPath, headerBytes),
  expectedOriginal: pin(parity.expected.path, expectedBytes), RustSourcePins,
  rustModuleBodyRetainedByteExactly: true, rustPrivateFunctionsTestedInSameCrate: true,
  expectedChecks: 23, expectedDataRecords: 22, expectedSummaryRecords: 1,
  comparison: 'Each actual stdout must equal the entire frozen 23-line typed output, with only a uniform LF/CRLF convention allowed; no ignored lines or type coercion.',
  cppFutureCompilerTemplate: parity.plannedCompilerArgv, cppEnvironmentTemplate: parity.environment,
  cppOptimizationChanged: false, frozenCacheRequired: true,
  cppCompilerRun: false, rustCompilerRun: false, cppExecuted: false, rustExecuted: false,
  originalCallersExecuted: false, nativeRngStateProved: false, saveResumeProved: false,
  browserProved: false, fullGameAccepted: false, separateReviewedOwnerRequired: true,
  outputs
};
await write('SOURCE-PREPARATION.json', Buffer.from(JSON.stringify(manifest, null, 2) + '\n'));
console.log(JSON.stringify({ status: manifest.status, checks: 23, sourceFiles: outputs.length }));
