/* SPDX-License-Identifier: GPL-3.0-or-later
 * Portable local-only entry point. Runtime launch remains parent/user owned.
 */
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createTomeServer,localServerOptions,installLocalShutdown} from './original_range_server.mjs';

const scriptDir=path.dirname(fileURLToPath(import.meta.url));
const workLayout=path.basename(scriptDir)==='bootstrap-work';
const baseRoot=path.resolve(scriptDir,workLayout?'..':'../..');
const defaults={manifest:path.join(scriptDir,'browser-vfs-inputs.json'),staticRoot:scriptDir,
  nativeBuildRoot:path.join(baseRoot,workLayout?'native-core-work/browser-build':'dist/native'),
  rustBrowserRoot:path.join(baseRoot,workLayout?'rust-kernel-adapter-work/browser':'retained/browser'),
  retainedBuildRoot:path.join(baseRoot,workLayout?'rust-kernel-adapter-work/target/wasm32-unknown-unknown/release':'dist/retained')};
try {
  let mode='play';const argv=process.argv.slice(2),remaining=[];
  for(let i=0;i<argv.length;i++) {
    if(argv[i]==='--mode') {mode=argv[++i];if(!mode)throw Error('Missing local mode');}
    else remaining.push(argv[i]);
  }
  const entries={play:'/play-browser.html',save:'/baseline-save-resume.html',ui:'/ui-roundtrip-browser.html',
    semantic:'/semantic/native-semantic-browser.html',original:'/original-browser-boot.html',retained:'/retained-browser.html'};
  if(!Object.hasOwn(entries,mode))throw Error('Unknown local mode: '+mode);
  const options=localServerOptions(remaining);
  if (options.help) console.log('Local only: node run-local.mjs [--mode play|save|ui|semantic|original|retained] [--port 4187]');
  else {
    if(!Number.isSafeInteger(options.port)||options.port<0||options.port>65535)throw Error('Invalid local port');
    let factory=createTomeServer;
    if(mode==='play'||mode==='save') {
      const module=await import(workLayout?'../save-resume-work/baseline_server.mjs':'../save/baseline_server.mjs');
      factory=module.createTomeServer;
    } else if(mode==='ui')factory=(await import('./ui_roundtrip_server.mjs')).createTomeServer;
    const server=await factory({...defaults,...options});
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(options.port,'127.0.0.1',resolve);});
    installLocalShutdown(server);
    console.log('TOME_LOCAL_SERVER='+JSON.stringify({url:'http://127.0.0.1:'+server.address().port+entries[mode],
      bind:'127.0.0.1',mode,...server.tomeSourceIndex}));
  }
} catch (error) {
  console.error('TOME_LOCAL_SERVER_FAILURE='+JSON.stringify({message:error.message}));process.exitCode=1;
}
