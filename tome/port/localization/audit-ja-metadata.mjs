// GPL-3.0-or-later. Streaming verification against unchanged original call lines.
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import {lexLua} from './lua-lexer.mjs';
const option=name=>{const i=process.argv.indexOf(name);return i<0?undefined:process.argv[i+1];};
const root=option('--source-root');
if (!root) throw new Error('--source-root is required');
const byFile=new Map();
let sampledRss=process.memoryUsage().rss;
const sample=()=>{sampledRss=Math.max(sampledRss,process.memoryUsage().rss);};
const catalogue=readline.createInterface({input:fs.createReadStream(new URL('../inventory-work/inventory-output/upstream-ja-catalogue.jsonl',import.meta.url),'utf8'),crlfDelay:Infinity});
for await(const line of catalogue){
 const row=JSON.parse(line), rows=byFile.get(row.file)??new Map(), list=rows.get(row.line)??[];
 list.push({args:row.argsOrderTokens,special:row.specialTokens});rows.set(row.line,list);byFile.set(row.file,rows);
 if(rows.size%1000===0)sample();
}
const result={schema_version:1,method:'stream_raw_original_registration_lines_lex_each_line_no_source_execution',registrations:0,raw_calls_verified:0,multiline_or_unmatched:[],metadata_mismatches:[],fourth_argument_present:0,fifth_argument_present:0,raw_argument_orders_nonempty:0,raw_special_arguments_nonempty:0,printf_types:{},memory:{sampled_peak_rss_bytes:0},source_root:root,files:[]};
const calls=tokens=>{
 const found=[];
 for(let i=0;i<tokens.length;i++)if(tokens[i].type==='identifier'&&tokens[i].value==='t'&&tokens[i+1]?.value==='('){
  let level=0,start=i+2,end=null;const args=[];
  for(let j=start;j<tokens.length;j++){
   const token=tokens[j];if(token.type==='string')continue;
   if(['(','{','['].includes(token.value))level++;
   else if([')',']','}'].includes(token.value)){if(token.value===')'&&level===0){args.push(tokens.slice(start,j));end=j;break;}level--;}
   else if(token.value===','&&level===0){args.push(tokens.slice(start,j));start=j+1;}
  }
  if(end!==null)found.push(args);
 }
 return found;
};
const signature=tokens=>JSON.stringify((tokens??[]).map(({type,value})=>({type,value})));
for(const[file,rows]of byFile){
 let lineNumber=0,verified=0,pending=null;
 const source=readline.createInterface({input:fs.createReadStream(path.join(root,file),'utf8'),crlfDelay:Infinity});
 for await(const line of source){lineNumber++;const expected=rows.get(lineNumber);
  if(expected && !pending)pending={line:lineNumber,expected,source:line};else if(pending)pending.source+='\n'+line;else continue;
  if(pending.source.length>262144)throw new Error(`Unclosed registration exceeded bounded audit buffer: ${file}:${pending.line}`);
  const candidates=calls(lexLua(pending.source).tokens);
  if(candidates.length<pending.expected.length)continue;
  for(let index=0;index<pending.expected.length;index++){const row=pending.expected[index],raw=candidates[index];result.registrations++;
   result.raw_calls_verified++;verified++;
   if(raw[3])result.fourth_argument_present++;if(raw[4])result.fifth_argument_present++;
   if(raw[3]?.some(token=>token.type==='number'))result.raw_argument_orders_nonempty++;
   if(raw[4]?.length&&!(raw[4].length===1&&raw[4][0].value==='nil'))result.raw_special_arguments_nonempty++;
   if(signature(raw[3])!==signature(row.args)||signature(raw[4])!==signature(row.special))result.metadata_mismatches.push({file,line:pending.line,raw_fourth:raw[3],raw_fifth:raw[4],extracted_args:row.args,extracted_special:row.special});
  }pending=null;sample();
 }
 if(pending)result.multiline_or_unmatched.push({file,line:pending.line});
 result.files.push({file,registrations:[...rows.values()].reduce((count,list)=>count+list.length,0),raw_calls_verified:verified});
}
result.memory.sampled_peak_rss_bytes=sampledRss;
result.status=result.multiline_or_unmatched.length||result.metadata_mismatches.length?'review_required':'all_original_registration_metadata_preserved';
const out=option('--output');if(out)fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({...result,multiline_or_unmatched:result.multiline_or_unmatched.slice(0,10),metadata_mismatches:result.metadata_mismatches.slice(0,10)},null,2));
