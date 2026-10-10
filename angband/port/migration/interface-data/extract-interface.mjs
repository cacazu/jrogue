import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const output=path.join(root,'migration/interface-data');
export const owned=['ui-store.c','ui-object.c','ui-knowledge.c','ui-target.c','ui-death.c','ui-score.c','ui-curse.c','ui-keymap.c','ui-visuals.c','ui-command.c','ui-menu.c','ui-options.c'];
fs.mkdirSync(path.join(output,'source-baseline'),{recursive:true});
const manifest=[];
for(const name of [...owned,'list-options.h']) {
 const file=path.join(output,'source-baseline',name);
 if(!fs.existsSync(file))fs.copyFileSync(path.join(root,'logic',name),file);
 const bytes=fs.readFileSync(file);
 manifest.push({file:`logic/${name}`,snapshot:`migration/interface-data/source-baseline/${name}`,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
}
fs.writeFileSync(path.join(output,'source-baseline.json'),JSON.stringify({schema_version:1,upstream_commit:'f3082213b73f3e463e3d0d60bff4b00462beae6e',description:'Source-only migration entry baseline. Existing browser checkpoint/birth additions are retained verbatim.',files:manifest},null,2)+'\n');
const rows=fs.readFileSync(path.join(root,'inventory/source_strings.jsonl'),'utf8').trim().split(/\r?\n/).map(JSON.parse).filter(r=>owned.includes(path.basename(r.path)));
const sinks=new Set(['msg','msgt','prt','c_prt','put_str','c_put_str','text_out','text_out_c','text_out_e','textblock_append','textblock_append_c','get_check','get_string','get_com','get_com_ex','get_char','get_item','Term_putstr','plog','plog_fmt','quit','quit_fmt','event_signal_message','menu_dynamic_add','menu_dynamic_add_label']);
const formatter=new Set(['format','strnfmt','strnfcat','my_strcpy','my_strcat','file_putf']);
const inventory=rows.map(r=>({source:{file:r.path.replace(/^src\//,'logic/'),line:r.line,column:r.column,offset:r.offset,offset_end:r.offset_end},function:r.function,call:r.call,argument_index:r.argument_index,original_english:r.text,original_context:r.source_context,classification:
 r.classification==='include_path'?'include_path':r.classification==='parser_or_identity_or_path'?'parser_key_or_file_identity':!r.text.trim()?'layout_spacing':
 sinks.has(r.call)?(/^[%\d. +\-*#a-zA-Z]+$/.test(r.text)&&r.placeholders.printf.length?'numeric_render_format':'visible_sink'):
 formatter.has(r.call)?(/(?:<[^>]+>|\[\/?(?:COLOR|CODE|TT|BC))/.test(r.text)?'export_markup':r.placeholders.printf.length?'composed_render_format':'composed_text_or_literal'):'source_table_or_internal_literal',
 printf:r.placeholders.printf,enabled_in_port:!r.path.includes('/win/')&&!r.path.includes('/sdl2/'),translation_status:'needs_source_role_review'}));
fs.writeFileSync(path.join(output,'inventory.json'),JSON.stringify({schema_version:1,upstream_commit:'f3082213b73f3e463e3d0d60bff4b00462beae6e',files:owned.map(file=>'logic/'+file),build_selection:'Makefile.src core sources; no native frontend/debug-only replacement',coverage_complete:false,entries:inventory},null,2)+'\n');
console.log(JSON.stringify({files:owned.length,tokens:inventory.length,classifications:inventory.reduce((a,r)=>(a[r.classification]=(a[r.classification]||0)+1,a),{})}));
