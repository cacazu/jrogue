"""Added 2026-10-02, NGPL: isolated source-only phase-four contract checks.

No C compiler, engine/browser runtime, Git mutation or canonical source apply.
The tests reject uncertain source identities rather than matching English.
"""
from __future__ import annotations
import importlib.util
import json
from pathlib import Path
import sys
import unittest
sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("phase4_source_under_test", ROOT/"tools/instrument-semantic-phase4.py")
p4 = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = p4
spec.loader.exec_module(p4)


def fragments(expression):
    result = []
    for token in p4.inventory.c_tokens(expression):
        if token.kind != "string": continue
        result.append({"id":"nethack.test.leaf."+str(len(result)),
                       "source_literal_ordinal":len(result),
                       "source_expression_literal_start":token.start,
                       "source_expression_literal_end":token.end,
                       "english_source_literal":p4.inventory.decode_c_string(token.text)})
    return result


class SelectedValueTests(unittest.TestCase):
    def test_original_pager_preprocessor_argument_keeps_physical_lines(self):
        source=(p4.UPSTREAM/"src/pager.c").read_text(encoding="utf8")
        start=source.index('pline("Ask about \'&\' or \'?\' to get more info.%s"')
        args,end=p4.sem.call_arguments(source,source.index("(",start))
        original=source[start:end]
        changed=p4.rewrite_native_call(original,"pline","test_wrapper",args,args)
        self.assertEqual(changed[len("test_wrapper"):],original[len("pline"):])
        self.assertIn("\n#ifdef ALTMETA\n",changed)
        self.assertEqual(p4.call_directives(original),p4.call_directives(changed))

    def test_directive_layout_rejects_token_equivalent_flattening(self):
        original='pline("%s",\n#if FLAG\n  flag ? "a" :\n#else\n  "b" ? "a" :\n#endif\n  "c")'
        args,end=p4.sem.call_arguments(original,original.index("("))
        flattened='wrapper('+", ".join(args)+')'
        self.assertEqual(p4.sem.tokens(flattened.replace("wrapper","pline",1)),p4.sem.tokens(original))
        self.assertNotEqual(p4.call_directives(original),p4.call_directives(flattened))
        operation={"source":"fixture.c","line":1,"api":"pline","original_start_offset":0,
                   "original_argument_expressions":args,"replacement":flattened}
        with self.assertRaisesRegex(ValueError,"directive layout"):
            p4.compose_calls_before_core(original,"fixture.c",[operation])

    def test_literal_tagging_preserves_original_directives_and_evaluation(self):
        original='pline("%s",\n#if FLAG\n  "one"\n#else\n  "two"\n#endif\n)'
        args,_=p4.sem.call_arguments(original,original.index("("))
        altered=[args[0],args[1].replace('"one"','tag("one")').replace('"two"','tag("two")')]
        changed=p4.rewrite_native_call(original,"pline","wrapper",args,altered)
        self.assertEqual(p4.call_directives(original),p4.call_directives(changed))
        self.assertEqual(changed.count('tag("one")'),1)
        self.assertEqual(changed.count('tag("two")'),1)

    def test_hash_inside_literal_is_not_a_directive(self):
        self.assertEqual(p4.call_directives('pline("#ifdef NO", /* #endif */ "%s")'),[])

    def test_preserves_rng_and_predicate_once(self):
        original = '(rn2(2) ? "first" : (probe() ? "second" : "third"))'
        changed = p4.selected_literals(original, fragments(original))
        self.assertEqual(changed.count("rn2(2)"), 1)
        self.assertEqual(changed.count("probe()"), 1)
        self.assertEqual(changed.count("nh_phase4_text("), 3)
        for literal in ('"first"', '"second"', '"third"'):
            self.assertEqual(changed.count(literal), 1)

    def test_original_condition_precedence_and_escapes(self):
        expression = '(a || b) ? "quote\\\"" : c && d ? "line\\n" : "third"'
        changed = p4.selected_literals(expression, fragments(expression))
        self.assertTrue(changed.startswith('(a || b) ? nh_phase4_text('))
        self.assertIn(' : c && d ? nh_phase4_text(', changed)
        self.assertEqual(changed.count("a || b"), 1)
        self.assertEqual(changed.count("c && d"), 1)

    def test_nonliteral_public_name_not_replayed(self):
        expression = 'flag ? x_monnam(mon) : "second"'
        with self.assertRaisesRegex(ValueError, "nonliteral value leaf"):
            p4.selected_literals(expression, fragments(expression))

    def test_string_in_predicate_rejected(self):
        expression = 'strcmp(name,"secret") ? "first" : "second"'
        with self.assertRaisesRegex(ValueError, "predicate strings"):
            p4.selected_literals(expression, fragments(expression))

    def test_concatenated_literal_requires_review(self):
        expression = 'flag ? "first" "part" : "second"'
        with self.assertRaisesRegex(ValueError, "concatenated"):
            p4.selected_literals(expression, fragments(expression))

    def test_tampered_source_span_rejected(self):
        expression = 'flag ? "first" : "second"'
        bindings = fragments(expression)
        bindings[0]["source_expression_literal_start"] += 1
        with self.assertRaisesRegex(ValueError, "span changed"):
            p4.selected_literals(expression, bindings)

    def test_tampered_literal_bytes_rejected(self):
        expression = 'flag ? "first" : "second"'
        bindings = fragments(expression)
        bindings[0]["english_source_literal"] = "wrong"
        with self.assertRaisesRegex(ValueError, "bytes changed"):
            p4.selected_literals(expression, bindings)

    def test_incomplete_or_duplicate_descriptors_rejected(self):
        expression = 'flag ? "first" : "second"'
        bindings = fragments(expression)
        with self.assertRaisesRegex(ValueError, "every original"):
            p4.selected_literals(expression, bindings[:1])
        bindings[1]["source_literal_ordinal"] = 0
        with self.assertRaisesRegex(ValueError, "duplicate/missing"):
            p4.selected_literals(expression, bindings)

    def test_dynamic_format_uses_original_selection_once(self):
        expression = 'Deaf ? alt_whistle_str : whistle_str'
        changed = p4.selected_format(expression, {"alt_whistle_str":"vibration_descriptor", "whistle_str":"whistle_descriptor"})
        self.assertEqual(changed, 'Deaf ? nh_phase4_format(alt_whistle_str, &vibration_descriptor) : nh_phase4_format(whistle_str, &whistle_descriptor)')
        self.assertEqual(changed.count("Deaf"), 1)

    def test_dynamic_symbol_in_predicate_rejected(self):
        with self.assertRaisesRegex(ValueError, "inside its condition"):
            p4.selected_format('whistle_str ? whistle_str : alt_whistle_str', {"alt_whistle_str":"d1", "whistle_str":"d2"})

    def test_dynamic_unreviewed_format_rejected(self):
        with self.assertRaisesRegex(ValueError, "non-reviewed"):
            p4.selected_format('Deaf ? fresh_format() : whistle_str', {"whistle_str":"d1"})


class NativeDeliveryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.windows = (p4.UPSTREAM/"src/windows.c").read_text(encoding="utf8")
        cls.bridge = (ROOT/"tools/semantic-text/nh-semantic.c").read_text(encoding="utf8")

    def test_getlin_claim_precedes_native_queue_without_replay(self):
        changed = p4.getlin_delivery(self.windows)
        claim = 'nh_text_claim(NH_TEXT_QUESTION)'
        self.assertEqual(changed.count(claim), 1)
        self.assertLess(changed.index(claim),changed.index('while ((cmdq = cmdq_pop()) != 0)',changed.index('getlin(')))
        self.assertEqual(changed.count("cmdq_pop()"), self.windows.count("cmdq_pop()"))
        self.assertEqual(changed.count("(*windowprocs.win_getlin)(query, bufp);"), 1)
        self.assertIn('pline("%s %s", query, obufp);', changed)
        queued = changed[changed.index("if (got_cmdq)"):changed.index("program_state.in_getlin = 1;")]
        self.assertNotIn("nh_text_emit", queued)

    def test_getlin_emission_scoped_only_original_callback(self):
        changed = p4.getlin_delivery(self.windows)
        start = changed.index("struct nh_text_scope *nh_previous = nh_text_emit(nh_owner);",changed.index("getlin("))
        end = changed.index("nh_text_emit(nh_previous);", start)
        self.assertEqual(p4.sem.tokens(changed[start:end]), p4.sem.tokens(
            "struct nh_text_scope *nh_previous = nh_text_emit(nh_owner); (*windowprocs.win_getlin)(query, bufp);"))
        self.assertIn("gb.bot_disabled = old_bot_disabled;", changed[end:])
        self.assertIn("program_state.in_getlin = 0;", changed[end:])

    def test_getter_exact_api_callback_window_not_generic_question(self):
        changed = p4.getlin_getter(self.bridge)
        added = changed.replace(self.bridge[:self.bridge.index('    if (kind == NH_TEXT_RAW')], "", 1)
        self.assertIn('!strcmp(s->descriptor->api,"getlin")', added)
        self.assertIn('!strcmp(callback,"shim_getlin") && window == -1', added)
        self.assertEqual(changed.count('"shim_getlin"'), self.bridge.count('"shim_getlin"')+1)
        self.assertEqual(changed.count('"shim_yn_function"'), self.bridge.count('"shim_yn_function"'))

    def test_helpers_are_complete_once_and_context_selected(self):
        self.assertEqual(p4.catalog.whole_message("You1", "fall.", "")[0], "You fall.")
        self.assertEqual(p4.catalog.whole_message("Your1", "hand.", "")[0], "Your hand.")
        self.assertEqual(p4.catalog.whole_message("verbalize", "Hello!", "")[0], '"Hello!"')
        self.assertEqual(p4.HELPERS["You_hear1"],"NH_TEXT_HEAR")
        self.assertEqual(set(p4.catalog.variants("You_hear1","sound.","")), {"dream","underwater"})
        self.assertEqual(set(p4.catalog.variants("You_see","light.","")), {"dream","blind"})

    def test_getlin_wrapper_retains_original_fixed_arguments(self):
        entry = {"id":"nethack.test.getlin.prompt", "arguments":[]}
        site = {"api":"getlin", "format_argument_index":0,"argument_expressions":['"Name?"','buf']}
        result, types = p4.wrapper(entry,site,"test_prompt",set(),set())
        self.assertEqual(types, ["const char *","char *"])
        self.assertIn("getlin(nh_p0, nh_p1);",result)
        self.assertNotIn("nh_text_emit",result)
        self.assertEqual(result.count("getlin(nh_p0, nh_p1);"),1)

    def test_impossible_first_message_preserves_formatter_and_ancillary_flow(self):
        diagnostic = p4.module(ROOT/"tools/semantic-text/phase4/prepare-impossible.py","phase4_diagnostic_test")
        original = (p4.UPSTREAM/"src/pline.c").read_text(encoding="utf8")
        changed = diagnostic.transform(original)
        start, end = changed.index("impossible(const char *s, ...)"), changed.index("RESTORE_WARNING_FORMAT_NONLITERAL",changed.index("impossible(const char *s, ...)"))
        function = changed[start:end]
        self.assertEqual(function.count("vsnprintf("),1)
        self.assertEqual(function.count("va_start("),1)
        self.assertEqual(function.count("va_end("),1)
        self.assertEqual(function.count("nh_text_forward(nh_owner);"),1)
        self.assertIn('nh_text_forward(nh_owner);\n    pline("%s", pbuf);',function)
        self.assertIn('if (strlen(pbuf) >= BUFSZ) nh_text_truncated(nh_owner);\n    pbuf[BUFSZ - 1]',function)
        self.assertLess(function.index("nh_text_truncated"),function.index('paniclog("impossible", pbuf);'))
        self.assertEqual(function.count('pline("%s", pbuf2);'),1)
        self.assertEqual(function.count('pline("Please report these messages to %s.", DEVTEAM_EMAIL);'),1)

    def test_call_composition_preserves_source_order_and_ignores_comments(self):
        source = '/* pline("same", probe()); */\npline("same", probe());\nnh_frozen("other");\npline("same", probe());\n'
        operations = [{"source":"src/test.c","api":"pline","original_argument_expressions":['"same"','probe()'],
                       "original_start_offset":ordinal,"replacement":f'wrapper_{ordinal}("same", probe())'} for ordinal in (1,2)]
        changed = p4.compose_calls_before_core(source,"src/test.c",operations)
        self.assertIn('/* pline("same", probe()); */',changed)
        self.assertLess(changed.index('wrapper_1('),changed.index('nh_frozen('))
        self.assertLess(changed.index('nh_frozen('),changed.index('wrapper_2('))
        self.assertEqual(changed.count("probe()"),source.count("probe()"))
        with self.assertRaisesRegex(ValueError,"expected 2, found 3"):
            p4.compose_calls_before_core(source+'pline("same", probe());',"src/test.c",operations)

    def test_precision_bound_name_never_constructs_scope_or_payload(self):
        entry={"id":"nethack.test.visible.prefix","arguments":[{"name":"arg_1","type":"text","source_format_specifier":"%.4s","c_length_modifier":""}]}
        site={"api":"pline","format_argument_index":0,"argument_expressions":['"%.4s"','name']}
        wrapper,_=p4.wrapper(entry,site,"prefix_fallback",set(),set())
        self.assertIn("nh_text_cancel_pending();",wrapper)
        self.assertIn("pline(nh_p0, nh_p1);",wrapper)
        self.assertNotIn("nh_text_begin",wrapper)
        self.assertNotIn("nh_text_name_event",wrapper)

    def test_dynamic_literal_format_preserves_predicate_and_rejects_unseen_slots(self):
        dynamic=p4.module(ROOT/"tools/semantic-text/phase4/prepare-dynamic-literals.py","phase4_dynamic_literal_test")
        original='rn2(100) ? "one" : "two"'
        changed=dynamic.select_literal_formats(original,["one_descriptor","two_descriptor"])
        self.assertEqual(changed.count("rn2(100)"),1)
        row={"source":"src/apply.c","function_candidate":"flip_coin","api":"pline","format_expression":'flag ? "%s" : "no name"',
             "argument_expressions":['flag ? "%s" : "no name"','private_name()'],"format_semantics":"printf-like"}
        with self.assertRaisesRegex(ValueError,"unconsumed"):
            dynamic.choices(row)
        row["format_expression"]='flag ? "%.4s" : "%s"'
        row["argument_expressions"][0]=row["format_expression"]
        with self.assertRaisesRegex(ValueError,"public-prefix"):
            dynamic.choices(row)
        row["format_expression"]='flag ? "%d" : "%ld"'
        row["argument_expressions"]=[row["format_expression"],'value']
        with self.assertRaisesRegex(ValueError,"promoted argument union"):
            dynamic.choices(row)


class GeneratedEvidenceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.audit = p4.load(p4.DEFAULT_OUTPUT/"audit.json")
        cls.catalog = p4.load(p4.DEFAULT_OUTPUT/"catalog.json")
        cls.reviewed = p4.load(p4.PHASE4/"reviewed-translations.json")
        cls.dynamic = p4.load(p4.PHASE4/"reviewed-dynamic-translations.json")

    def test_frozen_canonical_inputs_unchanged(self):
        for path, digest in self.audit["frozen_inputs"].items():
            self.assertEqual(p4.sha((ROOT/path).read_bytes()),digest,path)

    def test_denom_not_just_translated_subset(self):
        self.assertEqual(self.audit["denominator"]["core_distinct_literal_ids"],5984)
        self.assertEqual(self.audit["denominator"]["core_literal_call_sites"],6175)
        self.assertEqual(self.audit["denominator"]["core_dynamic_origin_sites"],963)
        static_ledger = [row for row in self.audit["ledger"] if row["status"] != "source-only-dynamic-producer-prepared"]
        self.assertEqual(len(static_ledger),6175)
        self.assertTrue(self.audit["source_only"])
        self.assertFalse(self.audit["compiled"])
        self.assertFalse(self.audit["runtime_integration"])

    def test_no_unreviewed_japanese_invented(self):
        permitted = {**self.reviewed["ja"],**self.dynamic["ja"]}
        frozen = p4.load(ROOT/"locales/gameplay-core.metadata.json")
        permitted.update({entry["id"]:entry["ja"] for entry in frozen["entries"]})
        for identifier, template in self.catalog["ja"].items():
            self.assertIn(identifier,permitted)
            self.assertEqual(template,permitted[identifier])
        self.assertNotIn("nethack.public_text.original",self.catalog["ja"])
        self.assertGreater(len(self.catalog["en"]),len(self.catalog["ja"])*20)

    def test_all_reviewed_static_and_dynamic_origin_bindings_prepared(self):
        self.assertEqual(self.audit["counts"]["reviewed_static_ids_with_prepared_wrappers"],38)
        self.assertEqual(self.audit["counts"]["new_dynamic_origin_sites_prepared"],4)
        self.assertEqual(self.audit["counts"]["new_dynamic_ids_prepared"],4)
        self.assertFalse(any(row["status"] == "unresolved-static-contract" for row in self.audit["ledger"]))
        for site in self.audit["sites"]:
            self.assertFalse(site["runtime_verified"])

    def test_all_native_getlin_sites_and_queued_fallback_documented(self):
        prompts = [site for site in self.audit["sites"] if site["api"] == "getlin"]
        self.assertEqual(len(prompts),11)
        windows = next(item for item in self.audit["files"] if item["source"] == "src/windows.c")
        self.assertTrue(windows["core_getlin_delivery_hook"])
        self.assertIn("queued-key pline echo remains exact English",self.audit["getlin_contract"])

    def test_size_t_transport_is_target_explicit(self):
        partial = next(site for site in self.audit["sites"] if site["source"] == "src/cfgfiles.c" and site["line"] == 206)
        self.assertEqual(partial["formal_c_types"], ["const char *","size_t","size_t"])
        self.assertIn("%zu",partial["original_argument_expressions"][0])
        self.assertIn("arg_1:%u",self.catalog["en"][partial["id"]])
        self.assertIn("arg_2:%u",self.catalog["en"][partial["id"]])
        header = (ROOT/"tools/semantic-text/phase4/nh-phase4-values.h").read_text(encoding="utf8")
        self.assertIn('_Static_assert(sizeof(size_t) == 4',header)

    def test_source_metadata_and_authoring_partition_are_disjoint(self):
        metadata = p4.load(p4.DEFAULT_OUTPUT/"metadata.json")
        partition = p4.load(p4.DEFAULT_OUTPUT/"untranslated-primary-ids.json")
        ids = [identifier for group in partition["ids"].values() for identifier in group]
        self.assertEqual(len(ids),len(set(ids)))
        untranslated = {entry["id"] for entry in metadata["entries"] if not entry["source_translation_approved"]}
        self.assertEqual(set(ids),untranslated)
        self.assertEqual(len(metadata["entries"]),self.audit["counts"]["candidate_ids_with_english_catalog"])
        for entry in metadata["entries"]:
            self.assertEqual(entry["en"],self.catalog["en"][entry["id"]])
            self.assertEqual(entry["required_argument_union"],self.catalog["argument_schemas"][entry["id"]])
            self.assertFalse(entry["runtime_integration"])
            for variant in entry["helper_variant_ids"]:
                self.assertEqual(self.catalog["argument_schemas"][variant],entry["required_argument_union"])

    def test_all_calls_compose_with_frozen_call_renames_before_core_hooks(self):
        operations = p4.load(p4.DEFAULT_OUTPUT/"call-operations.json")["operations"]
        dynamic_operations=p4.load(p4.DEFAULT_OUTPUT/"dynamic-literals/call-operations.json")["operations"]
        operations += dynamic_operations
        frozen_sites = p4.load(ROOT/"tools/semantic-text/generated/audit.json")["sites"]
        composed_sites = 0
        for name in sorted({operation["source"] for operation in operations}):
            original = (p4.UPSTREAM/name).read_text(encoding="utf8")
            offsets = [0]+[match.end() for match in p4.re.finditer("\n",original)]
            renames, claimed = [],set()
            for site in (site for site in frozen_sites if site["source"] == name):
                line = site["line"]
                start,end = offsets[line-1],offsets[line] if line < len(offsets) else len(original)
                found = []
                for match in p4.re.finditer(r"\b"+p4.re.escape(site["api"])+r"\s*\(",original[start:end]):
                    offset = start+match.start()
                    arguments,_ = p4.sem.call_arguments(original,original.find("(",offset))
                    if offset not in claimed and [p4.sem.tokens(arg) for arg in arguments] == [p4.sem.tokens(arg) for arg in site["original_argument_expressions"]]:
                        found.append(offset)
                self.assertTrue(found,site["id"])
                offset = found[0]
                claimed.add(offset)
                renames.append((offset,offset+len(site["api"]),site["wrapper"]))
            frozen = original
            for start,end,replacement in sorted(renames,reverse=True): frozen = frozen[:start]+replacement+frozen[end:]
            combined = p4.compose_calls_before_core(frozen,name,operations)
            expected = [operation for operation in operations if operation["source"] == name]
            for operation in expected:
                self.assertEqual(combined.count(operation["replacement"]),1,operation.get("id",str(operation["line"])))
            composed_sites += len(expected)
        self.assertEqual(composed_sites,len(self.audit["sites"])+len(dynamic_operations))


if __name__ == "__main__":
    suite = unittest.defaultTestLoader.loadTestsFromModule(sys.modules[__name__])
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    paths = [ROOT/"tools/instrument-semantic-phase4.py",Path(__file__),
             ROOT/"tools/semantic-text/phase4/nh-phase4-values.c",ROOT/"tools/semantic-text/phase4/nh-phase4-values.h",
             ROOT/"tools/semantic-text/phase4/prepare-impossible.py"]
    paths += [path for path in p4.DEFAULT_OUTPUT.rglob("*") if path.is_file() and path.name != "source-checks.json"]
    paths += [path for path in (ROOT/"tools/semantic-text/phase4").iterdir() if path.is_file()]
    manifest = {"schema_version":1,"date":"2026-10-02","source_only":True,"compiled":False,"runtime_verified":False,
                "test_count":result.testsRun,"passed":result.wasSuccessful(),"failures":len(result.failures),"errors":len(result.errors),
                "files":[{"path":str(path.relative_to(ROOT)).replace("\\","/"),"bytes":path.stat().st_size,
                          "sha256":p4.sha(path.read_bytes())} for path in sorted(set(paths))]}
    (p4.DEFAULT_OUTPUT/"source-checks.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding="utf8",newline="\n")
    sys.exit(0 if result.wasSuccessful() else 1)
