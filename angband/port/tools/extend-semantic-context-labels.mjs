import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const labels={
 descriptions:['Descriptions','物品・モンスター'],help:['Help','操作案内'],
 inventory:['Inventory','持ち物'],equipment:['Equipment','装備'],
 shops:['Shops','店'],store:['Store','店'],menus:['Menu','メニュー'],
 'general-menu':['Menu','メニュー'],settings:['Settings','設定'],knowledge:['Knowledge','知識'],
 targeting:['Target','標的'], 'item-menu':['Choose an item','品物の選択'],target:['Target','標的'],
 quiver:['Quiver','矢筒'],'floor-items':['Items on the floor','地面の品物'],
 'store-items':['Store stock','店の品物'],'target-detail':['Target details','標的の情報'],
 death:['Death','死'], 'death-menu':['After the game','ゲーム終了後'],score:['Scores','得点'],
 options:['Options','設定'],keymap:['Keymaps','キー割り当て'],visuals:['Symbols and colors','記号と色'],
 command:['Command','操作']
};
for(const [locale,index] of [['en',0],['ja',1]]){
 const file=path.join(root,'web/i18n',locale+'.json');
 const values=JSON.parse(fs.readFileSync(file,'utf8'));
 for(const [context,translations] of Object.entries(labels)){
  const key='semantic.context.'+context;
  if(Object.hasOwn(values,key))assert.equal(values[key],translations[index]);
  values[key]=translations[index];
 }
 fs.writeFileSync(file,JSON.stringify(values,null,2)+'\n');
}
console.log(JSON.stringify({contextLabelsAdded:Object.keys(labels).length,engineBuilt:false}));
