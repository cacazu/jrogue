import fs from 'node:fs';import path from 'node:path';import{fileURLToPath}from'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const dir=path.join(root,'migration/interface-data');
const manifest=JSON.parse(fs.readFileSync(path.join(dir,'source-manifest.json'),'utf8'));
const extras=[];
function record(id,en,ja,params,file,needle,role='interface_projection') {
 const source=fs.readFileSync(path.join(dir,'source-baseline',file),'utf8'),offset=source.indexOf(needle);
 if(offset<0)throw Error('missing source evidence '+id);
 extras.push({id,english:en,japanese:ja,parameters:params,sources:[{file:'logic/'+file,line:source.slice(0,offset).split('\n').length}],role,status:'source_connected_unbuilt',original_source:needle});
 return id;
}
function block(code){return `\r\n#ifdef __EMSCRIPTEN__ /* AB_INTERFACE */\r\n${code}\r\n#endif /* AB_INTERFACE */\r\n`;}
function patch(file,anchor,code,after=false){const filename=path.join(root,'logic',file);let source=fs.readFileSync(filename,'utf8');const at=source.indexOf(anchor);if(at<0||source.indexOf(anchor,at+1)>=0)throw Error('nonunique source anchor '+file+' '+anchor);const pos=at+(after?anchor.length:0);source=source.slice(0,pos)+block(code)+source.slice(pos);if(!source.includes('web-interface-text.h'))source=source.replace('#include "angband.h"','#include "angband.h"\r\n#include "web-interface-text.h" /* AB_INTERFACE_INCLUDE */');fs.writeFileSync(filename,source);}
function within(file,signature,anchor,code,after=false){const filename=path.join(root,'logic',file);let source=fs.readFileSync(filename,'utf8');const start=source.indexOf(signature);if(start<0)throw Error(signature);const at=source.indexOf(anchor,start);if(at<0)throw Error(anchor);const pos=at+(after?anchor.length:0);source=source.slice(0,pos)+block(code)+source.slice(pos);if(!source.includes('web-interface-text.h'))source=source.replace('#include "angband.h"','#include "angband.h"\r\n#include "web-interface-text.h" /* AB_INTERFACE_INCLUDE */');fs.writeFileSync(filename,source);}
function wrap(file,anchor,prefix){const filename=path.join(root,'logic',file);let source=fs.readFileSync(filename,'utf8');const at=source.indexOf(anchor);if(at<0||source.indexOf(anchor,at+1)>=0)throw Error('nonunique wrapper '+anchor);source=source.slice(0,at)+prefix+anchor+')'+source.slice(at+anchor.length);fs.writeFileSync(filename,source);}
// Generic row facts are sampled after the original visibility/tag decisions.
patch('ui-menu.c','\tmenu->row_funcs->display_row(menu, oid, cursor, row, col, width);',' ab_if_menu_row(menu,oid,sel,cursor,curs_attrs[menu_row_style_for_validity(row_valid)][0!=cursor]);');
patch('ui-menu.c','\tif (menu->title)\r\n\t\tTerm_putstr',' ab_if_menu_begin(menu);');
patch('ui-menu.c','\tmenu->skin->display_list(menu, menu->cursor, &menu->top, loc);',' ab_if_menu_end(menu);',true);
patch('ui-menu.c','void menu_free(struct menu *m)\r\n{',' ab_if_menu_forget(m);',true);
// All three exits retain their original return/event exactly once.
for(const target of ['\t\t\t\treturn in;','\t\t\treturn out;','\treturn in;\r\n}'])patch('ui-menu.c',target,' ab_if_menu_leave(menu);');
// Preserve the existing birth-only projection/context; general interface and
// cheat rows bind to the enum identity, not option_desc() completed English.
patch('ui-options.c','\t/* for all menus */',' if(!ui_birth_options)ab_if_menu_bind(m,"options",page==OP_CHEAT?"interface.options.table.cheat_options":"interface.options.table.user_interface_options",\n page==OP_INTERFACE?"interface.options.option_toggle_menu.set_option_y_n_t_s_to_save":"interface.options.option_toggle_menu.set_option_y_n_t_select_with_movement",NULL,0);');
patch('ui-options.c','\tif (u8len < 45) {',' if(!ab_ui_in("birth-options")) {\n  char slot[64];const char *id=ab_if_option_id(oid);\n  struct ab_ui_param p[2]={AB_UI_REF("value",options[oid]?"interface.options.state.enabled":"interface.options.state.disabled"),AB_UI_OPAQUE("option_key","canonical_identity",option_name(oid))};\n  ab_if_menu_text(m,oid,id,NULL,0);\n  strnfmt(slot,sizeof(slot),"row.%d.value",oid);ab_ui_emit("options",slot,"interface.options.value_and_key",p,2);\n }');
patch('ui-options.c','\tmem_free(m);\r\n#ifdef __EMSCRIPTEN__ /* AB_UI_PURE */',' ab_if_menu_forget(m);');
// Full sentences follow the exact original help branches; no fragments of
// English are assembled or matched at runtime.
const help=(id,en,ja,file,anchor,slot)=>{record(id,en,ja,[],file,anchor,'control_help');patch(file,anchor,` ab_if_static("${file==='ui-store.c'?'store':'target'}","help.${slot}","${id}");`);};
help('interface.store.help.examine','x or l examines an item.','x（ローグ風）またはlで品物を詳しく調べます。','ui-store.c','\ttext_out(" examines");','examine');
help('interface.store.help.purchase','p or g purchases an item.','pまたはgで品物を購入します。','ui-store.c','\t\telse text_out(" purchases");','purchase');
help('interface.store.help.home_take','p or g picks up an item.','pまたはgで自宅の品物を取り出します。','ui-store.c','\t\tif (is_home) text_out(" picks up");','home_take');
// These two source anchors are conditional one-line statements: branch-gated
// packets must be emitted inside their original branch, not before it.
for(const[phrase,id]of[['\t\tif (is_home) text_out(" picks up");','interface.store.help.home_take'],['\t\telse text_out(" purchases");','interface.store.help.purchase']]) {
 const file=path.join(root,'logic/ui-store.c');let source=fs.readFileSync(file,'utf8');
 const capture=block(` ab_if_static("store","help.${id.split('.').at(-1)}","${id}");`);source=source.replace(capture,'');
 const original=phrase.includes('if (is_home)')?'text_out(" picks up")':'text_out(" purchases")';source=source.replace(phrase,phrase.replace(original,`AB_IF_TEXT("${id}","store","help.purchase", ${original})`));fs.writeFileSync(file,source);
}
help('interface.store.help.donate','d or s gives an item to the store in return for its identification. Some wands and staves will also be recharged.','dまたはsで品物を渡すと、その品物を識別してもらえます。一部の魔法棒や杖は充填も回復します。','ui-store.c','\t\t\ttext_out(" gives an item to the store in return for its identification. Some wands and staves will also be recharged. ");','donate');
help('interface.store.help.inventory','I inspects an item from your inventory.','Iで所持品を調べます。','ui-store.c','\ttext_out(" inspects an item from your inventory. ");','inventory');
help('interface.target.help.navigation','Direction keys and clicks look around. p selects the player, q exits, r displays details.','方向キーやクリックで見回します。pでプレイヤーの位置、qで終了、rで詳細を表示します。','ui-target.c','\t/* Display help */','navigation');
help('interface.target.help.pathfinding','g moves to selection.','gで選択した場所へ移動します。','ui-target.c','\t\ttext_out_c(COLOUR_L_GREEN, "g");','pathfinding');
help('interface.target.help.interesting','m restricts selection to interesting places.','mで注目する場所だけを選択対象にします。','ui-target.c','\t\ttext_out_c(COLOUR_L_GREEN, "m");','interesting');
help('interface.target.help.free','+ and - cycle through places. o allows free selection.','+と-で場所を順に選びます。oで自由選択に切り替えます。','ui-target.c','\t\ttext_out_c(COLOUR_L_GREEN, "+");','free');
help('interface.target.help.target','t targets selection.','tで選択した対象を標的にします。','ui-target.c','\t\ttext_out_c(COLOUR_L_GREEN, "t");','target');
help('interface.target.help.stairs','>, < and x select nearest stairs or unexplored area.','>で下り階段、<で上り階段、xで未探索の場所から最寄りのものを選択します。','ui-target.c','\ttext_out_c(COLOUR_L_GREEN, ">");','stairs');
const params=(name,type)=>({name,type});
record('interface.death.name','{name}','{name}',[params('name','character_name')],'ui-death.c','put_str_centred(line++, 8, 8+31, "%s", player->full_name);');
record('interface.death.level','Level: {level}','レベル：{level}',[params('level','integer')],'ui-death.c','put_str_centred(line++, 8, 8+31, "Level: %d", (int)player->lev);');
record('interface.death.experience','Exp: {experience}','経験値：{experience}',[params('experience','integer')],'ui-death.c','put_str_centred(line++, 8, 8+31, "Exp: %d", (int)player->exp);');
record('interface.death.gold','AU: {gold}','所持金：{gold}',[params('gold','integer')],'ui-death.c','put_str_centred(line++, 8, 8+31, "AU: %d", (int)player->au);');
record('interface.death.retired','Retired on Level {depth}','地下{depth}階で引退',[params('depth','integer')],'ui-death.c','"Retired on Level %d"');
record('interface.death.killed','Killed on Level {depth}','地下{depth}階で死亡',[params('depth','integer')],'ui-death.c','"Killed on Level %d"');
patch('ui-death.c','\tline = 7;',' ab_ui_scope_begin("death",true);\n ab_ui_emit(NULL,"name","interface.death.name",(const struct ab_ui_param[]){AB_UI_OPAQUE("name","character_name",player->full_name)},1);\n ab_ui_emit(NULL,"level","interface.death.level",(const struct ab_ui_param[]){AB_UI_INT("level",player->lev)},1);\n ab_ui_emit(NULL,"experience","interface.death.experience",(const struct ab_ui_param[]){AB_UI_INT("experience",player->exp)},1);\n ab_ui_emit(NULL,"gold","interface.death.gold",(const struct ab_ui_param[]){AB_UI_INT("gold",player->au)},1);\n ab_ui_emit(NULL,"result",retired?"interface.death.retired":"interface.death.killed",(const struct ab_ui_param[]){AB_UI_INT("depth",player->depth)},1);\n ab_ui_static(NULL,"class",ab_ui_class_id(player->class->cidx));\n ab_ui_static(NULL,"title",ab_ui_title_id(player->class->cidx,(player->lev-1)/5));\n ab_ui_scope_end();');
// Object names are copied from the original descriptor's address-keyed capture,
// immediately in set_obj_names; no completed output text/entity is inspected.
record('interface.items.row.name','{object}','{object}',[params('object','KnownObjectDescription')],'ui-object.c','object_desc(items[i].o_name,');
record('interface.monsters.row.name','{monster}','{monster}',[params('monster','MonsterDescription')],'ui-target.c','monster_desc(');
record('interface.items.row.empty','(nothing)','（空き）',[],'ui-object.c','"(nothing)"');
record('interface.items.row.weight','Weight: {weight} lb','重量：{weight} ポンド',[params('weight','decimal_one_place')],'ui-object.c','"%4d.%1d lb"');
record('interface.items.row.price','Price: {price} gold','価格：{price} 金',[params('price','integer')],'ui-object.c','"%6d au"');
record('interface.items.row.fail','{fail}% fail','失敗率：{fail}％',[params('fail','integer')],'ui-object.c','"%4d%% fail"');
record('interface.items.row.recharge_fail','{fail}% fail','再充填の失敗率：{fail}％',[params('fail','decimal_one_place')],'ui-object.c','"%2d.%1d%% fail"');
within('ui-object.c','static void set_obj_names','\t\t/* Max length of label + object name */',' if(obj)ab_if_items_name(i,items[i].o_name,true);');
within('ui-object.c','static void show_obj(','\t/* If we don\'t have an object, we can skip the rest of the output */',' ab_if_items_key(obj_num,items[obj_num].key,cursor,attr);');
for(const[signature,context]of[['void show_inven(','inventory'],['void show_quiver(','quiver'],['void show_equip(','equipment'],['void show_floor(','floor-items']]){
 within('ui-object.c',signature,'\t/* Initialize */',` ab_if_items_begin("${context}",!(mode & OLIST_WINDOW) && Term==angband_term[0]);`);
 within('ui-object.c',signature,'\tshow_obj_list(mode);',' ab_if_items_end();',true);
}
// Use the already-computed visible price/weight/failure values in their exact
// original branches. The native formatting expression remains evaluated once.
for(const[call,prefix]of[
 ['strnfmt(buf, sizeof(buf), "%6d au", price)','AB_IF_ROW_NUMBER(obj_num,"price","interface.items.row.price","price",price,false, '],
 ['strnfmt(buf, sizeof(buf), "%4d%% fail", fail)','AB_IF_ROW_NUMBER(obj_num,"fail","interface.items.row.fail","fail",fail,false, '],
 ['strnfmt(buf, sizeof(buf), "%2d.%1d%% fail", fail / 10, fail % 10)','AB_IF_ROW_NUMBER(obj_num,"recharge_fail","interface.items.row.recharge_fail","fail",fail,true, '],
 ['strnfmt(buf, sizeof(buf), "%4d.%1d lb", weight / 10, weight % 10)','AB_IF_ROW_NUMBER(obj_num,"weight","interface.items.row.weight","weight",weight,true, '],
 ]) {
 const filename=path.join(root,'logic/ui-object.c');let source=fs.readFileSync(filename,'utf8');if(!source.includes(call))throw Error('row value source '+call);source=source.replace(call,prefix+call+')');fs.writeFileSync(filename,source);
}
// Empty equipment rows follow the original source branch; blank section labels
// stay blank. No descriptor is requested for an absent object.
wrap('ui-object.c','strnfmt(items[i].o_name, sizeof(items[i].o_name), "(nothing)")','AB_IF_ROW_EMPTY(i, ');
// Store rows are a distinct replaceable view from the shop heading/help.
within('ui-store.c','static void store_menu_init','\tmenu_init(menu, MN_SKIN_SCROLL, &store_menu);',' ab_if_menu_bind(menu,"store-items",store->feat==FEAT_HOME?"interface.store.store_display_frame.home_inventory":"interface.store.store_display_frame.store_inventory",NULL,NULL,0);',true);
within('ui-store.c','static void store_display_entry','\t/* Display the object */',' ab_if_named_buffer("store-items",oid,o_name,"KnownObjectDescription");');
within('ui-store.c','static void store_display_entry','\tc_put_str(colour, out_val, row, ctx->scr_places_x[LOC_WEIGHT]);',' ab_if_menu_number(menu,oid,"weight","interface.items.row.weight","weight",obj_weight,true);');
record('interface.store.row.average_price','Average price: {price} gold','平均価格：{price} 金',[params('price','integer')],'ui-store.c','"%9ld avg"');
for(const[call,id]of[['strnfmt(out_val, sizeof out_val, "%9ld avg", (long)x)','interface.store.row.average_price'],['strnfmt(out_val, sizeof out_val, "%9ld    ", (long)x)','interface.items.row.price']])
 wrap('ui-store.c',call,`AB_IF_MENU_NUMBER(menu,oid,"price","${id}","price",x,false, `);
for(const signature of ['void textui_store_knowledge(','void enter_store('])within('ui-store.c',signature,'\tmem_free(ctx.list);',' ab_if_menu_forget(&ctx.menu);\n ab_ui_reset("store");');
record('interface.store.gold_remaining','Gold remaining: {gold}','所持金：{gold}',[params('gold','integer')],'ui-store.c','"Gold Remaining: %9ld"');
within('ui-store.c','static void store_redraw','\t\tprt(format("Gold Remaining: %9ld", (long)player->au),',' ab_ui_emit("store","gold","interface.store.gold_remaining",(const struct ab_ui_param[]){AB_UI_INT("gold",player->au)},1);');
for(const[anchor,id,en,ja]of[
 ['text_out(" drops")','interface.store.help.home_drop','d or s stashes an item in your home.','dまたはsで所持品を自宅に預けます。'],
 ['text_out(" sells")','interface.store.help.sell','d or s sells an item from your inventory.','dまたはsで所持品を売ります。'],
 ['text_out(" exits the building.")','interface.store.help.exit_building','Esc exits the building.','Escで店を出ます。'],
 ['text_out(" exits this screen.")','interface.store.help.exit_screen','Esc exits this screen.','Escでこの画面を閉じます。']]){
 record(id,en,ja,[],'ui-store.c',anchor,'control_help');wrap('ui-store.c',anchor,`AB_IF_TEXT("${id}","store","help.${id.includes('exit_')?'exit':'sell'}", `);
}
// Detail names originate from the original knowledge-gated descriptor once.
// The projection owns serialized facts before handle_stuff/recall can change
// another naming capture. Coordinate values are already shown by native UI.
record('interface.target.coordinates','Position: {x}, {y}','位置：{x}, {y}',[params('x','integer'),params('y','integer')],'ui-target.c','move_cursor_relative(auxst->grid.y, auxst->grid.x);');
within('ui-target.c','static bool aux_reinit','\t/* Bail if looking at a forbidden grid.',' ab_ui_reset("target-detail");');
within('ui-target.c','static bool aux_monster','\t/* Track this monster\'s race and health */',' ab_if_named_buffer("target-detail",0,m_name,"MonsterDescription");\n ab_ui_emit("target-detail","row.0.coordinates","interface.target.coordinates",(const struct ab_ui_param[]){AB_UI_INT("x",auxst->grid.x),AB_UI_INT("y",auxst->grid.y)},2);');
within('ui-target.c','static ui_event target_recall_loop_object','\t\t\t/* Describe the object */',' ab_if_named_buffer("target-detail",0,o_name,"KnownObjectDescription");\n ab_ui_emit("target-detail","row.0.coordinates","interface.target.coordinates",(const struct ab_ui_param[]){AB_UI_INT("x",x),AB_UI_INT("y",y)},2);');
record('interface.keyboard.key.regular','{key}','{key}',[params('key','canonical_key')],'ui-target.c','label[0] = key;');
record('interface.keyboard.key.control','Ctrl+{key}','Ctrl+{key}',[params('key','canonical_key')],'ui-target.c','label[1] = UN_KTRL(key);');
record('interface.target.help.ignore','{key} ignores the selected object.','{key}で選択中の品物を無視します。',[params('key','localized_text')],'ui-target.c','text_out("\' ignores selection.");','control_help');
within('ui-target.c','static void target_display_help','\t\tif (KTRL(key) == key) {',' bool ab_if_control_key=false;');
within('ui-target.c','static void target_display_help',"\t\t\tlabel[2] = '\\0';",' ab_if_control_key=true;',true);
within('ui-target.c','static void target_display_help','\t\ttext_out("\' ignores selection.");',' char ab_if_key[2]={ab_if_control_key?label[1]:label[0],0};\n struct ab_ui_param ab_if_leaf=AB_UI_OPAQUE("key","canonical_key",ab_if_key);\n struct ab_ui_param ab_if_value=AB_UI_NESTED("key",ab_if_control_key?"interface.keyboard.key.control":"interface.keyboard.key.regular",&ab_if_leaf,1);\n ab_ui_emit("target","help.ignore","interface.target.help.ignore",&ab_if_value,1);');
// Scalar settings share the source-owned option field; capture before the
// original wait, and reset the temporary projection on return to the parent.
record('interface.options.delay.current','Current base delay: {delay} ms','現在の基本待ち時間：{delay} ミリ秒',[params('delay','integer')],'ui-options.c','"Current base delay factor: %d msec"');
within('ui-options.c','static void do_cmd_delay','\tprt(format("Current base delay factor: %d msec", msec),',' ab_ui_emit("options","settings.current","interface.options.delay.current",(const struct ab_ui_param[]){AB_UI_INT("delay",msec)},1);');
record('interface.options.warning.current','Current hitpoint warning: {warning} ({percent}%)','現在のHP警告：{warning}（{percent}％）',[params('warning','integer'),params('percent','integer')],'ui-options.c','"Current hitpoint warning: %d (%d%%)"');
within('ui-options.c','static void do_cmd_hp_warn','\tprt(format("Current hitpoint warning: %d (%d%%)",',' ab_ui_emit("options","settings.current","interface.options.warning.current",(const struct ab_ui_param[]){AB_UI_INT("warning",player->opts.hitpoint_warn),AB_UI_INT("percent",player->opts.hitpoint_warn*10)},2);');
record('interface.options.movement_delay.current','Current movement delay: {delay} ({milliseconds} ms)','現在の移動待ち時間：{delay}（{milliseconds} ミリ秒）',[params('delay','integer'),params('milliseconds','integer')],'ui-options.c','"Current movement delay: %d (%d msec)"');
within('ui-options.c','static void do_cmd_lazymove_delay','\tprt(format("Current movement delay: %d (%d msec)",',' ab_ui_emit("options","settings.current","interface.options.movement_delay.current",(const struct ab_ui_param[]){AB_UI_INT("delay",player->opts.lazymove_delay),AB_UI_INT("milliseconds",player->opts.lazymove_delay*10)},2);');
record('interface.options.sidebar.current','Current sidebar: {mode}','現在の状態欄：{mode}',[params('mode','localized_text')],'ui-options.c','"Current mode: %s"');
for(const[mode,en,ja]of[['left','Left','左'],['top','Top','上'],['none','None','なし']])record('interface.options.sidebar.'+mode,en,ja,[],'ui-options.c','const char *names[SIDEBAR_MAX]');
within('ui-options.c','static void do_cmd_sidebar_mode','\t\tprt(format("Current mode: %s", tmp),',' const char *ab_modes[]={"interface.options.sidebar.left","interface.options.sidebar.top","interface.options.sidebar.none"};\n ab_ui_emit("options","settings.current","interface.options.sidebar.current",(const struct ab_ui_param[]){AB_UI_REF("mode",ab_modes[SIDEBAR_MODE%SIDEBAR_MAX])},1);');
for(const name of ['do_cmd_delay','do_cmd_hp_warn','do_cmd_lazymove_delay','do_cmd_sidebar_mode']){
 within('ui-options.c','static void '+name,'\tscreen_save();',' ab_ui_reset("options");');
 within('ui-options.c','static void '+name,'\tscreen_load();',' ab_ui_reset("options");');
}
// Highscore identities/numbers are canonical stored fields. User identifier
// and character name remain owned verbatim values. The old free-form death
// cause remains a separately documented save-format migration gap.
record('interface.score.row.summary','{rank}. {points} — {name}, {race} {class}, level {level}','{rank}位　{points}点 — {name}、{race}の{class}、レベル{level}',[params('rank','integer'),params('points','integer'),params('name','character_name'),params('race','localized_text'),params('class','localized_text'),params('level','integer')],'ui-score.c','"%3d.%9s  %s the %s %s, level %d"');
record('interface.score.row.maximum_level','Maximum level: {level}','最高レベル：{level}',[params('level','integer')],'ui-score.c','" (Max %d)"');
record('interface.score.row.depth','Dungeon level: {depth} (maximum {maximum})','到達階：地下{depth}階（最深：{maximum}階）',[params('depth','integer'),params('maximum','integer')],'ui-score.c','"Killed by %s on dungeon level %d"');
record('interface.score.row.details','User {user}, Date {date}, Gold {gold}, Turns {turns}','利用者 {user}、日付 {date}、所持金 {gold}、ターン数 {turns}',[params('user','verbatim_user_text'),params('date','opaque_calendar_date'),params('gold','integer'),params('turns','integer')],'ui-score.c','"(User %s, Date %s, Gold %s, Turn %s)."');
record('interface.score.table.none','<none>','不明',[],'ui-score.c','"<none>"');
within('ui-score.c','static void display_score_page','\t/* Dump 5 entries */',' ab_ui_scope_begin("score",true);');
within('ui-score.c','static void display_score_page','\t\t/* Dump the first line */',' char ab_slot[64];\n strnfmt(ab_slot,sizeof(ab_slot),"row.%d.name",start);\n ab_ui_emit(NULL,ab_slot,"interface.score.row.summary",(const struct ab_ui_param[]){AB_UI_INT("rank",start+1),AB_UI_INT("points",atoi(score->pts)),AB_UI_OPAQUE("name","character_name",score->who),AB_UI_REF("race",r?ab_ui_race_id(r->ridx):"interface.score.table.none"),AB_UI_REF("class",c?ab_ui_class_id(c->cidx):"interface.score.table.none"),AB_UI_INT("level",clev)},6);\n if(mlev>clev){strnfmt(ab_slot,sizeof(ab_slot),"row.%d.maximum_level",start);ab_ui_emit(NULL,ab_slot,"interface.score.row.maximum_level",(const struct ab_ui_param[]){AB_UI_INT("level",mlev)},1);}\n strnfmt(ab_slot,sizeof(ab_slot),"row.%d.depth",start);ab_ui_emit(NULL,ab_slot,"interface.score.row.depth",(const struct ab_ui_param[]){AB_UI_INT("depth",cdun),AB_UI_INT("maximum",mdun)},2);');
within('ui-score.c','static void display_score_page','\t\tc_put_str(attr, out_val, n * 4 + 4, 15);',' strnfmt(ab_slot,sizeof(ab_slot),"row.%d.details",start);\n ab_ui_emit(NULL,ab_slot,"interface.score.row.details",(const struct ab_ui_param[]){AB_UI_OPAQUE("user","verbatim_user_text",user),AB_UI_OPAQUE("date","opaque_calendar_date",when),AB_UI_INT("gold",atoi(gold)),AB_UI_INT("turns",atoi(aged))},4);');
within('ui-score.c','static void display_score_page','\r\n}\r\n',' ab_ui_scope_end();');
within('ui-score.c','void show_scores(','\tscreen_load();',' ab_ui_reset("score");');
for(const entry of extras){if(manifest.entries.some(e=>e.id===entry.id))throw Error('duplicate extra');manifest.entries.push(entry);}
manifest.connected_projection_templates=extras.map(e=>e.id);
fs.writeFileSync(path.join(dir,'source-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
for(const[locale,field]of[['en','english'],['ja','japanese']])fs.writeFileSync(path.join(dir,locale+'.json'),JSON.stringify(Object.fromEntries(manifest.entries.map(e=>[e.id,e[field]])),null,2)+'\n');
console.log(JSON.stringify({catalog_entries:manifest.entries.length,projection_templates:extras.length,static_native_connections:manifest.connections.length,settings_bindings:manifest.options.length}));
