/* Explicit preview1 shim for the authored Lua probe. No game filesystem provided. */
export async function runLuaProbe(bytes,{virtualFiles=false}={}) {
  let instance,stdout='',stderr='';
  const calls={};const unsupported={};
  const files=new Map(),handles=new Map();let nextFd=4;
  const fileHandle=fd=>handles.get(fd);
  const nameAt=(ptr,len)=>new TextDecoder().decode(new Uint8Array(instance.exports.memory.buffer,ptr,len));
  const validName=name=>name.length>0&&!name.startsWith('/')&&!name.split('/').includes('..');
  const view=()=>new DataView(instance.exports.memory.buffer);
  const u32=(p,v)=>view().setUint32(p,v,true);
  const requireFd=fd=>fd>=0&&fd<=2;
  const errno={BADF:8,NOSYS:52};
  const wasi={
    args_sizes_get(argc,size){u32(argc,0);u32(size,0);return 0;},
    args_get(){return 0;},
    environ_sizes_get(count,size){u32(count,0);u32(size,0);return 0;},
    environ_get(){return 0;},
    clock_time_get(id,precision,ptr){if(id<0||id>3)return 28;const ns=id===0?BigInt(Date.now())*1000000n:BigInt(Math.floor(performance.now()*1000000));view().setBigUint64(ptr,ns,true);return 0;},
    fd_fdstat_get(fd,ptr){if(!requireFd(fd)&&!(virtualFiles&&fd===3)&&!fileHandle(fd))return errno.BADF;new Uint8Array(instance.exports.memory.buffer,ptr,24).fill(0);view().setUint8(ptr,fileHandle(fd)?4:fd===3?3:2);view().setBigUint64(ptr+8,fileHandle(fd)||fd===3?(1n<<30n)-1n:fd===0?2n:64n,true);view().setBigUint64(ptr+16,fd===3?(1n<<30n)-1n:0n,true);return 0;},
    fd_filestat_get(fd,ptr){if(!requireFd(fd)&&!(virtualFiles&&fd===3)&&!fileHandle(fd))return errno.BADF;new Uint8Array(instance.exports.memory.buffer,ptr,64).fill(0);view().setUint8(ptr+16,fileHandle(fd)?4:fd===3?3:2);view().setBigUint64(ptr+24,1n,true);view().setBigUint64(ptr+32,BigInt(fileHandle(fd)?files.get(fileHandle(fd).name).length:0),true);return 0;},
    fd_fdstat_set_flags(fd,flags){if(!requireFd(fd)&&!fileHandle(fd))return errno.BADF;if(fileHandle(fd))fileHandle(fd).flags=flags;return 0;},
    fd_write(fd,iovs,count,written){if(fd!==1&&fd!==2&&!fileHandle(fd))return errno.BADF;let total=0;const decoder=new TextDecoder();for(let i=0;i<count;i++){const p=view().getUint32(iovs+i*8,true),n=view().getUint32(iovs+i*8+4,true),bytes=new Uint8Array(instance.exports.memory.buffer,p,n);if(fileHandle(fd)){const h=fileHandle(fd),old=files.get(h.name);if(h.pos+n>1048576)return 27;const buffer=new Uint8Array(Math.max(old.length,h.pos+n));buffer.set(old);buffer.set(bytes,h.pos);h.pos+=n;files.set(h.name,buffer);}else {const text=decoder.decode(bytes);if(fd===1)stdout+=text;else stderr+=text;}total+=n;}u32(written,total);return 0;},
    fd_read(fd,iovs,count,read){if(fd===0){u32(read,0);return 0;}const h=fileHandle(fd);if(!h)return errno.BADF;let total=0;for(let i=0;i<count;i++){const p=view().getUint32(iovs+i*8,true),capacity=view().getUint32(iovs+i*8+4,true),data=files.get(h.name),n=Math.max(0,Math.min(capacity,data.length-h.pos));new Uint8Array(instance.exports.memory.buffer,p,n).set(data.subarray(h.pos,h.pos+n));h.pos+=n;total+=n;if(n<capacity)break;}u32(read,total);return 0;},
    fd_seek(fd,offset,whence,result){const h=fileHandle(fd);if(!h)return errno.BADF;const base=whence===0?0:whence===1?h.pos:whence===2?files.get(h.name).length:null;if(base===null)return 28;const position=BigInt(base)+offset;if(position<0n||position>1048576n)return 28;h.pos=Number(position);view().setBigUint64(result,position,true);return 0;},
    fd_tell(fd,result){const h=fileHandle(fd);if(!h)return errno.BADF;view().setBigUint64(result,BigInt(h.pos),true);return 0;},
    fd_close(fd){if(requireFd(fd))return 0;return handles.delete(fd)?0:errno.BADF;},
    fd_prestat_get(fd,ptr){if(!virtualFiles||fd!==3)return errno.BADF;new Uint8Array(instance.exports.memory.buffer,ptr,8).fill(0);u32(ptr+4,6);return 0;},
    fd_prestat_dir_name(fd,ptr,len){if(!virtualFiles||fd!==3)return errno.BADF;if(len<6)return 28;new Uint8Array(instance.exports.memory.buffer,ptr,6).set(new TextEncoder().encode('/probe'));return 0;},
    path_open(fd,lookup,ptr,len,flags,rights,inheriting,fdflags,result){if(!virtualFiles||fd!==3)return errno.BADF;const name=nameAt(ptr,len);if(!validName(name))return 63;if(flags&2)return 54;if(!files.has(name)){if(!(flags&1))return 44;files.set(name,new Uint8Array());}else if((flags&1)&&(flags&4))return 20;if(flags&8)files.set(name,new Uint8Array());const opened=nextFd++;handles.set(opened,{name,pos:0,flags:fdflags});u32(result,opened);return 0;},
    proc_exit(code){throw {luaProbeExit:true,code};}
  };
  const module=await WebAssembly.compile(bytes);
  const imports=WebAssembly.Module.imports(module);
  const namespaces={wasi_snapshot_preview1:{}};
  for(const imp of imports) {
    if(imp.module!=='wasi_snapshot_preview1'||imp.kind!=='function')throw Error('Unknown required import '+JSON.stringify(imp));
    const operation=wasi[imp.name]??((...args)=>{unsupported[imp.name]=(unsupported[imp.name]??0)+1;return errno.NOSYS;});
    namespaces.wasi_snapshot_preview1[imp.name]=(...args)=>{calls[imp.name]=(calls[imp.name]??0)+1;return operation(...args);};
  }
  instance=await WebAssembly.instantiate(module,namespaces);
  let exit_code=0;
  try{instance.exports._start();}catch(error){if(error.luaProbeExit)exit_code=error.code;else throw error;}
  const output=stdout.trim();
  const result={exit_code,output:JSON.parse(output),stderr,imports,calls,unsupported,virtual_files:[...files].map(([name,bytes])=>({name,bytes:bytes.length})),pascal_callbacks_tested:virtualFiles,full_game:false};
  if(exit_code!==0||stderr||Object.keys(unsupported).length)throw Error('Lua probe failed '+JSON.stringify(result));
  return result;
}
