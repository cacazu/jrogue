"""Reviewed role-based grammar inputs; source strings are never lookup identities."""
import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
P = "angband.naming.grammar."
RULES = []


def rule(role, english, japanese, parameters=None, render_en=None, source="obj-desc.c", note=""):
    text = (HERE / "producer-snapshots" / source).read_text("utf-8")
    found = []
    for match in re.finditer(r'"(?:\\.|[^"\\])*"', text):
        try:
            value = json.loads(match.group())
        except ValueError:
            continue
        if value == english:
            found.append({"file": f"migration/naming-data/producer-snapshots/{source}",
                          "upstream_file": f"src/{source}",
                          "line": text.count("\n", 0, match.start()) + 1,
                          "literal": match.group(), "exact_value": value})
    assert found, (source, role, english)
    RULES.append({"id": P + role, "role": role, "source_english": english,
                  "parameters": parameters or {}, "render": {"en": render_en if render_en is not None else english, "ja": japanese},
                  "sources": found, "note": note})


def authored(role, en, ja, params, note):
    RULES.append({"id": P + role, "role": role, "source_english": en,
                  "parameters": params, "render": {"en": en, "ja": ja},
                  "sources": [], "note": note, "authored_composition": True})


rule("object.nothing", "(nothing)", "（何もない）")
rule("object.literal.treasure", "treasure", "宝", source="mon-util.c",
     note="Exact source-selected literal in steal_monster_item money branch; no object_desc call or completed-English substitution.")
rule("object.unknown.prefixed", "an unknown item", "正体不明のアイテム")
rule("object.unknown.plain", "unknown item", "正体不明のアイテム")
rule("object.prefix.no_more", "no more ", "もうない", note="Selected prefix lexeme; whole-name JP composition below places it after the base.")
rule("object.prefix.quantity", "%u ", "{number}{counter}の", {"number": "integer", "counter": "localized_text"}, "{number} ")
rule("object.prefix.definite", "the ", "", note="Japanese omits English articles; empty translation is deliberate grammar.")
rule("object.prefix.a", "a ", "", note="Japanese omits English articles.")
rule("object.prefix.an", "an ", "", note="Japanese omits English articles.")
authored("object.compose.no_more", "no more {base}", "{base}はもうない", {"base": "localized_text"}, "Composition of exact native no-more prefix and selected basename; no parser-name change.")
authored("object.compose.quantity", "{number} {base}", "{number}{counter}の{base}", {"number": "integer", "counter": "localized_text", "base": "localized_text"}, "Count selected by original prefix branch; counter selected from authored kind/base metadata.")

bases = {"amulet": ("Amulet~", "護符"), "ring": ("Ring~", "指輪"),
         "staff": ("Sta|ff|ves|", "魔法のスタッフ"), "wand": ("Wand~", "魔法の杖"),
         "rod": ("Rod~", "魔法のロッド"), "potion": ("Potion~", "薬"),
         "mushroom": ("Mushroom~", "キノコ")}
for tval, (pattern, ja) in bases.items():
    rule(f"object.basename.{tval}.plain", "& " + pattern, ja)
    rule(f"object.basename.{tval}.flavored", "& # " + pattern, "{modifier}" + ja,
         {"modifier": "localized_text"}, "{modifier} " + pattern,
         note="Japanese uses the flavor .modifier phrase; English parses the retained raw grammar AST.")
rule("object.basename.scroll.plain", "& Scroll~", "巻物")
rule("object.basename.scroll.flavored", "& Scroll~ titled #", "『{modifier}』と記された巻物",
     {"modifier": "display_token"}, "Scroll~ titled {modifier}", note="Owned generated_scroll_title is opaque, not a locale lookup or transliteration.")
book_bases = {
    "magic_book": ("& Book~ of Magic Spells #", "& Book~ #", "魔法書{modifier}", "書{modifier}"),
    "prayer_book": ("& Holy Book~ of Prayers #", "& Book~ #", "祈祷書{modifier}", "書{modifier}"),
    "nature_book": ("& Book~ of Nature Magics #", "& Book~ #", "自然の魔法書{modifier}", "書{modifier}"),
    "shadow_book": ("& Necromantic Tome~ #", "& Tome~ #", "死霊術の魔法書{modifier}", "書{modifier}"),
    "other_book": ("& Book of Mysteries~ #", "& Book~ #", "謎の書{modifier}", "書{modifier}"),
}
for tval, (full, terse, full_ja, terse_ja) in book_bases.items():
    rule(f"object.basename.{tval}.full", full, full_ja, {"modifier": "localized_text"}, full.replace("#", "{modifier}"))
    rule(f"object.basename.{tval}.terse", terse, terse_ja, {"modifier": "localized_text"}, terse.replace("#", "{modifier}"))

rule("object.suffix.of", " of %s", "{suffix}の", {"suffix": "localized_text"}, " of {suffix}")
rule("object.suffix.quoted", " '%s'", "『{suffix}』", {"suffix": "localized_text"}, " '{suffix}'")
rule("object.suffix.literal", " %s", "{suffix}", {"suffix": "localized_text"}, " {suffix}")
authored("object.compose.artifact_of", "{base} {suffix}", "{suffix}の{base}", {"base": "localized_text", "suffix": "localized_text"}, "Artifact raw source starts 'of '; JA lexeme omits that English grammar and this role supplies the possessive.")
authored("object.compose.artifact_quoted", "{base} {suffix}", "{base}『{suffix}』", {"base": "localized_text", "suffix": "localized_text"}, "Artifact raw quote marks retained in metadata; Japanese proper name lexeme is unquoted.")
authored("object.compose.ego", "{base} {suffix}", "{suffix}{base}", {"base": "localized_text", "suffix": "localized_text"}, "Japanese suffix is the authored ego .modifier prefix phrase; e.g 祝福された.")
authored("object.compose.aware_kind", "{base} of {suffix}", "{suffix}の{base}", {"base": "localized_text", "suffix": "localized_text"}, "Known flavored-kind effect name; never applied to an unaware kind.")
authored("object.compose.aware_kind_terse", "{base} '{suffix}'", "{suffix}の{base}", {"base": "localized_text", "suffix": "localized_text"}, "Same Japanese noun composition, original terse source branch preserved.")

rule("object.chest", " (%s)", "（{trap}）", {"trap": "localized_text"}, " ({trap})")
rule("object.fuel", " (%d turns)", "（残り{turns}ターン）", {"turns": "integer"}, " ({turns} turns)")
rule("object.dice", " (%dd%d)", "（{dice}d{sides}）", {"dice": "integer", "sides": "integer"}, " ({dice}d{sides})")
rule("object.multiplier", " (x%d)", "（x{multiplier}）", {"multiplier": "integer"}, " (x{multiplier})")
rule("object.bonus.pair", " (%+d,%+d)", "（{hit},{damage}）", {"hit": "signed_integer", "damage": "signed_integer"}, " ({hit},{damage})")
rule("object.bonus.single", " (%+d)", "（{bonus}）", {"bonus": "signed_integer"}, " ({bonus})")
rule("object.armor.base_bonus", " [%d,%+d]", "［{armor},{bonus}］", {"armor": "integer", "bonus": "signed_integer"}, " [{armor},{bonus}]")
rule("object.armor.bonus", " [%+d]", "［{bonus}］", {"bonus": "signed_integer"}, " [{bonus}]")
rule("object.armor.base", " [%d]", "［{armor}］", {"armor": "integer"}, " [{armor}]")
rule("object.mods.open", " <", "〈")
rule("object.mods.separator", ", ", "、")
rule("object.mods.value", "%+d", "{value}", {"value": "signed_integer"}, "{value}")
rule("object.mods.close", ">", "〉")
rule("object.charges", " (%d charge%s)", "（残り{charges}回）", {"charges": "integer", "plural_suffix": "display_token"}, " ({charges} charge{plural_suffix})")
rule("object.charging.count", " (%d charging)", "（{number}本充填中）", {"number": "integer"}, " ({number} charging)", note="Native counted charging branch is restricted to stacked rods.")
rule("object.charging.single", " (charging)", "（充填中）")
for role, en, ja in [("empty", "empty", "空"), ("tried", "tried", "試用済み"),
                     ("cursed", "cursed", "呪われている"), ("ignore", "ignore", "無視"),
                     ("unknown", "??", "??")]:
    rule(f"object.annotation.{role}", en, ja,
         note="Flavor was tried while still unaware; this label does not claim this instance is spent or empty." if role == "tried" else "")
rule("object.store.unseen", " {unseen}", "｛未判明｝")
rule("object.store.unknown", " {??}", "｛??｝")
rule("object.store.cursed", " {cursed}", "｛呪われている｝")
rule("object.inscriptions.open", " {", "｛")
rule("object.inscriptions.separator", ", ", "、")
rule("object.inscriptions.close", "}", "｝")
authored("object.inscriptions.user", "{text}", "{text}", {"text": "inscription"}, "Verbatim owned external inscription; no splitting, translating, or template parsing.")
rule("object.money", "%d gold pieces worth of %s%s", "{amount}ゴールド相当の{name}{ignore}",
     {"amount": "integer", "name": "localized_text", "ignore": "localized_text"}, "{amount} gold pieces worth of {name}{ignore}")
for role, en, ja in [("unlocked", "unlocked", "解錠済み"), ("disarmed", "disarmed", "罠解除済み"),
                     ("multiple", "multiple traps", "複数の罠"), ("empty", "empty", "空")]:
    rule(f"object.chest_state.{role}", en, ja, source="obj-chest.c")

for sex, names in {
    "neuter": [("subject", "it", "それ"), ("object", "it", "それ"), ("possessive", "its", "それの"), ("reflexive", "itself", "それ自身"),
               ("indefinite_subject", "something", "何か"), ("indefinite_object", "something", "何か"), ("indefinite_possessive", "something's", "何かの"), ("indefinite_reflexive", "itself", "それ自身")],
    "male": [("subject", "he", "彼"), ("object", "him", "彼"), ("possessive", "his", "彼の"), ("reflexive", "himself", "彼自身"),
             ("indefinite_subject", "someone", "誰か"), ("indefinite_object", "someone", "誰か"), ("indefinite_possessive", "someone's", "誰かの"), ("indefinite_reflexive", "himself", "彼自身")],
    "female": [("subject", "she", "彼女"), ("object", "her", "彼女"), ("possessive", "her", "彼女の"), ("reflexive", "herself", "彼女自身"),
               ("indefinite_subject", "someone", "誰か"), ("indefinite_object", "someone", "誰か"), ("indefinite_possessive", "someone's", "誰かの"), ("indefinite_reflexive", "herself", "彼女自身")],
}.items():
    for case, en, ja in names:
        rule(f"monster.pronoun.{sex}.{case}", en, ja, source="mon-desc.c",
             note="Selected native pronoun branch; do not export hidden race identity/gender when the original branch did not use it.")
rule("monster.article.a", "a ", "", source="mon-desc.c")
rule("monster.article.an", "an ", "", source="mon-desc.c")
rule("monster.article.definite", "the ", "", source="mon-desc.c")
rule("monster.possessive", "'s", "の", source="mon-desc.c")
rule("monster.comma", ",", "", source="mon-desc.c", note="Japanese authored appositives are closed parenthetical phrases; omitting the native comma keeps stripped possessives natural, e.g 蛇の舌の.")
rule("monster.offscreen", " (offscreen)", "（画面外）", source="mon-desc.c")
rule("monster.list.unique", "[U] %s", "[U] {name}", {"name": "localized_text"}, "[U] {name}", source="mon-desc.c")
rule("monster.list.quantity", "%3d ", "{number}{counter}の", {"number": "integer", "counter": "localized_text"}, "{number} ", source="mon-desc.c")
for role, ja in [("ko", "個"), ("hon", "本"), ("mai", "枚"), ("soku", "足"), ("sou", "双"),
                 ("satsu", "冊"), ("chou", "張"), ("tei", "挺"), ("ryou", "領"),
                 ("chaku", "着"), ("fuku", "服"), ("kan", "巻"),
                 ("nin", "人"), ("hiki", "匹"), ("tai", "体")]:
    authored(f"counter.{role}", "", ja, {}, "Japanese counted-noun unit; English quantity uses the original singular/plural branch without a counter word.")


def catalog():
    counters = {"amulet": "ko", "ring": "ko", "staff": "hon", "wand": "hon", "rod": "hon",
                "potion": "fuku", "mushroom": "ko", "scroll": "kan",
                "magic_book": "satsu", "prayer_book": "satsu", "nature_book": "satsu",
                "shadow_book": "satsu", "other_book": "satsu"}
    for item in RULES:
        if item["role"].startswith("object.basename."):
            item["counter_id"] = P + "counter." + counters[item["role"].split(".")[2]]
    return {"schema_version": 1, "id_policy": "Naming producer role; never completed-English lookup",
              "english_policy": "Flat EN preserves exact raw source literals; render.en explicitly binds printf/markup roles before composition.",
              "rules": RULES}


def main():
    result = catalog()
    (HERE / "grammar.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", "utf-8")
    print(json.dumps({"grammar_rules": len(RULES)}))


if __name__ == "__main__":
    main()
