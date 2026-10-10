import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {stripRecentAnnotations} from './native-annotations.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const upstream=process.env.ANGBAND_UPSTREAM || 'C:\\Users\\kit\\gameme\\jnethack\\jrouge\\angband\\upstream\\angband-4.2.6';
const normalized=s=>s.replaceAll('\r\n','\n');
const stripCapture=s=>stripRecentAnnotations(s).replace(/\/\* AB_GAME_STATIC_BEGIN \*\/[\s\S]*?\/\* AB_GAME_STATIC_END \*\//g,'').replace(/\/\* AB_TEXT_CAPTURE_BEGIN \*\/[\s\S]*?\/\* AB_TEXT_CAPTURE_END \*\/(?:\r\n|\n)?/g,'');
test('reviewed game IDs cover source callsites and both catalogs without parameter drift',async()=>{
 const en=JSON.parse(await readFile(path.join(root,'locales/game-en.json'),'utf8'));
 const ja=JSON.parse(await readFile(path.join(root,'locales/game-ja.json'),'utf8'));
 const source=await readFile(path.join(root,'logic/cmd-cave.c'),'utf8');
 const ids=[...source.matchAll(/\bAB_MSGT?\("([^"]+)"/g)].map(m=>m[1]);
 assert.equal(ids.length,61);
 assert.equal(new Set(ids).size,44);
 assert.deepEqual(Object.keys(en.messages).sort(),Object.keys(ja.messages).sort());
 assert.deepEqual([...new Set(ids)].sort(),Object.keys(en.messages).sort());
 for(const id of ids){assert.equal(typeof ja.messages[id],'string');assert.ok(ja.messages[id]);assert.doesNotMatch(en.messages[id],/%(?!%)/);assert.doesNotMatch(ja.messages[id],/%(?!%)/);}
 assert.equal(en._meta.coverage.complete_game_translation,false);
 assert.equal(ja._meta.coverage.complete_game_translation,false);
});
test('localization wrappers preserve every original cave message and rule statement',async()=>{
 let changed=normalized(stripCapture(await readFile(path.join(root,'logic/cmd-cave.c'),'utf8')));
 const original=normalized(await readFile(path.join(upstream,'src/cmd-cave.c'),'utf8'));
 changed=changed.replace('#include "web-semantic.h"\n','');
 changed=changed.replace(/AB_MSG\("[^"]+", ("(?:\\.|[^"\\])*"(?:\s*"(?:\\.|[^"\\])*")*)\)/g,(_,s)=>'msg('+s+')');
 changed=changed.replace(/AB_MSGT\("[^"]+", ([^,]+),(\s*)("(?:\\.|[^"\\])*"(?:\s*"(?:\\.|[^"\\])*")*)\)/g,(_,type,space,s)=>'msgt('+type+','+space+s+')');
 if(changed!==original){let i=0;while(changed[i]===original[i])i++;assert.fail('source reconstruction differs at byte '+i+': '+JSON.stringify({actual:changed.slice(i-40,i+100),expected:original.slice(i-40,i+100)}));}
 assert.equal(normalized(stripCapture(await readFile(path.join(root,'logic/cmd-pickup.c'),'utf8'))),normalized(await readFile(path.join(upstream,'src/cmd-pickup.c'),'utf8')));
});
