import fs from 'node:fs';
import readline from 'node:readline';
let found=0;
for await(const line of readline.createInterface({input:fs.createReadStream(new URL('../inventory-work/inventory-output/upstream-ja-catalogue.jsonl',import.meta.url),'utf8'),crlfDelay:Infinity})){
 const row=JSON.parse(line);
 if(/sher.tul fortress/i.test(row.english)&&row.translated){
  console.log(JSON.stringify({source:row.english.slice(0,180),japanese:row.translated.slice(0,180),tag:row.tag}));
  if(++found>=6)break;
 }
}
