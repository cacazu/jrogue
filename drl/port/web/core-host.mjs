/* Browser capability boundary for the original Pascal/Lua core.
 * Files, descriptors, paths, and bytes live in the Rust platform VFS. This file
 * only marshals WASI preview1 and the versioned original-core host packets.
 */
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", {fatal:true});
export const ERRNO = Object.freeze({SUCCESS:0,AGAIN:6,BADF:8,EXIST:20,FAULT:21,INVAL:28,IO:29,ISDIR:31,NOENT:44,NOSYS:52,NOTDIR:54,NOTEMPTY:55,NOTSUP:58,OVERFLOW:61,ROFS:69,SPIPE:70,NOTCAPABLE:76});
const MAX_TRANSFER=65536, MAX_FILE=16*1024*1024, MAX_TOTAL=64*1024*1024, MAX_ENTRIES=4096;
const READ=2n, WRITE=64n, FILE_RIGHTS=0x08e000een, DIRECTORY_RIGHTS=0x0eb76600n, OPEN_RIGHTS=0x0fffffffn;
const unsupportedNames=["fd_allocate","fd_datasync","fd_fdstat_set_rights","fd_pread","fd_pwrite","fd_renumber","fd_sync","path_link","path_readlink","path_symlink","proc_raise","sock_accept","sock_recv","sock_send","sock_shutdown"];
export class WasiExit extends Error { constructor(code){super(`WASI process exited: ${code}`);this.name="WasiExit";this.code=code>>>0;} }
export class CoreStorageError extends Error {constructor(code,message){super(message);this.name="CoreStorageError";this.code=code;} }
class Fault extends Error {}
class ErrnoError extends Error {constructor(errno){super(`WASI errno ${errno}`);this.errno=errno;} }
const MAX_TIMESTAMP=18446744073709551615n;
const zeroTimes=()=>({atime:"0",mtime:"0",ctime:"0"});
export function canonicalFileTimes(value){
  if(!value||typeof value!=="object"||Array.isArray(value)||Object.keys(value).sort().join(",")!=="atime,ctime,mtime")throw new Error("Invalid original-core file timestamps");
  const result={};
  for(const key of ["atime","mtime","ctime"]){const field=value[key];if(typeof field!=="string"||!/^(0|[1-9][0-9]{0,19})$/.test(field)||BigInt(field)>MAX_TIMESTAMP)throw new Error("Invalid original-core file timestamp "+key);result[key]=field;}
  return result;
}
function word(value){if(!Number.isInteger(value)||value < -2147483648||value > 4294967295)throw new Fault("invalid wasm32 word");return value>>>0;}
function bigint(value,signed=false){if(typeof value!=="bigint")throw new ErrnoError(ERRNO.INVAL);return signed?BigInt.asIntN(64,value):BigInt.asUintN(64,value);}
function bytes(value){if(!(value instanceof Uint8Array)&&!Array.isArray(value))throw new Error("invalid byte response");if(Array.isArray(value)&&value.some(x=>!Number.isInteger(x)||x<0||x>255))throw new Error("invalid byte response");return value instanceof Uint8Array?value:Uint8Array.from(value);}

/** The synchronous callback is the separate Rust module's JSON request ABI. */
export function rustPlatform(instance){
  const api=instance.exports??instance;
  for(const name of ["drl_request_pointer","drl_request_capacity","drl_dispatch","drl_output_pointer","drl_output_length"])if(typeof api[name]!=="function")throw new Error(`Missing Rust export: ${name}`);
  function copyRequest(data){
    if(data.length>api.drl_request_capacity())throw new Error("Rust request capacity exceeded");
    const pointer=api.drl_request_pointer();
    if(!Number.isInteger(pointer)||pointer<0||pointer+data.length>api.memory.buffer.byteLength)throw new Error("Invalid Rust request buffer");
    new Uint8Array(api.memory.buffer,pointer,data.length).set(data);
  }
  const request=payload=>{
    const data=encoder.encode(JSON.stringify(payload));
    copyRequest(data);
    api.drl_dispatch(data.length);
    const offset=api.drl_output_pointer(),length=api.drl_output_length();
    if(!Number.isInteger(offset)||!Number.isInteger(length)||offset<0||length<0||length>MAX_TOTAL||offset+length>api.memory.buffer.byteLength)throw new Error("Invalid Rust response buffer");
    const result=JSON.parse(decoder.decode(new Uint8Array(api.memory.buffer,offset,length)));
    if(result.error_id)throw new Error(result.error_id);
    return result;
  };
  request.textColumns=data=>{if(typeof api.drl_text_columns!=="function")throw new Error("Missing Rust CJK width export");data=bytes(data);copyRequest(data);return api.drl_text_columns(data.length);};
  request.textFit=(data,columns)=>{if(typeof api.drl_text_fit!=="function")throw new Error("Missing Rust CJK prefix export");data=bytes(data);copyRequest(data);return api.drl_text_fit(data.length,word(columns));};
  return request;
}
function fileSystem(platform,operation){
  const result=platform({kind:"file_system",operation})?.filesystem;
  if(!result||!Number.isInteger(result.errno)||result.errno<0||result.errno>76)throw new Error("Invalid Rust filesystem response");
  if(result.errno)throw new ErrnoError(result.errno);
  return result.value;
}

export function createCoreHost({platform,bridge={},args=["drl"],env={},language="ja",stdout=()=>{},stderr=()=>{},crypto=globalThis.crypto,now=()=>Date.now(),monotonic=()=>performance.now(),sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
  if(typeof platform!=="function")throw new TypeError("Rust platform callback required");
  if(language!=="ja"&&language!=="en")throw new TypeError("Unsupported DRL locale");
  if(!Array.isArray(args)||args.length>256||args.some(x=>typeof x!=="string"||x.includes("\0")))throw new TypeError("Invalid WASI arguments");
  const environment=Object.entries(env).map(([key,value])=>{if(!key||key.includes("=")||key.includes("\0")||typeof value!=="string"||value.includes("\0"))throw new TypeError("Invalid WASI environment");return `${key}=${value}`;});
  const argBytes=args.map(x=>encoder.encode(x+"\0")),envBytes=environment.map(x=>encoder.encode(x+"\0"));
  if([...argBytes,...envBytes].reduce((sum,x)=>sum+x.length,0)>MAX_TRANSFER)throw new TypeError("WASI argument/environment quota exceeded");
  let memory,instance,running=false,started=false;
  const unsupported=new Set(), imported=new Set();
  const range=(pointer,length)=>{const p=word(pointer),n=word(length);if(!memory||p+n>memory.buffer.byteLength)throw new Fault("WASM memory range");return new Uint8Array(memory.buffer,p,n);};
  const view=(pointer,length)=>{const data=range(pointer,length);return new DataView(data.buffer,data.byteOffset,data.byteLength);};
  const readPath=(pointer,length)=>{if(word(length)>1024)throw new ErrnoError(ERRNO.INVAL);try{return decoder.decode(range(pointer,length));}catch(error){if(error instanceof Fault)throw error;throw new ErrnoError(ERRNO.INVAL);}};
  const u32=(pointer,value)=>view(pointer,4).setUint32(0,word(value),true);
  const u64=(pointer,value)=>view(pointer,8).setBigUint64(0,bigint(value),true);
  const fs=operation=>fileSystem(platform,operation);
  const call=fn=>(...params)=>{try{return fn(...params);}catch(error){if(error instanceof Fault)return ERRNO.FAULT;if(error instanceof ErrnoError)return error.errno;throw error;}};
  const notSupported=name=>(..._params)=>{unsupported.add(name);return ERRNO.NOTSUP;};
  const iovecs=(pointer,count)=>{
    const size=word(count);if(size>1024)throw new ErrnoError(ERRNO.INVAL);
    const source=view(pointer,size*8),result=[];let total=0;
    for(let index=0;index<size;index++){const offset=source.getUint32(index*8,true),length=source.getUint32(index*8+4,true);range(offset,length);total+=length;if(total>MAX_FILE)throw new ErrnoError(ERRNO.INVAL);result.push({offset,length});}
    return result;
  };
  function stringsGet(values,pointers,buffer){range(pointers,values.length*4);range(buffer,values.reduce((sum,x)=>sum+x.length,0));let offset=word(buffer);for(let index=0;index<values.length;index++){u32(word(pointers)+index*4,offset);range(offset,values[index].length).set(values[index]);offset+=values[index].length;}return 0;}
  function stringsSize(values,count,size){range(count,4);range(size,4);u32(count,values.length);u32(size,values.reduce((sum,x)=>sum+x.length,0));return 0;}
  function stat(fd){fd=word(fd);if(fd<3)return {kind:"character",bytes:0,readonly:fd===0};return fs({op:"stat_fd",fd});}
  function fileType(kind){if(kind==="directory")return 3;if(kind==="file")return 4;if(kind==="character")return 2;throw new Error("Invalid Rust file type");}
  function writeStat(pointer,value,times=zeroTimes()){const output=view(pointer,64);output.setBigUint64(0,0n,true);output.setBigUint64(8,0n,true);output.setUint8(16,fileType(value.kind));for(let index=17;index<24;index++)output.setUint8(index,0);output.setBigUint64(24,1n,true);output.setBigUint64(32,BigInt(value.bytes),true);const retained=canonicalFileTimes(times);for(const [offset,key] of [[40,"atime"],[48,"mtime"],[56,"ctime"]])output.setBigUint64(offset,BigInt(retained[key]),true);}
  // Millisecond quantization gives the platform clock an honest fixed resolution
  // without requesting high-resolution/cross-origin-isolated browser timers.
  function time(clock){if(clock===0)return BigInt(Math.floor(now()))*1000000n;if(clock===1)return BigInt(Math.floor(monotonic()))*1000000n;throw new ErrnoError(ERRNO.NOTSUP);}
  function timestampUpdate(atime,mtime,flags){
    flags=word(flags);atime=bigint(atime);mtime=bigint(mtime);
    if((flags&~15)||(flags&3)===3||(flags&12)===12)throw new ErrnoError(ERRNO.INVAL);
    if(!flags)return null;
    const changed=time(0);if(changed<0n||changed>MAX_TIMESTAMP)throw new ErrnoError(ERRNO.INVAL);
    return {atime:flags&2?changed.toString():flags&1?atime.toString():null,
      mtime:flags&8?changed.toString():flags&4?mtime.toString():null,ctime:changed.toString()};
  }
  const wasi={
    args_get:call((p,b)=>stringsGet(argBytes,p,b)),args_sizes_get:call((c,s)=>stringsSize(argBytes,c,s)),
    environ_get:call((p,b)=>stringsGet(envBytes,p,b)),environ_sizes_get:call((c,s)=>stringsSize(envBytes,c,s)),
    clock_time_get:call((clock,_precision,p)=>{range(p,8);u64(p,time(word(clock)));return 0;}),
    clock_res_get:call((clock,p)=>{range(p,8);const value=word(clock);if(value>1)return ERRNO.NOTSUP;u64(p,1000000n);return 0;}),
    random_get:call((p,length)=>{const target=range(p,length);if(target.length>MAX_FILE)return ERRNO.INVAL;if(!crypto?.getRandomValues)return ERRNO.NOTSUP;for(let start=0;start<target.length;start+=MAX_TRANSFER)crypto.getRandomValues(target.subarray(start,start+MAX_TRANSFER));return 0;}),
    fd_prestat_get:call((fd,p)=>{range(p,8);if(word(fd)!==3)return ERRNO.BADF;const v=view(p,8);v.setUint32(0,0,true);v.setUint32(4,1,true);return 0;}),
    fd_prestat_dir_name:call((fd,p,length)=>{range(p,length);if(word(fd)!==3)return ERRNO.BADF;if(word(length)<1)return ERRNO.INVAL;range(p,1)[0]=47;return 0;}),
    fd_fdstat_get:call((fd,p)=>{range(p,24);const value=stat(fd),flags=word(fd)<3?{append:false,writable:word(fd)!==0}:fs({op:"fd_flags",fd:word(fd)});const v=view(p,24);new Uint8Array(v.buffer,v.byteOffset,24).fill(0);v.setUint8(0,fileType(value.kind));v.setUint16(2,flags.append?1:0,true);const rights=value.kind==="directory"?DIRECTORY_RIGHTS&(value.readonly?~(0x800000n|0x100000n):~0n):value.kind==="character"?(word(fd)===0?READ:WRITE):FILE_RIGHTS & (flags.writable?~0n:~(WRITE|8n|0x400000n)) & (value.readonly?~0x800000n:~0n);v.setBigUint64(8,rights,true);v.setBigUint64(16,value.kind==="directory"?(DIRECTORY_RIGHTS|FILE_RIGHTS):0n,true);return 0;}),
    fd_fdstat_set_flags:call((fd,flags)=>{fd=word(fd);flags=word(flags);if(flags&~1)return ERRNO.NOTSUP;if(fd<3)return flags===0?0:ERRNO.NOTSUP;fs({op:"set_append",fd,append:Boolean(flags&1)});return 0;}),
    fd_filestat_get:call((fd,p)=>{range(p,64);fd=word(fd);writeStat(p,stat(fd),fd<3?zeroTimes():fs({op:"get_times",fd}));return 0;}),
    fd_filestat_set_times:call((fd,atime,mtime,flags)=>{fd=word(fd);const update=timestampUpdate(atime,mtime,flags);if(fd<3)return ERRNO.BADF;const value=stat(fd);if(value.readonly)return ERRNO.ROFS;if(update)fs({op:"set_times",fd,...update});return 0;}),
    fd_filestat_set_size:call((fd,size)=>{size=bigint(size);if(size>BigInt(MAX_FILE))return ERRNO.INVAL;fs({op:"resize",fd:word(fd),size:Number(size)});return 0;}),
    fd_close:call(fd=>{fd=word(fd);if(fd<3)return ERRNO.NOTSUP;fs({op:"close",fd});return 0;}),
    fd_read:call((fd,p,count,out)=>{range(out,4);const vectors=iovecs(p,count);fd=word(fd);if(fd===1||fd===2)return ERRNO.BADF;if(fd===0){u32(out,0);return 0;}let total=0;outer:for(const io of vectors){for(let offset=0;offset<io.length;offset+=MAX_TRANSFER){const length=Math.min(MAX_TRANSFER,io.length-offset),response=fs({op:"read",fd,length}),data=bytes(response.bytes);if(data.length>length||response.count!==data.length)throw new Error("Invalid Rust read result");range(io.offset+offset,data.length).set(data);total+=data.length;if(data.length<length)break outer;}}u32(out,total);return 0;}),
    fd_write:call((fd,p,count,out)=>{range(out,4);const vectors=iovecs(p,count);fd=word(fd);if(fd===0)return ERRNO.BADF;let total=0;for(const io of vectors){for(let offset=0;offset<io.length;offset+=MAX_TRANSFER){const data=range(io.offset+offset,Math.min(MAX_TRANSFER,io.length-offset)).slice();let written;if(fd===1||fd===2){(fd===1?stdout:stderr)(data);written=data.length;}else{written=fs({op:"write",fd,bytes:Array.from(data)}).count;if(!Number.isInteger(written)||written<0||written>data.length)throw new Error("Invalid Rust write result");}total+=written;if(written<data.length){u32(out,total);return 0;}}}u32(out,total);return 0;}),
    fd_seek:call((fd,offset,whence,p)=>{range(p,8);fd=word(fd);if(fd<3)return ERRNO.SPIPE;const mode=["start","current","end"][word(whence)];if(!mode)return ERRNO.INVAL;u64(p,BigInt(fs({op:"seek",fd,offset:bigint(offset,true).toString(),whence:mode}).offset));return 0;}),
    fd_tell:call((fd,p)=>{range(p,8);fd=word(fd);if(fd<3)return ERRNO.SPIPE;u64(p,BigInt(fs({op:"tell",fd}).offset));return 0;}),
    fd_readdir:call((fd,p,length,cookie,out)=>{range(p,length);range(out,4);cookie=bigint(cookie);const entries=fs({op:"readdir",fd:word(fd)});if(!Array.isArray(entries)||entries.length>MAX_ENTRIES)throw new Error("Invalid Rust directory result");if(cookie>BigInt(entries.length)){u32(out,0);return 0;}let offset=0;for(let index=Number(cookie);index<entries.length&&offset<word(length);index++){const entry=entries[index],name=encoder.encode(entry.name);if(name.length>255)throw new Error("Invalid Rust directory name");const record=new Uint8Array(24+name.length),v=new DataView(record.buffer);v.setBigUint64(0,BigInt(index+1),true);v.setBigUint64(8,0n,true);v.setUint32(16,name.length,true);v.setUint8(20,fileType(entry.kind));record.set(name,24);const part=record.subarray(0,word(length)-offset);range(word(p)+offset,part.length).set(part);offset+=part.length;}u32(out,offset);return 0;}),
    path_open:call((fd,lookup,p,length,oflags,rights,inheriting,flags,out)=>{range(out,4);const path=readPath(p,length);lookup=word(lookup);oflags=word(oflags);flags=word(flags);rights=bigint(rights);inheriting=bigint(inheriting);if(lookup&~1||oflags&~15)return ERRNO.INVAL;if(flags&~1)return ERRNO.NOTSUP;if((rights|inheriting)&~OPEN_RIGHTS)return ERRNO.NOTCAPABLE;const result=fs({op:"open",dir_fd:word(fd),path,flags:{create:Boolean(oflags&1),directory:Boolean(oflags&2),exclusive:Boolean(oflags&4),truncate:Boolean(oflags&8),writable:Boolean(rights&WRITE),append:Boolean(flags&1)}});u32(out,result.fd);return 0;}),
    path_filestat_get:call((fd,lookup,p,length,out)=>{range(out,64);if(word(lookup)&~1)return ERRNO.INVAL;const target={dir_fd:word(fd),path:readPath(p,length)};writeStat(out,fs({op:"stat_path",...target}),fs({op:"get_path_times",...target}));return 0;}),
    path_filestat_set_times:call((fd,lookup,p,length,atime,mtime,flags)=>{if(word(lookup)&~1)return ERRNO.INVAL;const target={dir_fd:word(fd),path:readPath(p,length)},update=timestampUpdate(atime,mtime,flags);const value=fs({op:"stat_path",...target});if(value.readonly)return ERRNO.ROFS;if(update)fs({op:"set_path_times",...target,...update});return 0;}),
    path_create_directory:call((fd,p,length)=>{fs({op:"mkdir",dir_fd:word(fd),path:readPath(p,length)});return 0;}),
    path_unlink_file:call((fd,p,length)=>{fs({op:"unlink",dir_fd:word(fd),path:readPath(p,length),directory:false});return 0;}),
    path_remove_directory:call((fd,p,length)=>{fs({op:"unlink",dir_fd:word(fd),path:readPath(p,length),directory:true});return 0;}),
    path_rename:call((old,p,length,next,q,size)=>{const first=readPath(p,length),second=readPath(q,size);fs({op:"rename",old_fd:word(old),old_path:first,new_fd:word(next),new_path:second});return 0;}),
    // POSIX advice is explicitly a nonbinding hint; an in-memory store needs none.
    fd_advise:call((fd,offset,length,advice)=>{bigint(offset);bigint(length);stat(fd);return word(advice)<=5?0:ERRNO.INVAL;}),
    sched_yield:()=>0,
    proc_exit:code=>{throw new WasiExit(word(code));},
  };
  for(const name of unsupportedNames)wasi[name]=notSupported(name);
  async function poll(input,output,count,out){
    try{
      const size=word(count);if(size===0||size>256)return ERRNO.INVAL;
      const source=view(input,size*48);range(output,size*32);range(out,4);const subscriptions=[];
      for(let index=0;index<size;index++){const base=index*48,type=source.getUint8(base+8),userdata=source.getBigUint64(base,true);if(type===0){const clock=source.getUint32(base+16,true),flags=source.getUint16(base+40,true);if(flags&~1)return ERRNO.INVAL;const timeout=source.getBigUint64(base+24,true);subscriptions.push({type,userdata,clock,deadline:flags&1?timeout:time(clock)+timeout});}else if(type===1||type===2){subscriptions.push({type,userdata,fd:source.getUint32(base+16,true)});}else return ERRNO.INVAL;}
      function ready(){const result=[];for(const entry of subscriptions){if(entry.type===0){if(time(entry.clock)>=entry.deadline)result.push({...entry,errno:0,nbytes:0n});}else{try{const value=stat(entry.fd);if(entry.type===2){if(entry.fd===0)throw new ErrnoError(ERRNO.BADF);if(entry.fd>=3&&!fs({op:"fd_flags",fd:entry.fd}).writable)throw new ErrnoError(ERRNO.NOTCAPABLE);result.push({...entry,errno:0,nbytes:0n});}else if(entry.fd===0)result.push({...entry,errno:0,nbytes:0n});else if(entry.fd===1||entry.fd===2)throw new ErrnoError(ERRNO.BADF);else if(value.kind==="file"){const position=BigInt(fs({op:"tell",fd:entry.fd}).offset);result.push({...entry,errno:0,nbytes:BigInt(value.bytes)>position?BigInt(value.bytes)-position:0n});}else throw new ErrnoError(ERRNO.ISDIR);}catch(error){if(!(error instanceof ErrnoError))throw error;result.push({...entry,errno:error.errno,nbytes:0n});}}}return result;}
      let events=ready();while(events.length===0){const waits=subscriptions.filter(x=>x.type===0).map(x=>x.deadline-time(x.clock));if(!waits.length)return ERRNO.NOTSUP;const minimum=waits.reduce((a,b)=>a<b?a:b);await sleep(Math.max(0,Math.min(1000,Number((minimum+999999n)/1000000n))));events=ready();}
      range(output,size*32);range(out,4);for(let index=0;index<events.length;index++){const v=view(word(output)+index*32,32);new Uint8Array(v.buffer,v.byteOffset,32).fill(0);v.setBigUint64(0,events[index].userdata,true);v.setUint16(8,events[index].errno,true);v.setUint8(10,events[index].type);v.setBigUint64(16,events[index].nbytes,true);}u32(out,events.length);return 0;
    }catch(error){if(error instanceof Fault)return ERRNO.FAULT;if(error instanceof ErrnoError)return error.errno;throw error;}
  }
  const supportsJSPI=typeof WebAssembly.Suspending==="function"&&typeof WebAssembly.promising==="function";
  wasi.poll_oneoff=supportsJSPI?new WebAssembly.Suspending(poll):notSupported("poll_oneoff requires JSPI");
  function required(name){if(typeof bridge[name]!=="function")throw new Error(`Original-core callback required: ${name}`);return bridge[name];}
  function resolveSemantic(input){if(typeof bridge.resolveText==="function")return bridge.resolveText(input);const request=JSON.parse(decoder.decode(input));if(request.kind!=="native_text"||typeof request.id!=="string"||!request.parameters||typeof request.parameters!=="object"||Array.isArray(request.parameters))throw new Error("Invalid original-core semantic request");const response=platform({...request,english:language==="en"});if(typeof response.semantic?.text!=="string")throw new Error("Original-core semantic ID/parameters missing");return response.semantic.text;}
  const host={
    poll_event:(pointer,capacity,peek)=>{if(word(capacity)!==128||word(peek)>1)return -1;range(pointer,128);const packet=required("pollEvent")(Boolean(peek));if(packet==null)return 0;const data=bytes(packet);if(data.length!==128||new DataView(data.buffer,data.byteOffset,128).getUint32(0,true)!==1)throw new Error("Invalid original-core input packet");range(pointer,128).set(data);return 1;},
    event_pending:()=>{const result=required("eventPending")();if(typeof result!=="boolean")throw new Error("Invalid original-core pending result");return Number(result);},
    sleep:supportsJSPI?new WebAssembly.Suspending(async milliseconds=>{const duration=word(milliseconds);if(duration>60000)throw new Error("Original-core sleep exceeds 60 seconds");await sleep(duration);}):()=>{throw new Error("Browser JSPI unavailable; original-core sleep cannot suspend");},
    now_ms:()=>Math.floor(monotonic())>>>0,
    frame:(pointer,length)=>{if(word(length)!==24032)throw new Error("Invalid original-core frame length");const data=range(pointer,length).slice(),v=new DataView(data.buffer);if(v.getUint32(0,true)!==0x464c5244||v.getUint32(4,true)!==1||v.getUint32(8,true)!==80||v.getUint32(12,true)!==25)throw new Error("Invalid original-core frame header");required("frame")(data);},
    draw_command:(header,headerLength,text,textLength)=>{if(word(headerLength)!==64||word(textLength)>MAX_TRANSFER)throw new Error("Invalid original-core draw command length");const command=range(header,headerLength).slice(),value=range(text,textLength).slice(),v=new DataView(command.buffer);if(v.getUint32(0,true)!==1||v.getUint32(4,true)>5)throw new Error("Invalid original-core draw command header");required("drawCommand")(command,value);},
    text_input:enabled=>{if(word(enabled)>1)throw new Error("Invalid original-core text input flag");required("textInput")(Boolean(enabled));},
    title:(pointer,length)=>{if(word(length)>MAX_TRANSFER)throw new Error("Invalid original-core title length");required("title")(range(pointer,length).slice());},
    resolve_text:(request,length,output,capacity)=>{if(word(length)>32768||word(capacity)>32768)throw new Error("Original-core semantic text quota exceeded");const input=range(request,length).slice();const result=resolveSemantic(input);const text=typeof result==="string"?encoder.encode(result):bytes(result);if(text.length>32768)throw new Error("Original-core semantic projection quota exceeded");if(word(capacity)===0)return text.length;if(word(capacity)<text.length)return -1;range(output,capacity);range(output,text.length).set(text);return text.length;},
    text_columns:(pointer,length)=>{if(word(length)>MAX_TRANSFER)throw new Error("Original-core CJK text quota exceeded");const data=range(pointer,length).slice(),callback=bridge.textColumns??platform.textColumns;if(typeof callback!=="function")throw new Error("Rust CJK width adapter required");const result=callback(data);if(!Number.isInteger(result)||result < -1||result>131072)throw new Error("Invalid Rust CJK width result");return result;},
    text_fit:(pointer,length,columns)=>{if(word(length)>MAX_TRANSFER)throw new Error("Original-core CJK text quota exceeded");const data=range(pointer,length).slice(),callback=bridge.textFit??platform.textFit;if(typeof callback!=="function")throw new Error("Rust CJK prefix adapter required");const result=callback(data,word(columns));if(!Number.isInteger(result)||result < -1||result>data.length)throw new Error("Invalid Rust CJK prefix result");if(result===-1)console.warn("DRL text_fit rejected "+JSON.stringify({length:data.length,columns:word(columns),prefix:Array.from(data.subarray(0,128))}));return result;},
    rumble:(low,high,duration)=>{low=word(low);high=word(high);duration=word(duration);if(low>65535||high>65535||duration>60000)return -1;if(typeof bridge.rumble!=="function")return 0;return bridge.rumble(low,high,duration)===true?1:0;},
  };
  // The production core avoids libc's incompatible sleep(i32)->i32 symbol.
  // Keep the original spelling for the already verified authored probes.
  host.drl_sleep=host.sleep;
  const imports={wasi_snapshot_preview1:wasi,drl_host:host};
  return {
    imports,supportsJSPI,unsupportedImports:()=>Array.from(unsupported).sort(),
    setLanguage(value){if(value!=="ja"&&value!=="en")throw new TypeError("Unsupported DRL locale");language=value;},
    get language(){return language;},
    bind(value){if(instance)throw new Error("Core host already bound");const exports=value.exports??value;if(!(exports.memory instanceof WebAssembly.Memory))throw new Error("Original core must export memory");instance=exports;memory=exports.memory;return this;},
    async instantiate(source){const module=source instanceof WebAssembly.Module?source:await WebAssembly.compile(source);for(const entry of WebAssembly.Module.imports(module)){if(entry.kind!=="function"||!Object.hasOwn(imports,entry.module)||!Object.hasOwn(imports[entry.module],entry.name))throw new Error(`Unsupported core import: ${entry.module}.${entry.name} (${entry.kind})`);imported.add(`${entry.module}.${entry.name}`);}if(!supportsJSPI&&(imported.has("drl_host.sleep")||imported.has("drl_host.drl_sleep")||imported.has("wasi_snapshot_preview1.poll_oneoff")))throw new Error("Browser requires WebAssembly.Suspending/promising for original-core continuation");const value=await WebAssembly.instantiate(module,imports);this.bind(value);return value;},
    async start(){if(!instance||typeof instance._start!=="function")throw new Error("Original core _start unavailable");if(started||running)throw new Error("Original core can only start once");started=true;running=true;try{if(supportsJSPI)await WebAssembly.promising(instance._start)();else instance._start();return 0;}catch(error){if(error instanceof WasiExit)return error.code;throw error;}finally{running=false;}},
    get running(){return running;},
  };
}

async function hashBytes(crypto,data){if(!crypto?.subtle?.digest)throw new Error("Browser SHA256 unavailable");const value=await crypto.subtle.digest("SHA-256",data);return Array.from(new Uint8Array(value),x=>x.toString(16).padStart(2,"0")).join("");}
async function hashFileMetadata(crypto,entry){return hashBytes(crypto,encoder.encode(JSON.stringify({path:entry.path,kind:entry.kind,sha256:entry.sha256,times:canonicalFileTimes(entry.times)})));}
async function hashSnapshotMetadata(crypto,snapshot){return hashBytes(crypto,encoder.encode(JSON.stringify({version:2,format:snapshot.format,identity:snapshot.identity,root_times:canonicalFileTimes(snapshot.root_times),entries:snapshot.entries.map(entry=>({path:entry.path,metadata_sha256:entry.metadata_sha256})).sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0)})));}
async function validateSnapshot(snapshot,identity,crypto){
  if(snapshot===undefined||snapshot===null)throw new CoreStorageError("no_save","No original-core native-file snapshot exists");
  if(!snapshot||![1,2].includes(snapshot.version)||snapshot.format!=="drl-original-core-files"||snapshot.identity!==identity||!Array.isArray(snapshot.entries)||snapshot.entries.length>MAX_ENTRIES)throw new Error("Original-core file snapshot identity/version invalid");
  if(snapshot.version===1&&(Object.hasOwn(snapshot,"root_times")||Object.hasOwn(snapshot,"metadata_sha256")))throw new Error("Legacy original-core snapshot contains unversioned root metadata");
  const root_times=snapshot.version===1?zeroTimes():canonicalFileTimes(snapshot.root_times);
  let total=0;const names=new Set(),entries=[];
  for(const entry of snapshot.entries){
    if(!entry||typeof entry.path!=="string"||encoder.encode(entry.path).length>1024||!entry.path.startsWith("/")||entry.path==="/"||entry.path.includes("\\")||entry.path.includes("\0")||entry.path.split("/").slice(1).some(x=>!x||x==="."||x===".."||encoder.encode(x).length>255)||names.has(entry.path)||!["file","directory"].includes(entry.kind))throw new Error("Original-core file snapshot path invalid");
    names.add(entry.path);if(!entry.bytes||entry.bytes.length>MAX_FILE)throw new Error("Original-core file snapshot entry quota exceeded");
    const data=bytes(entry.bytes).slice();if(data.length>MAX_FILE||(entry.kind==="directory"&&data.length))throw new Error("Original-core file snapshot entry invalid");
    total+=data.length;if(total>MAX_TOTAL)throw new Error("Original-core file snapshot quota exceeded");
    if(typeof entry.sha256!=="string"||!/^[0-9a-f]{64}$/.test(entry.sha256)||await hashBytes(crypto,data)!==entry.sha256)throw new Error("Original-core file snapshot checksum invalid");
    if(snapshot.version===1&&(Object.hasOwn(entry,"times")||Object.hasOwn(entry,"metadata_sha256")))throw new Error("Legacy original-core snapshot contains unversioned timestamps");
    const retained={path:entry.path,kind:entry.kind,bytes:data,sha256:entry.sha256,times:snapshot.version===1?zeroTimes():canonicalFileTimes(entry.times)};
    const metadata=await hashFileMetadata(crypto,retained);
    if(snapshot.version===2&&(typeof entry.metadata_sha256!=="string"||entry.metadata_sha256!==metadata))throw new Error("Original-core file snapshot metadata checksum invalid");
    retained.metadata_sha256=metadata;entries.push(retained);
  }
  const retained={version:2,format:"drl-original-core-files",identity,root_times,entries};
  retained.metadata_sha256=await hashSnapshotMetadata(crypto,retained);
  if(snapshot.version===2&&snapshot.metadata_sha256!==retained.metadata_sha256)throw new Error("Original-core snapshot metadata checksum invalid");
  return retained;
}
/** Call save only at an original-core paused seam; this saves native file bytes,
 * never a JavaScript copy/reimplementation of live gameplay state. */
export function createCoreStorage({identity,databaseName="drl-original-core",indexedDB=globalThis.indexedDB,crypto=globalThis.crypto}={}){
  if(typeof identity!=="string"||!identity||identity.length>256)throw new TypeError("Pinned original-core identity required");
  if(!indexedDB?.open)throw new Error("Browser IndexedDB unavailable");
  function database(){return new Promise((resolve,reject)=>{const request=indexedDB.open(databaseName,1);request.onupgradeneeded=()=>request.result.createObjectStore("snapshots");request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error??new Error("IndexedDB open failed"));});}
  async function store(value){const db=await database();try{await new Promise((resolve,reject)=>{const tx=db.transaction("snapshots","readwrite");tx.objectStore("snapshots").put(value,"latest");tx.oncomplete=()=>resolve();tx.onerror=tx.onabort=()=>reject(tx.error??new Error("IndexedDB save did not commit"));});}finally{db.close();}}
  async function load(){const db=await database();try{return await new Promise((resolve,reject)=>{const tx=db.transaction("snapshots","readonly"),request=tx.objectStore("snapshots").get("latest");let value;request.onsuccess=()=>{value=request.result;};tx.oncomplete=()=>resolve(value);tx.onerror=tx.onabort=()=>reject(tx.error??new Error("IndexedDB read did not complete"));});}finally{db.close();}}
  return {
    async save(platform){
      const entries=fileSystem(platform,{op:"list_writable"});if(!Array.isArray(entries)||entries.length>MAX_ENTRIES)throw new Error("Rust writable tree invalid");
      const snapshot={version:2,format:"drl-original-core-files",identity,root_times:canonicalFileTimes(fileSystem(platform,{op:"get_times",fd:3})),entries:[]};let total=0;
      for(const entry of entries){
        if(!entry||!entry.stat||!["file","directory"].includes(entry.stat.kind)||!Number.isSafeInteger(entry.stat.bytes)||entry.stat.bytes<0||entry.stat.bytes>MAX_FILE)throw new Error("Native save file quota exceeded");
        total+=entry.stat.bytes;if(total>MAX_TOTAL)throw new Error("Native save aggregate quota exceeded");
        const times=canonicalFileTimes(fileSystem(platform,{op:"get_path_times",dir_fd:3,path:entry.path.slice(1)}));
        const data=new Uint8Array(entry.stat.bytes);
        if(entry.stat.kind==="file"){
          const {fd}=fileSystem(platform,{op:"open",dir_fd:3,path:entry.path.slice(1),flags:{create:false,exclusive:false,truncate:false,writable:false,append:false,directory:false}});
          try{let offset=0;while(offset<data.length){const result=fileSystem(platform,{op:"read",fd,length:Math.min(MAX_TRANSFER,data.length-offset)}),chunk=bytes(result.bytes);if(chunk.length===0||result.count!==chunk.length||chunk.length>data.length-offset)throw new Error("Native save file changed during capture");data.set(chunk,offset);offset+=chunk.length;}}
          finally{fileSystem(platform,{op:"close",fd});}
        }
        const retained={path:entry.path,kind:entry.stat.kind,bytes:data,sha256:await hashBytes(crypto,data),times};
        retained.metadata_sha256=await hashFileMetadata(crypto,retained);snapshot.entries.push(retained);
      }
      snapshot.metadata_sha256=await hashSnapshotMetadata(crypto,snapshot);
      await validateSnapshot(snapshot,identity,crypto);await store(snapshot);
      return {files:snapshot.entries.filter(x=>x.kind==="file").length,bytes:snapshot.entries.reduce((sum,x)=>sum+x.bytes.length,0)};
    },
    async restore({createPlatform,mountAssets}){
      const snapshot=await validateSnapshot(await load(),identity,crypto);
      if(typeof createPlatform!=="function"||typeof mountAssets!=="function")throw new TypeError("Fresh Rust platform factory and verified asset mount required");
      const candidate=await createPlatform();await mountAssets(candidate);
      const ordered=[...snapshot.entries].sort((a,b)=>a.path.split("/").length-b.path.split("/").length||a.path.localeCompare(b.path,"en"));
      for(const entry of ordered){
        const target={dir_fd:3,path:entry.path.slice(1)};
        if(entry.kind==="directory"){
          try{fileSystem(candidate,{op:"mkdir",...target});}
          catch(error){if(!(error instanceof ErrnoError)||error.errno!==ERRNO.EXIST)throw error;const current=fileSystem(candidate,{op:"stat_path",...target});if(current.kind!=="directory"||current.readonly)throw new Error("Native save directory conflicts with mounted asset");}
        }else{
          const {fd}=fileSystem(candidate,{op:"open",...target,flags:{create:true,exclusive:true,truncate:false,writable:true,append:false,directory:false}});
          try{const data=bytes(entry.bytes);for(let offset=0;offset<data.length;offset+=MAX_TRANSFER){const chunk=data.subarray(offset,offset+MAX_TRANSFER),result=fileSystem(candidate,{op:"write",fd,bytes:Array.from(chunk)});if(result.count!==chunk.length)throw new Error("Native save restore short write");}}
          finally{fileSystem(candidate,{op:"close",fd});}
        }
        fileSystem(candidate,{op:"set_path_times",...target,...entry.times});
      }
      fileSystem(candidate,{op:"set_times",fd:3,...snapshot.root_times});
      return candidate;
    },
    async readSnapshot(){const snapshot=await load();return snapshot===undefined||snapshot===null?null:validateSnapshot(snapshot,identity,crypto);},
  };
}
