"""Added 2026-10-02, NGPL: meaningful Phase6 source-contract regressions.

No compiler, C preprocessor, JavaScript/Node or browser execution is performed.
"""
import ast
import hashlib
import json
from pathlib import Path
import re
import unittest
import struct
import tempfile
from types import SimpleNamespace
import prepare as p
import build as b
import provenance


class ReplaceOnce:
    @staticmethod
    def replace_once(source,old,new,contract):
        if source.count(old)!=1:raise ValueError(contract)
        return source.replace(old,new,1)


class Phase6SourceContracts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.p4=p.module(p.ROOT/"tools/instrument-semantic-phase4.py","phase6_test_original_call_helpers")

    def test_builder_python_syntax(self):ast.parse(b.builder_source())
    def test_actual_macro_observer_uses_source_headers_and_all_qa_fields(self):
        source=(p.HERE/'target-macros.c').read_text('utf8')
        self.assertIn('#include "config.h"',source)
        self.assertIn('#include "dlb.h"',source)
        for name in ('UNIX','MSDOS','WIN32','_WIN32','CROSS_TO_WASM','DLBLIB'):
            self.assertIn('#ifdef '+name+'\n',source)
        script=(p.HERE/'target-data.cjs').read_text('utf8')
        self.assertLess(script.index('m._nh_build_target_macros()'),script.index("m.callMain(['-drhs123v'])"))
    def test_actual_embedded_table_proves_exact_archive(self):
        archive=b'original source data\n'
        memory=bytearray(128);memory[:7]=b'/nhdat\0';memory[16:16+len(archive)]=archive
        struct.pack_into('<III',memory,80,1024,len(archive),1040)
        def leb(value):
            result=bytearray()
            while True:
                byte=value&127;value>>=7
                result.append(byte|128 if value else byte)
                if not value:return bytes(result)
        payload=b'\x01\x00\x41\x80\x08\x0b'+leb(len(memory))+memory
        wasm=b'\0asm\x01\0\0\0'+b'\x0b'+leb(len(payload))+payload
        js='var __emscripten_fs_load_embedded_files=ptr=>{do{var name_addr=HEAPU32[ptr>>2];var len=HEAPU32[ptr>>2];var content=HEAPU32[ptr>>2];HEAP8.subarray(content,content+len)}while(HEAPU32[ptr>>2])};'
        evidence=provenance.embedded_archive(js,wasm,archive)
        self.assertEqual(evidence['datafile_entry']['actual_bytes'],len(archive))
        self.assertEqual(evidence['datafile_entry']['actual_sha256'],p.sha(archive))
        with self.assertRaises(ValueError):provenance.embedded_archive(js,wasm,b'wrong archive')
        with self.assertRaises(ValueError):provenance.embedded_archive(js.replace('var len=','var altered='),wasm,archive)
    def test_actual_compile_boundary_does_not_invent_flags(self):
        with tempfile.TemporaryDirectory(dir=p.WORK) as directory:
            work=Path(directory);source=work/'source';build=work/'build';build.mkdir()
            (source/'include').mkdir(parents=True);(source/'include/config.h').write_text('#define UNIX\n')
            (source/'src').mkdir();c=source/'src/example.c';c.write_text('original C tokens')
            (work/'objects').mkdir();obj=work/'objects/example.o'
            def fake_run(command,**kwargs):obj.write_bytes(b'observed compiler output');return ''
            module=SimpleNamespace(WORK=work,SOURCE=source,BUILD=build,run=fake_run,target_flags=lambda:['PLANNED_UNUSED'])
            observed=provenance.Boundaries(module);observed.begin()
            command=['python','emcc.py','ACTUAL_FLAG','-c',str(c),'-o',str(obj)]
            observed.run(command)
            record=observed.units['src/example.c']
            self.assertEqual(record['target_flags'],['ACTUAL_FLAG'])
            self.assertEqual(record['command_sha256'],provenance.command_hash(command))
            self.assertEqual(record['status'],'passed')
            self.assertEqual(record['object_sha256'],p.sha(obj.read_bytes()))
    def test_uncertified_object_reuse_is_forced_fresh(self):
        with tempfile.TemporaryDirectory(dir=p.WORK) as directory:
            work=Path(directory);source=work/'source';(source/'include').mkdir(parents=True)
            (source/'include/config.h').write_text('#define UNIX\n');(work/'objects').mkdir();obj=work/'objects/000-old.o';obj.write_bytes(b'uncertified')
            build=work/'build';build.mkdir()
            module=SimpleNamespace(WORK=work,SOURCE=source,BUILD=build,run=lambda command,**kwargs:'',target_flags=lambda:[])
            provenance.Boundaries(module).begin()
            self.assertFalse(obj.exists())
    def test_alloc_wrappers_follow_original_panic_declaration(self):
        original=(p.ROOT/'upstream/NetHack-5.0.0/src/alloc.c').read_text('utf8')
        anchor,audit=p.native_header_anchor(original,'src/alloc.c',{'panic'})
        self.assertIn('extern void panic',anchor)
        self.assertTrue(audit['custom'])
        changed=original.replace(anchor,anchor+'#include "nh-phase6-native/sites-alloc.h"\n',1)
        self.assertLess(changed.index('extern void panic'),changed.index('#include "nh-phase6-native/sites-alloc.h"'))
        self.assertEqual(changed.replace('#include "nh-phase6-native/sites-alloc.h"\n',''),original)
    def test_custom_undeclared_wrapper_owner_is_rejected(self):
        with self.assertRaises(ValueError):p.native_header_anchor('#define EXTERN_H\n#include "config.h"\n','src/other.c',{'panic'})
        with self.assertRaises(ValueError):p.native_header_anchor('#define EXTERN_H\n#include "hack.h"\n','src/other.c',{'panic'})
    def test_all_native_sources_have_declared_original_api_owners(self):
        ops=p.load(p.TOOLS/'phase6-native-api/generated/call-operations.json')['operations']
        for name in sorted({row['source'] for row in ops}):
            original=(p.ROOT/'upstream/NetHack-5.0.0'/name).read_text('utf8')
            apis={row['api'] for row in ops if row['source']==name}
            p.native_header_anchor(original,name,apis)
    def test_date_replay_does_not_admit_arbitrary_c_changes(self):
        source=Path(p.__file__).read_text('utf8')
        self.assertIn("if name=='include/date.h' and certificate.is_file():",source)
        self.assertIn("row['sha256']==actual",source)
        self.assertIn('raise ValueError("unrecognized Phase6 source edit: "+name)',source)
    def test_builder_roots_are_isolated(self):
        source=b.builder_source()
        self.assertNotIn('WORK = ROOT / "work" / "phase4"',source)
        self.assertNotIn('BUILD = ROOT / "build" / "phase4"',source)
        self.assertIn('"nh-phase6-helper.c", SOURCE / "src" / "nh-native-api.c"',source)
    def test_default_builder_untouched(self):
        self.assertIn('WORK = ROOT / "work" / "phase4"',(p.ROOT/"tools/build-upstream.py").read_text("utf8"))
    def test_optional_gates_leave_base_defaults(self):
        source=Path(b.__file__).read_text('utf8')
        self.assertIn('module.REGISTERED_CATALOG=False',source)
        self.assertIn('module.ENABLE_PHASE7=False',source)
        self.assertIn('if ENABLE_PHASE7: paths.append',b.builder_source())
    def test_performance_exports_require_selected_library(self):
        self.assertIn('if REGISTERED_CATALOG and rust_lib:',b.builder_source())
        self.assertIn('--registered-catalog requires an explicitly selected isolated Rust library',Path(b.__file__).read_text('utf8'))
    def test_frontend_source_does_not_overwrite_current(self):
        self.assertIn('shutil.copytree(WEB_SOURCE, local_web, dirs_exist_ok=True)',b.builder_source())
        self.assertIn('local_web = BUILD / "web" if PHASE4_MODE else ROOT / "web"',b.builder_source())
    def test_actual_compiled_source_lineage_is_recorded(self):
        source=Path(b.__file__).read_text('utf8')
        self.assertIn("manifest['compiled_input_hashes']",source)
        self.assertIn("manifest['compiled_header_hashes']",source)
        self.assertIn("'package_source_root':'engine-source'",source)
    def test_builder_rejects_stale_anchors(self):
        with self.assertRaises(ValueError):b.once('a','b','c')
    def test_only_explicit_build_invokes_main(self):
        source=Path(b.__file__).read_text("utf8")
        self.assertLess(source.index('if args.prepare:'),source.index('builder.main()'))
        self.assertIn('choose exactly one of --prepare or --build',source)
    def test_serial_compiler_limits(self):
        self.assertIn('"--jobs","1"',Path(b.__file__).read_text("utf8"))
        for name in ('EMCC_CORES','BINARYEN_CORES','EMCC_BATCH_BUILD','CARGO_PROFILE_RELEASE_CODEGEN_UNITS'):
            self.assertIn(name,b.builder_source())
    def test_setup_uses_separate_scratch_source(self):
        source=Path(b.__file__).read_text("utf8")
        self.assertIn('module.SOURCE=module.WORK/"sdk-setup/NetHack-5.0.0"',source)
        self.assertIn('finally:module.SOURCE=preserved',source)
    def test_target_data_recomputes_all_offset_assets(self):
        source=Path(b.__file__).read_text("utf8")
        self.assertIn('"data","rumors","oracles","epitaph","engrave","bogusmon","options"',source)
        self.assertNotIn('.replace(b"\\r',source)
        self.assertIn('write_bytes(data)',source)
    def test_target_utility_original_multioption_contract(self):
        source=(p.ROOT/"upstream/NetHack-5.0.0/util/makedefs.c").read_text("utf8")
        self.assertIn('do_makedefs(&argv[1][1]);',source)
        for option in 'drhs123v':self.assertIn("case '"+option+"':",source)
    def test_target_script_binary_roundtrip(self):
        source=(p.HERE/"target-data.cjs").read_text("utf8")
        self.assertIn("m.callMain(['-drhs123v'])",source)
        self.assertIn("Buffer.from(m.FS.readFile('/'+name)).toString('base64')",source)
        self.assertNotIn("encoding: 'utf8'",source)
    def test_direct_helper_ownership(self):
        self.assertEqual(p.owned_expression('hcolor((char *) 0)',self.p4),'nh_phase6_hcolor_value((char *) 0)')
        self.assertEqual(p.owned_expression('mhe(mon)',self.p4),'nh_phase6_mhe_value(mon)')
    def test_original_local_P_NAME_maps_exact_frozen_macro(self):
        self.assertEqual(p.owned_expression('P_NAME(skill++)',self.p4),'nh_phase6_p_name_value(skill++)')
        source=(p.SOURCE/'src/weapon.c').read_text('utf8')
        a,b,original=p.helper_macro(source,'P_NAME')
        upstream=(p.ROOT/'upstream/NetHack-5.0.0/src/weapon.c').read_text('utf8')
        self.assertEqual(original,p.helper_macro(upstream,'P_NAME')[2])
        c,d,typed=p.helper_macro(source,p.HELPERS['P_NAME'])
        self.assertLess(b,c)
        for expression in ('skill_names_indices[type]','type == P_BARE_HANDED_COMBAT','martial_bonus()'):
            self.assertEqual(original.count(expression),typed.count(expression))
        self.assertNotIn('nh_phase6_P_NAME_value(',source)
    def test_every_owning_helper_consumer_has_visible_exact_declaration(self):
        declarations=p.helper_declarations()
        audit=p.load(p.OUTPUT/'helper-consumer-audit.json')
        self.assertTrue(audit['all_owned_consumers_visibility_checked'])
        self.assertEqual(audit['owned_consumer_sites'],333)
        for row in audit['sites']:
            source=(p.SOURCE/row['source']).read_text('utf8')
            position=source.index(row['wrapper']+'(')
            actual_arguments,_=self.p4.sem.call_arguments(source,position+len(row['wrapper']))
            for index in row['owned_slots']:
                original=self.p4.inventory.c_tokens(row['original_arguments'][index].strip())[0].text
                proof=p.helper_visibility(original,source,row['source'],position,declarations)
                expected=p.owned_expression(row['original_arguments'][index],self.p4)
                self.assertEqual([t.text for t in self.p4.inventory.c_tokens(actual_arguments[index])],
                                 [t.text for t in self.p4.inventory.c_tokens(expected)])
    def test_local_macro_and_missing_typed_declaration_reject(self):
        declarations=p.helper_declarations()
        with self.assertRaises(ValueError):p.helper_visibility('P_NAME','#include "hack.h"\ncall();','src/other.c',30,declarations)
        source=(p.SOURCE/'src/weapon.c').read_text('utf8')
        with self.assertRaises(ValueError):p.helper_visibility('P_NAME',source,'src/weapon.c',0,declarations)
        with self.assertRaises(ValueError):p.helper_macro(source,'nh_phase6_P_NAME_value')
    def test_transformed_or_conditional_helpers_rejected(self):
        for expression in ('the(hcolor(0))','body_part(0) + 1','flag ? hcolor(0) : "red"','"hcolor(0)"','buffer'):
            self.assertIsNone(p.owned_expression(expression,self.p4))
    def test_owning_formal_preserves_original_argument_once(self):
        before='''static inline void nh_text_site_a(const char * nh_p0) {
    struct nh_text_argument nh_args[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p0, 0, NULL, 1},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_desc, nh_args, 1);
    pline("%s", nh_text_captured(nh_scope, 0, nh_p0));
    nh_text_end(nh_scope);
}'''
        after=p.adapt_wrapper(before,{0})
        self.assertIn('struct nh_phase6_helper_value nh_p0',after)
        self.assertIn('nh_p0.event_valid ? nh_p0.event_json : NULL, 0}',after)
        self.assertEqual(after.count('pline("%s",'),1)
        self.assertIn('nh_text_captured(nh_scope, 0, nh_p0.original)',after)
        self.assertIn('if (!nh_p0.event_valid) nh_text_truncated(nh_scope)',after)
    def test_precision_wrappers_cannot_be_promoted(self):
        with self.assertRaises(ValueError):p.adapt_wrapper('static inline void nh_text_site_a(const char * nh_p0) { pline("%.2s", nh_p0); }',{0})
    def test_exit_claim_cannot_match_raw_print(self):
        generic='    if (kind == NH_TEXT_RAW && raw && window == -1) return s->json;'
        exact='    if (kind == NH_TEXT_RAW && !strcmp(s->descriptor->api,"exit_nhwindows") &&\n        !strcmp(callback,"shim_exit_nhwindows") && window == -1) return s->json;'
        after=p.native_exit_gate(generic+'\n'+exact,type('P4',(),{'sem':ReplaceOnce})())
        self.assertLess(after.index('"exit_nhwindows"'),after.index('&& raw'))
        self.assertIn('? s->json : NULL;',after)
    def question_gate_predicate(self):
        original='    if (kind == NH_TEXT_QUESTION && ((!strcmp(callback,"shim_yn_function") && window == -1) || !strcmp(callback,"shim_end_menu"))) return s->json;'
        after=p.native_question_gate(original,type('P4',(),{'sem':ReplaceOnce})())
        self.assertNotIn('shim_end_menu',after)
        self.assertIn(after,(p.SOURCE/'src/nh-semantic.c').read_text('utf8'))
        condition=re.fullmatch(r'    if \((.+)\) return s->json;',after).group(1)
        condition=condition.replace('kind == NH_TEXT_QUESTION','True')
        condition=re.sub(r'!strcmp\(callback,"([a-z_]+)"\)',lambda m:'callback == '+repr(m.group(1)),condition)
        condition=condition.replace('&&','and').replace('||','or')
        return lambda callback,window:eval(condition,{'__builtins__':{}},{'callback':callback,'window':window})
    def test_question_wrong_window_and_alternate_menu_are_rejected(self):
        accepted=self.question_gate_predicate()
        self.assertTrue(accepted('shim_yn_function',-1))
        for window in (-1,0,1,30,100):self.assertFalse(accepted('shim_end_menu',window))
        for window in (0,1,30,100):self.assertFalse(accepted('shim_yn_function',window))
    def test_question_generic_negative_alias_is_rejected(self):
        accepted=self.question_gate_predicate()
        for window in (-2,-17,-2147483648):
            self.assertFalse(accepted('shim_yn_function',window))
            self.assertFalse(accepted('shim_end_menu',window))
        original=(p.FOUNDATION/'src/nh-semantic.c').read_text('utf8')
        self.assertIn('|| !strcmp(callback,"shim_end_menu")',original)
    def test_preprocessor_line_layout_preserved(self):
        before='pline("%s",\n#ifdef ALTMETA\nfoo,\n#endif\nbar)'
        args,_=self.p4.sem.call_arguments(before,before.index('('))
        after=self.p4.rewrite_native_call(before,'pline','new_owner',args,args)
        self.assertEqual(self.p4.call_directives(before),self.p4.call_directives(after))
    def test_optional_original_span_remap_is_exact(self):
        original='one();\nSprintf(buf, "%d", x);\ntwo();'
        start=original.index('Sprintf');row={'source':'src/example.c','start':start,'end':start+7,'original':'Sprintf'}
        a,b=p.remap_preserved_operation(original,'/* dated notice */\n'+original,row)
        self.assertEqual(('/* dated notice */\n'+original)[a:b],'Sprintf')
    def test_optional_original_span_remap_rejects_ambiguity(self):
        original='one();\nSprintf(buf, "%d", x);\ntwo();'
        start=original.index('Sprintf');row={'source':'src/example.c','start':start,'end':start+7,'original':'Sprintf'}
        with self.assertRaises(ValueError):p.remap_preserved_operation(original,original+original,row)
    def test_optional_original_span_remap_rejects_stale_pristine(self):
        with self.assertRaises(ValueError):p.remap_preserved_operation('abc','abc',{'source':'x','start':0,'end':2,'original':'zz'})
    def test_native_recipe_review_preserves_types_and_unions(self):
        original=p.load(p.HERE/'native-recipes.json');reviewed=p.load(p.ROOT/'locales/phase6/native-recipes.root-reviewed.json')
        self.assertEqual(original['en'],reviewed['en'])
        self.assertEqual(original['argument_schemas'],reviewed['argument_schemas'])
        self.assertEqual(set(reviewed['ja']),set(original['en']))
        self.assertIn('{turn:%5ld}',reviewed['ja']['nethack.native.chronicle.line'])
    def test_foundation_hashes_are_unchanged(self):p.verify_foundation()
    def test_input_lock_hashes_are_current(self):p.verify_inputs()
    def test_appearance_all_slots_public_only(self):
        audit=p.load(p.OUTPUT/"public-appearance-audit.json")
        aliases=[]
        for row in audit['source_mapping']:
            alias=row['public_alias'];self.assertIsNotNone(alias)
            self.assertTrue(alias.startswith('nethack.public.appearance.'))
            self.assertTrue(alias.endswith(p.sha(row['public_phrase'])[:10]))
            aliases += [alias]*len(row['private_source_ids'])
        self.assertEqual(len(aliases),326)
        labels=(p.SOURCE/"include/nh-semantic-object-labels.h").read_text('utf8')
        appearances=re.findall(r'\[NH_NAME_OBJECT_APPEARANCE\] = "([^"]+)"',labels)
        self.assertEqual(sorted(appearances),sorted(aliases))
        self.assertFalse(any('.entity.object.' in identifier for identifier in appearances))
    def test_unknown_glass_orb_does_not_expose_crystal_ball(self):
        audit=p.load(p.OUTPUT/"public-appearance-audit.json")
        row=next(row for row in audit['source_mapping'] if row['public_phrase']=='glass orb')
        self.assertEqual(row['public_alias'],'nethack.public.appearance.glass_orb.97eda687ce')
        self.assertNotIn('crystal',row['public_alias'])
    def test_duplicate_public_phrases_have_one_alias(self):
        audit=p.load(p.OUTPUT/"public-appearance-audit.json")
        phrases=[row['public_phrase'] for row in audit['source_mapping']]
        self.assertEqual(len(phrases),len(set(phrases)))
    def test_conflicting_appearance_ja_does_not_choose_true_type(self):
        catalog=p.load(p.OUTPUT/"catalog.json")
        for row in p.load(p.OUTPUT/"public-appearance-audit.json")['source_mapping']:
            if not row['japanese_eligible']:self.assertNotIn(row['public_alias'],catalog['ja'])
    def test_catalog_bounds_and_no_false_runtime_claim(self):
        catalog=p.load(p.OUTPUT/"catalog.json");manifest=p.load(p.OUTPUT/"source-manifest.json")
        self.assertLess((p.OUTPUT/"catalog.json").stat().st_size,16*1024*1024)
        self.assertLessEqual(max(map(len,catalog['en'])),160)
        self.assertLessEqual(max(map(len,catalog['argument_schemas'].values())),64)
        self.assertFalse(manifest['compiled']);self.assertFalse(manifest['runtime_verified'])
        self.assertIn('Phase7 mutable/composed buffer flows',manifest['unresolved'])
    def test_historical_native_duplicate_ja_is_retained(self):
        before=p.load(p.FOUNDATION_META/'catalog.json');after=p.load(p.OUTPUT/'catalog.json')
        native=p.load(p.TOOLS/'phase6-native-api/generated/catalog.json')
        for identifier in set(native['en'])&set(before['en']):
            self.assertEqual(after['en'][identifier],before['en'][identifier])
            if identifier in before['ja']:self.assertEqual(after['ja'][identifier],before['ja'][identifier])


if __name__=='__main__':unittest.main(verbosity=2)
