import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {WASI} from 'node:wasi';
const root=path.dirname(fileURLToPath(import.meta.url));
const actual=process.argv.includes('--actual');
const stem=actual?'vtig-cjk':'text-contract-probe';
const source=fs.readFileSync(path.join(root,'build',stem+'.wasm'));
const rustBytes=fs.readFileSync(path.join(root,'../../port/dist/drl_web_port.wasm'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const rust=await WebAssembly.instantiate(rustBytes,{});
const display=rust.instance.exports;
assert.equal(typeof display.drl_text_columns,'function','latest Rust adapter WASM required');
assert.equal(typeof display.drl_text_fit,'function','latest Rust adapter WASM required');
const decoder=new TextDecoder('utf-8',{fatal:true});
const encoder=new TextEncoder();
function rustCopy(bytes){
  assert(bytes.length<=display.drl_request_capacity());
  const ptr=display.drl_request_pointer();
  new Uint8Array(display.memory.buffer,ptr,bytes.length).set(bytes);
}
function dispatch(message){
  const bytes=encoder.encode(JSON.stringify(message));rustCopy(bytes);
  display.drl_dispatch(bytes.length);
  return decoder.decode(new Uint8Array(display.memory.buffer,display.drl_output_pointer(),display.drl_output_length()));
}
const before=dispatch({kind:'save'});
const fd=fs.openSync(path.join(root,'build',stem+'-stdout.log'),'w');
const wasi=new WASI({version:'preview1',args:[stem],env:{},preopens:{},returnOnExit:true,stdout:fd,stderr:fd});
const module=await WebAssembly.compile(source);
let core;const commands=[];let width_calls=0,fit_calls=0;
function bytes(ptr,length){return Uint8Array.from(new Uint8Array(core.exports.memory.buffer,ptr,length));}
const host={
  text_columns(ptr,length){width_calls++;rustCopy(bytes(ptr,length));return display.drl_text_columns(length);},
  text_fit(ptr,length,columns){fit_calls++;rustCopy(bytes(ptr,length));return display.drl_text_fit(length,columns);},
  draw_command(ptr,length,textPtr,textLength){
    assert.equal(length,64);const header=bytes(ptr,length);const v=new DataView(header.buffer);
    const words=Array.from({length:16},(_,i)=>v.getUint32(i*4,true));
    assert.equal(words[0],1);assert.equal(words[1],0);
    assert.equal(words[14],0);assert.equal(words[15],0);
    const literal=decoder.decode(bytes(textPtr,textLength));
    rustCopy(encoder.encode(literal));const columns=display.drl_text_columns(textLength);
    assert(columns>=0);assert(words[2]>=words[6]);assert(words[3]>=words[7]);
    assert(words[2]+columns<=words[6]+words[8]);assert(words[3]<words[7]+words[9]);
    commands.push({x:words[2],y:words[3],clip:words.slice(6,10),fg:words[10],bg:words[11],columns,text:literal});
  },
  poll_event(){return 0;},event_pending(){return 0;},sleep(){},now_ms(){return 0;},
  frame(){},text_input(){},title(){},rumble(){return 0;},
};
core=await WebAssembly.instantiate(module,{...wasi.getImportObject(),drl_host:host});
const exit_code=wasi.start(core);fs.closeSync(fd);
assert.equal(exit_code,0,'authored Pascal VTIG probe');
const output=fs.readFileSync(path.join(root,'build',stem+'-stdout.log'),'utf8');
assert.equal((output.match(/^PASS /gm)||[]).length,19);
const row=y=>commands.filter(c=>c.y===y&&c.clip[0]===0).map(c=>[c.x,c.text,c.fg]);
assert.deepEqual(row(0),[[0,'日本',7]]);
assert.deepEqual(row(1),[[0,'語ABC',7]]);
assert.deepEqual(row(4),[[0,'AB',7],[2,'日本',12]]);
assert.deepEqual(row(5),[[0,'語',12],[2,'Z',7]]);
assert.deepEqual(row(8),[[0,'X',7],[1,'日',7],[3,' ',7],[4,'Y',7]]);
assert.deepEqual(row(11),[[0,'X',7],[1,'日',7],[3,'Y',7]]);
assert.deepEqual(row(14),[[0,'one two',7]]);
assert.deepEqual(row(15),[[0,'three',7]]);
assert.deepEqual(row(18),[[0,'A',7]]);
assert.deepEqual(row(19),[[0,'日本',7]]);
assert.deepEqual(row(20),[[0,'X',7],[1,'A',7],[2,'日',12],[4,'Y',7]]);
assert.deepEqual(row(22),[],'unplaceable wide cluster stops a one-column clip safely');
assert.deepEqual(commands.filter(c=>c.clip[0]===30&&c.clip[1]===1).map(c=>[c.x,c.y,c.text]),[[30,1,'A']],'LF consumes the local cut budget');
assert.deepEqual(commands.filter(c=>c.clip[0]===30&&c.clip[1]===5).map(c=>[c.x,c.y,c.text,c.fg]),[[30,5,'A',7],[31,5,'日',12]],'markup-aware prefix retains color');
assert.equal(dispatch({kind:'save'}),before,'Rust display width/fit preserves checkpoint and RNG');
const result={schema:1,status:'passed',node:process.version,probe_wasm_sha256:sha(source),rust_wasm_sha256:sha(rustBytes),
  actual_vtig_unit_executed:actual,exact_text_adapter_executed:true,original_game_executed:false,
  pascal_measurement_checks:12,pascal_prefix_checks:6,render_row_checks:14,scope:'VTIG UTF8 text contract, not full game',width_calls,fit_calls,
  immutable_rust_checkpoint:true,commands,imports:WebAssembly.Module.imports(module)};
fs.writeFileSync(path.join(root,stem+'-evidence.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({...result,commands:commands.length,imports:result.imports.length}));
