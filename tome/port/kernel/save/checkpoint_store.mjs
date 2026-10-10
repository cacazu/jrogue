/* SPDX-License-Identifier: GPL-3.0-or-later
 * Real classic Emscripten FS/IDBFS generation store. Source-only candidate.
 * No FS/storage/codec/ZIP mocks; actual native validation and actual original
 * archive verification are required dependencies. No game rules or serializer.
 */
const utf8 = new TextEncoder();
const text = new TextDecoder('utf-8', {fatal:true});
const LAYOUTS = Object.freeze({
  1:{name:'original-singleton-v1',bytes:2588,mode:'baseline_original_checkpoint'},
  2:{name:'original-named-banks-v1',bytes:5208,mode:'production_strict_checkpoint'},
});
function fault(id,detail) { const e=new Error(id); e.text_id=id; e.detail=detail; throw e; }
function check(ok,id,detail) { if(!ok) fault(id,detail); }
function identifier(value) { return typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value); }
function nativeLocale(value) { return typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.@-]{0,63}$/.test(value); }
function absolute(value) {
  check(typeof value==='string'&&value.startsWith('/')&&value!=='/'&&!value.endsWith('/')&&
    !/[\x00-\x1f\\]/.test(value)&&value.split('/').slice(1).every(x=>x&&x!=='.'&&x!=='..'),'save.store.invalid_root');
  return value;
}
function relative(value) {
  check(typeof value==='string'&&value&&!value.startsWith('/')&&!/[\x00-\x1f\\]/.test(value)&&
    value.split('/').every(x=>x&&x!=='.'&&x!=='..'),'save.store.invalid_relative_path');
  return value;
}
function within(root,path) { return path===root||path.startsWith(root+'/'); }
function normalizedAbsolute(value) {
  check(typeof value==='string'&&value.startsWith('/')&&!/[\x00-\x1f\\]/.test(value),'save.store.invalid_graph_path');
  const parts=value.split('/').filter(Boolean);
  check(parts.length&&parts.every(x=>x!=='.'&&x!=='..'),'save.store.invalid_graph_path');
  return '/'+parts.join('/'); // Original empty world slot uses /save//world.teaw.
}
function hexBytes(hex) {
  check(typeof hex==='string'&&/^(?:[0-9a-fA-F]{2})+$/.test(hex),'save.store.invalid_rng_hex');
  const out=new Uint8Array(hex.length/2);
  for(let i=0;i<out.length;i++) out[i]=parseInt(hex.slice(i*2,i*2+2),16);
  return out;
}
async function digest(bytes) {
  check(globalThis.crypto?.subtle,'save.store.crypto_unavailable');
  const result=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
  return Array.from(result,x=>x.toString(16).padStart(2,'0')).join('');
}
function jsonBytes(value) { return utf8.encode(JSON.stringify(value)+'\n'); }
function jsonRead(FS,path) { return JSON.parse(text.decode(FS.readFile(path))); }

export class OriginalCheckpointStore {
  constructor(module,{mount='/checkpoint-store',runtimeHome='/persist',compatibility,validateOriginalArchives}={}) {
    this.module=module; this.FS=module.FS;
    this.IDBFS=module.IDBFS||this.FS?.filesystems?.IDBFS;
    check(this.FS?.mount&&this.FS?.syncfs&&this.FS?.getMounts&&this.IDBFS?.mount,'save.store.actual_idbfs_required');
    check(typeof module.ccall==='function'&&typeof module._tome_web_checkpoint_busy==='function'&&
      typeof module._tome_web_rng_capture_hex==='function'&&typeof module._tome_web_rng_validate_hex==='function',
      'save.store.actual_native_codec_required');
    check(compatibility&&typeof compatibility==='object'&&typeof validateOriginalArchives==='function',
      'save.store.archive_validator_required');
    this.mount=absolute(mount); this.runtimeHome=absolute(runtimeHome);
    check(!within(this.mount,this.runtimeHome)&&!within(this.runtimeHome,this.mount),'save.store.roots_overlap');
    this.compatibility=JSON.parse(JSON.stringify(compatibility));
    this.compatibilityText=JSON.stringify(this.compatibility);
    this.validateOriginalArchives=validateOriginalArchives;
    this.phase='new'; this.verifiedHead=null; this.syncBusy=false; this.operation=null;
  }
  async initialize() {
    check(this.phase==='new','save.store.already_initialized');
    this.FS.mkdirTree(this.mount);
    this.FS.mount(this.IDBFS,{autoPersist:false},this.mount);
    const durable=this.FS.getMounts(this.FS.root.mount).filter(m=>typeof m.type.syncfs==='function');
    check(durable.length===1&&durable[0].type===this.IDBFS&&durable[0].mountpoint===this.mount,
      'save.store.multiple_durable_mounts');
    await this.sync(true); // Must precede native engine bootstrap and resume slot copy.
    this.phase='ready';
    this.FS.mkdirTree(this.mount+'/generations');
    await this.latestVerified(); // Preserve an actually verified prior head before new writes.
    return this;
  }
  sync(populate) {
    check(!this.syncBusy,'save.store.concurrent_sync');
    this.syncBusy=true;
    return new Promise((resolve,reject)=>this.FS.syncfs(populate,error=>{
      this.syncBusy=false;
      if(error) reject(error); else resolve();
    }));
  }
  gateRequired(layout) {
    check(this.module._tome_web_checkpoint_busy()===1,'save.store.native_gate_required');
    const expected=layout===1?1:2;
    check(this.module._tome_web_checkpoint_mode()===expected,'save.store.checkpoint_mode_mismatch');
  }
  write(path,bytes) {
    const parent=path.slice(0,path.lastIndexOf('/'));
    this.FS.mkdirTree(parent);
    let prior=0;
    try { prior=this.FS.stat(path).mtime.getTime(); } catch(e) { if(e.errno!==44) throw e; }
    this.FS.writeFile(path,bytes);
    // IDBFS compares modification timestamps. Distinct pointer updates must
    // remain observable even when multiple saves finish in the same millisecond.
    const stamp=Math.max(Date.now(),prior+1);
    this.FS.utime(path,stamp,stamp);
  }
  inventory(root) {
    const files=[];
    const walk=(current)=>{
      const entries=this.FS.readdir(current).filter(x=>x!=='.'&&x!=='..').sort();
      for(const name of entries) {
        const path=current+'/'+name,stat=this.FS.lstat(path);
        check(!this.FS.isLink(stat.mode),'save.store.symlink_not_supported',path);
        if(this.FS.isDir(stat.mode)) walk(path);
        else {
          check(this.FS.isFile(stat.mode)&&stat.size>=0&&Number.isSafeInteger(stat.size),'save.store.invalid_runtime_file',path);
          check(!name.endsWith('.tmp'),'save.store.unfinished_archive',path);
          files.push({path:relative(path.slice(root.length+1)),bytes:stat.size});
        }
      }
    };
    walk(root); return files;
  }
  async stageAndCommit({generation,graphStatus,layout,loader}) {
    check(this.phase==='ready'&&!this.operation&&identifier(generation),'save.store.invalid_commit_state');
    check(graphStatus?.phase==='graph-complete'&&graphStatus.generation===generation&&
      graphStatus.mode===LAYOUTS[layout]?.mode,'save.store.original_graph_not_complete');
    this.gateRequired(layout);
    // Capture immediately after the actual pipe/callback completion, BEFORE
    // asynchronous hashing/validation. No loader/draw/command may run meanwhile.
    const rngHex=this.module.ccall('tome_web_rng_capture_hex','string',['number'],[layout]);
    check(rngHex&&rngHex.length===LAYOUTS[layout].bytes*2,'save.store.rng_capture_failed');
    check(this.module.ccall('tome_web_rng_validate_hex','number',['string','number'],[rngHex,layout])===1,
      'save.store.rng_validation_failed');
    const target=this.mount+'/generations/'+generation;
    check(!this.FS.analyzePath(target).exists,'save.store.generation_exists');
    check(loader&&loader.save_name===graphStatus.save_name&&loader.engine==='te4'&&loader.version==='1.7.6'&&loader.module==='tome'&&nativeLocale(loader.preferred_locale),
      'save.store.loader_metadata_mismatch');
    check(graphStatus.graph_paths,'save.store.original_graph_path_invalid');
    const graphPaths={game:normalizedAbsolute(graphStatus.graph_paths.game),world:normalizedAbsolute(graphStatus.graph_paths.world)};
    check(typeof graphPaths.game==='string'&&typeof graphPaths.world==='string'&&
      within(this.runtimeHome,graphPaths.game)&&within(this.runtimeHome,graphPaths.world),
      'save.store.original_graph_path_invalid');
    const files=this.inventory(this.runtimeHome);
    const known=new Set(files.map(f=>this.runtimeHome+'/'+f.path));
    check(known.has(graphPaths.game)&&known.has(graphPaths.world),'save.store.original_graph_file_missing');
    this.phase='staging'; this.operation={generation,phase:'pending'};
    try {
      const checked=await this.validateOriginalArchives({FS:this.FS,paths:graphPaths,files,runtimeHome:this.runtimeHome});
      check(checked?.validated===true,'save.store.archive_validation_failed');
      const records=[];
      for(const file of files) {
        this.gateRequired(layout);
        const bytes=this.FS.readFile(this.runtimeHome+'/'+file.path);
        check(bytes.length===file.bytes,'save.store.runtime_file_changed',file.path);
        records.push({...file,sha256:await digest(bytes)});
        this.write(target+'/home/'+file.path,bytes);
      }
      const rng=hexBytes(rngHex);
      const sidecar={schema:1,layout:LAYOUTS[layout].name,layout_id:layout,bytes:rng.length,
        sha256:await digest(rng),hex:rngHex.toLowerCase()};
      const sidecarBytes=jsonBytes(sidecar);
      this.write(target+'/rng.json',sidecarBytes);
      const manifest={schema:1,generation,state:'candidate-complete',mode:graphStatus.mode,
        compatibility:this.compatibility,loader:JSON.parse(JSON.stringify(loader)),
        runtime_home:this.runtimeHome,files:records,graph_paths:{
          game:relative(graphPaths.game.slice(this.runtimeHome.length+1)),
          world:relative(graphPaths.world.slice(this.runtimeHome.length+1))},
        rng_sidecar:{path:'rng.json',bytes:sidecarBytes.length,sha256:await digest(sidecarBytes)},
        archive_validation:checked,previous_head:this.verifiedHead,
        baseline_original_save_effects:layout===1,renderer_purity_claim:false};
      const manifestBytes=jsonBytes(manifest),head={generation,manifest_sha256:await digest(manifestBytes)};
      this.write(target+'/manifest.json',manifestBytes);
      this.write(this.mount+'/active.json',jsonBytes({schema:1,current:head,previous:this.verifiedHead}));
      this.gateRequired(layout);
      this.phase='persisting';
      await this.sync(false); // Success callback follows real transaction.oncomplete.
      this.verifiedHead=head; this.operation.phase='committed'; this.phase='ready';
      return {generation,phase:'committed',head};
    } catch(error) {
      this.phase='failed'; this.operation.phase='failed'; this.operation.error=error;
      // Do not sync/retry partial local staging or release original-Lua gate.
      // Immutable prior generation remains. Fresh module validates current then
      // previous head because SDK error callbacks alone do not prove rollback.
      throw error;
    }
  }
  async validateHead(head) {
    check(head&&identifier(head.generation)&&/^[0-9a-f]{64}$/.test(head.manifest_sha256),'save.store.invalid_head');
    const base=this.mount+'/generations/'+head.generation;
    const bytes=this.FS.readFile(base+'/manifest.json');
    check(await digest(bytes)===head.manifest_sha256,'save.store.manifest_hash_mismatch');
    const manifest=JSON.parse(text.decode(bytes));
    check(manifest.schema===1&&manifest.generation===head.generation&&manifest.state==='candidate-complete'&&
      JSON.stringify(manifest.compatibility)===this.compatibilityText&&manifest.runtime_home===this.runtimeHome&&
      Array.isArray(manifest.files)&&manifest.files.length>0,'save.store.incompatible_generation');
    check(nativeLocale(manifest.loader?.preferred_locale),'save.store.loader_metadata_mismatch');
    const seen=new Set();
    for(const file of manifest.files) {
      relative(file.path);
      check(!seen.has(file.path)&&Number.isSafeInteger(file.bytes)&&file.bytes>=0&&/^[0-9a-f]{64}$/.test(file.sha256),
        'save.store.invalid_file_manifest');
      seen.add(file.path);
      const content=this.FS.readFile(base+'/home/'+file.path);
      check(content.length===file.bytes&&await digest(content)===file.sha256,'save.store.file_hash_mismatch',file.path);
    }
    const reference=manifest.rng_sidecar;
    check(reference?.path==='rng.json','save.store.invalid_rng_sidecar_path');
    const sideBytes=this.FS.readFile(base+'/rng.json');
    check(sideBytes.length===reference.bytes&&await digest(sideBytes)===reference.sha256,'save.store.sidecar_hash_mismatch');
    const sidecar=JSON.parse(text.decode(sideBytes)),layout=LAYOUTS[sidecar.layout_id];
    check(sidecar.schema===1&&layout&&sidecar.layout===layout.name&&sidecar.bytes===layout.bytes&&manifest.mode===layout.mode,
      'save.store.invalid_sidecar_layout');
    const rng=hexBytes(sidecar.hex);
    check(rng.length===sidecar.bytes&&await digest(rng)===sidecar.sha256&&
      this.module.ccall('tome_web_rng_validate_hex','number',['string','number'],[sidecar.hex,sidecar.layout_id])===1,
      'save.store.rng_validation_failed');
    relative(manifest.graph_paths.game); relative(manifest.graph_paths.world);
    check(seen.has(manifest.graph_paths.game)&&seen.has(manifest.graph_paths.world),'save.store.original_graph_file_missing');
    const checked=await this.validateOriginalArchives({FS:this.FS,paths:{game:base+'/home/'+manifest.graph_paths.game,
      world:base+'/home/'+manifest.graph_paths.world},files:manifest.files,runtimeHome:base+'/home'});
    check(checked?.validated===true,'save.store.archive_validation_failed');
    return {head,manifest,sidecar,base};
  }
  acknowledgeCommitted(generation) {
    check(this.phase==='ready'&&this.operation?.phase==='committed'&&
      this.operation.generation===generation&&this.module._tome_web_checkpoint_busy()===0,
      'save.store.invalid_commit_acknowledgment');
    this.operation=null;
  }
  async latestVerified() {
    check(this.phase==='ready'&&!this.syncBusy,'save.store.invalid_read_state');
    const path=this.mount+'/active.json';
    if(!this.FS.analyzePath(path).exists) return null;
    const active=jsonRead(this.FS,path);
    check(active.schema===1,'save.store.invalid_active_pointer');
    let firstError;
    for(const head of [active.current,active.previous]) {
      if(!head) continue;
      try { const verified=await this.validateHead(head); this.verifiedHead=head; return verified; }
      catch(error) { firstError??=error; }
    }
    throw firstError||new Error('save.store.no_valid_generation');
  }
  async copyForFreshResume(verified) {
    check(this.phase==='ready'&&!this.syncBusy&&this.module._tome_web_checkpoint_busy()===0,'save.store.invalid_resume_copy_state');
    const checked=await this.validateHead(verified.head); // Validate before loader can mutate/delete.
    this.FS.mkdirTree(this.runtimeHome);
    check(this.FS.readdir(this.runtimeHome).filter(x=>x!=='.'&&x!=='..').length===0,'save.store.fresh_runtime_home_required');
    for(const file of checked.manifest.files)
      this.write(this.runtimeHome+'/'+file.path,this.FS.readFile(checked.base+'/home/'+file.path));
    return {schema:1,mode:checked.sidecar.layout_id===1?'baseline_original_resume':'production_strict_resume',
      generation:checked.head.generation,rng_layout:checked.sidecar.layout_id,
      save_name:checked.manifest.loader.save_name,extra_module_info:checked.manifest.loader.extra_module_info,
      profile_name:checked.manifest.loader.profile_name,preferred_locale:checked.manifest.loader.preferred_locale,
      sidecar:checked.sidecar};
  }
}
