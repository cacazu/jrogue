"""Reproduce all 140 source-only authored diagnostic translations (NGPL).

Writes only impossible-diagnostic-batch-4.authored.json. Does not install a
catalog, modify C, compile, run a game, suppress/log/repair an error or publish.
"""
from __future__ import annotations
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import re
import sys

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
INPUT = HERE / "impossible-diagnostic-batch-4.json"
OUTPUT = HERE / "impossible-diagnostic-batch-4.authored.json"
PIN = "bb63bfec765aa9b0f005e7f45558159e4bca8b2da700019294a1f6ed1c4ee136"

# These are individually authored whole messages, in the frozen queue order.
# Tokens retain exact original printf conversions, widths and argument names.
JAPANESE = """unpaid_cost: 物品がどの請求書にも載っていなかった.
splitbill: 常駐する店主がいない??
splitbill: 請求書に載っていない?
請求書上の個数が負になっている??
請求書上の個数がゼロになっている??
sub_one_frombill: 未払いの物品が請求書に載っていない
売却への応答が不正
doinvbill: 店主がいない?
店主の管理情報が不正.
cad: 性別が不明
globby_bill_fixup が塊状でない物品に対して呼び出された
店の戸口はどこ?
shkname: "{arg_1:%s}" は店主ではない.
玉座の効果
get_location:  場所が見つからない!
create_door: 適切な場所が見つからない!
create_monster: モンスターには外見 "{arg_1:%s}" があるが、種類がない
create_monster: 地形 "{arg_1:%s}" が見つからない
create_monster: 物品 "{arg_1:%s}" が見つからない
create_monster: {arg_1:%s} が不正 ("{arg_2:%s}")
create_monster: モンスターの外見種別が未実装 [{arg_1:%d},"{arg_2:%s}"]
create_object: 容器の入れ子が深すぎる.
create_object: 不明な実績 ({arg_1:%s}"{arg_2:%s}")
ランダムな壁を起点または終点とする create_corridor
認識できない階の初期化方式.
get_mkroom_name: 不明な rtype {arg_1:%d}
不明な部屋の種類 '{arg_1:%s}'
sel_set_feature({arg_1:%i},{arg_2:%i},{arg_3:%i}): !isok
地形の種類パラメーターが不明.
新しい階の部屋が多すぎる!
領域を小部屋として設定
跳ね橋を作成できない.
mazewalk: 方向が不正
記憶した呪文が多すぎる!
不明な魔法書のレベル {arg_1:%d}, 魔法書 {arg_2:%d};
不明な呪文技能, {arg_1:%d};
不明な呪文 {arg_1:%d} を試みた.
tport_spell: 呪文帳がいっぱい
記憶した呪文が多すぎる!
呪文 {arg_1:%s} はすでに習得済み.
記憶した呪文が多すぎる
stealarm(): 死亡したモンスターによる窃盗
体に埋め込まれた鱗を取り外す?
窃盗に失敗!
妙な装備中の物品を盗もうとした. [{arg_1:%d}]
モンスター ({arg_1:%s}) が何もないのに受け取るか拾おうとしている?
モンスター ({arg_1:%s}) が取り付けられた {arg_2:%s} ({arg_3:%s}) を受け取るか拾おうとしている?
put_saddle_on_mon: 鞍の物品が参照されなくなるおそれがある
{arg_1:%s} を <{arg_2:%d},{arg_3:%d}> に配置しようとしている mstate:{arg_4:%lx} 階:{arg_5:%s}
{arg_1:%s} を地図上に配置している, mstate:{arg_2:%lx}, 階:{arg_3:%s}?
{arg_1:%s} を {arg_2:%s} の上の <{arg_3:%d},{arg_4:%d}> に配置している, mstates:{arg_5:%lx} {arg_6:%lx} 階:{arg_7:%s}?
{arg_1:%s} はリードにつながれているが、リードがない.
{arg_1:%s}
rloc(): モンスターを移動させられなかった
mlevel_tele_trap: 予期しない罠の種類 ({arg_1:%d})
卵はどこで孵化した? ({arg_1:%d})
burn_object: 予期しない物品 {arg_1:%s}
燃焼開始: 予期しない {arg_1:%s}
begin_burn: 物品の位置を取得できない
end_burn: 物品 {arg_1:%s} は点火されていない
end_burn: 物品 {arg_1:%s} にタイマーがない!
cleanup_burn: 物品 {arg_1:%s} は点火されていない
タイマーの種類がない
タイマーの整合性: タイマーのない物品 {arg_1:%s}, タイマー {arg_2:%lu}
タイマーの整合性: 物品 {arg_1:%s} [where={arg_2:%d}] の位置が見つからない, タイマー {arg_3:%lu}
タイマーの整合性: 物品 {arg_1:%s} [where={arg_2:%d}] が <{arg_3:%d},{arg_4:%d}> にある, タイマー {arg_5:%lu}
タイマーの整合性: 予期しないモンスターのタイマー {arg_1:%lu}
タイマーの整合性: 融解タイマー {arg_1:%lu} が氷以外の {arg_2:%d} <{arg_3:%d},{arg_4:%d}> にある
タイマーの整合性: 場所のタイマー {arg_1:%lu} が <{arg_2:%d},{arg_3:%d}> にある
タイマーの整合性: 予期しない全体のタイマー {arg_1:%lu}
タイマーの整合性: 不明なタイマー {arg_1:%lu}, 種類: {arg_2:%d}
重複する {arg_1:%s} を開始しようとしたため、中止した.
死因表示の形式が不正? ({arg_1:%d})
これは何という妙な職業? ({arg_1:%s})
記録ファイルを開けない!
erode_obj の劣化種別が不正
erode_obj({arg_1:%d}): 妙な装備状態の物品を破壊している [{arg_2:%d}, 0x{arg_3:%08lx}: {arg_4:%s}]
行き先が固定されたテレポートの罠を自分自身に向けて作成している
m_harmless_trap: 不明な罠 {arg_1:%i}
dotrap: {arg_1:%s} はこの階には存在できない.
mintrap: {arg_1:%s} はこの階には存在できない.
鉄の靴を装備し直したら壊れた?
immune_to_trap: モンスターが null
immune_to_trap: ttype が不正 {arg_1:%u}
{arg_1:%s} が種類 {arg_2:%d} の妙な罠に遭遇した.
乗騎が存在しない矢に当たった?
乗騎が存在しない投げ矢に当たった?
宝箱の罠解除のバグ
宝箱の罠が不正
lava_effects: '{arg_1:%s}' (#{arg_2:%u}) はすでに使用中; #{arg_3:%u} も使用中.
罠の整合性: 位置 ({arg_1:%i},{arg_2:%i})
罠の整合性: 種類 ({arg_1:%i})
hitum_cleave: 対象の方向が不明 [{arg_1:%d},{arg_2:%d},{arg_3:%d}]?
影への攻撃関数の処理経路が不正?
あなたの攻撃が妙だ ({arg_1:%d})
番人なしで金庫室から脱出している?
この階には廊下が一本もない?
金庫室の番人: 主人公の足元に金貨がない?
'complain'=True なのに 'filename'=Null の状態で check_version() が呼び出された
weapon_check {arg_1:%d} が {arg_2:%s} に対して設定されている?
weapon_dam_bonus: 技能が不正 {arg_1:%d}
skill_init: 現在の技能値 > 最大値: {arg_1:%s}
不明な獣人 {arg_1:%s}.
makemap_remove_mons: 'fmon' が空にならなかった?
sanity_check: 何もないものに飲み込まれている?
sanity_check: あなたがモンスターの上にいる
主人公の現在の体力 ({arg_1:%d}) が最大値を上回っている? ({arg_2:%d})
モンスターの姿の主人公の現在の体力 ({arg_1:%d}) が最大値を上回っている? ({arg_2:%d})
主人公の現在の魔力 ({arg_1:%d}) が最大値を上回っている? ({arg_2:%d})
levl[{arg_1:%i}][{arg_2:%i}] の視界遮蔽
wormgone: wormno が 0
cutworm: ({arg_1:%d},{arg_2:%d}) に節がない
ワームの節 <{arg_1:%d},{arg_2:%d}> を別のモンスターの上に配置している
ワームの節 <{arg_1:%d},{arg_2:%d}> を空の場所に置き直している
worm_sanity: モンスターが null!
worm_sanity: ワームではない!
wormno {arg_1:%d} が正しい尾なしに設定されている
ワームの節が isok を満たさない <{arg_1:%d},{arg_2:%d}>
節の位置にあるモンスター ({arg_1:%s}) はワーム ({arg_2:%s}) ではない
実体のないワームの尾 #0 [頭={arg_1:%s}, {arg_2:%d} 個の節; 尾={arg_4:%s}, {arg_5:%d} 個の節]
place_worm_tail_randomly: wormno が尾なしに設定されている!
place_worm_tail_randomly: 尾の節が <{arg_1:%d},{arg_2:%d}>, ワームが <{arg_3:%d},{arg_4:%d}> にある
worm_cross が隣接しない場所を調べている?
Setworn: mask=0x{arg_1:%08lx}.
装備スロットの不整合: {arg_1:%s}.
二刀流の不整合: {arg_1:%s}.
which_armor のフラグが不正
モンスターの所持品に含まれない物品に対して extract_from_minvent が呼び出された
そんな妙な巻物は書けない!
なんと興味深い効果 ({arg_1:%d})
つかまれていないのに release_hold?
{arg_1:%s} を蘇生させようとしている?
bhito: 物品が床にないうえ、石を肉に変える呪文でもない
なんと興味深い効果 ({arg_1:%d})
zapyourself: 物品 {arg_1:%d} を使用した?
weffects: 予期しない呪文または杖
melt_ice: 水たまりがない?
mon_spell_hits_spot に未対応のダメージ種別 ({arg_1:%d}).
maybe_destroy_item に予期しない dmgtyp {arg_1:%d}
destroy_item: 物品が複数の連結リストに入っている""".splitlines()

LEAVES = {
    "mimic appearance": "ミミックの外見",
    "Wizard appearance": "魔法使いの外見",
    "vampire shape": "吸血鬼の姿",
    "chameleon shape": "カメレオンの姿",
    "chain": "鎖",
    "ball": "球",
    "steed": "乗騎",
    "defunct monster": "死亡したモンスター",
    "attempt to teleport hero to be near a pet": "主人公をペットの近くへテレポートさせようとした",
    " on no-teleport level": "（テレポート禁止の階）",
    "You": "あなた",
    "Some monster": "あるモンスター",
}

SPECIAL = {
    9: "Administration means shopkeeper bookkeeping/management consistency, not a newly inferred hostile attitude or shop ownership.",
    11: "Original globby/non-globby object class condition and all billing recovery remain untouched; no blob merging is performed by translation.",
    13: "nam is the exact original noit_mon_nam fallback/completed public name before the invalid shopkeeper diagnostic. Do not call a normal/true-species name helper again.",
    17: "appear_as.str is the original Lua/special-level appearance property value; preserve its exact diagnostic value as literal configuration input, not a guessed translated species.",
    18: "Feature is the original requested special-level terrain/feature lookup value; keep the unknown configuration spelling exactly.",
    19: "The failed object lookup displays the original requested appearance/configuration text; do not replace it with a real/known object identity.",
    20: "arg_1 is one of four original terminal selected description literals; preserve the original chained predicates once. arg_2 is the original appearance property value. No second mimic/Wizard/vampire/chameleon query.",
    21: "Original integer appearance kind and exact quoted script value remain in the same [kind,\"value\"] structural order.",
    23: "lbuf is the original describe_level(lbuf,1|2) result, including its trailing-space/branch rules; arg_2 is the single original simpleonames. Both need original completed producer events, not raw untranslated-description exemptions.",
    28: "Retain the original selected integer argument from *(int*)arg and !isok technical predicate label. Do not call isok or repair coordinates in presentation.",
    40: "Original OBJ_NAME(objects[otyp]) pointer is the actual selected spell/object label, not a renderer lookup of object knowledge or another name query.",
    43: "Embedded scales means the original worn/merged dragon-scale state; do not infer another armor part or remove equipment in presentation.",
    46: "Original pmname(mtmp->data,Mgender(mtmp)) is captured once because this exact native diagnostic already emits it. No extra true-species or gender field is exported or queried.",
    47: "Original pmname and simpleonames are evaluated once in their original unspecified C order. arg_2 selects chain/ball at the original uchain comparison; do not add a metal, weight or attachment query.",
    48: "Could get orphaned is a possibility about the saddle object becoming unreferenced; the translation does not assert it was destroyed or already lost.",
    49: "minimal_monnam(mon,TRUE) includes its original debug pointer/location/shape details; retain only the complete original produced public diagnostic. mstate hexadecimal and describe_level(buf,0) are already supplied, with no new field/location queries. Preserve subsequent native x=y=0 recovery.",
    50: "Original mon==u.usteed selects steed; the other original accepted branch is DEADMONSTER and selects defunct monster. Only source-selected leaf IDs are translated; no second death/steed check, no species guess. Native early return remains.",
    51: "monnm/othnm are previously completed minimal_monnam values; othnm can be the originally selected 'itself'. mstates arg_5 is othermon->mstate and arg_6 is mon->mstate; retain their original order even though names appear in the opposite order. buf is the original describe_level result.",
    52: "Retain the inconsistency between mleashed and missing leash; no new inventory scan or leash repair.",
    53: "The two adjacent C literals form one selected arg_1 value. A source constructor must bind that complete concatenated literal once; individual token provenance is not permission to break C literal concatenation or match formatted English.",
    56: "The integer is egg->where storage-location kind, not newly inferred map coordinates.",
    57: "Capture the original xname(obj) once; no new lighting, burn, name, knowledge or state query.",
    58: "Capture the original xname(obj) once; begin burn is a diagnostic description, not a request to start burning again.",
    60: "Not lit is distinct from absent timer; retain the original already-produced object name and native cleanup flow.",
    61: "Not timed denotes missing native timing status, not a newly inferred elapsed burn duration.",
    62: "Original cleanup diagnostic and original English logging remain visible; translation performs no cleanup.",
    64: "obj_adr is the original fmt_ptr(obj) address string, a literal technical representation; do not reinterpret it as an object name. t_id remains unsigned long %lu.",
    65: "obj_adr is an already-formatted address, where is the original storage-kind integer, t_id is unsigned long. Capture supplied values once; no pointer dereference or get_obj_location retry.",
    66: "Preserve original pointer address, storage-kind, computed x/y and unsigned timer ID; no fresh world/location lookup.",
    68: "arg_2 is the original non-ice terrain type, not a count or duration. Retain melt timer ID and exact original coordinate pair.",
    72: "idbuf is composed at the original VERBOSE_TIMER conditional branch: selected timeout function identifier + ' timer', or selected kind_name + ' timer (%d)'. Descriptive kind/timer grammar needs its original producer descriptor; literal function identifiers retain proven technical spelling. No start_timer retry or duplicate deletion; native FALSE return remains.",
    73: "killer format is the death-report format code svk.killer.format, not a newly identified killer person.",
    74: "plch is the original role abbreviation/configuration value; keep its exact supplied code spelling, without a guessed role identity.",
    77: "Keep numeric erosion type, storage-kind, 0x prefix and unsigned long %08lx zero-padding, plus original simpleonames. No equipment-state fix or destruction is invoked by rendering.",
    78: "The fixed destination points to that same trap; do not move it or add an inferred level coordinate.",
    80: "The literal English plural suffix s is English-only morphology; JP uses the unchanged consumed trap-name slot without that suffix. Original trapname(trap->ttyp,TRUE) result/branch must supply the public semantic trap label once.",
    81: "The literal English plural suffix s is English-only morphology; JP uses the unchanged consumed trap-name slot without that suffix. Original trapname(tt,TRUE) result/branch must supply the public semantic trap label once.",
    85: "Original selected You/Some monster leaf owns the subject. Do not identify the real monster or rerun the gy.youmonst comparison during presentation.",
    90: "Preserve the already-in-use object name and both original unsigned IDs with their # delimiters; do not scan ownership/protection chains or clear protect_oid.",
    99: "complain, True, filename and Null are literal native parameter/value identifiers, proven by the exact source diagnostic. Keep the original contradiction and do not change version checking.",
    102: "curr > max is the original technical relation between current and maximum skill levels; P_NAME(skill) requires its original selected public skill-label descriptor.",
    103: "The original neutral pmnames pointer is already emitted by this diagnostic; capture that selected public label only. Lycanthrope denotes a were-creature, not an arbitrary beast or a newly inferred infection.",
    104: "fmon is the literal native monster-list identifier. Translate the fact that it was not emptied without clearing the list.",
    105: "Preserve the swallowed-without-a-swallower inconsistency; do not choose a species or perform a stuck-monster query.",
    108: "This is the hero's current monster-form HP and its own maximum, not ordinary HP or the swallowing monster's HP.",
    109: "Energy is the supplied hero magical-energy value and its maximum; no new recovery or mana calculation.",
    110: "levl and bracketed x/y remain literal native map indexing; the message reports vision blocking without recomputing it.",
    117: "Proper tail means a valid native tail list, not a new adjective about the worm's species or visible size.",
    119: "Both text slots are original fmt_ptr outputs for the occupants and worm, not monster name strings. Preserve raw technical address text; do not name or dereference either pointer again.",
    120: "head/tail pointers are original fmt_ptr values; integer segment counts remain. arg_3 and arg_6 are original plur(count) English suffixes; JP has no matching suffix. Both complete original consumed slots stay declared with explicit omission reasons and are still captured once.",
    124: "Setworn/mask and 0x are original diagnostic identifiers/hex syntax. Preserve exact unsigned long %08lx padding; do not normalize or edit equipment masks.",
    125: "whybuf is a completed diagnostic producer, not a free untranslated-error exemption. Its original selected Sprintf branches at worn.c376/379/382/399/417/420/423/426/429 need source-bound templates and original technical slot/pointer/mask/public-name arguments. Retain EXTRA_SANITY_CHECKS guards and all source unions.",
    126: "why is either the original composed missing uwep/uswapwep buffer or one selected shield/weapon/melee/two-handed/attack-capability description at worn.c441..463. Capture the actual accepted reason once with source IDs; no new equipment/type/could_twoweap checks and no English reason matching.",
    128: "minvent is the original monster inventory list; preserve the membership error without extracting or relinking an object.",
    131: "The hero is not held in the original inconsistency; rendering must not release or query a hold.",
    132: "Capture the original xname(corpse) once; attempting revival is distinct from successful revival and creates no entity during translation.",
    133: "Original guard is !(obj->where==OBJ_FLOOR || otmp->otyp==SPE_STONE_TO_FLESH): both permitted alternatives are absent. JP keeps both negated conditions, translating the Stone To Flesh spell title descriptively without performing an object transformation or changing the guard.",
    138: "Keep unsupported damage-type value and exact native mon_spell_hits_spot identifier; no fallback damage effect is selected by presentation.",
    140: "Chains are native linked object lists, not physical punishment chains. Preserve multiple-list membership without repairing links."
}

CAPTURE = [
    "Capture the exact original consumed arguments once at the original accepted native impossible channel; preserve C unspecified evaluation order, original predicates, pointer/name/grammar calls, type promotions, preprocessor guards, logging/fuzzer/panic/repair/return behavior and all native side effects.",
    "Diagnostic message ownership belongs only to the original first accepted formatted diagnostic emission. Do not steal a nested owner, translate ancillary failure instructions as this message, call impossible/repair/name/state/RNG/logging again, or manufacture a callback for a suppressed/inactive branch.",
    "Keep the exact whole original English fallback for missing/unproven/clipped/stale/invalid/unsupported producer events or formatter limits. No runtime rendered-English reverse mapping, extra field/query, unknown-name reconstruction or hidden real entity metadata.",
    "English remains original native history/log/filter text. JP formatting and locale/redraw use immutable source-issued ID+typed arguments without native getters or world/main/display RNG changes. Runtime C/Rust/Node/browser acceptance is separate and all runtime approvals here are false."
]


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def build() -> dict:
    data = INPUT.read_bytes()
    if sha(data) != PIN: raise ValueError("Frozen diagnostic input changed")
    batch = json.loads(data)
    if len(JAPANESE) != 140 or len(batch["entries"]) != 140:
        raise ValueError("Complete author count differs from frozen input")
    authored = []
    for number, (original, ja) in enumerate(zip(batch["entries"], JAPANESE, strict=True), 1):
        identity = original["id"]
        union = deepcopy(original["typed_arguments"])
        omitted = ([{"argument": key, "reason": "Original plur(count) English singular/plural suffix is an English-only grammatical morpheme. Japanese segment count+noun needs no suffix. Retain the full consumed typed source union and evaluate/capture the original native argument once; no deleted C arguments or %.0s padding."}
                    for key in ["arg_3", "arg_6"]] if number == 120 else [])
        expected = {arg["name"]: arg["source_format_specifier"] for arg in union}
        used = re.findall(r"\{(arg_\d+):([^}]+)\}", ja)
        if any(expected.get(key) != fmt for key, fmt in used):
            raise ValueError(f"Original printf conversion altered: {number}")
        if set(expected) - {key for key, _ in used} != {item["argument"] for item in omitted}:
            raise ValueError(f"Missing consumed argument: {number}")
        if [key for key, _ in used] != [arg["name"] for arg in union if arg["name"] not in {item["argument"] for item in omitted}]:
            raise ValueError(f"Original argument order altered: {number}")
        if ja.count("\n") != original["english_whole_named_template"].count("\n"):
            raise ValueError(f"Original newline changed: {number}")
        literals, producers = [], []
        for contract in original["official_source_contracts"]:
            for argument in contract["arguments"]:
                argname = argument["id_candidate"]
                expression = argument["source_expression"]
                schema = next(a for a in union if a["name"] == argname)
                if schema["type"] == "text":
                    producers.append({
                        "argument_name": argname, "source": contract["source"], "line": contract["line"],
                        "source_expression": expression, "original_type": "text",
                        "required_contract": "Capture only this exact original selected/completed diagnostic output once, with native creator/grammar/lifetime provenance. Descriptive names/buffers/tables need source-selected semantic IDs; technical pointer/config/function/slot spellings stay literal only where this source contract proves their role. Do not rerun naming/state/RNG or infer hidden identity. Unsupported composition retains the complete original English.",
                        "runtime_binding_approved": False,
                    })
                for candidate in argument.get("source_literal_candidates", []):
                    english = candidate["english_literal"]
                    if english not in LEAVES: raise ValueError(f"Unauthored exact selected literal: {english!r}")
                    token = expression[candidate["start"]:candidate["end"]]
                    literals.append({
                        "id": identity, "message_id": identity, "argument_name": argname,
                        "source": contract["source"], "line": contract["line"],
                        "blob_sha256": contract["blob_sha256"],
                        "source_expression": expression, "source_literal_ordinal": candidate["ordinal"],
                        "source_expression_literal_start": candidate["start"],
                        "source_expression_literal_end": candidate["end"],
                        "english_source_literal": english, "original_quoted_token": token,
                        "japanese": LEAVES[english], "source_literal_role": "selected-output-literal",
                        "source_role": "selected-output-literal", "role": "selected-output-literal", "runtime_binding_approved": False,
                        "selection_contract": "Original terminal conditional leaf or original adjacent constant-concatenation value. Bind at the original selected producer/token identity once; preserve predicates/functions/RNG and C concatenation. Provenance records do not authorize English reverse lookup or make source dataflow runtime-approved.",
                    })
        requires = any(a["type"] == "text" for a in union)
        notes = [
            "Whole Japanese is individually authored from the actual pinned official diagnostic and every original source site, including error/uncertainty/repetition/negation and structural quote/bracket/coordinate/identifier facts.",
            "The complete original typed source union and exact printf flags/width/precision/length/order remain declared. Only explicitly recorded English-only plural morphemes may be omitted from JP; no padding workaround or native argument deletion.",
            "The original diagnostic and its logging, panic/fuzzer/recovery/effects are retained. A translation is not a reason to suppress an error, replay its producer or invent a repair."
        ]
        if number in SPECIAL: notes.append(SPECIAL[number])
        authored.append({
            "id": identity, "whole_message_ja": ja,
            "source_translation_review_status": "requires-source-producer-contract" if requires else "faithful-official-source-equivalent",
            "source_translation_approved": False, "translation_notes": notes,
            "source_argument_schema": union, "printf_conversions": deepcopy(original["printf_conversions"]),
            "omitted_grammar_arguments": omitted, "original_api": original["original_api"],
            "original_english_literal": original["original_english_literal"],
            "english_whole_named_template": original["english_whole_named_template"],
            "required_helper_variants": deepcopy(original["required_helper_variants"]),
            "helper_variant_templates_ja": {},
            "official_source_contracts": deepcopy(original["official_source_contracts"]),
            "requires_public_name_or_grammar_producer": requires,
            "required_public_name_or_grammar_producers": producers,
            "required_source_literal_translations": literals,
            "source_capture_constraints": CAPTURE.copy(),
            "channel_guard": original["channel_guard"],
            "native_source_prepared": original["native_source_prepared"],
            "runtime_binding_approved": False, "runtime_integration": False,
        })
    return {
        "schema_version": 1,
        "purpose": "All 140 pinned official impossible diagnostics individually authored in Japanese. Source-only; no runtime approval, recovery, logging or gameplay change.",
        "category": batch["category"], "batch": batch["batch"], "input_file": INPUT.name,
        "input_sha256": deepcopy(batch["input_sha256"]), "source_queue_input_sha256": PIN,
        "provenance": deepcopy(batch["provenance"]),
        "frozen_phase3_sha256": deepcopy(batch["frozen_phase3_sha256"]),
        "argument_schemas": {e["id"]: deepcopy(e["typed_arguments"]) for e in batch["entries"]},
        "entries": authored, "runtime_binding_approved_count": 0,
        "runtime_integration": False, "japanese_runtime_complete": False,
    }


if __name__ == "__main__":
    payload = build()
    encoded = (json.dumps(payload, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    OUTPUT.write_bytes(encoded)
    print(json.dumps({"ids": len(payload["entries"]), "bytes": len(encoded), "sha256": sha(encoded),
                      "source_only": True, "runtime_binding_approved": False}, indent=2))
