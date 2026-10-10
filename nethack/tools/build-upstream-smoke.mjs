// Added 2026-10-02: verify the built upstream/Rust module ABI without starting a game.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import createNetHackModule from '../build/nethack.js';

const wasmBytes = new Uint8Array(await readFile(new URL('../build/nethack.wasm', import.meta.url)));
const module = await createNetHackModule({ noInitialRun: true, wasmBinary: wasmBytes });
const layout = JSON.parse(module.ccall('nh_abi_layout_json', 'string', [], []));
assert.equal(layout.anythingSize, 8);
assert.equal(layout.menuItemSize, 16);
assert.equal(layout.menuCountOffset, 8);
assert.equal(layout.menuFlagsOffset, 12);
assert.equal(layout.playerNameSize, 32);
assert.equal(layout.lineBufferSize, 256);
assert.ok(module.HEAPU8 instanceof Uint8Array);
for (const name of ['_main', '_shim_graphics_set_callback', '_nh_abi_input_state', '_nh_abi_input_layout',
                    '_nh_abi_state_json', '_nh_abi_state_checksum', '_nh_abi_world_checksum', '_nh_abi_rng_checksum',
                    '_nh_abi_setenv',
                    '_nh_abi_readfile', '_nh_rust_direction_pad', '_nh_rust_text_insert', '_nh_rust_format',
                    '_nh_rust_save_wrap', '_nh_rust_save_unwrap']) {
  assert.equal(typeof module[name], 'function', `Missing export ${name}`);
}
const embeddedDataPath = '/nhdat'; // Official UNIX/WASM DLBFILE; native Windows librarian adds 500.
const embeddedDataBytes = module.FS.stat(embeddedDataPath).size;
assert.ok(embeddedDataBytes > 1000000);
assert.ok(module.FS.readFile('/license', { encoding: 'utf8' }).includes('NetHack'));
const commands = module._nh_abi_extcmd_count();
assert.ok(commands > 100);
assert.equal(module.ccall('nh_abi_setenv', 'number', ['string', 'string'],
                          ['NETHACK_TEST_SEED', '123456789']), 0);
assert.equal(module.ccall('nh_abi_setenv', 'number', ['string', 'string'],
                          ['NETHACKOPTIONS', '!tutorial,windowtype:shim']), 0);
assert.equal(module.ccall('nh_abi_setenv', 'number', ['string', 'string'], ['bad=name', 'value']), -1);
const report = { status: 'passed', layout, extendedCommandCount: commands, embeddedDataPath, embeddedDataBytes,
                 nativeEnvironmentSetter: 'passed',
                 wasmSha256: createHash('sha256').update(wasmBytes).digest('hex') };
await writeFile(new URL('../build/node-smoke.json', import.meta.url), JSON.stringify(report, null, 2));
process.stdout.write(JSON.stringify(report, null, 2) + '\n');
