import fs from 'node:fs';
import readline from 'node:readline';
import { lexLua } from './lua-lexer.mjs';
const file='game/modules/tome/data/talents/uber/mag.lua';
const source=fs.readFileSync(process.argv[2]+'/'+file,'utf8');
const tokens=lexLua(source).tokens;
const ascii = value => JSON.stringify(value).replace(/[\u007f-\uffff]/g, character => '\\u'+character.charCodeAt(0).toString(16).padStart(4,'0'));
const reader=readline.createInterface({input:fs.createReadStream(process.argv[3]+'/text-candidates.jsonl'),crlfDelay:Infinity});
for await(const line of reader) {
  const row=JSON.parse(line);
  if(row.file!==file || !row.value.includes('Urh'))continue;
  const token=tokens.find(token=>token.type==='string' && token.start===row.offset);
  console.log(ascii({file,line:row.line,offset:row.offset,inventoryValue:row.value,freshValue:token?.value,freshToken:token,sourceExcerpt:source.slice(row.offset,row.endOffset),equal:token?.value===row.value}));
}
