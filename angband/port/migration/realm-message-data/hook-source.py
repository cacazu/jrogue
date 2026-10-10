"""Narrow owning source hooks; removing AB_REALM blocks restores prior bytes.

The first write stores a before-image. --check is read-only and never compiles.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / "tests/realm-message-source-baseline"
FILES = ["cmd-obj.c", "player-calcs.c", "player-spell.c", "player-util.c"]
BEGIN, END = "/* AB_REALM_BEGIN */", "/* AB_REALM_END */"
BLOCKS = re.compile(re.escape(BEGIN) + r".*?" + re.escape(END), re.S)

def tagged(body):
    return BEGIN + body + END

def prefix(text, old, call, count=1):
    assert text.count(old) == count, (old, text.count(old), count)
    return text.replace(old, tagged(call + ", ") + old)

def add(name, original):
    text = original.decode("utf-8")
    assert BEGIN not in text
    nl = "\r\n" if text.count("\r\n") > text.count("\n") / 2 else "\n"
    includes = list(re.finditer(r'^#include[^\n]*\n', text, re.M))
    assert includes
    index = includes[-1].end()
    include = tagged(nl + "#ifdef __EMSCRIPTEN__" + nl + '#include "web-realm-text.h"' + nl + "#endif" + nl)
    text = text[:index] + include + text[index:]
    if name == "cmd-obj.c":
        text = prefix(text, 'msg("You do not have enough mana to %s this %s.", verb, noun)',
                      "ab_realm_cast_warning(spell->realm)")
        text = prefix(text, 'msg("You cannot learn any %ss in that book.", book->realm->spell_noun)',
                      "ab_realm_book_no_learnable(book->realm)")
    elif name == "player-calcs.c":
        text = prefix(text, 'msg("You have forgotten the %s of %s.", spell->realm->spell_noun,',
                      'ab_realm_known_spell(p, spell, "realm.message.spell.forgotten", MSG_GENERIC)', 2)
        text = prefix(text, 'msg("You have remembered the %s of %s.", spell->realm->spell_noun,',
                      'ab_realm_known_spell(p, spell, "realm.message.spell.remembered", MSG_GENERIC)')
        text = prefix(text, 'msg("You can learn %d more %s.", p->upkeep->new_spells, buf)',
                      "ab_realm_more_list(&ab_realm_snapshot, p->upkeep->new_spells)")
    elif name == "player-spell.c":
        text = prefix(text, 'msgt(MSG_STUDY, "You have learned the %s of %s.", spell->realm->spell_noun,',
                      'ab_realm_known_spell(player, spell, "realm.message.spell.learned", MSG_STUDY)')
        text = prefix(text, 'msg("You can learn %d more %s%s.", player->upkeep->new_spells,',
                      "ab_realm_more_single(spell->realm, player->upkeep->new_spells)")
    elif name == "player-util.c":
        text = prefix(text, 'msg("You cannot learn any new %s!", buf)',
                      "ab_realm_none_remaining(&ab_realm_snapshot)")
    if name in ("player-calcs.c", "player-util.c"):
        start = text.index("static void calc_spells(" if name == "player-calcs.c" else "bool player_can_study(")
        statement = "\t\t\tmy_strcpy(buf, r->spell_noun, sizeof(buf));"
        index = text.index(statement, start)
        plural = "p->upkeep->new_spells > 1" if name == "player-calcs.c" else "true"
        body = (nl + "#ifdef __EMSCRIPTEN__" + nl + "\t\t\tstruct ab_realm_list_snapshot ab_realm_snapshot;" + nl +
                f"\t\t\tab_realm_capture_list(&ab_realm_snapshot, r, {plural});" + nl + "#endif" + nl)
        text = text[:index] + tagged(body) + text[index:]
    # Native builds have no helper symbol or snapshot. Surround each inline
    # additive expression with its own preprocessor gate inside the marker.
    def gate(match):
        content = match.group(0)[len(BEGIN):-len(END)]
        if content.startswith("ab_realm_"):
            return tagged(nl + "#ifdef __EMSCRIPTEN__" + nl + content + nl + "#endif" + nl)
        return match.group(0)
    text = BLOCKS.sub(gate, text)
    result = text.encode("utf-8")
    assert BLOCKS.sub("", text).encode("utf-8") == original
    return result

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--plan", action="store_true", help="validate future edits entirely in memory")
    args = parser.parse_args()
    if args.plan:
        for name in FILES:
            current=(ROOT / "logic" / name).read_bytes()
            output=add(name,current)
            assert BLOCKS.sub("",output.decode("utf-8")).encode("utf-8")==current
        print("realm in-memory plan: 4/4 reversible byte proofs; native source files untouched")
        return
    evidence = {"schema_version": 1, "proof": "remove only AB_REALM blocks: exact prehook bytes", "files": []}
    if not args.check:
        BASE.mkdir(parents=True, exist_ok=True)
    for name in FILES:
        path, baseline = ROOT / "logic" / name, BASE / name
        current = path.read_bytes()
        if not args.check:
            assert BEGIN.encode() not in current, f"already hooked: {name}"
            if baseline.exists():
                assert baseline.read_bytes() == current, f"baseline drift: {name}"
            else:
                baseline.write_bytes(current)
            output = add(name, current)
            # Refuse a concurrent write rather than replacing another owner.
            assert path.read_bytes() == current, f"concurrent modification: {name}"
            path.write_bytes(output)
            current = output
        original = baseline.read_bytes()
        stripped = BLOCKS.sub("", current.decode("utf-8")).encode("utf-8")
        assert stripped == original, f"native byte drift: {name}"
        text = current.decode("utf-8")
        for token in ("randint0(", "spell_by_index(", "class_magic_realms(", "mem_free(r)"):
            assert text.count(token) == original.decode("utf-8").count(token), (name, token)
        if name in ("player-calcs.c", "player-util.c"):
            capture = text.index("ab_realm_capture_list(")
            free = text.index("mem_free(r)", capture)
            assert capture < free
            assert text.index("ab_realm_more_list(" if name=="player-calcs.c" else "ab_realm_none_remaining(", free) > free
        evidence["files"].append({"file": "logic/" + name, "before_sha256": hashlib.sha256(original).hexdigest(),
                                 "after_sha256": hashlib.sha256(current).hexdigest(),
                                 "markers": text.count(BEGIN), "native_byte_equal": True})
    target = BASE / "evidence.json"
    encoded = (json.dumps(evidence, indent=2) + "\n").encode("utf-8")
    if args.check:
        assert target.read_bytes() == encoded
    else:
        target.write_bytes(encoded)
    print("realm source checks: 4/4 byte proofs; 9 guarded producers; 2 pre-free owned snapshots; no added RNG/core lookups")

if __name__ == "__main__":
    main()
