/* Strip only this phase's source annotations; native calls remain unchanged. */
import{stripChecks}from'../check-data/native-parity.mjs';
import{stripResidual}from'../ui-residual-message-data/native-parity.mjs';
export function unwrapLast(source,name,count){
 for(let start=source.indexOf(name+'(');start>=0;start=source.indexOf(name+'(')){
  const begin=start+name.length+1;let depth=1,quote=null,last=begin,end=-1;const args=[];
  for(let i=begin;i<source.length;i++){const c=source[i];if(quote){if(c==='\\'){i++;continue;}if(c===quote)quote=null;continue;}if(c==='"'||c==="'"){quote=c;continue;}if(c==='(')depth++;else if(c===')'){if(!--depth){args.push(source.slice(last,i));end=i+1;break;}}else if(c===','&&depth===1){args.push(source.slice(last,i));last=i+1;}}
  if(end<0||args.length!==count)throw Error('invalid source wrapper '+name);
  source=source.slice(0,start)+args.at(-1).trimStart()+source.slice(end);
 }
 return source;
}
export function reconstructDeath(source){
 source=stripChecks(stripResidual(source));
 source=source.replace(/\/\* AB_REPLAY_BEGIN \*\/[\s\S]*?\/\* AB_REPLAY_END \*\//g,'');
 source=source.replace(/\r?\n#include "web-death-cause\.h" \/\* AB_DEATH_INCLUDE \*\//g,'');
 source=source.replace(/\r?\n#ifdef __EMSCRIPTEN__ \/\* AB_DEATH \*\/[\s\S]*?#endif \/\* AB_DEATH \*\//g,'');
 for(const[name,count]of[['AB_DC_AROUND',3],['AB_DC_FIXED',2],['AB_DC_TERRAIN',1],['AB_DC_FEATURE',1],['AB_DC_SCORE_LINE',5],['AB_DC_DATE',1],['AB_DC_STATUS',2]])source=unwrapLast(source,name,count);
 return source;
}
