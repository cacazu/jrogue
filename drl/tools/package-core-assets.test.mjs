import test from 'node:test';
import assert from 'node:assert/strict';
import {permittedAsset} from './package-core-assets.mjs';

test('raw original core includes scripts, help and source ASCII only', () => {
  for (const file of ['config.lua','config-browser.lua','data/core/main.lua','data/drl/levels/arena.lua','data/drl/help/keys.hlp','data/drl/ascii/logo.asc']) assert.equal(permittedAsset(file), true, file);
});
test('native binaries, proprietary audio, images, fonts and external modules are excluded', () => {
  for (const file of ['fmod64.dll','font.dat','data/drl/music/title.mid','data/drl/sound/fire.wav','data/drl/graphics/player.png','data/drllq/main.lua','data/drlhq/main.lua','data/jhc/main.lua','data/drl/../jhc/main.lua','/data/drl/main.lua','data/drl/help/keys.txt']) assert.equal(permittedAsset(file), false, file);
});
