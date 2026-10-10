// SPDX-License-Identifier: GPL-2.0-only
// Human-reviewed translations; source_index denotes the pinned original census.
export const rows=[];
const p=(name,type)=>({name,type});
const name=p('name','KnownObjectDescription'),ref=n=>p(n,'localized_text'),key=p('key','canonical_identity'),number=p('charges','integer');
function add(id,en,ja,parameters,source_indices,source_role='original_message'){
 rows.push({id:'object.'+id,en,ja,parameters,source_indices,source_role});
}
add('message.device.no_charges','The {device} has no charges left.','その{device}にはもう魔力が残っていない。',[ref('device')],[20]);
add('message.device.failed','You failed to {action} properly.','うまく{action}ことができなかった。',[ref('action')],[21]);
add('message.equipment.cannot_remove','You cannot remove the {name} you are {relation}.','あなたが{relation}{name}を外すことはできない。',[name,ref('relation')],[22]);
add('message.equipment.took_off','{action} {name} ({key}).','{name}（{key}）を{action}。',[ref('action'),name,key],[23,148]);
add('message.use.floor_remainder','You see {name}.','{name}が見える。',[name],[26]);
add('message.use.first_remainder','You have {name} (1st {key}).','{name}を持っている（最初の品は{key}）。',[name,key],[27]);
add('message.use.remainder','You have {name} ({key}).','{name}を持っている（{key}）。',[name,key],[28]);
for(const [form,suffix,copula,past]of [['singular','s','is','was'],['plural','','are','were']]){
 add('message.enchant.glow.'+form,'{owner} {name} glow'+suffix+' brightly!','{owner}{name}がまばゆく輝いた！',[ref('owner'),name],[58]);
 add('message.brand.aura.'+form,'The {name} '+copula+' surrounded with an aura of {brand}.','その{name}が{brand}のオーラに包まれた。',[name,ref('brand')],[59]);
 add('message.disenchant.resisted.'+form,'Your {name} ({key}) resist'+suffix+' disenchantment!','あなたの{name}（{key}）は魔力の消散に抵抗した！',[name,key],[66]);
 add('message.disenchant.happened.'+form,'Your {name} ({key}) '+past+' disenchanted!','あなたの{name}（{key}）から魔力が失われた！',[name,key],[67]);
 add('message.charges.inventory.'+form,'You have {charges} charge'+suffix+' remaining.','魔力の残量は{charges}回分。',[number],[145]);
 add('message.charges.floor.'+form,'There '+copula+' {charges} charge'+suffix+' remaining.','魔力が{charges}回分残っている。',[number],[164]);
 add('message.projection.unaffected.'+form,'The {name} '+copula+' unaffected!','{name}は影響を受けなかった！',[name],[192]);
 for(const [quantity,en,ja]of [['single','Your',''],['all','All of your','のすべて'],['some','Some of your','の一部'],['one','One of your','の一つ']])
  add('message.inventory_damage.'+quantity+'.'+form,en+' {name} ({key}) '+past+' {result}!','あなたの{name}（{key}）'+ja+'が{result}！',[name,key,ref('result')],[191]);
}
add('message.curse_armor.resisted','A terrible black aura tries to surround your armor, but your {name} resists the effects!','恐ろしい黒いオーラが鎧を包み込もうとしたが、あなたの{name}は効果に抵抗した！',[name],[73]);
add('message.curse_weapon.resisted','A terrible black aura tries to surround your weapon, but your {name} resists the effects!','恐ろしい黒いオーラが武器を包み込もうとしたが、あなたの{name}は効果に抵抗した！',[name],[75]);
add('message.tap_device.no_energy','That {device} had no useable energy','その{device}には利用できる魔力がなかった',[ref('device')],[77]);
add('message.tap_device.mana_full','Your mana was already at its maximum.  {device} not drained.','魔力はすでに最大だった。{device}から魔力は吸い取られなかった。',[ref('device')],[78]);
add('message.curse.removed','The {curse} curse is removed!','{curse}の呪いが解除された！',[ref('curse')],[138]);
add('message.drop.lost','The {name} {verb}.','{name}は{verb}。',[name,ref('verb')],[163]);
add('message.projection.destroyed','The {name} {verb}!','{name}は{verb}！',[name,ref('verb')],[193]);
for(const [word,en,ja]of [['wand','wand','ワンド'],['staff','staff','スタッフ']]){
 add('device.'+word,en,ja,[],[20,77],'selected_device_branch');
 add('device.'+word+'.capital',en[0].toUpperCase()+en.slice(1),ja,[],[78],'selected_device_branch');
}
for(const [word,en,ja]of [['rod','zap the rod','ロッドを放つ'],['wand','use the wand','ワンドを使う'],['staff','use the staff','スタッフを使う'],['activation','activate it','発動させる']])
 add('action.device.'+word,en,ja,[],[21],'selected_device_branch');
for(const[word,en,ja]of [['wielding','You were wielding','武器として使うのをやめた'],['holding','You were holding','持つのをやめた'],['wearing','You were wearing','着用をやめた']])
 add('action.removal.'+word,en,ja,[],[23,148],'selected_equipment_branch');
add('owner.carried','Your','あなたの',[],[58],'original_carried_predicate');
add('owner.floor','The','その',[],[58],'original_carried_predicate');
for(const[word,ja]of [['Flame','炎'],['Frost','冷気'],['Venom','毒']])add('brand.'+word.toLowerCase(),word,ja,[],[59],'original_rng_selected_brand');
add('damage.result.damaged','damaged','損傷した',[],[191],'original_damage_predicate');
add('damage.result.destroyed','destroyed','破壊された',[],[191],'original_damage_predicate');
for(const[word,forms,ja,indices]of [
 ['break',['breaks','break'],'壊れた',[163]],['disappear',['disappears','disappear'],'消えた',[163]],
 ['melt',['melts','melt'],'溶けた',[193]],['destroy',['is destroyed','are destroyed'],'破壊された',[193]],
 ['burn',['burns up','burn up'],'燃え尽きた',[193]],['shatter',['shatters','shatter'],'砕け散った',[193]],
]) for(let i=0;i<2;i++)add('verb.'+word+'.'+(i?'plural':'singular'),forms[i],ja,[],indices,'original_selected_verb');
const slots=[['weapon','weapon','武器'],['shooting','shooting','射撃武器'],['right_hand','right hand','右手'],['left_hand','left hand','左手'],['neck','neck','首'],['light','light','光源'],['body','body','胴'],['back','back','背中'],['arm','arm','腕'],['head','head','頭'],['hands','hands','両手'],['feet','feet','足']];
for(const[word,en,ja]of slots)add('slot.humanoid.'+word,en,ja,[],[22],'canonical_body_zero_slot_ordinal');
add('relation.weapon.heavy','just lifting','持ち上げている',[],[22],'original_equipment_relation_branch');
add('relation.bow.heavy','just holding','手に持っている',[],[22],'original_equipment_relation_branch');
add('relation.weapon.normal','attacking monsters with','怪物への攻撃に使っている',[],[22],'original_equipment_relation_branch');
add('relation.bow.normal','shooting missiles with','射撃に使っている',[],[22],'original_equipment_relation_branch');
add('relation.light.normal','using to light your way','道を照らすために使っている',[],[22],'original_equipment_relation_branch');
add('relation.slot.on','wearing on your {slot}','{slot}に装着している',[ref('slot')],[22],'original_equipment_relation_branch');
add('relation.slot.around','wearing around your {slot}','{slot}の周りに装着している',[ref('slot')],[22],'original_equipment_relation_branch');
