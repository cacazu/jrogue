// SPDX-License-Identifier: GPL-3.0-or-later
// Only the guarded CLI launches the owned localhost HTTP server. No browser.
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export async function main(argv=process.argv.slice(2)){
  let profile,port=4189,expectedFreezeSha;
  for(let i=0;i<argv.length;i++){
    const option=argv[i];
    if(option==='--help'){
      process.stdout.write('Local only: node portable/run-local.mjs --profile gameflow|stairs [--port 0..65535] [--expected-freeze-sha256 HEX]\n');
      return;
    }
    if(!['--profile','--port','--expected-freeze-sha256'].includes(option)||i+1>=argv.length)throw Error('phase7.error.invalid_cli_argument');
    const value=argv[++i];
    if(option==='--profile'){
      if(profile!==undefined||!['gameflow','stairs'].includes(value))throw Error('phase7.error.explicit_profile_required');
      profile=value;
    }else if(option==='--port'){
      if(!/^\d+$/.test(value)||Number(value)>65535)throw Error('phase7.error.port_range');port=Number(value);
    }else{
      if(expectedFreezeSha!==undefined||!/^[0-9a-f]{64}$/i.test(value))throw Error('phase7.error.freeze_sha256');expectedFreezeSha=value.toLowerCase();
    }
  }
  if(!profile)throw Error('phase7.error.explicit_profile_required');
  // Heavy source imports and all file verification happen only in explicit main.
  const {createPhase7Server}=await import('./profile_server.mjs');
  const fs=await import('node:fs');
  const config=JSON.parse(fs.readFileSync(new URL('./profile-config.json',import.meta.url),'utf8')).profiles[profile];
  const server=await createPhase7Server(profile,expectedFreezeSha?{expectedFreezeSha}:{});
  let closing=false;
  function closeOwned(){
    if(closing)return;closing=true;
    server.close(error=>{if(error){process.stderr.write(String(error)+'\n');process.exitCode=1;}});
    server.closeIdleConnections?.();
  }
  await new Promise((resolve,reject)=>{
    server.once('error',reject);
    server.listen(port,'127.0.0.1',()=>{server.removeListener('error',reject);resolve();});
  });
  process.once('SIGINT',closeOwned);process.once('SIGTERM',closeOwned);
  server.on('error',error=>{process.stderr.write(String(error)+'\n');process.exitCode=1;closeOwned();});
  const address=server.address();
  process.stdout.write('TOME_PHASE7_LOCAL_SERVER '+JSON.stringify({
    url:'http://127.0.0.1:'+address.port+config.entry,profile,host:'127.0.0.1',port:address.port,
    entry:config.entry,reportExpression:config.report_expression,
    approvedFreezeSha:server.tomeSourceIndex.approvedFreezeSha256,
    complete:false,fullRendererReady:false,defaultDeliveryModified:false,phase6DeliveryModified:false,
  })+'\n');
  return server;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  main().catch(error=>{process.stderr.write(String(error)+'\n');process.exitCode=1;});
}
