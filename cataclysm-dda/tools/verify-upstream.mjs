import { readFile, readdir, stat, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

// Verify every tracked blob against the immutable official GitHub Git tree.
// Git computes blob IDs over the header plus the original bytes; line endings
// and ZIP extraction damage are therefore caught, including binary assets.
const [source, treeFile, output] = process.argv.slice(2);
if (!source || !treeFile || !output) throw new Error('usage: node verify-upstream.mjs SOURCE TREE_JSON OUTPUT_JSON');
const raw = (await readFile(treeFile, 'utf8')).replace(/^\uFEFF/, '');
const tree = JSON.parse(raw);
if (tree.truncated !== false) throw new Error('official recursive tree is incomplete');
const expected = tree.tree.filter(entry => entry.type === 'blob');
const gitlinks = tree.tree.filter(entry => entry.mode === '160000');
const result = { schema_version: 1, source, tree_sha: tree.sha, checked_at: new Date().toISOString(), expected_files: expected.length, expected_bytes: 0, actual_bytes: 0, matched_files: 0, mismatches: [], missing: [], unexpected: [], gitlinks };
const paths = new Set(expected.map(entry => entry.path));
let index = 0;
async function worker() {
  while (index < expected.length) {
    const entry = expected[index++];
    result.expected_bytes += entry.size ?? 0;
    try {
      const bytes = await readFile(path.join(source, ...entry.path.split('/')));
      result.actual_bytes += bytes.length;
      const actual = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
      if (actual === entry.sha && bytes.length === entry.size) result.matched_files++;
      else result.mismatches.push({ path: entry.path, expected_sha: entry.sha, actual_sha: actual, expected_size: entry.size, actual_size: bytes.length });
    } catch (error) {
      if (error.code === 'ENOENT') result.missing.push(entry.path);
      else throw error;
    }
  }
}
await Promise.all(Array.from({ length: 4 }, worker));
async function walk(folder, prefix = '') {
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const relative = prefix + entry.name;
    if (entry.isDirectory()) await walk(path.join(folder, entry.name), relative + '/');
    else if (!paths.has(relative)) result.unexpected.push(relative);
  }
}
await walk(source);
result.result = result.matched_files === expected.length && result.missing.length === 0 && result.mismatches.length === 0 && result.unexpected.length === 0 && gitlinks.length === 0 ? 'pass' : 'fail';
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
if (result.result !== 'pass') process.exitCode = 1;
