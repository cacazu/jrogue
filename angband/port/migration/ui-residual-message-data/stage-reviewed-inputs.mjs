import fs from'node:fs';import path from'node:path';import assert from'node:assert/strict';import{fileURLToPath}from'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const dir=path.join(root,'migration/ui-residual-message-data');
const temp='C:/Users/kit/AppData/Local/Temp';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const inputs=read(temp+'/angband-ui-residual-authored/source-manifest.json');
const lexical=read(temp+'/angband-ui-residual-catalog/source-rows.json');
const en=read(temp+'/angband-ui-residual-authored/en.json'),ja=read(temp+'/angband-ui-residual-authored/ja.json');
const le=read(temp+'/angband-ui-residual-catalog/en.json'),lj=read(temp+'/angband-ui-residual-catalog/ja.json');
for(const[id,value]of Object.entries(le)){assert.ok(!Object.hasOwn(en,id));en[id]=value;ja[id]=lj[id];}
const rows=[...lexical.parser_error_rows,...lexical.tval_rows,...(lexical.tval_fallback_rows||[])];
for(const[id,english]of Object.entries(le)){
 const row=rows.find(r=>r.id===id);assert.ok(row,id);
 inputs.entries.push({id,english,japanese:lj[id],parameters:[],sources:[row.source],role:'source_selected_enum_lexeme',status:'reviewed_source_catalog'});
}
inputs.lexical_sources=lexical;inputs.catalog_entries=inputs.entries.length;assert.equal(inputs.catalog_entries,250);
inputs.status='reviewed_catalog_not_yet_connected';
for(const[name,value]of[['en.json',en],['ja.json',ja],['source-manifest.json',inputs],['lexical-source-rows.json',lexical]])fs.writeFileSync(path.join(dir,name),JSON.stringify(value,null,2)+'\n');
const domain=read(path.join(root,'migration/domain-text-data/inventory.json'));
const reviewed=read(path.join(root,'locales/review-en.json'));
const trapRows=domain.records.trap.map(row=>{
 const ids=Object.keys(reviewed).filter(id=>id.startsWith('trap.label.')&&reviewed[id]===row.identity);assert.equal(ids.length,1,row.identity);
 return{index:row.canonical.tidx,name:row.identity,desc:row.fields.short_name,id:ids[0],source_line:row.source_line};
});assert.equal(trapRows.length,40);
const fallback=Object.entries(le).find(([id])=>id==='ui.residual.tval.unknown');assert.ok(fallback);
const text='/* SPDX-License-Identifier: GPL-2.0-only */\n/* Exact original enum constants and parser-selected immutable trap fields. */\n'+
 'static const struct {int value;const char *id;} ab_ur_parser_ids[]={\n'+lexical.parser_error_rows.map(r=>` {${r.enum_symbol},${JSON.stringify(r.id)}},`).join('\n')+'\n};\n'+
 'static const struct {int value;const char *id;} ab_ur_tval_ids[]={\n'+lexical.tval_rows.map(r=>` {${r.enum_symbol},${JSON.stringify(r.id)}},`).join('\n')+'\n};\n'+
 'static const struct {int index;const char *name,*desc,*id;} ab_ur_trap_ids[]={\n'+trapRows.map(r=>` {${r.index},${JSON.stringify(r.name)},${JSON.stringify(r.desc)},${JSON.stringify(r.id)}},`).join('\n')+'\n};\n';
fs.writeFileSync(path.join(root,'logic/web-ui-residual-bindings.h'),text);
fs.writeFileSync(path.join(dir,'trap-source-bindings.json'),JSON.stringify(trapRows,null,2)+'\n');
for(const name of['web-ui-residual-text.c','web-ui-residual-text.h'])fs.copyFileSync(path.join(temp,name),path.join(root,'logic',name));
console.log(JSON.stringify({catalog_entries:250,parser_enums:64,tval_enums:36,tval_fallback:1,shared_trap_name_bindings:40}));
