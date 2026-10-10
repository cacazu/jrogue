/** GPL-2.0 section 2(a) notice for modified upstream source files only.
 * The date is pinned to this adaptation, never inferred from the wall clock.
 */
import {createHash} from 'node:crypto';
const sha=s=>createHash('sha256').update(s).digest('hex');
export const modificationNoticeDate='2026-10-02';
export const modificationNoticeText='Modified 2026-10-02 for the DRL browser presentation/semantic text adaptation; original gameplay/domain names retained.';
export function curateModificationNotices({file,patches}){
 const records=[];
 for(const f of [...new Set(patches.map(p=>p.file))].sort()){
  if(!f.endsWith('.pas')&&!f.endsWith('.lua'))throw Error(`Unreviewed modification notice syntax: ${f}`);
  const source=file(f),selected=patches.filter(p=>p.file===f).sort((a,b)=>b.start-a.start);
  let transformed=source;
  for(const p of selected){if(source.slice(p.start,p.end)!==p.original)throw Error(`Modification notice source guard changed: ${f}`);transformed=transformed.slice(0,p.start)+p.replacement+transformed.slice(p.end);}
  if(transformed===source)continue;
  if(source.includes(modificationNoticeText)||transformed.includes(modificationNoticeText))throw Error(`Duplicate dated modification notice: ${f}`);
  const start=source.charCodeAt(0)===0xfeff?1:0,newline=source.includes('\r\n')?'\r\n':'\n';
  if(source.slice(start).startsWith('#!'))throw Error(`Modification notice needs reviewed shebang placement: ${f}`);
  const language=f.endsWith('.pas')?'pascal':'lua';
  const replacement=(language==='pascal'?`{ ${modificationNoticeText} }`:`-- ${modificationNoticeText}`)+newline;
  patches.push({file:f,start,end:start,original:'',replacement,id:null,kind:'dated-modification-notice'});
  records.push({file:f,language,start,original:'',replacement,sourceSha256:sha(source),sourceHeaderPreserved:true,date:modificationNoticeDate});
 }
 return {schema:1,license:'GPL-2.0',requirement:'section 2(a)',date:modificationNoticeDate,notice:modificationNoticeText,records,modifiedSourceFiles:records.length,pristineUpstreamChanged:false};
}
