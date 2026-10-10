'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { printfSignature, angleTags, checkCatalog } = require('./checks.cjs');
assert.deepEqual(printfSignature('%s %d').args, printfSignature('%2$d %1$s').args);
assert.notDeepEqual(printfSignature('%s %d').args, printfSignature('%d %s').args);
assert.notDeepEqual(printfSignature('%d').args, printfSignature('%u').args);
assert.notDeepEqual(printfSignature('%ld').args, printfSignature('%d').args);
assert.deepEqual(printfSignature("%1$'s").args, [[1, 'string']]);
assert.deepEqual(printfSignature('%*.*f').args, [[1, 'signed:int'], [2, 'signed:int'], [3, 'double']]);
assert.deepEqual(printfSignature('%3$*1$.*2$f').args, printfSignature('%*.*f').args);
assert.deepEqual(printfSignature('100%%').args, []);
assert.deepEqual(angleTags('<npcname> <npcname> <color_red>x</color>'),
  ['/color', 'color_red', 'npcname', 'npcname']);
const dir = __dirname;
const patch = JSON.parse(fs.readFileSync(path.join(dir, 'ja-reviewed-patches.json'), 'utf8'));
const auditDir = path.resolve(dir, '..', 'inventory-tools', 'output');
const audits = {
  missing: JSON.parse(fs.readFileSync(path.join(auditDir, 'ja-missing.json'), 'utf8')),
  rejected: JSON.parse(fs.readFileSync(path.join(auditDir, 'ja-rejected-placeholders.json'), 'utf8'))
};
checkCatalog(patch, audits);
const mutate = operation => {
  const copy = structuredClone(patch);
  operation(copy);
  assert.throws(() => checkCatalog(copy, audits));
};
mutate(p => p.records.pop());
mutate(p => p.records.push(p.records[0]));
mutate(p => p.records[0].singular = 'changed');
mutate(p => p.records.find(r => r.semanticId === 'debug.time.until_noon').translations['0'] = '正午まで残り<global_val:TIME_TILL_SUNSET>分');
mutate(p => p.records.find(r => r.semanticId === 'activity.efile.failure').translations['0'] = '%dデバイスの%sに失敗しました。');
mutate(p => p.records.find(r => r.semanticId === 'xedra.dialogue.domination.blank').translations['0'] = '*視線は虚ろです。');
mutate(p => p.records.find(r => r.semanticId === 'mind_over_matter.help.psionic_probability').translations['0'] += '%s');
mutate(p => p.runtimeConnected = true);
console.log('Validator tests passed: typed args, positional reordering, star parameters, repeated tags, and eight invalid-patch mutations rejected.');
