// GPL-3.0-or-later. Source-only inspection; never loads or runs game code.
import fs from 'node:fs';
import path from 'node:path';
const project=path.dirname(import.meta.dirname);
const input=JSON.parse(fs.readFileSync(path.join(import.meta.dirname,'review-inputs.json'),'utf8'));
const roots=JSON.parse(fs.readFileSync(path.join(project,'inventory-work/inventory-output/summary.json'),'utf8')).sourceRoots;
const indexes=process.argv[2].split(',').map(Number);
const margin=Number(process.argv[3]??25);
for(const index of indexes){
 const row=input.entries[index];
 console.log(JSON.stringify({index,source:row.source,tag:row.tag}));
 for(const location of row.source_locations){
  const root=roots[Number(location.source_root_id.slice(5))-1];
  const lines=fs.readFileSync(path.join(root,location.file),'utf8').split(/\r?\n/);
  const start=Math.max(0,location.line-margin),end=Math.min(lines.length,location.line+margin);
  console.log(JSON.stringify({file:location.file,line:location.line,source:lines.slice(start,end).map((value,i)=>`${start+i+1}: ${value}`).join('\n')}));
 }
}
