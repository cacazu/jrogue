import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile, open, unlink } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
export const root = path.dirname(fileURLToPath(import.meta.url));
export const sdk = 'C:/Users/kit/emsdk/upstream/emscripten';
export const python = 'C:/Users/kit/emsdk/python/3.13.3_64bit/python.exe';
export const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export async function pin(file) { const bytes = await readFile(file); return { path: file, bytes: bytes.length, sha256: digest(bytes) }; }
export async function receipt(phase) {
  const index = process.argv.indexOf('--parent-slot');
  if (index < 0 || !process.argv[index + 1]) throw new Error('Source-only prerequisite: a fresh coordinator --parent-slot receipt is required before any runtime action.');
  const filename = path.resolve(process.argv[index + 1]);
  if (!filename.startsWith(root + path.sep)) throw new Error('Keep the coordinator receipt inside this isolated probe directory.');
  const value = JSON.parse(await readFile(filename, 'utf8'));
  if (value.schemaVersion !== 1 || value.scope !== 'cdda-jspi-sdk-bridge-prerequisite' || value.coordinator !== '/root' || value.exclusiveHeavySlot !== true || !value.actions?.includes(phase) || !(Date.parse(value.expiresAt) > Date.now())) throw new Error('The coordinator receipt is missing, expired, or does not grant this phase the exclusive resource slot.');
  const lock = path.join(root, 'parent-slot.lock');
  const handle = await open(lock, 'wx'); await handle.writeFile(JSON.stringify({ phase, pid: process.pid, receipt: filename }));
  return { value, release: async () => { await handle.close(); await unlink(lock); } };
}
export async function memory() {
  const file = path.resolve(root, '../jspi-probe/measure-memory.ps1');
  const processHandle = spawn('powershell.exe', ['-NoProfile', '-File', file], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '', stderr = ''; processHandle.stdout.on('data', bytes => stdout += bytes); processHandle.stderr.on('data', bytes => stderr += bytes);
  const code = await new Promise((resolve, reject) => { processHandle.on('error', reject); processHandle.on('exit', resolve); });
  if (code !== 0) throw new Error('Memory preflight failed: ' + stderr);
  const value = JSON.parse(stdout.replace(/^\ufeff/, ''));
  if (value.freePhysicalBytes < 4 * 1024 ** 3 || value.freeCommitBytes < 6 * 1024 ** 3) throw new Error('Prerequisite launch blocked: need fresh 4 GiB physical and 6 GiB commit free. ' + JSON.stringify(value));
  return value;
}
export async function bounded(executable, args, { prefix, marker, env = process.env, timeoutSeconds = 90 }) {
  await mkdir(path.dirname(prefix), { recursive: true });
  const initialMemory = await memory();
  const child = spawn(executable, args, { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '', stderr = ''; child.stdout.on('data', bytes => stdout += bytes); child.stderr.on('data', bytes => stderr += bytes);
  const exited = new Promise((resolve, reject) => { child.on('error', reject); child.on('exit', resolve); });
  const stop = prefix + '.stop';
  const guardFile = prefix + '.guard.json';
  const guard = spawn('powershell.exe', ['-NoProfile', '-File', path.join(root, 'resource-guard.ps1'), '-OwnedRootPid', String(child.pid), '-ExpectedMarker', marker, '-OutputPath', guardFile, '-StopPath', stop, '-MaximumSeconds', String(timeoutSeconds)], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  let guardStderr = ''; guard.stderr.on('data', bytes => guardStderr += bytes);
  const guardExit = new Promise(resolve => guard.on('exit', resolve));
  let code;
  try { code = await Promise.race([exited, guardExit.then(() => {
    if (child.exitCode === null) throw new Error('Resource monitor ended while its owned compiler was still running.');
    return child.exitCode;
  })]); }
  finally {
    await writeFile(stop, 'Owned task finished.\n');
    if (child.exitCode === null) {
      const closer = spawn('powershell.exe', ['-NoProfile', '-File', path.join(root, 'resource-guard.ps1'), '-OwnedRootPid', String(child.pid), '-ExpectedMarker', marker, '-OutputPath', prefix + '.cleanup.json', '-StopPath', stop, '-AbortOwned'], { windowsHide: true, stdio: 'ignore' });
      await new Promise(resolve => closer.on('exit', resolve));
    }
    await guardExit;
  }
  await writeFile(prefix + '.stdout.log', stdout); await writeFile(prefix + '.stderr.log', stderr);
  const guardResult = JSON.parse((await readFile(guardFile, 'utf8')).replace(/^\ufeff/, ''));
  const result = { executable, args, pid: child.pid, exitCode: code, initialMemory, guard: guardResult, guardStderr };
  await writeFile(prefix + '.result.json', JSON.stringify(result, null, 2) + '\n');
  if (code !== 0 || !['completed', 'completed-child-exited'].includes(guardResult.status)) throw new Error('Bounded prerequisite command failed; inspect ' + prefix + '.result.json');
  return result;
}
