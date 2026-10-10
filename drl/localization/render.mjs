/** Reference contract for the Rust display resolver; never used by gameplay. */
export function tokens(template){
 if(typeof template!=='string'||template.length>32768)throw Error('Invalid template');
 const result=[];let start=0;
 while(start<template.length){
  const at=template.indexOf('{{',start);
  if(at<0){result.push({literal:template.slice(start)});break;}
  if(at>start)result.push({literal:template.slice(start,at)});
  const finish=template.indexOf('}}',at+2);if(finish<0)throw Error('Unterminated placeholder');
  const name=template.slice(at+2,finish);if(!/^[a-z][a-z0-9_]*$/.test(name))throw Error('Invalid placeholder');
  result.push({parameter:name});start=finish+2;
 }
 return result;
}
export function render(catalog,contracts,id,parameters={}){
 if(!Object.hasOwn(catalog,id)||!Object.hasOwn(contracts,id))throw Error(`Unknown semantic ID: ${id}`);
 const expected=Object.keys(contracts[id]).sort();
 if(JSON.stringify(Object.keys(parameters).sort())!==JSON.stringify(expected))throw Error('Parameter set mismatch');
 for(const name of expected){
  const kind=contracts[id][name],value=parameters[name];
  if(kind==='string'&&(typeof value!=='string'||value.length>32768))throw Error('Expected bounded string');
  if(kind==='integer'&&!(Number.isSafeInteger(value)||(typeof value==='bigint'&&value>=-(1n<<63n)&&value<(1n<<63n))))throw Error('Expected safe integer or signed Int64 bigint');
  if(!['string','integer'].includes(kind))throw Error('Unknown parameter kind');
 }
 return tokens(catalog[id]).map(t=>t.literal??String(parameters[t.parameter])).join('');
}
