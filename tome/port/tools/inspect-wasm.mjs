import {readFile} from 'node:fs/promises';
const data=await readFile(new URL('../dist/tome_platform.wasm',import.meta.url));
const module=await WebAssembly.compile(data);console.log('imports',WebAssembly.Module.imports(module));
const {exports}=await WebAssembly.instantiate(module,{});
const bytes=new TextEncoder().encode('{"op":"view"}');for(const b of bytes)exports.tome_input_byte(b);exports.tome_request();
const result=new Uint8Array(exports.tome_output_len());for(let i=0;i<result.length;i++)result[i]=exports.tome_output_byte(i);
const r=JSON.parse(new TextDecoder().decode(result));console.log('response',r.ok,r.error_id,r.view&&Object.keys(r.view),r.view&&Object.keys(r.view.labels));
