// SPDX-License-Identifier: GPL-3.0-or-later
// Explicit candidate configuration, used only by the owned browser harness.
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createTomeServer as createObserver} from '../mechanics-audit-work/prepared-map/integration-web/observer_server.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
export function createTomeServer(){return createObserver({
  nativeBuildRoot:path.join(root,'prepared-map-build'),
  rustWasmFile:path.resolve(root,'../rust-prepared-map-work/wasm-wrapper/target/wasm32-unknown-unknown/release/tome_map_packet_wasm.wasm'),
});}
