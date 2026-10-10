import fs from'node:fs';import path from'node:path';import{fileURLToPath}from'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),dir=path.join(root,'migration/interface-data');
const file=path.join(root,'logic/ui-knowledge.c');let source=fs.readFileSync(file,'utf8');
const baseline=fs.readFileSync(path.join(dir,'source-baseline/ui-knowledge.c'),'utf8');
const manifest=JSON.parse(fs.readFileSync(path.join(dir,'source-manifest.json'),'utf8'));
const dictionary={...JSON.parse(fs.readFileSync(path.join(dir,'review-translations.json'))),...JSON.parse(fs.readFileSync(path.join(dir,'review-extra-translations.json')))};
const groupJa=JSON.parse(fs.readFileSync(path.join(dir,'knowledge-group-ja.json')));
const additions=[];const slug=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
function record(id,en,ja,params,needle,sourceFile='logic/ui-knowledge.c'){
 const native=sourceFile==='logic/ui-knowledge.c'?baseline:fs.readFileSync(path.join(root,sourceFile),'utf8');const at=native.indexOf(needle);if(at<0)throw Error('missing knowledge source '+id);
 const old=[...manifest.entries,...additions].find(e=>e.id===id);if(old)return id;
 additions.push({id,english:en,japanese:ja,parameters:params,sources:[{file:sourceFile,line:native.slice(0,at).split('\n').length}],original_source:needle,role:'knowledge_projection',status:'source_connected_unbuilt'});return id;
}
function identity(text){const existing=[...manifest.entries,...additions].find(e=>e.english===text&&e.sources.some(s=>s.file==='logic/ui-knowledge.c'));if(existing)return existing.id;
 if(!dictionary[text])throw Error('unreviewed knowledge label '+text);
 return record('interface.knowledge.label.'+slug(text),text,dictionary[text],[],JSON.stringify(text));}
function block(code){return `\r\n#ifdef __EMSCRIPTEN__ /* AB_INTERFACE */\r\n${code}\r\n#endif /* AB_INTERFACE */\r\n`;}
function insert(signature,anchor,code,after=false){const begin=signature?source.indexOf(signature):0,at=source.indexOf(anchor,begin);if(begin<0||at<0)throw Error('missing knowledge anchor '+signature+' '+anchor);const pos=at+(after?anchor.length:0);source=source.slice(0,pos)+block(code)+source.slice(pos);}
if(source.includes('ab_if_main_knowledge_rows'))throw Error('knowledge already integrated; regenerate interface first');
const arrays=[];
for(const[name,format]of[['object_text_order','object'],['rune_group_text','text'],['feature_group_text','text'],['trap_group_text','text']]) {
 const m=baseline.match(new RegExp(name+'\\[\\]\\s*=\\s*\\{([\\s\\S]*?)\\r?\\n\\};'));if(!m)throw Error('knowledge table '+name);
 const ids=format==='object'?[...m[1].matchAll(/\{\s*(?:TV_\w+|0),\s*("(?:[^"\\]|\\.)*"|NULL)/g)].map(r=>r[1]==='NULL'?null:identity(JSON.parse(r[1])))
  :[...m[1].matchAll(/"(?:[^"\\]|\\.)*"|\bNULL\b/g)].map(r=>r[0]==='NULL'?null:identity(JSON.parse(r[0])));
 arrays.push(`static const char *const ab_if_${name}_ids[]={${ids.map(id=>id?JSON.stringify(id):'NULL').join(',')}};`);
}
const dataFile='data/gamedata/ui_knowledge.txt',data=fs.readFileSync(path.join(root,dataFile),'utf8');
const monsterIds=[...data.matchAll(/^monster-category:(.+)$/gm)].map(m=>{const name=m[1].trimEnd();return record('interface.knowledge.monster_group.'+slug(name),name,groupJa[name]??(()=>{throw Error(name)})(),[],m[0],dataFile);});
monsterIds.push(record('interface.knowledge.monster_group.unclassified','***Unclassified***',groupJa['***Unclassified***'],[],'"***Unclassified***"'));
arrays.push(`static const char *const ab_if_monster_group_ids[]={${monsterIds.map(JSON.stringify).join(',')}};`);
insert(null,'static void display_knowledge(',String.raw`
#include "web-naming.h"
static const char *race_name(int),*kind_name(int),*ego_grp_name(int),*rune_var_name(int),*fkind_name(int),*tkind_name(int);
${arrays.join('\n')}
static const char *ab_if_knowledge_group_id(const group_funcs *groups,int gid){
 const char *const *ids=NULL;size_t count=0;
 if(groups->name==race_name){ids=ab_if_monster_group_ids;count=N_ELEMENTS(ab_if_monster_group_ids);}
 else if(groups->name==kind_name || groups->name==ego_grp_name){ids=ab_if_object_text_order_ids;count=N_ELEMENTS(ab_if_object_text_order_ids);}
 else if(groups->name==rune_var_name){ids=ab_if_rune_group_text_ids;count=N_ELEMENTS(ab_if_rune_group_text_ids);}
 else if(groups->name==fkind_name){ids=ab_if_feature_group_text_ids;count=N_ELEMENTS(ab_if_feature_group_text_ids);}
 else if(groups->name==tkind_name){ids=ab_if_trap_group_text_ids;count=N_ELEMENTS(ab_if_trap_group_text_ids);}
 return gid>=0 && (size_t)gid<count?ids[gid]:NULL;
}
`);
insert('static void display_knowledge(','\t/* Get size */',' const char **ab_if_group_ids=NULL;');
insert('static void display_knowledge(','\tg_names = mem_zalloc(grp_cnt * sizeof(char*));',' ab_if_group_ids=mem_zalloc(grp_cnt*sizeof(*ab_if_group_ids));',true);
insert('static void display_knowledge(','\t\tg_names[i] = g_funcs.name(g_list[i]);',' ab_if_group_ids[i]=ab_if_knowledge_group_id(&g_funcs,g_list[i]);',true);
insert('static void display_knowledge(','\tmenu_setpriv(&group_menu, grp_cnt, g_names);',' ab_if_menu_bind(&group_menu,"knowledge-groups",NULL,NULL,ab_if_group_ids,grp_cnt);',true);
insert('static void display_knowledge(','\tmenu_setpriv(&object_menu, 0, &o_funcs);',' ab_if_menu_bind(&object_menu,"knowledge-items",NULL,NULL,NULL,0);',true);
insert('static void display_knowledge(','\tmem_free(g_names);',' ab_if_menu_forget(&group_menu);ab_if_menu_forget(&object_menu);\n mem_free(ab_if_group_ids);');
// These names are already selected by the original knowledge filtering. IDs
// use source record identity, and captured buffers follow their native call.
insert('static void display_monster(','\t/* Display the name */',' ab_if_row_text("knowledge-items",oid,ab_naming_monster_name_id(race),NULL,0);');
insert('static void display_ego_item(','\t/* Display the name */',' ab_if_row_text("knowledge-items",oid,ab_naming_ego_name_id(ego),NULL,0);');
insert('static void display_artifact(','\tc_prt(attr, o_name, row, col);',' ab_if_named_buffer("knowledge-items",oid,o_name,"KnownObjectDescription");');
insert('static void display_feature(','\tc_prt(attr, feat->name, row, col);',' ab_if_row_text("knowledge-items",oid,ab_if_feature_id(feat->fidx),NULL,0);');
insert('static void display_trap(','\tc_prt(attr, trap->desc, row, col);',' ab_if_row_text("knowledge-items",oid,ab_ui_trap_id(trap->desc),NULL,0);');
const objectCall='object_kind_name(o_name, sizeof(o_name), kind, OPT(player, cheat_xtra))';
if(!source.includes(objectCall))throw Error('object kind capture source');source=source.replace(objectCall,`AB_IF_NAME_ROW("knowledge-items",oid,o_name,"KnownObjectDescription", ${objectCall})`);
const p=(name,type)=>({name,type});
record('interface.knowledge.row.kills','Kills: {kills}','討伐数：{kills}',[p('kills','integer')],'"%5d"');
const kills='put_str(format("%5d", lore->pkills), row, 70)';source=source.replace(kills,`AB_IF_KNOWLEDGE_KILLS(oid,lore->pkills, ${kills})`);
// Fixed main-menu actions bind at their source array ordinal. Store names bind
// to canonical feature enum, and the original shortcut branch is retained.
const pre=['Display object knowledge','Display rune knowledge','Display artifact knowledge','Display ego item knowledge','Display monster knowledge','Display feature knowledge','Display trap knowledge','Display shapechange effects'].map(identity);
const post=['Display hall of fame','Display character history','Display equippable comparison'].map(identity);
record('interface.knowledge.store.contents','Display {store} contents','{store}の品物を表示',[p('store','localized_text')],'"Display %s\'%s contents%s"');
record('interface.knowledge.store.contents_with_shortcut','Display {store} contents ({key})','{store}の品物を表示（{key}）',[p('store','localized_text'),p('key','integer')],'"Display %s\'%s contents%s"');
insert(null,'static void do_cmd_knowledge_store(',String.raw`
static const char *ab_if_main_knowledge_rows[22],*ab_if_main_store_names[22];
static int ab_if_main_store_keys[22];
static const char *const ab_if_main_pre_ids[]={${pre.map(JSON.stringify).join(',')}};
static const char *const ab_if_main_post_ids[]={${post.map(JSON.stringify).join(',')}};
static void ab_if_main_knowledge_project(struct menu *menu,int oid){
 const char *name;if(oid<0||oid>=22)return;name=ab_if_main_store_names[oid];if(!name)return;
 struct ab_ui_param params[]={AB_UI_REF("store",name),AB_UI_INT("key",ab_if_main_store_keys[oid])};
 ab_if_menu_text(menu,oid,ab_if_main_store_keys[oid]?"interface.knowledge.store.contents_with_shortcut":"interface.knowledge.store.contents",params,ab_if_main_store_keys[oid]?2:1);
}
`);
insert('static void cleanup_main_knowledge_menu(','\tmem_free(main_knowledge_menu.actions);',' ab_if_menu_forget(&main_knowledge_menu.m);\n memset(ab_if_main_knowledge_rows,0,sizeof(ab_if_main_knowledge_rows));\n memset(ab_if_main_store_names,0,sizeof(ab_if_main_store_names));\n memset(ab_if_main_store_keys,0,sizeof(ab_if_main_store_keys));');
insert('static void reset_main_knowledge_menu(','\t\t\tpre_store_actions[j].action;',' ab_if_main_knowledge_rows[i]=ab_if_main_pre_ids[j];',true);
insert('static void reset_main_knowledge_menu(','\t\t\tdo_cmd_knowledge_store;',' ab_if_main_store_names[i]=ab_if_feature_id(stores[j].feat);\n ab_if_main_store_keys[i]=j<9?j+1:0;',true);
insert('static void reset_main_knowledge_menu(','\t\t\tpost_store_actions[j].action;',' ab_if_main_knowledge_rows[i]=ab_if_main_post_ids[j];',true);
insert('static void reset_main_knowledge_menu(','\tmain_knowledge_menu.m.title = "Display current knowledge";',` ab_if_menu_bind(&main_knowledge_menu.m,"knowledge",${JSON.stringify(identity('Display current knowledge'))},NULL,ab_if_main_knowledge_rows,main_knowledge_menu.count);\n ab_if_menu_projector(&main_knowledge_menu.m,ab_if_main_knowledge_project);`,true);
fs.writeFileSync(file,source);
manifest.entries.push(...additions);manifest.knowledge={groups:monsterIds.length,main_static_actions:pre.length+post.length,original_descriptor_rows:['artifact','object_kind'],canonical_name_rows:['monster','ego','feature','trap'],unsupported_composed_rows:['rune','shape_lore','artifact_seed_title','monster_summary']};
fs.writeFileSync(path.join(dir,'source-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
for(const[locale,field]of[['en','english'],['ja','japanese']])fs.writeFileSync(path.join(dir,locale+'.json'),JSON.stringify(Object.fromEntries(manifest.entries.map(e=>[e.id,e[field]])),null,2)+'\n');
console.log(JSON.stringify({catalog_entries:manifest.entries.length,knowledge_monster_groups:monsterIds.length,knowledge_main_static_actions:pre.length+post.length}));
