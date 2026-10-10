import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
const native=fs.readFileSync(path.join(dir,'../../native/fpcvalkyrie/src/vtig.pas'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
if(sha(native)!=='509ebaae8da6fc8e4c9afcaa1a449e60ed52ba9437452065089fd85d660e4d4c')throw Error('Original VTIG hash changed');
const text=native.toString('utf8');
const helpers=text.slice(text.indexOf('type TTIGStyleStack = object'),text.indexOf('procedure VTIG_RenderTextSegment( const aText:'));
const components=['harness-prefix.inc','utf8-adapter.inc','harness-suffix.inc'];
const prefix=fs.readFileSync(path.join(dir,components[0]),'utf8');
const adapter=fs.readFileSync(path.join(dir,components[1]),'utf8');
const suffix=fs.readFileSync(path.join(dir,components[2]),'utf8');
const out=prefix+'\n'+helpers+'\n'+adapter+'\n'+suffix;
fs.writeFileSync(path.join(dir,'text-contract-probe.pas'),out);
fs.writeFileSync(path.join(dir,'harness-manifest.json'),JSON.stringify({schema:1,original_sha256:sha(native),
  original_helpers_sha256:sha(Buffer.from(helpers)),adapter_sha256:sha(Buffer.from(adapter)),probe_sha256:sha(Buffer.from(out)),
  exact_adapter_executed:true,original_vtig_unit_executed:false,game_executed:false,mocked:['VTIG drawing context','draw list'],
  rust_display_executed:true},null,2)+'\n');
