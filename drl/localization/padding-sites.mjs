/** Reviewed source-call padding migration; no rendered-string matching. */
import {createHash} from 'node:crypto';
import {scanSource} from '../port/tools/inventory-texts.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
const profiles={
 'src/dfhof.pas':{sha256:'3808caeaaa8d530cd4ec8b66d2b56a2b588836a7326b00da7e1537c2794a667d',calls:50},
 'src/drlmainmenuview.pas':{sha256:'ede8d5958854ab375e117086cccb35c7d3bc6d4bbbc0830b8182b53ec5a5066e',calls:4},
 'src/drlmoreview.pas':{sha256:'e2b31d029fb121a3308a7f4cb72ad8ec5251cc79dabdaf3adc5b39d0b5b0556b',calls:4},
 'src/drlplayerview.pas':{sha256:'e24c72e29c5ea701af06bfb2c96bf43f52b3b2b5457b0191535010de2d6789e6',calls:22}
};
const retained=[
 ['src/dfhof.pas',393,"Padded('',25)",'empty-layout'],
 ...[447,506,555].map(line=>['src/dfhof.pas',line,'Padded(IntToStr(cn),7)','ascii-numeric']),
 ['src/dfhof.pas',687,'Padded(IntToStr(iScore),8)','ascii-numeric'],
 ['src/dfhof.pas',693,'Padded(IntToStr(iLevel),3)','ascii-numeric'],
 ['src/dfhof.pas',698,'Padded(iDLev,4)','ascii-numeric-depth-branch'],
 ...[[567,'iTot'],[568,'iTor'],[569,'iFeet']].map(([line,n])=>['src/drlplayerview.pas',line,`Padded(ResistStr(${n}),8)`,'ascii-numeric'])
];
const alreadySafe=[
 ['src/dfhof.pas',694,'Padded(iKill,34)'],
 ['src/drlmoreview.pas',116,'Padded(ResNames[iRes],7)'],
 ['src/drlmoreview.pas',117,'Padded(ResNames[iRes],7)'],
 ['src/drlplayerview.pas',567,'Padded(ResNames[iRes],7)']
];
const embeddedCounts={'view.report.difficulty-achievement-row':4,'view.report.badge-tier-summary':1};
export function paddingCalls(source){
 const ts=scanSource(source,'pascal').tokens,rows=[];
 for(let i=0;i<ts.length;i++)if(['padded','vtig_padded'].includes(ts[i].raw.toLowerCase())&&ts[i+1]?.raw==='('){
  let j=i+1,depth=0;
  for(;j<ts.length;j++){if(ts[j].raw==='(')depth++;else if(ts[j].raw===')'&&--depth===0)break;}
  if(j===ts.length)throw Error('Unclosed reviewed padding call');
  rows.push({line:ts[i].line,start:ts[i].start,end:ts[j].end,callee:ts[i].raw,original:source.slice(ts[i].start,ts[j].end)});
 }
 return rows;
}
function project(source,patches){
 let output=source;
 for(const p of [...patches].sort((a,b)=>b.start-a.start)){if(source.slice(p.start,p.end)!==p.original)throw Error('Padding projection source guard');output=output.slice(0,p.start)+p.replacement+output.slice(p.end);}
 return output;
}
export function curatePaddingSites({file,patches}){
 const records=[],sources={},embedded=new Map();let added=0;
 for(const [f,profile]of Object.entries(profiles)){
  const source=file(f);if(sha(source)!==profile.sha256)throw Error(`Padding source hash changed: ${f}`);
  const calls=paddingCalls(source);if(calls.length!==profile.calls)throw Error(`Padding inventory count changed: ${f}`);
  sources[f]=profile;
  for(const c of calls){
   const keep=retained.find(([rf,line,text])=>rf===f&&line===c.line&&text===c.original);
   const safe=alreadySafe.find(([rf,line,text])=>rf===f&&line===c.line&&text===c.original);
   let disposition,role;
   if(keep){disposition='retained-original-ascii-padding';role=keep[3];}
   else if(safe){
    disposition='already-reviewed-column-safe-projection';role='translated-presentation';
    const parent=patches.filter(p=>p.file===f&&p.start<=c.start&&p.end>=c.end);
    if(parent.length!==1||paddingCalls(parent[0].replacement).some(r=>r.callee.toLowerCase()==='padded'))throw Error(`Existing padding projection guard: ${f}:${c.line}`);
   }else{
    role=f==='src/dfhof.pas'&&[688,700].includes(c.line)?'verbatim-identity-display':'translated-or-mixed-presentation';
    const overlaps=patches.filter(p=>p.file===f&&p.start<c.start+6&&p.end>c.start);
    if(overlaps.length){
     const parent=overlaps[0];
     if(overlaps.length!==1||!Object.hasOwn(embeddedCounts,parent.id)||parent.start>c.start||parent.end<c.end)throw Error(`Unreviewed padding overlap: ${f}:${c.line}`);
     embedded.set(parent.id,parent);disposition='inside-reviewed-semantic-expression';
    }else{
     patches.push({file:f,start:c.start,end:c.start+6,original:'Padded',replacement:'VTIG_Padded',id:null,kind:'presentation-cjk-padding'});added++;disposition='guarded-callee-adapter';
    }
   }
   records.push({file:f,...c,sourceSha256:profile.sha256,disposition,role,originalCallSha256:sha(c.original)});
  }
 }
 for(const [id,count]of Object.entries(embeddedCounts)){
  const p=embedded.get(id);if(!p)throw Error(`Missing embedded padding expression ${id}`);
  const cs=paddingCalls(p.replacement);if(cs.length!==count||cs.some(c=>c.callee!=='VTIG_Padded'))throw Error(`Embedded padding adapter guard ${id}`);
 }
 for(const row of [...retained,...alreadySafe])if(records.filter(r=>r.file===row[0]&&r.line===row[1]&&r.original===row[2]).length!==1)throw Error('Padding disposition site absent/duplicated');
 const f='src/drlplayerview.pas',source=file(f),original='if Length( iEntry.Name ) > 47 then iEntry.Name := Copy(iEntry.Name, 1, 47 );',start=source.indexOf(original);
 if(start<0||source.indexOf(original,start+1)>=0||!source.includes('iEntry.Name  := aItem.Description;'))throw Error('Inventory description clipping source guard');
 const replacement=`{$IFDEF DRL_WASM}\r\n  if VTIG_Length( iEntry.Name ) > 47 then iEntry.Name := VTIG_Padded(iEntry.Name, 47);\r\n  {$ELSE}\r\n  ${original}\r\n  {$ENDIF}`;
 if(patches.some(p=>p.file===f&&p.start<start+original.length&&p.end>start))throw Error('Inventory description clipping overlaps a semantic producer');
 patches.push({file:f,start,end:start+original.length,original,replacement,id:null,kind:'presentation-cjk-clip'});
 const counts={originalCalls:records.length,translatedOrMixed:records.filter(r=>r.role?.startsWith('translated')).length,verbatimIdentityDisplay:records.filter(r=>r.role==='verbatim-identity-display').length,alreadySafe:alreadySafe.length,retainedAsciiOrEmpty:retained.length,adapterCalls:66,addedPaddingPatches:added,embeddedAdapterCalls:5,addedClipPatches:1};
 if(counts.originalCalls!==80||counts.translatedOrMixed!==68||counts.verbatimIdentityDisplay!==2||added!==61)throw Error('Reviewed padding accounting changed');
 const projected={};
 for(const f of Object.keys(profiles)){
  const output=project(file(f),patches.filter(p=>p.file===f)),cs=paddingCalls(output);
  projected[f]={vtigPaddedCalls:cs.filter(c=>c.callee==='VTIG_Padded').length,originalPaddedCalls:cs.filter(c=>c.callee==='Padded').length};
  if(cs.filter(c=>c.callee==='Padded').length!==retained.filter(r=>r[0]===f).length)throw Error(`Unsafe untranslated padding remains: ${f}`);
 }
 return {schema:1,sourceCommit:'a6f965072b3a25b768c91dbced00367f1b57d865',sources,counts,records,projected,clip:{file:f,start,original,replacement,sourceSha256:profiles[f].sha256,browserOnly:true,nativeBranchUnchanged:true},domainFieldsAndCatalogsUnchanged:true,nativeAdapterRuntimeVerified:false};
}
