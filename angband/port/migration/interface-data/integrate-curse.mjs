import fs from'node:fs';import path from'node:path';import{fileURLToPath}from'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),dir=path.join(root,'migration/interface-data');
const file=path.join(root,'logic/ui-curse.c');let source=fs.readFileSync(file,'utf8');
const baseline=fs.readFileSync(path.join(dir,'source-baseline/ui-curse.c'),'utf8'),domain=JSON.parse(fs.readFileSync(path.join(root,'migration/domain-text-data/inventory.json'),'utf8'));
const manifest=JSON.parse(fs.readFileSync(path.join(dir,'source-manifest.json'),'utf8'));
function block(code){return `\r\n#ifdef __EMSCRIPTEN__ /* AB_INTERFACE */\r\n${code}\r\n#endif /* AB_INTERFACE */\r\n`;}
function insert(signature,anchor,code,after=false){const begin=signature?source.indexOf(signature):0,at=source.indexOf(anchor,begin);if(begin<0||at<0)throw Error('missing curse anchor '+anchor);const pos=at+(after?anchor.length:0);source=source.slice(0,pos)+block(code)+source.slice(pos);}
if(source.includes('ab_if_curse_refs'))throw Error('curse already integrated; regenerate interface first');
if(!source.includes('web-interface-text.h'))source=source.replace('#include "angband.h"','#include "angband.h"\r\n#include "web-interface-text.h" /* AB_INTERFACE_INCLUDE */');
const rows=new Array(28).fill(null);for(const record of domain.records.curse){const index=record.canonical.curse_index;
 const name=domain.entries.find(e=>e.file.endsWith('/curse.txt')&&e.canonical.curse_index===index&&e.role==='name'),description=domain.entries.find(e=>e.file.endsWith('/curse.txt')&&e.canonical.curse_index===index&&e.role==='description');
 if(!name||!description||index<1||index>27||rows[index])throw Error('curse source index');rows[index]={name:name.english,description:description.english,name_id:name.id,description_id:description.id};}
insert(null,'static int selection;',String.raw`
static const struct {const char *name,*description,*name_id,*description_id;} ab_if_curse_refs[]={
 {NULL,NULL,NULL,NULL},
${rows.slice(1).map(r=>` {${JSON.stringify(r.name)},${JSON.stringify(r.description)},${JSON.stringify(r.name_id)},${JSON.stringify(r.description_id)}},`).join('\n')}
};
static char ab_if_curse_strength[65];
static const char *ab_if_curse_id(int index,bool description){
 if(index<1||(size_t)index>=N_ELEMENTS(ab_if_curse_refs)||!curses[index].name||!curses[index].desc)return NULL;
 if(strcmp(curses[index].name,ab_if_curse_refs[index].name)||strcmp(curses[index].desc,ab_if_curse_refs[index].description))return NULL;
 return description?ab_if_curse_refs[index].description_id:ab_if_curse_refs[index].name_id;
}
`,true);
insert('static void get_curse_display(','\tstrnfmt(buf, sizeof(buf), "  %s (curse strength %d)", name, power);',' const char *ab_id=ab_if_curse_id(choice[oid].index,false);\n if(ab_id)ab_if_row_text("curse-menu",oid,"interface.curse.row",(const struct ab_ui_param[]){AB_UI_REF("curse",ab_id),AB_UI_INT("power",power)},2);');
insert('static void curse_menu_browser(','\t/* Redirect output to the screen */',' ab_ui_emit("curse-menu","header","interface.curse.header",(const struct ab_ui_param[]){AB_UI_OPAQUE("strength","numeric_expression",ab_if_curse_strength)},1);\n ab_ui_static("curse-menu","description",ab_if_curse_id(choice[oid].index,true));');
insert('static int curse_menu(','\tmenu_setpriv(m, count, available);',' my_strcpy(ab_if_curse_strength,dice_string,sizeof(ab_if_curse_strength));\n ab_if_menu_bind(m,"curse-menu",NULL,NULL,NULL,0);',true);
insert('static int curse_menu(','\tmem_free(m);',' ab_if_menu_forget(m);');
fs.writeFileSync(file,source);
for(const[id,en,ja,params,needle]of[
 ['interface.curse.row','{curse} (curse strength {power})','{curse}（呪いの強さ {power}）',[{name:'curse',type:'localized_text'},{name:'power',type:'integer'}],'"  %s (curse strength %d)"'],
 ['interface.curse.header','Remove which curse (spell strength {strength})?','どの呪いを解きますか？（呪文の強さ {strength}）',[{name:'strength',type:'numeric_expression'}],'" Remove which curse (spell strength %s)?"']]){
 const offset=baseline.indexOf(needle);if(offset<0)throw Error('curse source record');
 manifest.entries.push({id,english:en,japanese:ja,parameters:params,sources:[{file:'logic/ui-curse.c',line:baseline.slice(0,offset).split('\n').length}],original_source:needle,role:'curse_projection',status:'source_connected_unbuilt'});
}
manifest.curse={records:27,canonical_index_policy:'reverse curse.txt record order, index 0 reserved',shared_data_manifest:'migration/domain-text-data/inventory.json',source_name_and_description_verified:true,additional_player_knowledge_queries:0};
fs.writeFileSync(path.join(dir,'source-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
for(const[locale,field]of[['en','english'],['ja','japanese']])fs.writeFileSync(path.join(dir,locale+'.json'),JSON.stringify(Object.fromEntries(manifest.entries.map(e=>[e.id,e[field]])),null,2)+'\n');
console.log(JSON.stringify({catalog_entries:manifest.entries.length,curse_records:27}));
