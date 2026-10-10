/* SPDX-License-Identifier: GPL-3.0-or-later
 * Actual CDP observation scenario. Parent owns Chrome/server launches.
 */
import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

export async function runScenario({call,evaluate,evidence,output}) {
  const result={scope:'Actual first original fullsave and one native map observation, followed by pure owned Rust reads',
    checks:[],passed:false,full_renderer_ready:false,renderer_purity_claim:false,full_campaign_claim:false};
  function check(name,passed,detail){result.checks.push({name,passed:!!passed,detail});if(!passed)throw new Error(name);}
  try{
    const deadline=Date.now()+300000;let page;
    while(Date.now()<deadline){
      try{page=await evaluate('window.tomePreparedMapReport');}catch{}
      if(page?.completed)break;await sleep(250);
    }
    result.page=page;
    check('observer page reached a concrete completed result',page?.completed===true,{phase:page?.phase,failure:page?.failure});
    // These probes return already owned/cached JS data; they never call native.
    const info=await evaluate('window.tomePreparedMapProbe.packetInfo()');
    if(info){
      check('actual packet export length is bounded',Number.isSafeInteger(info.bytes)&&info.bytes>=64&&info.bytes<=64*1024*1024,info);
      const bytes=Buffer.alloc(info.bytes);
      for(let start=0;start<info.bytes;start+=65536){
        const count=Math.min(65536,info.bytes-start),chunk=await evaluate(`window.tomePreparedMapProbe.packetChunk(${start},${count})`);
        const part=Buffer.from(chunk.data,'base64');
        check('actual cached byte export '+start,chunk.start===start&&chunk.bytes===count&&chunk.encoding==='base64'&&part.length===count);
        part.copy(bytes,start);
      }
      const sha256=createHash('sha256').update(bytes).digest('hex');
      if(info.sha256)check('Node independently hashes actual copied TMP1 bytes',sha256===info.sha256,{sha256});
      const artifact=path.join(output,'actual-original-map-tmp1.bin');await writeFile(artifact,bytes);
      result.packet={artifact,bytes:bytes.length,sha256,metadata_hash_available:!!info.sha256};
    }
    const observations=await evaluate('window.tomePreparedMapProbe.observations()');
    const observationFile=path.join(output,'original-map-observations.json');
    await writeFile(observationFile,JSON.stringify(observations,null,2));result.original_observations=observationFile;
    const shot=await call('Page.captureScreenshot',{format:'png'});
    await writeFile(path.join(output,'original-map-observer.png'),Buffer.from(shot.data,'base64'));
    check('actual page completed every observer check',page.passed===true,{phase:page.phase,failure:page.failure});
    check('genuine first fullsave completed before observer frame',page.fullsave?.operation?.phase==='complete'&&page.fullsave?.durable?.phase==='committed'&&
      page.existing_verified_head===null&&page.checks?.some(item=>item.name==='observer.original.fullsave_committed_and_released'&&item.passed));
    check('one external original frame and no gameplay command',page.external_original_frame_calls===1&&page.input_disabled===true&&
      !page.native_calls.includes('tome_native_command'));
    check('original Lua error remained absent without consumption',page.before_frame_original_error?.pending===0&&page.after_frame_original_error?.pending===0&&page.original_errors.length===0);
    check('genuine native map entered and returned once',page.map_after_frame?.entered===1&&page.map_after_frame?.returned===1&&page.map_after_frame?.depth===0);
    check('native getter and Rust whole-memory checks passed',page.native_binary_memory_purity?.equal===true&&page.rust_native_memory_purity?.equal===true);
    check('actual packet decoded but complete replay remains unavailable',!!result.packet&&page.packet?.header?.draws>0&&page.rust_metadata?.phase==='validated'&&
      page.rust_metadata?.full_renderer_ready===false&&page.full_renderer_ready===false&&page.renderer_purity_claim===false&&page.map_release?.phase==='released');
    check('actual Rust module has zero imports and rejects fresh corruption probes',Array.isArray(page.rust_wasm_imports)&&page.rust_wasm_imports.length===0&&
      page.rust_corruption_probes?.length===6&&page.rust_corruption_probes.every(probe=>probe.rejected===true));
    result.passed=result.checks.every(item=>item.passed);result.url=evidence?.url;
  }catch(error){result.error=error.stack||String(error);}
  await writeFile(path.join(output,'prepared-map-observer-evidence.json'),JSON.stringify(result,null,2));
  return result;
}
