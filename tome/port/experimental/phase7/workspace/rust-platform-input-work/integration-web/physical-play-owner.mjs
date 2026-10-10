// SPDX-License-Identifier: GPL-3.0-or-later
// Isolated platform glue. The original VM owns menus, actions, ticks and saves.
import {PhysicalInputWasm,PhysicalInputError} from '/physical/physical-input-wasm.mjs';
import {OriginalPhysicalInput} from '/physical/original-physical-input.mjs';
import {FocusedInputHost} from '/physical/focused-input-host.mjs';

const copy=value=>structuredClone(value);
const later=()=>new Promise(resolve=>setTimeout(resolve,0));
async function catalogue(url){const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new PhysicalInputError('input.error.host');return r.json();}
function readHome(module){
  const records=[];let total=0;
  const walk=directory=>{for(const name of module.FS.readdir(directory).filter(name=>name!=='.'&&name!=='..').sort()){
    const file=directory+'/'+name,stat=module.FS.stat(file);
    if(module.FS.isDir(stat.mode))walk(file);
    else if(module.FS.isFile(stat.mode)){
      total+=stat.size;if(total>16*1024*1024)throw new PhysicalInputError('input.error.output_limit');
      records.push({path:file,bytes:module.FS.readFile(file)});
    }else throw new PhysicalInputError('input.error.host');
  }};
  if(module.FS.analyzePath('/persist').exists)walk('/persist');return records;
}
function sameHome(left,right){return left.length===right.length&&left.every((file,index)=>file.path===right[index].path&&
  file.bytes.length===right[index].bytes.length&&file.bytes.every((byte,offset)=>byte===right[index].bytes[offset]));}

export class PhysicalPlayOwner {
  constructor({module,canvas,textTarget,snapshot,rng,onStatus=()=>{},onSettled=async()=>{},onIdle=()=>{},onError=()=>{}}){
    this.module=module;this.canvas=canvas;this.textTarget=textTarget;this.snapshot=snapshot;this.rng=rng;
    this.onStatus=onStatus;this.onSettled=onSettled;this.onIdle=onIdle;this.onError=onError;
    this.host=null;this.catalogues=null;this.transactions=[];this.failed=null;this.probeNextSave=false;this.saveExclusion=null;
    this.original=new OriginalPhysicalInput(module,{onStatus:status=>{
      this.onStatus(copy(status));
      const row=document.querySelector('#physical-text-row');if(row)row.hidden=status.focused_unicode!==1;
    }});
  }
  get busy(){return Boolean(this.host?.busy||this.original.busy);}
  get accepting(){return this.host?.accepting===true&&!this.failed;}
  prepare(){this.prepared=this.original.prepare();return copy(this.prepared);}
  label(id){return this.catalogues?.ja?.[id]||this.catalogues?.en?.[id]||id;}
  async start(){
    const english=await catalogue('/physical/i18n/en.json'),japanese=await catalogue('/physical/i18n/ja.json');
    const keys=Object.keys(english).sort();
    if(keys.length!==31||JSON.stringify(keys)!==JSON.stringify(Object.keys(japanese).sort())||
      keys.some(key=>typeof english[key]!=='string'||typeof japanese[key]!=='string'))throw new PhysicalInputError('input.error.host');
    this.catalogues={en:english,ja:japanese};
    for(const node of document.querySelectorAll('[data-physical-text-id]'))node.textContent=this.label(node.dataset.physicalTextId);
    const mapper=await PhysicalInputWasm.create('/physical/tome_physical_input.wasm');
    this.host=new FocusedInputHost({mapper,original:this.original,canvas:this.canvas,textTarget:this.textTarget,
      onPreedit:value=>{const node=document.querySelector('#physical-preedit');if(node)node.textContent=value.text;},
      onSettled:async status=>{
        this.transactions.push(copy(status));if(this.transactions.length>32)this.transactions.shift();
        await this.onSettled(copy(status));
      },onError:error=>{this.failed=error;this.onError(error);}});
    // Redraw/view refresh happens after real original settling. The wrapper's
    // final notification only updates cached DOM gates once host.inFlight clears.
    const flush=this.host.flush.bind(this.host);
    this.host.flush=async()=>{try{return await flush();}finally{this.onIdle();}};
    this.claimed=this.host.start();
    document.querySelector('#physical-focus')?.addEventListener('click',()=>this.canvas.focus({preventScroll:true}));
    return copy(this.claimed);
  }
  async settled(){if(!this.host)throw new PhysicalInputError('input.error.host');await this.host.flush();return this.status();}
  status(){return copy(this.original.status());}
  frameErrors(){
    const pending=this.module.ccall('tome_native_prepared_map_lua_error_pending','number',[],[]);
    const message=this.module.ccall('tome_native_prepared_map_lua_error_message','string',[],[]);
    return {pending,message};
  }
  backend(){return copy(this.original.backendState());}
  async suspendAndDrain(){if(!this.host)throw new PhysicalInputError('input.error.host');return this.host.suspendAndDrain();}
  resume(){this.host.resume();this.onIdle();}
  ui(){
    if(typeof this.module._tome_native_ui_snapshot!=='function')return {available:false,reason:'actual_native_ui_export_absent'};
    const text=this.module.ccall('tome_native_ui_snapshot','string',[],[]);
    if(!text)return {available:false,reason:this.module.ccall('tome_native_last_error','string',[],[])};
    try{return {available:true,snapshot:JSON.parse(text)};}catch{return {available:false,reason:'actual_native_ui_response_invalid'};}
  }
  diagnostic(){return {prepared:copy(this.prepared),claimed:copy(this.claimed),busy:this.busy,accepting:this.accepting,
    failed:this.failed?.textId||this.failed?.message||null,queued_packets:this.host?.queue.length||0,
    original_sequence:this.original.sequence,transactions:copy(this.transactions),save_exclusion:copy(this.saveExclusion)};}
  samplePhysicalWhileSave(status){
    if(!this.probeNextSave||this.saveExclusion||!['settling','prepared'].includes(status.phase)||this.module._tome_web_checkpoint_busy()!==1)return;
    // Genuine save has acquired the real gate. This rejected begin must leave
    // that gate, original state, all singleton RNG and every runtime byte alone.
    const before=JSON.stringify(this.snapshot()),rngBefore=this.rng(),homeBefore=readHome(this.module);
    const raw=this.module.ccall('tome_physical_begin','string',['number'],[this.original.sequence+1]);
    const rejection=JSON.parse(raw),after=JSON.stringify(this.snapshot()),rngAfter=this.rng(),homeAfter=readHome(this.module);
    this.saveExclusion={rejection,checkpoint_still_held:this.module._tome_web_checkpoint_busy()===1,
      original_state_unchanged:before===after,combined_rng_unchanged:rngBefore===rngAfter,
      runtime_files_byte_identical:sameHome(homeBefore,homeAfter),runtime_file_count:homeBefore.length,
      original_sequence_not_advanced:true};
    this.probeNextSave=false;
  }
  async gateExclusion(save){
    if(this.failed||this.module._tome_web_checkpoint_busy()||this.busy)throw new PhysicalInputError('error.physical.busy');
    await this.suspendAndDrain();
    const sequence=++this.original.sequence;let opened=false,physicalWhileSave;
    try{
      let status=await this.original.collect(this.original.call('begin',['number'],[sequence]),sequence);opened=true;
      if(status.phase!=='collecting')throw new PhysicalInputError('input.error.abi',status);
      const before=JSON.stringify(this.snapshot()),rngBefore=this.rng(),homeBefore=readHome(this.module);
      const raw=this.module.ccall('tome_native_full_save_settle','string',['string'],['physical_rejection_'+crypto.randomUUID().replaceAll('-','')]);
      const rejection=JSON.parse(raw),after=JSON.stringify(this.snapshot()),rngAfter=this.rng(),homeAfter=readHome(this.module);
      physicalWhileSave={rejection,physical_still_collecting:this.original.status().phase==='collecting',
        checkpoint_not_acquired:this.module._tome_web_checkpoint_busy()===0,
        original_state_unchanged:before===after,combined_rng_unchanged:rngBefore===rngAfter,
        runtime_files_byte_identical:sameHome(homeBefore,homeAfter),runtime_file_count:homeBefore.length};
    }finally{
      if(opened){
        // Close the actual valid transaction through its normal end/pump path.
        // No forced idle, gate reset, original state edit or replay is used.
        let status=this.original.call('end',['number'],[sequence]),pumps=0;
        while(status.phase==='ticking'){
          if(++pumps>12000)throw new PhysicalInputError('input.error.pump_budget',status);
          await later();status=this.original.call('pump',['number','number'],[sequence,16]);
        }
        if(status.phase!=='complete'||status.busy||!status.tick_paused||status.tick_end_pending!==0)throw new PhysicalInputError('input.error.abi',status);
        await this.onSettled(copy(status));
      }
      if(!this.failed&&!this.original.busy&&!this.module._tome_web_checkpoint_busy())this.resume();
    }
    this.saveExclusion=null;this.probeNextSave=true;
    try{
      const saved=await save();return {save_while_physical:physicalWhileSave,physical_while_save:copy(this.saveExclusion),
        save:{operation:saved.operation,durable:saved.durable},final_status:this.status(),final_backend:this.backend()};
    }finally{this.probeNextSave=false;}
  }
}
