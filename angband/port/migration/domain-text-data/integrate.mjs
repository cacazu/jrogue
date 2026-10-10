// SPDX-License-Identifier: GPL-2.0-only
// Add only marked, original-branch captures; retain every native source byte.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const directory = path.dirname(fileURLToPath(import.meta.url));
const logic = path.resolve(directory, '../../logic');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const begin = '/* AB_DOMAIN_INLINE_BEGIN */';
const end = '/* AB_DOMAIN_INLINE_END */';
const inline = text => begin + text + end;
export const block = text => '/* AB_DOMAIN_BEGIN */\n' + text + '\n/* AB_DOMAIN_END */\n';
export function stripDomain(source) {
  return source.replace(/\/\* AB_DOMAIN_BEGIN \*\/[\s\S]*?\/\* AB_DOMAIN_END \*\/\r?\n/g, '')
    .replace(/\/\* AB_DOMAIN_INLINE_BEGIN \*\/[\s\S]*?\/\* AB_DOMAIN_INLINE_END \*\//g, '');
}
export function sourceInsertions(source) {
  const expression = /\/\* AB_DOMAIN_BEGIN \*\/[\s\S]*?\/\* AB_DOMAIN_END \*\/\r?\n|\/\* AB_DOMAIN_INLINE_BEGIN \*\/[\s\S]*?\/\* AB_DOMAIN_INLINE_END \*\//g;
  const insertions = []; let removed = 0;
  for (const match of source.matchAll(expression)) {
    insertions.push({offset_chars:match.index-removed,source:match[0]});
    removed += match[0].length;
  }
  return insertions;
}
function once(source, needle, replacement) {
  const at = source.indexOf(needle);
  if (at < 0 || source.indexOf(needle, at + needle.length) >= 0) throw Error('Unique native anchor required: ' + needle);
  return source.slice(0, at) + replacement + source.slice(at + needle.length);
}
function functionSpan(source, signature) {
  const start = source.indexOf(signature);
  if (start < 0) throw Error('Missing original function: ' + signature);
  const open = source.indexOf('{', start);
  let depth = 0, mode = '', escaped = false;
  for (let at = open; at < source.length; at++) {
    const ch = source[at], next = source[at + 1];
    if (mode === '//') {if (ch === '\n') mode = ''; continue;}
    if (mode === '/*') {if (ch === '*' && next === '/') {mode = ''; at++;} continue;}
    if (mode === '"' || mode === "'") {if (escaped) escaped = false; else if (ch === '\\') escaped = true; else if (ch === mode) mode = ''; continue;}
    if (ch === '/' && (next === '/' || next === '*')) {mode = ch + next; at++; continue;}
    if (ch === '"' || ch === "'") {mode = ch; continue;}
    if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return [start, at + 1];
  }
  throw Error('Unclosed native function: ' + signature);
}
export function scoped(source, signature, edit) {
  const [start, stop] = functionSpan(source, signature);
  return source.slice(0, start) + edit(source.slice(start, stop)) + source.slice(stop);
}
export function beforeCall(source, call, capture) {return once(source, call, inline('AB_DOMAIN_CAPTURE(' + capture + '), ') + call);}
function after(source, needle, text) {return once(source, needle, needle + block('#ifdef __EMSCRIPTEN__\n' + text + '\n#endif'));}
const edits = new Map();
edits.set('init.c', source => scoped(source, 'void init_arrays(void)', body => {
  const at = body.lastIndexOf('}');
  return body.slice(0, at) + block('#ifdef __EMSCRIPTEN__\n if(!ab_domain_register_messages()) quit("Invalid reviewed browser domain message bindings");\n#endif') + body.slice(at);
}));
edits.set('obj-util.c', source => scoped(source, 'void print_custom_message(', body => {
  body = after(body, 'if (!string) return;', ' struct ab_domain_custom_capture ab_domain_capture;\n ab_domain_custom_begin(&ab_domain_capture,string,obj != NULL,obj ? obj->number : 0,msg_type);');
  body = after(body, 'ODESC_PREFIX | ODESC_BASE, p);', ' ab_domain_custom_snapshot(&ab_domain_capture,buf,false);');
  body = after(body, 'object_kind_name(&buf[end], 1024 - end, obj->kind, true);', ' ab_domain_custom_snapshot(&ab_domain_capture,&buf[end],true);');
  const hands = 'strnfcat(buf, 1024, &end, "hands");';
  let first = true;
  body = body.replaceAll(hands, () => {const isKind = !first; first = false; return hands + block('#ifdef __EMSCRIPTEN__\n ab_domain_custom_hands(&ab_domain_capture,' + isKind + ');\n#endif');});
  if (first) throw Error('Missing hands branches');
  return beforeCall(body, 'msgt(msg_type, "%s", buf);', 'ab_domain_custom_finish(&ab_domain_capture)');
}));
edits.set('cmd-obj.c', source => {
  for (const field of ['effect_msg', 'vis_msg']) source = beforeCall(source, 'msgt(snd, "%s", obj->kind->' + field + ');', 'ab_domain_message_pointer(obj->kind->' + field + ',snd)');
  return source;
});
edits.set('trap.c', source => scoped(source, 'void hit_trap(', body => {
  for (const field of ['msg','msg_good','msg_bad','msg_xtra']) body = beforeCall(body, 'msg("%s", trap->kind->' + field + ');', 'ab_domain_message_pointer(trap->kind->' + field + ',-1)');
  return body;
}));
edits.set('cmd-cave.c', source => {
  for (const field of ['run_msg', 'walk_msg']) source = once(source, 'get_check(feat->' + field + ')', 'get_check(' + inline('AB_DOMAIN_CHECK(') + 'feat->' + field + inline(')') + ')');
  return source;
});
edits.set('player-util.c', source => scoped(source, 'void player_take_terrain_damage(', body => {
  body = after(body, 'char dam_text[32] = "";', ' bool ab_domain_show_damage=false;');
  body = after(body, 'if (dam_reduced > 0 && OPT(p, show_damage)) {', ' ab_domain_show_damage=true;');
  return once(body, 'msg("%s%s", square_feat(cave, grid)->hurt_msg, dam_text);', 'msg("%s%s", ' + inline('AB_DOMAIN_HURT(') + 'square_feat(cave, grid)->hurt_msg' + inline(',dam_reduced,ab_domain_show_damage)') + ', dam_text);');
}));
edits.set('obj-info.c', source => {
  source = scoped(source, 'static void describe_flavor_text(', body => {
    for (const [field, kind, index, format] of [
      ['artifact', 'ARTIFACT', 'aidx', '%s\\n\\n'], ['kind', 'OBJECT', 'kidx', '%s'], ['ego', 'EGO', 'eidx', '%s\\n\\n'],
    ]) body = beforeCall(body, 'textblock_append(tb, "' + format + '", obj->' + field + '->text);', 'ab_domain_info_selected(AB_DOMAIN_' + kind + ',obj->' + field + '->' + index + ',AB_DOMAIN_DESCRIPTION,0)');
    return body;
  });
  source = scoped(source, 'static bool describe_effect(', body => beforeCall(body, 'textblock_append(tb, "When activated, it ");', 'ab_domain_info_selected(AB_DOMAIN_ACTIVATION,obj->activation->index,AB_DOMAIN_DESCRIPTION,0)'));
  source = scoped(source, 'static bool describe_curses(', body => beforeCall(body, 'textblock_append(tb, "It ");', 'ab_domain_curse_info(i,c[i].power == 100)'));
  source = scoped(source, 'textblock *object_info(const ', body => once(body, 'return object_info_out(obj, mode);', 'return ' + inline('(AB_DOMAIN_CAPTURE(ab_domain_info_begin("object-info")), AB_DOMAIN_RESULT(') + 'object_info_out(obj, mode)' + inline('))') + ';'));
  source = scoped(source, 'textblock *object_info_ego(', body => {
    body = after(body, 'textblock *result;', ' ab_domain_info_begin("object-info");');
    return body.replaceAll('return result;', 'return ' + inline('AB_DOMAIN_RESULT(') + 'result' + inline(')') + ';');
  });
  return source;
});
edits.set('ui-knowledge.c', source => {
  for (const [signature, context, kind, nameField] of [
    ['static void feat_lore(', 'feature-info', 'TERRAIN', 'NAME'],
    ['static void trap_lore(', 'trap-info', 'TRAP', 'SHORT_NAME'],
  ]) source = scoped(source, signature, body => {
    body = after(body, 'textblock *tb = textblock_new();', ' ab_domain_info_begin("' + context + '");\n ab_domain_info_selected(AB_DOMAIN_' + kind + ',oid,AB_DOMAIN_' + nameField + ',0);\n ab_domain_info_selected(AB_DOMAIN_' + kind + ',oid,AB_DOMAIN_DESCRIPTION,0);');
    body = beforeCall(body, 'textui_textblock_show(tb, SCREEN_REGION, NULL);', 'ab_domain_info_commit()');
    return after(body, 'textui_textblock_show(tb, SCREEN_REGION, NULL);', ' ab_domain_info_close();ab_ui_reset("' + context + '");');
  });
  return source;
});
export function integrateEdits(selectedEdits=edits,evidenceFile='integration-evidence.json',baselineDirectory='source-baseline') {
  const planned = [];
  for (const [file, edit] of selectedEdits) {
    const filename = path.join(logic, file), original = fs.readFileSync(filename, 'utf8');
    if (original.includes('AB_DOMAIN_BEGIN') || original.includes('AB_DOMAIN_INLINE_BEGIN')) throw Error('Domain integration already applied: ' + file);
    let source = edit(original);
    const match = source.match(/^#include [^\r\n]+[\r\n]+/m);
    if (!match) throw Error('No source include anchor: ' + file);
    source = once(source, match[0], block('#include "web-domain-text.h"') + match[0]);
    if (stripDomain(source) !== original) throw Error('Native byte reconstruction failed: ' + file);
    planned.push({file, filename, original, source});
  }
  for (const item of planned) if (fs.readFileSync(item.filename, 'utf8') !== item.original) throw Error('Source changed during integration: ' + item.file);
  const baselines = path.join(directory, baselineDirectory); fs.mkdirSync(baselines, {recursive:true});
  for (const item of planned) {fs.writeFileSync(path.join(baselines,item.file),item.original); fs.writeFileSync(item.filename,item.source);}
  const evidence = {schema_version:1,source_commit:'f3082213b73f3e463e3d0d60bff4b00462beae6e',files:planned.map(item=>({file:item.file,baseline_sha256:sha(item.original),modified_sha256:sha(item.source),native_reconstruction_exact:true,insertions:sourceInsertions(item.source)}))};
  fs.writeFileSync(path.join(directory,evidenceFile),JSON.stringify(evidence,null,2)+'\n');
  console.log(JSON.stringify({modifiedFiles:planned.length,exactNativeReconstruction:true}));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) integrateEdits();
