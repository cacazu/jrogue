import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const dir = 'migration/recall-knowledge-data/';
const manifest = JSON.parse(read(dir + 'source-manifest.json'));
const baseline = fs.readFileSync(path.join(root, dir + 'baseline-ui-knowledge.c'));
const source = read('logic/ui-knowledge.c');
const helper = read('logic/web-recall-knowledge.c');
const header = read('logic/web-recall-knowledge.h');
const strip = value => value.replace(/\/\* AB_RECALL_KNOWLEDGE_BEGIN \*\/[\s\S]*?\/\* AB_RECALL_KNOWLEDGE_END \*\//g, '');

test('recall and metadata hooks reconstruct every prior C byte, with a negative fixture', () => {
  assert.equal(createHash('sha256').update(baseline).digest('hex'), manifest.baseline_sha256);
  assert.deepEqual(Buffer.from(strip(source)), baseline);
  // Changing a native command/navigation boundary must fail the same proof.
  assert.notDeepEqual(Buffer.from(strip(source.replace('i + 20 < n', 'i + 21 < n'))), baseline);
});

test('reviewed source IDs have exact EN/JA/schema placeholders and pinned provenance', () => {
  const en = JSON.parse(read(dir + 'en.json'));
  const ja = JSON.parse(read(dir + 'ja.json'));
  const schema = JSON.parse(read(dir + 'schema.json')).entries;
  const ids = manifest.entries.map(entry => entry.id).sort();
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(Object.keys(en).sort(), ids);
  assert.deepEqual(Object.keys(ja).sort(), ids);
  assert.deepEqual(Object.keys(schema).sort(), ids);
  assert.equal(manifest.upstream_commit, 'f3082213b73f3e463e3d0d60bff4b00462beae6e');
  for (const entry of manifest.entries) {
    const names = entry.parameters.map(parameter => parameter.name).sort();
    for (const text of [en[entry.id], ja[entry.id]]) {
      assert.equal(typeof text, 'string');
      assert.ok(text.length > 0 && !text.includes('\0') && !text.includes('\uFFFD'));
      assert.deepEqual([...new Set([...text.matchAll(/\{([a-z][a-z0-9_]*)\}/g)].map(match => match[1]))].sort(), names);
    }
    assert.deepEqual(schema[entry.id].parameters, entry.parameters);
    assert.ok(entry.source.file && entry.source.baseline_line > 0);
  }
});

test('recall source content is taken from the original age, with native repetitions and window', () => {
  assert.match(source, /uint16_t count = message_count\(i \+ j\);[\s\S]*?ab_rk_recall_row\(i\+j,hgt-3-j,count,attr,q\)/);
  assert.match(source, /AB_RK_HEADER\(i,i\+j-1,n,q,/);
  assert.match(helper, /ab_message_recall_emit\(age,context,widget\)/);
  assert.match(helper, /row_widget\(widget,sizeof\(widget\),age,"name"\)/);
  assert.match(helper, /if\(count>1\)/);
  assert.match(source, /char shower\[80\] = "";/);
  assert.match(source, /for \(z = i \+ 1; z < n; z\+\+\)/);
  assert.match(source, /AB_RK_FIND\(z,shower,[\s\S]*?my_stristr\(message_str\(z\), shower\)/);
});

test('localized search augments the native match without rendered-English identification', () => {
  assert.match(header, /AB_RK_FIND\(a,q,call\) ab_rk_recall_find\(\(a\),\(q\),\(call\)!=NULL\)/);
  assert.match(helper, /if\(native_match\)return true;/);
  assert.match(helper, /localized=ab_message_recall_text\(age\)/);
  assert.match(helper, /my_stristr\(localized,query\)/);
  assert.doesNotMatch(helper, /message_str\(|message_add\(|strcmp\([^\n]*(?:shape|alive|dead)|strstr\(/);
  assert.match(helper, /ui\.recall\.row\.legacy_unbound/);
});

test('knowledge statuses select IDs in the original native branches and retain the selected names', () => {
  assert.match(source, /if \(!race->rarity\) \{[\s\S]*?AB_RK_TOKEN\(oid,"ui\.knowledge\.monster\.status\.shape",/);
  assert.match(source, /\(race->max_num == 0\)\?[\s\S]*?status\.dead[\s\S]*?:[\s\S]*?status\.alive/);
  assert.match(source, /AB_RK_UNIQUE_SUMMARY\(n,kills,/);
  assert.match(source, /AB_RK_GROUP_SUMMARY\(kills,tkills,/);
  assert.match(helper, /row_widget\(widget,sizeof\(widget\),index,"kills"\)/);
  assert.match(helper, /ab_if_row_text\("knowledge-items",index,ab_naming_monster_name_id\(race\)/);
});

test('artifact seed is bound only in its original option branch and owned across its panel', () => {
  assert.match(source, /if \(OPT\(player, birth_randarts\)\) \{[\s\S]*?ab_rk_title_prepare\(title,"ui\.knowledge\.title\.artifacts\.seed",seed_randart\)/);
  assert.match(source, /strnfmt\(title, sizeof\(title\), "artifacts"\);[\s\S]*?ab_rk_title_prepare\(title,"ui\.knowledge\.title\.artifacts",0\)/);
  assert.match(helper, /if\(native==pending_title_address\)\*out=pending_title;/);
  assert.match(helper, /memset\(&pending_title,0,sizeof\(pending_title\)\);pending_title_address=NULL;/);
  assert.doesNotMatch(helper, /OPT\(|get_lore\(|player_knows|artifact_is_known|randint|rand_range|Rand_|monster_race_track/);
});

test('presentation scopes commit before wait and release on the exact native leave', () => {
  assert.match(source, /ab_rk_recall_end\(shower\);[\s\S]*?\/\* Get a command \*\/[\s\S]*?ke = inkey_ex\(\)/);
  assert.match(source, /ab_rk_recall_leave\(\);[\s\S]*?\/\* Load screen \*\/[\s\S]*?screen_load\(\)/);
  assert.match(helper, /ab_ui_scope_begin\("message-recall",true\)/);
  assert.match(helper, /ab_rk_recall_leave\(void\) \{ ab_ui_reset\("message-recall"\); \}/);
  assert.match(helper, /AB_UI_OPAQUE\("query","verbatim_user_text",query\)/);
});
