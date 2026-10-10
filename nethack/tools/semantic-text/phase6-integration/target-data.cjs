/* Added 2026-10-02, NGPL: isolated target-WASM makedefs data regeneration.
 * All bytes are original source inputs or original target utility outputs.
 * This script is used only after the parent's compiler/runtime slot gate. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const [utility, source, output] = process.argv.slice(2);
const create = require(path.resolve(utility));
(async () => {
  const m = await create({noInitialRun: true, print: s => process.stderr.write(s+'\n'), printErr: s => process.stderr.write(s+'\n')});
  for (const directory of ['include','dat','util']) {
    m.FS.mkdir('/'+directory);
    for (const entry of fs.readdirSync(path.join(source,directory),{withFileTypes:true})) {
      if (entry.isFile()) m.FS.writeFile('/'+directory+'/'+entry.name,fs.readFileSync(path.join(source,directory,entry.name)));
    }
  }
  m.FS.chdir('/util');
  const macroEvidence=JSON.parse(m.UTF8ToString(m._nh_build_target_macros()));
  m.callMain(['-drhs123v']);
  const names=['dat/data','dat/rumors','dat/oracles','dat/epitaph','dat/engrave','dat/bogusmon','dat/options','include/date.h'];
  const files={};
  for (const name of names) files[name]=Buffer.from(m.FS.readFile('/'+name)).toString('base64');
  fs.writeFileSync(output,JSON.stringify({schemaVersion:1,files,macroEvidence}));
})().catch(error=>{console.error(error);process.exitCode=1;});
