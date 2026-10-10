/** Reviewed literal fields keyed by original registry ID, never by rendered English. */
import {producerMessages} from './lua-dynamic-message-translations.mjs';
export const leverWarnings=Object.fromEntries(producerMessages.filter(r=>r.producerKind==='registry-presentation-field'&&r.field==='warning').map(r=>[r.registryId,r]));
export const firstPickupMessages={
 upshotgun:["Splash and they're dead!",'ぶちまければ、あいつらもおしまいだ！'],
 udshotgun:['This little baby brings back memories!','こいつを見ると、昔を思い出すぜ！'],
 ulaser:['The sniper chain weapon!','連射できる狙撃銃だ！'],
 utristar:['Quite bulky!','ずいぶんかさばるな！'],
 utrans:['Well this is a weird device!','なんとも妙な装置だな！'],
 backpack:["Duh, I'll ditch my junk here.",'よし、荷物はここに詰め込むか。'],
 shotgun:['Just what I needed!','ちょうど欲しかったところだ！'],
 dshotgun:['Now THIS is what I call a shotgun!','これこそショットガンってもんだ！'],
 ashotgun:["Pump'n'roll!",'ポンプを引いて、派手にいこうぜ！'],
 bazooka:['Ride my rocket baby!','ロケットに乗って飛んでいきな！'],
 chaingun:['Phobos ReLEADed, oh yeah!','フォボスを鉛弾で塗り直すぜ、イェーイ！'],
 plasma:['Peace through superior firepower!','圧倒的な火力で平和を！'],
 nuke:['"Handle with care"... WTF?','「取り扱い注意」……なんだこりゃ？'],
 unullpointer:['This seems to be an extremely unstable device!','こいつはとんでもなく不安定な装置みたいだな！'],
 ubutcher:['Aaaah, fresh meat!','ああ、新鮮な肉だ！'],
 usubtle:['Looks very inconspicious.','見た目はずいぶん地味だな。'],
 aarmor:['So beautiful...','なんて美しい……']
};
export const leverJudgements={
 lever_flood_water:['neutral','中立'],lever_flood_acid:['dangerous','危険'],lever_flood_lava:['dangerous','危険'],
 lever_kill:['beneficial','有益'],lever_explode:['neutral','中立'],lever_walls:['dangerous','危険'],lever_summon:['dangerous','危険'],
 lever_repair:['beneficial','有益'],lever_medical:['beneficial','有益'],lever_ammo:['beneficial','有益'],lever_spec3:['dangerous','危険'],dis_switch:['dangerous','危険'],
 lever_centralprocessing1:['neutral','中立'],lever_centralprocessing2:['neutral','中立'],lever_centralprocessing3:['neutral','中立'],lever_centralprocessing4:['neutral','中立'],lever_centralprocessing5:['neutral','中立'],
 lever_chain1:['dangerous','危険'],lever_chain2:['dangerous','危険'],lever_chain3:['dangerous','危険'],lever_deimoslab:['dangerous','危険'],
 lever_limbow:['neutral','中立'],lever_limboe:['neutral','中立'],lever_erebus:['dangerous','危険'],lever_phoboslab1:['neutral','中立'],lever_phoboslab2:['neutral','中立'],
 lever_toxinrefinery1:['neutral','中立'],lever_toxinrefinery2:['neutral','中立'],lever_toxinrefinery3:['neutral','中立']
};
export function reviewedExtraField(registryId,field,english){
 if(field==='warning'){
  const row=leverWarnings[registryId];if(!row)return undefined;
  if(row.english!==english)throw Error(`Reviewed warning field changed: ${registryId}.${field}`);
  return row.japanese;
 }
 const row=(field==='firstmsg'?firstPickupMessages:field==='good'?leverJudgements:{})[registryId];
 if(!row)return undefined;
 if(row[0]!==english)throw Error(`Reviewed extra registry field changed: ${registryId}.${field}`);
 return row[1];
}
export const reviewedExtraSemanticId=(registryId,field)=>field==='warning'?leverWarnings[registryId]?.id:undefined;
