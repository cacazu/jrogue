// GPL-3.0-or-later. Read-only source-context capture; no build or runtime test.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const project=path.dirname(import.meta.dirname);
const rows=JSON.parse(fs.readFileSync(path.join(project,'localization-kernel-work/supplement-review-required.json'),'utf8'));
const roots=JSON.parse(fs.readFileSync(path.join(project,'inventory-work/inventory-output/summary.json'),'utf8')).sourceRoots;
const cache=new Map();
const captured=rows.map((row,review_index)=>({...row,review_index,contexts:row.source_locations.map(location=>{
 const root=roots[Number(location.source_root_id.slice(5))-1],absolute=path.join(root,location.file);
 if(!cache.has(absolute)){const bytes=fs.readFileSync(absolute);cache.set(absolute,{sha256:crypto.createHash('sha256').update(bytes).digest('hex'),lines:bytes.toString('utf8').split(/\r?\n/)});}
 const source=cache.get(absolute),line=location.line??1,start=Math.max(0,line-5),end=Math.min(source.lines.length,line+5);
 return {file:location.file,line:location.line,source_sha256:source.sha256,excerpt:source.lines.slice(start,end).map((text,index)=>`${start+index+1}: ${text}`).join('\n')};
})}));
fs.writeFileSync(path.join(import.meta.dirname,'review-inputs.json'),JSON.stringify({schema_version:1,source_commit:'624a67329fe2ad440c5b344785a9c73fcf22ae63',source_tag_pairs:rows.length,semantic_ids:new Set(rows.flatMap(row=>row.current_ids)).size,files:cache.size,entries:captured},null,2)+'\n');
for(const row of captured)console.log(JSON.stringify({i:row.review_index,source:row.source,tag:row.tag,ids:row.current_ids.length,locations:row.source_locations.map(location=>`${location.file}:${location.line}`),prior_notes:row.notes}));
console.log(JSON.stringify({files:cache.size,source_tag_pairs:rows.length,semantic_ids:new Set(rows.flatMap(row=>row.current_ids)).size,memory:process.memoryUsage()}));
