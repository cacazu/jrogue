// SPDX-License-Identifier: GPL-2.0-only
// Add only tagged pure captures. Every original byte remains reconstructible.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../..');
const begin='/* AB_STAT_MESSAGE_BEGIN */',end='/* AB_STAT_MESSAGE_END */';
export const stripStat=source=>source.replace(/\/\* AB_STAT_MESSAGE_BEGIN \*\/[\s\S]*?\/\* AB_STAT_MESSAGE_END \*\//g,'');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
export function functionSpan(source,name) {
 const re=new RegExp('^[^\\r\\n;]*\\b'+name+'\\([^;]*?\\r?\\n\\{','gm'),match=re.exec(source);
 if(!match)throw Error('Missing native function '+name);
 const start=match.index,open=source.indexOf('{',start);let depth=1,mode='',escaped=false;
 for(let i=open+1;i<source.length;i++) {
  const ch=source[i],next=source[i+1];
  if(mode==='//'){if(ch==='\n')mode='';continue;}
  if(mode==='/*'){if(ch==='*'&&next==='/'){mode='';i++;}continue;}
  if(mode==='"'||mode==="'"){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===mode)mode='';continue;}
  if(ch==='/'&&(next==='/'||next==='*')){mode=ch+next;i++;continue;}
  if(ch==='"'||ch==="'"){mode=ch;continue;}
  if(ch==='{')depth++;else if(ch==='}'&&!--depth)return [start,i+1];
 }
 throw Error('Unclosed native function '+name);
}
function one(source,needle,replacement) {
 const at=source.indexOf(needle);if(at<0||source.indexOf(needle,at+needle.length)>=0)throw Error('Unique native anchor '+needle);
 return source.slice(0,at)+replacement+source.slice(at+needle.length);
}
function block(text,eol) {return begin+eol+'#ifdef __EMSCRIPTEN__'+eol+text+eol+'#endif'+eol+end;}
function after(source,needle,text,eol) {return one(source,needle,needle+block(text,eol));}
function before(source,needle,text) {return one(source,needle,begin+'AB_STAT_MESSAGE('+text+'), '+end+needle);}
const courage=(body,eol)=>{
 const name='monster_desc(m_name, sizeof(m_name), mon, MDESC_STANDARD);';
 const possessive='monster_desc(m_poss, sizeof(m_poss), mon, MDESC_PRO_VIS | MDESC_POSS);';
 body=one(body,name,block(' struct ab_naming_snapshot ab_stat_actor={0},ab_stat_possessive={0};',eol)+name+
  block(' (void)ab_naming_copy_monster_snapshot(&ab_stat_actor,m_name);',eol));
 body=after(body,possessive,' (void)ab_naming_copy_monster_snapshot(&ab_stat_possessive,m_poss);',eol);
 body=before(body,'msg("%s recovers %s courage.", m_name, m_poss);','ab_stat_courage(&ab_stat_actor,&ab_stat_possessive)');
 const at=body.lastIndexOf('return true;');if(at<0)throw Error('Native return missing');
 return body.slice(0,at)+block(' ab_naming_snapshot_release(&ab_stat_actor);'+eol+' ab_naming_snapshot_release(&ab_stat_possessive);',eol)+body.slice(at);
};
function damageFlag(body,eol) {
 const declaration=/char dam_text\[(?:16|32)\] = "";/;
 const found=declaration.exec(body);if(!found)throw Error('Missing native damage buffer');
 body=one(body,found[0],found[0]+block(' bool ab_stat_damage_shown=false;',eol));
 const predicate=/if \((?:dam|damage) > 0 && OPT\((?:player|p), show_damage\)\) \{/g;
 let count=0;body=body.replace(predicate,text=>{count++;return text+block(' ab_stat_damage_shown=true;',eol);});
 if(!count)throw Error('Missing original show_damage predicate');return body;
}
const edits=new Map([
 ['effect_handler_MON_HEAL_HP',courage],['effect_handler_MON_HEAL_KIN',courage],
 ['effect_handler_BREATH',body=>before(body,'msgt(projections[type].msgt, "You breathe %s.", projections[type].desc);','ab_stat_projection(type,false,projections[type].msgt)')],
 ['effect_handler_EARTHQUAKE',(body,eol)=>{
  body=damageFlag(body,eol);
  body=after(body,'const char *hurt_msg = "";',' int ab_stat_quake_branch=0;',eol);
  for(const [branch,text]of [[1,'You nimbly dodge the blast!'],[2,'You are bashed by rubble!'],[3,'You are crushed between the floor and ceiling!']])
   body=after(body,'hurt_msg = "'+text+'";',' ab_stat_quake_branch='+branch+';',eol);
  body=before(body,'msg("You are severely crushed!%s", dam_text);','ab_stat_damage("crushed",damage,ab_stat_damage_shown)');
  return before(body,'msg("%s%s", hurt_msg, dam_text);','ab_stat_earthquake(ab_stat_quake_branch,damage,ab_stat_damage_shown)');
 }],
 ['uncurse_object',(body,eol)=>before(damageFlag(body,eol),'msg("%s%s", "There is a bang and a flash!", dam_text);','ab_stat_damage("uncursing",dam,ab_stat_damage_shown)')],
 ['effect_handler_RESTORE_STAT',body=>before(body,'msg("You feel less %s.", desc_stat(stat, false));','ab_stat_condition("restore",stat,0,0,false,MSG_GENERIC)')],
 ['effect_handler_DRAIN_STAT',(body,eol)=>{
  body=damageFlag(body,eol);
  body=before(body,'msg("You feel very %s for a moment, but the feeling passes.",','ab_stat_condition("sustained",stat,0,0,false,MSG_GENERIC)');
  return before(body,'msgt(MSG_DRAIN_STAT, "You feel very %s.%s",','ab_stat_condition("drain",stat,0,dam,ab_stat_damage_shown,MSG_DRAIN_STAT)');
 }],
 ['effect_handler_LOSE_RANDOM_STAT',body=>before(body,'msgt(MSG_DRAIN_STAT, "You feel very %s.", desc_stat(loss_stat, false));','ab_stat_condition("lose",loss_stat,0,0,false,MSG_DRAIN_STAT)')],
 ['effect_handler_GAIN_STAT',body=>before(body,'msg("You feel very %s!", desc_stat(stat, true));','ab_stat_condition("gain",stat,1,0,false,MSG_GENERIC)')],
 ['effect_handler_SUMMON',body=>before(body,'msgt(message_type, "You hear %s appear nearby.",','ab_stat_summon(count>1,message_type)')],
 ['effect_handler_PROBE',body=>before(body,'msg("%s has %d hit point%s.", m_name, mon->hp, (mon->hp == 1) ? "" : "s");','ab_stat_probe(m_name,mon->hp)')],
 ['player_over_exert',(body,eol)=>before(damageFlag(body,eol),'msg("You cry out in sudden pain!%s", dam_text);','ab_stat_damage("exertion",dam,ab_stat_damage_shown)')],
 ['project_player_drain_stats',body=>before(body,'msg("You\'re not as %s as you used to be...", act);','ab_stat_condition("project_drain",k,2,0,false,MSG_GENERIC)')],
 ['project_p',body=>before(body,'msg("You are hit by %s!", projections[typ].blind_desc);','ab_stat_projection(typ,true,MSG_GENERIC)')]
]);
export function integrate() {
 const review=JSON.parse(fs.readFileSync(path.join(root,'migration/residual-message-review.json'),'utf8'));
 const calls=review.groups.find(v=>v.role==='stat_effect_damage_probe').callsites;
 const grouped=new Map();for(const call of calls){let functions=grouped.get(call.source.file);if(!functions){functions=new Set();grouped.set(call.source.file,functions);}functions.add(call.source.function);}
 const snapshots=[];
 for(const [file,functions]of grouped) {
  const target=path.join(root,file),original=fs.readFileSync(target,'utf8');
  if(original.includes(begin))throw Error('Stat captures already integrated '+file);
  let source=original;const eol=source.includes('\r\n')?'\r\n':'\n';
  for(const name of functions) {
   const [start,stop]=functionSpan(source,name),native=source.slice(start,stop);
   snapshots.push({file,function:name,sha256:sha(Buffer.from(native)),native_base64:Buffer.from(native).toString('base64')});
   const changed=edits.get(name)(native,eol);
   if(stripStat(changed)!==native)throw Error('Native function bytes changed '+name);
   source=source.slice(0,start)+changed+source.slice(stop);
  }
  source=begin+'#include "web-stat-message.h"'+eol+end+source;
  if(stripStat(source)!==original)throw Error('Native file bytes changed '+file);
  // Read-after-edit CAS protects other owners' disjoint function updates.
  if(fs.readFileSync(target,'utf8')!==original)throw Error('Concurrent source change '+file);
  fs.writeFileSync(target,source,'utf8');
 }
 fs.writeFileSync(path.join(here,'producer-snapshots.json'),JSON.stringify({schema_version:1,
  upstream_commit:review.upstream_commit,status:'source_connected_unbuilt',snapshots},null,2)+'\n');
 console.log(JSON.stringify({files:grouped.size,functions:snapshots.length,producers:calls.length,native_byte_parity:true}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))integrate();
