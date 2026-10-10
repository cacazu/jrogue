// SPDX-License-Identifier: GPL-2.0-only
// Independent source-catalog golden values for the parent's pure WASM gate.
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../..');
const load=(dir,file)=>JSON.parse(fs.readFileSync(path.join(root,'migration',dir,file),'utf8'));
const integer=value=>({type:'integer',value}),ref=(id,params={})=>({kind:'ref',id,params});
const bounded=(native_max_bytes,parts)=>({kind:'bounded',native_max_bytes,parts});
const graph=parts=>({schema_version:1,parts});
const descriptor=value=>({type:'EffectDescription',value});
const p='angband.effect_info.spell_preview.',g='angband.effect_info.grammar.';
const fixtures=[
 {name:'native20-dice-in250-description',id:'angband.effect_info.description',params:{description:descriptor(graph([bounded(250,[ref('angband.effect_info.description.damage',{dice:descriptor(graph([bounded(20,[ref(g+'dice.base_roll',{base:integer(2147483647),dice:integer(2147483647),sides:integer(6)})])]))})])]))}},
 {name:'native30-preview-with40-radius',id:p+'description',params:{description:descriptor(graph([bounded(30,[ref(p+'label',{label:{type:'localized_text',value:{id:p+'label.dam'}}}),ref(p+'dice.base',{base:integer(2147483647)}),ref(p+'dice.plus'),ref(p+'dice.roll',{dice:integer(2147483647),sides:integer(2147483647)}),bounded(40,[ref(p+'special.radius',{radius:integer(2)})])])]))}}
];
function renderRef(id,params,dictionary,locale){const text=dictionary[id];if(text===undefined)throw Error('Unknown production ID '+id);const values=Object.fromEntries(Object.entries(params).map(([name,p])=>[name,p.type==='integer'?String(p.value):p.type==='localized_text'?renderRef(p.value.id,p.value.params??{},dictionary,locale):renderGraph(p.value,dictionary,locale)]));return text.replace(/\{([a-z_]+)\}/g,(_,name)=>{if(!(name in values))throw Error('Missing production parameter '+name);return values[name];});}
function renderNode(node,dictionary,locale){if(node.kind==='ref')return renderRef(node.id,node.params,dictionary,locale);const text=node.parts.map(p=>renderNode(p,dictionary,locale)).join('');if(locale==='ja')return text;if(!/^[\x00-\x7f]*$/.test(text))throw Error('Native EN is not ASCII');return Buffer.from(text).subarray(0,node.native_max_bytes-1).toString('ascii');}
function renderGraph(value,dictionary,locale){return value.parts.map(p=>renderNode(p,dictionary,locale)).join('');}
for(const locale of ['en','ja']){const dictionary={...load('effect-description-data',locale+'.json'),...load('spell-preview-data',locale+'.json')};for(const fixture of fixtures){fixture.expected??={};fixture.expected[locale]=renderRef(fixture.id,fixture.params,dictionary,locale);}}
const result={schema_version:1,upstream_commit:'f3082213b73f3e463e3d0d60bff4b00462beae6e',status:'source_goldens_not_wasm_executed',fixtures};
const text=JSON.stringify(result,null,2)+'\n',target=path.join(here,'probe-fixtures.json');
if(process.argv.includes('--check')){if(fs.readFileSync(target,'utf8')!==text)throw Error('Stale source golden fixture');}else fs.writeFileSync(target,text);
console.log(JSON.stringify({fixtures:fixtures.map(f=>({name:f.name,expected:f.expected}))}));
