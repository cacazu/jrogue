import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root = path.resolve(import.meta.dirname, 'candidates/o1-conservative-asyncify/attempts/attempt-2');
const changes = [];
for (const name of ['link-candidate.json', 'run-config.json']) {
  const file = path.join(root, name);
  const prior = fs.readFileSync(file);
  const config = JSON.parse(prior);
  if (!Object.hasOwn(config, 'existingPidPreserved')) continue;
  const historicalPid = config.existingPidPreserved;
  delete config.existingPidPreserved;
  config.historicalOriginalPid = historicalPid;
  const backup = path.join(root, name.replace('.json', '.startup.json'));
  fs.writeFileSync(backup, prior, {flag: 'wx'});
  const updated = Buffer.from(JSON.stringify(config, null, 2) + '\n');
  fs.writeFileSync(file, updated);
  const sha = b => crypto.createHash('sha256').update(b).digest('hex');
  changes.push({file, priorBytesPath: backup, priorSha256: sha(prior), updatedSha256: sha(updated),
    changedField: 'existingPidPreserved -> historicalOriginalPid', argvUnchanged: true,
    authorization: 'Parent requested correction of legacy bookkeeping after original process was authorized-ended.'});
}
fs.writeFileSync(path.join(root, 'metadata-correction.json'), JSON.stringify({timestampUtc: new Date().toISOString(), changes}, null, 2) + '\n');
console.log(JSON.stringify({changes}));
