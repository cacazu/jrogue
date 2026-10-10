import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
// Authored fixture, no game/SDK/Chrome/assets/network. Exactly one child maximum.
const childMode=process.argv.includes('--child');
let child=null;
const hold=setInterval(()=>{},1000);
async function close(){
  clearInterval(hold);
  if(child?.connected){child.send({close:true});await new Promise(r=>child.once('exit',r));}
  process.disconnect?.();
}
process.on('message',message=>{if(message?.close)void close();});
if(!childMode){
  child=spawn(process.execPath,[fileURLToPath(import.meta.url),'--child'],{windowsHide:true,stdio:['ignore','ignore','ignore','ipc']});
  child.on('message',message=>{if(message?.ready)process.send?.({ready:true,childPid:child.pid});});
  child.on('error',error=>{process.send?.({error:String(error)});void close();});
}else process.send?.({ready:true});
