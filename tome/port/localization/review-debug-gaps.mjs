import fs from 'node:fs';
const report=JSON.parse(fs.readFileSync(new URL('../inventory-work/inventory-output/ja-gaps.json',import.meta.url),'utf8'));
console.log(JSON.stringify(report.gaps.filter(row=>row.file==='game/modules/tome/mod/dialogs/debug/DebugMain.lua').map(row=>({line:row.line,source:row.english,hook:row.sourceLocalization?.hook,tag:row.sourceLocalization?.tag})),null,2));
console.log(JSON.stringify(process.memoryUsage()));
