"""Added 2026-10-02, NGPL: isolated phase4/5 source acceptance checks.

These tests do not compile C/Rust, instantiate WASM, open a browser, or change
the canonical engine. Native/runtime validation remains a separate gate.
"""
from __future__ import annotations
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest
sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[1]


def module(path,name):
    spec=importlib.util.spec_from_file_location(name,path)
    result=importlib.util.module_from_spec(spec);sys.modules[name]=result;spec.loader.exec_module(result)
    return result


p4=module(ROOT/"tools/instrument-semantic-phase4.py","combined_test_helpers")
eligibility=module(ROOT/"tools/semantic-text/phase4/prepare-name-eligibility.py","combined_test_eligibility")
loader=module(ROOT/"tools/semantic-text/phase4/catalog-loader.py","combined_test_loader")
PREPARED=ROOT/"work/phase4/semantic-generated"
SOURCE=ROOT/"work/phase4/NetHack-5.0.0"
combined=module(ROOT/"tools/prepare-combined-semantic.py","combined_replay_under_test")


class PreparedReplayTests(unittest.TestCase):
    def test_all_replacements_preserve_native_directive_boundaries(self):
        audit=p4.load(PREPARED/"preprocessor-boundary-audit.json")
        self.assertEqual(audit["checked_call_operations"],5020)
        self.assertEqual([(row["source"],row["line"]) for row in audit["spanning_calls"]],[("src/pager.c",2666)])
        folders=[PREPARED/"phase4-inputs",PREPARED/"phase4-inputs/dynamic-literals",
                 PREPARED/"phase4-inputs/diagnostic-wrappers"]
        for folder in folders:
            for operation in p4.load(folder/"call-operations.json")["operations"]:
                self.assertEqual(p4.call_directives(operation["original_call"]),
                                 p4.call_directives(operation["replacement"]))

    def fixture(self):
        directory=tempfile.TemporaryDirectory(prefix="source-replay-check-",dir=ROOT/"work/phase4")
        root=Path(directory.name);upstream=root/"upstream";source=root/"source"
        (upstream/"src").mkdir(parents=True);(source/"src").mkdir(parents=True)
        return directory,upstream,source

    def test_replay_resets_only_exact_prior_owned_source(self):
        directory,upstream,source=self.fixture()
        with directory:
            (upstream/"src/a.c").write_text("original",encoding="utf8")
            (source/"src/a.c").write_text("prior-generated",encoding="utf8")
            manifest={"prepared_sources":[{"source":"src/a.c","patched_sha256":p4.sha("prior-generated")}]}
            self.assertEqual(combined.restore_verified_owned_sources(upstream,source,manifest,p4.sha),1)
            self.assertEqual((source/"src/a.c").read_text("utf8"),"original")

    def test_replay_validates_all_sources_before_any_write(self):
        directory,upstream,source=self.fixture()
        with directory:
            for name,content in (("a.c","prior-generated"),("b.c","unrecognized-edit")):
                (upstream/"src"/name).write_text("original",encoding="utf8")
                (source/"src"/name).write_text(content,encoding="utf8")
            manifest={"prepared_sources":[{"source":"src/"+name,"patched_sha256":p4.sha("prior-generated")}
                                          for name in ("a.c","b.c")]}
            with self.assertRaisesRegex(ValueError,"Unrecognized Phase4"):
                combined.restore_verified_owned_sources(upstream,source,manifest,p4.sha)
            self.assertEqual((source/"src/a.c").read_text("utf8"),"prior-generated")
            self.assertEqual((source/"src/b.c").read_text("utf8"),"unrecognized-edit")

    def test_replay_rejects_path_escape(self):
        directory,upstream,source=self.fixture()
        with directory:
            with self.assertRaisesRegex(ValueError,"escapes"):
                combined.restore_verified_owned_sources(upstream,source,{"prepared_sources":[
                    {"source":"../outside.c","patched_sha256":"untrusted"}]},p4.sha)


class NameProvenanceTests(unittest.TestCase):
    def test_direct_producers_and_articles(self):
        for expression in ("mon_nam(m)","Monnam(m)","xname(o)","doname(o)",
                           "the(xname(o))","The(an(mon_nam(m)))","((mon_nam(m)))"):
            self.assertTrue(eligibility.qualifies(expression,p4.sem),expression)

    def test_pooled_literal_opaque_and_composed_output_not_promoted(self):
        for expression in ('"dragon"','the("dragon")','body_part(HAND)','hcolor(NULL)',
                           'buf','names[i]','flag ? mon_nam(m) : "dragon"',
                           'mon_nam(m) + 1','strcpy(buf, mon_nam(m))','Tobjnam(o,"hit")'):
            self.assertFalse(eligibility.qualifies(expression,p4.sem),expression)

    def test_bridge_requires_source_permission_before_registry(self):
        source=(ROOT/"tools/semantic-text/nh-semantic.c").read_text(encoding="utf8")
        changed=eligibility.bridge_source(source,p4.sem)
        self.assertIn('if (!event && arguments[i].allow_name_capture) event=nh_text_name_event(a->text);',changed)
        self.assertIn('if (!event && arguments[i].allow_name_capture) scope->invalid=1;',changed)
        self.assertNotIn('if (!event) event=nh_text_name_event(a->text);',changed)
        self.assertEqual(changed.count("nh_text_name_event("),source.count("nh_text_name_event("))

    def test_default_zero_permission_preserves_original_fields(self):
        source=(ROOT/"tools/semantic-text/nh-semantic.h").read_text(encoding="utf8")
        changed=eligibility.bridge_header(source,p4.sem)
        self.assertEqual(changed.replace('    int allow_name_capture; /* exact source-proven original name expression only; default zero */\n',''),source)

    def test_same_literal_pointer_cannot_claim_unrelated_name(self):
        # The gate is source syntax, independent of the identical hypothetical
        # address or English bytes. No registry call is permitted for the raw
        # literal after an earlier true public-name producer.
        identical_bytes="dragon"
        self.assertEqual(identical_bytes,"dragon")
        self.assertTrue(eligibility.qualifies("mon_nam(m)",p4.sem))
        self.assertFalse(eligibility.qualifies('"dragon"',p4.sem))
        self.assertFalse(eligibility.qualifies("pooled_pointer",p4.sem))

    def test_raw_wrapper_lookup_removed_but_original_call_once(self):
        header='''static inline void test_wrapper(const char *nh_p0, const char *nh_p1) {
    const char *nh_public_0 = nh_text_name_event(nh_p1);
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, (nh_public_0 ? nh_public_0 : nh_raw_0)},
    };
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
}
'''
        operation={"id":"nethack.test.literal","source":"src/test.c","line":1,
                   "original_argument_expressions":['"%s"','"dragon"'],"replacement":'test_wrapper("%s", "dragon")'}
        with tempfile.TemporaryDirectory(dir=ROOT/"build/phase4") as temp:
            folder=Path(temp);(folder/"include").mkdir()
            path=folder/"include/sites-test.h";path.write_text(header,encoding="utf8")
            audit=eligibility.overlay_headers(folder,[operation],[],p4.sem,p4.inventory)
            changed=path.read_text(encoding="utf8")
        self.assertNotIn("nh_text_name_event(",changed)
        self.assertIn('NH_TEXT_TEXT, nh_p1, 0, (nh_public_0 ? nh_public_0 : nh_raw_0), 0}',changed)
        self.assertEqual(changed.count("pline("),1)
        self.assertEqual(audit["counts"],{"text_slots":1,"eligible":0,"raw_without_lookup":1})


class CatalogContractTests(unittest.TestCase):
    def test_unknown_placeholder_and_union_conflict_rejected(self):
        target={"en":{},"ja":{},"argument_schemas":{"nethack.test":["arg_1"]}}
        with self.assertRaisesRegex(ValueError,"unknown template field"):
            loader.merge_table(target,{"en":{"nethack.test":"{secret}"},"ja":{}},p4.catalog.names)
        with self.assertRaisesRegex(ValueError,"conflicting source union"):
            loader.merge_table(target,{"en":{},"ja":{},"argument_schemas":{"nethack.test":["secret"]}},p4.catalog.names)

    def test_equivalent_named_union_order_not_positional_mapping(self):
        target={"en":{},"ja":{},"argument_schemas":{"nethack.test":["arg_2","arg_1"]}}
        loader.merge_table(target,{"en":{"nethack.test":"{arg_1} {arg_2}"},"ja":{},
                                 "argument_schemas":{"nethack.test":["arg_1","arg_2"]}},p4.catalog.names)
        self.assertEqual(set(target["argument_schemas"]["nethack.test"]),{"arg_1","arg_2"})

    def test_source_free_literals_only_have_empty_union(self):
        target={"en":{},"ja":{},"argument_schemas":{}}
        loader.merge_table(target,{"en":{"nethack.entity.test":"dragon"},"ja":{}},p4.catalog.names)
        self.assertEqual(target["argument_schemas"]["nethack.entity.test"],[])
        with self.assertRaisesRegex(ValueError,"unknown template field"):
            loader.merge_table(target,{"en":{"nethack.unknown":"{private}"},"ja":{}},p4.catalog.names)

    def test_authored_frame_cannot_install_unbound_source_recipe(self):
        identifier="nethack.test.source"
        contract={"id":identifier,"en":"Exact original.","arguments":[]}
        proposal={"id":identifier,"whole_message_en":"Exact original.","whole_message_ja":"元の文。",
                  "argument_schema":[],"source_translation_approved_claim":True,
                  "requires_public_name_or_grammar_producer":False,"source_literal_translations":[{"required":True}]}
        with tempfile.TemporaryDirectory(dir=ROOT/"build/phase4") as temp:
            folder=Path(temp);base=folder/"base.json";author=folder/"author.json"
            base.write_text(json.dumps({"en":{identifier:contract["en"]},"ja":{},"argument_schemas":{identifier:[]}}),encoding="utf8")
            author.write_text(json.dumps({"entries":[proposal]}),encoding="utf8")
            catalog,audit=loader.load_catalog([base],[contract],[author],p4.catalog.names,p4.sha)
            self.assertNotIn(identifier,catalog["ja"])
            self.assertEqual(audit["counts"]["queued"],1)
            proposal["source_literal_translations"]=[]
            author.write_text(json.dumps({"entries":[proposal]}),encoding="utf8")
            catalog,audit=loader.load_catalog([base],[contract],[author],p4.catalog.names,p4.sha)
            self.assertEqual(catalog["ja"][identifier],"元の文。")
            self.assertEqual(audit["counts"]["activated"],1)


class CombinedEvidenceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.audit=p4.load(PREPARED/"audit.json")
        cls.names=p4.load(PREPARED/"name-eligibility-audit.json")
        cls.catalog=p4.load(PREPARED/"catalog.json")
        cls.catalog_audit=p4.load(PREPARED/"catalog-audit.json")

    def test_frozen_default_outputs_and_generator_unchanged(self):
        proof=p4.load(p4.DEFAULT_OUTPUT/"default-output-equivalence.json")
        self.assertEqual(p4.sha((ROOT/"tools/instrument-semantic-text.py").read_bytes()),proof["generator_sha256"])
        self.assertEqual(proof["file_count"],69)
        for row in proof["checks"]:
            current=(ROOT/"tools/semantic-text/generated"/row["path"]).read_bytes()
            self.assertEqual(current,(p4.DEFAULT_OUTPUT/"default-equivalence"/row["path"]).read_bytes(),row["path"])
            self.assertEqual(p4.sha(current),row["sha256"])
        for path,digest in self.audit["phase4"]["frozen_inputs"].items():
            self.assertEqual(p4.sha((ROOT/path).read_bytes()),digest,path)

    def test_all_prepared_source_and_header_hashes_exact(self):
        for row in self.audit["files"]:
            self.assertEqual(p4.sha((SOURCE/row["source"]).read_bytes()),row["patched_sha256"],row["source"])
        for row in self.audit["generated_files"]:
            self.assertEqual((SOURCE/row["path"]).read_bytes(),(PREPARED/row["path"]).read_bytes(),row["path"])
            self.assertEqual(p4.sha((SOURCE/row["path"]).read_bytes()),row["sha256"],row["path"])

    def test_full_literal_and_dynamic_denominators_remain_visible(self):
        self.assertEqual(self.audit["phase4"]["literal_source_contract_ids"],5559)
        self.assertEqual(self.audit["phase4"]["additional_call_operations"],5020)
        self.assertFalse(self.audit["phase4"]["compiled"])
        self.assertFalse(self.audit["phase4"]["runtime_verified"])
        self.assertEqual(len(self.audit["files"]),107)

    def test_catalog_within_existing_rust_bound_and_exact_unions(self):
        self.assertLess((PREPARED/"catalog.json").stat().st_size,16*1024*1024)
        for locale in ("en","ja"):
            for identifier,template in self.catalog[locale].items():
                self.assertFalse(p4.catalog.names(template)-set(self.catalog["argument_schemas"][identifier]),identifier)
        self.assertEqual(self.catalog["argument_schemas"]["context.location_prefix"],["location","text"])
        self.assertNotIn("nethack.public_text.original",self.catalog["ja"])

    def test_authoring_input_provenance_bound_to_snapshot(self):
        # Author queues can continue separately; this snapshot still records
        # exact historical bytes for the source-only prepared catalog.
        paths=[row["path"] for row in self.catalog_audit["input_provenance"]]
        self.assertEqual(len(paths),len(set(paths)))
        self.assertGreaterEqual(self.catalog_audit["counts"]["activated"],1436)
        self.assertGreater(self.catalog_audit["counts"]["queued"],0)
        self.assertEqual(self.catalog_audit["counts"]["english_keys"],len(self.catalog["en"]))
        self.assertEqual(self.catalog_audit["counts"]["japanese_keys"],len(self.catalog["ja"]))

    def test_original_rng_adapter_and_quest_emission_owner_retained(self):
        rnd=(SOURCE/"src/rnd.c").read_text(encoding="utf8")
        self.assertEqual(rnd.count("EMSCRIPTEN_KEEPALIVE unsigned nh_abi_rng_checksum(void)"),1)
        quest=(SOURCE/"src/questpgr.c").read_text(encoding="utf8")
        self.assertIn('nh_quest_line(NH_TEXT_MESSAGE, WIN_MESSAGE, out_line);\n            nh_text_forward(nh_owner);',quest)
        pline=(SOURCE/"src/pline.c").read_text(encoding="utf8")
        self.assertIn('if (strlen(pbuf) >= BUFSZ) nh_text_truncated(nh_owner);',pline)

    def test_name_permissions_match_only_original_source(self):
        for row in self.names["slots"]:
            self.assertEqual(row["allow_name_capture"],eligibility.qualifies(row["source_expression"],p4.sem))
        self.assertGreater(self.names["counts"]["eligible"],0)
        self.assertGreater(self.names["counts"]["raw_without_lookup"],self.names["counts"]["eligible"])
        bridge=(SOURCE/"src/nh-semantic.c").read_text(encoding="utf8")
        self.assertIn("arguments[i].allow_name_capture",bridge)
        self.assertNotIn('if (!event) event=nh_text_name_event(a->text);',bridge)

    def test_phase5_four_recipes_and_owned_snapshots(self):
        for suffix in ("indefinite","indefinite_capitalized","definite","definite_capitalized"):
            identifier="nethack.name.grammar."+suffix
            self.assertEqual(self.catalog["en"][identifier],"{original}")
            self.assertEqual(self.catalog["ja"][identifier],"{inner}")
            self.assertEqual(set(self.catalog["argument_schemas"][identifier]),{"original","inner"})
        bridge=(SOURCE/"src/nh-semantic-name.c").read_text(encoding="utf8")
        self.assertIn("nh_text_name_grammar_capture",bridge)
        header=(SOURCE/"include/nh-semantic-name-grammar.h").read_text(encoding="utf8")
        self.assertIn("char original[BUFSZ]",header)
        self.assertIn("char event[NH_NAME_GRAMMAR_JSON]",header)

    def test_utility_sources_pristine_and_default_scope_preserved(self):
        builder=(ROOT/"tools/build-upstream.py").read_text(encoding="utf8")
        self.assertIn("return (AUDIT if PHASE4_MODE else SOURCE) / relative",builder)
        self.assertIn('utility_source("src/" + name + ".c") for name in ["dlb", "alloc", "hacklib"]',builder)
        self.assertIn('local_web / "gameplay-core.json"',builder)
        self.assertIn('BUILD = ROOT / "build" / "phase4"',builder)


if __name__=="__main__":
    result=unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromModule(sys.modules[__name__]))
    files=[Path(__file__),ROOT/"tools/prepare-combined-semantic.py",ROOT/"tools/build-upstream.py"]
    files += [path for path in (ROOT/"tools/semantic-text/phase4").iterdir() if path.is_file()]
    proof={"schema_version":1,"date":"2026-10-02","source_only":True,"compiled":False,"runtime_verified":False,
           "test_count":result.testsRun,"passed":result.wasSuccessful(),"failures":len(result.failures),"errors":len(result.errors),
           "prepared_catalog_sha256":p4.sha((PREPARED/"catalog.json").read_bytes()),
           "files":[{"path":str(path.relative_to(ROOT)).replace("\\","/"),"sha256":p4.sha(path.read_bytes()),"bytes":path.stat().st_size} for path in sorted(set(files))]}
    (PREPARED/"source-checks.json").write_text(json.dumps(proof,ensure_ascii=False,indent=2),encoding="utf8",newline="\n")
    sys.exit(0 if result.wasSuccessful() else 1)
