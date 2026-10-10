// SPDX-License-Identifier: GPL-2.0-only
// Freeze only the already applied additive source evidence, not mutable peers.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {sourceInsertions,stripDomain} from './integrate.mjs';
const directory=path.dirname(fileURLToPath(import.meta.url));
for(const [name,baseline] of [['integration-evidence.json','source-baseline'],['popup-integration-evidence.json','popup-source-baseline']]) {
 const filename=path.join(directory,name),evidence=JSON.parse(fs.readFileSync(filename,'utf8'));
 for(const file of evidence.files) {
  const source=fs.readFileSync(path.resolve(directory,'../../logic',file.file),'utf8');
  if(crypto.createHash('sha256').update(source).digest('hex')!==file.modified_sha256)throw Error('Peer source already changed: '+file.file);
  if(stripDomain(source)!==fs.readFileSync(path.join(directory,baseline,file.file),'utf8'))throw Error('Native byte mismatch: '+file.file);
  file.insertions=sourceInsertions(source);
 }
 fs.writeFileSync(filename,JSON.stringify(evidence,null,2)+'\n');
}
