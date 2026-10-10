// Bounded read-only source excerpts; no recursive scan or code execution.
import {readFileSync} from 'node:fs';
import path from 'node:path';
const upstream = 'C:/Users/kit/gameme/jnethack/jrouge/cataclysm-dda/upstream/Cataclysm-DDA-7b2efa5cea38e4d4d97dd0e63b28b9148623da59';
const [, , file, ...queries] = process.argv;
const lines = readFileSync(path.join(upstream, file), 'utf8').split(/\r?\n/);
const selected = new Set();
for (const query of queries) {
  if (/^\d+:\d+$/.test(query)) {
    const [start, end] = query.split(':').map(Number);
    for (let line = start; line <= end; line++) selected.add(line);
  } else {
    for (let index = 0; index < lines.length; index++) if (lines[index].includes(query)) {
      for (let line = Math.max(1, index - 3); line <= Math.min(lines.length, index + 10); line++) selected.add(line);
    }
  }
}
for (const line of [...selected].sort((a, b) => a - b)) console.log(`${file}:${line}: ${lines[line - 1]}`);
