import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath}from'node:url';
import{encodeSnapshot}from'./model.mjs';
const own=path.dirname(fileURLToPath(import.meta.url)),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const build='source-fixture-not-engine-build',palette=Array.from({length:16},(_,n)=>[n*13,n*9,n*5,255]);
const cell=(raw,cp,width,lines=false,id=raw[0]??0)=>({raw_bytes:raw,foreground:8,background:0,first_codepoint:cp,native_width:width,ascii_lines:lines,line_id:id});
const border=Array.from({length:11},(_,n)=>cell([0xa0+n],0xfffd,1,true,0xa0+n));
const grouped=[cell([...Buffer.from('猫')],0x732b,2),cell([],0,0),cell([...Buffer.from('a\u0301')],97,1),cell([32],32,1),
  cell([...Buffer.from('│')],0x2502,1,true,0xa0),cell([0],0,0),cell([60],60,1),cell([62],62,1),cell([38],38,1),
  cell([...Buffer.from('🐈')],0x1f408,1),cell([32],32,1)]; // pinned mk_wcwidth returns 1 for this emoji
const window={role:1,origin:[2,3],shape:[11,2],cursor:[4,1],font_metrics:[9,17],glyph_offset:[18,51],
  clip_size:[1280,960],scaling_factor:2,inuse:true,draw:true,ascii_lines_option:true,window_colors:[8,0],palette,
  rows:[{touched:true,cells:border},{touched:false,cells:grouped}]};
const mapWindow={...window,role:2,origin:[1,2],font_metrics:[12,20],glyph_offset:[9,34],
  rows:[{touched:false,cells:border},{touched:true,cells:grouped}]};
const snapshots=[{name:'raw-border-cjk',frame:{publication:'9223372045444710399',build_id:build,windows:[window,mapWindow]}},
  {name:'empty-submit-batch',frame:{publication:'1',build_id:build,windows:[]}}];
fs.mkdirSync(path.join(own,'fixtures'),{recursive:true});
const manifest=[];
for(const {name,frame}of snapshots){const bytes=encodeSnapshot(frame);fs.writeFileSync(path.join(own,'fixtures',name+'.bin'),bytes);
  fs.writeFileSync(path.join(own,'fixtures',name+'.json'),JSON.stringify({fixture_kind:'synthetic_native_presentation_observation_not_engine_runtime',...frame},null,2)+'\n');
  manifest.push({name,bytes:bytes.length,sha256:sha(bytes),publication:frame.publication,build_id:build});}
fs.writeFileSync(path.join(own,'fixtures/manifest.json'),JSON.stringify({schema:1,native_or_rust_execution:false,fixtures:manifest},null,2)+'\n');
console.log(JSON.stringify({synthetic_fixtures:snapshots.length,bytes:manifest.map(f=>f.bytes),native_execution:false}));
