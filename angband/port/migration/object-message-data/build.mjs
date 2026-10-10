// SPDX-License-Identifier: GPL-2.0-only
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';
import{rows}from'./authored.mjs';
const directory=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(directory,'../..');
const reviewed=JSON.parse(fs.readFileSync(path.join(root,'migration/residual-message-review.json'),'utf8')).groups.find(g=>g.role==='object_device_equipment').callsites.filter(r=>![98,99].includes(r.source_index));
const expected=new Set(reviewed.map(r=>r.source_index)),covered=new Set(rows.flatMap(r=>r.source_indices));
if(expected.size!==23 || [...expected].some(i=>!covered.has(i)) || [...covered].some(i=>!expected.has(i)))throw Error('Source producer coverage mismatch');
const en={},ja={},entries={};
for(const row of rows){
 if(en[row.id]!==undefined)throw Error('Duplicate ID');
 const slots=text=>[...text.matchAll(/\{([a-z_]+)\}/g)].map(m=>m[1]).sort();
 const names=row.parameters.map(p=>p.name).sort();
 if(JSON.stringify(slots(row.en))!==JSON.stringify(names)||JSON.stringify(slots(row.ja))!==JSON.stringify(names))throw Error('Typed placeholder mismatch '+row.id);
 if(!row.ja||row.ja.includes('\uFFFD')||row.en===row.ja)throw Error('Unreviewed Japanese '+row.id);
 en[row.id]=row.en;ja[row.id]=row.ja;entries[row.id]={parameters:row.parameters};
}
const upstream='C:/Users/kit/gameme/jnethack/jrouge/angband/upstream/angband-4.2.6';
const sourceFiles=[...new Set([...reviewed.map(r=>r.source.file.replace('logic/','src/')),'src/list-equip-slots.h','lib/gamedata/body.txt'])];
const source_hashes=sourceFiles.map(file=>{const bytes=fs.readFileSync(path.join(upstream,file));return{file,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')}});
for(const[name,value]of Object.entries({'en.json':en,'ja.json':ja,'schema.json':{schema_version:1,entries},'source-manifest.json':{schema_version:1,upstream_commit:'f3082213b73f3e463e3d0d60bff4b00462beae6e',source_hashes,source_callsites:reviewed,entries:rows,status:'reviewed_source_catalog',complete_game_translation:false}}))fs.writeFileSync(path.join(directory,name),JSON.stringify(value,null,2)+'\n');
console.log(JSON.stringify({entries:rows.length,sourceProducers:expected.size,originalSourceFiles:sourceFiles.length}));
