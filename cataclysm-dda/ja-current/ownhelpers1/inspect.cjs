const fs = require('node:fs');
const path = require('node:path');
const input = JSON.parse(fs.readFileSync(path.join(__dirname, '../../catalog-reconcile/output/current-source-gaps-1.json'), 'utf8'));
const root = 'C:/Users/kit/gameme/jnethack/jrouge/cataclysm-dda/upstream/Cataclysm-DDA-7b2efa5cea38e4d4d97dd0e63b28b9148623da59';
const blocks = fs.readFileSync(root + '/lang/po/ja.po', 'utf8').split(/\r?\n\r?\n/);
function parse(block) {
  const result = {}; let field;
  for (const line of block.split(/\r?\n/)) {
    const match = /^(msgctxt|msgid_plural|msgid|msgstr(?:\[\d+\])?) (".*")$/.exec(line);
    if (match) { field = match[1]; result[field] = JSON.parse(match[2]); }
    else if (field && /^"/.test(line)) result[field] += JSON.parse(line);
  }
  return result;
}
const terms = new Map(blocks.map(parse).filter(p=>p.msgid && (p.msgstr||p['msgstr[0]'])).map(p => [(p.msgctxt||'')+'\0'+p.msgid,p.msgstr||p['msgstr[0]']]));
for (const r of input.records) {
  const old = r.singular.replace(/ \(pair\)$/, '');
  const ja = terms.get(r.context+'\0'+old);
  if (ja) console.log(`${r.index} | ${old} => ${ja}`);
}
