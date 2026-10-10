{ Generated source-guarded original DRL history catalog, GPL-2.0. }
unit drlsemantichistorycatalog;
{$mode objfpc}{$H+}{$B-}
interface
uses drlsemantictext,drlsemantichistory;
function DRLValidateHistoryRequest(const aID,aEnglish:AnsiString;const aParams:array of TDRLTextParam):Boolean;
function DRLProjectHistoryParams(const aID:AnsiString;const aOriginalParams:array of TDRLTextParam;out aPresentationParams:TDRLHistoryParams):Boolean;
implementation
uses drlsemanticregistry;
type THistoryRow=record ID,English:AnsiString;FirstParam,ParamCount:Integer;end;
const CHistoryRows:array[0..524]of THistoryRow=(
 (ID:'history.event.frozen';English:'On level {{depth}}, hell froze over!';FirstParam:0;ParamCount:1),
 (ID:'history.event.hard-nut';English:'Level {{depth}} was a hard nut to crack!';FirstParam:1;ParamCount:1),
 (ID:'history.event.alarm';English:'He sounded the alarm on level {{depth}}!';FirstParam:2;ParamCount:1),
 (ID:'history.event.unholy';English:'Level {{depth}} blasted him with an unholy atmosphere!';FirstParam:3;ParamCount:1),
 (ID:'history.event.armed-nuke';English:'On level {{depth}} he encountered an armed nuke!';FirstParam:4;ParamCount:1),
 (ID:'history.event.acid';English:'On level {{depth}} he ran for his life from acid!';FirstParam:5;ParamCount:1),
 (ID:'history.event.lava';English:'On level {{depth}} he ran for his life from lava!';FirstParam:6;ParamCount:1),
 (ID:'history.event.blood';English:'On level {{depth}} he ran for his life from blood!';FirstParam:7;ParamCount:1),
 (ID:'history.event.extermination';English:'On level {{depth}} he was targeted for extermination!';FirstParam:8;ParamCount:1),
 (ID:'history.event.bombarded';English:'On level {{depth}} he was bombarded!';FirstParam:9;ParamCount:1),
 (ID:'history.event.fire';English:'On level {{depth}} he was walking in fire!';FirstParam:10;ParamCount:1),
 (ID:'history.event.dark';English:'On level {{depth}} he was stumbling in the dark!';FirstParam:11;ParamCount:1),
 (ID:'history.item.nuked';English:'He nuked level {{depth}}!';FirstParam:12;ParamCount:1),
 (ID:'history.item.flooded-acid';English:'He flooded the entire level {{depth}} with acid!';FirstParam:13;ParamCount:1),
 (ID:'history.item.flooded-lava';English:'He flooded the entire level {{depth}} with lava!';FirstParam:14;ParamCount:1),
 (ID:'history.item.angel-arm';English:'He activated the Angel Arm on level {{depth}}!';FirstParam:15;ParamCount:1),
 (ID:'history.abyssal.slaughtered';English:'He slaughtered the beasts living there.';FirstParam:16;ParamCount:0),
 (ID:'history.abyssal.escaped';English:'He barely escaped the trap set for him.';FirstParam:16;ParamCount:0),
 (ID:'history.arena.present';English:'He saw, left a present and left.';FirstParam:16;ParamCount:0),
 (ID:'history.arena.fled';English:'He cowardly fled the Arena.';FirstParam:16;ParamCount:0),
 (ID:'history.arena.left';English:'He left the Arena before it got too hot.';FirstParam:16;ParamCount:0),
 (ID:'history.arena.lost';English:'He fought desperately in the Arena but didn''t have what it takes.';FirstParam:16;ParamCount:0),
 (ID:'history.arena.champion';English:'He left the Arena as a champion!';FirstParam:16;ParamCount:0),
 (ID:'history.armory.nuked';English:'He decided to nuke Hell''s production center.';FirstParam:16;ParamCount:0),
 (ID:'history.armory.quiet';English:'He left the Armory without drawing too much attention.';FirstParam:16;ParamCount:0),
 (ID:'history.armory.nightmare';English:'He fled being chased by a nightmare!';FirstParam:16;ParamCount:0),
 (ID:'history.level.rewarded';English:'He destroyed the evil within and reaped the rewards!';FirstParam:16;ParamCount:0),
 (ID:'history.boss.anomaly';English:'He arrived at the Phobos Anomaly.';FirstParam:16;ParamCount:0),
 (ID:'history.boss.babel';English:'He found the Tower of Babel.';FirstParam:16;ParamCount:0),
 (ID:'history.boss.dis';English:'Then at last he found Dis!';FirstParam:16;ParamCount:0),
 (ID:'history.boss.true-evil';English:'He defeated the Mastermind and found the TRUE EVIL!';FirstParam:16;ParamCount:0),
 (ID:'history.level.unstoppable';English:'Nothing stood in his way.';FirstParam:16;ParamCount:0),
 (ID:'history.level.unfinished';English:'He couldn''t quite finish the job.';FirstParam:16;ParamCount:0),
 (ID:'history.chained.arena-master';English:'He defeated the Hell Arena Master!';FirstParam:16;ParamCount:0),
 (ID:'history.level.uncertain';English:'Not knowing what to do, he left.';FirstParam:16;ParamCount:0),
 (ID:'history.containment.gave-up';English:'He broke into the Containment Area, but gave up against the overwhelming forces.';FirstParam:16;ParamCount:0),
 (ID:'history.containment.victorious';English:'He emerged from the Containment Area victorious!';FirstParam:16;ParamCount:0),
 (ID:'history.deimoslab.nuked';English:'He decided to nuke the forbidden Lab.';FirstParam:16;ParamCount:0),
 (ID:'history.deimoslab.quiet';English:'He left the Deimos Lab without drawing too much attention.';FirstParam:16;ParamCount:0),
 (ID:'history.deimoslab.reward';English:'He fought hard, but decided the reward was not worth it.';FirstParam:16;ParamCount:0),
 (ID:'history.deimoslab.nightmare';English:'He fled the lab after unleashing a nightmare!';FirstParam:16;ParamCount:0),
 (ID:'history.cathedral.fled';English:'He fled the Unholy Cathedral seeing no chance to win.';FirstParam:16;ParamCount:0),
 (ID:'history.cathedral.destroyed';English:'He then destroyed the Unholy Cathedral!';FirstParam:16;ParamCount:0),
 (ID:'history.house.quiet';English:'He left the House without drawing too much attention.';FirstParam:16;ParamCount:0),
 (ID:'history.house.fire';English:'He fled the House on fire!';FirstParam:16;ParamCount:0),
 (ID:'history.house.conquered';English:'He conquered the House!';FirstParam:16;ParamCount:0),
 (ID:'history.intro.journey';English:'He started his journey on the surface of Phobos.';FirstParam:16;ParamCount:0),
 (ID:'history.lava.too-hot';English:'He decided it was too hot there.';FirstParam:16;ParamCount:0),
 (ID:'history.lava.elemental';English:'He fled there from the monstrous lava elemental.';FirstParam:16;ParamCount:0),
 (ID:'history.lava.cleared';English:'He managed to clear the Lava Pits completely!';FirstParam:16;ParamCount:0),
 (ID:'history.limbo.cleared';English:'He managed to clear Limbo from evil!';FirstParam:16;ParamCount:0),
 (ID:'history.limbo.escaped';English:'He managed to escape from Limbo!';FirstParam:16;ParamCount:0),
 (ID:'history.military.quiet';English:'He left without a fuss.';FirstParam:16;ParamCount:0),
 (ID:'history.military.purified';English:'He purified his fellow comrades.';FirstParam:16;ParamCount:0),
 (ID:'history.mortuary.cleared';English:'He managed to clear the Mortuary from evil!';FirstParam:16;ParamCount:0),
 (ID:'history.mortuary.escaped';English:'He managed to escape from the Mortuary!';FirstParam:16;ParamCount:0),
 (ID:'history.erebus.dangerous';English:'He decided it was too dangerous.';FirstParam:16;ParamCount:0),
 (ID:'history.erebus.raised';English:'He managed to raise Mt. Erebus completely!';FirstParam:16;ParamCount:0),
 (ID:'history.phoboslab.through';English:'He broke through the lab.';FirstParam:16;ParamCount:0),
 (ID:'history.skulls.cleared';English:'He wiped out the City of Skulls.';FirstParam:16;ParamCount:0),
 (ID:'history.skulls.fled';English:'He fled the City in terror!';FirstParam:16;ParamCount:0),
 (ID:'history.spider.fled';English:'He fled the Lair, knowing how to fear Arachnotrons!';FirstParam:16;ParamCount:0),
 (ID:'history.spider.cleared';English:'He cleared the Lair, kickin'' serious spider ass!';FirstParam:16;ParamCount:0),
 (ID:'history.toxin.antidote';English:'He was the antidote.';FirstParam:16;ParamCount:0),
 (ID:'history.vaults.left';English:'He came, he saw, but he left.';FirstParam:16;ParamCount:0),
 (ID:'history.vaults.partial';English:'He managed to scavenge a part of the Vaults'' treasures.';FirstParam:16;ParamCount:0),
 (ID:'history.vaults.cleared';English:'He managed to clear the Vaults completely!';FirstParam:16;ParamCount:0),
 (ID:'history.vaults.cracked';English:'He cracked the Vaults and cleared them out!';FirstParam:16;ParamCount:0),
 (ID:'history.wall.gave-up';English:'He broke into the Wall, but gave up against the overwhelming forces.';FirstParam:16;ParamCount:0),
 (ID:'history.wall.cleared';English:'He massacred the evil behind the Wall!';FirstParam:16;ParamCount:0),
 (ID:'history.assembled.chainsword';English:'On level {{depth}} he assembled a {{assembly}}!';FirstParam:16;ParamCount:2),
 (ID:'history.assembled.pblade';English:'On level {{depth}} he assembled a {{assembly}}!';FirstParam:18;ParamCount:2),
 (ID:'history.assembled.speedloader';English:'On level {{depth}} he assembled a {{assembly}}!';FirstParam:20;ParamCount:2),
 (ID:'history.assembled.elephant';English:'On level {{depth}} he assembled a {{assembly}}!';FirstParam:22;ParamCount:2),
 (ID:'history.assembled.gatling';English:'On level {{depth}} he assembled a {{assembly}}!';FirstParam:24;ParamCount:2),
 (ID:'history.assembled.micro';English:'On level {{depth}} he assembled a {{assembly}}!';FirstParam:26;ParamCount:2),
 (ID:'history.assembled.tarmor';English:'On level {{depth}} he assembled a {{assembly}}!';FirstParam:28;ParamCount:2),
 (ID:'history.assembled.tboots';English:'On level {{depth}} he assembled a {{assembly}}!';FirstParam:30;ParamCount:2),
 (ID:'history.assembled.nanofiber';English:'On level {{depth}} he assembled a {{assembly}}!';FirstParam:32;ParamCount:2),
 (ID:'history.assembled.high';English:'On level {{depth}} he assembled a {{assembly}}!';FirstParam:34;ParamCount:2),
 (ID:'history.assembled.power';English:'On level {{depth}} he assembled a {{assembly}}!';FirstParam:36;ParamCount:2),
 (ID:'history.assembled.tshotgun';English:'On level {{depth}} he assembled a {{assembly}}!';FirstParam:38;ParamCount:2),
 (ID:'history.assembled.plate';English:'On level {{depth}} he assembled a {{assembly}}!';FirstParam:40;ParamCount:2),
 (ID:'history.assembled.fparmor';English:'On level {{depth}} he assembled a {{assembly}}!';FirstParam:42;ParamCount:2),
 (ID:'history.assembled.fpboots';English:'On level {{depth}} he assembled a {{assembly}}!';FirstParam:44;ParamCount:2),
 (ID:'history.assembled.balarmor';English:'On level {{depth}} he assembled a {{assembly}}!';FirstParam:46;ParamCount:2),
 (ID:'history.assembled.plasmatic';English:'On level {{depth}} he assembled a {{assembly}}!';FirstParam:48;ParamCount:2),
 (ID:'history.assembled.gboots';English:'On level {{depth}} he assembled a {{assembly}}!';FirstParam:50;ParamCount:2),
 (ID:'history.assembled.grarmor';English:'On level {{depth}} he assembled a {{assembly}}!';FirstParam:52;ParamCount:2),
 (ID:'history.assembled.lavboots';English:'On level {{depth}} he assembled a {{assembly}}!';FirstParam:54;ParamCount:2),
 (ID:'history.assembled.double';English:'On level {{depth}} he assembled a {{assembly}}!';FirstParam:56;ParamCount:2),
 (ID:'history.assembled.tacticalrl';English:'On level {{depth}} he assembled a {{assembly}}!';FirstParam:58;ParamCount:2),
 (ID:'history.assembled.storm';English:'On level {{depth}} he assembled a {{assembly}}!';FirstParam:60;ParamCount:2),
 (ID:'history.assembled.rifle';English:'On level {{depth}} he assembled a {{assembly}}!';FirstParam:62;ParamCount:2),
 (ID:'history.assembled.energy';English:'On level {{depth}} he assembled a {{assembly}}!';FirstParam:64;ParamCount:2),
 (ID:'history.assembled.assault';English:'On level {{depth}} he assembled a {{assembly}}!';FirstParam:66;ParamCount:2),
 (ID:'history.assembled.vbfg9000';English:'On level {{depth}} he assembled a {{assembly}}!';FirstParam:68;ParamCount:2),
 (ID:'history.assembled.envboots';English:'On level {{depth}} he assembled a {{assembly}}!';FirstParam:70;ParamCount:2),
 (ID:'history.assembled.fireshield';English:'On level {{depth}} he assembled a {{assembly}}!';FirstParam:72;ParamCount:2),
 (ID:'history.assembled.nanoskin';English:'On level {{depth}} he assembled a {{assembly}}!';FirstParam:74;ParamCount:2),
 (ID:'history.assembled.gravity';English:'On level {{depth}} he assembled a {{assembly}}!';FirstParam:76;ParamCount:2),
 (ID:'history.assembled.hyperblaster';English:'On level {{depth}} he assembled a {{assembly}}!';FirstParam:78;ParamCount:2),
 (ID:'history.assembled.fdshotgun';English:'On level {{depth}} he assembled a {{assembly}}!';FirstParam:80;ParamCount:2),
 (ID:'history.assembled.nanomanufacture';English:'On level {{depth}} he assembled a {{assembly}}!';FirstParam:82;ParamCount:2),
 (ID:'history.assembled.nsharpnel';English:'On level {{depth}} he assembled a {{assembly}}!';FirstParam:84;ParamCount:2),
 (ID:'history.assembled.demolition';English:'On level {{depth}} he assembled a {{assembly}}!';FirstParam:86;ParamCount:2),
 (ID:'history.assembled.cybernano';English:'On level {{depth}} he assembled a {{assembly}}!';FirstParam:88;ParamCount:2),
 (ID:'history.assembled.biggest';English:'On level {{depth}} he assembled a {{assembly}}!';FirstParam:90;ParamCount:2),
 (ID:'history.assembled.ripper';English:'On level {{depth}} he assembled a {{assembly}}!';FirstParam:92;ParamCount:2),
 (ID:'history.assembled.cerboots';English:'On level {{depth}} he assembled a {{assembly}}!';FirstParam:94;ParamCount:2),
 (ID:'history.assembled.cerarmor';English:'On level {{depth}} he assembled a {{assembly}}!';FirstParam:96;ParamCount:2),
 (ID:'history.assembled.mother';English:'On level {{depth}} he assembled a {{assembly}}!';FirstParam:98;ParamCount:2),
 (ID:'history.monster-complex.former';English:'On level {{depth}} he stumbled into a complex full of {{beings}}!';FirstParam:100;ParamCount:2),
 (ID:'history.monster-complex.sergeant';English:'On level {{depth}} he stumbled into a complex full of {{beings}}!';FirstParam:102;ParamCount:2),
 (ID:'history.monster-complex.captain';English:'On level {{depth}} he stumbled into a complex full of {{beings}}!';FirstParam:104;ParamCount:2),
 (ID:'history.monster-complex.commando';English:'On level {{depth}} he stumbled into a complex full of {{beings}}!';FirstParam:106;ParamCount:2),
 (ID:'history.monster-complex.imp';English:'On level {{depth}} he stumbled into a complex full of {{beings}}!';FirstParam:108;ParamCount:2),
 (ID:'history.monster-complex.demon';English:'On level {{depth}} he stumbled into a complex full of {{beings}}!';FirstParam:110;ParamCount:2),
 (ID:'history.monster-complex.lostsoul';English:'On level {{depth}} he stumbled into a complex full of {{beings}}!';FirstParam:112;ParamCount:2),
 (ID:'history.monster-complex.cacodemon';English:'On level {{depth}} he stumbled into a complex full of {{beings}}!';FirstParam:114;ParamCount:2),
 (ID:'history.monster-complex.knight';English:'On level {{depth}} he stumbled into a complex full of {{beings}}!';FirstParam:116;ParamCount:2),
 (ID:'history.monster-complex.baron';English:'On level {{depth}} he stumbled into a complex full of {{beings}}!';FirstParam:118;ParamCount:2),
 (ID:'history.monster-complex.arachno';English:'On level {{depth}} he stumbled into a complex full of {{beings}}!';FirstParam:120;ParamCount:2),
 (ID:'history.monster-complex.pain';English:'On level {{depth}} he stumbled into a complex full of {{beings}}!';FirstParam:122;ParamCount:2),
 (ID:'history.monster-complex.revenant';English:'On level {{depth}} he stumbled into a complex full of {{beings}}!';FirstParam:124;ParamCount:2),
 (ID:'history.monster-complex.mancubus';English:'On level {{depth}} he stumbled into a complex full of {{beings}}!';FirstParam:126;ParamCount:2),
 (ID:'history.monster-complex.arch';English:'On level {{depth}} he stumbled into a complex full of {{beings}}!';FirstParam:128;ParamCount:2),
 (ID:'history.monster-complex.eformer';English:'On level {{depth}} he stumbled into a complex full of {{beings}}!';FirstParam:130;ParamCount:2),
 (ID:'history.monster-complex.esergeant';English:'On level {{depth}} he stumbled into a complex full of {{beings}}!';FirstParam:132;ParamCount:2),
 (ID:'history.monster-complex.ecaptain';English:'On level {{depth}} he stumbled into a complex full of {{beings}}!';FirstParam:134;ParamCount:2),
 (ID:'history.monster-complex.ecommando';English:'On level {{depth}} he stumbled into a complex full of {{beings}}!';FirstParam:136;ParamCount:2),
 (ID:'history.monster-complex.nimp';English:'On level {{depth}} he stumbled into a complex full of {{beings}}!';FirstParam:138;ParamCount:2),
 (ID:'history.monster-complex.ndemon';English:'On level {{depth}} he stumbled into a complex full of {{beings}}!';FirstParam:140;ParamCount:2),
 (ID:'history.monster-complex.nlostsoul';English:'On level {{depth}} he stumbled into a complex full of {{beings}}!';FirstParam:142;ParamCount:2),
 (ID:'history.monster-complex.ncacodemon';English:'On level {{depth}} he stumbled into a complex full of {{beings}}!';FirstParam:144;ParamCount:2),
 (ID:'history.monster-complex.nknight';English:'On level {{depth}} he stumbled into a complex full of {{beings}}!';FirstParam:146;ParamCount:2),
 (ID:'history.monster-complex.narachno';English:'On level {{depth}} he stumbled into a complex full of {{beings}}!';FirstParam:148;ParamCount:2),
 (ID:'history.monster-complex.npain';English:'On level {{depth}} he stumbled into a complex full of {{beings}}!';FirstParam:150;ParamCount:2),
 (ID:'history.monster-complex.nrevenant';English:'On level {{depth}} he stumbled into a complex full of {{beings}}!';FirstParam:152;ParamCount:2),
 (ID:'history.monster-complex.nmancubus';English:'On level {{depth}} he stumbled into a complex full of {{beings}}!';FirstParam:154;ParamCount:2),
 (ID:'history.monster-complex.narch';English:'On level {{depth}} he stumbled into a complex full of {{beings}}!';FirstParam:156;ParamCount:2),
 (ID:'history.monster-complex.bruiser';English:'On level {{depth}} he stumbled into a complex full of {{beings}}!';FirstParam:158;ParamCount:2),
 (ID:'history.monster-complex.shambler';English:'On level {{depth}} he stumbled into a complex full of {{beings}}!';FirstParam:160;ParamCount:2),
 (ID:'history.monster-complex.lava-elemental';English:'On level {{depth}} he stumbled into a complex full of {{beings}}!';FirstParam:162;ParamCount:2),
 (ID:'history.monster-complex.agony';English:'On level {{depth}} he stumbled into a complex full of {{beings}}!';FirstParam:164;ParamCount:2),
 (ID:'history.monster-complex.angel';English:'On level {{depth}} he stumbled into a complex full of {{beings}}!';FirstParam:166;ParamCount:2),
 (ID:'history.monster-complex.cyberdemon';English:'On level {{depth}} he stumbled into a complex full of {{beings}}!';FirstParam:168;ParamCount:2),
 (ID:'history.monster-complex.mastermind';English:'On level {{depth}} he stumbled into a complex full of {{beings}}!';FirstParam:170;ParamCount:2),
 (ID:'history.monster-complex.jc';English:'On level {{depth}} he stumbled into a complex full of {{beings}}!';FirstParam:172;ParamCount:2),
 (ID:'history.monster-complex.apostle';English:'On level {{depth}} he stumbled into a complex full of {{beings}}!';FirstParam:174;ParamCount:2),
 (ID:'history.monster-complex.arenamaster';English:'On level {{depth}} he stumbled into a complex full of {{beings}}!';FirstParam:176;ParamCount:2),
 (ID:'history.monster-complex.soldier';English:'On level {{depth}} he stumbled into a complex full of {{beings}}!';FirstParam:178;ParamCount:2),
 (ID:'history.found-item.chainsaw';English:'On level {{depth}} he found the {{item}}!';FirstParam:180;ParamCount:2),
 (ID:'history.found-item.bfg9000';English:'On level {{depth}} he found the {{item}}!';FirstParam:182;ParamCount:2),
 (ID:'history.found-item.ublaster';English:'On level {{depth}} he found the {{item}}!';FirstParam:184;ParamCount:2),
 (ID:'history.found-item.ucpistol';English:'On level {{depth}} he found the {{item}}!';FirstParam:186;ParamCount:2),
 (ID:'history.found-item.uashotgun';English:'On level {{depth}} he found the {{item}}!';FirstParam:188;ParamCount:2),
 (ID:'history.found-item.upshotgun';English:'On level {{depth}} he found the {{item}}!';FirstParam:190;ParamCount:2),
 (ID:'history.found-item.udshotgun';English:'On level {{depth}} he found the {{item}}!';FirstParam:192;ParamCount:2),
 (ID:'history.found-item.ulaser';English:'On level {{depth}} he found the {{item}}!';FirstParam:194;ParamCount:2),
 (ID:'history.found-item.utristar';English:'On level {{depth}} he found the {{item}}!';FirstParam:196;ParamCount:2),
 (ID:'history.found-item.uminigun';English:'On level {{depth}} he found the {{item}}!';FirstParam:198;ParamCount:2),
 (ID:'history.found-item.umbazooka';English:'On level {{depth}} he found the {{item}}!';FirstParam:200;ParamCount:2),
 (ID:'history.found-item.unplasma';English:'On level {{depth}} he found the {{item}}!';FirstParam:202;ParamCount:2),
 (ID:'history.found-item.unbfg9000';English:'On level {{depth}} he found the {{item}}!';FirstParam:204;ParamCount:2),
 (ID:'history.found-item.utrans';English:'On level {{depth}} he found the {{item}}!';FirstParam:206;ParamCount:2),
 (ID:'history.found-item.unapalm';English:'On level {{depth}} he found the {{item}}!';FirstParam:208;ParamCount:2),
 (ID:'history.found-item.uoarmor';English:'On level {{depth}} he found the {{item}}!';FirstParam:210;ParamCount:2),
 (ID:'history.found-item.uparmor';English:'On level {{depth}} he found the {{item}}!';FirstParam:212;ParamCount:2),
 (ID:'history.found-item.upboots';English:'On level {{depth}} he found the {{item}}!';FirstParam:214;ParamCount:2),
 (ID:'history.found-item.ugarmor';English:'On level {{depth}} he found the {{item}}!';FirstParam:216;ParamCount:2),
 (ID:'history.found-item.ugboots';English:'On level {{depth}} he found the {{item}}!';FirstParam:218;ParamCount:2),
 (ID:'history.found-item.umedarmor';English:'On level {{depth}} he found the {{item}}!';FirstParam:220;ParamCount:2),
 (ID:'history.found-item.uduelarmor';English:'On level {{depth}} he found the {{item}}!';FirstParam:222;ParamCount:2),
 (ID:'history.found-item.ubulletarmor';English:'On level {{depth}} he found the {{item}}!';FirstParam:224;ParamCount:2),
 (ID:'history.found-item.uballisticarmor';English:'On level {{depth}} he found the {{item}}!';FirstParam:226;ParamCount:2),
 (ID:'history.found-item.ueshieldarmor';English:'On level {{depth}} he found the {{item}}!';FirstParam:228;ParamCount:2),
 (ID:'history.found-item.uplasmashield';English:'On level {{depth}} he found the {{item}}!';FirstParam:230;ParamCount:2),
 (ID:'history.found-item.uenergyshield';English:'On level {{depth}} he found the {{item}}!';FirstParam:232;ParamCount:2),
 (ID:'history.found-item.ubalshield';English:'On level {{depth}} he found the {{item}}!';FirstParam:234;ParamCount:2),
 (ID:'history.found-item.uacidboots';English:'On level {{depth}} he found the {{item}}!';FirstParam:236;ParamCount:2),
 (ID:'history.found-item.ubloodboots';English:'On level {{depth}} he found the {{item}}!';FirstParam:238;ParamCount:2),
 (ID:'history.found-item.umod-firestorm';English:'On level {{depth}} he found the {{item}}!';FirstParam:240;ParamCount:2),
 (ID:'history.found-item.umod-sniper';English:'On level {{depth}} he found the {{item}}!';FirstParam:242;ParamCount:2),
 (ID:'history.found-item.umod-nano';English:'On level {{depth}} he found the {{item}}!';FirstParam:244;ParamCount:2),
 (ID:'history.found-item.umod-onyx';English:'On level {{depth}} he found the {{item}}!';FirstParam:246;ParamCount:2),
 (ID:'history.found-item.uswpack';English:'On level {{depth}} he found the {{item}}!';FirstParam:248;ParamCount:2),
 (ID:'history.found-item.ubskull';English:'On level {{depth}} he found the {{item}}!';FirstParam:250;ParamCount:2),
 (ID:'history.found-item.ufskull';English:'On level {{depth}} he found the {{item}}!';FirstParam:252;ParamCount:2),
 (ID:'history.found-item.uhskull';English:'On level {{depth}} he found the {{item}}!';FirstParam:254;ParamCount:2),
 (ID:'history.found-item.knife';English:'On level {{depth}} he found the {{item}}!';FirstParam:256;ParamCount:2),
 (ID:'history.found-item.garmor';English:'On level {{depth}} he found the {{item}}!';FirstParam:258;ParamCount:2),
 (ID:'history.found-item.barmor';English:'On level {{depth}} he found the {{item}}!';FirstParam:260;ParamCount:2),
 (ID:'history.found-item.rarmor';English:'On level {{depth}} he found the {{item}}!';FirstParam:262;ParamCount:2),
 (ID:'history.found-item.sboots';English:'On level {{depth}} he found the {{item}}!';FirstParam:264;ParamCount:2),
 (ID:'history.found-item.pboots';English:'On level {{depth}} he found the {{item}}!';FirstParam:266;ParamCount:2),
 (ID:'history.found-item.psboots';English:'On level {{depth}} he found the {{item}}!';FirstParam:268;ParamCount:2),
 (ID:'history.found-item.shglobe';English:'On level {{depth}} he found the {{item}}!';FirstParam:270;ParamCount:2),
 (ID:'history.found-item.bpack';English:'On level {{depth}} he found the {{item}}!';FirstParam:272;ParamCount:2),
 (ID:'history.found-item.iglobe';English:'On level {{depth}} he found the {{item}}!';FirstParam:274;ParamCount:2),
 (ID:'history.found-item.scglobe';English:'On level {{depth}} he found the {{item}}!';FirstParam:276;ParamCount:2),
 (ID:'history.found-item.lhglobe';English:'On level {{depth}} he found the {{item}}!';FirstParam:278;ParamCount:2),
 (ID:'history.found-item.msglobe';English:'On level {{depth}} he found the {{item}}!';FirstParam:280;ParamCount:2),
 (ID:'history.found-item.map';English:'On level {{depth}} he found the {{item}}!';FirstParam:282;ParamCount:2),
 (ID:'history.found-item.pmap';English:'On level {{depth}} he found the {{item}}!';FirstParam:284;ParamCount:2),
 (ID:'history.found-item.gpack';English:'On level {{depth}} he found the {{item}}!';FirstParam:286;ParamCount:2),
 (ID:'history.found-item.backpack';English:'On level {{depth}} he found the {{item}}!';FirstParam:288;ParamCount:2),
 (ID:'history.found-item.ashard';English:'On level {{depth}} he found the {{item}}!';FirstParam:290;ParamCount:2),
 (ID:'history.found-item.ammo';English:'On level {{depth}} he found the {{item}}!';FirstParam:292;ParamCount:2),
 (ID:'history.found-item.shell';English:'On level {{depth}} he found the {{item}}!';FirstParam:294;ParamCount:2),
 (ID:'history.found-item.rocket';English:'On level {{depth}} he found the {{item}}!';FirstParam:296;ParamCount:2),
 (ID:'history.found-item.cell';English:'On level {{depth}} he found the {{item}}!';FirstParam:298;ParamCount:2),
 (ID:'history.found-item.pammo';English:'On level {{depth}} he found the {{item}}!';FirstParam:300;ParamCount:2),
 (ID:'history.found-item.pshell';English:'On level {{depth}} he found the {{item}}!';FirstParam:302;ParamCount:2),
 (ID:'history.found-item.procket';English:'On level {{depth}} he found the {{item}}!';FirstParam:304;ParamCount:2),
 (ID:'history.found-item.pcell';English:'On level {{depth}} he found the {{item}}!';FirstParam:306;ParamCount:2),
 (ID:'history.found-item.pistol';English:'On level {{depth}} he found the {{item}}!';FirstParam:308;ParamCount:2),
 (ID:'history.found-item.shotgun';English:'On level {{depth}} he found the {{item}}!';FirstParam:310;ParamCount:2),
 (ID:'history.found-item.dshotgun';English:'On level {{depth}} he found the {{item}}!';FirstParam:312;ParamCount:2),
 (ID:'history.found-item.ashotgun';English:'On level {{depth}} he found the {{item}}!';FirstParam:314;ParamCount:2),
 (ID:'history.found-item.bazooka';English:'On level {{depth}} he found the {{item}}!';FirstParam:316;ParamCount:2),
 (ID:'history.found-item.chaingun';English:'On level {{depth}} he found the {{item}}!';FirstParam:318;ParamCount:2),
 (ID:'history.found-item.plasma';English:'On level {{depth}} he found the {{item}}!';FirstParam:320;ParamCount:2),
 (ID:'history.found-item.smed';English:'On level {{depth}} he found the {{item}}!';FirstParam:322;ParamCount:2),
 (ID:'history.found-item.lmed';English:'On level {{depth}} he found the {{item}}!';FirstParam:324;ParamCount:2),
 (ID:'history.found-item.phase';English:'On level {{depth}} he found the {{item}}!';FirstParam:326;ParamCount:2),
 (ID:'history.found-item.hphase';English:'On level {{depth}} he found the {{item}}!';FirstParam:328;ParamCount:2),
 (ID:'history.found-item.epack';English:'On level {{depth}} he found the {{item}}!';FirstParam:330;ParamCount:2),
 (ID:'history.found-item.nuke';English:'On level {{depth}} he found the {{item}}!';FirstParam:332;ParamCount:2),
 (ID:'history.found-item.mod-power';English:'On level {{depth}} he found the {{item}}!';FirstParam:334;ParamCount:2),
 (ID:'history.found-item.mod-tech';English:'On level {{depth}} he found the {{item}}!';FirstParam:336;ParamCount:2),
 (ID:'history.found-item.mod-agility';English:'On level {{depth}} he found the {{item}}!';FirstParam:338;ParamCount:2),
 (ID:'history.found-item.mod-bulk';English:'On level {{depth}} he found the {{item}}!';FirstParam:340;ParamCount:2),
 (ID:'history.found-item.barrel';English:'On level {{depth}} he found the {{item}}!';FirstParam:342;ParamCount:2),
 (ID:'history.found-item.barrela';English:'On level {{depth}} he found the {{item}}!';FirstParam:344;ParamCount:2),
 (ID:'history.found-item.barreln';English:'On level {{depth}} he found the {{item}}!';FirstParam:346;ParamCount:2),
 (ID:'history.found-item.tree';English:'On level {{depth}} he found the {{item}}!';FirstParam:348;ParamCount:2),
 (ID:'history.found-item.lever-flood-water';English:'On level {{depth}} he found the {{item}}!';FirstParam:350;ParamCount:2),
 (ID:'history.found-item.lever-flood-acid';English:'On level {{depth}} he found the {{item}}!';FirstParam:352;ParamCount:2),
 (ID:'history.found-item.lever-flood-lava';English:'On level {{depth}} he found the {{item}}!';FirstParam:354;ParamCount:2),
 (ID:'history.found-item.lever-kill';English:'On level {{depth}} he found the {{item}}!';FirstParam:356;ParamCount:2),
 (ID:'history.found-item.lever-explode';English:'On level {{depth}} he found the {{item}}!';FirstParam:358;ParamCount:2),
 (ID:'history.found-item.lever-walls';English:'On level {{depth}} he found the {{item}}!';FirstParam:360;ParamCount:2),
 (ID:'history.found-item.lever-summon';English:'On level {{depth}} he found the {{item}}!';FirstParam:362;ParamCount:2),
 (ID:'history.found-item.lever-repair';English:'On level {{depth}} he found the {{item}}!';FirstParam:364;ParamCount:2),
 (ID:'history.found-item.lever-medical';English:'On level {{depth}} he found the {{item}}!';FirstParam:366;ParamCount:2),
 (ID:'history.found-item.lever-ammo';English:'On level {{depth}} he found the {{item}}!';FirstParam:368;ParamCount:2),
 (ID:'history.found-item.schematic-0';English:'On level {{depth}} he found the {{item}}!';FirstParam:370;ParamCount:2),
 (ID:'history.found-item.schematic-1';English:'On level {{depth}} he found the {{item}}!';FirstParam:372;ParamCount:2),
 (ID:'history.found-item.schematic-2';English:'On level {{depth}} he found the {{item}}!';FirstParam:374;ParamCount:2),
 (ID:'history.found-item.lava-element';English:'On level {{depth}} he found the {{item}}!';FirstParam:376;ParamCount:2),
 (ID:'history.found-item.unullpointer';English:'On level {{depth}} he found the {{item}}!';FirstParam:378;ParamCount:2),
 (ID:'history.found-item.umodstaff';English:'On level {{depth}} he found the {{item}}!';FirstParam:380;ParamCount:2),
 (ID:'history.found-item.ubutcher';English:'On level {{depth}} he found the {{item}}!';FirstParam:382;ParamCount:2),
 (ID:'history.found-item.umjoll';English:'On level {{depth}} he found the {{item}}!';FirstParam:384;ParamCount:2),
 (ID:'history.found-item.usubtle';English:'On level {{depth}} he found the {{item}}!';FirstParam:386;ParamCount:2),
 (ID:'history.found-item.utrigun';English:'On level {{depth}} he found the {{item}}!';FirstParam:388;ParamCount:2),
 (ID:'history.found-item.ujackal';English:'On level {{depth}} he found the {{item}}!';FirstParam:390;ParamCount:2),
 (ID:'history.found-item.umega';English:'On level {{depth}} he found the {{item}}!';FirstParam:392;ParamCount:2),
 (ID:'history.found-item.uberetta';English:'On level {{depth}} he found the {{item}}!';FirstParam:394;ParamCount:2),
 (ID:'history.found-item.usjack';English:'On level {{depth}} he found the {{item}}!';FirstParam:396;ParamCount:2),
 (ID:'history.found-item.ufshotgun';English:'On level {{depth}} he found the {{item}}!';FirstParam:398;ParamCount:2),
 (ID:'history.found-item.urbazooka';English:'On level {{depth}} he found the {{item}}!';FirstParam:400;ParamCount:2),
 (ID:'history.found-item.uacid';English:'On level {{depth}} he found the {{item}}!';FirstParam:402;ParamCount:2),
 (ID:'history.found-item.ubfg10k';English:'On level {{depth}} he found the {{item}}!';FirstParam:404;ParamCount:2),
 (ID:'history.found-item.urailgun';English:'On level {{depth}} he found the {{item}}!';FirstParam:406;ParamCount:2),
 (ID:'history.found-item.umarmor';English:'On level {{depth}} he found the {{item}}!';FirstParam:408;ParamCount:2),
 (ID:'history.found-item.ucarmor';English:'On level {{depth}} he found the {{item}}!';FirstParam:410;ParamCount:2),
 (ID:'history.found-item.unarmor';English:'On level {{depth}} he found the {{item}}!';FirstParam:412;ParamCount:2),
 (ID:'history.found-item.umedparmor';English:'On level {{depth}} he found the {{item}}!';FirstParam:414;ParamCount:2),
 (ID:'history.found-item.ulavaarmor';English:'On level {{depth}} he found the {{item}}!';FirstParam:416;ParamCount:2),
 (ID:'history.found-item.uenviroboots';English:'On level {{depth}} he found the {{item}}!';FirstParam:418;ParamCount:2),
 (ID:'history.found-item.unboots';English:'On level {{depth}} he found the {{item}}!';FirstParam:420;ParamCount:2),
 (ID:'history.found-item.ushieldarmor';English:'On level {{depth}} he found the {{item}}!';FirstParam:422;ParamCount:2),
 (ID:'history.found-item.uhwpack';English:'On level {{depth}} he found the {{item}}!';FirstParam:424;ParamCount:2),
 (ID:'history.found-item.aarmor';English:'On level {{depth}} he found the {{item}}!';FirstParam:426;ParamCount:2),
 (ID:'history.found-item.uberarmor';English:'On level {{depth}} he found the {{item}}!';FirstParam:428;ParamCount:2),
 (ID:'history.found-item.udragon';English:'On level {{depth}} he found the {{item}}!';FirstParam:430;ParamCount:2),
 (ID:'history.found-item.lever-spec3';English:'On level {{depth}} he found the {{item}}!';FirstParam:432;ParamCount:2),
 (ID:'history.found-item.hellportal';English:'On level {{depth}} he found the {{item}}!';FirstParam:434;ParamCount:2),
 (ID:'history.found-item.dis-switch';English:'On level {{depth}} he found the {{item}}!';FirstParam:436;ParamCount:2),
 (ID:'history.found-item.lever-centralprocessing1';English:'On level {{depth}} he found the {{item}}!';FirstParam:438;ParamCount:2),
 (ID:'history.found-item.lever-centralprocessing2';English:'On level {{depth}} he found the {{item}}!';FirstParam:440;ParamCount:2),
 (ID:'history.found-item.lever-centralprocessing3';English:'On level {{depth}} he found the {{item}}!';FirstParam:442;ParamCount:2),
 (ID:'history.found-item.lever-centralprocessing4';English:'On level {{depth}} he found the {{item}}!';FirstParam:444;ParamCount:2),
 (ID:'history.found-item.lever-centralprocessing5';English:'On level {{depth}} he found the {{item}}!';FirstParam:446;ParamCount:2),
 (ID:'history.found-item.uarenastaff';English:'On level {{depth}} he found the {{item}}!';FirstParam:448;ParamCount:2),
 (ID:'history.found-item.lever-chain1';English:'On level {{depth}} he found the {{item}}!';FirstParam:450;ParamCount:2),
 (ID:'history.found-item.lever-chain2';English:'On level {{depth}} he found the {{item}}!';FirstParam:452;ParamCount:2),
 (ID:'history.found-item.lever-chain3';English:'On level {{depth}} he found the {{item}}!';FirstParam:454;ParamCount:2),
 (ID:'history.found-item.lever-deimoslab';English:'On level {{depth}} he found the {{item}}!';FirstParam:456;ParamCount:2),
 (ID:'history.found-item.spear';English:'On level {{depth}} he found the {{item}}!';FirstParam:458;ParamCount:2),
 (ID:'history.found-item.uscythe';English:'On level {{depth}} he found the {{item}}!';FirstParam:460;ParamCount:2),
 (ID:'history.found-item.lever-limbow';English:'On level {{depth}} he found the {{item}}!';FirstParam:462;ParamCount:2),
 (ID:'history.found-item.lever-limboe';English:'On level {{depth}} he found the {{item}}!';FirstParam:464;ParamCount:2),
 (ID:'history.found-item.lever-erebus';English:'On level {{depth}} he found the {{item}}!';FirstParam:466;ParamCount:2),
 (ID:'history.found-item.lever-phoboslab1';English:'On level {{depth}} he found the {{item}}!';FirstParam:468;ParamCount:2),
 (ID:'history.found-item.lever-phoboslab2';English:'On level {{depth}} he found the {{item}}!';FirstParam:470;ParamCount:2),
 (ID:'history.found-item.lever-toxinrefinery1';English:'On level {{depth}} he found the {{item}}!';FirstParam:472;ParamCount:2),
 (ID:'history.found-item.lever-toxinrefinery2';English:'On level {{depth}} he found the {{item}}!';FirstParam:474;ParamCount:2),
 (ID:'history.found-item.lever-toxinrefinery3';English:'On level {{depth}} he found the {{item}}!';FirstParam:476;ParamCount:2),
 (ID:'history.found-item.stubitem';English:'On level {{depth}} he found the {{item}}!';FirstParam:478;ParamCount:2),
 (ID:'history.found-item.teleport';English:'On level {{depth}} he found the {{item}}!';FirstParam:480;ParamCount:2),
 (ID:'history.found-item.nat-imp';English:'On level {{depth}} he found the {{item}}!';FirstParam:482;ParamCount:2),
 (ID:'history.found-item.nat-cacodemon';English:'On level {{depth}} he found the {{item}}!';FirstParam:484;ParamCount:2),
 (ID:'history.found-item.nat-knight';English:'On level {{depth}} he found the {{item}}!';FirstParam:486;ParamCount:2),
 (ID:'history.found-item.nat-baron';English:'On level {{depth}} he found the {{item}}!';FirstParam:488;ParamCount:2),
 (ID:'history.found-item.nat-arachno';English:'On level {{depth}} he found the {{item}}!';FirstParam:490;ParamCount:2),
 (ID:'history.found-item.nat-revenant';English:'On level {{depth}} he found the {{item}}!';FirstParam:492;ParamCount:2),
 (ID:'history.found-item.nat-mancubus';English:'On level {{depth}} he found the {{item}}!';FirstParam:494;ParamCount:2),
 (ID:'history.found-item.nat-arch';English:'On level {{depth}} he found the {{item}}!';FirstParam:496;ParamCount:2),
 (ID:'history.found-item.nat-nimp';English:'On level {{depth}} he found the {{item}}!';FirstParam:498;ParamCount:2),
 (ID:'history.found-item.nat-ncacodemon';English:'On level {{depth}} he found the {{item}}!';FirstParam:500;ParamCount:2),
 (ID:'history.found-item.nat-nknight';English:'On level {{depth}} he found the {{item}}!';FirstParam:502;ParamCount:2),
 (ID:'history.found-item.nat-narachno';English:'On level {{depth}} he found the {{item}}!';FirstParam:504;ParamCount:2),
 (ID:'history.found-item.nat-nrevenant';English:'On level {{depth}} he found the {{item}}!';FirstParam:506;ParamCount:2),
 (ID:'history.found-item.nat-nmancubus';English:'On level {{depth}} he found the {{item}}!';FirstParam:508;ParamCount:2),
 (ID:'history.found-item.nat-narch';English:'On level {{depth}} he found the {{item}}!';FirstParam:510;ParamCount:2),
 (ID:'history.found-item.nat-bruiser';English:'On level {{depth}} he found the {{item}}!';FirstParam:512;ParamCount:2),
 (ID:'history.found-item.nat-shambler';English:'On level {{depth}} he found the {{item}}!';FirstParam:514;ParamCount:2),
 (ID:'history.found-item.nat-lava-elemental';English:'On level {{depth}} he found the {{item}}!';FirstParam:516;ParamCount:2),
 (ID:'history.found-item.nat-mastermind';English:'On level {{depth}} he found the {{item}}!';FirstParam:518;ParamCount:2),
 (ID:'history.found-item.nat-apostle';English:'On level {{depth}} he found the {{item}}!';FirstParam:520;ParamCount:2),
 (ID:'history.found-item.nat-arenamaster';English:'On level {{depth}} he found the {{item}}!';FirstParam:522;ParamCount:2),
 (ID:'history.overloaded-item.chainsaw';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:524;ParamCount:2),
 (ID:'history.overloaded-item.bfg9000';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:526;ParamCount:2),
 (ID:'history.overloaded-item.ublaster';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:528;ParamCount:2),
 (ID:'history.overloaded-item.ucpistol';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:530;ParamCount:2),
 (ID:'history.overloaded-item.uashotgun';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:532;ParamCount:2),
 (ID:'history.overloaded-item.upshotgun';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:534;ParamCount:2),
 (ID:'history.overloaded-item.udshotgun';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:536;ParamCount:2),
 (ID:'history.overloaded-item.ulaser';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:538;ParamCount:2),
 (ID:'history.overloaded-item.utristar';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:540;ParamCount:2),
 (ID:'history.overloaded-item.uminigun';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:542;ParamCount:2),
 (ID:'history.overloaded-item.umbazooka';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:544;ParamCount:2),
 (ID:'history.overloaded-item.unplasma';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:546;ParamCount:2),
 (ID:'history.overloaded-item.unbfg9000';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:548;ParamCount:2),
 (ID:'history.overloaded-item.utrans';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:550;ParamCount:2),
 (ID:'history.overloaded-item.unapalm';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:552;ParamCount:2),
 (ID:'history.overloaded-item.uoarmor';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:554;ParamCount:2),
 (ID:'history.overloaded-item.uparmor';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:556;ParamCount:2),
 (ID:'history.overloaded-item.upboots';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:558;ParamCount:2),
 (ID:'history.overloaded-item.ugarmor';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:560;ParamCount:2),
 (ID:'history.overloaded-item.ugboots';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:562;ParamCount:2),
 (ID:'history.overloaded-item.umedarmor';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:564;ParamCount:2),
 (ID:'history.overloaded-item.uduelarmor';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:566;ParamCount:2),
 (ID:'history.overloaded-item.ubulletarmor';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:568;ParamCount:2),
 (ID:'history.overloaded-item.uballisticarmor';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:570;ParamCount:2),
 (ID:'history.overloaded-item.ueshieldarmor';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:572;ParamCount:2),
 (ID:'history.overloaded-item.uplasmashield';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:574;ParamCount:2),
 (ID:'history.overloaded-item.uenergyshield';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:576;ParamCount:2),
 (ID:'history.overloaded-item.ubalshield';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:578;ParamCount:2),
 (ID:'history.overloaded-item.uacidboots';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:580;ParamCount:2),
 (ID:'history.overloaded-item.ubloodboots';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:582;ParamCount:2),
 (ID:'history.overloaded-item.umod-firestorm';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:584;ParamCount:2),
 (ID:'history.overloaded-item.umod-sniper';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:586;ParamCount:2),
 (ID:'history.overloaded-item.umod-nano';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:588;ParamCount:2),
 (ID:'history.overloaded-item.umod-onyx';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:590;ParamCount:2),
 (ID:'history.overloaded-item.uswpack';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:592;ParamCount:2),
 (ID:'history.overloaded-item.ubskull';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:594;ParamCount:2),
 (ID:'history.overloaded-item.ufskull';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:596;ParamCount:2),
 (ID:'history.overloaded-item.uhskull';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:598;ParamCount:2),
 (ID:'history.overloaded-item.knife';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:600;ParamCount:2),
 (ID:'history.overloaded-item.garmor';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:602;ParamCount:2),
 (ID:'history.overloaded-item.barmor';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:604;ParamCount:2),
 (ID:'history.overloaded-item.rarmor';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:606;ParamCount:2),
 (ID:'history.overloaded-item.sboots';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:608;ParamCount:2),
 (ID:'history.overloaded-item.pboots';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:610;ParamCount:2),
 (ID:'history.overloaded-item.psboots';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:612;ParamCount:2),
 (ID:'history.overloaded-item.shglobe';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:614;ParamCount:2),
 (ID:'history.overloaded-item.bpack';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:616;ParamCount:2),
 (ID:'history.overloaded-item.iglobe';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:618;ParamCount:2),
 (ID:'history.overloaded-item.scglobe';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:620;ParamCount:2),
 (ID:'history.overloaded-item.lhglobe';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:622;ParamCount:2),
 (ID:'history.overloaded-item.msglobe';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:624;ParamCount:2),
 (ID:'history.overloaded-item.map';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:626;ParamCount:2),
 (ID:'history.overloaded-item.pmap';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:628;ParamCount:2),
 (ID:'history.overloaded-item.gpack';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:630;ParamCount:2),
 (ID:'history.overloaded-item.backpack';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:632;ParamCount:2),
 (ID:'history.overloaded-item.ashard';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:634;ParamCount:2),
 (ID:'history.overloaded-item.ammo';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:636;ParamCount:2),
 (ID:'history.overloaded-item.shell';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:638;ParamCount:2),
 (ID:'history.overloaded-item.rocket';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:640;ParamCount:2),
 (ID:'history.overloaded-item.cell';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:642;ParamCount:2),
 (ID:'history.overloaded-item.pammo';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:644;ParamCount:2),
 (ID:'history.overloaded-item.pshell';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:646;ParamCount:2),
 (ID:'history.overloaded-item.procket';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:648;ParamCount:2),
 (ID:'history.overloaded-item.pcell';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:650;ParamCount:2),
 (ID:'history.overloaded-item.pistol';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:652;ParamCount:2),
 (ID:'history.overloaded-item.shotgun';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:654;ParamCount:2),
 (ID:'history.overloaded-item.dshotgun';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:656;ParamCount:2),
 (ID:'history.overloaded-item.ashotgun';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:658;ParamCount:2),
 (ID:'history.overloaded-item.bazooka';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:660;ParamCount:2),
 (ID:'history.overloaded-item.chaingun';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:662;ParamCount:2),
 (ID:'history.overloaded-item.plasma';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:664;ParamCount:2),
 (ID:'history.overloaded-item.smed';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:666;ParamCount:2),
 (ID:'history.overloaded-item.lmed';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:668;ParamCount:2),
 (ID:'history.overloaded-item.phase';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:670;ParamCount:2),
 (ID:'history.overloaded-item.hphase';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:672;ParamCount:2),
 (ID:'history.overloaded-item.epack';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:674;ParamCount:2),
 (ID:'history.overloaded-item.nuke';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:676;ParamCount:2),
 (ID:'history.overloaded-item.mod-power';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:678;ParamCount:2),
 (ID:'history.overloaded-item.mod-tech';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:680;ParamCount:2),
 (ID:'history.overloaded-item.mod-agility';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:682;ParamCount:2),
 (ID:'history.overloaded-item.mod-bulk';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:684;ParamCount:2),
 (ID:'history.overloaded-item.barrel';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:686;ParamCount:2),
 (ID:'history.overloaded-item.barrela';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:688;ParamCount:2),
 (ID:'history.overloaded-item.barreln';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:690;ParamCount:2),
 (ID:'history.overloaded-item.tree';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:692;ParamCount:2),
 (ID:'history.overloaded-item.lever-flood-water';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:694;ParamCount:2),
 (ID:'history.overloaded-item.lever-flood-acid';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:696;ParamCount:2),
 (ID:'history.overloaded-item.lever-flood-lava';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:698;ParamCount:2),
 (ID:'history.overloaded-item.lever-kill';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:700;ParamCount:2),
 (ID:'history.overloaded-item.lever-explode';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:702;ParamCount:2),
 (ID:'history.overloaded-item.lever-walls';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:704;ParamCount:2),
 (ID:'history.overloaded-item.lever-summon';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:706;ParamCount:2),
 (ID:'history.overloaded-item.lever-repair';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:708;ParamCount:2),
 (ID:'history.overloaded-item.lever-medical';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:710;ParamCount:2),
 (ID:'history.overloaded-item.lever-ammo';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:712;ParamCount:2),
 (ID:'history.overloaded-item.schematic-0';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:714;ParamCount:2),
 (ID:'history.overloaded-item.schematic-1';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:716;ParamCount:2),
 (ID:'history.overloaded-item.schematic-2';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:718;ParamCount:2),
 (ID:'history.overloaded-item.lava-element';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:720;ParamCount:2),
 (ID:'history.overloaded-item.unullpointer';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:722;ParamCount:2),
 (ID:'history.overloaded-item.umodstaff';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:724;ParamCount:2),
 (ID:'history.overloaded-item.ubutcher';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:726;ParamCount:2),
 (ID:'history.overloaded-item.umjoll';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:728;ParamCount:2),
 (ID:'history.overloaded-item.usubtle';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:730;ParamCount:2),
 (ID:'history.overloaded-item.utrigun';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:732;ParamCount:2),
 (ID:'history.overloaded-item.ujackal';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:734;ParamCount:2),
 (ID:'history.overloaded-item.umega';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:736;ParamCount:2),
 (ID:'history.overloaded-item.uberetta';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:738;ParamCount:2),
 (ID:'history.overloaded-item.usjack';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:740;ParamCount:2),
 (ID:'history.overloaded-item.ufshotgun';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:742;ParamCount:2),
 (ID:'history.overloaded-item.urbazooka';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:744;ParamCount:2),
 (ID:'history.overloaded-item.uacid';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:746;ParamCount:2),
 (ID:'history.overloaded-item.ubfg10k';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:748;ParamCount:2),
 (ID:'history.overloaded-item.urailgun';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:750;ParamCount:2),
 (ID:'history.overloaded-item.umarmor';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:752;ParamCount:2),
 (ID:'history.overloaded-item.ucarmor';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:754;ParamCount:2),
 (ID:'history.overloaded-item.unarmor';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:756;ParamCount:2),
 (ID:'history.overloaded-item.umedparmor';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:758;ParamCount:2),
 (ID:'history.overloaded-item.ulavaarmor';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:760;ParamCount:2),
 (ID:'history.overloaded-item.uenviroboots';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:762;ParamCount:2),
 (ID:'history.overloaded-item.unboots';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:764;ParamCount:2),
 (ID:'history.overloaded-item.ushieldarmor';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:766;ParamCount:2),
 (ID:'history.overloaded-item.uhwpack';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:768;ParamCount:2),
 (ID:'history.overloaded-item.aarmor';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:770;ParamCount:2),
 (ID:'history.overloaded-item.uberarmor';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:772;ParamCount:2),
 (ID:'history.overloaded-item.udragon';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:774;ParamCount:2),
 (ID:'history.overloaded-item.lever-spec3';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:776;ParamCount:2),
 (ID:'history.overloaded-item.hellportal';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:778;ParamCount:2),
 (ID:'history.overloaded-item.dis-switch';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:780;ParamCount:2),
 (ID:'history.overloaded-item.lever-centralprocessing1';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:782;ParamCount:2),
 (ID:'history.overloaded-item.lever-centralprocessing2';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:784;ParamCount:2),
 (ID:'history.overloaded-item.lever-centralprocessing3';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:786;ParamCount:2),
 (ID:'history.overloaded-item.lever-centralprocessing4';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:788;ParamCount:2),
 (ID:'history.overloaded-item.lever-centralprocessing5';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:790;ParamCount:2),
 (ID:'history.overloaded-item.uarenastaff';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:792;ParamCount:2),
 (ID:'history.overloaded-item.lever-chain1';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:794;ParamCount:2),
 (ID:'history.overloaded-item.lever-chain2';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:796;ParamCount:2),
 (ID:'history.overloaded-item.lever-chain3';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:798;ParamCount:2),
 (ID:'history.overloaded-item.lever-deimoslab';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:800;ParamCount:2),
 (ID:'history.overloaded-item.spear';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:802;ParamCount:2),
 (ID:'history.overloaded-item.uscythe';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:804;ParamCount:2),
 (ID:'history.overloaded-item.lever-limbow';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:806;ParamCount:2),
 (ID:'history.overloaded-item.lever-limboe';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:808;ParamCount:2),
 (ID:'history.overloaded-item.lever-erebus';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:810;ParamCount:2),
 (ID:'history.overloaded-item.lever-phoboslab1';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:812;ParamCount:2),
 (ID:'history.overloaded-item.lever-phoboslab2';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:814;ParamCount:2),
 (ID:'history.overloaded-item.lever-toxinrefinery1';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:816;ParamCount:2),
 (ID:'history.overloaded-item.lever-toxinrefinery2';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:818;ParamCount:2),
 (ID:'history.overloaded-item.lever-toxinrefinery3';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:820;ParamCount:2),
 (ID:'history.overloaded-item.stubitem';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:822;ParamCount:2),
 (ID:'history.overloaded-item.teleport';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:824;ParamCount:2),
 (ID:'history.overloaded-item.nat-imp';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:826;ParamCount:2),
 (ID:'history.overloaded-item.nat-cacodemon';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:828;ParamCount:2),
 (ID:'history.overloaded-item.nat-knight';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:830;ParamCount:2),
 (ID:'history.overloaded-item.nat-baron';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:832;ParamCount:2),
 (ID:'history.overloaded-item.nat-arachno';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:834;ParamCount:2),
 (ID:'history.overloaded-item.nat-revenant';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:836;ParamCount:2),
 (ID:'history.overloaded-item.nat-mancubus';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:838;ParamCount:2),
 (ID:'history.overloaded-item.nat-arch';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:840;ParamCount:2),
 (ID:'history.overloaded-item.nat-nimp';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:842;ParamCount:2),
 (ID:'history.overloaded-item.nat-ncacodemon';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:844;ParamCount:2),
 (ID:'history.overloaded-item.nat-nknight';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:846;ParamCount:2),
 (ID:'history.overloaded-item.nat-narachno';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:848;ParamCount:2),
 (ID:'history.overloaded-item.nat-nrevenant';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:850;ParamCount:2),
 (ID:'history.overloaded-item.nat-nmancubus';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:852;ParamCount:2),
 (ID:'history.overloaded-item.nat-narch';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:854;ParamCount:2),
 (ID:'history.overloaded-item.nat-bruiser';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:856;ParamCount:2),
 (ID:'history.overloaded-item.nat-shambler';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:858;ParamCount:2),
 (ID:'history.overloaded-item.nat-lava-elemental';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:860;ParamCount:2),
 (ID:'history.overloaded-item.nat-mastermind';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:862;ParamCount:2),
 (ID:'history.overloaded-item.nat-apostle';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:864;ParamCount:2),
 (ID:'history.overloaded-item.nat-arenamaster';English:'He overloaded a {{item}} on level {{depth}}!';FirstParam:866;ParamCount:2),
 (ID:'history.level-entry.abyssal-plains';English:'On level {{depth}} he romped upon the Abyssal Plains.';FirstParam:868;ParamCount:1),
 (ID:'history.level-entry.hells-arena';English:'On level {{depth}} he entered Hell''s Arena.';FirstParam:869;ParamCount:1),
 (ID:'history.level-entry.hells-armory';English:'On level {{depth}} he entered Hell''s Armory.';FirstParam:870;ParamCount:1),
 (ID:'history.level-entry.halls-of-carnage';English:'On level {{depth}} he ventured into the Halls of Carnage.';FirstParam:871;ParamCount:1),
 (ID:'history.level-entry.central-processing';English:'On level {{depth}} he trekked through Central Processing.';FirstParam:872;ParamCount:1),
 (ID:'history.level-entry.the-chained-court';English:'On level {{depth}} he stormed the Chained Court.';FirstParam:873;ParamCount:1),
 (ID:'history.level-entry.containment-area';English:'On level {{depth}} he arrived at the Containment Area.';FirstParam:874;ParamCount:1),
 (ID:'history.level-entry.deimos-lab';English:'On level {{depth}} he entered Deimos Lab.';FirstParam:875;ParamCount:1),
 (ID:'history.level-entry.unholy-cathedral';English:'On level {{depth}} he invaded the Unholy Cathedral!';FirstParam:876;ParamCount:1),
 (ID:'history.level-entry.house-of-pain';English:'On level {{depth}} he trespassed on the House of Pain.';FirstParam:877;ParamCount:1),
 (ID:'history.level-entry.the-lava-pits';English:'On level {{depth}} he entered the Lava Pits.';FirstParam:878;ParamCount:1),
 (ID:'history.level-entry.limbo';English:'On level {{depth}} he was foolish enough to enter Limbo!';FirstParam:879;ParamCount:1),
 (ID:'history.level-entry.military-base';English:'On level {{depth}} he marched into the Military Base.';FirstParam:880;ParamCount:1),
 (ID:'history.level-entry.the-mortuary';English:'On level {{depth}} he was foolish enough to enter the Mortuary!';FirstParam:881;ParamCount:1),
 (ID:'history.level-entry.mt-erebus';English:'On level {{depth}} he arrived at Mt. Erebus.';FirstParam:882;ParamCount:1),
 (ID:'history.level-entry.phobos-lab';English:'On level {{depth}} he sneaked into the Phobos Lab.';FirstParam:883;ParamCount:1),
 (ID:'history.level-entry.city-of-skulls';English:'On level {{depth}} he found the City of Skulls.';FirstParam:884;ParamCount:1),
 (ID:'history.level-entry.spiders-lair';English:'On level {{depth}} he ventured into the Spider''s Lair.';FirstParam:885;ParamCount:1),
 (ID:'history.level-entry.toxin-refinery';English:'On level {{depth}} he waded into the Toxin Refinery.';FirstParam:886;ParamCount:1),
 (ID:'history.level-entry.the-vaults';English:'On level {{depth}} he entered the Vaults.';FirstParam:887;ParamCount:1),
 (ID:'history.level-entry.the-wall';English:'On level {{depth}} he witnessed the Wall.';FirstParam:888;ParamCount:1),
 (ID:'history.cave.nightmare-demon';English:'On level {{depth}} he stumbled into a nightmare demon cave!';FirstParam:889;ParamCount:1),
 (ID:'history.cave.nightmare-arachnotron';English:'On level {{depth}} he stumbled into a nightmare arachnotron cave!';FirstParam:890;ParamCount:1),
 (ID:'history.cave.nightmare-elemental';English:'On level {{depth}} he stumbled into a nightmare elemental cave!';FirstParam:891;ParamCount:1),
 (ID:'history.cave.nightmare-cacodemon';English:'On level {{depth}} he stumbled into a nightmare cacodemon cave!';FirstParam:892;ParamCount:1),
 (ID:'history.cave.agony-elemental';English:'On level {{depth}} he stumbled into a agony elemental cave!';FirstParam:893;ParamCount:1),
 (ID:'history.cave.lava-elemental';English:'On level {{depth}} he stumbled into a lava elemental cave!';FirstParam:894;ParamCount:1),
 (ID:'history.native.almost-dead';English:'Entering level {{depth}} he was almost dead...';FirstParam:895;ParamCount:1),
 (ID:'history.native.left-quickly';English:'He left level {{depth}} as soon as possible.';FirstParam:896;ParamCount:1)
);
const CHistoryParams:array[0..896]of record Name:AnsiString;Kind: TDRLTextParamKind;end=(
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'assembly';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'assembly';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'assembly';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'assembly';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'assembly';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'assembly';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'assembly';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'assembly';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'assembly';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'assembly';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'assembly';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'assembly';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'assembly';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'assembly';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'assembly';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'assembly';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'assembly';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'assembly';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'assembly';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'assembly';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'assembly';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'assembly';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'assembly';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'assembly';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'assembly';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'assembly';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'assembly';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'assembly';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'assembly';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'assembly';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'assembly';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'assembly';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'assembly';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'assembly';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'assembly';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'assembly';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'assembly';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'assembly';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'assembly';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'assembly';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'assembly';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'assembly';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'beings';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'beings';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'beings';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'beings';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'beings';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'beings';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'beings';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'beings';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'beings';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'beings';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'beings';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'beings';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'beings';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'beings';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'beings';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'beings';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'beings';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'beings';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'beings';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'beings';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'beings';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'beings';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'beings';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'beings';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'beings';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'beings';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'beings';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'beings';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'beings';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'beings';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'beings';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'beings';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'beings';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'beings';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'beings';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'beings';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'beings';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'beings';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'beings';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'beings';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'item';Kind:DRL_TEXT_STRING),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'depth';Kind:DRL_TEXT_INTEGER),
 (Name:'depth';Kind:DRL_TEXT_INTEGER)
);
function DRLValidateHistoryRequest(const aID,aEnglish:AnsiString;const aParams:array of TDRLTextParam):Boolean;
var i,j,k:Integer;found:Boolean;
begin
 for i:=0 to High(CHistoryRows)do if CHistoryRows[i].ID=aID then begin
  if(CHistoryRows[i].English<>aEnglish)or(CHistoryRows[i].ParamCount<>Length(aParams))then Exit(False);
  for j:=0 to CHistoryRows[i].ParamCount-1 do begin
   found:=False;for k:=0 to High(aParams)do if(aParams[k].Name=CHistoryParams[CHistoryRows[i].FirstParam+j].Name)and(aParams[k].Kind=CHistoryParams[CHistoryRows[i].FirstParam+j].Kind)then found:=True;
   if not found then Exit(False);
  end;Exit(True);
 end;Exit(False);
end;
const CHistoryItems:array[0..171]of record ID,English:AnsiString;end=(
 (ID:'chainsaw';English:'chainsaw'),
 (ID:'bfg9000';English:'BFG 9000'),
 (ID:'ublaster';English:'blaster'),
 (ID:'ucpistol';English:'combat pistol'),
 (ID:'uashotgun';English:'assault shotgun'),
 (ID:'upshotgun';English:'plasma shotgun'),
 (ID:'udshotgun';English:'super shotgun'),
 (ID:'ulaser';English:'laser rifle'),
 (ID:'utristar';English:'tristar blaster'),
 (ID:'uminigun';English:'minigun'),
 (ID:'umbazooka';English:'missile launcher'),
 (ID:'unplasma';English:'nuclear plasma rifle'),
 (ID:'unbfg9000';English:'nuclear BFG 9000'),
 (ID:'utrans';English:'combat translocator'),
 (ID:'unapalm';English:'napalm launcher'),
 (ID:'uoarmor';English:'onyx armor'),
 (ID:'uparmor';English:'phaseshift armor'),
 (ID:'upboots';English:'phaseshift boots'),
 (ID:'ugarmor';English:'gothic armor'),
 (ID:'ugboots';English:'gothic boots'),
 (ID:'umedarmor';English:'medical armor'),
 (ID:'uduelarmor';English:'duelist armor'),
 (ID:'ubulletarmor';English:'bullet-proof vest'),
 (ID:'uballisticarmor';English:'ballistic vest'),
 (ID:'ueshieldarmor';English:'energy-shielded vest'),
 (ID:'uplasmashield';English:'plasma shield'),
 (ID:'uenergyshield';English:'energy shield'),
 (ID:'ubalshield';English:'ballistic shield'),
 (ID:'uacidboots';English:'acid-proof boots'),
 (ID:'ubloodboots';English:'blood boots'),
 (ID:'umod_firestorm';English:'firestorm weapon pack'),
 (ID:'umod_sniper';English:'sniper weapon pack'),
 (ID:'umod_nano';English:'nano pack'),
 (ID:'umod_onyx';English:'onyx armor pack'),
 (ID:'uswpack';English:'shockwave pack'),
 (ID:'ubskull';English:'blood skull'),
 (ID:'ufskull';English:'fire skull'),
 (ID:'uhskull';English:'hatred skull'),
 (ID:'knife';English:'combat knife'),
 (ID:'garmor';English:'green armor'),
 (ID:'barmor';English:'blue armor'),
 (ID:'rarmor';English:'red armor'),
 (ID:'sboots';English:'steel boots'),
 (ID:'pboots';English:'protective boots'),
 (ID:'psboots';English:'plasteel boots'),
 (ID:'shglobe';English:'Small Health Globe'),
 (ID:'bpack';English:'Berserk Pack'),
 (ID:'iglobe';English:'Invulnerability Globe'),
 (ID:'scglobe';English:'Supercharge Globe'),
 (ID:'lhglobe';English:'Large Health Globe'),
 (ID:'msglobe';English:'Megasphere'),
 (ID:'map';English:'Computer Map'),
 (ID:'pmap';English:'Tracking Map'),
 (ID:'gpack';English:'Light-Amp Goggles'),
 (ID:'backpack';English:'Backpack'),
 (ID:'ashard';English:'armor shard'),
 (ID:'ammo';English:'10mm ammo'),
 (ID:'shell';English:'shotgun shell'),
 (ID:'rocket';English:'rocket'),
 (ID:'cell';English:'power cell'),
 (ID:'pammo';English:'10mm ammo chain'),
 (ID:'pshell';English:'shell box'),
 (ID:'procket';English:'rocket box'),
 (ID:'pcell';English:'power battery'),
 (ID:'pistol';English:'pistol'),
 (ID:'shotgun';English:'shotgun'),
 (ID:'dshotgun';English:'double shotgun'),
 (ID:'ashotgun';English:'combat shotgun'),
 (ID:'bazooka';English:'rocket launcher'),
 (ID:'chaingun';English:'chaingun'),
 (ID:'plasma';English:'plasma rifle'),
 (ID:'smed';English:'small med-pack'),
 (ID:'lmed';English:'large med-pack'),
 (ID:'phase';English:'phase device'),
 (ID:'hphase';English:'homing phase device'),
 (ID:'epack';English:'envirosuit pack'),
 (ID:'nuke';English:'thermonuclear bomb'),
 (ID:'mod_power';English:'power mod pack'),
 (ID:'mod_tech';English:'technical mod pack'),
 (ID:'mod_agility';English:'agility mod pack'),
 (ID:'mod_bulk';English:'bulk mod pack'),
 (ID:'barrel';English:'barrel of fuel'),
 (ID:'barrela';English:'barrel of acid'),
 (ID:'barreln';English:'barrel of napalm'),
 (ID:'tree';English:'Phobos tree'),
 (ID:'lever_flood_water';English:'lever'),
 (ID:'lever_flood_acid';English:'lever'),
 (ID:'lever_flood_lava';English:'lever'),
 (ID:'lever_kill';English:'lever'),
 (ID:'lever_explode';English:'lever'),
 (ID:'lever_walls';English:'lever'),
 (ID:'lever_summon';English:'lever'),
 (ID:'lever_repair';English:'lever'),
 (ID:'lever_medical';English:'lever'),
 (ID:'lever_ammo';English:'lever'),
 (ID:'schematic_0';English:'schematics'),
 (ID:'schematic_1';English:'schematics'),
 (ID:'schematic_2';English:'schematics'),
 (ID:'lava_element';English:'lava element'),
 (ID:'unullpointer';English:'Charch''s Null Pointer'),
 (ID:'umodstaff';English:'Hell Staff'),
 (ID:'ubutcher';English:'Butcher''s Cleaver'),
 (ID:'umjoll';English:'Mjollnir'),
 (ID:'usubtle';English:'Subtle Knife'),
 (ID:'utrigun';English:'Trigun'),
 (ID:'ujackal';English:'Anti-Freak Jackal'),
 (ID:'umega';English:'Mega Buster'),
 (ID:'uberetta';English:'Grammaton Cleric Beretta'),
 (ID:'usjack';English:'Jackhammer'),
 (ID:'ufshotgun';English:'Frag Shotgun'),
 (ID:'urbazooka';English:'Revenant''s Launcher'),
 (ID:'uacid';English:'Acid Spitter'),
 (ID:'ubfg10k';English:'BFG 10K'),
 (ID:'urailgun';English:'Railgun'),
 (ID:'umarmor';English:'Malek''s Armor'),
 (ID:'ucarmor';English:'Cybernetic Armor'),
 (ID:'unarmor';English:'Necroarmor'),
 (ID:'umedparmor';English:'Medical Powerarmor'),
 (ID:'ulavaarmor';English:'Lava Armor'),
 (ID:'uenviroboots';English:'Enviroboots'),
 (ID:'unboots';English:'Nyarlaptotep''s Boots'),
 (ID:'ushieldarmor';English:'Shielded Armor'),
 (ID:'uhwpack';English:'Hellwave Pack'),
 (ID:'aarmor';English:'Angelic Armor'),
 (ID:'uberarmor';English:'Berserker Armor'),
 (ID:'udragon';English:'Dragonslayer'),
 (ID:'lever_spec3';English:'lever'),
 (ID:'hellportal';English:'Hellgate'),
 (ID:'dis_switch';English:'lever'),
 (ID:'lever_centralprocessing1';English:'lever'),
 (ID:'lever_centralprocessing2';English:'lever'),
 (ID:'lever_centralprocessing3';English:'lever'),
 (ID:'lever_centralprocessing4';English:'lever'),
 (ID:'lever_centralprocessing5';English:'lever'),
 (ID:'uarenastaff';English:'Arena Master''s Staff'),
 (ID:'lever_chain1';English:'lever'),
 (ID:'lever_chain2';English:'lever'),
 (ID:'lever_chain3';English:'lever'),
 (ID:'lever_deimoslab';English:'lever'),
 (ID:'spear';English:'Longinus Spear'),
 (ID:'uscythe';English:'Azrael''s Scythe'),
 (ID:'lever_limbow';English:'lever'),
 (ID:'lever_limboe';English:'lever'),
 (ID:'lever_erebus';English:'lever'),
 (ID:'lever_phoboslab1';English:'lever'),
 (ID:'lever_phoboslab2';English:'lever'),
 (ID:'lever_toxinrefinery1';English:'lever'),
 (ID:'lever_toxinrefinery2';English:'lever'),
 (ID:'lever_toxinrefinery3';English:'lever'),
 (ID:'stubitem';English:'stubitem'),
 (ID:'teleport';English:'teleport'),
 (ID:'nat_imp';English:'ranged attack'),
 (ID:'nat_cacodemon';English:'ranged attack'),
 (ID:'nat_knight';English:'ranged attack'),
 (ID:'nat_baron';English:'ranged attack'),
 (ID:'nat_arachno';English:'ranged attack'),
 (ID:'nat_revenant';English:'ranged attack'),
 (ID:'nat_mancubus';English:'ranged attack'),
 (ID:'nat_arch';English:'ranged attack'),
 (ID:'nat_nimp';English:'ranged attack'),
 (ID:'nat_ncacodemon';English:'ranged attack'),
 (ID:'nat_nknight';English:'ranged attack'),
 (ID:'nat_narachno';English:'ranged attack'),
 (ID:'nat_nrevenant';English:'ranged attack'),
 (ID:'nat_nmancubus';English:'ranged attack'),
 (ID:'nat_narch';English:'ranged attack'),
 (ID:'nat_bruiser';English:'ranged attack'),
 (ID:'nat_shambler';English:'ranged attack'),
 (ID:'nat_lava_elemental';English:'ranged attack'),
 (ID:'nat_mastermind';English:'ranged attack'),
 (ID:'nat_apostle';English:'ranged attack'),
 (ID:'nat_arenamaster';English:'ranged attack')
);
const CHistoryNameRules:array[0..43]of record SemanticID,English:AnsiString;Fixed:Boolean;Aspect:AnsiString;end=(
 (SemanticID:'item.name.assembly.chainsword';English:'chainsword';Fixed:True;Aspect:'chainsword'),
 (SemanticID:'item.name.assembly.pblade';English:'piercing {{name}}';Fixed:False;Aspect:'piercing '),
 (SemanticID:'item.name.assembly.speedloader';English:'speedloader pistol';Fixed:True;Aspect:'speedloader pistol'),
 (SemanticID:'item.name.assembly.elephant';English:'elephant gun';Fixed:True;Aspect:'elephant gun'),
 (SemanticID:'item.name.assembly.gatling';English:'gatling gun';Fixed:True;Aspect:'gatling gun'),
 (SemanticID:'item.name.assembly.micro';English:'micro launcher';Fixed:True;Aspect:'micro launcher'),
 (SemanticID:'item.name.assembly.tarmor';English:'tactical armor';Fixed:True;Aspect:'tactical armor'),
 (SemanticID:'item.name.assembly.tboots';English:'tactical boots';Fixed:True;Aspect:'tactical boots'),
 (SemanticID:'item.name.assembly.nanofiber';English:'nanofiber {{name}}';Fixed:False;Aspect:'nanofiber '),
 (SemanticID:'item.name.assembly.high';English:'high power {{name}}';Fixed:False;Aspect:'high power '),
 (SemanticID:'item.name.assembly.power';English:'powered {{name}}';Fixed:False;Aspect:'powered '),
 (SemanticID:'item.name.assembly.tshotgun';English:'tactical shotgun';Fixed:True;Aspect:'tactical shotgun'),
 (SemanticID:'item.name.assembly.plate';English:'tower shield';Fixed:True;Aspect:'tower shield'),
 (SemanticID:'item.name.assembly.fparmor';English:'fireproof {{name}}';Fixed:False;Aspect:'fireproof '),
 (SemanticID:'item.name.assembly.fpboots';English:'fireproof {{name}}';Fixed:False;Aspect:'fireproof '),
 (SemanticID:'item.name.assembly.balarmor';English:'ballistic {{name}}';Fixed:False;Aspect:'ballistic '),
 (SemanticID:'item.name.assembly.plasmatic';English:'plasmatic {{name}}';Fixed:False;Aspect:'plasmatic '),
 (SemanticID:'item.name.assembly.gboots';English:'grappling {{name}}';Fixed:False;Aspect:'grappling '),
 (SemanticID:'item.name.assembly.grarmor';English:'grappling {{name}}';Fixed:False;Aspect:'grappling '),
 (SemanticID:'item.name.assembly.lavboots';English:'lava {{name}}';Fixed:False;Aspect:'lava '),
 (SemanticID:'item.name.assembly.double';English:'double chainsaw';Fixed:True;Aspect:'double chainsaw'),
 (SemanticID:'item.name.assembly.tacticalrl';English:'tactical rocket launcher';Fixed:True;Aspect:'tactical rocket launcher'),
 (SemanticID:'item.name.assembly.storm';English:'storm {{name}}';Fixed:False;Aspect:'storm '),
 (SemanticID:'item.name.assembly.rifle';English:'assault {{name}}';Fixed:False;Aspect:'assault '),
 (SemanticID:'item.name.assembly.energy';English:'energy {{name}}';Fixed:False;Aspect:'energy '),
 (SemanticID:'item.name.assembly.assault';English:'burst {{name}}';Fixed:False;Aspect:'burst '),
 (SemanticID:'item.name.assembly.vbfg9000.nuclear';English:'nuclear VBFG9000';Fixed:True;Aspect:'nuclear VBFG9000'),
 (SemanticID:'item.name.assembly.vbfg9000.regular';English:'VBFG9000';Fixed:True;Aspect:'VBFG9000'),
 (SemanticID:'item.name.assembly.envboots';English:'environmental {{name}}';Fixed:False;Aspect:'environmental '),
 (SemanticID:'item.name.assembly.fireshield';English:'fire shield';Fixed:True;Aspect:'fire shield'),
 (SemanticID:'item.name.assembly.nanoskin';English:'nanoskin {{name}}';Fixed:False;Aspect:'nanoskin '),
 (SemanticID:'item.name.assembly.gravity';English:'antigrav {{name}}';Fixed:False;Aspect:'antigrav '),
 (SemanticID:'item.name.assembly.hyperblaster';English:'hyperblaster';Fixed:True;Aspect:'hyperblaster'),
 (SemanticID:'item.name.assembly.fdshotgun';English:'focused double shotgun';Fixed:True;Aspect:'focused double shotgun'),
 (SemanticID:'item.name.assembly.nanomanufacture';English:'nanomachic {{name}}';Fixed:False;Aspect:'nanomachic '),
 (SemanticID:'item.name.assembly.nsharpnel';English:'nano {{name}}';Fixed:False;Aspect:'nano '),
 (SemanticID:'item.name.assembly.demolition';English:'demolition {{name}}';Fixed:False;Aspect:'demolition '),
 (SemanticID:'item.name.assembly.cybernano';English:'cybernano {{name}}';Fixed:False;Aspect:'cybernano '),
 (SemanticID:'item.name.assembly.biggest.nuclear';English:'biggest fucking nuclear gun';Fixed:True;Aspect:'biggest fucking nuclear gun'),
 (SemanticID:'item.name.assembly.biggest.regular';English:'biggest fucking gun';Fixed:True;Aspect:'biggest fucking gun'),
 (SemanticID:'item.name.assembly.ripper';English:'ripper';Fixed:True;Aspect:'ripper'),
 (SemanticID:'item.name.assembly.cerboots';English:'cerberus {{name}}';Fixed:False;Aspect:'cerberus '),
 (SemanticID:'item.name.assembly.cerarmor';English:'cerberus {{name}}';Fixed:False;Aspect:'cerberus '),
 (SemanticID:'item.name.assembly.mother';English:'Mother-In-Law';Fixed:True;Aspect:'Mother-In-Law')
);
function ProjectItemName(const aRegistryID,aOriginal:AnsiString):AnsiString;
var i,j:Integer;expected,base,localized:AnsiString;
begin
 for i:=0 to High(CHistoryItems)do if CHistoryItems[i].ID=aRegistryID then begin
  base:=DRLRegistryText('item',aRegistryID,'base_game','name',CHistoryItems[i].English);
  if aOriginal=CHistoryItems[i].English then Exit(base);
  if aOriginal='overcharged '+CHistoryItems[i].English then Exit(DRLText('item.name.overcharged','overcharged {{name}}',[DRLStringParam('name',base)]));
  for j:=0 to High(CHistoryNameRules)do begin
   if CHistoryNameRules[j].Fixed then expected:=CHistoryNameRules[j].Aspect
    else expected:=CHistoryNameRules[j].Aspect+CHistoryItems[i].English;
   if(aOriginal=expected)or(aOriginal='overcharged '+expected)then begin
    if CHistoryNameRules[j].Fixed then localized:=DRLText(CHistoryNameRules[j].SemanticID,CHistoryNameRules[j].English)
     else localized:=DRLText(CHistoryNameRules[j].SemanticID,CHistoryNameRules[j].English,[DRLStringParam('name',base)]);
    if aOriginal<>expected then localized:=DRLText('item.name.overcharged','overcharged {{name}}',[DRLStringParam('name',localized)]);
    Exit(localized);
   end;
  end;Exit(aOriginal);
 end;Exit(aOriginal);
end;
function ProjectParameter(const aID:AnsiString;const aParam:TDRLTextParam):AnsiString;
begin
  if (aID='history.found-item.chainsaw') and (aParam.Name='item') then Exit(ProjectItemName('chainsaw',aParam.Value));
  if (aID='history.found-item.bfg9000') and (aParam.Name='item') then Exit(ProjectItemName('bfg9000',aParam.Value));
  if (aID='history.found-item.ublaster') and (aParam.Name='item') then Exit(ProjectItemName('ublaster',aParam.Value));
  if (aID='history.found-item.ucpistol') and (aParam.Name='item') then Exit(ProjectItemName('ucpistol',aParam.Value));
  if (aID='history.found-item.uashotgun') and (aParam.Name='item') then Exit(ProjectItemName('uashotgun',aParam.Value));
  if (aID='history.found-item.upshotgun') and (aParam.Name='item') then Exit(ProjectItemName('upshotgun',aParam.Value));
  if (aID='history.found-item.udshotgun') and (aParam.Name='item') then Exit(ProjectItemName('udshotgun',aParam.Value));
  if (aID='history.found-item.ulaser') and (aParam.Name='item') then Exit(ProjectItemName('ulaser',aParam.Value));
  if (aID='history.found-item.utristar') and (aParam.Name='item') then Exit(ProjectItemName('utristar',aParam.Value));
  if (aID='history.found-item.uminigun') and (aParam.Name='item') then Exit(ProjectItemName('uminigun',aParam.Value));
  if (aID='history.found-item.umbazooka') and (aParam.Name='item') then Exit(ProjectItemName('umbazooka',aParam.Value));
  if (aID='history.found-item.unplasma') and (aParam.Name='item') then Exit(ProjectItemName('unplasma',aParam.Value));
  if (aID='history.found-item.unbfg9000') and (aParam.Name='item') then Exit(ProjectItemName('unbfg9000',aParam.Value));
  if (aID='history.found-item.utrans') and (aParam.Name='item') then Exit(ProjectItemName('utrans',aParam.Value));
  if (aID='history.found-item.unapalm') and (aParam.Name='item') then Exit(ProjectItemName('unapalm',aParam.Value));
  if (aID='history.found-item.uoarmor') and (aParam.Name='item') then Exit(ProjectItemName('uoarmor',aParam.Value));
  if (aID='history.found-item.uparmor') and (aParam.Name='item') then Exit(ProjectItemName('uparmor',aParam.Value));
  if (aID='history.found-item.upboots') and (aParam.Name='item') then Exit(ProjectItemName('upboots',aParam.Value));
  if (aID='history.found-item.ugarmor') and (aParam.Name='item') then Exit(ProjectItemName('ugarmor',aParam.Value));
  if (aID='history.found-item.ugboots') and (aParam.Name='item') then Exit(ProjectItemName('ugboots',aParam.Value));
  if (aID='history.found-item.umedarmor') and (aParam.Name='item') then Exit(ProjectItemName('umedarmor',aParam.Value));
  if (aID='history.found-item.uduelarmor') and (aParam.Name='item') then Exit(ProjectItemName('uduelarmor',aParam.Value));
  if (aID='history.found-item.ubulletarmor') and (aParam.Name='item') then Exit(ProjectItemName('ubulletarmor',aParam.Value));
  if (aID='history.found-item.uballisticarmor') and (aParam.Name='item') then Exit(ProjectItemName('uballisticarmor',aParam.Value));
  if (aID='history.found-item.ueshieldarmor') and (aParam.Name='item') then Exit(ProjectItemName('ueshieldarmor',aParam.Value));
  if (aID='history.found-item.uplasmashield') and (aParam.Name='item') then Exit(ProjectItemName('uplasmashield',aParam.Value));
  if (aID='history.found-item.uenergyshield') and (aParam.Name='item') then Exit(ProjectItemName('uenergyshield',aParam.Value));
  if (aID='history.found-item.ubalshield') and (aParam.Name='item') then Exit(ProjectItemName('ubalshield',aParam.Value));
  if (aID='history.found-item.uacidboots') and (aParam.Name='item') then Exit(ProjectItemName('uacidboots',aParam.Value));
  if (aID='history.found-item.ubloodboots') and (aParam.Name='item') then Exit(ProjectItemName('ubloodboots',aParam.Value));
  if (aID='history.found-item.umod-firestorm') and (aParam.Name='item') then Exit(ProjectItemName('umod_firestorm',aParam.Value));
  if (aID='history.found-item.umod-sniper') and (aParam.Name='item') then Exit(ProjectItemName('umod_sniper',aParam.Value));
  if (aID='history.found-item.umod-nano') and (aParam.Name='item') then Exit(ProjectItemName('umod_nano',aParam.Value));
  if (aID='history.found-item.umod-onyx') and (aParam.Name='item') then Exit(ProjectItemName('umod_onyx',aParam.Value));
  if (aID='history.found-item.uswpack') and (aParam.Name='item') then Exit(ProjectItemName('uswpack',aParam.Value));
  if (aID='history.found-item.ubskull') and (aParam.Name='item') then Exit(ProjectItemName('ubskull',aParam.Value));
  if (aID='history.found-item.ufskull') and (aParam.Name='item') then Exit(ProjectItemName('ufskull',aParam.Value));
  if (aID='history.found-item.uhskull') and (aParam.Name='item') then Exit(ProjectItemName('uhskull',aParam.Value));
  if (aID='history.found-item.knife') and (aParam.Name='item') then Exit(ProjectItemName('knife',aParam.Value));
  if (aID='history.found-item.garmor') and (aParam.Name='item') then Exit(ProjectItemName('garmor',aParam.Value));
  if (aID='history.found-item.barmor') and (aParam.Name='item') then Exit(ProjectItemName('barmor',aParam.Value));
  if (aID='history.found-item.rarmor') and (aParam.Name='item') then Exit(ProjectItemName('rarmor',aParam.Value));
  if (aID='history.found-item.sboots') and (aParam.Name='item') then Exit(ProjectItemName('sboots',aParam.Value));
  if (aID='history.found-item.pboots') and (aParam.Name='item') then Exit(ProjectItemName('pboots',aParam.Value));
  if (aID='history.found-item.psboots') and (aParam.Name='item') then Exit(ProjectItemName('psboots',aParam.Value));
  if (aID='history.found-item.shglobe') and (aParam.Name='item') then Exit(ProjectItemName('shglobe',aParam.Value));
  if (aID='history.found-item.bpack') and (aParam.Name='item') then Exit(ProjectItemName('bpack',aParam.Value));
  if (aID='history.found-item.iglobe') and (aParam.Name='item') then Exit(ProjectItemName('iglobe',aParam.Value));
  if (aID='history.found-item.scglobe') and (aParam.Name='item') then Exit(ProjectItemName('scglobe',aParam.Value));
  if (aID='history.found-item.lhglobe') and (aParam.Name='item') then Exit(ProjectItemName('lhglobe',aParam.Value));
  if (aID='history.found-item.msglobe') and (aParam.Name='item') then Exit(ProjectItemName('msglobe',aParam.Value));
  if (aID='history.found-item.map') and (aParam.Name='item') then Exit(ProjectItemName('map',aParam.Value));
  if (aID='history.found-item.pmap') and (aParam.Name='item') then Exit(ProjectItemName('pmap',aParam.Value));
  if (aID='history.found-item.gpack') and (aParam.Name='item') then Exit(ProjectItemName('gpack',aParam.Value));
  if (aID='history.found-item.backpack') and (aParam.Name='item') then Exit(ProjectItemName('backpack',aParam.Value));
  if (aID='history.found-item.ashard') and (aParam.Name='item') then Exit(ProjectItemName('ashard',aParam.Value));
  if (aID='history.found-item.ammo') and (aParam.Name='item') then Exit(ProjectItemName('ammo',aParam.Value));
  if (aID='history.found-item.shell') and (aParam.Name='item') then Exit(ProjectItemName('shell',aParam.Value));
  if (aID='history.found-item.rocket') and (aParam.Name='item') then Exit(ProjectItemName('rocket',aParam.Value));
  if (aID='history.found-item.cell') and (aParam.Name='item') then Exit(ProjectItemName('cell',aParam.Value));
  if (aID='history.found-item.pammo') and (aParam.Name='item') then Exit(ProjectItemName('pammo',aParam.Value));
  if (aID='history.found-item.pshell') and (aParam.Name='item') then Exit(ProjectItemName('pshell',aParam.Value));
  if (aID='history.found-item.procket') and (aParam.Name='item') then Exit(ProjectItemName('procket',aParam.Value));
  if (aID='history.found-item.pcell') and (aParam.Name='item') then Exit(ProjectItemName('pcell',aParam.Value));
  if (aID='history.found-item.pistol') and (aParam.Name='item') then Exit(ProjectItemName('pistol',aParam.Value));
  if (aID='history.found-item.shotgun') and (aParam.Name='item') then Exit(ProjectItemName('shotgun',aParam.Value));
  if (aID='history.found-item.dshotgun') and (aParam.Name='item') then Exit(ProjectItemName('dshotgun',aParam.Value));
  if (aID='history.found-item.ashotgun') and (aParam.Name='item') then Exit(ProjectItemName('ashotgun',aParam.Value));
  if (aID='history.found-item.bazooka') and (aParam.Name='item') then Exit(ProjectItemName('bazooka',aParam.Value));
  if (aID='history.found-item.chaingun') and (aParam.Name='item') then Exit(ProjectItemName('chaingun',aParam.Value));
  if (aID='history.found-item.plasma') and (aParam.Name='item') then Exit(ProjectItemName('plasma',aParam.Value));
  if (aID='history.found-item.smed') and (aParam.Name='item') then Exit(ProjectItemName('smed',aParam.Value));
  if (aID='history.found-item.lmed') and (aParam.Name='item') then Exit(ProjectItemName('lmed',aParam.Value));
  if (aID='history.found-item.phase') and (aParam.Name='item') then Exit(ProjectItemName('phase',aParam.Value));
  if (aID='history.found-item.hphase') and (aParam.Name='item') then Exit(ProjectItemName('hphase',aParam.Value));
  if (aID='history.found-item.epack') and (aParam.Name='item') then Exit(ProjectItemName('epack',aParam.Value));
  if (aID='history.found-item.nuke') and (aParam.Name='item') then Exit(ProjectItemName('nuke',aParam.Value));
  if (aID='history.found-item.mod-power') and (aParam.Name='item') then Exit(ProjectItemName('mod_power',aParam.Value));
  if (aID='history.found-item.mod-tech') and (aParam.Name='item') then Exit(ProjectItemName('mod_tech',aParam.Value));
  if (aID='history.found-item.mod-agility') and (aParam.Name='item') then Exit(ProjectItemName('mod_agility',aParam.Value));
  if (aID='history.found-item.mod-bulk') and (aParam.Name='item') then Exit(ProjectItemName('mod_bulk',aParam.Value));
  if (aID='history.found-item.barrel') and (aParam.Name='item') then Exit(ProjectItemName('barrel',aParam.Value));
  if (aID='history.found-item.barrela') and (aParam.Name='item') then Exit(ProjectItemName('barrela',aParam.Value));
  if (aID='history.found-item.barreln') and (aParam.Name='item') then Exit(ProjectItemName('barreln',aParam.Value));
  if (aID='history.found-item.tree') and (aParam.Name='item') then Exit(ProjectItemName('tree',aParam.Value));
  if (aID='history.found-item.lever-flood-water') and (aParam.Name='item') then Exit(ProjectItemName('lever_flood_water',aParam.Value));
  if (aID='history.found-item.lever-flood-acid') and (aParam.Name='item') then Exit(ProjectItemName('lever_flood_acid',aParam.Value));
  if (aID='history.found-item.lever-flood-lava') and (aParam.Name='item') then Exit(ProjectItemName('lever_flood_lava',aParam.Value));
  if (aID='history.found-item.lever-kill') and (aParam.Name='item') then Exit(ProjectItemName('lever_kill',aParam.Value));
  if (aID='history.found-item.lever-explode') and (aParam.Name='item') then Exit(ProjectItemName('lever_explode',aParam.Value));
  if (aID='history.found-item.lever-walls') and (aParam.Name='item') then Exit(ProjectItemName('lever_walls',aParam.Value));
  if (aID='history.found-item.lever-summon') and (aParam.Name='item') then Exit(ProjectItemName('lever_summon',aParam.Value));
  if (aID='history.found-item.lever-repair') and (aParam.Name='item') then Exit(ProjectItemName('lever_repair',aParam.Value));
  if (aID='history.found-item.lever-medical') and (aParam.Name='item') then Exit(ProjectItemName('lever_medical',aParam.Value));
  if (aID='history.found-item.lever-ammo') and (aParam.Name='item') then Exit(ProjectItemName('lever_ammo',aParam.Value));
  if (aID='history.found-item.schematic-0') and (aParam.Name='item') then Exit(ProjectItemName('schematic_0',aParam.Value));
  if (aID='history.found-item.schematic-1') and (aParam.Name='item') then Exit(ProjectItemName('schematic_1',aParam.Value));
  if (aID='history.found-item.schematic-2') and (aParam.Name='item') then Exit(ProjectItemName('schematic_2',aParam.Value));
  if (aID='history.found-item.lava-element') and (aParam.Name='item') then Exit(ProjectItemName('lava_element',aParam.Value));
  if (aID='history.found-item.unullpointer') and (aParam.Name='item') then Exit(ProjectItemName('unullpointer',aParam.Value));
  if (aID='history.found-item.umodstaff') and (aParam.Name='item') then Exit(ProjectItemName('umodstaff',aParam.Value));
  if (aID='history.found-item.ubutcher') and (aParam.Name='item') then Exit(ProjectItemName('ubutcher',aParam.Value));
  if (aID='history.found-item.umjoll') and (aParam.Name='item') then Exit(ProjectItemName('umjoll',aParam.Value));
  if (aID='history.found-item.usubtle') and (aParam.Name='item') then Exit(ProjectItemName('usubtle',aParam.Value));
  if (aID='history.found-item.utrigun') and (aParam.Name='item') then Exit(ProjectItemName('utrigun',aParam.Value));
  if (aID='history.found-item.ujackal') and (aParam.Name='item') then Exit(ProjectItemName('ujackal',aParam.Value));
  if (aID='history.found-item.umega') and (aParam.Name='item') then Exit(ProjectItemName('umega',aParam.Value));
  if (aID='history.found-item.uberetta') and (aParam.Name='item') then Exit(ProjectItemName('uberetta',aParam.Value));
  if (aID='history.found-item.usjack') and (aParam.Name='item') then Exit(ProjectItemName('usjack',aParam.Value));
  if (aID='history.found-item.ufshotgun') and (aParam.Name='item') then Exit(ProjectItemName('ufshotgun',aParam.Value));
  if (aID='history.found-item.urbazooka') and (aParam.Name='item') then Exit(ProjectItemName('urbazooka',aParam.Value));
  if (aID='history.found-item.uacid') and (aParam.Name='item') then Exit(ProjectItemName('uacid',aParam.Value));
  if (aID='history.found-item.ubfg10k') and (aParam.Name='item') then Exit(ProjectItemName('ubfg10k',aParam.Value));
  if (aID='history.found-item.urailgun') and (aParam.Name='item') then Exit(ProjectItemName('urailgun',aParam.Value));
  if (aID='history.found-item.umarmor') and (aParam.Name='item') then Exit(ProjectItemName('umarmor',aParam.Value));
  if (aID='history.found-item.ucarmor') and (aParam.Name='item') then Exit(ProjectItemName('ucarmor',aParam.Value));
  if (aID='history.found-item.unarmor') and (aParam.Name='item') then Exit(ProjectItemName('unarmor',aParam.Value));
  if (aID='history.found-item.umedparmor') and (aParam.Name='item') then Exit(ProjectItemName('umedparmor',aParam.Value));
  if (aID='history.found-item.ulavaarmor') and (aParam.Name='item') then Exit(ProjectItemName('ulavaarmor',aParam.Value));
  if (aID='history.found-item.uenviroboots') and (aParam.Name='item') then Exit(ProjectItemName('uenviroboots',aParam.Value));
  if (aID='history.found-item.unboots') and (aParam.Name='item') then Exit(ProjectItemName('unboots',aParam.Value));
  if (aID='history.found-item.ushieldarmor') and (aParam.Name='item') then Exit(ProjectItemName('ushieldarmor',aParam.Value));
  if (aID='history.found-item.uhwpack') and (aParam.Name='item') then Exit(ProjectItemName('uhwpack',aParam.Value));
  if (aID='history.found-item.aarmor') and (aParam.Name='item') then Exit(ProjectItemName('aarmor',aParam.Value));
  if (aID='history.found-item.uberarmor') and (aParam.Name='item') then Exit(ProjectItemName('uberarmor',aParam.Value));
  if (aID='history.found-item.udragon') and (aParam.Name='item') then Exit(ProjectItemName('udragon',aParam.Value));
  if (aID='history.found-item.lever-spec3') and (aParam.Name='item') then Exit(ProjectItemName('lever_spec3',aParam.Value));
  if (aID='history.found-item.hellportal') and (aParam.Name='item') then Exit(ProjectItemName('hellportal',aParam.Value));
  if (aID='history.found-item.dis-switch') and (aParam.Name='item') then Exit(ProjectItemName('dis_switch',aParam.Value));
  if (aID='history.found-item.lever-centralprocessing1') and (aParam.Name='item') then Exit(ProjectItemName('lever_centralprocessing1',aParam.Value));
  if (aID='history.found-item.lever-centralprocessing2') and (aParam.Name='item') then Exit(ProjectItemName('lever_centralprocessing2',aParam.Value));
  if (aID='history.found-item.lever-centralprocessing3') and (aParam.Name='item') then Exit(ProjectItemName('lever_centralprocessing3',aParam.Value));
  if (aID='history.found-item.lever-centralprocessing4') and (aParam.Name='item') then Exit(ProjectItemName('lever_centralprocessing4',aParam.Value));
  if (aID='history.found-item.lever-centralprocessing5') and (aParam.Name='item') then Exit(ProjectItemName('lever_centralprocessing5',aParam.Value));
  if (aID='history.found-item.uarenastaff') and (aParam.Name='item') then Exit(ProjectItemName('uarenastaff',aParam.Value));
  if (aID='history.found-item.lever-chain1') and (aParam.Name='item') then Exit(ProjectItemName('lever_chain1',aParam.Value));
  if (aID='history.found-item.lever-chain2') and (aParam.Name='item') then Exit(ProjectItemName('lever_chain2',aParam.Value));
  if (aID='history.found-item.lever-chain3') and (aParam.Name='item') then Exit(ProjectItemName('lever_chain3',aParam.Value));
  if (aID='history.found-item.lever-deimoslab') and (aParam.Name='item') then Exit(ProjectItemName('lever_deimoslab',aParam.Value));
  if (aID='history.found-item.spear') and (aParam.Name='item') then Exit(ProjectItemName('spear',aParam.Value));
  if (aID='history.found-item.uscythe') and (aParam.Name='item') then Exit(ProjectItemName('uscythe',aParam.Value));
  if (aID='history.found-item.lever-limbow') and (aParam.Name='item') then Exit(ProjectItemName('lever_limbow',aParam.Value));
  if (aID='history.found-item.lever-limboe') and (aParam.Name='item') then Exit(ProjectItemName('lever_limboe',aParam.Value));
  if (aID='history.found-item.lever-erebus') and (aParam.Name='item') then Exit(ProjectItemName('lever_erebus',aParam.Value));
  if (aID='history.found-item.lever-phoboslab1') and (aParam.Name='item') then Exit(ProjectItemName('lever_phoboslab1',aParam.Value));
  if (aID='history.found-item.lever-phoboslab2') and (aParam.Name='item') then Exit(ProjectItemName('lever_phoboslab2',aParam.Value));
  if (aID='history.found-item.lever-toxinrefinery1') and (aParam.Name='item') then Exit(ProjectItemName('lever_toxinrefinery1',aParam.Value));
  if (aID='history.found-item.lever-toxinrefinery2') and (aParam.Name='item') then Exit(ProjectItemName('lever_toxinrefinery2',aParam.Value));
  if (aID='history.found-item.lever-toxinrefinery3') and (aParam.Name='item') then Exit(ProjectItemName('lever_toxinrefinery3',aParam.Value));
  if (aID='history.found-item.stubitem') and (aParam.Name='item') then Exit(ProjectItemName('stubitem',aParam.Value));
  if (aID='history.found-item.teleport') and (aParam.Name='item') then Exit(ProjectItemName('teleport',aParam.Value));
  if (aID='history.found-item.nat-imp') and (aParam.Name='item') then Exit(ProjectItemName('nat_imp',aParam.Value));
  if (aID='history.found-item.nat-cacodemon') and (aParam.Name='item') then Exit(ProjectItemName('nat_cacodemon',aParam.Value));
  if (aID='history.found-item.nat-knight') and (aParam.Name='item') then Exit(ProjectItemName('nat_knight',aParam.Value));
  if (aID='history.found-item.nat-baron') and (aParam.Name='item') then Exit(ProjectItemName('nat_baron',aParam.Value));
  if (aID='history.found-item.nat-arachno') and (aParam.Name='item') then Exit(ProjectItemName('nat_arachno',aParam.Value));
  if (aID='history.found-item.nat-revenant') and (aParam.Name='item') then Exit(ProjectItemName('nat_revenant',aParam.Value));
  if (aID='history.found-item.nat-mancubus') and (aParam.Name='item') then Exit(ProjectItemName('nat_mancubus',aParam.Value));
  if (aID='history.found-item.nat-arch') and (aParam.Name='item') then Exit(ProjectItemName('nat_arch',aParam.Value));
  if (aID='history.found-item.nat-nimp') and (aParam.Name='item') then Exit(ProjectItemName('nat_nimp',aParam.Value));
  if (aID='history.found-item.nat-ncacodemon') and (aParam.Name='item') then Exit(ProjectItemName('nat_ncacodemon',aParam.Value));
  if (aID='history.found-item.nat-nknight') and (aParam.Name='item') then Exit(ProjectItemName('nat_nknight',aParam.Value));
  if (aID='history.found-item.nat-narachno') and (aParam.Name='item') then Exit(ProjectItemName('nat_narachno',aParam.Value));
  if (aID='history.found-item.nat-nrevenant') and (aParam.Name='item') then Exit(ProjectItemName('nat_nrevenant',aParam.Value));
  if (aID='history.found-item.nat-nmancubus') and (aParam.Name='item') then Exit(ProjectItemName('nat_nmancubus',aParam.Value));
  if (aID='history.found-item.nat-narch') and (aParam.Name='item') then Exit(ProjectItemName('nat_narch',aParam.Value));
  if (aID='history.found-item.nat-bruiser') and (aParam.Name='item') then Exit(ProjectItemName('nat_bruiser',aParam.Value));
  if (aID='history.found-item.nat-shambler') and (aParam.Name='item') then Exit(ProjectItemName('nat_shambler',aParam.Value));
  if (aID='history.found-item.nat-lava-elemental') and (aParam.Name='item') then Exit(ProjectItemName('nat_lava_elemental',aParam.Value));
  if (aID='history.found-item.nat-mastermind') and (aParam.Name='item') then Exit(ProjectItemName('nat_mastermind',aParam.Value));
  if (aID='history.found-item.nat-apostle') and (aParam.Name='item') then Exit(ProjectItemName('nat_apostle',aParam.Value));
  if (aID='history.found-item.nat-arenamaster') and (aParam.Name='item') then Exit(ProjectItemName('nat_arenamaster',aParam.Value));
  if (aID='history.overloaded-item.chainsaw') and (aParam.Name='item') then Exit(ProjectItemName('chainsaw',aParam.Value));
  if (aID='history.overloaded-item.bfg9000') and (aParam.Name='item') then Exit(ProjectItemName('bfg9000',aParam.Value));
  if (aID='history.overloaded-item.ublaster') and (aParam.Name='item') then Exit(ProjectItemName('ublaster',aParam.Value));
  if (aID='history.overloaded-item.ucpistol') and (aParam.Name='item') then Exit(ProjectItemName('ucpistol',aParam.Value));
  if (aID='history.overloaded-item.uashotgun') and (aParam.Name='item') then Exit(ProjectItemName('uashotgun',aParam.Value));
  if (aID='history.overloaded-item.upshotgun') and (aParam.Name='item') then Exit(ProjectItemName('upshotgun',aParam.Value));
  if (aID='history.overloaded-item.udshotgun') and (aParam.Name='item') then Exit(ProjectItemName('udshotgun',aParam.Value));
  if (aID='history.overloaded-item.ulaser') and (aParam.Name='item') then Exit(ProjectItemName('ulaser',aParam.Value));
  if (aID='history.overloaded-item.utristar') and (aParam.Name='item') then Exit(ProjectItemName('utristar',aParam.Value));
  if (aID='history.overloaded-item.uminigun') and (aParam.Name='item') then Exit(ProjectItemName('uminigun',aParam.Value));
  if (aID='history.overloaded-item.umbazooka') and (aParam.Name='item') then Exit(ProjectItemName('umbazooka',aParam.Value));
  if (aID='history.overloaded-item.unplasma') and (aParam.Name='item') then Exit(ProjectItemName('unplasma',aParam.Value));
  if (aID='history.overloaded-item.unbfg9000') and (aParam.Name='item') then Exit(ProjectItemName('unbfg9000',aParam.Value));
  if (aID='history.overloaded-item.utrans') and (aParam.Name='item') then Exit(ProjectItemName('utrans',aParam.Value));
  if (aID='history.overloaded-item.unapalm') and (aParam.Name='item') then Exit(ProjectItemName('unapalm',aParam.Value));
  if (aID='history.overloaded-item.uoarmor') and (aParam.Name='item') then Exit(ProjectItemName('uoarmor',aParam.Value));
  if (aID='history.overloaded-item.uparmor') and (aParam.Name='item') then Exit(ProjectItemName('uparmor',aParam.Value));
  if (aID='history.overloaded-item.upboots') and (aParam.Name='item') then Exit(ProjectItemName('upboots',aParam.Value));
  if (aID='history.overloaded-item.ugarmor') and (aParam.Name='item') then Exit(ProjectItemName('ugarmor',aParam.Value));
  if (aID='history.overloaded-item.ugboots') and (aParam.Name='item') then Exit(ProjectItemName('ugboots',aParam.Value));
  if (aID='history.overloaded-item.umedarmor') and (aParam.Name='item') then Exit(ProjectItemName('umedarmor',aParam.Value));
  if (aID='history.overloaded-item.uduelarmor') and (aParam.Name='item') then Exit(ProjectItemName('uduelarmor',aParam.Value));
  if (aID='history.overloaded-item.ubulletarmor') and (aParam.Name='item') then Exit(ProjectItemName('ubulletarmor',aParam.Value));
  if (aID='history.overloaded-item.uballisticarmor') and (aParam.Name='item') then Exit(ProjectItemName('uballisticarmor',aParam.Value));
  if (aID='history.overloaded-item.ueshieldarmor') and (aParam.Name='item') then Exit(ProjectItemName('ueshieldarmor',aParam.Value));
  if (aID='history.overloaded-item.uplasmashield') and (aParam.Name='item') then Exit(ProjectItemName('uplasmashield',aParam.Value));
  if (aID='history.overloaded-item.uenergyshield') and (aParam.Name='item') then Exit(ProjectItemName('uenergyshield',aParam.Value));
  if (aID='history.overloaded-item.ubalshield') and (aParam.Name='item') then Exit(ProjectItemName('ubalshield',aParam.Value));
  if (aID='history.overloaded-item.uacidboots') and (aParam.Name='item') then Exit(ProjectItemName('uacidboots',aParam.Value));
  if (aID='history.overloaded-item.ubloodboots') and (aParam.Name='item') then Exit(ProjectItemName('ubloodboots',aParam.Value));
  if (aID='history.overloaded-item.umod-firestorm') and (aParam.Name='item') then Exit(ProjectItemName('umod_firestorm',aParam.Value));
  if (aID='history.overloaded-item.umod-sniper') and (aParam.Name='item') then Exit(ProjectItemName('umod_sniper',aParam.Value));
  if (aID='history.overloaded-item.umod-nano') and (aParam.Name='item') then Exit(ProjectItemName('umod_nano',aParam.Value));
  if (aID='history.overloaded-item.umod-onyx') and (aParam.Name='item') then Exit(ProjectItemName('umod_onyx',aParam.Value));
  if (aID='history.overloaded-item.uswpack') and (aParam.Name='item') then Exit(ProjectItemName('uswpack',aParam.Value));
  if (aID='history.overloaded-item.ubskull') and (aParam.Name='item') then Exit(ProjectItemName('ubskull',aParam.Value));
  if (aID='history.overloaded-item.ufskull') and (aParam.Name='item') then Exit(ProjectItemName('ufskull',aParam.Value));
  if (aID='history.overloaded-item.uhskull') and (aParam.Name='item') then Exit(ProjectItemName('uhskull',aParam.Value));
  if (aID='history.overloaded-item.knife') and (aParam.Name='item') then Exit(ProjectItemName('knife',aParam.Value));
  if (aID='history.overloaded-item.garmor') and (aParam.Name='item') then Exit(ProjectItemName('garmor',aParam.Value));
  if (aID='history.overloaded-item.barmor') and (aParam.Name='item') then Exit(ProjectItemName('barmor',aParam.Value));
  if (aID='history.overloaded-item.rarmor') and (aParam.Name='item') then Exit(ProjectItemName('rarmor',aParam.Value));
  if (aID='history.overloaded-item.sboots') and (aParam.Name='item') then Exit(ProjectItemName('sboots',aParam.Value));
  if (aID='history.overloaded-item.pboots') and (aParam.Name='item') then Exit(ProjectItemName('pboots',aParam.Value));
  if (aID='history.overloaded-item.psboots') and (aParam.Name='item') then Exit(ProjectItemName('psboots',aParam.Value));
  if (aID='history.overloaded-item.shglobe') and (aParam.Name='item') then Exit(ProjectItemName('shglobe',aParam.Value));
  if (aID='history.overloaded-item.bpack') and (aParam.Name='item') then Exit(ProjectItemName('bpack',aParam.Value));
  if (aID='history.overloaded-item.iglobe') and (aParam.Name='item') then Exit(ProjectItemName('iglobe',aParam.Value));
  if (aID='history.overloaded-item.scglobe') and (aParam.Name='item') then Exit(ProjectItemName('scglobe',aParam.Value));
  if (aID='history.overloaded-item.lhglobe') and (aParam.Name='item') then Exit(ProjectItemName('lhglobe',aParam.Value));
  if (aID='history.overloaded-item.msglobe') and (aParam.Name='item') then Exit(ProjectItemName('msglobe',aParam.Value));
  if (aID='history.overloaded-item.map') and (aParam.Name='item') then Exit(ProjectItemName('map',aParam.Value));
  if (aID='history.overloaded-item.pmap') and (aParam.Name='item') then Exit(ProjectItemName('pmap',aParam.Value));
  if (aID='history.overloaded-item.gpack') and (aParam.Name='item') then Exit(ProjectItemName('gpack',aParam.Value));
  if (aID='history.overloaded-item.backpack') and (aParam.Name='item') then Exit(ProjectItemName('backpack',aParam.Value));
  if (aID='history.overloaded-item.ashard') and (aParam.Name='item') then Exit(ProjectItemName('ashard',aParam.Value));
  if (aID='history.overloaded-item.ammo') and (aParam.Name='item') then Exit(ProjectItemName('ammo',aParam.Value));
  if (aID='history.overloaded-item.shell') and (aParam.Name='item') then Exit(ProjectItemName('shell',aParam.Value));
  if (aID='history.overloaded-item.rocket') and (aParam.Name='item') then Exit(ProjectItemName('rocket',aParam.Value));
  if (aID='history.overloaded-item.cell') and (aParam.Name='item') then Exit(ProjectItemName('cell',aParam.Value));
  if (aID='history.overloaded-item.pammo') and (aParam.Name='item') then Exit(ProjectItemName('pammo',aParam.Value));
  if (aID='history.overloaded-item.pshell') and (aParam.Name='item') then Exit(ProjectItemName('pshell',aParam.Value));
  if (aID='history.overloaded-item.procket') and (aParam.Name='item') then Exit(ProjectItemName('procket',aParam.Value));
  if (aID='history.overloaded-item.pcell') and (aParam.Name='item') then Exit(ProjectItemName('pcell',aParam.Value));
  if (aID='history.overloaded-item.pistol') and (aParam.Name='item') then Exit(ProjectItemName('pistol',aParam.Value));
  if (aID='history.overloaded-item.shotgun') and (aParam.Name='item') then Exit(ProjectItemName('shotgun',aParam.Value));
  if (aID='history.overloaded-item.dshotgun') and (aParam.Name='item') then Exit(ProjectItemName('dshotgun',aParam.Value));
  if (aID='history.overloaded-item.ashotgun') and (aParam.Name='item') then Exit(ProjectItemName('ashotgun',aParam.Value));
  if (aID='history.overloaded-item.bazooka') and (aParam.Name='item') then Exit(ProjectItemName('bazooka',aParam.Value));
  if (aID='history.overloaded-item.chaingun') and (aParam.Name='item') then Exit(ProjectItemName('chaingun',aParam.Value));
  if (aID='history.overloaded-item.plasma') and (aParam.Name='item') then Exit(ProjectItemName('plasma',aParam.Value));
  if (aID='history.overloaded-item.smed') and (aParam.Name='item') then Exit(ProjectItemName('smed',aParam.Value));
  if (aID='history.overloaded-item.lmed') and (aParam.Name='item') then Exit(ProjectItemName('lmed',aParam.Value));
  if (aID='history.overloaded-item.phase') and (aParam.Name='item') then Exit(ProjectItemName('phase',aParam.Value));
  if (aID='history.overloaded-item.hphase') and (aParam.Name='item') then Exit(ProjectItemName('hphase',aParam.Value));
  if (aID='history.overloaded-item.epack') and (aParam.Name='item') then Exit(ProjectItemName('epack',aParam.Value));
  if (aID='history.overloaded-item.nuke') and (aParam.Name='item') then Exit(ProjectItemName('nuke',aParam.Value));
  if (aID='history.overloaded-item.mod-power') and (aParam.Name='item') then Exit(ProjectItemName('mod_power',aParam.Value));
  if (aID='history.overloaded-item.mod-tech') and (aParam.Name='item') then Exit(ProjectItemName('mod_tech',aParam.Value));
  if (aID='history.overloaded-item.mod-agility') and (aParam.Name='item') then Exit(ProjectItemName('mod_agility',aParam.Value));
  if (aID='history.overloaded-item.mod-bulk') and (aParam.Name='item') then Exit(ProjectItemName('mod_bulk',aParam.Value));
  if (aID='history.overloaded-item.barrel') and (aParam.Name='item') then Exit(ProjectItemName('barrel',aParam.Value));
  if (aID='history.overloaded-item.barrela') and (aParam.Name='item') then Exit(ProjectItemName('barrela',aParam.Value));
  if (aID='history.overloaded-item.barreln') and (aParam.Name='item') then Exit(ProjectItemName('barreln',aParam.Value));
  if (aID='history.overloaded-item.tree') and (aParam.Name='item') then Exit(ProjectItemName('tree',aParam.Value));
  if (aID='history.overloaded-item.lever-flood-water') and (aParam.Name='item') then Exit(ProjectItemName('lever_flood_water',aParam.Value));
  if (aID='history.overloaded-item.lever-flood-acid') and (aParam.Name='item') then Exit(ProjectItemName('lever_flood_acid',aParam.Value));
  if (aID='history.overloaded-item.lever-flood-lava') and (aParam.Name='item') then Exit(ProjectItemName('lever_flood_lava',aParam.Value));
  if (aID='history.overloaded-item.lever-kill') and (aParam.Name='item') then Exit(ProjectItemName('lever_kill',aParam.Value));
  if (aID='history.overloaded-item.lever-explode') and (aParam.Name='item') then Exit(ProjectItemName('lever_explode',aParam.Value));
  if (aID='history.overloaded-item.lever-walls') and (aParam.Name='item') then Exit(ProjectItemName('lever_walls',aParam.Value));
  if (aID='history.overloaded-item.lever-summon') and (aParam.Name='item') then Exit(ProjectItemName('lever_summon',aParam.Value));
  if (aID='history.overloaded-item.lever-repair') and (aParam.Name='item') then Exit(ProjectItemName('lever_repair',aParam.Value));
  if (aID='history.overloaded-item.lever-medical') and (aParam.Name='item') then Exit(ProjectItemName('lever_medical',aParam.Value));
  if (aID='history.overloaded-item.lever-ammo') and (aParam.Name='item') then Exit(ProjectItemName('lever_ammo',aParam.Value));
  if (aID='history.overloaded-item.schematic-0') and (aParam.Name='item') then Exit(ProjectItemName('schematic_0',aParam.Value));
  if (aID='history.overloaded-item.schematic-1') and (aParam.Name='item') then Exit(ProjectItemName('schematic_1',aParam.Value));
  if (aID='history.overloaded-item.schematic-2') and (aParam.Name='item') then Exit(ProjectItemName('schematic_2',aParam.Value));
  if (aID='history.overloaded-item.lava-element') and (aParam.Name='item') then Exit(ProjectItemName('lava_element',aParam.Value));
  if (aID='history.overloaded-item.unullpointer') and (aParam.Name='item') then Exit(ProjectItemName('unullpointer',aParam.Value));
  if (aID='history.overloaded-item.umodstaff') and (aParam.Name='item') then Exit(ProjectItemName('umodstaff',aParam.Value));
  if (aID='history.overloaded-item.ubutcher') and (aParam.Name='item') then Exit(ProjectItemName('ubutcher',aParam.Value));
  if (aID='history.overloaded-item.umjoll') and (aParam.Name='item') then Exit(ProjectItemName('umjoll',aParam.Value));
  if (aID='history.overloaded-item.usubtle') and (aParam.Name='item') then Exit(ProjectItemName('usubtle',aParam.Value));
  if (aID='history.overloaded-item.utrigun') and (aParam.Name='item') then Exit(ProjectItemName('utrigun',aParam.Value));
  if (aID='history.overloaded-item.ujackal') and (aParam.Name='item') then Exit(ProjectItemName('ujackal',aParam.Value));
  if (aID='history.overloaded-item.umega') and (aParam.Name='item') then Exit(ProjectItemName('umega',aParam.Value));
  if (aID='history.overloaded-item.uberetta') and (aParam.Name='item') then Exit(ProjectItemName('uberetta',aParam.Value));
  if (aID='history.overloaded-item.usjack') and (aParam.Name='item') then Exit(ProjectItemName('usjack',aParam.Value));
  if (aID='history.overloaded-item.ufshotgun') and (aParam.Name='item') then Exit(ProjectItemName('ufshotgun',aParam.Value));
  if (aID='history.overloaded-item.urbazooka') and (aParam.Name='item') then Exit(ProjectItemName('urbazooka',aParam.Value));
  if (aID='history.overloaded-item.uacid') and (aParam.Name='item') then Exit(ProjectItemName('uacid',aParam.Value));
  if (aID='history.overloaded-item.ubfg10k') and (aParam.Name='item') then Exit(ProjectItemName('ubfg10k',aParam.Value));
  if (aID='history.overloaded-item.urailgun') and (aParam.Name='item') then Exit(ProjectItemName('urailgun',aParam.Value));
  if (aID='history.overloaded-item.umarmor') and (aParam.Name='item') then Exit(ProjectItemName('umarmor',aParam.Value));
  if (aID='history.overloaded-item.ucarmor') and (aParam.Name='item') then Exit(ProjectItemName('ucarmor',aParam.Value));
  if (aID='history.overloaded-item.unarmor') and (aParam.Name='item') then Exit(ProjectItemName('unarmor',aParam.Value));
  if (aID='history.overloaded-item.umedparmor') and (aParam.Name='item') then Exit(ProjectItemName('umedparmor',aParam.Value));
  if (aID='history.overloaded-item.ulavaarmor') and (aParam.Name='item') then Exit(ProjectItemName('ulavaarmor',aParam.Value));
  if (aID='history.overloaded-item.uenviroboots') and (aParam.Name='item') then Exit(ProjectItemName('uenviroboots',aParam.Value));
  if (aID='history.overloaded-item.unboots') and (aParam.Name='item') then Exit(ProjectItemName('unboots',aParam.Value));
  if (aID='history.overloaded-item.ushieldarmor') and (aParam.Name='item') then Exit(ProjectItemName('ushieldarmor',aParam.Value));
  if (aID='history.overloaded-item.uhwpack') and (aParam.Name='item') then Exit(ProjectItemName('uhwpack',aParam.Value));
  if (aID='history.overloaded-item.aarmor') and (aParam.Name='item') then Exit(ProjectItemName('aarmor',aParam.Value));
  if (aID='history.overloaded-item.uberarmor') and (aParam.Name='item') then Exit(ProjectItemName('uberarmor',aParam.Value));
  if (aID='history.overloaded-item.udragon') and (aParam.Name='item') then Exit(ProjectItemName('udragon',aParam.Value));
  if (aID='history.overloaded-item.lever-spec3') and (aParam.Name='item') then Exit(ProjectItemName('lever_spec3',aParam.Value));
  if (aID='history.overloaded-item.hellportal') and (aParam.Name='item') then Exit(ProjectItemName('hellportal',aParam.Value));
  if (aID='history.overloaded-item.dis-switch') and (aParam.Name='item') then Exit(ProjectItemName('dis_switch',aParam.Value));
  if (aID='history.overloaded-item.lever-centralprocessing1') and (aParam.Name='item') then Exit(ProjectItemName('lever_centralprocessing1',aParam.Value));
  if (aID='history.overloaded-item.lever-centralprocessing2') and (aParam.Name='item') then Exit(ProjectItemName('lever_centralprocessing2',aParam.Value));
  if (aID='history.overloaded-item.lever-centralprocessing3') and (aParam.Name='item') then Exit(ProjectItemName('lever_centralprocessing3',aParam.Value));
  if (aID='history.overloaded-item.lever-centralprocessing4') and (aParam.Name='item') then Exit(ProjectItemName('lever_centralprocessing4',aParam.Value));
  if (aID='history.overloaded-item.lever-centralprocessing5') and (aParam.Name='item') then Exit(ProjectItemName('lever_centralprocessing5',aParam.Value));
  if (aID='history.overloaded-item.uarenastaff') and (aParam.Name='item') then Exit(ProjectItemName('uarenastaff',aParam.Value));
  if (aID='history.overloaded-item.lever-chain1') and (aParam.Name='item') then Exit(ProjectItemName('lever_chain1',aParam.Value));
  if (aID='history.overloaded-item.lever-chain2') and (aParam.Name='item') then Exit(ProjectItemName('lever_chain2',aParam.Value));
  if (aID='history.overloaded-item.lever-chain3') and (aParam.Name='item') then Exit(ProjectItemName('lever_chain3',aParam.Value));
  if (aID='history.overloaded-item.lever-deimoslab') and (aParam.Name='item') then Exit(ProjectItemName('lever_deimoslab',aParam.Value));
  if (aID='history.overloaded-item.spear') and (aParam.Name='item') then Exit(ProjectItemName('spear',aParam.Value));
  if (aID='history.overloaded-item.uscythe') and (aParam.Name='item') then Exit(ProjectItemName('uscythe',aParam.Value));
  if (aID='history.overloaded-item.lever-limbow') and (aParam.Name='item') then Exit(ProjectItemName('lever_limbow',aParam.Value));
  if (aID='history.overloaded-item.lever-limboe') and (aParam.Name='item') then Exit(ProjectItemName('lever_limboe',aParam.Value));
  if (aID='history.overloaded-item.lever-erebus') and (aParam.Name='item') then Exit(ProjectItemName('lever_erebus',aParam.Value));
  if (aID='history.overloaded-item.lever-phoboslab1') and (aParam.Name='item') then Exit(ProjectItemName('lever_phoboslab1',aParam.Value));
  if (aID='history.overloaded-item.lever-phoboslab2') and (aParam.Name='item') then Exit(ProjectItemName('lever_phoboslab2',aParam.Value));
  if (aID='history.overloaded-item.lever-toxinrefinery1') and (aParam.Name='item') then Exit(ProjectItemName('lever_toxinrefinery1',aParam.Value));
  if (aID='history.overloaded-item.lever-toxinrefinery2') and (aParam.Name='item') then Exit(ProjectItemName('lever_toxinrefinery2',aParam.Value));
  if (aID='history.overloaded-item.lever-toxinrefinery3') and (aParam.Name='item') then Exit(ProjectItemName('lever_toxinrefinery3',aParam.Value));
  if (aID='history.overloaded-item.stubitem') and (aParam.Name='item') then Exit(ProjectItemName('stubitem',aParam.Value));
  if (aID='history.overloaded-item.teleport') and (aParam.Name='item') then Exit(ProjectItemName('teleport',aParam.Value));
  if (aID='history.overloaded-item.nat-imp') and (aParam.Name='item') then Exit(ProjectItemName('nat_imp',aParam.Value));
  if (aID='history.overloaded-item.nat-cacodemon') and (aParam.Name='item') then Exit(ProjectItemName('nat_cacodemon',aParam.Value));
  if (aID='history.overloaded-item.nat-knight') and (aParam.Name='item') then Exit(ProjectItemName('nat_knight',aParam.Value));
  if (aID='history.overloaded-item.nat-baron') and (aParam.Name='item') then Exit(ProjectItemName('nat_baron',aParam.Value));
  if (aID='history.overloaded-item.nat-arachno') and (aParam.Name='item') then Exit(ProjectItemName('nat_arachno',aParam.Value));
  if (aID='history.overloaded-item.nat-revenant') and (aParam.Name='item') then Exit(ProjectItemName('nat_revenant',aParam.Value));
  if (aID='history.overloaded-item.nat-mancubus') and (aParam.Name='item') then Exit(ProjectItemName('nat_mancubus',aParam.Value));
  if (aID='history.overloaded-item.nat-arch') and (aParam.Name='item') then Exit(ProjectItemName('nat_arch',aParam.Value));
  if (aID='history.overloaded-item.nat-nimp') and (aParam.Name='item') then Exit(ProjectItemName('nat_nimp',aParam.Value));
  if (aID='history.overloaded-item.nat-ncacodemon') and (aParam.Name='item') then Exit(ProjectItemName('nat_ncacodemon',aParam.Value));
  if (aID='history.overloaded-item.nat-nknight') and (aParam.Name='item') then Exit(ProjectItemName('nat_nknight',aParam.Value));
  if (aID='history.overloaded-item.nat-narachno') and (aParam.Name='item') then Exit(ProjectItemName('nat_narachno',aParam.Value));
  if (aID='history.overloaded-item.nat-nrevenant') and (aParam.Name='item') then Exit(ProjectItemName('nat_nrevenant',aParam.Value));
  if (aID='history.overloaded-item.nat-nmancubus') and (aParam.Name='item') then Exit(ProjectItemName('nat_nmancubus',aParam.Value));
  if (aID='history.overloaded-item.nat-narch') and (aParam.Name='item') then Exit(ProjectItemName('nat_narch',aParam.Value));
  if (aID='history.overloaded-item.nat-bruiser') and (aParam.Name='item') then Exit(ProjectItemName('nat_bruiser',aParam.Value));
  if (aID='history.overloaded-item.nat-shambler') and (aParam.Name='item') then Exit(ProjectItemName('nat_shambler',aParam.Value));
  if (aID='history.overloaded-item.nat-lava-elemental') and (aParam.Name='item') then Exit(ProjectItemName('nat_lava_elemental',aParam.Value));
  if (aID='history.overloaded-item.nat-mastermind') and (aParam.Name='item') then Exit(ProjectItemName('nat_mastermind',aParam.Value));
  if (aID='history.overloaded-item.nat-apostle') and (aParam.Name='item') then Exit(ProjectItemName('nat_apostle',aParam.Value));
  if (aID='history.overloaded-item.nat-arenamaster') and (aParam.Name='item') then Exit(ProjectItemName('nat_arenamaster',aParam.Value));
  if (aID='history.assembled.chainsword') and (aParam.Name='assembly') then Exit(DRLRegistryText('mod_array','chainsword','base_game','name',aParam.Value));
  if (aID='history.assembled.pblade') and (aParam.Name='assembly') then Exit(DRLRegistryText('mod_array','pblade','base_game','name',aParam.Value));
  if (aID='history.assembled.speedloader') and (aParam.Name='assembly') then Exit(DRLRegistryText('mod_array','speedloader','base_game','name',aParam.Value));
  if (aID='history.assembled.elephant') and (aParam.Name='assembly') then Exit(DRLRegistryText('mod_array','elephant','base_game','name',aParam.Value));
  if (aID='history.assembled.gatling') and (aParam.Name='assembly') then Exit(DRLRegistryText('mod_array','gatling','base_game','name',aParam.Value));
  if (aID='history.assembled.micro') and (aParam.Name='assembly') then Exit(DRLRegistryText('mod_array','micro','base_game','name',aParam.Value));
  if (aID='history.assembled.tarmor') and (aParam.Name='assembly') then Exit(DRLRegistryText('mod_array','tarmor','base_game','name',aParam.Value));
  if (aID='history.assembled.tboots') and (aParam.Name='assembly') then Exit(DRLRegistryText('mod_array','tboots','base_game','name',aParam.Value));
  if (aID='history.assembled.nanofiber') and (aParam.Name='assembly') then Exit(DRLRegistryText('mod_array','nanofiber','base_game','name',aParam.Value));
  if (aID='history.assembled.high') and (aParam.Name='assembly') then Exit(DRLRegistryText('mod_array','high','base_game','name',aParam.Value));
  if (aID='history.assembled.power') and (aParam.Name='assembly') then Exit(DRLRegistryText('mod_array','power','base_game','name',aParam.Value));
  if (aID='history.assembled.tshotgun') and (aParam.Name='assembly') then Exit(DRLRegistryText('mod_array','tshotgun','base_game','name',aParam.Value));
  if (aID='history.assembled.plate') and (aParam.Name='assembly') then Exit(DRLRegistryText('mod_array','plate','base_game','name',aParam.Value));
  if (aID='history.assembled.fparmor') and (aParam.Name='assembly') then Exit(DRLRegistryText('mod_array','fparmor','base_game','name',aParam.Value));
  if (aID='history.assembled.fpboots') and (aParam.Name='assembly') then Exit(DRLRegistryText('mod_array','fpboots','base_game','name',aParam.Value));
  if (aID='history.assembled.balarmor') and (aParam.Name='assembly') then Exit(DRLRegistryText('mod_array','balarmor','base_game','name',aParam.Value));
  if (aID='history.assembled.plasmatic') and (aParam.Name='assembly') then Exit(DRLRegistryText('mod_array','plasmatic','base_game','name',aParam.Value));
  if (aID='history.assembled.gboots') and (aParam.Name='assembly') then Exit(DRLRegistryText('mod_array','gboots','base_game','name',aParam.Value));
  if (aID='history.assembled.grarmor') and (aParam.Name='assembly') then Exit(DRLRegistryText('mod_array','grarmor','base_game','name',aParam.Value));
  if (aID='history.assembled.lavboots') and (aParam.Name='assembly') then Exit(DRLRegistryText('mod_array','lavboots','base_game','name',aParam.Value));
  if (aID='history.assembled.double') and (aParam.Name='assembly') then Exit(DRLRegistryText('mod_array','double','base_game','name',aParam.Value));
  if (aID='history.assembled.tacticalrl') and (aParam.Name='assembly') then Exit(DRLRegistryText('mod_array','tacticalrl','base_game','name',aParam.Value));
  if (aID='history.assembled.storm') and (aParam.Name='assembly') then Exit(DRLRegistryText('mod_array','storm','base_game','name',aParam.Value));
  if (aID='history.assembled.rifle') and (aParam.Name='assembly') then Exit(DRLRegistryText('mod_array','rifle','base_game','name',aParam.Value));
  if (aID='history.assembled.energy') and (aParam.Name='assembly') then Exit(DRLRegistryText('mod_array','energy','base_game','name',aParam.Value));
  if (aID='history.assembled.assault') and (aParam.Name='assembly') then Exit(DRLRegistryText('mod_array','assault','base_game','name',aParam.Value));
  if (aID='history.assembled.vbfg9000') and (aParam.Name='assembly') then Exit(DRLRegistryText('mod_array','vbfg9000','base_game','name',aParam.Value));
  if (aID='history.assembled.envboots') and (aParam.Name='assembly') then Exit(DRLRegistryText('mod_array','envboots','base_game','name',aParam.Value));
  if (aID='history.assembled.fireshield') and (aParam.Name='assembly') then Exit(DRLRegistryText('mod_array','fireshield','base_game','name',aParam.Value));
  if (aID='history.assembled.nanoskin') and (aParam.Name='assembly') then Exit(DRLRegistryText('mod_array','nanoskin','base_game','name',aParam.Value));
  if (aID='history.assembled.gravity') and (aParam.Name='assembly') then Exit(DRLRegistryText('mod_array','gravity','base_game','name',aParam.Value));
  if (aID='history.assembled.hyperblaster') and (aParam.Name='assembly') then Exit(DRLRegistryText('mod_array','hyperblaster','base_game','name',aParam.Value));
  if (aID='history.assembled.fdshotgun') and (aParam.Name='assembly') then Exit(DRLRegistryText('mod_array','fdshotgun','base_game','name',aParam.Value));
  if (aID='history.assembled.nanomanufacture') and (aParam.Name='assembly') then Exit(DRLRegistryText('mod_array','nanomanufacture','base_game','name',aParam.Value));
  if (aID='history.assembled.nsharpnel') and (aParam.Name='assembly') then Exit(DRLRegistryText('mod_array','nsharpnel','base_game','name',aParam.Value));
  if (aID='history.assembled.demolition') and (aParam.Name='assembly') then Exit(DRLRegistryText('mod_array','demolition','base_game','name',aParam.Value));
  if (aID='history.assembled.cybernano') and (aParam.Name='assembly') then Exit(DRLRegistryText('mod_array','cybernano','base_game','name',aParam.Value));
  if (aID='history.assembled.biggest') and (aParam.Name='assembly') then Exit(DRLRegistryText('mod_array','biggest','base_game','name',aParam.Value));
  if (aID='history.assembled.ripper') and (aParam.Name='assembly') then Exit(DRLRegistryText('mod_array','ripper','base_game','name',aParam.Value));
  if (aID='history.assembled.cerboots') and (aParam.Name='assembly') then Exit(DRLRegistryText('mod_array','cerboots','base_game','name',aParam.Value));
  if (aID='history.assembled.cerarmor') and (aParam.Name='assembly') then Exit(DRLRegistryText('mod_array','cerarmor','base_game','name',aParam.Value));
  if (aID='history.assembled.mother') and (aParam.Name='assembly') then Exit(DRLRegistryText('mod_array','mother','base_game','name',aParam.Value));
  if (aID='history.monster-complex.former') and (aParam.Name='beings') then Exit(DRLRegistryText('being','former','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.sergeant') and (aParam.Name='beings') then Exit(DRLRegistryText('being','sergeant','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.captain') and (aParam.Name='beings') then Exit(DRLRegistryText('being','captain','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.commando') and (aParam.Name='beings') then Exit(DRLRegistryText('being','commando','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.imp') and (aParam.Name='beings') then Exit(DRLRegistryText('being','imp','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.demon') and (aParam.Name='beings') then Exit(DRLRegistryText('being','demon','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.lostsoul') and (aParam.Name='beings') then Exit(DRLRegistryText('being','lostsoul','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.cacodemon') and (aParam.Name='beings') then Exit(DRLRegistryText('being','cacodemon','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.knight') and (aParam.Name='beings') then Exit(DRLRegistryText('being','knight','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.baron') and (aParam.Name='beings') then Exit(DRLRegistryText('being','baron','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.arachno') and (aParam.Name='beings') then Exit(DRLRegistryText('being','arachno','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.pain') and (aParam.Name='beings') then Exit(DRLRegistryText('being','pain','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.revenant') and (aParam.Name='beings') then Exit(DRLRegistryText('being','revenant','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.mancubus') and (aParam.Name='beings') then Exit(DRLRegistryText('being','mancubus','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.arch') and (aParam.Name='beings') then Exit(DRLRegistryText('being','arch','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.eformer') and (aParam.Name='beings') then Exit(DRLRegistryText('being','eformer','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.esergeant') and (aParam.Name='beings') then Exit(DRLRegistryText('being','esergeant','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.ecaptain') and (aParam.Name='beings') then Exit(DRLRegistryText('being','ecaptain','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.ecommando') and (aParam.Name='beings') then Exit(DRLRegistryText('being','ecommando','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.nimp') and (aParam.Name='beings') then Exit(DRLRegistryText('being','nimp','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.ndemon') and (aParam.Name='beings') then Exit(DRLRegistryText('being','ndemon','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.nlostsoul') and (aParam.Name='beings') then Exit(DRLRegistryText('being','nlostsoul','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.ncacodemon') and (aParam.Name='beings') then Exit(DRLRegistryText('being','ncacodemon','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.nknight') and (aParam.Name='beings') then Exit(DRLRegistryText('being','nknight','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.narachno') and (aParam.Name='beings') then Exit(DRLRegistryText('being','narachno','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.npain') and (aParam.Name='beings') then Exit(DRLRegistryText('being','npain','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.nrevenant') and (aParam.Name='beings') then Exit(DRLRegistryText('being','nrevenant','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.nmancubus') and (aParam.Name='beings') then Exit(DRLRegistryText('being','nmancubus','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.narch') and (aParam.Name='beings') then Exit(DRLRegistryText('being','narch','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.bruiser') and (aParam.Name='beings') then Exit(DRLRegistryText('being','bruiser','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.shambler') and (aParam.Name='beings') then Exit(DRLRegistryText('being','shambler','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.lava-elemental') and (aParam.Name='beings') then Exit(DRLRegistryText('being','lava_elemental','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.agony') and (aParam.Name='beings') then Exit(DRLRegistryText('being','agony','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.angel') and (aParam.Name='beings') then Exit(DRLRegistryText('being','angel','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.cyberdemon') and (aParam.Name='beings') then Exit(DRLRegistryText('being','cyberdemon','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.mastermind') and (aParam.Name='beings') then Exit(DRLRegistryText('being','mastermind','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.jc') and (aParam.Name='beings') then Exit(DRLRegistryText('being','jc','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.apostle') and (aParam.Name='beings') then Exit(DRLRegistryText('being','apostle','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.arenamaster') and (aParam.Name='beings') then Exit(DRLRegistryText('being','arenamaster','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.soldier') and (aParam.Name='beings') then Exit(DRLRegistryText('being','soldier','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.former') and (aParam.Name='beings') then Exit(DRLRegistryText('being','former','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.sergeant') and (aParam.Name='beings') then Exit(DRLRegistryText('being','sergeant','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.captain') and (aParam.Name='beings') then Exit(DRLRegistryText('being','captain','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.commando') and (aParam.Name='beings') then Exit(DRLRegistryText('being','commando','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.imp') and (aParam.Name='beings') then Exit(DRLRegistryText('being','imp','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.demon') and (aParam.Name='beings') then Exit(DRLRegistryText('being','demon','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.lostsoul') and (aParam.Name='beings') then Exit(DRLRegistryText('being','lostsoul','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.cacodemon') and (aParam.Name='beings') then Exit(DRLRegistryText('being','cacodemon','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.knight') and (aParam.Name='beings') then Exit(DRLRegistryText('being','knight','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.baron') and (aParam.Name='beings') then Exit(DRLRegistryText('being','baron','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.arachno') and (aParam.Name='beings') then Exit(DRLRegistryText('being','arachno','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.pain') and (aParam.Name='beings') then Exit(DRLRegistryText('being','pain','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.revenant') and (aParam.Name='beings') then Exit(DRLRegistryText('being','revenant','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.mancubus') and (aParam.Name='beings') then Exit(DRLRegistryText('being','mancubus','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.arch') and (aParam.Name='beings') then Exit(DRLRegistryText('being','arch','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.eformer') and (aParam.Name='beings') then Exit(DRLRegistryText('being','eformer','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.esergeant') and (aParam.Name='beings') then Exit(DRLRegistryText('being','esergeant','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.ecaptain') and (aParam.Name='beings') then Exit(DRLRegistryText('being','ecaptain','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.ecommando') and (aParam.Name='beings') then Exit(DRLRegistryText('being','ecommando','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.nimp') and (aParam.Name='beings') then Exit(DRLRegistryText('being','nimp','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.ndemon') and (aParam.Name='beings') then Exit(DRLRegistryText('being','ndemon','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.nlostsoul') and (aParam.Name='beings') then Exit(DRLRegistryText('being','nlostsoul','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.ncacodemon') and (aParam.Name='beings') then Exit(DRLRegistryText('being','ncacodemon','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.nknight') and (aParam.Name='beings') then Exit(DRLRegistryText('being','nknight','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.narachno') and (aParam.Name='beings') then Exit(DRLRegistryText('being','narachno','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.npain') and (aParam.Name='beings') then Exit(DRLRegistryText('being','npain','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.nrevenant') and (aParam.Name='beings') then Exit(DRLRegistryText('being','nrevenant','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.nmancubus') and (aParam.Name='beings') then Exit(DRLRegistryText('being','nmancubus','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.narch') and (aParam.Name='beings') then Exit(DRLRegistryText('being','narch','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.bruiser') and (aParam.Name='beings') then Exit(DRLRegistryText('being','bruiser','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.shambler') and (aParam.Name='beings') then Exit(DRLRegistryText('being','shambler','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.lava-elemental') and (aParam.Name='beings') then Exit(DRLRegistryText('being','lava_elemental','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.agony') and (aParam.Name='beings') then Exit(DRLRegistryText('being','agony','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.angel') and (aParam.Name='beings') then Exit(DRLRegistryText('being','angel','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.cyberdemon') and (aParam.Name='beings') then Exit(DRLRegistryText('being','cyberdemon','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.mastermind') and (aParam.Name='beings') then Exit(DRLRegistryText('being','mastermind','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.jc') and (aParam.Name='beings') then Exit(DRLRegistryText('being','jc','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.apostle') and (aParam.Name='beings') then Exit(DRLRegistryText('being','apostle','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.arenamaster') and (aParam.Name='beings') then Exit(DRLRegistryText('being','arenamaster','base_game','name_plural',aParam.Value));
  if (aID='history.monster-complex.soldier') and (aParam.Name='beings') then Exit(DRLRegistryText('being','soldier','base_game','name_plural',aParam.Value));
  if (aID='history.found-item.chainsaw') and (aParam.Name='item') then Exit(DRLRegistryText('item','chainsaw','base_game','name',aParam.Value));
  if (aID='history.found-item.bfg9000') and (aParam.Name='item') then Exit(DRLRegistryText('item','bfg9000','base_game','name',aParam.Value));
  if (aID='history.found-item.ublaster') and (aParam.Name='item') then Exit(DRLRegistryText('item','ublaster','base_game','name',aParam.Value));
  if (aID='history.found-item.ucpistol') and (aParam.Name='item') then Exit(DRLRegistryText('item','ucpistol','base_game','name',aParam.Value));
  if (aID='history.found-item.uashotgun') and (aParam.Name='item') then Exit(DRLRegistryText('item','uashotgun','base_game','name',aParam.Value));
  if (aID='history.found-item.upshotgun') and (aParam.Name='item') then Exit(DRLRegistryText('item','upshotgun','base_game','name',aParam.Value));
  if (aID='history.found-item.udshotgun') and (aParam.Name='item') then Exit(DRLRegistryText('item','udshotgun','base_game','name',aParam.Value));
  if (aID='history.found-item.ulaser') and (aParam.Name='item') then Exit(DRLRegistryText('item','ulaser','base_game','name',aParam.Value));
  if (aID='history.found-item.utristar') and (aParam.Name='item') then Exit(DRLRegistryText('item','utristar','base_game','name',aParam.Value));
  if (aID='history.found-item.uminigun') and (aParam.Name='item') then Exit(DRLRegistryText('item','uminigun','base_game','name',aParam.Value));
  if (aID='history.found-item.umbazooka') and (aParam.Name='item') then Exit(DRLRegistryText('item','umbazooka','base_game','name',aParam.Value));
  if (aID='history.found-item.unplasma') and (aParam.Name='item') then Exit(DRLRegistryText('item','unplasma','base_game','name',aParam.Value));
  if (aID='history.found-item.unbfg9000') and (aParam.Name='item') then Exit(DRLRegistryText('item','unbfg9000','base_game','name',aParam.Value));
  if (aID='history.found-item.utrans') and (aParam.Name='item') then Exit(DRLRegistryText('item','utrans','base_game','name',aParam.Value));
  if (aID='history.found-item.unapalm') and (aParam.Name='item') then Exit(DRLRegistryText('item','unapalm','base_game','name',aParam.Value));
  if (aID='history.found-item.uoarmor') and (aParam.Name='item') then Exit(DRLRegistryText('item','uoarmor','base_game','name',aParam.Value));
  if (aID='history.found-item.uparmor') and (aParam.Name='item') then Exit(DRLRegistryText('item','uparmor','base_game','name',aParam.Value));
  if (aID='history.found-item.upboots') and (aParam.Name='item') then Exit(DRLRegistryText('item','upboots','base_game','name',aParam.Value));
  if (aID='history.found-item.ugarmor') and (aParam.Name='item') then Exit(DRLRegistryText('item','ugarmor','base_game','name',aParam.Value));
  if (aID='history.found-item.ugboots') and (aParam.Name='item') then Exit(DRLRegistryText('item','ugboots','base_game','name',aParam.Value));
  if (aID='history.found-item.umedarmor') and (aParam.Name='item') then Exit(DRLRegistryText('item','umedarmor','base_game','name',aParam.Value));
  if (aID='history.found-item.uduelarmor') and (aParam.Name='item') then Exit(DRLRegistryText('item','uduelarmor','base_game','name',aParam.Value));
  if (aID='history.found-item.ubulletarmor') and (aParam.Name='item') then Exit(DRLRegistryText('item','ubulletarmor','base_game','name',aParam.Value));
  if (aID='history.found-item.uballisticarmor') and (aParam.Name='item') then Exit(DRLRegistryText('item','uballisticarmor','base_game','name',aParam.Value));
  if (aID='history.found-item.ueshieldarmor') and (aParam.Name='item') then Exit(DRLRegistryText('item','ueshieldarmor','base_game','name',aParam.Value));
  if (aID='history.found-item.uplasmashield') and (aParam.Name='item') then Exit(DRLRegistryText('item','uplasmashield','base_game','name',aParam.Value));
  if (aID='history.found-item.uenergyshield') and (aParam.Name='item') then Exit(DRLRegistryText('item','uenergyshield','base_game','name',aParam.Value));
  if (aID='history.found-item.ubalshield') and (aParam.Name='item') then Exit(DRLRegistryText('item','ubalshield','base_game','name',aParam.Value));
  if (aID='history.found-item.uacidboots') and (aParam.Name='item') then Exit(DRLRegistryText('item','uacidboots','base_game','name',aParam.Value));
  if (aID='history.found-item.ubloodboots') and (aParam.Name='item') then Exit(DRLRegistryText('item','ubloodboots','base_game','name',aParam.Value));
  if (aID='history.found-item.umod-firestorm') and (aParam.Name='item') then Exit(DRLRegistryText('item','umod_firestorm','base_game','name',aParam.Value));
  if (aID='history.found-item.umod-sniper') and (aParam.Name='item') then Exit(DRLRegistryText('item','umod_sniper','base_game','name',aParam.Value));
  if (aID='history.found-item.umod-nano') and (aParam.Name='item') then Exit(DRLRegistryText('item','umod_nano','base_game','name',aParam.Value));
  if (aID='history.found-item.umod-onyx') and (aParam.Name='item') then Exit(DRLRegistryText('item','umod_onyx','base_game','name',aParam.Value));
  if (aID='history.found-item.uswpack') and (aParam.Name='item') then Exit(DRLRegistryText('item','uswpack','base_game','name',aParam.Value));
  if (aID='history.found-item.ubskull') and (aParam.Name='item') then Exit(DRLRegistryText('item','ubskull','base_game','name',aParam.Value));
  if (aID='history.found-item.ufskull') and (aParam.Name='item') then Exit(DRLRegistryText('item','ufskull','base_game','name',aParam.Value));
  if (aID='history.found-item.uhskull') and (aParam.Name='item') then Exit(DRLRegistryText('item','uhskull','base_game','name',aParam.Value));
  if (aID='history.found-item.knife') and (aParam.Name='item') then Exit(DRLRegistryText('item','knife','base_game','name',aParam.Value));
  if (aID='history.found-item.garmor') and (aParam.Name='item') then Exit(DRLRegistryText('item','garmor','base_game','name',aParam.Value));
  if (aID='history.found-item.barmor') and (aParam.Name='item') then Exit(DRLRegistryText('item','barmor','base_game','name',aParam.Value));
  if (aID='history.found-item.rarmor') and (aParam.Name='item') then Exit(DRLRegistryText('item','rarmor','base_game','name',aParam.Value));
  if (aID='history.found-item.sboots') and (aParam.Name='item') then Exit(DRLRegistryText('item','sboots','base_game','name',aParam.Value));
  if (aID='history.found-item.pboots') and (aParam.Name='item') then Exit(DRLRegistryText('item','pboots','base_game','name',aParam.Value));
  if (aID='history.found-item.psboots') and (aParam.Name='item') then Exit(DRLRegistryText('item','psboots','base_game','name',aParam.Value));
  if (aID='history.found-item.shglobe') and (aParam.Name='item') then Exit(DRLRegistryText('item','shglobe','base_game','name',aParam.Value));
  if (aID='history.found-item.bpack') and (aParam.Name='item') then Exit(DRLRegistryText('item','bpack','base_game','name',aParam.Value));
  if (aID='history.found-item.iglobe') and (aParam.Name='item') then Exit(DRLRegistryText('item','iglobe','base_game','name',aParam.Value));
  if (aID='history.found-item.scglobe') and (aParam.Name='item') then Exit(DRLRegistryText('item','scglobe','base_game','name',aParam.Value));
  if (aID='history.found-item.lhglobe') and (aParam.Name='item') then Exit(DRLRegistryText('item','lhglobe','base_game','name',aParam.Value));
  if (aID='history.found-item.msglobe') and (aParam.Name='item') then Exit(DRLRegistryText('item','msglobe','base_game','name',aParam.Value));
  if (aID='history.found-item.map') and (aParam.Name='item') then Exit(DRLRegistryText('item','map','base_game','name',aParam.Value));
  if (aID='history.found-item.pmap') and (aParam.Name='item') then Exit(DRLRegistryText('item','pmap','base_game','name',aParam.Value));
  if (aID='history.found-item.gpack') and (aParam.Name='item') then Exit(DRLRegistryText('item','gpack','base_game','name',aParam.Value));
  if (aID='history.found-item.backpack') and (aParam.Name='item') then Exit(DRLRegistryText('item','backpack','base_game','name',aParam.Value));
  if (aID='history.found-item.ashard') and (aParam.Name='item') then Exit(DRLRegistryText('item','ashard','base_game','name',aParam.Value));
  if (aID='history.found-item.ammo') and (aParam.Name='item') then Exit(DRLRegistryText('item','ammo','base_game','name',aParam.Value));
  if (aID='history.found-item.shell') and (aParam.Name='item') then Exit(DRLRegistryText('item','shell','base_game','name',aParam.Value));
  if (aID='history.found-item.rocket') and (aParam.Name='item') then Exit(DRLRegistryText('item','rocket','base_game','name',aParam.Value));
  if (aID='history.found-item.cell') and (aParam.Name='item') then Exit(DRLRegistryText('item','cell','base_game','name',aParam.Value));
  if (aID='history.found-item.pammo') and (aParam.Name='item') then Exit(DRLRegistryText('item','pammo','base_game','name',aParam.Value));
  if (aID='history.found-item.pshell') and (aParam.Name='item') then Exit(DRLRegistryText('item','pshell','base_game','name',aParam.Value));
  if (aID='history.found-item.procket') and (aParam.Name='item') then Exit(DRLRegistryText('item','procket','base_game','name',aParam.Value));
  if (aID='history.found-item.pcell') and (aParam.Name='item') then Exit(DRLRegistryText('item','pcell','base_game','name',aParam.Value));
  if (aID='history.found-item.pistol') and (aParam.Name='item') then Exit(DRLRegistryText('item','pistol','base_game','name',aParam.Value));
  if (aID='history.found-item.shotgun') and (aParam.Name='item') then Exit(DRLRegistryText('item','shotgun','base_game','name',aParam.Value));
  if (aID='history.found-item.dshotgun') and (aParam.Name='item') then Exit(DRLRegistryText('item','dshotgun','base_game','name',aParam.Value));
  if (aID='history.found-item.ashotgun') and (aParam.Name='item') then Exit(DRLRegistryText('item','ashotgun','base_game','name',aParam.Value));
  if (aID='history.found-item.bazooka') and (aParam.Name='item') then Exit(DRLRegistryText('item','bazooka','base_game','name',aParam.Value));
  if (aID='history.found-item.chaingun') and (aParam.Name='item') then Exit(DRLRegistryText('item','chaingun','base_game','name',aParam.Value));
  if (aID='history.found-item.plasma') and (aParam.Name='item') then Exit(DRLRegistryText('item','plasma','base_game','name',aParam.Value));
  if (aID='history.found-item.smed') and (aParam.Name='item') then Exit(DRLRegistryText('item','smed','base_game','name',aParam.Value));
  if (aID='history.found-item.lmed') and (aParam.Name='item') then Exit(DRLRegistryText('item','lmed','base_game','name',aParam.Value));
  if (aID='history.found-item.phase') and (aParam.Name='item') then Exit(DRLRegistryText('item','phase','base_game','name',aParam.Value));
  if (aID='history.found-item.hphase') and (aParam.Name='item') then Exit(DRLRegistryText('item','hphase','base_game','name',aParam.Value));
  if (aID='history.found-item.epack') and (aParam.Name='item') then Exit(DRLRegistryText('item','epack','base_game','name',aParam.Value));
  if (aID='history.found-item.nuke') and (aParam.Name='item') then Exit(DRLRegistryText('item','nuke','base_game','name',aParam.Value));
  if (aID='history.found-item.mod-power') and (aParam.Name='item') then Exit(DRLRegistryText('item','mod_power','base_game','name',aParam.Value));
  if (aID='history.found-item.mod-tech') and (aParam.Name='item') then Exit(DRLRegistryText('item','mod_tech','base_game','name',aParam.Value));
  if (aID='history.found-item.mod-agility') and (aParam.Name='item') then Exit(DRLRegistryText('item','mod_agility','base_game','name',aParam.Value));
  if (aID='history.found-item.mod-bulk') and (aParam.Name='item') then Exit(DRLRegistryText('item','mod_bulk','base_game','name',aParam.Value));
  if (aID='history.found-item.barrel') and (aParam.Name='item') then Exit(DRLRegistryText('item','barrel','base_game','name',aParam.Value));
  if (aID='history.found-item.barrela') and (aParam.Name='item') then Exit(DRLRegistryText('item','barrela','base_game','name',aParam.Value));
  if (aID='history.found-item.barreln') and (aParam.Name='item') then Exit(DRLRegistryText('item','barreln','base_game','name',aParam.Value));
  if (aID='history.found-item.tree') and (aParam.Name='item') then Exit(DRLRegistryText('item','tree','base_game','name',aParam.Value));
  if (aID='history.found-item.lever-flood-water') and (aParam.Name='item') then Exit(DRLRegistryText('item','lever_flood_water','base_game','name',aParam.Value));
  if (aID='history.found-item.lever-flood-acid') and (aParam.Name='item') then Exit(DRLRegistryText('item','lever_flood_acid','base_game','name',aParam.Value));
  if (aID='history.found-item.lever-flood-lava') and (aParam.Name='item') then Exit(DRLRegistryText('item','lever_flood_lava','base_game','name',aParam.Value));
  if (aID='history.found-item.lever-kill') and (aParam.Name='item') then Exit(DRLRegistryText('item','lever_kill','base_game','name',aParam.Value));
  if (aID='history.found-item.lever-explode') and (aParam.Name='item') then Exit(DRLRegistryText('item','lever_explode','base_game','name',aParam.Value));
  if (aID='history.found-item.lever-walls') and (aParam.Name='item') then Exit(DRLRegistryText('item','lever_walls','base_game','name',aParam.Value));
  if (aID='history.found-item.lever-summon') and (aParam.Name='item') then Exit(DRLRegistryText('item','lever_summon','base_game','name',aParam.Value));
  if (aID='history.found-item.lever-repair') and (aParam.Name='item') then Exit(DRLRegistryText('item','lever_repair','base_game','name',aParam.Value));
  if (aID='history.found-item.lever-medical') and (aParam.Name='item') then Exit(DRLRegistryText('item','lever_medical','base_game','name',aParam.Value));
  if (aID='history.found-item.lever-ammo') and (aParam.Name='item') then Exit(DRLRegistryText('item','lever_ammo','base_game','name',aParam.Value));
  if (aID='history.found-item.schematic-0') and (aParam.Name='item') then Exit(DRLRegistryText('item','schematic_0','base_game','name',aParam.Value));
  if (aID='history.found-item.schematic-1') and (aParam.Name='item') then Exit(DRLRegistryText('item','schematic_1','base_game','name',aParam.Value));
  if (aID='history.found-item.schematic-2') and (aParam.Name='item') then Exit(DRLRegistryText('item','schematic_2','base_game','name',aParam.Value));
  if (aID='history.found-item.lava-element') and (aParam.Name='item') then Exit(DRLRegistryText('item','lava_element','base_game','name',aParam.Value));
  if (aID='history.found-item.unullpointer') and (aParam.Name='item') then Exit(DRLRegistryText('item','unullpointer','base_game','name',aParam.Value));
  if (aID='history.found-item.umodstaff') and (aParam.Name='item') then Exit(DRLRegistryText('item','umodstaff','base_game','name',aParam.Value));
  if (aID='history.found-item.ubutcher') and (aParam.Name='item') then Exit(DRLRegistryText('item','ubutcher','base_game','name',aParam.Value));
  if (aID='history.found-item.umjoll') and (aParam.Name='item') then Exit(DRLRegistryText('item','umjoll','base_game','name',aParam.Value));
  if (aID='history.found-item.usubtle') and (aParam.Name='item') then Exit(DRLRegistryText('item','usubtle','base_game','name',aParam.Value));
  if (aID='history.found-item.utrigun') and (aParam.Name='item') then Exit(DRLRegistryText('item','utrigun','base_game','name',aParam.Value));
  if (aID='history.found-item.ujackal') and (aParam.Name='item') then Exit(DRLRegistryText('item','ujackal','base_game','name',aParam.Value));
  if (aID='history.found-item.umega') and (aParam.Name='item') then Exit(DRLRegistryText('item','umega','base_game','name',aParam.Value));
  if (aID='history.found-item.uberetta') and (aParam.Name='item') then Exit(DRLRegistryText('item','uberetta','base_game','name',aParam.Value));
  if (aID='history.found-item.usjack') and (aParam.Name='item') then Exit(DRLRegistryText('item','usjack','base_game','name',aParam.Value));
  if (aID='history.found-item.ufshotgun') and (aParam.Name='item') then Exit(DRLRegistryText('item','ufshotgun','base_game','name',aParam.Value));
  if (aID='history.found-item.urbazooka') and (aParam.Name='item') then Exit(DRLRegistryText('item','urbazooka','base_game','name',aParam.Value));
  if (aID='history.found-item.uacid') and (aParam.Name='item') then Exit(DRLRegistryText('item','uacid','base_game','name',aParam.Value));
  if (aID='history.found-item.ubfg10k') and (aParam.Name='item') then Exit(DRLRegistryText('item','ubfg10k','base_game','name',aParam.Value));
  if (aID='history.found-item.urailgun') and (aParam.Name='item') then Exit(DRLRegistryText('item','urailgun','base_game','name',aParam.Value));
  if (aID='history.found-item.umarmor') and (aParam.Name='item') then Exit(DRLRegistryText('item','umarmor','base_game','name',aParam.Value));
  if (aID='history.found-item.ucarmor') and (aParam.Name='item') then Exit(DRLRegistryText('item','ucarmor','base_game','name',aParam.Value));
  if (aID='history.found-item.unarmor') and (aParam.Name='item') then Exit(DRLRegistryText('item','unarmor','base_game','name',aParam.Value));
  if (aID='history.found-item.umedparmor') and (aParam.Name='item') then Exit(DRLRegistryText('item','umedparmor','base_game','name',aParam.Value));
  if (aID='history.found-item.ulavaarmor') and (aParam.Name='item') then Exit(DRLRegistryText('item','ulavaarmor','base_game','name',aParam.Value));
  if (aID='history.found-item.uenviroboots') and (aParam.Name='item') then Exit(DRLRegistryText('item','uenviroboots','base_game','name',aParam.Value));
  if (aID='history.found-item.unboots') and (aParam.Name='item') then Exit(DRLRegistryText('item','unboots','base_game','name',aParam.Value));
  if (aID='history.found-item.ushieldarmor') and (aParam.Name='item') then Exit(DRLRegistryText('item','ushieldarmor','base_game','name',aParam.Value));
  if (aID='history.found-item.uhwpack') and (aParam.Name='item') then Exit(DRLRegistryText('item','uhwpack','base_game','name',aParam.Value));
  if (aID='history.found-item.aarmor') and (aParam.Name='item') then Exit(DRLRegistryText('item','aarmor','base_game','name',aParam.Value));
  if (aID='history.found-item.uberarmor') and (aParam.Name='item') then Exit(DRLRegistryText('item','uberarmor','base_game','name',aParam.Value));
  if (aID='history.found-item.udragon') and (aParam.Name='item') then Exit(DRLRegistryText('item','udragon','base_game','name',aParam.Value));
  if (aID='history.found-item.lever-spec3') and (aParam.Name='item') then Exit(DRLRegistryText('item','lever_spec3','base_game','name',aParam.Value));
  if (aID='history.found-item.hellportal') and (aParam.Name='item') then Exit(DRLRegistryText('item','hellportal','base_game','name',aParam.Value));
  if (aID='history.found-item.dis-switch') and (aParam.Name='item') then Exit(DRLRegistryText('item','dis_switch','base_game','name',aParam.Value));
  if (aID='history.found-item.lever-centralprocessing1') and (aParam.Name='item') then Exit(DRLRegistryText('item','lever_centralprocessing1','base_game','name',aParam.Value));
  if (aID='history.found-item.lever-centralprocessing2') and (aParam.Name='item') then Exit(DRLRegistryText('item','lever_centralprocessing2','base_game','name',aParam.Value));
  if (aID='history.found-item.lever-centralprocessing3') and (aParam.Name='item') then Exit(DRLRegistryText('item','lever_centralprocessing3','base_game','name',aParam.Value));
  if (aID='history.found-item.lever-centralprocessing4') and (aParam.Name='item') then Exit(DRLRegistryText('item','lever_centralprocessing4','base_game','name',aParam.Value));
  if (aID='history.found-item.lever-centralprocessing5') and (aParam.Name='item') then Exit(DRLRegistryText('item','lever_centralprocessing5','base_game','name',aParam.Value));
  if (aID='history.found-item.uarenastaff') and (aParam.Name='item') then Exit(DRLRegistryText('item','uarenastaff','base_game','name',aParam.Value));
  if (aID='history.found-item.lever-chain1') and (aParam.Name='item') then Exit(DRLRegistryText('item','lever_chain1','base_game','name',aParam.Value));
  if (aID='history.found-item.lever-chain2') and (aParam.Name='item') then Exit(DRLRegistryText('item','lever_chain2','base_game','name',aParam.Value));
  if (aID='history.found-item.lever-chain3') and (aParam.Name='item') then Exit(DRLRegistryText('item','lever_chain3','base_game','name',aParam.Value));
  if (aID='history.found-item.lever-deimoslab') and (aParam.Name='item') then Exit(DRLRegistryText('item','lever_deimoslab','base_game','name',aParam.Value));
  if (aID='history.found-item.spear') and (aParam.Name='item') then Exit(DRLRegistryText('item','spear','base_game','name',aParam.Value));
  if (aID='history.found-item.uscythe') and (aParam.Name='item') then Exit(DRLRegistryText('item','uscythe','base_game','name',aParam.Value));
  if (aID='history.found-item.lever-limbow') and (aParam.Name='item') then Exit(DRLRegistryText('item','lever_limbow','base_game','name',aParam.Value));
  if (aID='history.found-item.lever-limboe') and (aParam.Name='item') then Exit(DRLRegistryText('item','lever_limboe','base_game','name',aParam.Value));
  if (aID='history.found-item.lever-erebus') and (aParam.Name='item') then Exit(DRLRegistryText('item','lever_erebus','base_game','name',aParam.Value));
  if (aID='history.found-item.lever-phoboslab1') and (aParam.Name='item') then Exit(DRLRegistryText('item','lever_phoboslab1','base_game','name',aParam.Value));
  if (aID='history.found-item.lever-phoboslab2') and (aParam.Name='item') then Exit(DRLRegistryText('item','lever_phoboslab2','base_game','name',aParam.Value));
  if (aID='history.found-item.lever-toxinrefinery1') and (aParam.Name='item') then Exit(DRLRegistryText('item','lever_toxinrefinery1','base_game','name',aParam.Value));
  if (aID='history.found-item.lever-toxinrefinery2') and (aParam.Name='item') then Exit(DRLRegistryText('item','lever_toxinrefinery2','base_game','name',aParam.Value));
  if (aID='history.found-item.lever-toxinrefinery3') and (aParam.Name='item') then Exit(DRLRegistryText('item','lever_toxinrefinery3','base_game','name',aParam.Value));
  if (aID='history.found-item.stubitem') and (aParam.Name='item') then Exit(DRLRegistryText('item','stubitem','base_game','name',aParam.Value));
  if (aID='history.found-item.teleport') and (aParam.Name='item') then Exit(DRLRegistryText('item','teleport','base_game','name',aParam.Value));
  if (aID='history.found-item.nat-imp') and (aParam.Name='item') then Exit(DRLRegistryText('item','nat_imp','base_game','name',aParam.Value));
  if (aID='history.found-item.nat-cacodemon') and (aParam.Name='item') then Exit(DRLRegistryText('item','nat_cacodemon','base_game','name',aParam.Value));
  if (aID='history.found-item.nat-knight') and (aParam.Name='item') then Exit(DRLRegistryText('item','nat_knight','base_game','name',aParam.Value));
  if (aID='history.found-item.nat-baron') and (aParam.Name='item') then Exit(DRLRegistryText('item','nat_baron','base_game','name',aParam.Value));
  if (aID='history.found-item.nat-arachno') and (aParam.Name='item') then Exit(DRLRegistryText('item','nat_arachno','base_game','name',aParam.Value));
  if (aID='history.found-item.nat-revenant') and (aParam.Name='item') then Exit(DRLRegistryText('item','nat_revenant','base_game','name',aParam.Value));
  if (aID='history.found-item.nat-mancubus') and (aParam.Name='item') then Exit(DRLRegistryText('item','nat_mancubus','base_game','name',aParam.Value));
  if (aID='history.found-item.nat-arch') and (aParam.Name='item') then Exit(DRLRegistryText('item','nat_arch','base_game','name',aParam.Value));
  if (aID='history.found-item.nat-nimp') and (aParam.Name='item') then Exit(DRLRegistryText('item','nat_nimp','base_game','name',aParam.Value));
  if (aID='history.found-item.nat-ncacodemon') and (aParam.Name='item') then Exit(DRLRegistryText('item','nat_ncacodemon','base_game','name',aParam.Value));
  if (aID='history.found-item.nat-nknight') and (aParam.Name='item') then Exit(DRLRegistryText('item','nat_nknight','base_game','name',aParam.Value));
  if (aID='history.found-item.nat-narachno') and (aParam.Name='item') then Exit(DRLRegistryText('item','nat_narachno','base_game','name',aParam.Value));
  if (aID='history.found-item.nat-nrevenant') and (aParam.Name='item') then Exit(DRLRegistryText('item','nat_nrevenant','base_game','name',aParam.Value));
  if (aID='history.found-item.nat-nmancubus') and (aParam.Name='item') then Exit(DRLRegistryText('item','nat_nmancubus','base_game','name',aParam.Value));
  if (aID='history.found-item.nat-narch') and (aParam.Name='item') then Exit(DRLRegistryText('item','nat_narch','base_game','name',aParam.Value));
  if (aID='history.found-item.nat-bruiser') and (aParam.Name='item') then Exit(DRLRegistryText('item','nat_bruiser','base_game','name',aParam.Value));
  if (aID='history.found-item.nat-shambler') and (aParam.Name='item') then Exit(DRLRegistryText('item','nat_shambler','base_game','name',aParam.Value));
  if (aID='history.found-item.nat-lava-elemental') and (aParam.Name='item') then Exit(DRLRegistryText('item','nat_lava_elemental','base_game','name',aParam.Value));
  if (aID='history.found-item.nat-mastermind') and (aParam.Name='item') then Exit(DRLRegistryText('item','nat_mastermind','base_game','name',aParam.Value));
  if (aID='history.found-item.nat-apostle') and (aParam.Name='item') then Exit(DRLRegistryText('item','nat_apostle','base_game','name',aParam.Value));
  if (aID='history.found-item.nat-arenamaster') and (aParam.Name='item') then Exit(DRLRegistryText('item','nat_arenamaster','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.chainsaw') and (aParam.Name='item') then Exit(DRLRegistryText('item','chainsaw','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.bfg9000') and (aParam.Name='item') then Exit(DRLRegistryText('item','bfg9000','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.ublaster') and (aParam.Name='item') then Exit(DRLRegistryText('item','ublaster','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.ucpistol') and (aParam.Name='item') then Exit(DRLRegistryText('item','ucpistol','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.uashotgun') and (aParam.Name='item') then Exit(DRLRegistryText('item','uashotgun','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.upshotgun') and (aParam.Name='item') then Exit(DRLRegistryText('item','upshotgun','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.udshotgun') and (aParam.Name='item') then Exit(DRLRegistryText('item','udshotgun','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.ulaser') and (aParam.Name='item') then Exit(DRLRegistryText('item','ulaser','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.utristar') and (aParam.Name='item') then Exit(DRLRegistryText('item','utristar','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.uminigun') and (aParam.Name='item') then Exit(DRLRegistryText('item','uminigun','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.umbazooka') and (aParam.Name='item') then Exit(DRLRegistryText('item','umbazooka','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.unplasma') and (aParam.Name='item') then Exit(DRLRegistryText('item','unplasma','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.unbfg9000') and (aParam.Name='item') then Exit(DRLRegistryText('item','unbfg9000','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.utrans') and (aParam.Name='item') then Exit(DRLRegistryText('item','utrans','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.unapalm') and (aParam.Name='item') then Exit(DRLRegistryText('item','unapalm','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.uoarmor') and (aParam.Name='item') then Exit(DRLRegistryText('item','uoarmor','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.uparmor') and (aParam.Name='item') then Exit(DRLRegistryText('item','uparmor','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.upboots') and (aParam.Name='item') then Exit(DRLRegistryText('item','upboots','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.ugarmor') and (aParam.Name='item') then Exit(DRLRegistryText('item','ugarmor','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.ugboots') and (aParam.Name='item') then Exit(DRLRegistryText('item','ugboots','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.umedarmor') and (aParam.Name='item') then Exit(DRLRegistryText('item','umedarmor','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.uduelarmor') and (aParam.Name='item') then Exit(DRLRegistryText('item','uduelarmor','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.ubulletarmor') and (aParam.Name='item') then Exit(DRLRegistryText('item','ubulletarmor','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.uballisticarmor') and (aParam.Name='item') then Exit(DRLRegistryText('item','uballisticarmor','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.ueshieldarmor') and (aParam.Name='item') then Exit(DRLRegistryText('item','ueshieldarmor','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.uplasmashield') and (aParam.Name='item') then Exit(DRLRegistryText('item','uplasmashield','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.uenergyshield') and (aParam.Name='item') then Exit(DRLRegistryText('item','uenergyshield','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.ubalshield') and (aParam.Name='item') then Exit(DRLRegistryText('item','ubalshield','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.uacidboots') and (aParam.Name='item') then Exit(DRLRegistryText('item','uacidboots','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.ubloodboots') and (aParam.Name='item') then Exit(DRLRegistryText('item','ubloodboots','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.umod-firestorm') and (aParam.Name='item') then Exit(DRLRegistryText('item','umod_firestorm','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.umod-sniper') and (aParam.Name='item') then Exit(DRLRegistryText('item','umod_sniper','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.umod-nano') and (aParam.Name='item') then Exit(DRLRegistryText('item','umod_nano','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.umod-onyx') and (aParam.Name='item') then Exit(DRLRegistryText('item','umod_onyx','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.uswpack') and (aParam.Name='item') then Exit(DRLRegistryText('item','uswpack','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.ubskull') and (aParam.Name='item') then Exit(DRLRegistryText('item','ubskull','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.ufskull') and (aParam.Name='item') then Exit(DRLRegistryText('item','ufskull','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.uhskull') and (aParam.Name='item') then Exit(DRLRegistryText('item','uhskull','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.knife') and (aParam.Name='item') then Exit(DRLRegistryText('item','knife','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.garmor') and (aParam.Name='item') then Exit(DRLRegistryText('item','garmor','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.barmor') and (aParam.Name='item') then Exit(DRLRegistryText('item','barmor','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.rarmor') and (aParam.Name='item') then Exit(DRLRegistryText('item','rarmor','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.sboots') and (aParam.Name='item') then Exit(DRLRegistryText('item','sboots','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.pboots') and (aParam.Name='item') then Exit(DRLRegistryText('item','pboots','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.psboots') and (aParam.Name='item') then Exit(DRLRegistryText('item','psboots','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.shglobe') and (aParam.Name='item') then Exit(DRLRegistryText('item','shglobe','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.bpack') and (aParam.Name='item') then Exit(DRLRegistryText('item','bpack','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.iglobe') and (aParam.Name='item') then Exit(DRLRegistryText('item','iglobe','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.scglobe') and (aParam.Name='item') then Exit(DRLRegistryText('item','scglobe','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.lhglobe') and (aParam.Name='item') then Exit(DRLRegistryText('item','lhglobe','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.msglobe') and (aParam.Name='item') then Exit(DRLRegistryText('item','msglobe','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.map') and (aParam.Name='item') then Exit(DRLRegistryText('item','map','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.pmap') and (aParam.Name='item') then Exit(DRLRegistryText('item','pmap','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.gpack') and (aParam.Name='item') then Exit(DRLRegistryText('item','gpack','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.backpack') and (aParam.Name='item') then Exit(DRLRegistryText('item','backpack','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.ashard') and (aParam.Name='item') then Exit(DRLRegistryText('item','ashard','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.ammo') and (aParam.Name='item') then Exit(DRLRegistryText('item','ammo','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.shell') and (aParam.Name='item') then Exit(DRLRegistryText('item','shell','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.rocket') and (aParam.Name='item') then Exit(DRLRegistryText('item','rocket','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.cell') and (aParam.Name='item') then Exit(DRLRegistryText('item','cell','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.pammo') and (aParam.Name='item') then Exit(DRLRegistryText('item','pammo','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.pshell') and (aParam.Name='item') then Exit(DRLRegistryText('item','pshell','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.procket') and (aParam.Name='item') then Exit(DRLRegistryText('item','procket','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.pcell') and (aParam.Name='item') then Exit(DRLRegistryText('item','pcell','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.pistol') and (aParam.Name='item') then Exit(DRLRegistryText('item','pistol','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.shotgun') and (aParam.Name='item') then Exit(DRLRegistryText('item','shotgun','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.dshotgun') and (aParam.Name='item') then Exit(DRLRegistryText('item','dshotgun','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.ashotgun') and (aParam.Name='item') then Exit(DRLRegistryText('item','ashotgun','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.bazooka') and (aParam.Name='item') then Exit(DRLRegistryText('item','bazooka','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.chaingun') and (aParam.Name='item') then Exit(DRLRegistryText('item','chaingun','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.plasma') and (aParam.Name='item') then Exit(DRLRegistryText('item','plasma','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.smed') and (aParam.Name='item') then Exit(DRLRegistryText('item','smed','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.lmed') and (aParam.Name='item') then Exit(DRLRegistryText('item','lmed','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.phase') and (aParam.Name='item') then Exit(DRLRegistryText('item','phase','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.hphase') and (aParam.Name='item') then Exit(DRLRegistryText('item','hphase','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.epack') and (aParam.Name='item') then Exit(DRLRegistryText('item','epack','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.nuke') and (aParam.Name='item') then Exit(DRLRegistryText('item','nuke','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.mod-power') and (aParam.Name='item') then Exit(DRLRegistryText('item','mod_power','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.mod-tech') and (aParam.Name='item') then Exit(DRLRegistryText('item','mod_tech','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.mod-agility') and (aParam.Name='item') then Exit(DRLRegistryText('item','mod_agility','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.mod-bulk') and (aParam.Name='item') then Exit(DRLRegistryText('item','mod_bulk','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.barrel') and (aParam.Name='item') then Exit(DRLRegistryText('item','barrel','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.barrela') and (aParam.Name='item') then Exit(DRLRegistryText('item','barrela','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.barreln') and (aParam.Name='item') then Exit(DRLRegistryText('item','barreln','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.tree') and (aParam.Name='item') then Exit(DRLRegistryText('item','tree','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.lever-flood-water') and (aParam.Name='item') then Exit(DRLRegistryText('item','lever_flood_water','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.lever-flood-acid') and (aParam.Name='item') then Exit(DRLRegistryText('item','lever_flood_acid','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.lever-flood-lava') and (aParam.Name='item') then Exit(DRLRegistryText('item','lever_flood_lava','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.lever-kill') and (aParam.Name='item') then Exit(DRLRegistryText('item','lever_kill','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.lever-explode') and (aParam.Name='item') then Exit(DRLRegistryText('item','lever_explode','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.lever-walls') and (aParam.Name='item') then Exit(DRLRegistryText('item','lever_walls','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.lever-summon') and (aParam.Name='item') then Exit(DRLRegistryText('item','lever_summon','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.lever-repair') and (aParam.Name='item') then Exit(DRLRegistryText('item','lever_repair','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.lever-medical') and (aParam.Name='item') then Exit(DRLRegistryText('item','lever_medical','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.lever-ammo') and (aParam.Name='item') then Exit(DRLRegistryText('item','lever_ammo','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.schematic-0') and (aParam.Name='item') then Exit(DRLRegistryText('item','schematic_0','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.schematic-1') and (aParam.Name='item') then Exit(DRLRegistryText('item','schematic_1','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.schematic-2') and (aParam.Name='item') then Exit(DRLRegistryText('item','schematic_2','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.lava-element') and (aParam.Name='item') then Exit(DRLRegistryText('item','lava_element','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.unullpointer') and (aParam.Name='item') then Exit(DRLRegistryText('item','unullpointer','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.umodstaff') and (aParam.Name='item') then Exit(DRLRegistryText('item','umodstaff','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.ubutcher') and (aParam.Name='item') then Exit(DRLRegistryText('item','ubutcher','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.umjoll') and (aParam.Name='item') then Exit(DRLRegistryText('item','umjoll','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.usubtle') and (aParam.Name='item') then Exit(DRLRegistryText('item','usubtle','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.utrigun') and (aParam.Name='item') then Exit(DRLRegistryText('item','utrigun','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.ujackal') and (aParam.Name='item') then Exit(DRLRegistryText('item','ujackal','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.umega') and (aParam.Name='item') then Exit(DRLRegistryText('item','umega','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.uberetta') and (aParam.Name='item') then Exit(DRLRegistryText('item','uberetta','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.usjack') and (aParam.Name='item') then Exit(DRLRegistryText('item','usjack','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.ufshotgun') and (aParam.Name='item') then Exit(DRLRegistryText('item','ufshotgun','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.urbazooka') and (aParam.Name='item') then Exit(DRLRegistryText('item','urbazooka','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.uacid') and (aParam.Name='item') then Exit(DRLRegistryText('item','uacid','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.ubfg10k') and (aParam.Name='item') then Exit(DRLRegistryText('item','ubfg10k','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.urailgun') and (aParam.Name='item') then Exit(DRLRegistryText('item','urailgun','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.umarmor') and (aParam.Name='item') then Exit(DRLRegistryText('item','umarmor','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.ucarmor') and (aParam.Name='item') then Exit(DRLRegistryText('item','ucarmor','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.unarmor') and (aParam.Name='item') then Exit(DRLRegistryText('item','unarmor','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.umedparmor') and (aParam.Name='item') then Exit(DRLRegistryText('item','umedparmor','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.ulavaarmor') and (aParam.Name='item') then Exit(DRLRegistryText('item','ulavaarmor','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.uenviroboots') and (aParam.Name='item') then Exit(DRLRegistryText('item','uenviroboots','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.unboots') and (aParam.Name='item') then Exit(DRLRegistryText('item','unboots','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.ushieldarmor') and (aParam.Name='item') then Exit(DRLRegistryText('item','ushieldarmor','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.uhwpack') and (aParam.Name='item') then Exit(DRLRegistryText('item','uhwpack','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.aarmor') and (aParam.Name='item') then Exit(DRLRegistryText('item','aarmor','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.uberarmor') and (aParam.Name='item') then Exit(DRLRegistryText('item','uberarmor','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.udragon') and (aParam.Name='item') then Exit(DRLRegistryText('item','udragon','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.lever-spec3') and (aParam.Name='item') then Exit(DRLRegistryText('item','lever_spec3','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.hellportal') and (aParam.Name='item') then Exit(DRLRegistryText('item','hellportal','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.dis-switch') and (aParam.Name='item') then Exit(DRLRegistryText('item','dis_switch','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.lever-centralprocessing1') and (aParam.Name='item') then Exit(DRLRegistryText('item','lever_centralprocessing1','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.lever-centralprocessing2') and (aParam.Name='item') then Exit(DRLRegistryText('item','lever_centralprocessing2','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.lever-centralprocessing3') and (aParam.Name='item') then Exit(DRLRegistryText('item','lever_centralprocessing3','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.lever-centralprocessing4') and (aParam.Name='item') then Exit(DRLRegistryText('item','lever_centralprocessing4','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.lever-centralprocessing5') and (aParam.Name='item') then Exit(DRLRegistryText('item','lever_centralprocessing5','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.uarenastaff') and (aParam.Name='item') then Exit(DRLRegistryText('item','uarenastaff','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.lever-chain1') and (aParam.Name='item') then Exit(DRLRegistryText('item','lever_chain1','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.lever-chain2') and (aParam.Name='item') then Exit(DRLRegistryText('item','lever_chain2','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.lever-chain3') and (aParam.Name='item') then Exit(DRLRegistryText('item','lever_chain3','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.lever-deimoslab') and (aParam.Name='item') then Exit(DRLRegistryText('item','lever_deimoslab','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.spear') and (aParam.Name='item') then Exit(DRLRegistryText('item','spear','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.uscythe') and (aParam.Name='item') then Exit(DRLRegistryText('item','uscythe','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.lever-limbow') and (aParam.Name='item') then Exit(DRLRegistryText('item','lever_limbow','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.lever-limboe') and (aParam.Name='item') then Exit(DRLRegistryText('item','lever_limboe','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.lever-erebus') and (aParam.Name='item') then Exit(DRLRegistryText('item','lever_erebus','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.lever-phoboslab1') and (aParam.Name='item') then Exit(DRLRegistryText('item','lever_phoboslab1','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.lever-phoboslab2') and (aParam.Name='item') then Exit(DRLRegistryText('item','lever_phoboslab2','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.lever-toxinrefinery1') and (aParam.Name='item') then Exit(DRLRegistryText('item','lever_toxinrefinery1','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.lever-toxinrefinery2') and (aParam.Name='item') then Exit(DRLRegistryText('item','lever_toxinrefinery2','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.lever-toxinrefinery3') and (aParam.Name='item') then Exit(DRLRegistryText('item','lever_toxinrefinery3','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.stubitem') and (aParam.Name='item') then Exit(DRLRegistryText('item','stubitem','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.teleport') and (aParam.Name='item') then Exit(DRLRegistryText('item','teleport','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.nat-imp') and (aParam.Name='item') then Exit(DRLRegistryText('item','nat_imp','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.nat-cacodemon') and (aParam.Name='item') then Exit(DRLRegistryText('item','nat_cacodemon','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.nat-knight') and (aParam.Name='item') then Exit(DRLRegistryText('item','nat_knight','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.nat-baron') and (aParam.Name='item') then Exit(DRLRegistryText('item','nat_baron','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.nat-arachno') and (aParam.Name='item') then Exit(DRLRegistryText('item','nat_arachno','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.nat-revenant') and (aParam.Name='item') then Exit(DRLRegistryText('item','nat_revenant','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.nat-mancubus') and (aParam.Name='item') then Exit(DRLRegistryText('item','nat_mancubus','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.nat-arch') and (aParam.Name='item') then Exit(DRLRegistryText('item','nat_arch','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.nat-nimp') and (aParam.Name='item') then Exit(DRLRegistryText('item','nat_nimp','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.nat-ncacodemon') and (aParam.Name='item') then Exit(DRLRegistryText('item','nat_ncacodemon','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.nat-nknight') and (aParam.Name='item') then Exit(DRLRegistryText('item','nat_nknight','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.nat-narachno') and (aParam.Name='item') then Exit(DRLRegistryText('item','nat_narachno','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.nat-nrevenant') and (aParam.Name='item') then Exit(DRLRegistryText('item','nat_nrevenant','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.nat-nmancubus') and (aParam.Name='item') then Exit(DRLRegistryText('item','nat_nmancubus','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.nat-narch') and (aParam.Name='item') then Exit(DRLRegistryText('item','nat_narch','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.nat-bruiser') and (aParam.Name='item') then Exit(DRLRegistryText('item','nat_bruiser','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.nat-shambler') and (aParam.Name='item') then Exit(DRLRegistryText('item','nat_shambler','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.nat-lava-elemental') and (aParam.Name='item') then Exit(DRLRegistryText('item','nat_lava_elemental','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.nat-mastermind') and (aParam.Name='item') then Exit(DRLRegistryText('item','nat_mastermind','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.nat-apostle') and (aParam.Name='item') then Exit(DRLRegistryText('item','nat_apostle','base_game','name',aParam.Value));
  if (aID='history.overloaded-item.nat-arenamaster') and (aParam.Name='item') then Exit(DRLRegistryText('item','nat_arenamaster','base_game','name',aParam.Value));
 Exit(aParam.Value);
end;
function DRLProjectHistoryParams(const aID:AnsiString;const aOriginalParams:array of TDRLTextParam;out aPresentationParams:TDRLHistoryParams):Boolean;
var i:Integer;
begin
 SetLength(aPresentationParams,Length(aOriginalParams));
 for i:=0 to High(aOriginalParams)do begin
  aPresentationParams[i]:=aOriginalParams[i];
  if aOriginalParams[i].Kind=DRL_TEXT_STRING then aPresentationParams[i].Value:=ProjectParameter(aID,aOriginalParams[i]);
 end;Exit(True);
end;
initialization
 DRLSemanticHistoryValidator:=@DRLValidateHistoryRequest;
 DRLSemanticHistoryProjector:=@DRLProjectHistoryParams;
end.
