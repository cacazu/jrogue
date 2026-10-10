import fs from 'node:fs';
const input=JSON.parse(fs.readFileSync(new URL('./review-inputs.json',import.meta.url),'utf8'));
const start=Number(process.argv[2]??0),end=Number(process.argv[3]??115),context=process.argv.includes('--context');
for(const row of input.entries.slice(start,end)){
 if(process.argv.includes('--ja-ascii')){console.log(JSON.stringify({i:row.review_index,japanese:row.japanese}).replace(/[^\x00-\x7f]/g,character=>'\\u'+character.charCodeAt(0).toString(16).padStart(4,'0')));continue;}
 console.log(JSON.stringify({i:row.review_index,source:row.source,tag:row.tag,locations:row.source_locations.map(location=>`${location.file}:${location.line}`),prior_notes:row.notes}));
 if(context)for(const source of row.contexts)console.log(source.excerpt);
}
