import {readdir, readFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';

// Record source bytes that may affect this engine, including immutable Rust
// catalog dependencies. Authoring an unregistered catalog is not a build input.
export async function fingerprintBuildInputs(root) {
  const files = new Set(['web/library.js','logic/Makefile.src','tools/build.mjs','tools/build-inputs.mjs']);
  async function walk(directory, accept) {
    for (const entry of await readdir(path.join(root, directory), {withFileTypes:true})) {
      const relative = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(relative, accept);
      else if (accept(relative)) files.add(relative);
    }
  }
  await walk('logic', name => /\.[ch]$/.test(name));
  await walk('rust/src', name => name.endsWith('.rs'));
  await walk('data', () => true);
  files.add('rust/Cargo.toml'); files.add('rust/Cargo.lock');
  const inspected = new Set();
  while (true) {
    const next = [...files].find(name => /\.(?:c|h|inc)$/.test(name) && !inspected.has(name));
    if (!next) break;
    inspected.add(next);
    const source = await readFile(path.join(root,next),'utf8');
    for (const match of source.matchAll(/^\s*#\s*include\s+"([^"\n]+)"/gm)) {
      const dependency = path.resolve(root,path.dirname(next),match[1]);
      const relative = path.relative(root,dependency);
      // Upstream includes headers for other targets (for example NDS names
      // /usr/include/malloc.h). Absent conditional headers are not inputs to
      // this portable build. Reject an actual external dependency explicitly.
      try { await readFile(dependency); }
      catch (error) { if (error.code === 'ENOENT') continue; throw error; }
      if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`C build input outside port: ${next} -> ${match[1]}`);
      files.add(relative);
    }
  }
  for (const name of [...files].filter(name => name.endsWith('.rs'))) {
    const source = await readFile(path.join(root,name),'utf8');
    for (const match of source.matchAll(/include_str!\("([^"\n]+)"\)/g)) {
      const dependency = path.resolve(root,path.dirname(name),match[1]);
      const relative = path.relative(root,dependency);
      if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('build input outside port');
      files.add(relative);
    }
  }
  const inputs = [];
  for (const name of [...files].sort()) {
    const bytes = await readFile(path.join(root,name));
    inputs.push({file:name.replaceAll('\\','/'),bytes:bytes.length,
      sha256:createHash('sha256').update(bytes).digest('hex')});
  }
  return {sha256:createHash('sha256').update(JSON.stringify(inputs)).digest('hex'), inputs};
}
