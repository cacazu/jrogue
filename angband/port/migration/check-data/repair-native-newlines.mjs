/* Repair only matched pre-existing line terminators. Never normalize a file.
 * Keep raw indices through deletion of this phase's reversible annotations;
 * use immutable phase source as evidence, with no baseline rewrite. */
import fs from'node:fs';import path from'node:path';import{fileURLToPath}from'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
function remove(view,pattern){const spans=[...view.text.matchAll(pattern)].map(m=>[m.index,m.index+m[0].length]);
 for(const[start,end]of spans.reverse()){view.text=view.text.slice(0,start)+view.text.slice(end);view.map.splice(start,end-start);}return view;}
function unwrap(view,name,count){for(let start=view.text.indexOf(name+'(');start>=0;start=view.text.indexOf(name+'(')){
 const begin=start+name.length+1;let depth=1,quote=null,last=begin,end=-1;const args=[];
 for(let i=begin;i<view.text.length;i++){const c=view.text[i];if(quote){if(c==='\\'){i++;continue;}if(c===quote)quote=null;continue;}if(c==='"'||c==="'"){quote=c;continue;}if(c==='(')depth++;else if(c===')'){if(!--depth){args.push([last,i]);end=i+1;break;}}else if(c===','&&depth===1){args.push([last,i]);last=i+1;}}
 if(end<0||args.length!==count)throw Error('bad owned wrapper '+name);
 let[a,b]=args.at(-1);while(a<b&&/\s/.test(view.text[a]))a++;
 view.text=view.text.slice(0,start)+view.text.slice(a,b)+view.text.slice(end);
 view.map.splice(b,end-b);view.map.splice(start,a-start);
 }return view;}
function ownView(text){const v={text,map:Array.from({length:text.length},(_,i)=>i)};
 remove(v,/\/\* AB_CHECK_BEGIN \*\/[\s\S]*?\/\* AB_CHECK_END \*\//g);
 remove(v,/\/\* AB_REPLAY_BEGIN \*\/[\s\S]*?\/\* AB_REPLAY_END \*\//g);
 remove(v,/\/\* AB_DOMAIN_BEGIN \*\/[\s\S]*?\/\* AB_DOMAIN_END \*\/(?:\r?\n)?/g);
 remove(v,/\/\* AB_DOMAIN_INLINE_BEGIN \*\/[\s\S]*?\/\* AB_DOMAIN_INLINE_END \*\//g);
 remove(v,/\r?\n#include "web-death-cause\.h" \/\* AB_DEATH_INCLUDE \*\//g);
 remove(v,/\r?\n#ifdef __EMSCRIPTEN__ \/\* AB_DEATH \*\/[\s\S]*?#endif \/\* AB_DEATH \*\//g);
 for(const[n,c]of[['AB_DC_AROUND',3],['AB_DC_FIXED',2],['AB_DC_TERRAIN',1],['AB_DC_FEATURE',1],['AB_DC_SCORE_LINE',5],['AB_DC_DATE',1],['AB_DC_STATUS',2]])unwrap(v,n,c);
 return v;}
function lines(v){const out=[];let start=0;for(let i=0;i<v.text.length;i++)if(v.text[i]==='\n'){
 const cr=i>start&&v.text[i-1]==='\r';out.push({body:v.text.slice(start,i-(cr?1:0)),ending:cr?'\r\n':'\n',at:v.map[i],cr:cr?v.map[i-1]:null});start=i+1;
 }if(start<v.text.length)out.push({body:v.text.slice(start),ending:'',at:null,cr:null});return out;}
function anchors(a,b){const am=new Map(),bm=new Map();for(const[x,m]of[[a,am],[b,bm]])for(let i=0;i<x.length;i++){const t=x[i].body;const old=m.get(t);m.set(t,old===undefined?i:null);}
 const pairs=[];for(let i=0;i<a.length;i++)if(am.get(a[i].body)===i&&bm.get(a[i].body)!=null)pairs.push([i,bm.get(a[i].body)]);
 const tails=[],tailIndex=[],previous=[];for(let i=0;i<pairs.length;i++){let lo=0,hi=tails.length;while(lo<hi){const mid=(lo+hi)>>1;if(tails[mid]<pairs[i][1])lo=mid+1;else hi=mid;}
 previous[i]=lo?tailIndex[lo-1]:-1;tails[lo]=pairs[i][1];tailIndex[lo]=i;}
 const chosen=[];for(let i=tailIndex.at(-1);i!==undefined&&i>=0;i=previous[i])chosen.push(pairs[i]);return chosen.reverse();}
function matchedLines(a,b){const points=[[-1,-1],...anchors(a,b),[a.length,b.length]],matches=[];
 for(let k=1;k<points.length;k++){let ai=points[k-1][0]+1,bi=points[k-1][1]+1,ae=points[k][0],be=points[k][1];
  while(ai<ae&&bi<be&&a[ai].body===b[bi].body){matches.push([ai++,bi++]);}
  const suffix=[];while(ai<ae&&bi<be&&a[ae-1].body===b[be-1].body)suffix.push([--ae,--be]);
  const n=ae-ai,m=be-bi;if(n&&m&&n*m<=1_000_000){const dp=Array.from({length:n+1},()=>new Uint32Array(m+1));
   for(let x=n-1;x>=0;x--)for(let y=m-1;y>=0;y--)dp[x][y]=a[ai+x].body===b[bi+y].body?dp[x+1][y+1]+1:Math.max(dp[x+1][y],dp[x][y+1]);
   let x=0,y=0;while(x<n&&y<m){if(a[ai+x].body===b[bi+y].body){matches.push([ai+x++,bi+y++]);}else if(dp[x+1][y]>=dp[x][y+1])x++;else y++;}
  }
  matches.push(...suffix.reverse());if(points[k][0]<a.length)matches.push(points[k]);
 }return matches;}
const death=JSON.parse(read('migration/death-data/source-manifest.json')),checks=JSON.parse(read('migration/check-data/source-manifest.json'));
const repairs=[];
for(const file of new Set([...death.source_files,...checks.source_files])){
 const original=read(file),baseline=read('tests/first-naming-build-snapshot/source/'+file),a=lines(ownView(original)),b=lines(ownView(baseline)),edits=[];
 for(const[x,y]of matchedLines(a,b)){const current=a[x],expected=b[y];if(!current.ending||!expected.ending||current.ending===expected.ending)continue;
  if(expected.ending==='\n')edits.push({start:current.cr,end:current.cr+1,text:''});else edits.push({start:current.at,end:current.at,text:'\r'});
 }
 let source=original;for(const e of edits.sort((a,b)=>b.start-a.start))source=source.slice(0,e.start)+e.text+source.slice(e.end);
 if(source!==original){if(read(file)!==original)throw Error('concurrent source change '+file);fs.writeFileSync(path.join(root,file),source);repairs.push({file,terminators:edits.length});}
}
console.log(JSON.stringify({repaired:repairs,total:repairs.reduce((n,r)=>n+r.terminators,0),baseline_unchanged:true,whole_file_normalization:false}));
