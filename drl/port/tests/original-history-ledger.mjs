import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const digest=bytes=>createHash('sha256').update(Uint8Array.from(bytes)).digest('hex');
export function originalHistoryLedger(snapshot) {
  assert.equal(snapshot.format,'drl-original-core-files');
  const entries=snapshot.entries.filter(e=>e.kind==='file'&&e.path.endsWith('/drl.presentation-history.json'));
  assert.equal(entries.length,1,'Exactly one original semantic-history sidecar');
  const entry=entries[0];
  assert.equal(digest(entry.bytes),entry.sha256,'Committed semantic-history bytes');
  const ledger=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(entry.bytes)));
  assert.equal(ledger.schema,1);assert.equal(ledger.format,'drl.semantic-history');
  assert.ok(Array.isArray(ledger.records));
  const intro=ledger.records.filter(r=>r.id==='history.intro.journey');
  assert.equal(intro.length,1,'Actual Lua intro callback must capture one semantic-history record');
  assert.deepEqual(intro[0],{index:'1',id:'history.intro.journey',english:'He started his journey on the surface of Phobos.',originalEnglish:'He started his journey on the surface of Phobos.',params:[]});
  return {path:entry.path,sha256:entry.sha256,records:ledger.records};
}
