import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {originalHistoryLedger} from './original-history-ledger.mjs';
const record={index:'1',id:'history.intro.journey',english:'He started his journey on the surface of Phobos.',originalEnglish:'He started his journey on the surface of Phobos.',params:[]};
function fixture(records=[record],change={}){const bytes=Array.from(new TextEncoder().encode(JSON.stringify({schema:1,format:'drl.semantic-history',records})));return {format:'drl-original-core-files',entries:[{kind:'file',path:'/user/drl.presentation-history.json',bytes,sha256:createHash('sha256').update(Uint8Array.from(bytes)).digest('hex'),...change}]};}
test('actual intro ledger requires semantic ID and exact original English guard',()=>assert.deepEqual(originalHistoryLedger(fixture()).records,[record]));
test('rejects previously observed silently empty original-game ledger',()=>assert.throws(()=>originalHistoryLedger(fixture([])),/Actual Lua intro callback/));
test('rejects duplicate intro and changed original English guard',()=>{assert.throws(()=>originalHistoryLedger(fixture([record,record])));assert.throws(()=>originalHistoryLedger(fixture([{...record,originalEnglish:'changed'}])));});
test('rejects changed persisted bytes or missing sidecar',()=>{assert.throws(()=>originalHistoryLedger(fixture([record],{sha256:'0'.repeat(64)})),/Committed semantic-history bytes/);assert.throws(()=>originalHistoryLedger({format:'drl-original-core-files',entries:[]}));});
