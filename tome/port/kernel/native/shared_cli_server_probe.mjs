/* SPDX-License-Identifier: GPL-3.0-or-later
 * Launch the actual copied local CLI. Browser_probe uses its printed origin;
 * this facade neither serves nor proxies HTTP and changes no production file.
 */
import {spawn} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export async function createTomeServer() {
  const here=path.dirname(fileURLToPath(import.meta.url));
  const portRoot='C:\\Users\\kit\\gameme\\jnethack\\jrouge\\tome\\port';
  const cli=path.join(portRoot,'kernel/bootstrap/run-local.mjs');
  const child=spawn(process.execPath,[cli,'--port','0'],{
    cwd:portRoot,windowsHide:true,stdio:['ignore','pipe','pipe']});
  let stdout='',stderr='',address;
  try {
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('Actual shared CLI did not print its origin')),15000);
      const finish=fn=>value=>{clearTimeout(timer);fn(value);};
      child.once('error',finish(reject));
      child.once('exit',finish(code=>reject(Error('Actual CLI exited before launch: '+code+' '+stderr))));
      child.stderr.on('data',bytes=>{stderr=(stderr+bytes.toString()).slice(-16384);});
      child.stdout.on('data',bytes=>{
        stdout=(stdout+bytes.toString()).slice(-65536);
        const line=stdout.split(/\r?\n/).find(value=>value.startsWith('TOME_LOCAL_SERVER='));
        if(!line)return;
        try {
          address=JSON.parse(line.slice('TOME_LOCAL_SERVER='.length));
          const url=new URL(address.url);
          if(url.hostname!=='127.0.0.1'||address.bind!=='127.0.0.1'||address.mode!=='play'||url.pathname!=='/play-browser.html')
            throw Error('Actual default CLI origin/mode mismatch');
          finish(resolve)();
        } catch(error) {finish(reject)(error);}
      });
    });
    const bytes=await readFile(cli),url=new URL(address.url);
    await writeFile(path.join(here,'shared-cli-launch-evidence.json'),JSON.stringify({
      source:'Actual shared folder Node CLI, no HTTP proxy',argv:[cli,'--port','0'],cwd:portRoot,
      pid:child.pid,reported:address,cli_sha256:createHash('sha256').update(bytes).digest('hex'),
      stderr,launched_at:new Date().toISOString()},null,2));
    return {
      tomeSourceIndex:address,
      listen(_port,_host,callback){queueMicrotask(callback);},
      address(){return {address:'127.0.0.1',port:Number(url.port)};},
      close(callback){if(child.exitCode!==null||child.signalCode!==null)queueMicrotask(callback);
        else {child.once('exit',callback);child.kill();}},
    };
  } catch(error) {child.kill();throw error;}
}
