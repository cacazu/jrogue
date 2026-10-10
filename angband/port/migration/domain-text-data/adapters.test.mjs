// SPDX-License-Identifier: GPL-2.0-only
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {stripDomain} from './integrate.mjs';
const directory=path.dirname(fileURLToPath(import.meta.url));
const read=name=>fs.readFileSync(path.resolve(directory,'../../logic',name),'utf8');
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
test('all ten applied C source edits reconstruct their exact reviewed native baseline bytes',()=>{
 let count=0;
 for(const [name,baseline] of [['integration-evidence.json','source-baseline'],['popup-integration-evidence.json','popup-source-baseline']]) {
  const evidence=JSON.parse(fs.readFileSync(path.join(directory,name),'utf8'));
  assert.equal(evidence.source_commit,'f3082213b73f3e463e3d0d60bff4b00462beae6e');
  for(const entry of evidence.files) {
   const original=fs.readFileSync(path.join(directory,baseline,entry.file),'utf8');
   assert.equal(sha(original),entry.baseline_sha256);
   let cursor=0,modified='';
   for(const insertion of entry.insertions) {
    assert.ok(insertion.offset_chars>=cursor && insertion.offset_chars<=original.length);
    modified+=original.slice(cursor,insertion.offset_chars)+insertion.source;cursor=insertion.offset_chars;
   }
   modified+=original.slice(cursor);
   assert.equal(sha(modified),entry.modified_sha256);
   assert.equal(stripDomain(modified),original);
   assert.equal(entry.native_reconstruction_exact,true);count++;
  }
 }
 assert.equal(count,10);
});
test('selected immutable message fields use one shared pointer registry without text lookup',()=>{
 const source=read('web-domain-text.c');
 assert.match(source,/ab_dc_register_source_message\(source,b->id\)/);
 assert.match(source,/ab_dc_source_message_id\(native_source\)/);
 assert.doesNotMatch(source,/strcmp\([^\n]*(native_source|source_address)/);
 assert.doesNotMatch(source,/randint|one_in_|object_desc\(|object_kind_name\(|player_knows|object_flavor_is_aware/);
 const bindings=fs.readFileSync(path.join(directory,'domain-bindings.inc'),'utf8');
 assert.equal((bindings.match(/,true\},/g)||[]).length,325);
 assert.equal((bindings.match(/ \{AB_DOMAIN_/g)||[]).length,1059);
});
test('custom naming copies the original branch buffers before reuse and releases all owned captures',()=>{
 const source=read('obj-util.c');
 assert.match(source,/ODESC_PREFIX \| ODESC_BASE, p\);[\s\S]*?ab_domain_custom_snapshot\(&ab_domain_capture,buf,false\)/);
 assert.match(source,/object_kind_name\(&buf\[end\], 1024 - end, obj->kind, true\);[\s\S]*?ab_domain_custom_snapshot\(&ab_domain_capture,&buf\[end\],true\)[\s\S]*?end \+= strlen\(&buf\[end\]\)/);
 assert.equal((source.match(/ab_domain_custom_hands\(&ab_domain_capture,/g)||[]).length,2);
 assert.match(source,/ab_domain_custom_begin\(&ab_domain_capture,string,obj != NULL,obj \? obj->number : 0,msg_type\)/);
 const helper=read('web-domain-text.c');
 assert.match(helper,/KnownObjectDescription/);
 assert.match(helper,/DomainCustomVerbSuffix/);assert.match(helper,/DomainCustomCopula/);
 assert.match(helper,/ab_naming_snapshot_release\(&capture->name\);ab_naming_snapshot_release\(&capture->kind\)/);
});
test('trap messages and device messages remain inside their original branch gates',()=>{
 const trap=read('trap.c'),device=read('cmd-obj.c');
 for(const field of ['msg','msg_good','msg_bad','msg_xtra'])
  assert.match(trap,new RegExp('if \\(trap->kind->'+field+'\\)[\\s\\S]*?ab_domain_message_pointer\\(trap->kind->'+field+',-1\\)'));
 for(const field of ['effect_msg','vis_msg'])assert.match(device,new RegExp('ab_domain_message_pointer\\(obj->kind->'+field+',snd\\)'));
 assert.match(trap,/trap->kind->effect_xtra && one_in_\(2\)/);
 assert.match(device,/obj->kind->vis_msg && !player->timed\[TMD_BLIND\]/);
});
test('terrain captures the existing damage option branch and warning pointer exactly once',()=>{
 const source=read('player-util.c'),move=read('cmd-cave.c');
 assert.match(source,/if \(dam_reduced > 0 && OPT\(p, show_damage\)\) \{[\s\S]*?ab_domain_show_damage=true/);
 assert.match(source,/AB_DOMAIN_HURT\([\s\S]*?square_feat\(cave, grid\)->hurt_msg[\s\S]*?,dam_reduced,ab_domain_show_damage\)/);
 assert.equal((move.match(/AB_DOMAIN_CHECK\(/g)||[]).length,2);
 assert.match(read('web-domain-text.c'),/ab_ui_check_source\(ab_domain_source_id\(native_source\),native_source\)/);
});
test('source-selected info clauses retain native knowledge gates and independent canonical identities',()=>{
 const source=read('obj-info.c');
 for(const [kind,field,index] of [['ARTIFACT','artifact','aidx'],['OBJECT','kind','kidx'],['EGO','ego','eidx']])
  assert.ok(source.includes('ab_domain_info_selected(AB_DOMAIN_'+kind+',obj->'+field+'->'+index+',AB_DOMAIN_DESCRIPTION,0)'));
 assert.match(source,/ab_domain_curse_info\(i,c\[i\]\.power == 100\)/);
 assert.match(source,/obj->known->artifact && obj->artifact->text/);
 assert.match(source,/ab_domain_info_selected\(AB_DOMAIN_ACTIVATION,obj->activation->index,AB_DOMAIN_DESCRIPTION,0\)/);
 assert.match(source,/ego_apply_magic\(&obj, 0\)/);
});
test('blocking popup lifetime resets owned context and free removes pointer tags before native deallocation',()=>{
 const source=read('web-domain-text.c');
 assert.match(source,/textblock_tags\[64\]/);assert.match(source,/domain_status=5;return/);
 assert.match(source,/textblock_tags\[j\]\.generation>textblock_tags\[i\]\.generation/);
 assert.match(read('ui-output.c'),/return [^\n]*AB_DOMAIN_CAPTURE\(ab_domain_info_display_end\(tb\)\), [^\n]*\(ch\)/);
 assert.doesNotMatch(read('ui-output.c'),/AB_DOMAIN_CAPTURE\([^\n]*, [^\n]*return /);
 assert.match(read('z-textblock.c'),/AB_DOMAIN_CAPTURE\(ab_domain_info_forget\(tb\)\), [\s\S]*?mem_free\(tb->text\)/);
 assert.match(source,/if\(suppressed_depth\)\{suppressed_depth--;return;\}/);
});
