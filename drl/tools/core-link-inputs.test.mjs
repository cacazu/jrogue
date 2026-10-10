import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp, mkdir, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {captureLinkSources,compiledSourceRecords} from './core-link-inputs.mjs';

test('link source witness resolves units and detects source changes without running a build',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'drl-link-inputs-'));
  try{
    await mkdir(path.join(root,'src','build'),{recursive:true});
    await writeFile(path.join(root,'src','game.pas'),'unit game; interface implementation end.');
    await writeFile(path.join(root,'src','rules.inc'),'const Turns = 1;');
    await writeFile(path.join(root,'src','build','generated.pas'),'ignored build output');
    const before=await captureLinkSources(root,['src']);
    assert.deepEqual(before.files.map(file=>file.path),['src/game.pas','src/rules.inc']);
    const units=compiledSourceRecords(root,[path.join(root,'src','game.pas'),'rules.inc'],before);
    assert.deepEqual(units.unresolved,[]);
    assert.equal(units.files.length,2);
    assert.deepEqual(compiledSourceRecords(root,['absent.pas'],before).unresolved,['absent.pas']);
    await writeFile(path.join(root,'src','rules.inc'),'const Turns = 2;');
    assert.notEqual((await captureLinkSources(root,['src'])).sha256,before.sha256);
    await assert.rejects(captureLinkSources(root,['src','src']),/Duplicate build source path/);
  }finally{await rm(root,{recursive:true,force:true});}
});

test('ambiguous printed unit names cannot satisfy corresponding-source evidence',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'drl-link-ambiguous-'));
  try{
    for(const folder of ['a','b']){
      await mkdir(path.join(root,folder));
      await writeFile(path.join(root,folder,'shared.pas'),'unit shared; interface implementation end.');
    }
    const snapshot=await captureLinkSources(root,['a','b']);
    assert.deepEqual(compiledSourceRecords(root,['shared.pas'],snapshot).unresolved,['shared.pas']);
    assert.deepEqual(compiledSourceRecords(root,['a/shared.pas'],snapshot).unresolved,[]);
  }finally{await rm(root,{recursive:true,force:true});}
});
