"""Source-identified Angband biography catalog. No game data is modified."""
from pathlib import Path
import argparse, hashlib, json, re
ROOT=Path(__file__).resolve().parents[2]
OUT=Path(__file__).resolve().parent
SOURCE=ROOT/'data/gamedata/history.txt'
COMMIT='f3082213b73f3e463e3d0d60bff4b00462beae6e'
# Per-chart authored semantic choice names and Japanese grammar components.
# Native English, threshold and successor come only from the pinned source.
AUTHORED={
1:('human_child_relation', ['unacknowledged_illegitimate','acknowledged_illegitimate','several_children','first_child'], ['の婚外子で、親から認知されていません。','の婚外子で、親から認知されています。','の子どもの一人です。','の第一子です。']),
2:('human_parent_status',['serf','yeoman','townsman','guildsman','landed_knight','titled_noble','royal_line'],['農奴','自作農','町人','職人組合員','領地を持つ騎士','爵位を持つ貴族','王族']),
3:('human_family_reputation',['black_sheep','credit','well_liked'],['あなたは一族の厄介者です。','あなたは一族の誇りです。','あなたは周囲から好かれる子どもです。']),
4:('half_elf_parent_lineage',['mother_avari','father_avari','mother_nandor','father_nandor','mother_sindar','father_sindar','mother_noldor','father_noldor'],['あなたの母親はアヴァリの出身です。','あなたの父親はアヴァリの出身です。','あなたの母親はナンドールの出身です。','あなたの父親はナンドールの出身です。','あなたの母親はシンダールの出身です。','あなたの父親はシンダールの出身です。','あなたの母親はノルドールの出身です。','あなたの父親はノルドールの出身です。']),
5:('elf_child_relation',['several_children','only_child'],['の子どもの一人です。','の一人っ子です。']),
6:('elf_parent_lineage',['avarin','nandorin','sindarin'],['アヴァリの','ナンドールの','シンダールの']),
7:('high_elf_child_relation',['several_children','only_child'],['の子どもの一人です。','の一人っ子です。']),
8:('high_elf_parent_lineage',['telerin','noldorin','vanyarin'],['テレリの','ノルドールの','ヴァンヤールの']),
9:('elf_parent_profession',['ranger','archer','warrior','mage','prince','king'],['野伏','射手','戦士','魔術師','公子','王']),
10:('hobbit_child_relation',['several_children','only_child'],['の子どもの一人です。','の一人っ子です。']),
11:('hobbit_parent_profession',['burglar','miller','tavern_owner','archer','warrior','shirriff','mayor','clan_elder'],['盗人','粉ひき','酒場の主人','射手','戦士','庄の警官','町長','一族の長老']),
13:('gnome_child_relation',['several_children','only_child'],['の子どもの一人です。','の一人っ子です。']),
14:('gnome_parent_profession',['beggar','braggart','prankster','warrior','mage'],['物乞い','ほら吹き','いたずら者','戦士','魔術師']),
16:('dwarf_child_relation',['two_children','only_child'],['の二人の子どもの一人です。','の一人っ子です。']),
17:('dwarf_parent_profession',['thief','prison_guard','miner','warrior','priest','king'],['盗人','牢番','鉱夫','戦士','僧侶','王']),
18:('dwarf_family_reputation',['black_sheep','credit','well_liked'],['あなたは一族の厄介者です。','あなたは一族の誇りです。','あなたは周囲から好かれる子どもです。']),
19:('half_orc_parent',['mother_orc','father_orc'],['あなたの母親はオークで、','あなたの父親はオークで、']),
20:('half_orc_acknowledgement',['acknowledged','unacknowledged'],['その事実は認められています。','その事実は認められていません。']),
21:('half_troll_parent',['mother_stone_troll','father_stone_troll','mother_cave_troll','father_cave_troll','mother_water_troll','father_water_troll'],['あなたの母親は岩トロルの','あなたの父親は岩トロルの','あなたの母親は洞窟トロルの','あなたの父親は洞窟トロルの','あなたの母親は水トロルの','あなたの父親は水トロルの']),
22:('half_troll_parent_profession',['cook','warrior','shaman','clan_chief'],['料理人でした。','戦士でした。','呪術師でした。','一族の長でした。']),
23:('kobold_litter_relation',['runt','member','largest'],['の中で最も小柄な子です。','の一匹です。','の中で最も大柄な子です。']),
24:('kobold_litter_size',['three','four','five','six','seven','eight'],['3匹きょうだい','4匹きょうだい','5匹きょうだい','6匹きょうだい','7匹きょうだい','8匹きょうだい']),
25:('kobold_father_profession',['fungus_farmer','hunter','warrior','shaman','tribal_chief'],['あなたの父親はキノコ農家で、','あなたの父親は狩人で、','あなたの父親は戦士で、','あなたの父親は呪術師で、','あなたの父親は部族長で、']),
26:('kobold_mother_role',['prisoner_of_war','cook','chief_harem'],['母親は戦争捕虜でした。','母親は料理人でした。','母親は部族長の側室の一人でした。']),
50:('human_eye_color',['dark_brown','brown','hazel','green','blue','blue_gray'],['濃い茶色','茶色','はしばみ色','緑色','青色','青灰色']),
51:('human_hair_texture',['straight','wavy','curly'],['まっすぐな','波打つ','カールした']),
52:('human_hair_color',['black','brown','auburn','red','blond'],['黒色','茶色','赤褐色','赤色','金色']),
53:('human_complexion',['very_dark','dark','average','fair','very_fair'],['非常に浅黒い','浅黒い','平均的な色合いの','色白の','非常に色白の']),
54:('elf_eye_color',['light_grey','light_blue','light_green'],['薄い灰色','薄い青色','薄い緑色']),
55:('elf_hair_texture',['straight','wavy'],['まっすぐな','波打つ']),
56:('elf_hair_and_complexion',['black_fair','brown_fair','blond_fair','silver_fair'],['黒色の髪と色白の肌','茶色の髪と色白の肌','金色の髪と色白の肌','銀色の髪と色白の肌']),
57:('dwarf_eye_color',['dark_brown','glowing_red'],['濃い茶色','輝く赤色']),
58:('dwarf_hair_texture',['straight','wavy'],['まっすぐな','波打つ']),
59:('dwarf_hair_color',['black','brown'],['黒色','茶色']),
60:('dwarf_beard_length',['one_foot','two_feet','three_feet','four_feet'],['1フィート','2フィート','3フィート','4フィート']),
61:('dwarf_complexion',['dark'],['浅黒い']),
62:('half_troll_eye_color',['slime_green','puke_yellow','blue_bloodshot','glowing_red'],['粘液のような緑色','吐しゃ物のような黄色','充血した青色','輝く赤色']),
63:('half_troll_hair_condition',['dirty','mangy','oily'],['汚れた','みすぼらしい','脂ぎった']),
64:('half_troll_hair_color',['seaweed_green','bright_red','dark_purple'],['海藻のような緑色','鮮やかな赤色','濃い紫色']),
65:('half_troll_skin_color',['green','blue','white','black'],['緑色','青色','白色','黒色']),
66:('half_troll_skin_condition',['ulcerous','scabby','leprous'],['潰瘍のある','かさぶただらけの','ハンセン病に侵された']),
67:('kobold_eye_color',['black','dark_brown','brown','light_brown','glowing_red'],['黒色','濃い茶色','茶色','薄い茶色','輝く赤色']),
68:('kobold_hide_color',['dark_brown','reddish_brown','olive_green','deep_blue'],['濃い茶色','赤褐色','オリーブ色','深い青色']),
69:('kobold_teeth',['large_flat','small_sharp','large_sharp'],['大きく平たい','小さく鋭い','大きく鋭い']),
}
# Source-native order in English, reviewed complete-statement order in Japanese.
GRAMMARS=[
('human_parentage','{child}{parent}','あなたは{parent}{child}',['child','parent']),
('elven_parentage','{child}{lineage}{parent}','あなたは{lineage}{parent}{child}',['child','lineage','parent']),
('hobbit_parentage','{child}{parent}','あなたはホビットの{parent}{child}',['child','parent']),
('gnome_parentage','{child}{parent}','あなたはノームの{parent}{child}',['child','parent']),
('dwarf_parentage','{child}{parent}','あなたはドワーフの{parent}{child}',['child','parent']),
('half_orc_parentage','{orc_parent}{acknowledgement}{adoptive_parent}','{orc_parent}{acknowledgement}あなたは{adoptive_parent}の養子です。',['orc_parent','acknowledgement','adoptive_parent']),
('half_troll_parentage','{troll_parent}{profession}','{troll_parent}{profession}',['troll_parent','profession']),
('kobold_litter','{litter_relation}{litter}','あなたは{litter}{litter_relation}',['litter_relation','litter']),
('kobold_parents','{father}{mother}','{father}{mother}',['father','mother']),
('human_appearance','{eyes}{texture}{hair}{complexion}','あなたは{eyes}の目と、{texture}{hair}の髪、{complexion}肌をしています。',['eyes','texture','hair','complexion']),
('elven_appearance','{eyes}{texture}{hair_and_complexion}','あなたは{eyes}の目と、{texture}{hair_and_complexion}をしています。',['eyes','texture','hair_and_complexion']),
('dwarf_appearance','{eyes}{texture}{hair}{beard}{complexion}','あなたは{eyes}の目と、{texture}{hair}の髪、長さ{beard}のひげ、{complexion}肌をしています。',['eyes','texture','hair','beard','complexion']),
('half_troll_appearance','{eyes}{texture}{hair}{skin_color}{skin_condition}','あなたは{eyes}の目と、{texture}{hair}の髪、{skin_color}で{skin_condition}肌をしています。',['eyes','texture','hair','skin_color','skin_condition']),
('kobold_appearance','{eyes}{hide}{teeth}','あなたは{eyes}の目と、{hide}の皮膚、{teeth}歯をしています。',['eyes','hide','teeth']),
]
def group(name,**params):return {'grammar_id':'history.grammar.'+name,'parameters':params}
def fragment(chart):return {'fragment_chart':chart}
human=[group('human_parentage',child=1,parent=2),fragment(3),group('human_appearance',eyes=50,texture=51,hair=52,complexion=53)]
PLANS={
1:human,4:[fragment(4)]+human,
5:[group('elven_parentage',child=5,lineage=6,parent=9),group('elven_appearance',eyes=54,texture=55,hair_and_complexion=56)],
7:[group('elven_parentage',child=7,lineage=8,parent=9),group('elven_appearance',eyes=54,texture=55,hair_and_complexion=56)],
10:[group('hobbit_parentage',child=10,parent=11),fragment(3),human[2]],
13:[group('gnome_parentage',child=13,parent=14),fragment(3),human[2]],
16:[group('dwarf_parentage',child=16,parent=17),fragment(18),group('dwarf_appearance',eyes=57,texture=58,hair=59,beard=60,complexion=61)],
19:[group('half_orc_parentage',orc_parent=19,acknowledgement=20,adoptive_parent=2),fragment(3),human[2]],
21:[group('half_troll_parentage',troll_parent=21,profession=22),group('half_troll_appearance',eyes=62,texture=63,hair=64,skin_color=65,skin_condition=66)],
23:[group('kobold_litter',litter_relation=23,litter=24),group('kobold_parents',father=25,mother=26),group('kobold_appearance',eyes=67,hide=68,teeth=69)]}
def generate():
 raw=SOURCE.read_bytes();rows=[]
 for number,line in enumerate(raw.decode('utf8').splitlines(),1):
  if line.startswith('chart:'):
   chart,next_chart,cutoff=map(int,line.split(':')[1:]);rows.append({'chart':chart,'successor':next_chart,'cutoff':cutoff,'source_chart_line':number,'english':'','source_phrase_lines':[]})
  elif line.startswith('phrase:'):
   assert rows,'phrase without chart';rows[-1]['english']+=line[7:];rows[-1]['source_phrase_lines'].append(number)
 by={}
 for row in rows:by.setdefault(row['chart'],[]).append(row)
 assert set(by)==set(AUTHORED)
 en={};ja={};entries=[]
 for chart,records in by.items():
  role,keys,japanese=AUTHORED[chart];assert len(records)==len(keys)==len(japanese),chart
  assert [r['cutoff']for r in records]==sorted(set(r['cutoff']for r in records))
  assert records[-1]['cutoff']==100
  for row,key,value in zip(records,keys,japanese):
   row['id']='history.fragment.'+role+'.'+key;row['japanese']=value;row['semantic_role']=role
   en[row['id']]=row['english'];ja[row['id']]=value
   entries.append({'id':row['id'],'english':row['english'],'japanese':value,'parameters':[],
    'source':{'file':'data/gamedata/history.txt','line':row['source_phrase_lines'][0]},'additional_sources':[{'file':'data/gamedata/history.txt','line':n}for n in row['source_phrase_lines'][1:]],
    'original_call':'phrase:'+row['english'],'source_kind':'gamedata_history_fragment','identity':{'chart':chart,'cutoff':row['cutoff'],'successor':row['successor']},
    'notes':'Japanese is a reviewed grammar component, not a standalone sentence; render through its complete statement plan. Native English spacing is exact and immutable.'})
 for key,e,j,params in GRAMMARS:
  id='history.grammar.'+key;en[id]=e;ja[id]=j
  assert set(re.findall(r'\{([a-z_]+)\}',e))==set(params)==set(re.findall(r'\{([a-z_]+)\}',j))
  entries.append({'id':id,'english':e,'japanese':j,'parameters':[{'name':p,'type':'localized_text'}for p in params],
   'source':{'file':'logic/player-birth.c','line':342},'source_kind':'authored_history_statement_grammar','original_call':'res = string_append(res, entry->text);',
   'notes':'Authored locale grammar over captured chart choices. EN preserves original source-fragment order and spacing; JA reorders complete semantic statements without parsing English.'})
 # UI projection is distinct from authored history's opaque parameter type.
 id='player.sheet.generated_history.value';en[id]='{history}';ja[id]='{history}'
 entries.append({'id':id,'english':'{history}','japanese':'{history}','parameters':[{'name':'history','type':'GeneratedHistory'}],
  'source':{'file':'logic/ui-player.c','line':871},'source_kind':'authored_history_projection','original_call':'text_out_to_screen(COLOUR_WHITE, player->history);',
  'notes':'Only positively captured versioned generated provenance. Old unknown and authored histories use separate provenance branches; never feed completed English to this descriptor.'})
 manifest={'schema_version':1,'upstream_commit':COMMIT,'upstream_version':'4.2.6','status':'source_connected_unbuilt','complete_game_translation':False,
  'grammar_version':1,'catalog_sha256':hashlib.sha256(raw).hexdigest(),'source':{'file':'data/gamedata/history.txt','sha256':hashlib.sha256(raw).hexdigest()},
  'id_policy':'Authored semantic role and choice name; unchanged chart/cutoff are independent canonical source identities, not hash IDs.',
  'coverage':{'fragment_records':len(rows),'charts':len(by),'grammar_templates':len(GRAMMARS),'projection_templates':1,'semantic_ids':len(entries)},
  'entries':entries,'records':rows,'composition_plans':{str(k):v for k,v in PLANS.items()},
  'provenance_policy':{'unknown':0,'generated':1,'authored':2,'max_choices':32,'max_native_bytes':65535,'legacy_save':'Absent metadata is unknown; do not infer provenance by matching English.'},
  'wording_notes':['Tolkien lineage names remain proper nouns transliterated consistently; source lineage identity is unchanged.','Shirriff is rendered as 庄の警官 for the Hobbit-specific local office.','Original beard lengths remain feet; no silent conversion.','Leprous skin is translated as the original condition; no additional disease rules or diagnosis are introduced.']}
 def encoded(o):return (json.dumps(o,ensure_ascii=False,indent=2)+'\n').encode('utf8')
 outputs={OUT/'en.json':encoded(en),OUT/'ja.json':encoded(ja),OUT/'source-manifest.json':encoded(manifest)}
 # Immutable identity table: English serves only corpus/provenance integrity,
 # never an English-to-Japanese lookup or replacement operation.
 lines=['/* Generated by migration/history-data/build_catalog.py. GPL-2.0-only. */', '#define AB_HISTORY_CATALOG_SHA256 "'+manifest['catalog_sha256']+'"', 'static const uint8_t ab_history_catalog_digest[32] = { '+', '.join('0x'+manifest['catalog_sha256'][i:i+2]for i in range(0,64,2))+' };', 'static const struct ab_history_record ab_history_records[] = {']
 for row in rows:lines.append(' { %d, %d, %d, %s, %s },'%(row['chart'],row['cutoff'],row['successor'],json.dumps(row['id']),json.dumps(row['english'])))
 lines+=['};',''];outputs[ROOT/'logic/web-history-data.h']='\n'.join(lines).encode()
 # The Rust identity graph contains no translated or native completed strings.
 lines=['// Generated canonical source graph; GPL-2.0-only.', 'const HISTORY_RECORDS: &[Record] = &[']
 for row in rows:lines.append(' Record { chart: %d, cutoff: %d, successor: %d, id: %s },'%(row['chart'],row['cutoff'],row['successor'],json.dumps(row['id'])))
 lines+= ['];',''];outputs[ROOT/'rust/src/history_data.rs']='\n'.join(lines).encode()
 return outputs,manifest
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');args=parser.parse_args()
 outputs,manifest=generate()
 for file,data in outputs.items():
  if args.check:assert file.read_bytes()==data,str(file)+' is stale'
  else:file.write_bytes(data)
 print(json.dumps({'passed':True,'check':args.check,**manifest['coverage'],'catalog_sha256':manifest['catalog_sha256']}))
