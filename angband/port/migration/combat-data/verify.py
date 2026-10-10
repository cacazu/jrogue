"""Lightweight independent source-contract checks; no C/Rust execution."""
from pathlib import Path
import hashlib
import json
import re
import subprocess
import sys
import unittest

HERE=Path(__file__).resolve().parent
ROOT=HERE.parent.parent
sys.path.insert(0,str(HERE))
from hook_source import MARKER,function

class Contracts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifest=json.loads((HERE/"source-manifest.json").read_text(encoding="utf-8"))
        cls.helper=(ROOT/"logic/web-combat.c").read_text(encoding="utf-8")
        cls.header=(ROOT/"logic/web-combat.h").read_text(encoding="utf-8")
        cls.sources={file:(ROOT/"logic"/file).read_bytes().decode("utf-8") for file in ("mon-msg.c","mon-spell.c","mon-blows.c")}
    def body(self,file,name):
        a,b=function(self.sources[file],name);return self.sources[file][a:b]
    def test_01_exact_pre_hook_byte_reconstruction(self):
        evidence=json.loads((HERE/"hook-baselines.json").read_text(encoding="utf-8"))
        for file,source in self.sources.items():
            actual=MARKER.sub("",source).encode("utf-8")
            self.assertEqual(hashlib.sha256(actual).hexdigest(),evidence[file]["before_sha256"])
            self.assertEqual(len(actual),evidence[file]["before_bytes"])
    def test_02_original_rng_draw_is_single_and_helper_has_none(self):
        action=self.body("mon-blows.c","monster_blow_method_action")
        self.assertEqual(action.count("randint0(method->num_messages)"),1)
        self.assertIsNone(re.search(r"\b(?:randint\d*|Rand_[A-Za-z]+|one_in_|damroll|monster_desc|rf_has|monster_is_obvious|panel_contains)\s*\(",self.helper))
    def test_03_save_notification_follows_existing_successful_draw(self):
        source=self.body("mon-spell.c","do_mon_spell")
        draw=source.index("randint0(100) < player->state.skills[SKILL_SAVE]")
        capture=source.index("ab_combat_save(level->save_message)")
        native=source.index('msg("%s", level->save_message)')
        failure=source.index("effect_do(",native)
        self.assertLess(draw,capture);self.assertLess(capture,native);self.assertLess(native,failure)
    def test_04_suppressed_unseen_branches_precede_capture(self):
        source=self.body("mon-spell.c","spell_message")
        begin=source.index("ab_combat_spell_begin")
        self.assertLess(source.index("if (!seen)"),begin)
        self.assertLess(source.index("if (t_mon)"),begin)
        self.assertEqual(source[:begin].count("return;"),7)
        self.assertEqual(source[:begin].count("in_cursor[0] == '\\0'"),3)
    def test_05_descriptor_occurrences_are_copied_after_original_calls(self):
        spell=self.body("mon-spell.c","spell_message")
        self.assertEqual(spell.count("monster_desc("),3)
        self.assertEqual(spell.count("ab_combat_template_monster("),3)
        blow=self.body("mon-blows.c","monster_blow_method_action")
        self.assertEqual(blow.count("monster_desc("),2)
        self.assertEqual(blow.count("ab_combat_template_monster("),2)
        self.assertLess(blow.index("in_cursor = msg->act_msg"),blow.index("ab_combat_blow_action_begin"))
    def test_06_pointer_identity_not_completed_english_lookup(self):
        self.assertIn("bindings[i].source==source",self.helper)
        comparisons=re.findall(r"strcmp\((.*?)\)",self.helper)
        self.assertTrue(comparisons)
        self.assertTrue(all("method->name" in value or 'tag,' in value or 's->kind,' in value for value in comparisons))
        self.assertNotIn("strstr(",self.helper);self.assertNotIn("hash",self.helper)
    def test_07_blow_array_sentinel_and_reverse_order(self):
        self.assertEqual(self.helper.count("&blow_methods[1]"),2)
        self.assertIn("method->num_messages-1-ab_combat_blow_aliases[i].source_ordinal",self.helper)
        aliases=[x for x in self.manifest["private_source_aliases"] if x["kind"]=="blow_action"]
        methods={}
        for alias in aliases:methods.setdefault(alias["method_code"],[]).append(alias)
        for rows in methods.values():
            n=len(rows)
            self.assertEqual(sorted(x["source_choice_ordinal"] for x in rows),list(range(n)))
            self.assertEqual([n-1-x["source_choice_ordinal"] for x in rows],list(reversed(range(n))))
    def test_08_bounds_cover_exact_source_pointer_records(self):
        aliases=self.manifest["private_source_aliases"]
        # Each pain source gets one binding holding both forms; repository
        # aliases are direct enum lookups and consume no pointer slots.
        expected=sum(x["kind"] not in ("repository","pain") for x in aliases)+sum(x["kind"]=="pain" and not x["plural"] for x in aliases)
        capacity=int(re.search(r"#define AB_COMBAT_BINDINGS_MAX (\d+)U",self.helper)[1])
        self.assertLess(expected,capacity);self.assertEqual(expected,566)
        self.assertIn("binding_count>=AB_COMBAT_BINDINGS_MAX",self.helper)
    def test_09_public_adapter_abi_is_complete(self):
        declared=set(re.findall(r"\b(ab_combat_[a-z_]+)\([^;{}]*\);",self.header))
        defined=set(re.findall(r"^(?:const char \*|void |int )(ab_combat_[a-z_]+)\([^;]*?\)\s*\{",self.helper,re.M))
        self.assertEqual(declared,defined);self.assertEqual(len(declared),23)
    def test_10_hidden_subject_has_no_race_lookup(self):
        start=self.helper.index("void ab_combat_subject_hidden(");end=self.helper.index("void ab_combat_subject_visible(",start)
        self.assertNotIn("race",self.helper[start:end])
        self.assertIn('s->kind="omitted"',self.helper)
        self.assertIn("if(unique) active_reaction->count=1",self.helper)
    def test_11_display_damage_copies_original_result_once(self):
        source=self.body("mon-msg.c","show_message")
        self.assertEqual(source.count("AB_COMBAT_REACTION_DAMAGE("),2)
        self.assertEqual(source.count("msg->damage / msg->count"),1)
        self.assertEqual(source.count("msg->damage % msg->count"),1)
        self.assertIn("return displayed_damage",self.helper)
        self.assertNotIn("msg->",self.helper)
    def test_12_only_approved_producer_functions_are_modified(self):
        approved={"mon-msg.c":["get_subject","get_message_text","show_message"],
                  "mon-spell.c":["spell_message","do_mon_spell"],
                  "mon-blows.c":["monster_blow_method_action","display_blow_message_vs_player","display_blow_message_vs_monster"]}
        for file,names in approved.items():
            source=self.sources[file]
            total=len(MARKER.findall(source))
            in_functions=sum(len(MARKER.findall(self.body(file,name))) for name in names)
            self.assertEqual(total,in_functions+1) # one include block
    def test_13_actor_and_action_owned_before_more_and_free(self):
        for name in ["display_blow_message_vs_player","display_blow_message_vs_monster"]:
            source=self.body("mon-blows.c",name)
            self.assertLess(source.index("ab_combat_blow_begin"),source.index("monster_blow_method_action"))
            self.assertLess(source.index("ab_combat_blow_emit"),source.index("msgt("))
            self.assertLess(source.index("ab_combat_blow_emit"),source.index("string_free(act)"))
            self.assertIn("ab_combat_blow_end",source)
        self.assertIn("active_blow->action=s->value",self.helper)
        self.assertIn("ab_naming_snapshot_release(&s->actor)",self.helper)
    def test_14_complete_catalog_id_and_placeholder_parity(self):
        en=json.loads((HERE/"en.json").read_text(encoding="utf-8"))
        ja=json.loads((HERE/"ja.json").read_text(encoding="utf-8"))
        schema=json.loads((HERE/"schema.json").read_text(encoding="utf-8"))["entries"]
        self.assertEqual(en.keys(),ja.keys());self.assertEqual(en.keys(),schema.keys());self.assertEqual(len(en),670)
        for id in en:
            expected={x["name"] for x in schema[id]["parameters"]}
            for template in [en[id],ja[id]]:
                self.assertEqual(set(re.findall(r"\{([a-z][a-z0-9_]*)\}",template)),expected,id)
    def test_15_lore_templates_are_bound_but_not_claimed_emitted(self):
        aliases=self.manifest["private_source_aliases"]
        self.assertEqual(sum(x["kind"]=="spell_level" and x["field"]=="lore" for x in aliases),111)
        self.assertEqual(sum(x["kind"]=="blow_lore" for x in aliases),19)
        self.assertIn("case 4:source=level->lore_desc",self.helper)
        self.assertIn("bind_source(method->desc",self.helper)
    def test_16_helper_does_not_assign_domain_fields(self):
        self.assertIsNone(re.search(r"\b(?:race|spell|level|method|mon|obj|player)->\w+\s*=(?!=)",self.helper))

if __name__=="__main__":
    result=unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(Contracts))
    evidence={"kind":"source-only-contract-checks","tests":result.testsRun,"failures":len(result.failures),"errors":len(result.errors),
        "compiled_or_executed_engine":False,"upstream_commit":"f3082213b73f3e463e3d0d60bff4b00462beae6e"}
    (HERE/"source-checks.json").write_text(json.dumps(evidence,indent=2)+"\n",encoding="utf-8")
    raise SystemExit(0 if result.wasSuccessful() else 1)
