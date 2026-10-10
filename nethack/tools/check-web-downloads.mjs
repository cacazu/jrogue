/* Local HTTP verification of the actual source offer; no game or external network. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {open, readFile, realpath, mkdir} from 'node:fs/promises';
import {resolve, dirname} from 'node:path';
import {serveIntegration} from './serve-integration.mjs';

const root=await realpath(resolve(process.argv[2]));
const reportPath=resolve(process.argv[3]);
const archiveSha=process.argv[4];
assert.match(archiveSha,/^[0-9a-f]{64}$/);
assert.equal(process.env.NETHACK_PARENT_SERIAL_SLOT,'phase6');
await mkdir(dirname(reportPath),{recursive:true});
const output=await open(reportPath,'wx');
const report={status:'failed',scope:'Local HTTP source/archive/license offer; no gameplay execution',webRoot:root,checks:[],gameplayInvoked:false};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
let service;
try {
  service=await serveIntegration({root,port:0});
  report.localUrl=service.url;
  const index=await readFile(resolve(root,'index.html'));
  for(const href of ['./downloads/NGPL.txt','./downloads/corresponding-source.tar.gz']) {
    assert.ok(index.toString('utf8').includes(`href="${href}"`),`Missing source/license footer link: ${href}`);
  }
  for(const [path,expected] of [['index.html',hash(index)],['downloads/NGPL.txt','93a3ae2cb8dee482daddfaebe53bcffe5b114b603def19b4dca21621cbc5a747'],['downloads/corresponding-source.tar.gz',archiveSha]]) {
    const response=await fetch(new URL(path,service.url));
    assert.equal(response.status,200,path);
    assert.equal(response.headers.get('cross-origin-opener-policy'),'same-origin');
    assert.equal(response.headers.get('cross-origin-embedder-policy'),'require-corp');
    const bytes=Buffer.from(await response.arrayBuffer());
    assert.equal(hash(bytes),expected,path);
    if(path.endsWith('.tar.gz'))assert.deepEqual([...bytes.subarray(0,2)],[0x1f,0x8b]);
    report.checks.push({path,status:200,bytes:bytes.length,sha256:expected});
  }
  report.status='passed';
} catch(error) {
  report.error=error.stack;
  process.exitCode=1;
} finally {
  if(service){await service.close();report.requests=service.requests;report.ownedServerClosed=true;}
  await output.writeFile(JSON.stringify(report,null,2)+'\n');
  await output.close();
}
console.log(JSON.stringify({status:report.status,report:reportPath,checks:report.checks.length,ownedServerClosed:report.ownedServerClosed}));
