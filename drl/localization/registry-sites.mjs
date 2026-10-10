/** Reviewed typed registry presentation seams. Original Lua/Pascal domain names stay English. */
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
export function curateRegistrySites({file,exact}){
 const usesRegistry=(f,extra='')=>{
  const source=file(f),u=source.indexOf('uses ',source.indexOf('implementation'));
  if(u<0)throw Error(`No implementation uses in ${f}`);
  exact(f,source.slice(u,source.indexOf(';',u)+1),source.slice(u,source.indexOf(';',u)+1).replace('uses ',`uses drlsemanticregistry, ${extra}`));
 };
 const player='src/drlplayerview.pas',more='src/drlmoreview.pas',item='src/dfitem.pas',menu='src/drlmainmenuview.pas',io='src/drlio.pas';
 for(const f of [player,more,item])usesRegistry(f,f===item?'drlsemantictext, drlsemanticitemnames, drlsemanticitemcatalog, ':'');
 // The published Desc property and all existing Name/GetName/Description functions retain English.
 exact(item,'function    Description : Ansistring; overload;',`function    Description : Ansistring; overload;\r\n    function    PresentationDescription(aSingle: Boolean = False): AnsiString;\r\n    function    PresentationName(aKnown: Boolean; aSingle: Boolean = False): AnsiString;\r\n    function    PresentationNameValue(const aEnglish: AnsiString; aKnown: Boolean): AnsiString;\r\n    function    PresentationExtName(aLyingHere: Boolean): AnsiString;`);
 exact(item,'function TItem.GetAltFireName : AnsiString;',readFileSync(path.join(here,'item-semantic-methods.pas'),'utf8')+'\r\nfunction TItem.GetAltFireName : AnsiString;');
 exact(player,'iEntry.Name  := aItem.Description;','iEntry.Name  := aItem.PresentationDescription;');
 exact(player,"iEntry.Desc  := LuaSystem.Get(['items',aItem.ID,'desc'], '');",`iEntry.Desc  := DRLRegistryText('item', aItem.ID, 'base_game', 'desc',\r\n    AnsiString(LuaSystem.Get(['items',aItem.ID,'desc'], '')));`);
 exact(player,"AnsiString( LuaSystem.Get(['itemsets',iSet,'name']) )",`DRLRegistryText('itemset', iSet, 'base_game', 'name',\r\n        AnsiString(LuaSystem.Get(['itemsets',iSet,'name'])))`);
 for(const variable of ['iTrait','iCount','iNID']){
  const needle=`LuaSystem.Get(['traits',${variable},'name'])`,replacement=`DRLRegistryText('trait', AnsiString(LuaSystem.Get(['traits',${variable},'id'])), 'base_game', 'name', AnsiString(${needle}))`;
  const occurrences=file(player).split(needle).length-1;
  for(let n=0;n<occurrences;n++)exact(player,needle,replacement,null,n);
 }
 exact(player,"iEntry.Desc  := getString('desc');",`iEntry.Desc  := DRLRegistryText('trait', getString('id'), 'base_game', 'desc', getString('desc'));`);
 exact(player,"iEntry.Quote := getString('quote');",`iEntry.Quote := DRLRegistryText('trait', getString('id'), 'base_game', 'quote', getString('quote'));`);
 // Descriptions and headings are presentation buffers, not prototype values.
 exact(more,"FDesc     := LuaSystem.Get(['beings',FBeing.ID,'desc']);",`FDesc     := DRLRegistryText('being', FBeing.ID, 'base_game', 'desc',\r\n    AnsiString(LuaSystem.Get(['beings',FBeing.ID,'desc'])));`);
 exact(more,"FDesc     := LuaSystem.Get(['items',FItem.ID,'desc']);",`FDesc     := DRLRegistryText('item', FItem.ID, 'base_game', 'desc',\r\n    AnsiString(LuaSystem.Get(['items',FItem.ID,'desc'])));`);
 exact(more,"FTexts[iCount].Push( '{!'+aItem.Description+'}' );","FTexts[iCount].Push( '{!'+aItem.PresentationDescription+'}' );");
 exact(more,"FTitle    := '{'+VTIG_ColorChar( FItem.MenuColor ) + FItem.Description + '}';","FTitle    := '{'+VTIG_ColorChar( FItem.MenuColor ) + FItem.PresentationDescription + '}';");
 const headings=['VTIG_BeginWindow(FBeing.name, \'more_being_view\', FSize );','VTIG_BeginWindow(FBeing.name, Point( 38, -1 ), Point( 40,11 ) );'];
 for(const needle of headings)for(let n=0;n<file(more).split(needle).length-1;n++)exact(more,needle,needle.replace('FBeing.name',"DRLRegistryText('being', FBeing.ID, 'base_game', 'name', FBeing.Name)"),null,n);
 // Main menu metadata only: stored registry ID, numeric ID, requirements and OnPick stay intact.
 exact(menu,"iEntry.Name := GetString('name');\r\n    iEntry.Desc := GetString('desc','');",`iEntry.Name := DRLRegistryText('difficulty', GetString('id'), 'base_game', 'name', GetString('name'));\r\n    iEntry.Desc := DRLRegistryText('difficulty', GetString('id'), 'base_game', 'desc', GetString('desc',''));`);
 exact(menu,"iEntry.Name  := GetString('name');\r\n        iEntry.Desc  := GetString('desc');",`iEntry.Name  := DRLRegistryText('klass', GetString('id'), 'base_game', 'name', GetString('name'));\r\n        iEntry.Desc  := DRLRegistryText('klass', GetString('id'), 'base_game', 'desc', GetString('desc'));`);
 // Existing menu uses is already patched by curate; insert in the original implementation uses independently.
 exact(menu,'implementation\r\n\r\nuses ','implementation\r\n\r\nuses drlsemanticregistry, ');
 // HUD descriptor sites. Byte width/truncation is adapted independently by the UTF-8/CJK layer.
 const descriptorSites=[
  'iDesc := Player.Inv.Slot[efWeapon].Description;',
  'VTIG_FreeLabel( Player.Inv.Slot[efWeapon].Description, iPos + Point(31,1), WeaponColor(Player.Inv.Slot[efWeapon]) );',
  'VTIG_FreeLabel( Player.Inv.Slot[efTorso].Description,  iPos + Point(31,0), ArmorColor(Player.Inv.Slot[efTorso].Durability) );'
 ];
 for(const needle of descriptorSites)exact(io,needle,needle.replace('.Description','.PresentationDescription'));
}
