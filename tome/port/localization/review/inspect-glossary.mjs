import fs from 'node:fs';
const rows=JSON.parse(fs.readFileSync(new URL('../localization-kernel-work/supplement-provenance.json',import.meta.url),'utf8'));
for(const row of rows)if(/Base |Randart|actor|Actor|Resolver|resolver|Tinker/.test(row.source)&&row.source.length<160)
 console.log(JSON.stringify({source:row.source,japanese:row.japanese,review_status:row.review_status}).replace(/[^\x00-\x7f]/g,character=>'\\u'+character.charCodeAt(0).toString(16).padStart(4,'0')));
