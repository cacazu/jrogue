// SPDX-License-Identifier: GPL-3.0-or-later
import {writeFile} from 'node:fs/promises';import path from 'node:path';
export async function runScenario({call,evaluate,evidence,output}){
 const checks=[];const check=(name,condition,detail)=>{checks.push({name,passed:!!condition,detail});if(!condition)throw Error(name);};
 const control=evidence.runtime;
 check('Control used an unpatched fresh context',control.compat===false&&control.compatStatus.installed===false,control.compatStatus);
 const image=await call('Page.captureScreenshot',{format:'png'});await writeFile(path.join(output,'control.png'),Buffer.from(image.data,'base64'));
 const url=new URL(evidence.url);url.searchParams.set('compat','1');
 await call('Page.navigate',{url:url.href});
 let patched;const deadline=Date.now()+120000;
 while(Date.now()<deadline){patched=await evaluate('window.tomePlanarRegressionReport');if(patched?.completed)break;await new Promise(resolve=>setTimeout(resolve,250));}
 check('Fresh patched context reports all actual reference pixels correct',patched?.passed===true&&patched.secondMatchesCurrentCpuBytes===true,patched);
 check('Patched descriptor restoration matches actual preparation',patched.compatStatus.installed&&patched.compatStatus.refreshes===2&&patched.compatStatus.restored===2,patched.compatStatus);
 const secondImage=await call('Page.captureScreenshot',{format:'png'});await writeFile(path.join(output,'patched.png'),Buffer.from(secondImage.data,'base64'));
 const result={passed:true,checks,control,patched,control_reproduced_stale_second_draw:control.secondMatchesCurrentCpuBytes===false,
  scope:'Actual original tgl CPU descriptors at unchanged addresses, two fresh GL contexts. No campaign or complete-renderer claim.'};
 await writeFile(path.join(output,'planar-regression.json'),JSON.stringify(result,null,2)+'\n');return result;
}
