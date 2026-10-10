/** Reviewed DRL dynamic presentation message proposals, GPL-2.0-only.
 * Official upstream tag0_10_11a, a6f965072b3a25b768c91dbced00367f1b57d865.
 * Metadata only: no Lua execution, gameplay edits, global replacements or RNG calls.
 * Integrators must retain the original call receiver, argument roles, branch flow,
 * local/domain values and RNG selection, evaluating each listed parameter once.
 */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {scanMessageCalls} from './message-inventory.mjs';
import {scanSource} from '../port/tools/inventory-texts.mjs';
import {render} from './render.mjs';

export const sourceCommit = 'a6f965072b3a25b768c91dbced00367f1b57d865';
const here = path.dirname(fileURLToPath(import.meta.url));
const drl = file => `bin/data/drl/${file}.lua`;
const binding = (name,type,originalExpression,presentationExpression=originalExpression) => ({
  name,type,originalExpression,presentationExpression,evaluation:'once',
});
const nameBinding = (object,known,sentence,name='subject') => binding(name,'string',
  `${object}:get_name(${known},${sentence})`, `ui.being_name(${object},${known},${sentence})`);
const registryName = (object,category='being',name='subject') => binding(name,'string',
  `${object}.name`, `ui.registry_text('${category}',${object}.id,'base_game','name',${object}.name)`);
const message = (argumentIndex,role,id,english,japanese,bindings=[],extra={}) => ({
  argumentIndex,role,id,english,japanese,bindings,...extra,
});
const call = (file,line,callee,originalArguments,messages,extra={}) => ({
  file:file.startsWith('bin/')?file:drl(file),line,callee,originalArguments,messages,
  integration:'replace-only-listed-presentation-arguments',...extra,
});
const observer = (id,english,japanese,bindings=[]) => message(1,'observer',id,english,japanese,bindings);
const player = (id,english,japanese,bindings=[]) => message(0,'player',id,english,japanese,bindings);
const visible = (id,english,japanese,bindings=[]) => message(0,'message',id,english,japanese,bindings);

/** Every original argument guard is recorded independently of the scanner inventory.
 * Empty player messages and nil remain exact original values; observer messages are
 * still evaluated/passed to being:msg once and filtered by its original visibility logic.
 */
export const dynamicMessageCalls = [
  call('ai',118,'self:msg',['""','self:get_name(true,true).. " raises his arms!"'],[
    observer('message.ai.arch-vile.resurrection-arms','{{subject}} raises his arms!','{{subject}}が両腕を掲げる！',[nameBinding('self',true,true)]),
  ],{preservedArguments:{0:'""'}}),
  call('ai',119,'b:msg',['""','b:get_name(true,true).." suddenly rises from the ground!"'],[
    observer('message.ai.arch-vile.corpse-resurrected','{{subject}} suddenly rises from the ground!','{{subject}}が突然、地面から起き上がる！',[nameBinding('b',true,true)]),
  ],{preservedArguments:{0:'""'}}),
  call('ai',164,'self:msg',['""','"The " .. self.name .. " raises his arms!"'],[
    observer('message.ai.arch-vile.fire-arms','The {{subject}} raises his arms!','{{subject}}が両腕を掲げる！',[registryName('self')]),
  ],{preservedArguments:{0:'""'}}),
  call('ai',403,'self:msg',['""','"Carmack raises his hands and summons hellspawn!"'],[
    observer('message.ai.carmack.hellspawn-summoned','Carmack raises his hands and summons hellspawn!','Carmackが両手を掲げ、地獄の魔物を召喚する！'),
  ],{preservedArguments:{0:'""'},identityNames:['Carmack']}),
  call('ai',517,'self:msg',['""','"The ".. self.name .." flinched!"'],[
    observer('message.ai.mastermind.flinched','The {{subject}} flinched!','{{subject}}がひるんだ！',[registryName('self')]),
  ],{preservedArguments:{0:'""'}}),
  call('cells',354,'being:msg',['"There are stairs leading to "..player.episode[linfo.special].name.." here."'],[
    visible('message.cell.special-stairs.destination','There are stairs leading to {{destination}} here.','ここに{{destination}}へ続く階段がある。',[
      binding('destination','string','player.episode[linfo.special].name',
        "(function(destination) return ui.registry_text('level',destination.script,'base_game','name',destination.name) end)(player.episode[linfo.special])"),
    ]),
  ],{identityProof:{file:drl('main'),lines:[623,627],description:'Special episode entry copies level_proto.id into script and level_proto.name into name. Inline adapter captures that existing episode table once; unknown/custom registry names retain their original fallback.'}}),
  call('challenge',1206,'ui.plot_screen',[
    'string.gsub([[\nYou\'ve completed @1 levels of DRL!\n\nYou can rest easy knowing that you\'re Boss. Yet at the last level you sensed something missing... was there something you\'ve not accomplished? The secret of the Dragonslayer and the Berserk Armor is left unsolved...]],\n\t\t\t\t"@1", tostring(level_count))','RED',
  ],[
    message(0,'plot','message.challenge.century.completed-outro',
      "You've completed {{levels}} levels of DRL!\n\nYou can rest easy knowing that you're Boss. Yet at the last level you sensed something missing... was there something you've not accomplished? The secret of the Dragonslayer and the Berserk Armor is left unsolved...",
      'DRLで{{levels}}階を踏破した！\n\n自分がボスだとわかった今、胸を張って休める。だが最後の階で、何かが欠けていると感じた……まだ成し遂げていないことがあるのだろうか？　ドラゴンスレイヤーとバーサーカーアーマーの秘密は、解かれないままだ……',
      [binding('levels','integer','level_count')]),
  ],{preservedArguments:{1:'RED'},numericConversion:'Named integer replaces only the original display tostring/string.gsub; the existing level_count assignments and win flow remain unchanged.'}),
  call('events',111,'ui.msg_feel',['"\\\"Thermonuclear bomb deployed. "..minutes.." minutes till explosion.\\\""'],[
    visible('message.event.armed-nuke.countdown','"Thermonuclear bomb deployed. {{minutes}} minutes till explosion."','「熱核爆弾が設置されました。爆発まで{{minutes}}分。」',[binding('minutes','integer','minutes')]),
  ]),
  call('events',241,'ui.msg',['"Suddenly, "..b.name.." appears near you!"'],[
    visible('message.event.targeted.enemy-appeared','Suddenly, {{subject}} appears near you!','突然、近くに{{subject}}が現れる！',[registryName('b')]),
  ],{rngPolicy:'Use the already selected local b. Do not rerun table.random_pick(list), random_empty_coord, relocation or explosion.'}),
  call('items/eitems',524,'being:msg',['"Suddenly "..target:get_name(true,false).." blinks away!"'],[
    visible('message.item.combat-translocator.target-phased','Suddenly {{subject}} blinks away!','突然、{{subject}}が姿を消す！',[nameBinding('target',true,false)]),
  ]),
  call('items/items',793,'being:msg',['"You feel healed."','being:get_name(true,true).." looks healthier!"'],[
    player('message.item.small-med-pack.healed.player','You feel healed.','傷が癒えたのを感じる。'),
    observer('message.item.small-med-pack.healed.observer','{{subject}} looks healthier!','{{subject}}の傷が癒えたようだ！',[nameBinding('being',true,true)]),
  ]),
  call('items/items',828,'being:msg',['"You feel fully healed."','being:get_name(true,true).." looks a lot healthier!"'],[
    player('message.item.large-med-pack.healed.player','You feel fully healed.','傷がすっかり癒えたのを感じる。'),
    observer('message.item.large-med-pack.healed.observer','{{subject}} looks a lot healthier!','{{subject}}の傷がかなり癒えたようだ！',[nameBinding('being',true,true)]),
  ]),
  call('items/items',851,'being:msg',['"You feel yanked in a non-existing direction!"','"Suddenly "..being:get_name(true,false).." blinks away!"'],[
    player('message.item.phase-device.disappeared.player','You feel yanked in a non-existing direction!','存在しない方向へ引きずられる感覚がする！'),
    observer('message.item.phase-device.disappeared.observer','Suddenly {{subject}} blinks away!','突然、{{subject}}が姿を消す！',[nameBinding('being',true,false)]),
  ]),
  call('items/items',855,'being:msg',['nil','"Suddenly "..being:get_name(false,false).." appears out of nowhere!"'],[
    observer('message.item.phase-device.appeared.observer','Suddenly {{subject}} appears out of nowhere!','突然、どこからともなく{{subject}}が現れる！',[nameBinding('being',false,false)]),
  ],{preservedArguments:{0:'nil'}}),
  call('items/items',877,'being:msg',['"You feel yanked in a non-existing direction!"','"Suddenly "..being:get_name(true,false).." blinks away!"'],[
    player('message.item.homing-phase-device.disappeared.player','You feel yanked in a non-existing direction!','存在しない方向へ引きずられる感覚がする！'),
    observer('message.item.homing-phase-device.disappeared.observer','Suddenly {{subject}} blinks away!','突然、{{subject}}が姿を消す！',[nameBinding('being',true,false)]),
  ]),
  call('items/items',885,'being:msg',['nil','"Suddenly "..being:get_name(false,false).." appears out of nowhere!"'],[
    observer('message.item.homing-phase-device.appeared.observer','Suddenly {{subject}} appears out of nowhere!','突然、どこからともなく{{subject}}が現れる！',[nameBinding('being',false,false)]),
  ],{preservedArguments:{0:'nil'}}),
  ...[
    [1744,'basic'],[1765,'advanced'],[1786,'master'],
  ].map(([line,tier])=>call('items/items',line,'ui.msg_enter',['"You suddenly know how to assemble "..mod_arrays[self.ammo].name.."!"'],[
    visible(`message.item.${tier}-schematics.assembly-learned`,'You suddenly know how to assemble {{assembly}}!','突然、{{assembly}}の組み立て方がわかる！',[
      binding('assembly','string','mod_arrays[self.ammo].name',
        "(function(prototype) return ui.registry_text('mod_array',prototype.id,'base_game','name',prototype.name) end)(mod_arrays[self.ammo])"),
    ]),
  ],{evaluationPolicy:'Capture the already selected mod_arrays[self.ammo] prototype once in the parameter adapter. The preceding player:add_assembly and self.ammo remain unchanged.'})),
  call('items/uitems',67,'being:msg',['"Suddenly "..target:get_name(true,false).." crashes!"'],[
    visible('message.item.null-pointer.target-crashed','Suddenly {{subject}} crashes!','突然、{{subject}}がクラッシュする！',[nameBinding('target',true,false)]),
  ]),
  call('main',199,'being:msg',['"You feel yanked away!"','being:get_name(true,true).." suddenly disappears!"'],[
    player('message.item.teleporter.disappeared.player','You feel yanked away!','引きずり飛ばされる感覚がする！'),
    observer('message.item.teleporter.disappeared.observer','{{subject}} suddenly disappears!','{{subject}}が突然、姿を消す！',[nameBinding('being',true,true)]),
  ]),
  call('main',216,'being:msg',['nil','"Suddenly "..being:get_name(false,false).." appears out of nowhere!"'],[
    observer('message.item.teleporter.appeared.observer','Suddenly {{subject}} appears out of nowhere!','突然、どこからともなく{{subject}}が現れる！',[nameBinding('being',false,false)]),
  ],{preservedArguments:{0:'nil'}}),
  call('main',687,'ui.plot_screen',[
    '[[\n\n\n\n\n             D**m, the Roguelike ]]..VERSION_MODULE..[[\n\n                   Congratulations!\n           Look further for the next release\n            on https://drl.chaosforge.org/]]',
  ],[
    message(0,'plot','message.game.victory.release-outro',
      '\n\n\n\n             D**m, the Roguelike {{version}}\n                   Congratulations!\n           Look further for the next release\n            on https://drl.chaosforge.org/',
      '\n\n\n\n             D**m, the Roguelike {{version}}\n                   おめでとう！\n           次のリリースのお知らせは\n            https://drl.chaosforge.org/ へ',
      [binding('version','string','VERSION_MODULE')]),
  ],{identityNames:['D**m, the Roguelike'],identityUrls:['https://drl.chaosforge.org/'],longStringPolicy:'Templates use actual Lua long-string values: the first newline after each opening [[ is removed, as independently implemented by the source scanner.'}),
  call('perks',330,'ui.msg',['"You pump a shell into the "..self.name.." chamber."'],[
    visible('message.perk.pump-action.chamber-loaded','You pump a shell into the {{weapon}} chamber.','{{weapon}}の薬室に散弾を送り込む。',[registryName('self','item','weapon')]),
  ]),
  call('perks',344,'being:msg',['"You "..pack.."load a shell into the "..self.name.."."','being:get_name(true,true).." loads a shell into his "..self.name.."."'],[
    {...player('message.perk.pump-action.shell-loaded.player','You load a shell into the {{weapon}}.','{{weapon}}に散弾を装填する。',[registryName('self','item','weapon')]),variant:'normal'},
    {...player('message.perk.pump-action.shell-loaded-quickly.player','You quickly load a shell into the {{weapon}}.','{{weapon}}に素早く散弾を装填する。',[registryName('self','item','weapon')]),variant:'quick'},
    observer('message.perk.pump-action.shell-loaded.observer','{{subject}} loads a shell into his {{weapon}}.','{{subject}}が{{weapon}}に散弾を装填する。',[nameBinding('being',true,true),registryName('self','item','weapon')]),
  ],{
    selection:{argumentIndex:0,originalExpression:'pack == "quickly "',evaluation:'once',cases:[{when:true,variant:'quick'},{when:false,variant:'normal'}]},
    producerGuards:[{file:drl('perks'),line:342,source:'local pack = ""'},{file:drl('perks'),line:343,source:'if is_pack then pack = "quickly " end'}],
    evaluationPolicy:'Keep original pack assignments and being:reload. Select one complete player template from the existing local pack; evaluate only that template\'s weapon parameter once. Observer subject and weapon are each evaluated once in their original argument order.',
  }),
];

/** Optional debug configuration is deliberately outside the shipped core/DRL overlay. */
export const unshippedDynamicMessages = [
  call('bin/godmode.lua',54,'ui.msg',['"Visibility! "..player.x.."x"..player.y'],[
    visible('message.debug.godmode.visibility-position','Visibility! {{x}}x{{y}}','視界！ {{x}}x{{y}}',[binding('x','integer','player.x'),binding('y','integer','player.y')]),
  ],{unshipped:true,scope:'original optional godmode configuration; metadata does not enable developer commands'}),
];

const producer = (file,line,id,english,japanese,producerKind,extra={}) => ({
  file:drl(file),line,id,english,japanese,producerKind,...extra,
});

/** Exact finite literal producers. Dictionary/registry English values should remain
 * original domain data; bind IDs beside them or project at the listed dispatch.
 * A presentation-only local assignment may call ui.text at its exact guarded site.
 */
export const producerMessages = [
  producer('levels/mterebus',172,'message.level.mt-erebus.cliffs-collapsed','The molten cliffs give way leaving you tremendously exposed.','溶けた崖が崩れ落ち、身を隠すものがほとんどなくなる。','local-message-assignment',{variable:'msg',sourceGuard:'msg = "The molten cliffs give way leaving you tremendously exposed."'}),
  producer('levels/mterebus',179,'message.level.mt-erebus.earthquake','A violent earthquake shakes your being.','激しい地震に全身が揺さぶられる。','local-message-assignment',{variable:'msg',sourceGuard:'msg = "A violent earthquake shakes your being."'}),
  producer('levels/mterebus',187,'message.level.mt-erebus.ground-dissolved','The safety of the earth dissolves in front of you.','目の前で、安全だった大地が溶けていく。','local-message-assignment',{variable:'msg',sourceGuard:'msg = "The safety of the earth dissolves in front of you."'}),
  producer('generator',302,'message.generator.cave.agony-feeling','You hear echoing wails of agony!','苦悶の叫びが響いてくる！','selected-table-field',{field:'feeling',selector:'set',setIdentity:'agony'}),
  producer('generator',303,'message.generator.cave.lava-feeling','The cave temperature is insanely hot!','洞窟の中は、途方もなく暑い！','selected-table-field',{field:'feeling',selector:'set',setIdentity:'lava_elemental'}),
  producer('generator',326,'message.generator.cave.default-feeling','Twisted passages carry the smell of death...','曲がりくねった通路に、死の臭いが漂う……','fallback-literal',{sourceGuard:'ui.msg_feel( set.feeling or "Twisted passages carry the smell of death..." )'}),
  producer('generators',253,'message.generator.single.imp-intro','The walls are scratched and flame-scorched!','壁には引っかき傷が刻まれ、炎で焦げている！','local-presentation-table-field',{table:'intro',key:'imp',generatorId:'gen_single'}),
  producer('generators',254,'message.generator.single.mancubus-intro','You hear deep, guttural noises!','低く、喉の奥から絞り出すような声が聞こえる！','local-presentation-table-field',{table:'intro',key:'mancubus',generatorId:'gen_single'}),
  producer('generators',255,'message.generator.single.revenant-intro','Bones clatter all around you!','周囲の至るところで骨が鳴る！','local-presentation-table-field',{table:'intro',key:'revenant',generatorId:'gen_single'}),
  producer('generators',256,'message.generator.single.arch-vile-intro','You hear crackling flames!','炎が爆ぜる音が聞こえる！','local-presentation-table-field',{table:'intro',key:'arch',generatorId:'gen_single'}),
  producer('generators',312,'message.generator.single-plus.shambler-intro','The air is crackling with electricity!','空気に電気が走り、バチバチと音を立てている！','local-presentation-table-field',{table:'intro',key:'shambler',generatorId:'gen_single_plus'}),
  producer('generators',313,'message.generator.single-plus.bruiser-intro','You hear loud wails that cannot mean anything good!','大きな悲鳴が聞こえる。ろくなことではなさそうだ！','local-presentation-table-field',{table:'intro',key:'bruiser',generatorId:'gen_single_plus'}),
  producer('generators',314,'message.generator.single-plus.cyberdemon-intro','Suddenly you have a great urge to turn back! You scream in TERROR!','突然、引き返したい衝動に襲われる！　恐怖のあまり叫び声を上げる！','local-presentation-table-field',{table:'intro',key:'cyberdemon',generatorId:'gen_single_plus'}),
  producer('items/items',1335,'message.room.lever.water-warning','The air is really humid here...','ここは空気がひどく湿っている……','registry-presentation-field',{category:'item',registryId:'lever_flood_water',scope:'base_game',field:'warning'}),
  producer('items/items',1366,'message.room.lever.acid-warning','In the State of Denmark there was the odor of decay...','デンマークの国には、腐敗の臭いが漂っていた……','registry-presentation-field',{category:'item',registryId:'lever_flood_acid',scope:'base_game',field:'warning'}),
  producer('items/items',1402,'message.room.lever.lava-warning','You feel that smell? That gasoline smell? Oh hell...','この臭いがわかるか？　ガソリンの臭いだ。ああ、くそ……','registry-presentation-field',{category:'item',registryId:'lever_flood_lava',scope:'base_game',field:'warning'}),
  producer('items/items',1437,'message.room.lever.kill-warning','The smell of a massacre...','虐殺の臭いがする……','registry-presentation-field',{category:'item',registryId:'lever_kill',scope:'base_game',field:'warning'}),
  producer('items/items',1506,'message.room.lever.walls-warning','You hear the trumpets of Jericho echoing in the distance...','遠くから、エリコのラッパが響いてくる……','registry-presentation-field',{category:'item',registryId:'lever_walls',scope:'base_game',field:'warning'}),
  producer('rooms',220,'message.room.vault.excited-feeling','You feel excited!','胸が高鳴る！','random-choice-literal',{choiceIndex:0}),
  producer('rooms',221,'message.room.vault.blood-feeling',"There's the smell of blood in the air!",'血の臭いが漂っている！','random-choice-literal',{choiceIndex:1}),
  producer('rooms',222,'message.room.vault.special-feeling',"There's something special here...",'ここには何か特別なものがある……','random-choice-literal',{choiceIndex:2}),
];
const producerIds = (file,lines) => producerMessages.filter(p=>p.file===drl(file)&&lines.includes(p.line)).map(p=>p.id);

/** Dispatch adapters are explicit proposals, not evaluated code. Original selected
 * values/indices and RNG call counts stay intact. Unknown/custom values fall back to
 * their original English; finite lookup must not consume RNG or call gameplay hooks.
 */
export const finiteDispatchMessages = [
  {
    file:drl('levels/mterebus'),line:193,callee:'ui.msg',originalArguments:['msg'],
    producerIds:producerIds('levels/mterebus',[172,179,187]),
    policy:'Wrap only the three guarded local msg assignment literals with their semantic IDs; retain msg variable, status comparisons, all transmute operations and ui.msg(msg). No new random choice or branch.',
  },
  {
    file:drl('generator'),line:326,callee:'ui.msg_feel',originalArguments:['set.feeling or "Twisted passages carry the smell of death..."'],
    producerIds:producerIds('generator',[302,303,326]),
    policy:'Keep weight-table roll and selected set unchanged. Project set.feeling at this dispatch using the selected table/field identity plus English guard, or use the default ID when absent. Retain original English feeling fields.',
  },
  {
    file:drl('generators'),line:286,callee:'ui.msg_feel',originalArguments:['intro[monster]'],
    producerIds:producerIds('generators',[253,254,255,256]),
    selectorExpression:'monster',scope:'gen_single',
    policy:'Resolve the local presentation intro key from the already selected monster. Preserve if intro[monster], monster roll, all arch/knight/former branches and flood calls; retain original intro strings beside semantic IDs.',
  },
  {
    file:drl('generators'),line:318,callee:'ui.msg_feel',originalArguments:['intro[monster]'],
    producerIds:producerIds('generators',[312,313,314]),
    selectorExpression:'monster',scope:'gen_single_plus',
    policy:'Resolve the local presentation intro key from the already selected monster. Do not rerun table.random_pick or flood_monster; retain original intro strings beside semantic IDs.',
  },
  {
    file:drl('rooms'),line:36,callee:'ui.msg_feel',originalArguments:['proto.warning'],
    producerIds:producerIds('items/items',[1335,1366,1402,1437,1506]),
    presentationExpression:"ui.registry_text('item',lid,'base_game','warning',proto.warning)",
    policy:'Add reviewed warning metadata keyed by item registry ID; keep prototype warning strings and the existing lid roll, fullchance test and proto.warning truth test unchanged.',
  },
  {
    file:drl('rooms'),line:219,callee:'ui.msg_feel',originalArguments:[
      'table.random_pick{\n\t\t\t\t"You feel excited!",\n\t\t\t\t"There\'s the smell of blood in the air!",\n\t\t\t\t"There\'s something special here..."\n\t\t\t}',
    ],
    producerIds:producerIds('rooms',[220,221,222]),
    policy:'Select one semantic ID through exactly the original single table.random_pick with the same three entries and ordering, then resolve that selected ID. Never independently randomize a Japanese list; do not translate by global English-string matching.',
  },
];

/** One call needs a plural-aware prototype projection seam. Its full translations
 * and exact producers are proposed, but integration is deliberately unresolved. */
export const pendingDynamicMessages = [{
  file:drl('ai'),line:233,callee:'self:msg',originalArguments:['""','"The "..self.name.." spawns "..spawnname.."!"'],
  reason:'spawnname already contains an English indefinite article for one spawned being, or the blueprint name_plural for multiple. Passing it through registry name lookup would lose the article, while rereading/rebuilding the producer can evaluate fields twice. A typed prototype-name/count projection must capture the existing original singular/plural field once at its producer and produce a whole-message variant, with a guard for custom explicit plural names.',
  sourceProducers:[
    {file:drl('ai'),line:229,source:'local spawnname = "a "..beings[whom].name'},
    {file:drl('ai'),line:231,source:'spawnname = beings[whom].name_plural'},
  ],
  preservedArguments:{0:'""'},
  selection:{originalExpression:'num > 1',cases:['plural','singular'],usesAlreadySelectedRegistryId:'whom'},
  proposedMessages:[
    message(1,'observer','message.ai.spawner.offspring-singular','The {{subject}} spawns a {{offspring}}!','{{subject}}が{{offspring}}を生み出す！',[
      registryName('self'),binding('offspring','string','beings[whom].name',null),
    ],{variant:'singular',originalBindingCaptureRequiredAtProducer:true}),
    message(1,'observer','message.ai.spawner.offspring-plural','The {{subject}} spawns {{offspring}}!','{{subject}}が{{offspring}}を生み出す！',[
      registryName('self'),binding('offspring','string','beings[whom].name_plural',null),
    ],{variant:'plural',originalBindingCaptureRequiredAtProducer:true}),
  ],
  rngPolicy:'Keep list selection, num, whom, spawnchance roll and every self:spawn(whom) call exactly original; presentation must never rerun them.',
}];

const canonicalExpression = expression => {
  const scan = scanSource(expression,'lua');
  if (scan.diagnostics.length) throw Error('Expression lexical diagnostics');
  return JSON.stringify(scan.tokens.map(t=>t.kind==='string'?['string',t.value]:[t.kind,t.raw]));
};
const placeholders = template => [...template.matchAll(/\{\{([a-z][a-zA-Z0-9]*)\}\}/g)].map(m=>m[1]).sort();
const markup = s => JSON.stringify(s.replace(/\{\{[a-z][a-zA-Z0-9]*\}\}/g,'').match(/\{(?:\$[^}]*\}|\^\d+|[A-Za-z!])|\}/g)??[]);

/** Evaluate only lexical concatenation structure with synthetic captured values.
 * This is a test oracle: no original expression, Lua function or game code executes. */
function reconstructSyntheticOriginal(argument,message) {
  const values = Object.fromEntries(message.bindings.map(b=>[b.name,b.type==='integer'?17:`<${b.name}>{R{{verbatim}}}`]));
  if (argument.source.startsWith('string.gsub(')) {
    // The reviewed Century outro's exact @1 gsub producer is independently guarded.
    return {values,english:argument.strings[0].value.replace('@1',String(values.levels))};
  }
  const expressionValues = new Map(message.bindings.map(b=>[canonicalExpression(b.originalExpression),values[b.name]]));
  if (message.variant) expressionValues.set(canonicalExpression('pack'),message.variant==='quick'?'quickly ':'');
  const source = argument.source, tokens = scanSource(source,'lua').tokens;
  const chunks = []; let depth=0,brackets=0,first=0;
  for (let i=0;i<tokens.length;i++) {
    const token = tokens[i];
    if (token.raw==='(')depth++;if(token.raw===')')depth--;
    if (token.raw==='[')brackets++;if(token.raw===']')brackets--;
    if (token.raw==='..'&&depth===0&&brackets===0) {chunks.push(tokens.slice(first,i));first=i+1;}
  }
  chunks.push(tokens.slice(first));
  const english = chunks.map(chunk=>{
    if (chunk.length===1&&chunk[0].kind==='string') return chunk[0].value;
    const expression = source.slice(chunk[0].start,chunk.at(-1).end);
    const key = canonicalExpression(expression);
    if (!expressionValues.has(key)) throw Error(`Unaccounted original English fragment: ${message.id}/${expression}`);
    return String(expressionValues.get(key));
  }).join('');
  return {values,english};
}

/** Independent, read-only checks against the original files and lexical inventory. */
export function verifyDynamicMessages(sourceRoot=path.resolve(here,'../upstream/drl')) {
  const inventory = JSON.parse(readFileSync(path.join(here,'message-inventory.json'),'utf8'));
  if (inventory.sourceCommit!==sourceCommit) throw Error('Source commit lock mismatch');
  const coveredCalls = [...dynamicMessageCalls,...finiteDispatchMessages,...pendingDynamicMessages,...unshippedDynamicMessages];
  const recordsByFile = new Map();
  for (const record of [...coveredCalls,...producerMessages]) {
    if (!recordsByFile.has(record.file)) recordsByFile.set(record.file,[]);
    recordsByFile.get(record.file).push(record);
  }
  const sources = new Map(), sourceFiles = {}, allCalls = [];
  for (const file of recordsByFile.keys()) {
    const bytes = readFileSync(path.join(sourceRoot,file));
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    if (inventory.sourceFiles[file]?.sha256!==sha256) throw Error(`Source hash mismatch: ${file}`);
    const source = bytes.toString('utf8');
    sources.set(file,{source,lines:source.split(/\r?\n/),scan:scanSource(source,'lua')});
    if (sources.get(file).scan.diagnostics.length) throw Error(`Source lexical diagnostics: ${file}`);
    allCalls.push(...scanMessageCalls(source,'lua',file));
    sourceFiles[file]={sha256,bytes:bytes.length};
  }
  const seenCalls = new Set();
  for (const record of coveredCalls) {
    const key = `${record.file}:${record.line}`;
    if (seenCalls.has(key)) throw Error(`Duplicate reviewed call: ${key}`);
    seenCalls.add(key);
    const candidates = allCalls.filter(c=>c.file===record.file&&c.line===record.line&&c.callee===record.callee);
    if (candidates.length!==1) throw Error(`Callsite guard mismatch: ${key}`);
    const actual = candidates[0];
    if (actual.arguments.length!==record.originalArguments.length || actual.arguments.some((a,i)=>canonicalExpression(a.source)!==canonicalExpression(record.originalArguments[i]))) throw Error(`Original expression guard mismatch: ${key}`);
    for (const [index,expected] of Object.entries(record.preservedArguments??{})) {
      if (canonicalExpression(actual.arguments[Number(index)].source)!==canonicalExpression(expected)) throw Error(`Preserved argument mismatch: ${key}`);
    }
    for (const guard of [...(record.producerGuards??[]),...(record.sourceProducers??[])]) {
      if (!sources.get(guard.file)?.lines[guard.line-1]?.trim().includes(guard.source)) throw Error(`Producer branch guard mismatch: ${guard.file}:${guard.line}`);
    }
  }
  const expectedCalls = inventory.calls.filter(c=>c.language==='lua'&&c.file.startsWith('bin/data/drl/')&&!c.file.includes('/levels/')&&c.classification!=='static_literal');
  if (expectedCalls.length!==31 || expectedCalls.some(c=>!seenCalls.has(`${c.file}:${c.line}`))) throw Error('Non-level dynamic call coverage mismatch');
  const seenIds = new Set();
  const verifyMessage = (m,pending=false) => {
    if (seenIds.has(m.id)) throw Error(`Duplicate semantic ID: ${m.id}`);
    seenIds.add(m.id);
    if (!/^message\.[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/.test(m.id)) throw Error(`Invalid semantic ID: ${m.id}`);
    if (!m.english || !m.japanese || !/[\u3040-\u30ff\u3400-\u9fff]/u.test(m.japanese)) throw Error(`Missing reviewed text: ${m.id}`);
    if (JSON.stringify(placeholders(m.english))!==JSON.stringify(placeholders(m.japanese))) throw Error(`Placeholder mismatch: ${m.id}`);
    if (markup(m.english)!==markup(m.japanese)) throw Error(`VTIG markup mismatch: ${m.id}`);
    if (m.english.split('\n').length!==m.japanese.split('\n').length) throw Error(`Paragraph topology mismatch: ${m.id}`);
    const names = [...new Set(placeholders(m.english))].sort();
    if (JSON.stringify(names)!==JSON.stringify((m.bindings??[]).map(b=>b.name).sort())) throw Error(`Typed binding contract mismatch: ${m.id}`);
    for (const b of m.bindings??[]) {
      if (!['string','integer'].includes(b.type)||!b.originalExpression||b.evaluation!=='once'||(!pending&&!b.presentationExpression)) throw Error(`Invalid binding: ${m.id}/${b.name}`);
      if (/\b(?:math\.random|table\.random_pick|spawn|phase|relocate|action_fire)\s*\(/.test(b.presentationExpression??'')) throw Error(`Gameplay/RNG expression in presentation binding: ${m.id}`);
    }
  };
  for (const c of [...dynamicMessageCalls,...unshippedDynamicMessages]) {
    const actual = allCalls.find(a=>a.file===c.file&&a.line===c.line&&a.callee===c.callee);
    for (const m of c.messages) {
      verifyMessage(m);
      if (m.argumentIndex<0||m.argumentIndex>=c.originalArguments.length) throw Error(`Invalid argument role: ${m.id}`);
      const original = reconstructSyntheticOriginal(actual.arguments[m.argumentIndex],m);
      const contract = Object.fromEntries(m.bindings.map(b=>[b.name,b.type]));
      const projectedEnglish = render({[m.id]:m.english},{[m.id]:contract},m.id,original.values);
      if (projectedEnglish!==original.english) throw Error(`Complete original English reconstruction mismatch: ${m.id}`);
      // Japanese must accept the same typed values, including verbatim brace text.
      render({[m.id]:m.japanese},{[m.id]:contract},m.id,original.values);
    }
    for (const name of c.identityNames??[]) {
      if (!c.messages.every(m=>m.english.includes(name)&&m.japanese.includes(name))) throw Error(`External identity mismatch: ${name}`);
    }
    for (const url of c.identityUrls??[]) {
      if (!c.messages.every(m=>m.english.includes(url)&&m.japanese.includes(url))) throw Error(`URL identity mismatch: ${url}`);
    }
  }
  const producerSites = [];
  for (const p of producerMessages) {
    verifyMessage(p);
    const matches = sources.get(p.file).scan.tokens.filter(t=>t.kind==='string'&&t.line===p.line&&t.value===p.english);
    if (matches.length!==1) throw Error(`Literal producer guard mismatch: ${p.file}:${p.line}`);
    if (p.sourceGuard&&!sources.get(p.file).lines[p.line-1].trim().includes(p.sourceGuard)) throw Error(`Producer source guard mismatch: ${p.file}:${p.line}`);
    producerSites.push({id:p.id,file:p.file,line:p.line,start:matches[0].start,end:matches[0].end,raw:matches[0].raw});
  }
  for (const c of finiteDispatchMessages) {
    if (!c.policy||!c.producerIds.length||c.producerIds.some(id=>!producerMessages.some(p=>p.id===id))) throw Error(`Finite dispatch producer links invalid: ${c.file}:${c.line}`);
  }
  for (const p of pendingDynamicMessages) {
    if (!p.reason) throw Error('Pending source reason missing');
    p.proposedMessages.forEach(m=>verifyMessage(m,true));
  }
  return {
    sourceCommit,nonLevelDynamicCalls:expectedCalls.length,reviewedDynamicCalls:dynamicMessageCalls.length,unshippedDynamicCalls:unshippedDynamicMessages.length,
    finiteDispatchCalls:finiteDispatchMessages.length,reviewedProducerLiterals:producerMessages.length,
    reviewedTemplates:dynamicMessageCalls.reduce((n,c)=>n+c.messages.length,0)+producerMessages.length,
    pendingCalls:pendingDynamicMessages.length,pendingProposedTemplates:pendingDynamicMessages.reduce((n,c)=>n+c.proposedMessages.length,0),
    sourceFiles,producerSites,originalGameplayExecuted:false,runtimeAdapterConnected:false,
  };
}

if (process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const result = verifyDynamicMessages();
  console.log(JSON.stringify({...result,producerSites:undefined},null,2));
}
