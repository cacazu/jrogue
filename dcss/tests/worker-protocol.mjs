// Protocol mocks read installed source; no C++ engine or WASM module executes.
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const directory=path.dirname(fileURLToPath(import.meta.url));
const repository=process.env.DCSS_REPOSITORY||path.resolve(directory,'..');
for(const script of ['worker-host.cjs','main-host.cjs','timer-order.cjs','cache-filter.cjs','startup-preflight.cjs']){
  const result=spawnSync(process.execPath,[path.join(directory,'worker',script)],{
    cwd:repository,windowsHide:true,encoding:'utf8',timeout:10000,
    env:{...process.env,DCSS_REPOSITORY:repository,
      DCSS_WORKER_SOURCE:process.env.DCSS_WORKER_SOURCE||path.join(repository,'web/core-worker.js'),
      DCSS_CORE_DEBUG_SOURCE:process.env.DCSS_CORE_DEBUG_SOURCE||path.join(repository,'web/core-debug.mjs')},
  });
  process.stdout.write(result.stdout??'');process.stderr.write(result.stderr??'');
  if(result.error)throw result.error;
  if(result.status!==0)process.exit(result.status??1);
}
