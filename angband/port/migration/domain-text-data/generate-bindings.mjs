import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const directory=path.dirname(fileURLToPath(import.meta.url));
const inventory=JSON.parse(fs.readFileSync(path.join(directory,'inventory.json'),'utf8'));
const kinds={object:'OBJECT',activation:'ACTIVATION',player_timed:'TIMED',trap:'TRAP',terrain:'TERRAIN',shape:'SHAPE',curse:'CURSE',artifact:'ARTIFACT',ego_item:'EGO'};
const fields={name:'NAME',short_name:'SHORT_NAME',description:'DESCRIPTION',effect_message:'EFFECT_MESSAGE',visible_message:'VISIBLE_MESSAGE',message:'MESSAGE',end_message:'END',increase_message:'INCREASE',decrease_message:'DECREASE',status_name:'STATUS_NAME',enter_message:'ENTER',leave_message:'LEAVE',trigger_message:'TRIGGER',saved_message:'SAVED',failed_message:'FAILED',extra_message:'EXTRA',walking_warning:'WALK_WARN',running_warning:'RUN_WARN',damage_message:'DAMAGE',death_reason:'DEATH',confused_monster_message:'CONFUSED',look_prefix:'PREFIX',look_preposition:'PREPOSITION',blow_verb:'BLOW',alternate_activation_message:'ALT_ACTIVATION'};
const indexes={object:'kidx',activation:'activation_index',player_timed:'timed_index',trap:'tidx',terrain:'fidx',shape:'sidx',curse:'curse_index',artifact:'aidx',ego_item:'eidx'};
const bits={name:1,kind:2,s:4,is:8};
const rows=inventory.entries.filter(entry=>!entry.native_ignored).map(entry=>{
 const file=path.basename(entry.file,'.txt');
 const register=entry.role.includes('message') || ['death_reason','blow_verb','walking_warning','running_warning'].includes(entry.role);
 return {kind:kinds[file],index:entry.canonical[indexes[file]],field:fields[entry.role],slot:entry.canonical.grade??entry.canonical.blow_ordinal??entry.canonical.effect_ordinal??0,id:entry.id,tags:entry.native_custom_tags.reduce((mask,tag)=>mask|bits[tag],0),register};
});
if(rows.some(row=>!row.kind||!row.field||!Number.isInteger(row.index)||!Number.isInteger(row.slot)))throw Error('Unbound domain identity');
const content='/* SPDX-License-Identifier: GPL-2.0-only */\n/* Generated from pinned canonical domain identities; no runtime English lookup. */\nstatic const struct ab_domain_binding ab_domain_bindings[] = {\n'+rows.map(row=>` {AB_DOMAIN_${row.kind},${row.index},AB_DOMAIN_${row.field},${row.slot},${JSON.stringify(row.id)},${row.tags}U,${row.register?'true':'false'}},`).join('\n')+'\n};\n';
fs.writeFileSync(path.join(directory,'domain-bindings.inc'),content);
console.log(JSON.stringify({rows:rows.length,registeredMessagePointers:rows.filter(row=>row.register).length,customTemplates:rows.filter(row=>row.tags).length}));
