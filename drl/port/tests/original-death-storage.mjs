// Read-only source-policy helpers for the preserved original native death gate.
// Paths: drl.pas:156; dfhof.pas:729-747; dfplayer.pas:628.
import assert from 'node:assert/strict';

export function sourceSelectedDeathPaths(browserConfig,{moduleId='drl'}={}){
  assert.equal(typeof browserConfig,'string');
  assert.ok(/^[a-z][a-z0-9_-]*$/.test(moduleId));
  const includes=[...browserConfig.matchAll(/^\s*dofile\(['"]config\.lua['"]\)\s*$/gm)];
  assert.equal(includes.length,1,'Exactly one original config include required');
  const literal=key=>{
    const rows=[...browserConfig.matchAll(new RegExp('^\\s*'+key+'\\s*=\\s*([\'\"])([^\'\"\\r\\n]*)\\1\\s*(?:--[^\\n]*)?$','gm'))]
      .filter(match=>match.index>includes[0].index);
    assert.equal(rows.length,1,'Exactly one literal '+key+' override after the original config required');
    return rows[0][2];
  };
  const writePath=literal('WritePath'),scorePath=literal('ScorePath');
  const root=value=>value.startsWith('/user/')&&value.endsWith('/')&&
    value.split('/').slice(1,-1).every(part=>/^[a-zA-Z0-9_-]+$/.test(part));
  assert.ok(root(writePath),'Confined canonical native WritePath required');
  assert.ok(scorePath===''||root(scorePath),'Confined canonical native ScorePath or original empty fallback required');
  const moduleUserPath=writePath+'user/'+moduleId+'/',scoreRoot=scorePath||moduleUserPath;
  return {writePath,scorePath,moduleId,moduleUserPath,
    mortem:moduleUserPath+'mortem.txt',profile:moduleUserPath+'player.wad',score:scoreRoot+'score.wad',
    score_path_uses_original_empty_fallback:scorePath==='',
    source:['drl.pas:156 ModuleUserPath','dfhof.pas:729-747 ScorePath versus ModuleUserPath','dfplayer.pas:628 mortem path']};
}

export function pinnedSeededRecordingPolicy({data,base,hof,playerLua}){
  for(const value of [data,base,hof,playerLua])assert.equal(typeof value,'string');
  for(const flag of ['NoPlayerRecord','NoScoreRecord']){
    assert.match(data,new RegExp('\\b'+flag+'\\s*:\\s*Boolean\\s*=\\s*False\\s*;','i'),'Original false declaration required');
    const writes=[...base.matchAll(new RegExp('\\b'+flag+'\\s*:=\\s*(False|True)\\s*;','gi'))];
    assert.equal(writes.length,1,'Pinned run resets '+flag+' exactly once');
    assert.equal(writes[0][1].toLowerCase(),'false','Original recording must not be enabled by a test override');
  }
  assert.match(hof,/if\s+not\s+NoScoreRecord\s+then/i);
  assert.match(hof,/if\s+not\s+NoPlayerRecord\s+then/i);
  assert.match(playerLua,/if\s+SEEDED_GAME\s+and\s+badges\[\s*badge\s*\]\.level\s*>=\s*4\s+then\s+return\s+end/u);
  assert.ok(!/NoScoreRecord|NoPlayerRecord/.test(playerLua),'Seeded badge helper must not change recording policy');
  return {fixture_seed:5489,fixture_difficulty:1,source_score_recording_enabled:true,
    source_player_recording_enabled:true,seeded_restriction:'Badges of level >=4 are withheld by player:add_badge; recording flags remain original false.',
    runtime_recording_flags_introspected:false,flags_modified_by_test:false,
    limitation:'Pinned original source policy only; actual committed files and live/fresh native score/profile views remain independent runtime gates.',
    source:['dfdata.pas:109-110','drlbase.pas:1362-1363','dfhof.pas:845,924','bin/data/core/player.lua:46-48']};
}
