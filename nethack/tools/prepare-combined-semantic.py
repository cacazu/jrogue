"""Added 2026-10-02, NGPL: isolated phase4/5 source preparation only.

The caller chooses a separate working source. This module never compiles,
runs the game/browser, publishes, or changes the frozen canonical catalog.
"""
from __future__ import annotations
import json
import re
from pathlib import Path
import shutil
import sys
sys.dont_write_bytecode = True
ROOT=Path(__file__).resolve().parents[1]


def restore_verified_owned_sources(upstream,source,manifest,sha):
    """Reset only prior prepared C files whose exact ownership hash is known.

    All checks precede any write. Compiler artifacts/logs and unknown edits
    are retained. rnd.c is freshly rebuilt by setup and handled separately.
    """
    upstream,source=Path(upstream).resolve(),Path(source).resolve()
    if not source.is_relative_to(ROOT/"work/phase4") or source==upstream:
        raise ValueError("Replay reset must stay within isolated Phase4 source")
    checked=[]
    for record in manifest.get("prepared_sources",[]):
        relative=Path(record["source"])
        destination=(source/relative).resolve()
        original_path=(upstream/relative).resolve()
        if not destination.is_relative_to(source) or not original_path.is_relative_to(upstream):
            raise ValueError("Prepared source ownership path escapes its root")
        if str(relative).replace("\\","/")=="src/rnd.c":continue
        original=original_path.read_text(encoding="utf8")
        content=destination.read_text(encoding="utf8")
        if sha(content) not in (sha(original),record["patched_sha256"]):
            raise ValueError("Unrecognized Phase4 source edit: "+record["source"])
        checked.append((destination,original))
    for destination,original in checked:
        destination.write_text(original,encoding="utf8",newline="\n")
    return len(checked)


def prepare(upstream,output,source,authored_paths=None):
    import importlib.util
    def module(path,name):
        spec=importlib.util.spec_from_file_location(name,path)
        result=importlib.util.module_from_spec(spec);sys.modules[name]=result;spec.loader.exec_module(result)
        return result
    p4=module(ROOT/"tools/instrument-semantic-phase4.py","joint_phase4_helpers")
    frozen=module(ROOT/"tools/instrument-semantic-text.py","joint_frozen_generator")
    dynamic=module(ROOT/"tools/semantic-text/phase4/prepare-dynamic-literals.py","joint_dynamic_literals")
    diagnostic=module(ROOT/"tools/semantic-text/phase4/prepare-impossible.py","joint_diagnostic")
    grammar=module(ROOT/"tools/semantic-text/phase5-grammar/prepare.py","joint_name_grammar")
    loader=module(ROOT/"tools/semantic-text/phase4/catalog-loader.py","joint_catalog_loader")
    eligibility=module(ROOT/"tools/semantic-text/phase4/prepare-name-eligibility.py","joint_name_eligibility")
    upstream,output,source=Path(upstream).resolve(),Path(output).resolve(),Path(source).resolve()
    if not source.is_relative_to(ROOT/"work/phase4") or source==upstream:
        raise ValueError("Combined source must be isolated under nethack/work/phase4")
    output.mkdir(parents=True,exist_ok=True)
    frozen_snapshots={str(path.relative_to(ROOT)):p4.sha(path.read_bytes()) for path in
        (ROOT/"locales/gameplay-core.json",ROOT/"locales/gameplay-core.metadata.json",ROOT/"tools/semantic-text/generated/semantic.patch")}
    previous_manifest=output/"source-manifest.json"
    if previous_manifest.exists():
        restore_verified_owned_sources(upstream,source,p4.load(previous_manifest),p4.sha)
    # Setup's read-only RNG test adapter is outside pristine upstream. New
    # diagnostic sites include rnd.c, so preserve that exact reviewed suffix
    # when regenerating the gameplay source from its original C tokens.
    original_rnd=(upstream/"src/rnd.c").read_text(encoding="utf8")
    adapter_rnd=(source/"src/rnd.c").read_text(encoding="utf8")
    if adapter_rnd.count(original_rnd)!=1: raise ValueError("Expected fresh isolated RNG adapter setup")
    rng_suffix=adapter_rnd.partition(original_rnd)[2]
    if "EMSCRIPTEN_KEEPALIVE unsigned nh_abi_rng_checksum(void)" not in rng_suffix:
        raise ValueError("Expected existing read-only RNG checksum adapter")
    # The frozen apply guard accepts pristine or its own generated content.
    # This isolated file was just validated against setup's known adapter;
    # restore its pristine body for that guard, then append the exact suffix.
    (source/"src/rnd.c").write_text(original_rnd,encoding="utf8",newline="\n")
    prepared=output/"phase4-inputs"
    p4.generate(prepared)
    dynamic.prepare(prepared/"dynamic-literals")
    diagnostic.prepare(prepared/"diagnostic-contract")
    diagnostic.prepare_wrappers(prepared/"diagnostic-wrappers")
    folders=[prepared,prepared/"dynamic-literals",prepared/"diagnostic-wrappers"]
    operations=[operation for folder in folders for operation in p4.load(folder/"call-operations.json")["operations"]]
    directive_calls=[]
    for operation in operations:
        original_directives=p4.call_directives(operation["original_call"])
        replacement_directives=p4.call_directives(operation["replacement"])
        if original_directives!=replacement_directives:
            raise ValueError("Preprocessor directive boundary changed at "+operation["source"]+":"+str(operation["line"]))
        if original_directives:
            directive_calls.append({"source":operation["source"],"line":operation["line"],
                                    "api":operation["api"],"id":operation.get("id"),
                                    "original_sha256":p4.sha(operation["original_call"]),
                                    "replacement_sha256":p4.sha(operation["replacement"]),
                                    "physical_directives":original_directives})
    (output/"preprocessor-boundary-audit.json").write_text(json.dumps({"schema_version":1,"source_only":True,
        "checked_call_operations":len(operations),"spanning_calls":directive_calls,
        "contract":"every original physical preprocessing line and its relative line remains exact; original argument whitespace is retained; token equivalence alone is insufficient",
        "runtime_verified":False},ensure_ascii=False,indent=2),encoding="utf8",newline="\n")
    extra_sources=sorted({operation["source"] for operation in operations})
    def pre_core(text,name):
        hooks=[]
        if name=="src/hacklib.c":
            text=p4.sem.replace_once(text,'#include "hack.h" /* for config.h+extern.h */\n',
                                     '#include "hack.h"\n/* for config.h+extern.h */\n',"joint original utility header comment")
            hooks.append("original hack.h comment retained on separate line for common header insertion")
        if name=="src/pline.c":
            text=diagnostic.transform(text);hooks.append("phase4 first-impossible owner/truncation, original first emission only")
        if name=="src/windows.c":
            text=p4.getlin_delivery(text);hooks.append("phase4 original getlin callback only, queued echo stays English")
        includes=[]
        for folder,namespace in zip(folders,("nh-phase4","nh-phase4-dynamic","nh-phase4-impossible"),strict=True):
            header=f"{namespace}/sites-{Path(name).stem}.h"
            if (folder/"include"/header).exists(): includes.append(f'#include "{header}"\n')
        if includes:
            text=p4.sem.replace_once(text,'#include "hack.h"\n','#include "hack.h"\n'+"".join(includes),"joint phase4 headers")
        hooks.append("phase4 exact call headers prepared; call composition follows original core/name hooks")
        return text,hooks
    def post_source(text,name):
        hooks=[]
        if name=="src/questpgr.c":
            anchor='            struct nh_text_scope *nh_owner = nh_quest_line(NH_TEXT_MESSAGE, WIN_MESSAGE, out_line);\n'
            text=p4.sem.replace_once(text,anchor,anchor+'            nh_text_forward(nh_owner);\n',"joint explicit quest owner precedes literal wrapper")
            hooks.append("explicit quest owner forwarded before nested literal message wrapper")
        # Stock core/quest/name hooks match original API leaves. Compose only
        # after those hooks, with exact remaining call/argument-token proof.
        text=p4.compose_calls_before_core(text,name,operations)
        if name!="src/objnam.c": return text,hooks
        changed,changes=grammar.transform_articles(text)
        grammar.verify_native_tokens(text,changed,changes)
        changed=p4.sem.replace_once(changed,'#include "hack.h"\n','#include "hack.h"\n#include "nh-semantic-name-grammar.h"\n',"joint grammar header")
        return changed,hooks+["phase5 original an/An/the/The propagation; native tokens/call counts preserved"]
    audit=frozen.generate(ROOT/"locales/gameplay-core.metadata.json",upstream,output,source,
                          additional_source_files=extra_sources,pre_core_transform=pre_core,post_source_transform=post_source)
    (source/"src/rnd.c").write_text((source/"src/rnd.c").read_text(encoding="utf8")+rng_suffix,encoding="utf8",newline="\n")
    for folder in folders:
        for base in ("include","src"):
            if not (folder/base).exists(): continue
            for path in (folder/base).rglob("*"):
                if not path.is_file(): continue
                relative=path.relative_to(folder)
                for target in (output/relative,source/relative):
                    target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(path,target)
    name_audit=eligibility.overlay_headers(output,operations,audit["sites"],p4.sem,p4.inventory)
    for path in (output/"include").rglob("sites-*.h"):
        shutil.copy2(path,source/path.relative_to(output))
    bridge=eligibility.bridge_source(p4.getlin_getter((output/"src/nh-semantic.c").read_text(encoding="utf8")),p4.sem)
    names=grammar.extend_registry((ROOT/"tools/semantic-text/nh-semantic-name.c").read_text(encoding="utf8"))
    additions={"src/nh-semantic.c":bridge,"src/nh-semantic-name.c":names,
               "include/nh-semantic-name-grammar.h":(ROOT/"tools/semantic-text/phase5-grammar/bridge-extension.h.in").read_text(encoding="utf8"),
               "include/nh-semantic.h":eligibility.bridge_header((output/"include/nh-semantic.h").read_text(encoding="utf8"),p4.sem)}
    for relative,text in additions.items():
        for target in (output/relative,source/relative):
            target.parent.mkdir(parents=True,exist_ok=True);target.write_text(text,encoding="utf8",newline="\n")
    metadata=p4.load(ROOT/"locales/gameplay-core.metadata.json")["entries"]
    metadata += [entry for folder in folders for entry in p4.load(folder/"metadata.json")["entries"]]
    base_paths=[ROOT/"locales/gameplay-core.json"]+[folder/"catalog.json" for folder in folders]
    base_paths.append(ROOT/"tools/semantic-text/phase5-grammar/catalog-fragment.json")
    if authored_paths is None: authored_paths=sorted((ROOT/"locales/phase4").glob("*.normalized.json"))
    catalog,catalog_audit=loader.load_catalog(base_paths,metadata,authored_paths,p4.catalog.names,p4.sha)
    (output/"catalog.json").write_text(json.dumps(catalog,ensure_ascii=False,indent=2),encoding="utf8",newline="\n")
    (output/"catalog-audit.json").write_text(json.dumps(catalog_audit,ensure_ascii=False,indent=2),encoding="utf8",newline="\n")
    (output/"name-eligibility-audit.json").write_text(json.dumps(name_audit,ensure_ascii=False,indent=2),encoding="utf8",newline="\n")
    audit["phase4"]={"source_only":True,"compiled":False,"runtime_verified":False,"literal_source_contract_ids":5559,
                     "additional_call_operations":len(operations),"catalog_counts":catalog_audit["counts"],"frozen_inputs":frozen_snapshots,
                     "metadata_input_sha256":p4.sha((prepared/"metadata.json").read_bytes()),
                     "precision_fallback":"three broad IDs and one diagnostic ID construct no semantic JSON",
                     "name_capture_provenance":name_audit["counts"],
                     "helper_sources":["src/nh-phase4-values.c"],"isolated_working_source":str(source)}
    audit["generated_files"]=[{"path":str(path.relative_to(output)).replace("\\","/"),"bytes":path.stat().st_size,"sha256":p4.sha(path.read_bytes())}
                              for base in (output/"include",output/"src") for path in sorted(base.rglob("*")) if path.is_file()]
    for file in audit["files"]:
        file["patched_sha256"]=p4.sha((source/file["source"]).read_bytes())
    for path,digest in frozen_snapshots.items():
        if p4.sha((ROOT/path).read_bytes())!=digest: raise ValueError("Frozen source/catalog changed during isolated preparation")
    (output/"audit.json").write_text(json.dumps(audit,ensure_ascii=False,indent=2),encoding="utf8",newline="\n")
    # Explicit source evidence, not a guessed target preprocessor result.
    metadata_sites=[(entry,site) for entry in metadata for site in entry.get("source_call_sites",[])]
    inactive=[]
    for entry,site in metadata_sites:
        guards=site.get("conditional_guards",[])
        if any(guard.get("kind")=="if" and guard.get("expression","").strip()=="0"
               and guard.get("branch")=="initial" for guard in guards):
            inactive.append({"id":entry["id"],"source":site["source"],"line":site["line"],
                             "conditional_guards":guards,"constant_inactive_source":True,
                             "native_callback_active":False,"runtime_verified":False})
    (output/"source-eligibility-overlay.json").write_text(json.dumps({"schema_version":1,"source_only":True,
        "contract":"lexical source IDs remain in the denominator; a compiled translation unit does not prove conditional branch activity",
        "constant_inactive_sites":inactive},ensure_ascii=False,indent=2),encoding="utf8",newline="\n")
    makefile=(upstream/"sys/unix/Makefile.src").read_text(encoding="utf8")
    hobj=re.search(r"^HOBJ\s*=\s*(.*?)(?=\n\n)",makefile,re.M|re.S).group(1)
    core=list(dict.fromkeys(re.findall(r"\$\(TARGETPFX\)(\w+)\.o",hobj)))+["date","hacklib"]
    engine_sources={"src/"+name+".c" for name in core}
    engine_sources.update(["sys/libnh/libnhmain.c","sys/share/ioctl.c","sys/share/unixtty.c","sys/unix/unixunix.c",
                           "sys/unix/unixres.c","win/shim/winshim.c","sys/share/posixregex.c","sys/libnh/jrogue-abi.c"])
    engine_sources.update(str(path.relative_to(source)).replace("\\","/") for path in (source/"lib/lua-5.4.8/src").glob("*.c") if path.name not in ("lua.c","luac.c"))
    helpers={"src/nh-semantic.c","src/nh-quest-semantic.c","src/nh-semantic-name.c","src/nh-phase4-values.c"}
    engine_sources.update(helpers)
    modified={file["source"] for file in audit["files"]}
    resource={"source_only":True,"actual_compile_or_runtime_performed":False,"planned_full_units":len(engine_sources),
              "patched_upstream_source_files":len(modified),"generated_helper_units":len(helpers),
              "estimated_incremental_units_if_verified_object_cache_available":len(modified & engine_sources)+len(helpers),
              "fresh_isolated_build_requires_full_units":True,"compile_jobs":1,
              "compiler_limits":{"EMCC_CORES":"1","BINARYEN_CORES":"1","cargo_jobs":1,"CARGO_PROFILE_RELEASE_CODEGEN_UNITS":"1"},
              "memory_peak":"unmeasured; parent serial heavy-build slot and fresh 2GiB headroom required",
              "catalog_bytes":(output/"catalog.json").stat().st_size,"catalog_limit_bytes":16*1024*1024,
              "compiled_sources":sorted(engine_sources)}
    (output/"resource-plan.json").write_text(json.dumps(resource,indent=2),encoding="utf8",newline="\n")
    source_inputs=[ROOT/"tools/build-upstream.py",ROOT/"tools/prepare-combined-semantic.py",ROOT/"tools/instrument-semantic-phase4.py",
                   ROOT/"tools/instrument-semantic-text.py",ROOT/"tools/semantic-text/phase5-grammar/prepare.py"]
    source_inputs += [path for path in (ROOT/"tools/semantic-text/phase4").iterdir() if path.is_file()]
    manifest={"schema_version":1,"source_only":True,"compiled":False,"runtime_verified":False,"official_commit":audit["official_commit"],
              "source_inputs":[{"path":str(path.relative_to(ROOT)).replace("\\","/"),"sha256":p4.sha(path.read_bytes()),"bytes":path.stat().st_size} for path in sorted(set(source_inputs))],
              "catalog":{"sha256":p4.sha((output/"catalog.json").read_bytes()),"bytes":resource["catalog_bytes"],"fetch_path":"gameplay-core.json","counts":catalog_audit["counts"]},
              "prepared_sources":audit["files"],"generated_files":audit["generated_files"],"authored_catalog_inputs":catalog_audit["input_provenance"]}
    (output/"source-manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding="utf8",newline="\n")
    return audit
