/* Read-only inspection of the newest task-created Chrome integration profile. */
import { readFile, readdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Cdp } from './integration-cdp.mjs';
const candidates = await Promise.all((await readdir(tmpdir())).filter(name => name.startsWith('nethack-integration-')).map(async name => {
  const path = join(tmpdir(), name);
  return { path, time: (await stat(path)).mtimeMs };
}));
candidates.sort((a, b) => b.time - a.time);
for (const profile of candidates) {
  try {
    const port = Number((await readFile(join(profile.path, 'DevToolsActivePort'), 'utf8')).split('\n')[0]);
    const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const target = pages.find(page => page.type === 'page' && page.url.startsWith('http://127.0.0.1:'));
    if (!target) continue;
    const cdp = await Cdp.connect(target.webSocketDebuggerUrl);
    try {
      const result = await cdp.evaluate(`({phase:window.netHackTest?.phase,pending:window.netHackTest?.host?.pendingKind,diagnostics:window.netHackTest?.diagnostics,modal:{open:document.querySelector('#modal')?.open,title:document.querySelector('#modal-title')?.textContent,body:document.querySelector('#modal-body')?.innerText},messages:document.querySelector('#messages')?.innerText,frame:window.netHackTest?.getFrame()?.status,queued:window.netHackTest?.host?.inbox.queue})`);
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } finally { cdp.close(); }
    break;
  } catch { /* Completed or concurrently closed task-created profile. */ }
}
