// Synthetic reference codec for lightweight checks only; not a browser renderer.
export const SOURCE_COMMIT = '7b2efa5cea38e4d4d97dd0e63b28b9148623da59';
export const limits = Object.freeze({ bytes:4*1024*1024, cellBytes:4096, cells:65536,
  windows:64, axis:1024, pins:4, palette:16 });
export function nativeFirstCodepoint(raw){
  if(!raw.length)return 0;const first=raw[0],second=raw[1]??0;let left=0,overlong=false,codepoint=0xfffd;
  if(first>=0xfc){if((first&0xfe)===0xfc){overlong=first===0xfc&&(second&0xfc)===0x80;codepoint=first&1;left=5;}}
  else if(first>=0xf8){if((first&0xfc)===0xf8){overlong=first===0xf8&&(second&0xf8)===0x80;codepoint=first&3;left=4;}}
  else if(first>=0xf0){if((first&0xf8)===0xf0){overlong=first===0xf0&&(second&0xf0)===0x80;codepoint=first&7;left=3;}}
  else if(first>=0xe0){if((first&0xf0)===0xe0){overlong=first===0xe0&&(second&0xe0)===0x80;codepoint=first&15;left=2;}}
  else if(first>=0xc0){if((first&0xe0)===0xc0){overlong=(first&0xde)===0xc0;codepoint=first&31;left=1;}}
  else if((first&0x80)===0)codepoint=first;
  let at=1;while(left>0&&at<raw.length){const byte=raw[at];if((byte&0xc0)!==0x80){codepoint=0xfffd;break;}
    codepoint=(codepoint<<6)|(byte&0x3f);++at;--left;}
  return overlong||left>0||(codepoint>=0xd800&&codepoint<=0xdfff)||codepoint===0xfffe||codepoint===0xffff||codepoint>0x10ffff?0xfffd:codepoint;
}
export function nativeLineDecision(codepoint,firstByte,option){
  const known=new Map([[0x2502,0xa0],[0x2500,0xa1],[0x2514,0xa2],[0x250c,0xa3],[0x2510,0xa4],[0x2518,0xa5],
    [0x251c,0xa6],[0x2534,0xa7],[0x2524,0xa8],[0x252c,0xa9],[0x253c,0xaa]]);
  if(known.has(codepoint))return [option,known.get(codepoint)];
  return [codepoint===0xfffd,firstByte];
}
export function encodeSnapshot(frame) {
  const chunks=[];let length=0;
  const append=bytes=>{length+=bytes.length;if(length>limits.bytes)throw new RangeError('snapshot bytes');chunks.push(Buffer.from(bytes));};
  const number=(value,size,signed=false)=>{const bytes=Buffer.alloc(size);if(size===8)bytes.writeBigUInt64LE(BigInt(value));
    else if(signed)bytes.writeIntLE(value,0,size);else bytes.writeUIntLE(value,0,size);append(bytes);};
  append(Buffer.from('CDTP'));number(1,2);number(0,2);number(frame.publication,8);
  append(Buffer.from(SOURCE_COMMIT));const build=Buffer.from(frame.build_id);number(build.length,4);append(build);
  number(frame.windows.length,4);
  for(const window of frame.windows){
    const record=encodeWindow(window);number(record.length,4);append(record);
  }
  return Buffer.concat(chunks);
}
function encodeWindow(window){
  const chunks=[];
  const number=(value,size,signed=false)=>{const bytes=Buffer.alloc(size);if(signed)bytes.writeIntLE(value,0,size);else bytes.writeUIntLE(value,0,size);chunks.push(bytes);};
  number(window.role,4);
  for(const value of [...window.origin,...window.shape,...window.cursor,...window.font_metrics,
    ...window.glyph_offset,...window.clip_size,window.scaling_factor])number(value,4,true);
  for(const value of [window.inuse,window.draw,window.ascii_lines_option,0])number(Number(value),1);
  for(const value of window.window_colors)number(value,2,true);
  for(const color of window.palette)for(const channel of color)number(channel,1);
  for(const row of window.rows){number(Number(row.touched),1);for(const cell of row.cells){
    number(cell.raw_bytes.length,4);chunks.push(Buffer.from(cell.raw_bytes));
    number(cell.foreground,2,true);number(cell.background,2,true);number(cell.first_codepoint,4);
    number(cell.native_width,4,true);number(Number(cell.ascii_lines),1);number(cell.line_id,1);
  }}
  return Buffer.concat(chunks);
}
export function decodeSnapshot(bytes,expectedBuild){
  bytes=Buffer.from(bytes);if(bytes.length>limits.bytes)throw new RangeError('snapshot bytes');
  let at=0,cellsSeen=0;
  const take=size=>{if(!Number.isInteger(size)||size<0||at+size>bytes.length)throw new Error('truncated');const result=bytes.subarray(at,at+size);at+=size;return result;};
  const u8=()=>take(1)[0],u16=()=>take(2).readUInt16LE(),i16=()=>take(2).readInt16LE(),u32=()=>take(4).readUInt32LE(),i32=()=>take(4).readInt32LE();
  const boolean=()=>{const value=u8();if(value>1)throw new Error('boolean');return Boolean(value);};
  if(take(4).toString()!=='CDTP'||u16()!==1||u16()!==0)throw new Error('schema');
  const publication=take(8).readBigUInt64LE();if(!publication)throw new Error('publication');
  if(take(40).toString()!==SOURCE_COMMIT)throw new Error('source');
  const buildLength=u32();if(!buildLength||buildLength>256)throw new RangeError('build length');
  const build=new TextDecoder('utf-8',{fatal:true}).decode(take(buildLength));if(build!==expectedBuild)throw new Error('build');
  const windowsCount=u32();if(windowsCount>limits.windows)throw new RangeError('windows');const windows=[];
  for(let index=0;index<windowsCount;++index){
    const recordLength=u32();if(recordLength>limits.bytes)throw new RangeError('window bytes');const end=at+recordLength;
    if(end>bytes.length)throw new Error('window truncated');
    const role=u32();if(role<1||role>4)throw new Error('font role');
    const fields=Array.from({length:13},i32);
    const [x,y,width,height,cx,cy,fw,fh,gx,gy,clipx,clipy,scale]=fields;
    if(width<1||width>limits.axis||height<1||height>limits.axis||fw<1||fh<1||clipx<1||clipy<1||scale<1)throw new RangeError('window geometry');
    cellsSeen+=width*height;if(cellsSeen>limits.cells)throw new RangeError('frame cells');
    const inuse=boolean(),draw=boolean(),ascii_lines_option=boolean();if(u8()!==0)throw new Error('reserved');
    const window_colors=[i16(),i16()];const palette=Array.from({length:16},()=>Array.from(take(4)));
    const rows=Array.from({length:height},()=>{
      const touched=boolean();const cells=Array.from({length:width},()=>{
        const size=u32();if(size>limits.cellBytes)throw new RangeError('cell bytes');
        const raw_bytes=Array.from(take(size)),foreground=i16(),background=i16(),first_codepoint=u32(),native_width=i32(),ascii_lines=boolean(),line_id=u8();
        const expectedCodepoint=nativeFirstCodepoint(raw_bytes),[expectedLines,expectedId]=nativeLineDecision(expectedCodepoint,raw_bytes[0]??0,ascii_lines_option);
        if(first_codepoint!==expectedCodepoint||ascii_lines!==expectedLines||line_id!==expectedId||(!size&&native_width!==0)||
          (size&&first_codepoint===0xfffd&&native_width!==1)||(size===1&&raw_bytes[0]===32&&native_width!==1))throw new Error('derived cell');
        return {raw_bytes,foreground,background,first_codepoint,native_width,ascii_lines,line_id};
      });return {touched,cells};
    });
    if(at!==end)throw new Error('window record length');
    windows.push({role,origin:[x,y],shape:[width,height],cursor:[cx,cy],font_metrics:[fw,fh],glyph_offset:[gx,gy],
      clip_size:[clipx,clipy],scaling_factor:scale,inuse,draw,ascii_lines_option,window_colors,palette,rows});
  }
  if(at!==bytes.length)throw new Error('trailing');
  return {publication:publication.toString(),build_id:build,full_canvas_complete:false,input_authority:'native_only',windows};
}
