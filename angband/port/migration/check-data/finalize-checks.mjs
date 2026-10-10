import fs from'node:fs';import path from'node:path';import assert from'node:assert/strict';import{fileURLToPath}from'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8'),write=(p,s)=>fs.writeFileSync(path.join(root,p),s);
const paths=['migration/interface-data/source-manifest.json','migration/interface-data/en.json','migration/interface-data/ja.json','migration/check-data/source-manifest.json'];
const[manifest,en,ja,checks]=paths.map(p=>JSON.parse(read(p)));
const record={id:'interface.check.quit_without_save',english:'Really quit without saving? ',japanese:'本当に保存せずに終了しますか？',parameters:[],sources:[{file:'logic/ui-wizard.c',line:385,original_lexeme:'"Really quit without saving? "'}],role:'source_check_projection',status:'reviewed_source_catalog'};
if(!Object.hasOwn(en,record.id)){manifest.entries.push(record);checks.entries.push(record);en[record.id]=record.english;ja[record.id]=record.japanese;}
if(!checks.source_files.includes('logic/ui-wizard.c'))checks.source_files.push('logic/ui-wizard.c');
if(!checks.connections.some(c=>c.id===record.id))checks.connections.push({file:'logic/ui-wizard.c',id:record.id,original_argument:record.sources[0].original_lexeme,kind:'fixed_source_prompt'});
manifest.check_phase.catalog_entries=checks.entries.length;
for(const[p,v]of paths.map((p,i)=>[p,[manifest,en,ja,checks][i]]))write(p,JSON.stringify(v,null,2)+'\n');
console.log(JSON.stringify({catalog_entries:manifest.entries.length,check_entries:checks.entries.length,commands:checks.commands.length,source_files:checks.source_files.length,original_get_check_call_sites:checks.inventory.length}));
