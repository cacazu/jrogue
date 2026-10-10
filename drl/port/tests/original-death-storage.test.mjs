import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {sourceSelectedDeathPaths,pinnedSeededRecordingPolicy} from './original-death-storage.mjs';
const text=async relative=>readFile(new URL('../../'+relative,import.meta.url),'utf8');
const config=await text('core-overlay/drl/bin/config-browser.lua');
const source={data:await text('native/drl/src/dfdata.pas'),base:await text('native/drl/src/drlbase.pas'),
  hof:await text('native/drl/src/dfhof.pas'),playerLua:await text('native/drl/bin/data/core/player.lua')};
test('verified browser literal roots place score separately from module profile and mortem',()=>{
  const p=sourceSelectedDeathPaths(config);
  assert.equal(p.mortem,'/user/user/drl/mortem.txt');assert.equal(p.profile,'/user/user/drl/player.wad');
  assert.equal(p.score,'/user/score.wad');assert.equal(p.score_path_uses_original_empty_fallback,false);
  assert.notEqual(p.score,p.moduleUserPath+'score.wad');
});
test('empty original ScorePath uses ModuleUserPath, with no guessed alternative',()=>{
  const p=sourceSelectedDeathPaths(config.replace("ScorePath = '/user/'","ScorePath = ''"));
  assert.equal(p.score,'/user/user/drl/score.wad');assert.equal(p.score_path_uses_original_empty_fallback,true);
});
test('missing, ambiguous, dynamic and unsafe root selections fail closed',()=>{
  for(const changed of [config.replace("ScorePath = '/user/'",''),config+"\nScorePath = '/user/'\n",
    config.replace("ScorePath = '/user/'","ScorePath = os.getenv('root')"),
    config.replace("ScorePath = '/user/'","ScorePath = '/user/../data/'"),
    config.replace("WritePath = '/user/'","WritePath = '/outside/'")])
    assert.throws(()=>sourceSelectedDeathPaths(changed));
});
test('pinned seed5489/diff1 retains native recording while restricting platinum-and-higher badges',()=>{
  const p=pinnedSeededRecordingPolicy(source);
  assert.equal(p.source_score_recording_enabled,true);assert.equal(p.source_player_recording_enabled,true);
  assert.equal(p.flags_modified_by_test,false);assert.equal(p.runtime_recording_flags_introspected,false);
});
test('changed recording reset and seeded score suppression cannot be silently treated as enabled',()=>{
  assert.throws(()=>pinnedSeededRecordingPolicy({...source,base:source.base.replace(/NoScoreRecord\s*:= False;/,"NoScoreRecord := True;")}));
  assert.throws(()=>pinnedSeededRecordingPolicy({...source,playerLua:source.playerLua+'\nNoScoreRecord = true\n'}));
  assert.throws(()=>pinnedSeededRecordingPolicy({...source,playerLua:source.playerLua.replace('.level >= 4','.level >= 1')}));
});
