/* Reconstruct native source: unwrap owned presentation expression annotations. */
import{reconstructDeath,unwrapLast}from'../death-data/native-parity.mjs';
export function reconstructInterface(source) {
 source=reconstructDeath(source);
 source=source.replace(/\/\* AB_GAME_STATIC_BEGIN \*\/[\s\S]*?\/\* AB_GAME_STATIC_END \*\//g,'');
 source=source.replace(/\r?\n#include "web-interface-text\.h" \/\* AB_INTERFACE_INCLUDE \*\//g,'');
 source=source.replace(/\r?\n#ifdef __EMSCRIPTEN__ \/\* AB_INTERFACE \*\/[\s\S]*?#endif \/\* AB_INTERFACE \*\/(?:\r?\n)?/g,'');
 source=source.replace(/\r?\n#ifdef __EMSCRIPTEN__ \/\* AB_INTERFACE_DIRECT \*\/[\s\S]*?#endif \/\* AB_INTERFACE_DIRECT \*\//g,'');
 source=source.replace(/^#(?:ifndef __EMSCRIPTEN__|endif) \/\* AB_INTERFACE_NATIVE \*\/\r?\n/gm,'');
 for(const[name,count]of[['AB_IF_TEXT(',4],['AB_IF_ROW_NUMBER(',7],['AB_IF_ROW_EMPTY(',2],['AB_IF_MENU_NUMBER(',8],['AB_IF_NAME_ROW(',5],['AB_IF_KNOWLEDGE_KILLS(',3]])
 for(let start=source.indexOf(name);start>=0;start=source.indexOf(name)) {
  const begin=start+name.length;let depth=1,quoted=null,last=begin,end=-1;const args=[];
  for(let i=begin;i<source.length;i++) {
   const c=source[i];if(quoted){if(c==='\\'){i++;continue;}if(c===quoted)quoted=null;continue;}
   if(c==='"'||c==="'"){quoted=c;continue;}
   if(c==='(')depth++;else if(c===')'){if(!--depth){args.push(source.slice(last,i));end=i+1;break;}}
   else if(c===','&&depth===1){args.push(source.slice(last,i));last=i+1;}
  }
  if(end<0||args.length!==count)throw Error('invalid owned wrapper');
  source=source.slice(0,start)+args.at(-1).trimStart()+source.slice(end);
 }
 for(const[name,count]of[['AB_IF_ITEM_PROMPT',2],['AB_IF_ITEM_HEADER',3],['AB_IF_ITEM_ACTION',4]])source=unwrapLast(source,name,count);
 return source;
}
