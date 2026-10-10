import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import assert from 'node:assert/strict';
import{fileURLToPath}from'node:url';import{SOURCE_COMMIT,limits,encodeSnapshot,decodeSnapshot,nativeFirstCodepoint,nativeLineDecision}from'./model.mjs';
import{copyOwnedTextSnapshot,publicationFromNotice}from'./host-copy.mjs';
const own=path.dirname(fileURLToPath(import.meta.url));
const upstream=process.env.CDDA_PRISTINE_ROOT??'C:/Users/kit/gameme/jnethack/jrouge/cataclysm-dda/upstream/Cataclysm-DDA-7b2efa5cea38e4d4d97dd0e63b28b9148623da59';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');let assertions=0;
const equal=(a,b,n)=>{assert.deepEqual(a,b,n);++assertions;},check=(a,n)=>{assert.ok(a,n);++assertions;};
const rejected=(run,n)=>{assert.throws(run,undefined,n);++assertions;};
const pins=JSON.parse(fs.readFileSync(path.join(own,'source-pins.json'))),originals=new Map();
equal(pins.upstream_commit,SOURCE_COMMIT,'source commit');
for(const p of pins.files){const bytes=fs.readFileSync(path.join(upstream,p.source));equal(bytes.length,p.bytes,'source bytes');equal(sha(bytes),p.sha256,'source hash');originals.set(p.source,bytes.toString('utf8'));}
const prep=JSON.parse(fs.readFileSync(path.join(own,'SOURCE-PREPARATION.json'))),patch=fs.readFileSync(path.join(own,'presentation-snapshot.patch'),'utf8');
equal(sha(patch),prep.patch.sha256,'patch hash');equal(Buffer.byteLength(patch),prep.patch.bytes,'patch bytes');
const files=[];let file,hunk;
for(const line of patch.slice(0,-1).split('\n')){
  if(line.startsWith('diff --git ')){const m=/^diff --git a\/(\S+) b\/(\S+)$/.exec(line);check(m&&m[1]===m[2],'patch path');file={source:m[1],created:false,hunks:[]};files.push(file);hunk=null;}
  else if(line==='new file mode 100644')file.created=true;
  else if(line.startsWith('@@ ')){const m=/^@@ -(\d+),(\d+) \+(\d+),(\d+) @@$/.exec(line);check(m,'hunk header');hunk={oldStart:+m[1],oldCount:+m[2],newStart:+m[3],newCount:+m[4],lines:[]};file.hunks.push(hunk);}
  else if(/^(---|\+\+\+) /.test(line))hunk=null;
  else if(hunk&&/^[ +\-]/.test(line))hunk.lines.push(line);else throw new Error('patch syntax');
}
function apply(source,file,reverse){let cursor=0;const lines=source?source.slice(0,-1).split('\n'):[],out=[];
  for(const h of file.hunks){const start=reverse?h.newStart:h.oldStart,count=reverse?h.newCount:h.oldCount,targetCount=reverse?h.oldCount:h.newCount,at=start?start-1:0;
    const removed=h.lines.filter(l=>l[0]===' '||l[0]===(reverse?'+':'-')).map(l=>l.slice(1));
    const added=h.lines.filter(l=>l[0]===' '||l[0]===(reverse?'-':'+')).map(l=>l.slice(1));
    equal(removed.length,count,'source hunk count');equal(added.length,targetCount,'target hunk count');check(at>=cursor,'ordered hunks');equal(lines.slice(at,at+count),removed,'exact pinned hunk');
    out.push(...lines.slice(cursor,at),...added);cursor=at+count;}
  out.push(...lines.slice(cursor));return out.length?out.join('\n')+'\n':'';
}
equal(files.map(f=>f.source),['src/sdltiles.cpp','src/browser_text_snapshot.h','src/browser_text_snapshot.cpp'],'patch footprint');
for(const f of files){const original=f.created?'':originals.get(f.source),generated=apply(original,f,false);
  equal(generated,fs.readFileSync(path.join(own,f.created?f.source:'generated/'+f.source),'utf8'),'forward patch');equal(apply(generated,f,true),original,'reverse patch');}
const original=originals.get('src/sdltiles.cpp'),generated=fs.readFileSync(path.join(own,'generated/src/sdltiles.cpp'),'utf8');
equal(sha(generated),prep.generated.sha256,'generated native bytes');
check(generated.includes('    SetRenderTarget( renderer, display_buffer );\n    // Source-only observer hook: original display target is already restored.\n    cdda_text_present_committed();'),'commit after restored target');
const observe=generated.indexOf('    cdda_text_observe_window( w, *font');
check(observe>0&&observe<generated.indexOf('        win->line[j].touched = false;',observe),'copy before damage consumed');
check(observe<generated.indexOf('    win->draw = false;',observe),'copy before native draw flag consumed');
for(const anchor of ['            if( cell.ch.empty() )','            if( cell.ch == space_string )','const int codepoint = UTF8_getch( cell.ch );',
  'int cw = ( codepoint == UNKNOWN_UNICODE ) ? 1 : utf8_width( cell.ch );','geometry->rect( renderer, point( win->pos.x * font->width,',
  '            if( draw.x + font->width > WindowWidth || draw.y + font->height > WindowHeight )',
  'tilecontext->draw(','overmap_tilecontext->draw_om(','tilecontext->draw_minimap('])equal(generated.split(anchor).length,original.split(anchor).length,'original rendering branches remain');
const native=fs.readFileSync(path.join(own,'src/browser_text_snapshot.cpp'),'utf8'),header=fs.readFileSync(path.join(own,'src/browser_text_snapshot.h'),'utf8');
check(native.includes('const cata_cursesport::WINDOW &win = *native;'),'const window view');
check(native.includes('raw_string( out, cell.ch );'),'raw cell bytes retained');
check(native.includes('codepoint == UNKNOWN_UNICODE ? 1 : utf8_width( cell.ch, false )'),'native unknown width override');
check(native.includes('for( const cata_cursesport::curseline &row : win.line )'),'all rows included');
check(native.includes('u8( record, row.touched ? 1 : 0 );'),'damage retained');
check(native.includes('u16( output, 0 ); // full_canvas_complete is ALWAYS false'),'incomplete canvas explicit');
check(native.includes('std::shared_ptr<const bytes> latest;'),'immutable owned bytes');
check(native.includes('if( size == 0 ) { return; }'),'null empty data handled');
check(!/\b(rng_bits|rng_get_engine|get_input_event|handle_input|handle_action|do_turn|refresh_display|curses_drawwindow|SDL_GetTicks|UTF8_getch)\s*\(/.test(header),'header has no executable world/input API');
check(!/\b(rng_bits|rng_get_engine|get_input_event|handle_input|handle_action|do_turn|refresh_display|curses_drawwindow|SDL_GetTicks)\s*\(/.test(native),'observer has no simulation/input/clock/draw call');
for(const suffix of ['pin','data','size','release'])check(header.includes('cdda_text_snapshot_'+suffix)&&native.includes('cdda_text_snapshot_'+suffix),'actual independent exports');
const sourceCases=[...original.matchAll(/case (LINE_[A-Z]+_UNICODE):\s+uc = (LINE_[A-Z]+_C);/g)].map(m=>m.slice(1));
equal(sourceCases.length,11,'eleven native unicode line aliases');
for(const [cp,id]of sourceCases)check(native.includes(`case ${cp}: line_id = ${id}; break;`),'native line alias copied exactly');
check(native.includes('publicationLow: low >>> 0')&&native.includes('publicationHigh: high >>> 0'),'u32 import halves normalized');
check(native.includes('queueMicrotask( deliver )')&&native.includes('Promise.resolve().then( deliver )'),'notification deferred');
const manifest=JSON.parse(fs.readFileSync(path.join(own,'fixtures/manifest.json')));
for(const fixture of manifest.fixtures){const bytes=fs.readFileSync(path.join(own,'fixtures',fixture.name+'.bin'));
  equal(bytes.length,fixture.bytes,'fixture bytes');equal(sha(bytes),fixture.sha256,'fixture hash');
  const {fixture_kind,...frame}=JSON.parse(fs.readFileSync(path.join(own,'fixtures',fixture.name+'.json')));
  equal(encodeSnapshot(frame),bytes,'synthetic wire layout reproducible');
  equal(decodeSnapshot(bytes,fixture.build_id),{...frame,full_canvas_complete:false,input_authority:'native_only'},'exact owned raw fixture decode');
  equal(bytes.subarray(16,56).toString(),SOURCE_COMMIT,'fixed source identity');
  const after=64+Buffer.byteLength(frame.build_id);equal(bytes.readUInt32LE(56),Buffer.byteLength(frame.build_id),'build length offset');
  check(after<=bytes.length,'fixed frame header size');
  rejected(()=>decodeSnapshot(bytes,'wrong-build'),'wrong identity');
  for(const length of [0,3,7,15,39,55,59,bytes.length-1])rejected(()=>decodeSnapshot(bytes.subarray(0,length),fixture.build_id),'truncation rejected');
  rejected(()=>decodeSnapshot(Buffer.concat([bytes,Buffer.from([0])]),fixture.build_id),'trailing bytes');
  for(const [offset,value]of [[0,0],[4,2],[6,1],[16,65]]){const wrong=Buffer.from(bytes);wrong[offset]=value;rejected(()=>decodeSnapshot(wrong,fixture.build_id),'schema/source/complete canvas rejected');}
}
const raw=fs.readFileSync(path.join(own,'fixtures/raw-border-cjk.bin')),decoded=decodeSnapshot(raw,manifest.fixtures[0].build_id);
const firstWindow=decoded.windows[0],second=decoded.windows[1];
equal(firstWindow.shape,[11,2],'complete window shape');equal(firstWindow.rows.map(r=>r.touched),[true,false],'untouched row retained');
equal(second.glyph_offset,[9,34],'native glyph offset recorded');equal(second.origin.map((n,i)=>n*second.font_metrics[i]),[12,40],'erase origin differs from glyph offset');
for(let index=0;index<11;++index){const cell=firstWindow.rows[0].cells[index];equal(cell.raw_bytes,[0xa0+index],'every raw border byte retained');
  equal([cell.first_codepoint,cell.native_width,cell.ascii_lines,cell.line_id],[0xfffd,1,true,0xa0+index],'native invalid-byte line behavior');}
equal(Buffer.from(firstWindow.rows[1].cells[0].raw_bytes).toString(),'猫','CJK exact bytes');equal(firstWindow.rows[1].cells[1].raw_bytes,[],'CJK continuation empty');
equal(Buffer.from(firstWindow.rows[1].cells[2].raw_bytes).toString(),'a\u0301','combining exact grouped bytes');equal(firstWindow.rows[1].cells[5].raw_bytes,[0],'literal zero byte retained');
equal(firstWindow.rows[1].cells[9].native_width,1,'pinned native emoji width remains one');
equal(firstWindow.rows[1].cells[10].raw_bytes,[32],'no invented emoji continuation');
for(const [rawBytes,cp]of [[[],0],[[0],0],[[65],65],[[0xa0],0xfffd],[[0xff],0xfffd],[[0xc0,0x80],0xfffd],
  [[0xe0,0x80,0x80],0xfffd],[[0xf0,0x80,0x80,0x80],0xfffd],[[0xed,0xa0,0x80],0xfffd],[[0xe7,0x8c,0xab],0x732b],
  [[0xef,0xbf,0xbd],0xfffd],[[0xf4,0x90,0x80,0x80],0xfffd],[[0xe7,65],0xfffd]])equal(nativeFirstCodepoint(rawBytes),cp,'native prefix decode fixtures');
for(let byte=0x80;byte<0xc0;++byte)equal(nativeFirstCodepoint([byte]),0xfffd,'single continuation byte retains native unknown');
for(const enabled of [false,true])for(let index=0;index<11;++index){
  const cp=[0x2502,0x2500,0x2514,0x250c,0x2510,0x2518,0x251c,0x2534,0x2524,0x252c,0x253c][index];
  equal(nativeLineDecision(cp,0xe2,enabled),[enabled,0xa0+index],'unicode line option and alias exact');
  equal(nativeLineDecision(0xfffd,0xa0+index,enabled),[true,0xa0+index],'legacy line ignores Unicode option');
}
for(const mutate of [cell=>cell.first_codepoint=65,cell=>cell.line_id=0xaa,cell=>cell.ascii_lines=false]){
  const invalid=structuredClone(decoded);mutate(invalid.windows[0].rows[0].cells[0]);rejected(()=>decodeSnapshot(encodeSnapshot(invalid),decoded.build_id),'forged border decision rejected');
}
for(const mutate of [cell=>cell.line_id=0xa0,cell=>cell.ascii_lines=true,cell=>cell.native_width=1]){
  const invalid=structuredClone(decoded);mutate(invalid.windows[0].rows[1].cells[1]);rejected(()=>decodeSnapshot(encodeSnapshot(invalid),decoded.build_id),'forged continuation decision rejected');
}
const frameHeader=64+Buffer.byteLength(decoded.build_id),firstRecord=frameHeader+4;
equal(raw.readUInt32LE(frameHeader),128+firstWindow.rows.reduce((n,r)=>n+1+r.cells.reduce((m,c)=>m+18+c.raw_bytes.length,0),0),'window fixed/cell layout');
for(const [offset,value]of [[firstRecord,9],[firstRecord+12,0],[firstRecord+56,2],[firstRecord+59,1],
  [firstRecord+128,2],[firstRecord+129,255]]){const bad=Buffer.from(raw);bad[offset]=value;rejected(()=>decodeSnapshot(bad,decoded.build_id),'window/cell bounds or boolean reject');}
rejected(()=>decodeSnapshot(Buffer.alloc(limits.bytes+1),decoded.build_id),'byte cap');
for(let repeat=0;repeat<64;++repeat)equal(decodeSnapshot(raw,decoded.build_id),decoded,'repeat no state');

// Host protocol mocks test JS only, never actual native exports or WASM memory.
function host(bytes,{pointer=64,size=bytes.length,handle=1,heapSize=bytes.length+100,growAtSize=false}={}){
  const release=[];const module={HEAPU8:new Uint8Array(heapSize),_cdda_text_snapshot_pin:()=>handle,
    _cdda_text_snapshot_data:()=>pointer,_cdda_text_snapshot_size:()=>{
      if(growAtSize){const changed=new Uint8Array(heapSize+100);changed.set(module.HEAPU8);module.HEAPU8=changed;}return size;},
    _cdda_text_snapshot_release:h=>release.push(h)};
  if(pointer>0&&pointer+bytes.length<=heapSize)module.HEAPU8.set(bytes,pointer);
  return {module,release};
}
for(const growAtSize of [false,true]){const mock=host(raw,{growAtSize}),owned=copyOwnedTextSnapshot(mock.module);
  equal(Buffer.from(owned),raw,'host owns exact immediate copy');equal(mock.release,[1],'host releases pin');mock.module.HEAPU8.fill(0);equal(Buffer.from(owned),raw,'owned bytes survive native heap changes');}
const missing=host(raw,{handle:0});equal(copyOwnedTextSnapshot(missing.module),null,'unavailable pin');equal(missing.release,[],'zero pin not released');
for(const options of [{pointer:0},{pointer:0x7fffffff},{size:0},{size:limits.bytes+1},{size:0xffffffff},{pointer:-1}]){
  const mock=host(raw,options);rejected(()=>copyOwnedTextSnapshot(mock.module),'bad heap range');equal(mock.release,[1],'pin released on copy failure');}
const maximum=host(raw,{handle:-1});equal(Buffer.from(copyOwnedTextSnapshot(maximum.module)),raw,'signed i32 handle normalized');equal(maximum.release,[0xffffffff],'normalized handle released exactly');
equal(publicationFromNotice({kind:2,availability:1,publicationLow:-1,publicationHigh:-2147483647}),9223372045444710399n,'signed notice halves preserve all u64 bits');
for(const notice of [{kind:1,availability:1,publicationLow:1,publicationHigh:0},{kind:2,availability:4,publicationLow:1,publicationHigh:0},
  {kind:2,availability:1,publicationLow:1.5,publicationHigh:0}])rejected(()=>publicationFromNotice(notice),'invalid notice');
const rust=fs.readFileSync(path.join(own,'rust/src/lib.rs'),'utf8');
check(rust.includes('raw_bytes: Vec<u8>')&&rust.includes('pub fn raw_bytes(&self) -> &[u8]'),'Rust retains immutable raw bytes');
check(rust.includes('pub const fn full_canvas_complete(&self) -> bool { false }'),'Rust never claims full canvas');
check(rust.includes('pub enum InputAuthority { NativeOnly }'),'Rust grants no input authority');
for(const key of ['native_compiled','rust_compiled','native_rust_connected','browser_tested','gameplay_render_purity_verified'])equal(prep[key],false,'unexecuted gates stay false');
const rebuild=JSON.parse(fs.readFileSync(path.join(own,'REBUILD-EVIDENCE.json')));
equal(rebuild.existing_translation_unit_rebuild_count,1,'one original TU');equal(rebuild.new_translation_unit_count,1,'one new TU');equal(rebuild.original_headers_modified,[],'no original header changes');
const evidence={schema:1,status:'SOURCE_AND_LIGHT_NODE_CHECKS_PASS',upstream_commit:SOURCE_COMMIT,assertions,
  exact_source_pins:pins.files.length,patch_sha256:sha(patch),patch_bytes:Buffer.byteLength(patch),
  exact_forward_reverse_patch_verified_in_memory:true,complete_raw_window_cells:true,full_canvas_complete:false,
  synthetic_binary_fixtures:manifest.fixtures.length,host_copy_tests:'JS_mock_only',
  native_compiled:false,rust_compiled:false,rust_tests_executed:false,native_rust_connected:false,browser_tested:false,
  input_takeover:false,semantic_text_ids_migrated:false,whole_game_render_purity_verified:false,
  existing_upstream_overlays_build_or_git_modified:false};
fs.writeFileSync(path.join(own,'SOURCE-CHECKS.json'),JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence));
