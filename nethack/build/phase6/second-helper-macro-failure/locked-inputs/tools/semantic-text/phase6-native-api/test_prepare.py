"""Added 2026-10-02, NGPL: source-contract checks; no C compilation/runtime."""
from __future__ import annotations
import importlib.util
import json
from pathlib import Path
import re
import sys
import unittest
sys.dont_write_bytecode=True
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location("native_proposal",HERE/"prepare.py")
m=importlib.util.module_from_spec(spec);sys.modules[spec.name]=m;spec.loader.exec_module(m)


class NativeSourceContracts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.audit=m.generate(HERE/"generated")
        cls.ops=json.loads((HERE/"generated/call-operations.json").read_text("utf8"))["operations"]
        cls.metadata=json.loads((HERE/"generated/metadata.json").read_text("utf8"))["entries"]
        cls.bridge=(HERE/"generated/src/nh-semantic.c").read_text("utf8")
        cls.helpers=(HERE/"nh-native-api.c.in").read_text("utf8")

    def original(self,name):
        return (m.p4.UPSTREAM/name).read_text("utf8")

    def test_every_literal_call_retains_exact_original_argument_tokens(self):
        self.assertEqual(len(self.ops),434)
        for op in self.ops:
            source=self.original(op["source"])
            self.assertEqual(source[op["original_start_offset"]:op["original_end_offset"]],op["original_call"])
            args,_=m.p4.sem.call_arguments(source,source.find("(",op["original_start_offset"]))
            self.assertEqual([m.p4.sem.tokens(a) for a in args],
                             [m.p4.sem.tokens(a) for a in op["original_argument_expressions"]])
            callee=op["replacement"].split("(",1)[0].strip()
            self.assertEqual(op["replacement"],m.p4.rewrite_native_call(op["original_call"],op["api"],callee,args,args))
            self.assertEqual(m.p4.call_directives(op["original_call"]),m.p4.call_directives(op["replacement"]))

    def test_six_definition_hooks_are_exactly_reversible(self):
        for name,transform in [("src/end.c",m.transform_panic),("src/windows.c",m.transform_dump),
                               ("src/cfgfiles.c",m.transform_config),("src/pline.c",m.transform_log),
                               ("src/insight.c",m.transform_chronicle),("src/save.c",m.transform_log_free)]:
            # edit() restores all original bytes internally and rejects ambiguity.
            self.assertNotEqual(transform(self.original(name)),self.original(name))

    def test_panic_only_final_original_raw_line_is_bracketed(self):
        source=m.transform_panic(self.original("src/end.c"))
        body=source[source.index("panic VA_DECL"):source.index("/*",source.index("really_done(PANICKED);"))]
        self.assertIn('nh_text_native_claim(NH_TEXT_RAW, "panic", "panic1")',body)
        self.assertLess(body.index("nh_text_emit(NULL)"),body.index("program_state.panicking++"))
        self.assertEqual(body.count("nh_text_emit(nh_native_owner)"),1)
        self.assertLess(body.index("vsnprintf(buf"),body.index("nh_text_emit(nh_native_owner)"))
        self.assertIn("strlen(buf) >= sizeof buf - 1",body)
        self.assertIn("paniclog(\"panic\", buf)",body)

    def test_exact_api_claim_never_consumes_unrelated_outer_pending(self):
        extension=(HERE/"bridge-extension.c.in").read_text("utf8")
        claim=extension[extension.index("nh_text_native_claim"):extension.index("char *nh_text_native_event_copy")]
        self.assertLess(claim.index("scope->descriptor->api"),claim.index("return nh_text_claim(kind)"))
        self.assertIn("return NULL",claim)
        self.assertNotIn("nh_text_cancel_pending",claim)

    def test_dump_file_only_original_branch_has_no_emission(self):
        source=m.transform_dump(self.original("src/windows.c"))
        start=source.index("dump_forward_putstr(winid")
        body=source[start:source.index("\n}",start)]
        self.assertLess(body.index("fprintf"),body.index("if (!no_forward)"))
        self.assertLess(body.index("if (!no_forward)"),body.index("nh_text_emit(nh_native_owner)"))
        self.assertEqual(body.count("putstr(win, attr, str)"),1)

    def test_config_formatting_and_branch_predicates_are_once(self):
        original=self.original("src/cfgfiles.c");changed=m.transform_config(original)
        for text in ['vlen = vsnprintf(buf, sizeof buf, str, the_args);',
                     'strchr(".!?", *punct)', '!iflags.window_inited ?',
                     'config_error_data->secure ? "Error:" : " *"']:
            if 'secure ?' in text:
                self.assertEqual(original.count(text),1)
                self.assertEqual(changed.count('config_error_data->secure ? nh_native_value'),1)
            else:self.assertEqual(original.count(text),changed.count(text))
        self.assertEqual(changed.count('(nh_native_line_number = config_error_data->line_num)'),1)
        self.assertIn("strlen(buf) >= BUFSZ",changed)

    def test_config_lua_queue_has_no_semantic_publication(self):
        changed=m.transform_config(self.original("src/cfgfiles.c"))
        begin=changed.index("if (iflags.in_lua)")
        end=changed.index("config_error_data->num_errors++",begin)
        queue=changed[begin:end]
        self.assertNotIn("nh_text_emit",queue)
        self.assertNotIn("nh_abi_semantic_event",queue)
        self.assertNotIn("nh_native_config_",queue)

    def test_config_empty_fallback_cannot_inherit_caller_id(self):
        changed=m.transform_config(self.original("src/cfgfiles.c"))
        self.assertIn('buf = "Unknown error";\n        nh_native_owner = NULL;',changed)

    def test_config_recipes_replay_original_qualifiers(self):
        catalog=json.loads((HERE/"generated/catalog.json").read_text("utf8"))["en"]
        self.assertEqual(catalog["nethack.native.config.plain"],"{label}{message}{punct}")
        self.assertEqual(catalog["nethack.native.config.framed"],"{label} {line}{message}{punct}")
        self.assertEqual(catalog["nethack.native.config.line"],"Line {number:%d}: ")
        self.assertIn('label.original,line,message,punct.original',self.helpers)

    def test_journal_filters_remain_before_actual_delivery(self):
        changed=m.transform_chronicle(self.original("src/insight.c"))
        start=changed.index("show_gamelog(int final)")
        body=changed[start:]
        self.assertLess(body.index("!majorevent(llmsg)"),body.index("nh_native_log_line("))
        self.assertLess(body.index("spoilerevent(llmsg)"),body.index("nh_native_log_line("))
        self.assertEqual(body.count('(nh_native_turn = llmsg->turn)'),1)

    def test_log_ticket_requires_original_call_owned_pointer(self):
        self.assertIn("text!=nh_native_log_pending.expected_text",self.helpers)
        original=self.original("src/pline.c");changed=m.transform_log(original)
        self.assertEqual(original.count("gamelog_add(ll_type, svm.moves, gamelogbuf)"),
                         changed.count("gamelog_add(ll_type, svm.moves, gamelogbuf)"))
        self.assertEqual(original.count("vsnprintf(gamelogbuf"),changed.count("vsnprintf(gamelogbuf"))
        self.assertLess(changed.index("nh_native_log_capture(nh_native_owner, gamelogbuf)"),
                        changed.index("gamelog_add(ll_type, svm.moves, gamelogbuf)"))
        self.assertIn("nh_native_log_restore(nh_previous)",changed)

    def test_every_original_journal_free_invalidates_first(self):
        changed=m.transform_log_free(self.original("src/save.c"))
        self.assertEqual(changed.count("nh_native_log_forget(tmp)"),1)
        self.assertIn("nh_native_log_forget(tmp);\n            free((genericptr_t) tmp->text);\n            free((genericptr_t) tmp);",changed)
        self.assertIn("nh_native_log_forget(key);",self.helpers)

    def test_oom_bounds_generation_integrity_fail_closed(self):
        for text in ["4096U", "8U*1024U*1024U", "nh_native_log_epoch==UINT64_MAX",
                     "strcmp(record->text,text)", "if (!record)", "if (!event)",
                     "strlen(original_line)>=BUFSZ-1"]:
            self.assertIn(text,self.helpers)
        self.assertNotIn("livelog_add(",self.helpers)

    def test_exit_getter_is_exact_original_callback_only(self):
        self.assertIn('!strcmp(s->descriptor->api,"exit_nhwindows")',self.bridge)
        self.assertIn('!strcmp(callback,"shim_exit_nhwindows") && window == -1',self.bridge)

    def test_all_text_name_permissions_zero(self):
        for header in (HERE/"generated/include/nh-phase6-native").glob("*.h"):
            source=header.read_text("utf8")
            self.assertNotIn("nh_text_name_event(",source)
            for initializer in re.findall(r'\{"arg_\d+", NH_TEXT_TEXT,[^\n]+',source):
                self.assertTrue(initializer.endswith(", 0},"),initializer)

    def test_precision_never_serializes_the_original_unshown_text(self):
        rejected=[e for e in self.metadata if not e["semantic_capture_prepared"]]
        self.assertEqual(len(rejected),7)
        headers="\n".join(p.read_text("utf8") for p in (HERE/"generated/include/nh-phase6-native").glob("*.h"))
        for entry in rejected:self.assertNotIn(json.dumps(entry["id"])+", ",headers)
        self.assertEqual(headers.count("Native-English fallback: precision-bound text"),7)

    def test_unconsumed_arguments_are_rejected(self):
        row={"api":"panic","format_argument_index":0,"argument_expressions":['"public"',"secret_name()"]}
        with self.assertRaisesRegex(ValueError,"arity"):
            m.p4.wrapper({"id":"nethack.test.public","arguments":[]},row,"test",set(),set())

    def test_no_runtime_or_translation_coverage_claim(self):
        self.assertFalse(self.audit["compiled"]);self.assertFalse(self.audit["runtime_verified"])
        self.assertEqual(self.audit["dynamic_or_null_origins"] if "dynamic_or_null_origins" in self.audit else
                         self.audit["counts"]["dynamic_or_null_origins"],37)
        self.assertEqual(json.loads((HERE/"generated/catalog.json").read_text("utf8"))["ja"],{})

    def test_ambiguous_anchor_is_rejected(self):
        with self.assertRaisesRegex(ValueError,"expected 1 exact"):
            m.transform_dump(self.original("src/windows.c")*2)


if __name__=="__main__":unittest.main()
