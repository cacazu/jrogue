/* SPDX-License-Identifier: GPL-3.0-or-later
 * Browser ZIP32 verification over the actual original FS archive bytes.
 * The original engine still loads through its bundled PhysFS ZIP reader.
 * No guessed minizip reader, Node-only Buffer/zlib, or saved Lua execution.
 */
const crcTable=new Uint32Array(256);
for(let i=0;i<256;i++){let n=i;for(let bit=0;bit<8;bit++)n=(n&1)?0xedb88320^(n>>>1):n>>>1;crcTable[i]=n>>>0;}
function need(ok,id,detail){if(!ok){const error=new Error(id);error.text_id=id;error.detail=detail;throw error;}}
const hex=bytes=>Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
async function sha(bytes){return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)));}
async function inflateMember(packed,method,expected,limit,capture){
  need(expected<=limit,'save.zip.inflation_limit');
  let stream;
  if(method===0) stream=new Blob([packed]).stream();
  else{
    need(typeof DecompressionStream==='function','save.zip.browser_deflate_required');
    try{stream=new Blob([packed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));}
    catch(error){need(false,'save.zip.browser_deflate_required',String(error));}
  }
  const reader=stream.getReader(),decoder=capture?new TextDecoder('utf-8'):null;
  let bytes=0,crc=0xffffffff,decoded='';
  try{
    for(;;){const chunk=await reader.read();if(chunk.done)break;
      bytes+=chunk.value.length;
      need(bytes<=expected&&bytes<=limit,'save.zip.inflation_limit');
      for(const byte of chunk.value)crc=crcTable[(crc^byte)&255]^(crc>>>8);
      if(decoder)decoded+=decoder.decode(chunk.value,{stream:true});
    }
    if(decoder)decoded+=decoder.decode();
  }catch(error){await reader.cancel(error).catch(()=>{});throw error;}
  finally{reader.releaseLock();}
  return {bytes,crc:(crc^0xffffffff)>>>0,text:decoded};
}
export async function inspectBrowserGraphZip(bytes,{expectedMainClass,maxArchiveBytes=16777216,maxInflatedBytes=67108864,maxEntries=8192}={}){
  need(bytes instanceof Uint8Array&&bytes.length>=22&&bytes.length<=maxArchiveBytes,'save.zip.archive_limit');
  need(typeof expectedMainClass==='string'&&/^(?:engine|mod)\.[A-Za-z_][A-Za-z0-9_.]*$/.test(expectedMainClass),'save.zip.invalid_expected_class');
  need(Number.isSafeInteger(maxArchiveBytes)&&maxArchiveBytes>0&&maxArchiveBytes<=33554432&&
    Number.isSafeInteger(maxInflatedBytes)&&maxInflatedBytes>0&&maxInflatedBytes<=134217728&&
    Number.isSafeInteger(maxEntries)&&maxEntries>0&&maxEntries<=16384,'save.zip.invalid_limits');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),u16=p=>view.getUint16(p,true),u32=p=>view.getUint32(p,true);
  let end=-1;
  for(let p=bytes.length-22;p>=Math.max(0,bytes.length-65557);p--)
    if(u32(p)===0x06054b50&&p+22+u16(p+20)===bytes.length){end=p;break;}
  need(end>=0,'save.zip.end_record_missing');
  const count=u16(end+10),centralSize=u32(end+12),centralOffset=u32(end+16);
  need(u16(end+4)===0&&u16(end+6)===0&&u16(end+8)===count,'save.zip.multidisk_unsupported');
  need(count>0&&count<=maxEntries&&centralOffset+centralSize===end,'save.zip.central_directory_bounds');
  const records=[],names=new Set(),ranges=[],methods=new Set();let cursor=centralOffset,total=0,mainClass=null;
  for(let index=0;index<count;index++){
    need(cursor+46<=end&&u32(cursor)===0x02014b50,'save.zip.central_header_invalid');
    const flags=u16(cursor+8),method=u16(cursor+10),crc=u32(cursor+16),packedSize=u32(cursor+20),plainSize=u32(cursor+24);
    const nameSize=u16(cursor+28),extraSize=u16(cursor+30),commentSize=u16(cursor+32),local=u32(cursor+42);
    const next=cursor+46+nameSize+extraSize+commentSize;
    need(nameSize>0&&next<=end&&u16(cursor+34)===0&&!(flags&0x41)&&[0,8].includes(method),'save.zip.member_unsupported');
    const nameBytes=bytes.subarray(cursor+46,cursor+46+nameSize);
    need(Array.from(nameBytes).every(x=>x>=32&&x<127),'save.zip.member_name_invalid');
    const name=String.fromCharCode(...nameBytes);
    need(!names.has(name)&&!/[\\/]/.test(name)&&name!=='.'&&name!=='..','save.zip.member_name_invalid');names.add(name);
    need(local+30<=centralOffset&&u32(local)===0x04034b50&&u16(local+6)===flags&&u16(local+8)===method,'save.zip.local_header_invalid');
    const localNameSize=u16(local+26),localExtraSize=u16(local+28),start=local+30+localNameSize+localExtraSize;
    need(localNameSize===nameSize&&start+packedSize<=centralOffset&&total+plainSize<=maxInflatedBytes,'save.zip.data_bounds');
    for(let n=0;n<nameSize;n++)need(bytes[local+30+n]===nameBytes[n],'save.zip.local_name_mismatch');
    let rangeEnd=start+packedSize;
    if(!(flags&8))need(u32(local+14)===crc&&u32(local+18)===packedSize&&u32(local+22)===plainSize,'save.zip.local_size_mismatch');
    else{
      need(rangeEnd+12<=centralOffset,'save.zip.descriptor_invalid');
      const descriptor=rangeEnd+(u32(rangeEnd)===0x08074b50?4:0);
      need(descriptor+12<=centralOffset&&u32(descriptor)===crc&&u32(descriptor+4)===packedSize&&u32(descriptor+8)===plainSize,'save.zip.descriptor_invalid');
      rangeEnd=descriptor+12;
    }
    for(const prior of ranges)need(rangeEnd<=prior.start||local>=prior.end,'save.zip.overlapping_members');
    ranges.push({start:local,end:rangeEnd});
    const decoded=await inflateMember(bytes.subarray(start,start+packedSize),method,plainSize,maxInflatedBytes-total,name==='main');
    need(decoded.bytes===plainSize&&decoded.crc===crc,'save.zip.member_crc_mismatch',name);
    if(name==='main'){
      const match=/^d\["__CLASSNAME"\]\s*=\s*"([^"]+)"/m.exec(decoded.text);
      mainClass=match?.[1]||null;need(mainClass===expectedMainClass,'save.zip.main_class_mismatch');
    }
    total+=plainSize;methods.add(method);
    records.push({name,method,compressed_bytes:packedSize,plain_bytes:plainSize,crc32:crc.toString(16).padStart(8,'0')});cursor=next;
  }
  need(cursor===end&&names.has('main')&&mainClass===expectedMainClass,'save.zip.main_class_mismatch');
  return {validated:true,zip_bytes:bytes.length,sha256:await sha(bytes),entries:records,entry_count:count,
    crc_members_verified:count,plain_bytes:total,compression_methods:[...methods].sort(),main_class:mainClass,
    saved_lua_executed:false,validator:'actual browser ZIP32 headers, DecompressionStream raw deflate, all sizes/CRC and root class'};
}
export function actualNativeArchiveValidator(module){
  need(typeof module.FS?.readFile==='function','save.zip.actual_fs_required');
  return async({paths})=>{
    const archives=[];
    for(const [role,expectedMainClass] of [['game','mod.class.Game'],['world','mod.class.World']])
      archives.push({role,...await inspectBrowserGraphZip(module.FS.readFile(paths[role]),{expectedMainClass})});
    return {validated:true,archives,validator:'actual browser FS ZIP integrity; original load uses bundled PhysFS'};
  };
}
