// SPDX-License-Identifier: GPL-2.0-only
// Copy only immutable official-source evidence; never modify upstream.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const upstream='C:/Users/kit/gameme/jnethack/jrouge/angband/upstream/angband-4.2.6/src';
const dest=path.join(here,'upstream-snapshots');fs.mkdirSync(dest,{recursive:true});
const records=[];for(const name of ['effects-info.c','list-effects.h','obj-info.c','ui-effect.c','ui-knowledge.c','player-spell.c']){const bytes=fs.readFileSync(path.join(upstream,name));if(bytes.includes(Buffer.from('AB_EFFECT_BEGIN')))throw Error('Instrumented source is not pristine');const target=path.join(dest,name);if(fs.existsSync(target)){if(!fs.readFileSync(target).equals(bytes))throw Error('Pinned official source changed '+name);}else fs.writeFileSync(target,bytes);records.push({file:'src/'+name,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length});}
fs.writeFileSync(path.join(here,'upstream-source-lock.json'),JSON.stringify({schema_version:1,upstream_commit:'f3082213b73f3e463e3d0d60bff4b00462beae6e',archive_sha256:'8c0ffa2b85d74bd0cc273752f61c0440dba93323cd790be460f90c8dced7cbf4',license:'GPL-2.0-only',records},null,2)+'\n');
console.log(JSON.stringify({pristine_copied:records.length,records}));
