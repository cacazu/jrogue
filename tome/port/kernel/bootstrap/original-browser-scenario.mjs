/* SPDX-License-Identifier: GPL-3.0-or-later
 * Source-only scenario module. The parent owns its actual monitored execution.
 * Never executes serialized save Lua or rewrites original gameplay state.
 */
import {createHash} from 'node:crypto';
import {inflateRawSync} from 'node:zlib';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';

const MAX_ARCHIVE=4194304,MAX_INFLATED=16777216,MAX_ENTRIES=512;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const crcTable=new Uint32Array(256);
for(let i=0;i<256;i++) {
  let value=i;
  for(let bit=0;bit<8;bit++) value=(value&1)?0xedb88320^(value>>>1):value>>>1;
  crcTable[i]=value>>>0;
}
function crc32(bytes) {
  let value=0xffffffff;
  for(const byte of bytes) value=crcTable[(value^byte)&255]^(value>>>8);
  return (value^0xffffffff)>>>0;
}
function requireThat(condition,message) {if(!condition) throw new Error(message);}
function playerView(snapshot) {
  const player=snapshot?.game?.player;
  return player&&{uid:player.uid,x:player.x,y:player.y,life:player.life,dead:player.dead,
    energy:player.energy,energyBase:player.energyBase,turn:snapshot.game.turn};
}

export function inspectOriginalGraphZip(bytes,{expectedMainClass,maxArchiveBytes=16777216,maxInflatedBytes=67108864,maxEntries=8192}={}) {
  requireThat(typeof expectedMainClass==='string'&&/^(?:engine|mod)\.[A-Za-z_][A-Za-z0-9_.]*$/.test(expectedMainClass),'An exact original main class is required for graph ZIP validation');
  requireThat(Number.isSafeInteger(maxArchiveBytes)&&maxArchiveBytes>0&&maxArchiveBytes<=33554432&&
    Number.isSafeInteger(maxInflatedBytes)&&maxInflatedBytes>0&&maxInflatedBytes<=134217728&&
    Number.isSafeInteger(maxEntries)&&maxEntries>0&&maxEntries<=16384,'Graph ZIP limits exceed the explicit bounded verifier');
  requireThat(Buffer.isBuffer(bytes)&&bytes.length>=22&&bytes.length<=maxArchiveBytes,'Original save ZIP is outside the bounded archive size');
  let end=-1;
  for(let offset=bytes.length-22;offset>=Math.max(0,bytes.length-65557);offset--) {
    if(bytes.readUInt32LE(offset)===0x06054b50&&offset+22+bytes.readUInt16LE(offset+20)===bytes.length) {end=offset;break;}
  }
  requireThat(end>=0,'Original initial character save has no exact ZIP end record');
  const entries=bytes.readUInt16LE(end+10),centralSize=bytes.readUInt32LE(end+12),centralOffset=bytes.readUInt32LE(end+16);
  requireThat(bytes.readUInt16LE(end+4)===0&&bytes.readUInt16LE(end+6)===0&&bytes.readUInt16LE(end+8)===entries,'Multidisk character ZIP is unsupported');
  requireThat(entries>0&&entries<=maxEntries&&centralOffset+centralSize<=end,'Graph ZIP central directory exceeds its bounds');
  const records=[],classes=new Set(),methods=new Set();let cursor=centralOffset,totalInflated=0,mainHeader;
  for(let index=0;index<entries;index++) {
    requireThat(cursor+46<=centralOffset+centralSize&&bytes.readUInt32LE(cursor)===0x02014b50,'Invalid original ZIP central member header');
    const flags=bytes.readUInt16LE(cursor+8),method=bytes.readUInt16LE(cursor+10),crc=bytes.readUInt32LE(cursor+16);
    const compressed=bytes.readUInt32LE(cursor+20),plain=bytes.readUInt32LE(cursor+24);
    const nameSize=bytes.readUInt16LE(cursor+28),extraSize=bytes.readUInt16LE(cursor+30),commentSize=bytes.readUInt16LE(cursor+32);
    const localOffset=bytes.readUInt32LE(cursor+42),next=cursor+46+nameSize+extraSize+commentSize;
    requireThat(next<=centralOffset+centralSize&&!(flags&1)&&[0,8].includes(method),'Encrypted, malformed, or unsupported original save member');
    requireThat(bytes.readUInt16LE(cursor+34)===0,'Save member refers to another disk');
    const name=bytes.subarray(cursor+46,cursor+46+nameSize).toString(flags&0x800?'utf8':'latin1');
    requireThat(localOffset+30<=centralOffset&&bytes.readUInt32LE(localOffset)===0x04034b50,'Original ZIP local header is invalid');
    requireThat(bytes.readUInt16LE(localOffset+8)===method,'ZIP local and central compression disagree');
    const localNameSize=bytes.readUInt16LE(localOffset+26),localExtraSize=bytes.readUInt16LE(localOffset+28);
    const dataStart=localOffset+30+localNameSize+localExtraSize;
    requireThat(dataStart+compressed<=centralOffset&&totalInflated+plain<=maxInflatedBytes,'Original ZIP data exceeds bounded inflation limits');
    const localName=bytes.subarray(localOffset+30,localOffset+30+localNameSize);
    requireThat(localName.equals(bytes.subarray(cursor+46,cursor+46+nameSize)),'ZIP local and central names disagree');
    const packed=bytes.subarray(dataStart,dataStart+compressed);
    const data=method===8?inflateRawSync(packed,{maxOutputLength:Math.max(1,maxInflatedBytes-totalInflated)}):Buffer.from(packed);
    requireThat(data.length===plain&&crc32(data)===crc,`Original save member size/CRC mismatch: ${name}`);
    totalInflated+=plain;methods.add(method);
    const text=data.toString('utf8');
    for(const match of text.matchAll(/\b(?:engine|mod)\.(?:class\.)?[A-Za-z_][A-Za-z0-9_.]*/g)) {
      if(classes.size<128) classes.add(match[0]);
    }
    const className=/^((?:engine|mod)\.[A-Za-z_][A-Za-z0-9_.]*)-/.exec(name)?.[1];
    if(className) classes.add(className);
    if(name==='main') mainHeader={entry:name,prefix_hex:data.subarray(0,32).toString('hex'),
      prefix_text:data.subarray(0,512).toString('utf8'),contains_class_name:text.includes('__CLASSNAME'),
      // Only the original serializer's root assignment identifies "main".
      // Nested inline tables may contain other __CLASSNAME fields.
      main_class:/^d\["__CLASSNAME"\]\s*=\s*"([^"]+)"/m.exec(text)?.[1]||null,
      contains_expected_class:text.includes(expectedMainClass),contains_player_class:text.includes('mod.class.Player')};
    records.push({name,method,compressed_bytes:compressed,plain_bytes:plain,crc32:crc.toString(16).padStart(8,'0')});
    cursor=next;
  }
  requireThat(cursor===centralOffset+centralSize,'ZIP directory length does not match its original member records');
  requireThat(mainHeader&&mainHeader.contains_class_name&&mainHeader.main_class===expectedMainClass,
    'Original graph archive main class does not match '+expectedMainClass);
  requireThat(classes.has(expectedMainClass),'Original expected serialized graph class is absent');
  return {zip_bytes:bytes.length,sha256:sha(bytes),entries:records,entry_count:entries,
    crc_members_verified:entries,plain_bytes:totalInflated,compression_methods:[...methods].sort(),
    classes:[...classes].sort(),main_header:mainHeader,expected_main_class:expectedMainClass,
    scope:'Actual original graph ZIP integrity and exact main class/header proof; no saved Lua executed and no resume claim'};
}

export function inspectInitialCharacterZip(bytes) {
  // The original Birther saves the actual Party as "main" and its Player as a
  // referenced member. Require that graph shape; do not relabel it Player.
  const graph=inspectOriginalGraphZip(bytes,{expectedMainClass:'mod.class.Party',maxArchiveBytes:MAX_ARCHIVE,
    maxInflatedBytes:MAX_INFLATED,maxEntries:MAX_ENTRIES});
  requireThat(graph.classes.includes('mod.class.Player')&&
    graph.entries.some(entry=>entry.name.startsWith('mod.class.Player-')),
    'Original initial Party archive lacks its actual Player member');
  return {...graph,
    scope:'Actual initial character.teac ZIP integrity and class/header proof; no saved Lua executed and no full-game resume claim'};
}

export async function runScenario({call,evaluate,evidence,output}) {
  const result={passed:false,scope:'Actual retained original browser core and diagnostic platform dispatch',checks:[],
    limitations:['Original baseline drawing can mutate FOV and visual RNG; purity checks exclude drawing.',
      'Keyboard/touch verification targets the diagnostic DOM-to-native-command handler, not native SDL queue processing.',
      'The initial character ZIP is not a complete game/level/world save or original resume test.',
      'Movement and wait do not establish combat, campaign completion, production Rust rendering, audio, or localization coverage.']};
  function check(label,passed,detail={}) {
    result.checks.push({label,passed,...detail});requireThat(passed,label+' failed');
  }
  async function counters() {
    return evaluate('({dispatch:window.tomeNativeProbe.report.commandDispatchCount,success:window.tomeNativeProbe.report.commandCount,error:window.tomeNativeProbe.report.commandError||null,last:window.tomeNativeProbe.report.lastCommand})');
  }
  async function waitForOne(before) {
    const deadline=Date.now()+5000;let after;
    do {
      after=await counters();
      if(after.dispatch>before.dispatch||after.error) break;
      await new Promise(resolve=>setTimeout(resolve,50));
    } while(Date.now()<deadline);
    return after;
  }
  try {
    await mkdir(output,{recursive:true});
    check('actual birth report ready',evidence.runtime?.passed===true);
    const purity=await evaluate(`(()=>{
      const p=window.tomeNativeProbe, before=JSON.stringify(p.snapshotRaw()), rng=p.rngSnapshot();
      let same=true;
      for(let i=0;i<8;i++) if(JSON.stringify(p.snapshotRaw())!==before||p.rngSnapshot()!==rng) same=false;
      return {same,snapshot:JSON.parse(before),rng};
    })()`);
    check('eight repeated snapshots preserve exact observation and combined RNG',purity.same,
      {snapshot_sha256:sha(JSON.stringify(purity.snapshot)),rng_sha256:sha(purity.rng),rng_hex_characters:purity.rng.length});
    result.initial_player=playerView(purity.snapshot);

    const saves=await evaluate('window.tomeNativeProbe.saveFiles()');
    const initial=saves.files.find(file=>file.path.endsWith('/character.teac'));
    check('actual completed initial character archive exists',!!initial,{files:saves.files.map(({path,bytes})=>({path,bytes})).slice(0,40)});
    requireThat(initial.bytes<=MAX_ARCHIVE,'Initial character archive exceeds the bounded export size');
    const exported=await evaluate(`window.tomeNativeProbe.saveFile(${JSON.stringify(initial.path)})`);
    const archive=Buffer.from(exported.data,'base64');
    requireThat(archive.length===exported.bytes,'Actual save base64 export length mismatch');
    const zip=inspectInitialCharacterZip(archive);
    const archiveFile=path.join(output,'initial-character.teac');
    await writeFile(archiveFile,archive);
    check('actual initial ZIP has valid central headers, deflate/store members, CRCs and Player class',true,
      {artifact:archiveFile,guest_path:initial.path,...zip});

    const metadata=await evaluate('fetch("/vfs-manifest.json",{cache:"no-store"}).then(r=>r.json())');
    const binaries=metadata.files.filter(file=>['/original/game/modules/tome-1.7.6.team','/original/game/modules/tome-1.7.6-gfx.team'].includes(file.virtual));
    check('genuine code and gfx original archives indexed',binaries.length===2);
    const binaryChecks=[];let highBytes=0;
    const rngBeforeIO=await evaluate('window.tomeNativeProbe.rngSnapshot()');
    for(const file of binaries) for(const sample of [
      {kind:'header',start:0},{kind:'middle',start:Math.floor(file.bytes/2)},{kind:'tail',start:file.bytes-512},
    ]) {
      const comparison=await evaluate(`(async()=>{
        const actual=window.tomeNativeProbe.readSourceRange(${JSON.stringify(file.virtual)},${sample.start},512);
        const response=await fetch(actual.url,{headers:{Range:'bytes='+actual.start+'-'+(actual.start+511),'If-Match':actual.etag},cache:'no-store'});
        if(response.status!==206){await response.body?.cancel();throw Error('Original binary comparison requires exact HTTP206');}
        const bytes=new Uint8Array(await response.arrayBuffer());let text='';for(const byte of bytes)text+=String.fromCharCode(byte);
        return {actual:actual.data,reference:btoa(text),bytes:bytes.length,status:response.status,range:response.headers.get('Content-Range'),
          encoding:response.headers.get('Content-Encoding'),high_bytes:Array.from(bytes).filter(byte=>byte>127).length};
      })()`);
      const actual=Buffer.from(comparison.actual,'base64'),reference=Buffer.from(comparison.reference,'base64');
      const passed=actual.length===512&&reference.length===512&&actual.equals(reference)&&
        comparison.range===`bytes ${sample.start}-${sample.start+511}/${file.bytes}`&&(!comparison.encoding||comparison.encoding==='identity');
      highBytes+=comparison.high_bytes;
      binaryChecks.push({file:file.virtual,sample:sample.kind,start:sample.start,bytes:actual.length,passed,
        sha256:sha(actual),http_status:comparison.status,high_bytes:comparison.high_bytes});
      check('actual FS equals HTTP206 '+file.virtual+' '+sample.kind,passed);
    }
    check('original sampled binary bytes cover values above127',highBytes>0,{high_byte_count:highBytes});
    check('read-only source IO preserves actual combined RNG',rngBeforeIO===await evaluate('window.tomeNativeProbe.rngSnapshot()'));
    result.binary_samples=binaryChecks;

    const wait=await evaluate('window.tomeNativeProbe.command("MOVE_STAY")');
    const waitBefore=playerView(wait.before),waitAfter=playerView(wait.after);
    check('actual MOVE_STAY advances original rules at the same location',wait.command==='MOVE_STAY'&&wait.ticks>0&&
      waitBefore.uid===waitAfter.uid&&waitBefore.x===waitAfter.x&&waitBefore.y===waitAfter.y&&waitAfter.turn>waitBefore.turn,
      {ticks:wait.ticks,before:waitBefore,after:waitAfter});

    const view=await evaluate('(()=>{window.tomeNativeProbe.drawBaseline();return window.tomeNativeProbe.snapshotRaw();})()');
    const player=view.game.player,map=view.game.level.map;
    const directions=[{command:'MOVE_RIGHT',dx:1,dy:0},{command:'MOVE_DOWN',dx:0,dy:1},
      {command:'MOVE_UP',dx:0,dy:-1},{command:'MOVE_LEFT',dx:-1,dy:0}];
    // Original Trollmire uses GRASS_ROAD_DIRT at its entrance. That genuine
    // floor is "old road" with '=', rather than a '.' glyph. These pairs are
    // copied from original forest.lua, autumn_forest.lua and Trollmire grids.
    const safeFloors=new Map([['grass','.'],['autumn grass','.'],['dirt road','.'],
      ['old road','='],['flower',';']]);
    const neighbors=directions.map(direction=>{
      const x=player.x+direction.dx,y=player.y+direction.dy;
      return {...direction,x,y,in_bounds:x>=0&&x<map.w&&y>=0&&y<map.h,
        cell:map.cells.find(cell=>cell.x===x&&cell.y===y)||null};
    });
    result.movement_observation={player:playerView(view),neighbors,
      cache_counts:{seen:map.cells.filter(cell=>cell.seen).length,
        remembered:map.cells.filter(cell=>cell.remembered).length,
        terrain:map.cells.filter(cell=>cell.terrain).length},
      floor_definition_sources:['/data/general/grids/forest.lua',
        '/data/general/grids/autumn_forest.lua','/data/zones/trollmire/grids.lua']};
    const move=directions.find(direction=>{
      const x=player.x+direction.dx,y=player.y+direction.dy,cell=map.cells.find(cell=>cell.x===x&&cell.y===y);
      return x>=0&&x<map.w&&y>=0&&y<map.h&&cell?.seen&&!cell.actor&&!cell.trap&&
        safeFloors.has(cell.terrain?.name)&&safeFloors.get(cell.terrain.name)===cell.terrain.display;
    });
    check('safe observed cardinal floor neighbor exists',!!move,{neighbors,
      cache_counts:result.movement_observation.cache_counts});
    const moved=await evaluate(`window.tomeNativeProbe.command(${JSON.stringify(move.command)})`);
    const moveBefore=playerView(moved.before),moveAfter=playerView(moved.after);
    check('original cardinal command moves the actual player',moved.command===move.command&&moved.ticks>0&&
      moveAfter.uid===moveBefore.uid&&moveAfter.x===moveBefore.x+move.dx&&moveAfter.y===moveBefore.y+move.dy,
      {command:move.command,ticks:moved.ticks,before:moveBefore,after:moveAfter});

    await evaluate('document.querySelector("#game").focus()');
    const pcBefore=await counters();
    requireThat(Number.isSafeInteger(pcBefore.dispatch)&&Number.isSafeInteger(pcBefore.success),'Actual diagnostic native dispatch counters are unavailable');
    await call('Input.dispatchKeyEvent',{type:'keyDown',code:'Numpad5',key:'Clear',windowsVirtualKeyCode:12,nativeVirtualKeyCode:12,isKeypad:true});
    await call('Input.dispatchKeyEvent',{type:'keyUp',code:'Numpad5',key:'Clear',windowsVirtualKeyCode:12,nativeVirtualKeyCode:12,isKeypad:true});
    const pcAfter=await waitForOne(pcBefore);
    check('actual desktop keypad wait dispatches exactly one diagnostic native command',pcAfter.dispatch===pcBefore.dispatch+1&&
      pcAfter.success===pcBefore.success+1&&!pcAfter.error&&pcAfter.last?.command==='MOVE_STAY',
      {before:pcBefore,after:pcAfter,route:'CDP keyboard -> actual DOM handler -> original native command; SDL queue not asserted'});

    await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    await call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
    const point=await evaluate(`(()=>{const button=document.querySelector('[data-command="MOVE_STAY"]');button.scrollIntoView({block:'center'});
      const rect=button.getBoundingClientRect();return{x:rect.left+rect.width/2,y:rect.top+rect.height/2,width:rect.width,height:rect.height,
        viewport:{width:innerWidth,height:innerHeight},disabled:button.disabled};})()`);
    check('mobile wait control is visible and at least48CSS pixels',!point.disabled&&point.width>=48&&point.height>=48&&
      point.x>0&&point.x<point.viewport.width&&point.y>0&&point.y<point.viewport.height,{control:point});
    const mobileBefore=await counters();
    await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:point.x,y:point.y,radiusX:4,radiusY:4,force:1,id:1}]});
    await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    const mobileAfter=await waitForOne(mobileBefore);
    check('actual mobile touch dispatches exactly one diagnostic native command',mobileAfter.dispatch===mobileBefore.dispatch+1&&
      mobileAfter.success===mobileBefore.success+1&&!mobileAfter.error&&mobileAfter.last?.command==='MOVE_STAY',
      {before:mobileBefore,after:mobileAfter,route:'CDP touch -> synthesized actual button click -> original native command; SDL queue not asserted'});
    await evaluate('document.querySelector("#game").scrollIntoView({block:"start"})');
    const screenshot=await call('Page.captureScreenshot',{format:'png'});
    const mobileFile=path.join(output,'mobile-scenario.png');
    await writeFile(mobileFile,Buffer.from(screenshot.data,'base64'));result.mobile_screenshot=mobileFile;

    result.final_player=await evaluate('window.tomeNativeProbe.snapshot()');
    result.metrics=await evaluate('window.tomeNativeProbe.report.metrics');
    result.passed=result.checks.every(check=>check.passed);
  } catch(error) {
    result.error=error.stack||String(error);
  } finally {
    try {
      await call('Emulation.setTouchEmulationEnabled',{enabled:false});
      await call('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
      await evaluate('window.scrollTo(0,0);document.querySelector("#game").focus()');
    } catch(error) {result.restore_error=error.message;result.passed=false;}
  }
  await writeFile(path.join(output,'scenario-evidence.json'),JSON.stringify(result,null,2));
  return result;
}
