// SPDX-License-Identifier: GPL-3.0-or-later
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createTomeServer as originalServer} from './original_range_server.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
export function createTomeServer(options={}) {
  return originalServer({...options,manifest:path.join(here,'ui-browser-vfs-inputs.json')});
}
