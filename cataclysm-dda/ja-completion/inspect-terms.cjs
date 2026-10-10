const fs = require('node:fs');
const audit = JSON.parse(fs.readFileSync('inventory-tools/output/ja-missing.json', 'utf8'));
const blocks = fs.readFileSync(audit.source, 'utf8').split(/\r?\n\r?\n/);
for (const term of ['Great Grey', 'Scythean', 'Benzete', 'air filtration system', 'blood analysis', 'radiation scrubber', 'otherworlds', 'otherlands']) {
  let count = 0;
  console.log('TERM ' + term);
  for (const block of blocks) {
    if (block.toLowerCase().includes(term.toLowerCase()) && /msgstr(?:\[0\])? "(?:[^"\n]|"\r?\n"[^"\n])/.test(block)) {
      console.log(block);
      if (++count === 3) break;
    }
  }
}
