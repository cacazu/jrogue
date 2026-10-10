#!/usr/bin/env node
// GPL-3.0-or-later. Read-only evidence capture, no original Lua execution.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const summary=JSON.parse(fs.readFileSync(new URL('../inventory-work/inventory-output/summary.json',import.meta.url),'utf8'));
const root=summary.sourceRoots[1];
const files=['game/modules/tome/data/timed_effects/other.lua','game/engines/default/data/locales/engine/ja_JP.lua'];
const evidence=files.map(file=>{
 const bytes=fs.readFileSync(path.join(root,file)),source=bytes.toString('utf8'),lines=source.split(/\r?\n/);
 const selected=file.includes('timed_effects')?lines.slice(3176,3186):lines.slice(58,65);
 return {file,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),start_line:file.includes('timed_effects')?3177:59,lines:selected.map(line=>JSON.stringify(line).replace(/[\u0080-\uffff]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0')))};
});
console.log(JSON.stringify({evidence,memory:process.memoryUsage()}));
