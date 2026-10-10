#!/usr/bin/env python3
"""Author official-equivalent Japanese frames; never approve native dataflow.

The rejected fork pair is evidence only. These translations follow the pinned
official English call and original public argument union. Contextual literal
recipes are presentation proposals, not a rendered-English lookup mechanism.
"""
import hashlib
import json
from pathlib import Path
from importlib.util import spec_from_file_location, module_from_spec

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OFFICIAL = ROOT.parent / "official-source-audit/NetHack-5.0.0"


def module(path, name):
    import sys
    spec = spec_from_file_location(name, path)
    value = module_from_spec(spec)
    sys.modules[name] = value
    spec.loader.exec_module(value)
    return value


def load(path):
    return json.loads(path.read_text("utf8"))


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


# Each list position is checked against the immutable batch ID below. Names
# are source-declared; every original printf suffix remains explicit.
B = [
    "人形が{arg_1:%s}に姿を変えた{arg_2:%s}のを見た！",
    "{arg_1:%s}は、請求額が{arg_3:%ld}{arg_4:%s}になると{arg_2:%s}。",
]
D = [
    "{arg_1:%s}が{arg_3:%s}{arg_2:%s}",
    "{arg_1:%s}。",
    "{arg_1:%s}高い{arg_2:%s}を起こした。",
    "{arg_1:%s}{arg_2:%s}から引っ張り出された！",
    "{arg_1:%s}！",
    "{arg_3:%s}を{arg_2:%s}{arg_1:%s}。",
    "驚いた{arg_1:%s}は、{arg_2:%s}が{arg_3:%s}と同時にそれを落とした！",
    "両手持ちの{arg_1:%s}を構えている間は、盾を装備できない。",
    "{arg_1:%s}。",
    "{arg_1:%s}！",
    "{arg_1:%s}もう{arg_2:%s}。",
    "{arg_1:%s}！！",
    "{arg_3:%s}を{arg_2:%d}個{arg_1:%s}。",
    "{arg_1:%s}{arg_2:%s}を食べた。",
    "{arg_1:%s}。",
    "{arg_1:%s}！",
    "{arg_1:%s}。",
    "{arg_1:%s}。",
    "「{arg_2:%s}」と{arg_1:%s}{arg_3:%s}",
    "{arg_1:%s}{arg_2:%s}。",
    "{arg_1:%s}{arg_2:%s}{arg_3:%s}{arg_4:%s}{arg_5:%s}",
    "{arg_3:%s}に{arg_1:%s}{arg_2:%s}。",
    "{arg_1:%s}{arg_2:%s}は{arg_3:%s}を動かせない。",
    "あなたは{arg_1:%s}{arg_2:%s}。",
    "{arg_1:%ld}しか持っていない{arg_2:%s}{arg_3:%s}。",
    "{arg_3:%s}{arg_2:%s}{arg_1:%s}。",
    "ここには物がないと{arg_1:%s}。",
    "{arg_1:%s}{arg_2:%s}ものを、手探りで確かめようとした。",
    "{arg_2:%s}が砕ける{arg_1:%s}！",
    "{arg_1:%s}が{arg_2:%s}呪文を唱えた！",
    "{arg_1:%s}が{arg_2:%s}に向けられた……",
    "{arg_1:%s}が{arg_2:%s}に{arg_3:%s}向けられた。",
    "{arg_1:%s}が{arg_3:%s}に{arg_2:%s}。",
    "{arg_1:%s}が{arg_6:%s}に向かって{arg_4:%s}{arg_5:%s}{arg_3:%s}{arg_2:%s}。",
    "{arg_1:%s}！",
    "{arg_1:%s}は{arg_2:%s}の下に隠れていた！",
    "「あなたの{arg_1:%s}を脱いで、{arg_2:%s}。」",
    "{arg_1:%s}は{arg_4:%s}{arg_3:%s}{arg_2:%s}！",
    "新しい{arg_2:%s}の穴を通って{arg_1:%s}。",
    "{arg_2:%s}{arg_3:%s}から{arg_1:%s}！",
    "{arg_1:%s}！",
    "{arg_1:%s}{arg_2:%s}。",
    "{arg_1:%s}が{arg_2:%s}。",
    "あなたの{arg_1:%s}が、あなたの{arg_3:%s}を{arg_2:%s}！",
    "今は{arg_1:%s}と感じる。",
    "{arg_1:%s}{arg_2:%s}{arg_3:%s}：",
    "{arg_1:%s}！",
    "{arg_1:%s}の声が{arg_2:%s}：{arg_3:%s}{arg_4:%s}{arg_5:%s}",
    "{arg_1:%s}。",
    "{arg_1:%s}！",
    "{arg_1:%s}。",
    "かすかに腐った卵のにおいが{arg_1:%s}。",
    "{arg_2:%s}{arg_1:%s}が聞こえた。",
    "「よくも私の{arg_2:%s}を{arg_1:%s}な！」",
    "「誰が私の{arg_2:%s}を{arg_1:%s}のだ？」",
    "{arg_1:%s}！",
    "{arg_1:%s}！",
    "{arg_1:%s}。",
    "{arg_2:%s}には{arg_1:%s}。",
    "レベル転移の罠を{arg_1:%s}！",
    "{arg_1:%s}。",
    "足元の板が{arg_2:%s}{arg_3:%s}{arg_1:%s}。",
    "{arg_1:%s}{arg_3:%s}{arg_2:%s}光った。",
    "{arg_1:%ld}個の{arg_2:%s}が燃えた。",
    "あなたの{arg_3:%s}の{arg_2:%s}で、血が{arg_1:%s}。",
]

# Context-specific translations of actual lexical source literals. Empty
# English agreement fragments can have empty Japanese leaves; the full source
# event union is still retained. A helper-input leaf is never a direct output.
LEAVES = {
 ("b",1): {"says":"述べた", "indicates":"示した"},
 ("d",0): {"feel":"感じられた。", "catch":"始めた！", "warm.":"温かく", "light!":"燃え"},
 ("d",1): {"This is not a diving lamp":"これは潜水用のランプではない", "Sorry, fire and water don't mix":"残念だが、火と水は相容れない"},
 ("d",2): {"very ":"とても", "":"", "frequency vibration":"周波数の振動", "pitched humming noise":"調子のうなり音"},
 ("d",3): {"pit":"落とし穴", "web":"蜘蛛の巣", "bear trap":"熊の罠", "lava":"溶岩"},
 ("d",4): {"Dude!  The living dead":"うわっ、生ける屍だ", "The grave's owner is very upset":"墓の主はひどく怒っている", "I want my mummy":"自分のママ（ミイラ）が欲しいよ", "You've disturbed a tomb":"墓を荒らしてしまった"},
 ("d",5): {"hole":"穴", "trap door":"落とし戸"},
 ("d",6): {"revives":"生き返った", "disappears":"消えた"},
 ("d",8): {"see through yourself":"自分の体を透かして見られる", "no longer see yourself":"もう自分の姿が見えない"},
 ("d",9): {"no longer see through yourself":"もう自分の体を透かして見ることはできない"},
 ("d",10): {"are ":"", "":"", "wielding two weapons at once":"二つの武器を同時に扱っていない", "have a second weapon readied":"予備の武器を構えていない"},
 ("d",11): {"Thwack":"ドスン", "Whammm":"ドカーン"},
 ("d",12): {"shoot":"撃った", "throw":"投げた"},
 ("d",14): {"undergo a freakish metamorphosis":"異様な変身を遂げた", "feel a change coming over you":"変化が自分に訪れるのを感じた"},
 ("d",15): {"Oh wow, like, superior, man":"おお、すごい、最高だぜ", "This food really hits the spot":"この食べ物は実に満足できる"},
 ("d",16): {"only feel hungry now":"今は空腹を感じるだけだ", "feel hungry":"空腹を感じる", "are beginning to feel hungry":"空腹を感じ始めている"},
 ("d",17): {"are still":"まだ弱っている", "feel":"弱っていると感じる", "are beginning to feel":"弱ってきたと感じる"},
 ("d",18): {"feel the words":"文字を手触りで感じた", "read":"読んだ"},
 ("d",19): {"Flupp!  ":"ボコッ！　", "":""},
 ("d",20): {" ":" ", "":"", " (invalid target)":"（無効な対象）", " (no travel path)":"（移動経路がない）"},
 ("d",21): {"":"", "harmlessly ":"無害に", "futilely ":"無駄に", "explode at":"爆発した", "attack":"攻撃した"},
 ("d",22): {"Perhaps that's why ":"おそらく、そのために", "":"", "it":"それ"},
 ("d",23): {"already":"すでに", "now":"今は"},
 ("d",24): {" and ":"し、", "":""},
 ("d",25): {"Including":"も含まれる", "They're":"だ", "It's":"だ", "":"", ", unfortunately":"残念ながら、"},
 ("d",27): {"floating here":"ここに浮かんでいる", "":""},
 ("d",28): {"hear":"音を聞いた", "see":"様子を見た"},
 ("d",29): {"Something":"何か", "":"", " at a spot near you":"あなたの近くの場所に", " at your displaced image":"あなたのずれた幻影に", " at you":"あなたに"},
 ("d",30): {"something":"何か"},
 ("d",31): {"engagingly":"親しげに", "seductively":"誘惑するように"},
 ("d",32): {"misses":"攻撃を外した", "pretends to be friendly to":"仲良くするふりをした"},
 ("d",33): {"one of ":"の一つ", "":""},
 ("d",34): {"being squashed":"押しつぶされている", "pummeled with debris":"がれきで打ちのめされている"},
 ("d",36): {"let's get a little closer":"もう少し近づこう", "it's in the way":"邪魔だ", "let me rub your feet":"足をさすらせて", "they're too clumsy":"それでは不器用すぎる", "let me massage you":"マッサージさせて"},
 ("d",37): {"destroyed":"破壊された", "killed":"殺された", " by the ":"によって", "":""},
 ("d",38): {"jump":"跳び出した"},
 ("d",39): {"emerge from":"出てきた", "break out of":"破って出てきた"},
 ("d",40): {"play":"演奏した"},
 ("d",41): {"trill":"震わせる音を奏でた", "toot":"プッと音を鳴らした", " a familiar tune":"、聞き覚えのある曲だ", "":""},
 ("d",42): {"produces a familiar, lilting melody":"聞き覚えのある軽快な旋律を奏でた", "produces a lilting melody":"軽快な旋律を奏でた", "twangs a familiar tune":"聞き覚えのある曲をじゃんじゃん鳴らした", "twangs":"じゃんじゃん鳴った"},
 ("d",43): {"still constricts":"まだ締め付けている", "begins constricting":"締め付け始めた"},
 ("d",44): {"less wobbly":"ふらつきが少ない", "a bit steadier":"少ししっかりしてきた"},
 ("d",45): {"A voice (could it be":"声が（", "Despite your deafness, you seem to hear":"耳は聞こえないはずなのに、", "?) whispers":"だろうか？）ささやいた", " say":"の声が聞こえるようだ"},
 ("d",46): {"fry to a crisp":"カリカリに焼き尽くされた", "disintegrate into a pile of dust":"分解されて一山の塵になった"},
 ("d",48): {"homesick":"故郷が恋しくなる", "an urge to return to the surface":"地上に戻りたい衝動がわく", "ashamed":"恥ずかしくなる"},
 ("d",49): {"feel":"新品同様に感じる", "look":"新品同様に見える"},
 ("d",50): {"Type the name of a type of monster or 'none'":"モンスターの種類名か 'none' を入力してください", "No type of monster specified":"モンスターの種類が指定されていない"},
 ("d",51): {"The scroll crumbles with":"巻物が崩れるとともに漂った", "You smell":"した"},
 ("d",52): {"sad wailing":"悲しげな泣き声", "maniacal laughter":"狂ったような笑い声", "in the distance":"遠くで", "close by":"近くで"},
 ("d",53): {"shop":"店", "door":"扉"},
 ("d",54): {"shop":"店", "door":"扉"},
 ("d",55): {"tawt you taw a puttie tat":"ねこたんが見えた気がちた", "thought you saw something":"何かを見た気がした"},
 ("d",56): {"Book seems to be ignoring you":"本はあなたを無視しているようだ", "runes appear scrambled.  You can't read them":"ルーン文字は乱れているようで、読むことができない"},
 ("d",57): {"can't cast that spell":"その呪文を唱えられない", "don't know that spell":"その呪文を知らない", "are not able to teleport at will":"自分の意志では転移できない"},
 ("d",58): {"for a teleport spell":"転移の呪文", "to teleport":"転移"},
 ("d",60): {"on a banana peel":"バナナの皮で足を滑らせた", "and nearly fall":"足を滑らせ、もう少しで転びそうになった"},
 ("d",61): {"vibrates":"振動した", "squeaks ":"きしんだ", "":"", " loudly":"大きく"},
 ("d",62): {"violently glow":"激しく", "glow":""},
 ("d",64): {"boil":"煮え立った", "pool":"たまった", "beneath":"下", "at":"ところ"},
}

PRODUCERS = {
 ("b",0): "Capture monnambuf and and_vanish only after their original construction. and_vanish has empty, vanish, and crawl-under-visible-shelter branches; the latter is NOT just vanish. Original accurate type/perception guard remains authoritative. Carry native-computed motion/name components once; never repeat m_monnam, locomotion, doname or make_familiar.",
 ("b",1): "Capture original shopkeeper name, already selected says/indicates branch and original currency(total) result once. Merchant-specific identity and currency require source-selected descriptors; do not query speech/Deaf predicates again.",
 ("d",0): "Contextual catch/feel recipes require the original object name and already chosen tense/perception descriptor. English warm/light selection controls punctuation. Do not re-evaluate Blind or otense.",
 ("d",3): "pullmsg is the original constant prefix. Preserve the four original pit/web/lava/bear-trap sites. hliquid's native completed result is public; never call it again or infer unseen terrain.",
 ("d",5): "Original actn was selected by the existing locomotion and narrow-hole/squeeze branch; capture original result once, including any original rn2 outcome. down_or_thru is original down/through selection. No new locomotion or RNG calls.",
 ("d",7): "The original c_sword/c_axe/c_weapon selection is a visible broad weapon-class description, not a newly exposed true object type. Capture that exact branch.",
 ("d",9): "Resolve original see_yourself constant to its source-declared phrase. Original See_invisible branch controls meaning; do not re-query it.",
 ("d",13): "Original tintxts[r].txt and already emitted neutral monster name are public. Preserve original tin-preparation index and actual name output; do not make a new identification query.",
 ("d",18): "et is user-authored engraving text, intentionally literal. Original endpunct remains a captured punctuation leaf. Do not translate arbitrary user text or reread engraving state.",
 ("d",19): "buf is constructed before this call from muddy waste, audible sloshing, or a splash in an original computed body-part name. Keep each original branch/predicate and its captured public components; no fresh Deaf/body query.",
 ("d",20): "firstmatch/tmpbuf are completed public cursor descriptions. Their detailed naming/location compositions require original producer hooks; predicates getpos_getvalid/is_valid_travelpt must run only their original time. Exact source qualifiers remain captured leaves.",
 ("d",21): "buf is original known obstacle description. Preserve exact original empty/harmless/futile adverb and explode/attack branch; no new map or combat knowledge.",
 ("d",22): "you_or_steed already contains original public player/mount naming; capture that once. Original prefix branch determines pronoun versus specific xname. Do not query the mount or item type again.",
 ("d",23): "buf is the original public hiding-description composition. Need its original completed branch and source-selected components; no hidden disguise/object identification queries.",
 ("d",24): "only_one is the existing can-only-throw-one-at-a-time constant. Retain exact long quantity and original coin/noncoin/quantity branch selection.",
 ("d",25): "corpse_xname includes existing article/quantity/public identity knowledge. Preserve original singular/plural/inclusion selection and unfortunate qualifier; no additional petrification/monster facts.",
 ("d",26): "verb is the original see/feel selection. Bind from its source assignment; do not guess perception from rendered text.",
 ("d",27): "where/onwhat are original lie-beneath/location/surface compositions. Capture the already selected drift/can't-reach/native-surface output. No terrain naming or accessibility calls repeated.",
 ("d",28): "bottlename can be hallucinated; retain exact original call result and selected hear/see input. Do not generate a second name/RNG outcome.",
 ("d",29): "Monnam/Something and directed-spell qualifiers are selected by original visibility, target, displacement and spell checks. Capture these branches without adding target identity.",
 ("d",30): "Original buf contains public attacker name + gazes at/toward (including original blinded adjective when exposed). Japanese contextual producer yields that exact actor's gaze; preserve all existing qualification. Target something stays generic.",
 ("d",31): "buf originally contains actor smiles-at OR talks-to selected by original mdefcansee. Japanese contextual producer yields actor's smile OR actor's words. Never assume both branches are smiles or repeat cansee/name calls.",
 ("d",33): "Original actor/target/weapon/mhis/mswings_verb are completed public values. Bind Japanese possessive, quantity and swing/thrust morphology only from their original producer branches; no entity state re-read.",
 ("d",35): "Amonbuf/what are original disclosed actor and cover names. Their source-selected custom/hallucinated/object grammar remains pending; do not expose extra cover identity.",
 ("d",36): "str is original public garment name. hairbuf's remaining branch already computed body_part(HAIR); source producer must capture its components once. Keep original garment-selected clause, including foot/hand references.",
 ("d",37): "Original Monnam and fltxt identify only their already public causal text. Capture nonliving and by-the selections at their original branch; do not inspect target attributes again.",
 ("d",38): "Original u_locomotion and new object xname determine public motion/object wording. Japanese tense recipe needs their source-selected descriptor once; no new movement/name calls.",
 ("d",39): "msgtrail is original empty, stomach or already computed shapeshifted-name phrase. Capture its existing construction only; never invoke digests/noname_monnam again. l_oldname is original visible previous form.",
 ("d",40): "monverbself is original completed actor-play-horn-reflexive composition using original objbuf. Preserve public horn description, actor and reflexive from its own call once; no second Monnam or horn selection.",
 ("d",41): "Tobjnam contains instrument + selected trill/toot action. Need contextual whole Japanese producer; suffix familiar-tune is original already selected source literal. No new instrument/type or familiarity query.",
 ("d",43): "Original simpleonames and body_part(NECK) are public captured fields. Keep original still/begins selection, no new strangulation/body state queries.",
 ("d",45): "Capture original god name and exact Deaf-selected prefix/suffix once. One branch wonders whether the voice is the named god, the other says hearing is apparent despite deafness; neither establishes a new speaker identity.",
 ("d",47): "ROLL_FROM(godvoices) consumes original RNG once; capture its selected table leaf. words is caller-supplied public speech requiring source-origin selection. Keep original quote/noquote slots; no new RNG/voice/word matching.",
 ("d",49): "Yobjnam2 already computes original weapon + feel/look branch. Contextual Japanese producer includes original as-good-as-new predicate in its own source-declared recipe; do not identify the weapon or rerun naming/Blind.",
 ("d",53): "dmgstr is original public damage verb supplied by the existing branch. Japanese past-form producer must use original source origin and captured result, without recomputing damage.",
 ("d",54): "dmgstr is original public damage verb supplied by the existing branch. Japanese past-form producer must use original source origin and captured result, without recomputing damage.",
 ("d",58): "cantdoit has original hunger/strength/energy clauses. Capture its existing selection and original castit phrase once; no new resource checks.",
 ("d",59): "verbbuf is original trigger or computed u_locomotion(step)+onto. Capture original branch and motion output once; polymorph-specific motion must not be guessed or queried anew.",
 ("d",61): "trapnote returns the original public note. Capture it once as selected note descriptor; no trap inspection, changed note/RNG, or re-running Deaf.",
 ("d",62): "Original Yobjnam2 selects object and glow/violently-glow morphology; Japanese contextual prefix needs its original subject and violence flag. color and xtime are the original public selections; no hcolor/RNG/name replay.",
 ("d",63): "buf2 is original public broad object-class plural label; long count remains exact. Never replace it by a new true object-type query.",
 ("d",64): "Original body_part(FOOT) and terrain/Levitation-selected boil/pool and beneath/at branches remain captured once. No new lava/location/body knowledge.",
}


def main():
    scanner = module(ROOT/"tools/inventory_source.py", "bd_scanner")
    helper = module(HERE/"build-reviewed-translations.py", "bd_helper")
    reports = []
    for category, templates in (("b", B), ("d", D)):
        batch = load(HERE/f"category-{category}-batch-1.json")
        assert len(batch["entries"]) == len(templates)
        entries = []
        for i, (source, ja) in enumerate(zip(batch["entries"], templates)):
            leaves, unmapped = [], []
            for call in source["official_source_contracts"]:
                for arg in call["arguments"]:
                    expr = arg["source_expression"]
                    for ordinal, (en, start, end) in enumerate(helper.literals(scanner, expr)):
                        if en not in LEAVES.get((category, i), {}):
                            unmapped.append({"source":call["source"],"line":call["line"],"argument":arg["id_candidate"],"english_source_literal":en,"reason":"Requires original public producer context; no invented Japanese or runtime selection."})
                            continue
                        role = "producer-input-literal" if any(t in expr for t in ("otense(","u_locomotion(","locomotion(","Yobjnam2(","Tobjnam(","monverbself(","hliquid(")) else "selected-output-literal"
                        leaves.append({"source":call["source"],"line":call["line"],"original_call_site":{"source":call["source"],"line":call["line"],"api":source["original_api"]},"argument":arg["id_candidate"],"source_expression":expr,"source_literal_ordinal":ordinal,"source_expression_literal_start":start,"source_expression_literal_end":end,"english_source_literal":en,"japanese":LEAVES[(category,i)][en],"literal_role":role,"blob_sha256":sha(OFFICIAL/call["source"]),"runtime_binding_approved":False})
            variants = {}
            for variant in source["required_helper_variants"]:
                if variant == "dream":
                    variants[variant] = "夢の中で、" + ja
                elif variant == "underwater":
                    variants[variant] = "かすかに、" + ja
                elif variant == "blind":
                    assert category == "b" and i == 0
                    variants[variant] = "人形が{arg_1:%s}に姿を変えた{arg_2:%s}気配を感じた！"
                else:
                    raise ValueError(variant)
            producer = PRODUCERS.get((category,i))
            # These source calls contain only already selected literal output
            # phrases. All other text-bearing fields retain a producer guard,
            # including name calls without lexical string literals.
            direct_literal_frames = {1,2,4,8,10,11,14,15,16,17,34,42,44,46,48,50,51,52,55,56,57,60}
            if category == "d" and i not in direct_literal_frames and not producer:
                producer = "Bind every original public text field from its exact name/grammar/string producer, including its original quantity, visibility, custom-name and hallucination constraints. Capture the original completed value and source components once; never infer identity from rendered English or call the producer again."
            entries.append({"id":source["id"],"original_api":source["original_api"],"original_english_literal":source["original_english_literal"],"whole_message_ja":ja,"source_translation_review_status":"requires-source-producer-contract" if producer or unmapped else "faithful-official-source-equivalent","source_translation_approved":True,"source_argument_schema":source["typed_arguments"],"argument_schemas":[a["name"] for a in source["typed_arguments"]],"printf_conversions":source["printf_conversions"],"omitted_grammar_arguments":[],"helper_variant_templates_ja":variants,"required_source_literal_translations":leaves,"unresolved_source_literal_context":unmapped,"requires_public_name_or_grammar_producer":bool(producer or unmapped),"source_capture_constraints":["Use only original public typed argument values captured at the original call; never replay RNG, native naming, visibility, grammar, predicates, or entity state queries.","Native binding is NOT approved. Raw public English values remain explicit fallback until source-selected component/literal descriptors are proven. Never reverse-match rendered English."] + ([producer] if producer else []),"official_sites_reviewed":source["official_source_contracts"],"translation_notes":["Authored from pinned official English; incompatible Japanese fork logic was rejected, not copied. Contextual leaves are recipes selected at their actual source origin and may include nearby fixed English grammar; they are not a runtime string map.","Every original field stays in the declared argument union; Japanese word order and grammatical fragments do not alter core semantics."] + (["English mummy/mummy pun is represented by a mummy/mother wordplay adaptation; no new character fact is asserted."] if category=="d" and i==4 else []),"runtime_integration":False,"runtime_binding_approved":False})
        output = {"schema_version":1,"category":category,"batch":1,"provenance":batch["provenance"],"source_batch_sha256":sha(HERE/f"category-{category}-batch-1.json"),"authorship":{"kind":"authored-official-English-equivalent-Japanese","date":"2026-10-02","upstream_English_preserved":True,"fork_gameplay_or_extra_queries_imported":False},"runtime_integration":False,"runtime_binding_approved":False,"entries":entries}
        path = HERE/f"category-{category}-batch-1.authored.json"
        path.write_text(json.dumps(output,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
        reports.append({"category":category,"ids":len(entries),"sites":sum(len(e["official_sites_reviewed"]) for e in entries),"literal_records":sum(len(e["required_source_literal_translations"]) for e in entries),"helper_variants":sum(len(e["helper_variant_templates_ja"]) for e in entries),"requires_source_producer":sum(e["requires_public_name_or_grammar_producer"] for e in entries),"runtime_approved":0,"sha256":sha(path)})
    print(json.dumps(reports))


if __name__ == "__main__":
    main()
