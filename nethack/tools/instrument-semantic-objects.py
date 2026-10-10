"""Generate source-only observations of original public object name branches.

Added 2026-10-02, distributed under the NetHack General Public License.
Default operation writes a patch/audit only. No compiler, game or name producer
is run. Apply composes exact hooks with a caller-supplied working copy instead
of overwriting changes made by the message/name instrumentation owners.
"""
from __future__ import annotations

import argparse
import difflib
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
UPSTREAM = ROOT / "upstream/NetHack-5.0.0"
DEFAULT_OUTPUT = ROOT / "tools/semantic-text/generated-objects"
COMMIT = "16ff59115315917b93185d026aeefea06db9b0f4"
NOTICE = "/* Modified 2026-10-02: observe branch-selected public object names; original gameplay retained. */\n"
RECIPE_PREFIX = "nethack.name.object."
UNSUPPORTED = [
    "user-called and custom object names", "named/special artifact path",
    "corpses and tins", "poisoned weapons", "lenses and wet towels",
    "figurines with a species", "dragon scale sets, boots and gloves",
    "slime molds and fruit", "partly eaten food and globs",
    "statues with a species and next-boulder feedback", "heavy iron balls",
    "diluted potions and holy/unholy water", "novels and Book of the Dead",
    "game-over shirt, apron, candy and motif additions",
    "Samurai pointer aliases not matching the original selected label field",
    "doname quantity/charge/BUC/property prefixes and later buffer transforms",
]


def sha(text: str | bytes) -> str:
    return hashlib.sha256(text.encode("utf-8") if isinstance(text, str) else text).hexdigest()


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise ValueError(f"{label}: expected one native anchor, found {count}")
    return text.replace(old, new, 1)


def label_binding(pointer: str, field: str, recipe: str) -> str:
    index = "oc_name_idx" if field == "NAME" else "oc_descr_idx"
    return (f'nh_object_recipe = "{RECIPE_PREFIX}{recipe}"; '
            f"nh_object_index = ocl->{index}; nh_object_field = NH_NAME_OBJECT_{field}; "
            f"nh_object_public = {pointer}; nh_object_generic = NULL;")


def generic_binding(noun: str) -> str:
    return (f'nh_object_generic = "{RECIPE_PREFIX}generic.{noun}"; '
            "nh_object_recipe = NULL; nh_object_public = NULL;")


def observe_statement(statement: str, observation: str) -> str:
    # Preserve the original call/expression once, including native side effects.
    return "{ " + statement + " " + observation + " }"


def instrument_text(source: str) -> tuple[str, list[str]]:
    """Return an additive patch; all original name/knowledge/RNG calls remain."""
    if "nh_object_recipe" in source or "nh_text_name_invalidate_range(obufs[obufidx]" in source:
        raise ValueError("Object-name hooks already present; refusing duplicate instrumentation")
    hooks: list[str] = []

    if '#include "nh-semantic-name.h"' not in source:
        source = replace_once(source, '#include "hack.h"',
                              '#include "hack.h"\n#include "nh-semantic-name.h"', "name bridge include")
    source = replace_once(source, "    return obufs[obufidx];",
                          "    nh_text_name_invalidate_range(obufs[obufidx], sizeof obufs[obufidx]);\n"
                          "    return obufs[obufidx];", "nextobuf selected-slot invalidation")
    hooks.append("nextobuf-selected-slot-range-invalidation")
    old_release = ("    if (bufp >= obufs[obufidx]\n"
                   "        && bufp < obufs[obufidx] + sizeof obufs[obufidx]) /* obufs[][BUFSZ] */\n"
                   "        obufidx = (obufidx - 1 + NUMOBUF) % NUMOBUF;")
    new_release = ("    if (bufp >= obufs[obufidx]\n"
                   "        && bufp < obufs[obufidx] + sizeof obufs[obufidx]) { /* obufs[][BUFSZ] */\n"
                   "        nh_text_name_invalidate_range(obufs[obufidx], sizeof obufs[obufidx]);\n"
                   "        obufidx = (obufidx - 1 + NUMOBUF) % NUMOBUF;\n"
                   "    }")
    source = replace_once(source, old_release, new_release, "releaseobuf selected-slot invalidation")
    hooks.append("releaseobuf-range-invalidation-before-original-decrement")

    start_marker = "staticfn char *\nxname_flags("
    end_marker = "\n/* similar to simple_typename but minimal_xname"
    if source.count(start_marker) != 1 or source.count(end_marker) != 1:
        raise ValueError("Exact original xname_flags boundaries unavailable")
    start, end = source.index(start_marker), source.index(end_marker)
    body = source[start:end]
    body = replace_once(body, "    boolean known, dknown, bknown;",
                        "    boolean known, dknown, bknown;\n"
                        "    const char *nh_object_recipe = NULL, *nh_object_public = NULL;\n"
                        "    const char *nh_object_generic = NULL;\n"
                        "    int nh_object_index = 0;\n"
                        "    enum nh_name_object_field nh_object_field = NH_NAME_OBJECT_NAME;\n"
                        "    boolean nh_object_supported = TRUE;", "local public-label observation")
    body = replace_once(body, "    if (obj_is_pname(obj))\n        goto nameit;",
                        "    if (obj_is_pname(obj)) {\n"
                        "        nh_object_supported = FALSE;\n        goto nameit;\n    }",
                        "original special-name branch remains fallback")
    hooks.append("original-special-name-branch-fallback")

    def case(first: str, last: str, changes: list[tuple[str, str, str]]) -> None:
        nonlocal body
        if body.count(first) != 1 or last not in body:
            raise ValueError(f"Case boundaries unavailable: {first}")
        a, b = body.index(first), body.index(last, body.index(first) + len(first))
        chunk = body[a:b]
        for old, new, label in changes:
            chunk = replace_once(chunk, old, new, label)
            hooks.append(label)
        body = body[:a] + chunk + body[b:]

    def mark(statement: str, observation: str, label: str) -> tuple[str, str, str]:
        return statement, observe_statement(statement, observation), label

    unsupported = "nh_object_supported = FALSE;"
    actual = lambda recipe="label": label_binding("actualn", "NAME", recipe)
    appearance = lambda recipe="label": label_binding("dn", "APPEARANCE", recipe)

    case("    case AMULET_CLASS:", "    case WEAPON_CLASS:", [
        mark('Strcpy(buf, "amulet");', generic_binding("amulet"), "amulet-unseen-generic"),
        mark("Strcpy(buf, known ? actualn : dn);",
             "if (known) { " + actual() + " } else { " + appearance() + " }",
             "amulet-native-individual-known-selection"),
        mark("Strcpy(buf, actualn);", actual(), "amulet-known-name"),
        mark('xcalled(buf, BUFSZ - PREFIX, "amulet", un);', unsupported, "amulet-called-fallback"),
        mark('Sprintf(buf, "%s amulet", dn);', appearance("amulet_appearance"), "amulet-public-appearance"),
    ])
    case("    case WEAPON_CLASS:", "    case ARMOR_CLASS:", [
        mark('Strcpy(buf, "poisoned ");', unsupported, "poisoned-weapon-fallback"),
        mark('Strcpy(buf, "pair of ");', unsupported, "lenses-prefix-fallback"),
        mark('Strcpy(buf, (obj->spe < 3) ? "moist " : "wet ");', unsupported, "wet-towel-fallback"),
        ("        if (!dknown)\n            Strcat(buf, dn);",
         "        if (!dknown)\n            " + observe_statement("Strcat(buf, dn);", appearance()),
         "weapon-tool-unseen-public-description"),
        mark("Strcat(buf, actualn);", actual(), "weapon-tool-known-name"),
        mark("xcalled(buf, BUFSZ - PREFIX, dn, un);", unsupported, "weapon-tool-called-fallback"),
        ("        else\n            Strcat(buf, dn);",
         "        else\n            " + observe_statement("Strcat(buf, dn);", appearance()),
         "weapon-tool-public-description"),
        ('        if (typ == FIGURINE && omndx != NON_PM) {',
         '        if (typ == FIGURINE && omndx != NON_PM) {\n            ' + unsupported,
         "figurine-species-fallback"),
    ])
    case("    case ARMOR_CLASS:", "    case FOOD_CLASS:", [
        mark('Sprintf(buf, "set of %s", actualn);', unsupported, "dragon-scale-set-fallback"),
        mark('Strcpy(buf, "pair of ");', unsupported, "boots-gloves-pair-fallback"),
        mark('Strcpy(buf, "shield");', generic_binding("shield"), "unseen-shield-generic"),
        mark('Strcpy(buf, "smooth shield");', generic_binding("smooth_shield"), "unseen-smooth-shield-generic"),
        mark("Concat(buf, 0, actualn);", actual(), "armor-known-name"),
        mark("xcalled(buf, BUFSZ - PREFIX, armor_simple_name(obj), un);", unsupported, "armor-called-fallback"),
        mark("Concat(buf, 0, dn);", appearance(), "armor-public-description"),
    ])
    case("    case FOOD_CLASS:", "    case COIN_CLASS:", [
        ('        if (typ == SLIME_MOLD) {', '        if (typ == SLIME_MOLD) {\n            ' + unsupported,
         "fruit-fallback"),
        mark('Concat(buf, 0, "partly eaten ");', unsupported, "partly-eaten-food-fallback"),
        ('        if (obj->globby) { /* 5.0 added "medium" to replace no-prefix */',
         '        if (obj->globby) { /* 5.0 added "medium" to replace no-prefix */\n            ' + unsupported,
         "glob-size-fallback"),
        mark("Concat(buf, 0, actualn);", actual() + " if (typ == CORPSE || typ == TIN) { " + unsupported + " }",
             "ordinary-food-name-corpse-tin-fallback"),
    ])
    case("    case COIN_CLASS:", "    case ROCK_CLASS:", [
        mark("Strcpy(buf, actualn);", actual(), "coin-chain-name"),
    ])
    case("    case ROCK_CLASS:", "    case BALL_CLASS:", [
        ('        if (typ == STATUE && omndx != NON_PM) {',
         '        if (typ == STATUE && omndx != NON_PM) {\n            ' + unsupported,
         "statue-species-fallback"),
        ('        } else if (typ == BOULDER && obj->next_boulder == 1) {',
         '        } else if (typ == BOULDER && obj->next_boulder == 1) {\n            ' + unsupported,
         "next-boulder-fallback-original-reset-retained"),
        mark('Strcpy(buf, actualn); /* "boulder" or "statue" */', actual(), "ordinary-rock-name"),
    ])
    case("    case POTION_CLASS:", "    case SCROLL_CLASS:", [
        mark('Strcpy(buf, "diluted ");', unsupported, "diluted-potion-fallback"),
        mark('Strcat(buf, "potion");', generic_binding("potion"), "potion-unseen-generic"),
        mark('Strcat(buf, obj->blessed ? "holy " : "unholy ");', unsupported, "holy-unholy-water-fallback"),
        mark("Strcat(buf, actualn);", actual("potion_name"), "potion-known-name"),
        mark('xcalled(buf, BUFSZ - PREFIX, "", un);', unsupported, "potion-called-fallback"),
        mark("Strcat(buf, dn);", appearance("potion_appearance"), "potion-public-appearance"),
    ])
    case("    case SCROLL_CLASS:", "    case WAND_CLASS:", [
        mark('Strcpy(buf, "scroll");', generic_binding("scroll"), "scroll-unseen-generic"),
        mark("Strcat(buf, actualn);", actual("scroll_name"), "scroll-known-name"),
        mark('xcalled(buf, BUFSZ - PREFIX, "", un);', unsupported, "scroll-called-fallback"),
        ("            Strcat(buf, dn);", "            " + observe_statement("Strcat(buf, dn);", appearance("scroll_label")),
         "scroll-public-rune-label"),
        mark("Strcpy(buf, dn);", appearance("scroll_appearance"), "scroll-public-nonmagic-appearance"),
    ])
    case("    case WAND_CLASS:", "    case SPBOOK_CLASS:", [
        mark('Strcpy(buf, "wand");', generic_binding("wand"), "wand-unseen-generic"),
        mark('Sprintf(buf, "wand of %s", actualn);', actual("wand_name"), "wand-known-name"),
        mark('xcalled(buf, BUFSZ - PREFIX, "wand", un);', unsupported, "wand-called-fallback"),
        mark('Sprintf(buf, "%s wand", dn);', appearance("wand_appearance"), "wand-public-appearance"),
    ])
    case("    case SPBOOK_CLASS:", "    case RING_CLASS:", [
        ('        if (typ == SPE_NOVEL) { /* 3.6 tribute */',
         '        if (typ == SPE_NOVEL) { /* 3.6 tribute */\n            ' + unsupported,
         "novel-fallback"),
        mark('Strcpy(buf, "spellbook");', generic_binding("spellbook"), "spellbook-unseen-generic"),
        ('            if (typ != SPE_BOOK_OF_THE_DEAD)\n                Strcpy(buf, "spellbook of ");',
         '            if (typ != SPE_BOOK_OF_THE_DEAD)\n                Strcpy(buf, "spellbook of ");\n'
         '            else\n                ' + unsupported,
         "book-of-dead-fallback"),
        mark("Strcat(buf, actualn);", actual("spellbook_name"), "spellbook-known-name"),
        mark('xcalled(buf, BUFSZ - PREFIX, "spellbook", un);', unsupported, "spellbook-called-fallback"),
        mark('Sprintf(buf, "%s spellbook", dn);', appearance("spellbook_appearance"), "spellbook-public-appearance"),
    ])
    case("    case RING_CLASS:", "    case GEM_CLASS: {", [
        mark('Strcpy(buf, "ring");', generic_binding("ring"), "ring-unseen-generic"),
        mark('Sprintf(buf, "ring of %s", actualn);', actual("ring_name"), "ring-known-name"),
        mark('xcalled(buf, BUFSZ - PREFIX, "ring", un);', unsupported, "ring-called-fallback"),
        mark('Sprintf(buf, "%s ring", dn);', appearance("ring_appearance"), "ring-public-appearance"),
    ])
    # The original material decision already determines the public stone/gem
    # noun. Snapshot its literal together with that same native decision once.
    case("    case GEM_CLASS: {", "    default:", [
        ('        const char *rock = (ocl->oc_material == MINERAL) ? "stone" : "gem";',
         '        boolean nh_public_stone;\n'
         '        const char *rock = (nh_public_stone = (ocl->oc_material == MINERAL)) ? "stone" : "gem";',
         "gem-original-public-noun-choice-captured-once"),
        mark("Strcpy(buf, rock);", "nh_object_generic = nh_public_stone ? "
             '"nethack.name.object.generic.stone" : "nethack.name.object.generic.gem"; '
             "nh_object_recipe = NULL; nh_object_public = NULL;", "gem-unseen-public-class"),
        mark("xcalled(buf, BUFSZ - PREFIX, rock, un);", unsupported, "gem-called-fallback"),
        mark('Sprintf(buf, "%s %s", dn, rock);', appearance() + " nh_object_recipe = nh_public_stone ? "
             '"nethack.name.object.stone_appearance" : "nethack.name.object.gem_appearance";',
             "gem-public-appearance-and-class"),
        mark("Strcpy(buf, actualn);", actual(), "gem-known-name"),
        mark('Strcat(buf, " stone");', 'nh_object_recipe = "nethack.name.object.gem_stone";', "gem-known-stone-suffix"),
    ])
    body = replace_once(body, "    if (has_oname(obj) && dknown) {",
                        "    if (has_oname(obj) && dknown) {\n        " + unsupported,
                        "native-custom-name-addition-fallback")
    hooks.append("native-custom-name-addition-fallback")
    # All game-over decorations are unsupported; set the marker only in the
    # original branch, so no additional knowledge or naming function is called.
    gameover_anchor = "    if (program_state.gameover && obj->o_id && bufspaceleft > 0) {"
    body = replace_once(body, gameover_anchor, gameover_anchor + "\n        " + unsupported,
                        "native-gameover-decoration-fallback")
    hooks.append("native-gameover-decoration-fallback")
    body = replace_once(body, "    if (buf_eos >= buf_end) { /* ('>' shouldn't be possible) */",
                        "    if (buf_eos >= buf_end) { /* ('>' shouldn't be possible) */\n        " + unsupported,
                        "native-full-buffer-fallback")
    hooks.append("native-full-buffer-fallback")
    body = replace_once(body, "    return buf;\n}",
                        "    if (nh_object_supported) {\n"
                        "        if (nh_object_generic)\n"
                        "            nh_text_name_generic(buf, nh_object_generic);\n"
                        "        else if (nh_object_recipe && nh_object_public)\n"
                        "            nh_text_name_object(buf, nh_object_recipe, nh_object_index,\n"
                        "                                nh_object_field, nh_object_public);\n"
                        "    }\n    return buf;\n}", "completed-public-buffer-binding")
    hooks.append("completed-public-buffer-binding")
    source = source[:start] + body + source[end:]
    return NOTICE + source, hooks


def generate(output: Path, apply: Path | None = None, upstream: Path = UPSTREAM) -> dict:
    original = (upstream / "src/objnam.c").read_text(encoding="utf-8")
    changed, hooks = instrument_text(original)
    output.mkdir(parents=True, exist_ok=True)
    patch = "".join(difflib.unified_diff(original.splitlines(True), changed.splitlines(True),
                                       fromfile="a/src/objnam.c", tofile="b/src/objnam.c"))
    (output / "objects.patch").write_text(patch, encoding="utf-8", newline="\n")
    audit = {
        "schema_version": 1, "date": "2026-10-02", "official_commit": COMMIT,
        "compiled": False, "runtime_verified": False, "source": "src/objnam.c",
        "producer": "completed original xname_flags branch",
        "source_sha256": sha(original), "patched_sha256": sha(changed), "patch_sha256": sha(patch),
        "hooks": hooks, "unsupported": UNSUPPORTED,
        "selection": "oc_name_idx only for selected actualn; oc_descr_idx only for selected dn; generic branches export no index",
        "label_validation": "shared registry requires exact selected pointer equality with original obj_descr field; no English reverse lookup",
        "english": "original completed public name retained; no English plural recomputation",
        "japanese": "locale-owned recipe; Japanese nouns need no native English plural suffix",
        "state": "original observe_object, known/bknown, artifact discovery, boulder reset, name/conversion/RNG calls retained exactly once",
        "registry": "range invalidation at original nextobuf/releaseobuf selections; final returned pointer registered only after native formatting",
        "fallback": "unsupported, stale, modified, aliased, unmapped or oversized names keep original public English",
        "applied": False,
    }
    if apply is not None:
        target = apply.resolve() / "src/objnam.c"
        working = target.read_text(encoding="utf-8")
        composed, composed_hooks = instrument_text(working)
        if composed_hooks != hooks:
            raise ValueError("Working-copy hook set differs from exact upstream generation")
        target.write_text(composed, encoding="utf-8", newline="\n")
        audit["applied"] = True
        audit["working_before_sha256"] = sha(working)
        audit["working_after_sha256"] = sha(composed)
    (output / "objects-audit.json").write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n",
                                               encoding="utf-8", newline="\n")
    return audit


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--apply", type=Path, help="Compose hooks with an existing working copy; default generates review artifacts only")
    args = parser.parse_args()
    print(json.dumps(generate(args.output, args.apply), ensure_ascii=False, indent=2))
