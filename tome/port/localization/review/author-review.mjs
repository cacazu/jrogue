// GPL-3.0-or-later. Static editorial review of exact source/tag records.
// This script never changes original sources, catalogues, or gameplay behavior.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const directory=import.meta.dirname;
const bytes=fs.readFileSync(path.join(directory,'review-inputs.json'));
const input=JSON.parse(bytes.toString('utf8'));
const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');
const overrides=new Map([
 [1,'；暗闇を消す'],
 [4,'#GREY#表示するアクターがありません#LAST#'],
 [5,'#LIGHT_BLUE#ベースオブジェクト#LAST#'],
 [6,'#ORANGE#ランダムアーティファクト#LAST#'],
 [8,'アイテムのリゾルバーは、追加のフィルター項目を解釈してアイテムを生成し、配置先を決定します。'],
 [9,'コルベック医師の実験記録・第四部'],
 [10,'DEBUG -- ランダムアクターを生成'],
 [11,'ランダムアーティファクトを死亡時にドロップ'],
 [12,'フィルター／データ／リゾルバーのリファレンス'],
 [13,'アクターをレベルアップします。\n必要に応じて能力値を設定し、習得可能な全タレントを習得し、レベルアップで使うポイントを獲得できます。\n変更前にアクターのバックアップを保存します。（「復元」ボタンで元に戻せます。）\n'],
 [14,'死亡時にドロップするランダムアーティファクトをメインの所持品に追加します。ベースオブジェクトまたはベースフィルターと、ランダムアーティファクト用データを入力に使います。'],
 [21,'DEBUG -- アクターのレベルアップ：[%s] %s'],
 [26,'、'],
 [30,'（死体は子供たちの遊び道具にされた）'],
 [31,'コルベック医師の実験記録・第一部'],
 [32,'ランダムアーティファクトを死亡時にドロップ（自動データ）'],
 [35,'フィルターに従ってアクターをランダム生成し、データテーブルに基づいてランダムボスを作成します。\nフィルターはgame.zone:checkFilterが解釈します。\n#ORANGE#ボスデータ：#LAST#はgame.state:createRandomBoss、game.state:applyRandomClass、Actor.levelupClassが解釈します。\n生成には、現在のゾーンの#LIGHT_GREEN#npc_list#LAST#を使います。処理は_G環境（Luaコンソールと同じ環境）で行います。\n#GOLD#\'F1\'#LAST#を押すとヘルプを表示します。\n各コントロールにマウスを重ねると、アクターのプレビューを表示します（レベルに配置する際、さらに調整される場合があります）。\n（#GOLD#\'L\'#LAST#でLuaによる詳細確認、#GOLD#\'C\'#LAST#でキャラクターシートを開きます。）\n\n#LIGHT_BLUE#ベースフィルター#LAST#は、ランダム生成するアクターの絞り込みに使います。'],
 [39,'%i%s %s%s'],
 [40,'%s%s'],
 [42,'座標 (%s, %s)%s に落とす'],
 [46,'周囲の死に活力を与えられます。命を奪うたびに、速度が%d%%となる効果を%dターン得ます。'],
 [51,'コルベック医師の実験記録・第三部'],
 [52,'リゾルバーを選択'],
 [63,'%s・%s： '],
 [65,'射程%d；パワー%d；持続%d'],
 [70,'（見本のアイテムを使う場合は0）'],
 [74,'#ORANGE#ランダムアーティファクト用データ：#LAST# '],
 [76,'工士アイテムを取り付ける'],
 [79,'選択オブジェクトをクリア'],
 [80,'コルベック医師の実験記録・第二部'],
 [82,'フィルターに従ってオブジェクトをランダム生成し、ランダムアーティファクトを作成します。\n「生成」でオブジェクトを作成し、プレビューや詳細確認を行えます。\n「オブジェクト追加」で配置先を選び、ゲームに追加します。\n各コントロールにマウスを重ねると、生成されたオブジェクトや処理対象のアクターのプレビューを表示します（#GOLD#\'L\'#LAST#でLuaによる詳細確認）。\n#SALMON#リゾルバー#LAST#は、処理対象のアクター（初期値：プレイヤー）に作用し、オブジェクトを一つ生成します。\n特に指定がなければ#LIGHT_GREEN#ランダムフィルター#LAST#を入力に使い、オブジェクトの配置先を制御します。\nフィルターはToMEとエンジンのエンティティ／オブジェクト生成関数（game.zone:checkFilterなど）が解釈します。\nテーブルの解釈は、現在のゾーンの#YELLOW_GREEN#object_list#LAST#を使い、_G環境（Luaコンソールと同じ環境）で行います。\nホットキー：#GOLD#\'F1\'#LAST#は状況に応じたヘルプ、#GOLD#\'C\'#LAST#は処理対象のキャラクターシート、#GOLD#\'I\'#LAST#は処理対象の所持品です。\n'],
 [83,'インペリウムの使者'],
 [86,'極性弾'],
 [90,'ようこそ #LIGHT_GREEN#@name@#WHITE#。\nあなたは、人々に恐れられるオークの一族だ。\n［原文の未完成箇所：BLAH BLAH BLAH］\n\nあなたは、この大陸に残る人間・エルフ・ドワーフの最後の砦、太陽の壁の前哨基地を叩き潰すため、東方の南西海岸沖にある離島へと派遣された。\n\n少し南に行けば前哨基地がある。任務は、それを破壊し、そこに住む者たちの血を浴びることだ！\n'],
 [96,'%i%s %i%s %i%s %s%s'],
 [103,'現在のボスアクター：%s'],
 [106,'半径%d；パワー%d；持続%dターン%s'],
 [108,'処理対象のアクターを設定：[%s] %s%s'],
 [109,'#LIGHT_BLUE#ベースフィルター#LAST#は、ランダムアーティファクトの作成に使うベースオブジェクトを生成します。'],
 [110,'宇宙循環が拡張中は、その範囲内の生物が%d%%の確率で老化の影響を受け、3ターンの間、移動不能・盲目・混乱のいずれかになります。\n\t\t宇宙循環が収縮中は、その範囲内の生物が若返りの影響を受け、最も高い三つの能力値が%d低下します。\n\t\t発生率と能力値の低下量は魔法パワーに依存します。'],
 [111,'時間と空間から位相をずらした射撃を放ち、ほぼ完全にアーマーを無視します。対象には武器ダメージの%d%%に相当する時空ダメージを与えます。'],
 [113,'周囲の時間を一時停止し、その間に一発撃って%d%%のダメージを与えます。\n\t\tダメージは逆説値に依存し、投入したタレントポイントが多いほどクールダウンが短くなります。'],
]);
const notes=new Map([
 [0,'All 68 captured owners use the empty literal as an intentional blank field/description. Preserve empty Japanese as present, never null or English fallback.'],
 [1,'Optional suffix follows short-info duration in row 106. Japanese semicolon connects labels; absent branch remains empty.'],
 [2,'Authored Korbek proper-name spelling and fourth-part heading harmonized with rows 9/28/31/50/51/72/80. All narrative paragraphs retained.'],
 [3,'Resolved means the example after object resolvers ran, not quest completion.'],
 [4,'Display label uses アクター consistently with existing reviewed Random Actor/Base Actor controls; no class identifier changes.'],
 [5,'Named debug field standardized to ベースオブジェクト; references in help use the same name.'],
 [6,'Randart abbreviation expanded to ランダムアーティファクト throughout the pending developer UI.'],
 [7,'Source chooses greater_ego, so 上位エゴ distinguishes it from ordinary エゴ. Internal property remains unchanged.'],
 [8,'Resolver interprets generation filters and destination, so visible リゾルバー is retained as a developer concept.'],
 [9,'Same exact authored proper-name/part heading as row 2. Official upstream transliteration is not asserted.'],
 [10,'Matches existing reviewed アクター terminology; DEBUG retained as a technical mode label.'],
 [11,'Resolver choice is drop_randart; it adds a death-dropped artifact rather than immediately placing it on the floor.'],
 [12,'Visible resolver terminology standardized; underlying functions/data are unchanged.'],
 [13,'Stat levels, talent learning, spendable points and pre-edit backup are distinct operations; Restore matches row 23.'],
 [14,'Death drop, main inventory, and Base Object OR Base Filter plus Randart Data preserved. Named controls standardized.'],
 [15,'I accelerator retained as a colored Latin key next to Japanese inventory label. No key-handler edit.'],
 [16,'Creator rendered 創造主 as a named role; sorcerer destruction and still-open Void portal remain distinct.'],
 [17,'Whitespace-only short-info joiner. Intentionally language-neutral; not an English prose fallback.'],
 [18,'All 17 captured owners use a leading separator plus supplied description fragment; retain argument and separator without translating external values.'],
 [19,'Minimum field widths %-11s/%3s have no precision truncation. Markup and order retained; pixel alignment requires eventual real renderer review.'],
 [20,'Object cooldown description supplies translated turn label and closing parenthesis; wrapper itself is language-neutral.'],
 [21,'アクター and both UID/name values consistent with the surrounding advancement dialog.'],
 [22,'動く刃 describes the animated blade summon without inventing an attested Japanese proper name. Fifteen turns retained.'],
 [23,'Backup name and v%d revision marker are dynamic; 復元 matches advancement help.'],
 [24,'ランダムフィルター names the normal-object random-generation control.'],
 [25,'Generated Lua COMMENT header only. Preserve -- and exact leading/trailing newlines; translated words do not become executable identifiers.'],
 [26,'Final enumeration joiner in table.concatNice(points, ", ", ...); Japanese comma avoids an unnatural additive sentence.'],
 [27,'Race substitution token retained exactly; Orc Pride is the orc tribe, not emotional pride. Insulting speaker register retained.'],
 [28,'Authored Korbek heading harmonized with the four parts; narrative scope and atrocities retained without invented lore.'],
 [29,'Ordinary equipment ego and upper-tier ego prompts remain distinct.'],
 [30,'Native Japanese death template appends killer_message directly to killer name. Parenthetical suffix yields readable composition and retains the fate of the victim’s body.'],
 [31,'Matches first-part body heading; コルベック is an authored consistent spelling, not a claim of official Japanese.'],
 [32,'Death-drop resolver and automatic data distinguished from immediate floor placement.'],
 [33,'Equipment ego developer concept retained as エゴ.'],
 [34,'greater_ego uses 上位エゴ consistently with row 7.'],
 [35,'All exact Lua API/variable names and F1/L/C keys retained. アクター, ボスデータ, ベースフィルター agree with existing reviewed controls.'],
 [36,'Dynamic talent name, signed cooldown reduction and translated turn label retain exact original order and %+d(-) syntax.'],
 [37,'All known bundled source paths are ASCII; %-10.60s preserved for native contract. Custom Unicode filenames exceeding 60 UTF-8 bytes remain a concrete extension concern.'],
 [38,'Confirmed unsafe C-string precision: %-8.8s truncates official スタミナ (12 UTF-8 bytes) after eight bytes. Explicit locale-specific %s adjustment proposed separately.'],
 [39,'minute value/unit and second value/unit pairs concatenated; official singular/plural units both map to 分 and 秒.'],
 [40,'Second value/unit pair concatenated; %s accepts the original numeric seconds without changing its type.'],
 [41,'Full trap info states proximity activation within range one, distinct from effect radius five. Temporal uses official 時空.'],
 [42,'Both %s are actor.x/actor.y; suffix marks player. Corrected misleading literal @ marker to explicit coordinate label.'],
 [43,'Contracting-to-expanding missile and expanding-to-contracting lifeline braid remain distinct. 宇宙循環 shared with rows 44/45/110.'],
 [44,'Paradox crosses any 100-point boundary, not only value 100. Willpower bonus applies to Paradox calculations.'],
 [45,'Entering expanding cycle heals next turn; leaving contracting cycle reduces ONE detrimental effect next turn. No all-effects claim.'],
 [46,'Formatter passes 100 + getSpeed, so %d is resulting speed, not a percent bonus. on_kill sets an effect for getDuration=3; no unsupported cumulative-extension claim.'],
 [47,'Pity installs its range value and resets visibility cache. Original English does not state inclusive comparison; translation deliberately does not invent >= or <=.'],
 [48,'Generated old-translation Lua comment marker; --/newlines preserved.'],
 [49,'Formatting-only bold marker around the death message. Preserve unchanged; no prose content to translate.'],
 [50,'Third-part Korbek heading harmonized; experimental details and sequence retained.'],
 [51,'Matches third-part body heading and other three part headings.'],
 [52,'Actual Dropdown controls resolver choice, so useful Japanese selection label replaces the upstream generic placeholder.'],
 [53,'DebugMain weakdamage toggles EFF_WEAK_GODMODE; effect describes damage reduction. ダメージ低減モード matches the actual action.'],
 [54,'Effect subtype is localized by _t(..., "entity subtype") before insertion. Neutral bullet/color wrapper retained.'],
 [55,'Two owners supply compass direction or unlearnable reason; neutral parenthesis wrapper retains supplied localized/external fragment.'],
 [56,'Closing cooldown/turn-unit parenthesis fragment retained with leading separator.'],
 [57,'data.msg is external chat/death-link text; preserve the value unchanged inside color markup.'],
 [58,'Gold title/newline/body tooltip wrapper retains both supplied values; supplied labels/description route localization separately.'],
 [59,'Power/max-power ratio is numeric and language-neutral; retain slash and red markup.'],
 [60,'Fixed one-decimal percentage is language-neutral; escaped %% retained.'],
 [61,'Stat scaling percent followed by already localized short stat label. No argument reorder or invented noun.'],
 [62,'Here %s displays effect.hits; wrapper is numeric rather than an English message or a translated username.'],
 [63,'Shared route has resource/cost in one owner and action/resource in two others. Neutral middle dot supports both roles without possessive の or argument reorder.'],
 [64,'Confirmed unsafe eight-byte resource-name precision; second argument is official Japanese resource name. Explicit %s%s replacement proposed separately.'],
 [65,'Compact range/power/duration labels; data.dur is passed. No new unit inserted into a source with abbreviated dur.'],
 [66,'Dynamic data.dur barrier duration and fixed ten-turn stat changes both retained. Native action actually uses EFF_SENSE=5, a source description/mechanic mismatch recorded separately.'],
 [67,'Official entity-name catalogue attests ghast=ガースト, correcting ガスト. Ghoul/ghoulking and timing/counts/order retained; optional next-free-ghoul fragment already has its own runtime hook.'],
 [68,'Generated untranslated-section Lua COMMENT marker retained as a comment, not code or executable identifier.'],
 [69,'Numberbox changes BONUS stats, not base stats. Label preserves that distinction.'],
 [70,'Optional suffix follows localized Enter 1-100%s; parenthesis makes Japanese instruction complete while preserving example=0 branch.'],
 [71,'Gumlarat title/body agree; Korbek title harmonized. Doping infusion, pain and tribe leaders retained. Transliteration explicitly authored.'],
 [72,'Second-part header harmonized with other parts. Infusion follows existing ハーブ物 terminology, and Pride denotes tribe/group.'],
 [73,'Source steal interpreted as evident steel typo in grass; light, poison, female paladin and plea all retained. Activation is not changed.'],
 [74,'Named ランダムアーティファクト用データ control used consistently in its help.'],
 [75,'Official エアリン spelling retained; report of troop dispatch not changed into player task.'],
 [76,'Uses 工士アイテム to agree with already approved sibling Tinker will be attached to a worn object. No DLC resolver/code name changes.'],
 [77,'Ongoing birth process is an object description/action text, faithfully translated without activating old content.'],
 [78,'Matches Gumlarat report heading; spelling is authored and documented, not claimed official.'],
 [79,'Both controls clear their current generated/base-object selection; translation does not imply deleting world entities.'],
 [80,'Matches second-part body heading and the other three parts.'],
 [81,'Resolver menu no-op choice, not an instruction to globally disable resolvers.'],
 [82,'All Lua identifiers and F1/L/C/I keys retained. Fixed unmatched punctuation in Japanese prose; single-object generation and destination selection retained.'],
 [83,'Game.lua debug test creates a courier named Imperium courrier; proper designation retained as authored インペリウム, obvious courier typo interpreted.'],
 [84,'Existing Numberbox describes maximum talent points allowed; 許容最大値 retains limiting role.'],
 [85,'Legacy zone name localized; no data activation or restoration is implied.'],
 [86,'Bolt is a magical projectile, so authored 極性弾 avoids implying a physical arrow or electrical-voltage unit.'],
 [87,'Quest-completion sentence preserves the negative moral description.'],
 [88,'Malicious eyes, accelerated growth, forming muscles and claws retained; not rewritten as a different NPC.'],
 [89,'Exact selector purpose names resolver selection and agrees with the menu label.'],
 [90,'Source literally contains BLAH BLAH BLAH. Japanese explicitly labels this unfinished source section; no invented replacement lore or complete-intro claim. @name@ preserved.'],
 [91,'Official エアリン spelling; player decision to report remains distinct from dispatch result in row 75.'],
 [92,'Official シェール・タル and 吸魔の杖 reused. Godslayer translated as named role 神殺し; no invented quest continuation.'],
 [93,'Developer suffix preserves selected resolver parameter and leading separator.'],
 [94,'Exact game.state:generateRandart identifier retained; input parameters and fallback Base Object semantics unchanged.'],
 [95,'Selected resolver status label matches the selector and explanatory help.'],
 [96,'Four value/unit pairs concatenate Japanese units, keeping all eight conversion types/order. Official singular/plural units share Japanese forms.'],
 [97,'Shared damage wrapper retains color/amount/label order. Three owners supply localized damage/to-psi labels; fourth passes raw "dream" and requires explicit producer localization separately.'],
 [98,'Descriptive Heroism thresholds and literal percentages retained exactly. Original formatter calculates bonuses from current missing life; no balance changes or legacy activation.'],
 [99,'Two lightning damage bounds then duration retained; teleport/ignore once per turn kept, not described as permanent immunity.'],
 [100,'Teleport range argument is data.range + data.inc_stat; preserved as range rather than guaranteed distance.'],
 [101,'First-effect certainty and diminishing subsequent purge chance preserved; maintained save bonus and one-trance restriction retained.'],
 [102,'Two telekinetic strikes precede physical attack. Stat substitution affects that attack, and active auras extend for that attack only.'],
 [103,'ボスアクター agrees with existing Random Actor/Base Actor terminology; supplied name is preserved.'],
 [104,'Original passes one boost to both atk and crit_chance; no percent sign added to an unspecified-unit source.'],
 [105,'Original passive declaration supplies only getPower/info and no healing callback. Translation preserves source ambiguity about total/per-turn regeneration; no invented mechanics.'],
 [106,'Three numeric labels followed by optional row-1 darkness suffix; fully reviewed combined Japanese composition.'],
 [107,'No-turn attack and cooldown reduction retained. Original action restores old energy; no additional attack mechanics invented.'],
 [108,'UID/name/player suffix retain exact order; 処理対象のアクター agrees with existing approved two-argument sibling.'],
 [109,'Base Filter generates the Base Object for Randart construction, not an ordinary random-object filter.'],
 [110,'宇宙循環 and 拡張/収縮 harmonized with related descriptions. Three-turn aging effects and highest-three stat loss remain distinct.'],
 [111,'Temporal corrected to official 時空; armour bypass and weapon-percent damage retained.'],
 [112,'Probability of not triggering traps retained; declaration changes trap_avoidance by 14 per raw level.'],
 [113,'Paradox corrected to official 逆説値; source damage/cooldown description retained without reimplementing old talent.'],
 [114,'Two bodies share one healthpool; source tree swap and all-resistance bonus retained. Original action is a no-op, recorded as source incompleteness separately.'],
]);
const neutral=new Set([0,17,18,20,36,49,54,55,56,57,58,59,60,61,62,97]);
const formatProposals=new Map([
 [38,{japanese:'%s：',from:'%-8.8s',to:'%s',argument_index:1}],
 [64,{japanese:'%s%s： #00ff00#%s ',from:'%-8.8s',to:'%s',argument_index:2}],
]);
function heading(value,title){const marker='#{normal}#';const end=value.indexOf(marker);return '#{bold}#'+title+value.slice(end);}
function reviewedText(row){
 const i=row.review_index;
 if(overrides.has(i))return overrides.get(i);
 if([2,28,50,72].includes(i))return heading(row.japanese,{2:'コルベック医師の実験記録・第四部',28:'コルベック医師の実験記録・第一部',50:'コルベック医師の実験記録・第三部',72:'コルベック医師の実験記録・第二部'}[i]);
 if(i===67)return row.japanese.replaceAll('ガスト','ガースト');
 if(i===71)return row.japanese.replace('診療師コルベックの遺体','コルベック医師の遺体');
 return row.japanese;
}
function printf(value){return [...value.matchAll(/%(?:[-+ #0]*\d*(?:\.\d+)?[cdiouxXeEfgGqs]|%)/g)].map(match=>match[0]);}
function markup(value){return [...new Set(value.match(/#[A-Za-z_]+#|#\{[^}]+\}#|#[0-9A-Fa-f]{6}#|@[A-Za-z_.]+@/g)??[])].sort();}
const entries=input.entries.map(row=>{
 const i=row.review_index,proposal=formatProposals.get(i);
 const japanese=proposal?.japanese??reviewedText(row);
 const sourceFormat=printf(row.source),targetFormat=printf(japanese);
 const diagnostics=[];
 if(!proposal&&JSON.stringify(sourceFormat)!==JSON.stringify(targetFormat))diagnostics.push('unexpected_printf_contract_difference');
 if(JSON.stringify(markup(row.source))!==JSON.stringify(markup(japanese)))diagnostics.push('markup_or_substitution_token_difference');
 if(japanese.includes('\ufffd'))diagnostics.push('replacement_character');
 if(!notes.has(i))diagnostics.push('missing_explicit_review_decision');
 return {review_index:i,batch:row.batch,index:row.index,source:row.source,tag:row.tag,current_ids:row.current_ids,source_locations:row.source_locations,
  japanese,review_status:proposal?'format_adjustment_proposed':'reviewed',translation_kind:neutral.has(i)?'intentional_language_neutral_or_empty':'authored_japanese',
  notes:notes.get(i),prior_notes:row.notes,provenance:{kind:'source_context_editorial_review',review_input_sha256:sha256(bytes),source_commit:input.source_commit,
  source_files:row.contexts.map(context=>({file:context.file,line:context.line,sha256:context.source_sha256}))},
  printf_contract:{source_specifiers:sourceFormat,target_specifiers:targetFormat,argument_order:'preserved'},
  ...(proposal?{format_adjustment:{kind:'remove_byte_precision_for_japanese_resource_name',from:proposal.from,to:proposal.to,argument_index:proposal.argument_index,argument_type:'s',approved_for_merge:false}}:{}),
  static_diagnostics:diagnostics};
});
const approved=entries.filter(entry=>entry.review_status==='reviewed');
const proposals=entries.filter(entry=>entry.review_status==='format_adjustment_proposed');
const en={},ja={},proposedJa={};
for(const entry of approved)for(const id of entry.current_ids){en[id]=entry.source;ja[id]=entry.japanese;}
for(const entry of proposals)for(const id of entry.current_ids)proposedJa[id]=entry.japanese;
const followups=[
 {kind:'format_contract',review_indexes:[38,64],severity:'known_japanese_utf8_corruption',required_change:'Accept exactly these per-ID removal-of-byte-precision contracts and validate native formatter + Rust resolver + actual renderer. Preserve argument type/order and markup; do not loosen all formatting checks.',evidence:{source:'src/lua/lstrlib.c',lines:[799,801,810],official_stamina:{source:'Stamina',japanese:'スタミナ',utf8_bytes:12,truncation_bytes:8,official_file:'game/modules/tome/data/locales/ja_JP.lua',official_line:20933}}},
 {kind:'unhooked_parameter',review_indexes:[97],file:'game/modules/tome/data/timed_effects/other.lua',line:3185,english:'dream',japanese:'夢',required_change:'At the DEATH_DREAM damage-label producer, resolve the third argument with an explicit semantic ID / _t route. Keep the shared template language-neutral. Existing original Japanese registration dream -> 夢 can be reused.',official_reference:{file:'game/engines/default/data/locales/engine/ja_JP.lua',line:63,tag:'nil'},source_edit_proposal:'Replace only the third argument literal "dream" at this exact producer with an explicit contextual text lookup; no global replacement.',completed:false},
 {kind:'source_description_mechanics_mismatch',review_indexes:[66],file:'game/modules/tome/data/talents/misc/inscriptions.lua',line:1206,details:'Taint: Telepathy action installs EFF_SENSE for 5 turns but its info uses data.dur; WEAKENED_MIND is fixed 10 turns. Japanese preserves original distinct durations; this is an upstream contract discrepancy, not a missing translation.'},
 {kind:'original_unfinished_content',review_indexes:[90,105,114],details:'Original orc intro contains literal BLAH BLAH BLAH; malleable-body passive has no healing callback and splitting action immediately returns true. The retained-source port must not claim these descriptions prove implemented gameplay.'},
 {kind:'unicode_extension_filename_precision',review_indexes:[37],details:'Known source paths are ASCII; custom addon/source filenames over 60 UTF-8 bytes may be split by %-10.60s. Keep a per-owner Unicode-safe rendering followup separate from current retained known corpus.'},
 {kind:'renderer_layout_pending',review_indexes:[15,19,35,82],details:'Static review preserves accelerators, markup and long help content. CJK pixel alignment, wrapping, keyboard focus and mobile behavior still require an actual native/browser renderer; no such tests were run in this held source-only task.'},
];
const summary={schema_version:1,source_commit:input.source_commit,input_source_tag_pairs:input.source_tag_pairs,input_semantic_ids:input.semantic_ids,
 reviewed_source_tag_pairs:approved.length,reviewed_semantic_ids:Object.keys(ja).length,
 format_adjustment_source_tag_pairs:proposals.length,format_adjustment_semantic_ids:Object.keys(proposedJa).length,
 intentional_neutral_or_empty_source_tag_pairs:approved.filter(entry=>entry.translation_kind==='intentional_language_neutral_or_empty').length,
 retained_empty_semantic_ids:Object.values(ja).filter(value=>value==='').length,
 static_diagnostics:entries.flatMap(entry=>entry.static_diagnostics.map(diagnostic=>({review_index:entry.review_index,diagnostic}))),
 execution:'source/data transformation only; no tests, build, gameplay execution, catalog merge or publication',memory:process.memoryUsage()};
function write(file,value){fs.writeFileSync(path.join(directory,file),JSON.stringify(value,null,2)+'\n');}
write('review-decisions.json',{schema_version:1,source_commit:input.source_commit,summary,entries,followups});
write('translation-reviewed.json',approved);
write('format-adjustment-proposals.json',proposals);
write('en-reviewed.json',en);
write('ja-reviewed.json',ja);
write('ja-format-proposals.json',proposedJa);
write('review-summary.json',summary);
write('followups.json',followups);
console.log(JSON.stringify(summary));
