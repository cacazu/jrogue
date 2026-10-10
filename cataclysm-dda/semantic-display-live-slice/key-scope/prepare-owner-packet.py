"""Prepare fresh key/help owner packet using read-only sources; never imports build guard."""
from pathlib import Path
import hashlib,json,re
ROOT=Path(__file__).resolve().parent.parent
KEY=ROOT/'key-scope'
UP=Path('C:/Users/kit/gameme/jnethack/jrouge/cataclysm-dda/upstream/Cataclysm-DDA-7b2efa5cea38e4d4d97dd0e63b28b9148623da59')
COMMIT='7b2efa5cea38e4d4d97dd0e63b28b9148623da59'
def require(c,m):
 if not c: raise RuntimeError(m)
def digest(p):
 h=hashlib.sha256()
 with Path(p).open('rb') as f:
  for b in iter(lambda:f.read(1048576),b''):h.update(b)
 return h.hexdigest()
def pin(p):
 p=Path(p).resolve();return {'path':str(p),'bytes':p.stat().st_size,'sha256':digest(p)}
def load(p,expected=None):
 if expected:require(digest(p)==expected,'frozen input changed '+str(p))
 return json.loads(Path(p).read_text(encoding='utf-8'))
def fresh(p,data):
 require(not p.exists(),'fresh packet destination already exists '+str(p))
 p.write_bytes(data)
def encode(v):return (json.dumps(v,ensure_ascii=False,indent=2)+'\n').encode('utf-8')
def mmd(p):
 line=re.sub(r'\\\r?\n',' ',Path(p).read_text()).splitlines()[0];k=line.find(': ')
 require(k>0,'MMD separator');return str(Path(line[:k]).resolve()),sorted({str(Path(x).resolve()) for x in line[k+2:].split()})
prepared=load(KEY/'KEY-SCOPE-WINDOW-PREPARED.json','3db847f11a1b716f78dadeb1b5644fd0909bb653777fb2b37420885540d1d0ae')
base=load(ROOT/'PRODUCER-WINDOW-PLAN.json','8201d92d59328e02c2f74400627f2e0218085ab3f9b44c81148f2caee006882f')
packet0=load(ROOT/'PRODUCER-SOURCE-PACKET.json','f9219575ed74af6c9fa3a2d183580218b2ddbe30ff64ec066e33fe42e6bac7ed')
compileplan=load(ROOT/'COMPILE-WINDOW-PLAN.json','d9023bbce0f8a4b567c71fb630e0db8b3af29ca3a37c19122e7757c32cbf1379')
proof=load(ROOT/'COMPILE-VERIFICATION.json','78fda00342ab9681ebfd633b9199cecd0d2c4c30989655c4aa8297138f26b1bf')
sourceplan=load(KEY/'KEY-SCOPE-SOURCE-PLAN.json','dcb38d747b34e3638b7f51a847b6238e6094fe501afccb39421aba719e4a42a8')
require(sourceplan['expectedChecksPerCall']==36 and sourceplan['upstreamCommit']==COMMIT,'real fixture source identity')
oldowner=ROOT/'run-producer-window.py';require(digest(oldowner)=='ac18c7f64bacddef2175cadee8f4a75c8f781218785567613b835b7e233ee0e3','frozen owner')
allpins={}
def add(row):
 v={k:row[k] for k in ['path','bytes','sha256']};v['path']=str(Path(v['path']).resolve())
 require(pin(v['path'])==v,'pin changed '+v['path'])
 require(v['path'] not in allpins or allpins[v['path']]==v,'pin conflict')
 allpins[v['path']]=v
for r in base['pins']:add(r)
for r in prepared['pinnedFreshScopeFilesAndCoherentObjects']:add(r)
for r in proof['raw_evidence_pins']:add(r)
for f in ['KEY-SCOPE-WINDOW-PREPARED.json','prepare-key-plan.cjs','fixture-preferences.json','prepare-owner-packet.py']:
 add(pin(KEY/f))
for f in ['run-producer-window.py','PRODUCER-WINDOW-PLAN.json','COMPILE-WINDOW-PLAN.json','COMPILE-VERIFICATION.json','PRODUCER-INITIAL-FAILURE.json','PRODUCER-ESCALATION-REQUEST.json','PRODUCER-ESCALATED-APPROVAL-TIMEOUTS.json']:
 add(pin(ROOT/f))
for f in ['input.cpp','input_context.cpp','help.cpp','action.cpp','game.cpp','rng.cpp','sdltiles.cpp','path_info.cpp','init.cpp','translations.cpp','output.cpp']:
 add(pin(UP/'src'/f))
for r in sourceplan['sourceResources']:
 actual=pin(UP/r['path']);require(actual['bytes']==r['bytes'] and actual['sha256']==r['sha256'],'official resource');add(actual)
require(proof['all_exact_jobs_and_process_handles_closed'] and not proof['original_producer_executed'],'six compile closure/scope')
coherent=[]
for command in compileplan['commands'][:5]:
 stage=command['stage'];receiptpath=ROOT/'execution/semantic-help-compile-initial'/(stage+'.json')
 result=load(receiptpath)
 require(result['passed'] is True and type(result['exitCode']) is int and result['exitCode']==0,'actual compile receipt')
 require(result['argv']==[command['executable'],*command['argv']] and result['cwd']==command['cwd'],'actual command receipt')
 require(not result['remainingOwnedPidsBeforeJobClose'],'actual job closure')
 cleanpath=receiptpath.with_name(stage+'.outer-cleanup.json');clean=load(cleanpath)
 require(clean['passed'] and not clean['remainingOwnedJobHandles'],'outer compile closure')
 obj=pin(command['outputObject']);dep=pin(command['outputDependencyFile']);target,paths=mmd(dep['path'])
 require(target==obj['path'] and str(Path(command['source']).resolve()) in paths,'coherent compile MMD')
 require(Path(obj['path']).read_bytes()[:8]==b'\0asm\1\0\0\0','actual object WASM')
 outputs=[]
 for artifact in [obj,dep]:
  row=next(x for x in proof['actual_outputs'] if x['path']==artifact['path'])
  require({k:row[k] for k in artifact}==artifact,'compile proof output pin')
  require(row['archive']['bytes']==artifact['bytes'] and row['archive']['sha256']==artifact['sha256'],'archive pair')
  add(artifact);add(row['archive']);outputs.append(row)
 for p in paths:add(pin(p))
 add(pin(receiptpath));add(pin(cleanpath))
 coherent.append({'stage':stage,'source':pin(command['source']),'object':obj,'dependencyFile':dep,'actualMmdPaths':paths,'successfulCompileReceipt':pin(receiptpath),'closedOuterCleanup':pin(cleanpath),'actualCommand':command,'archivedOutputs':outputs,'requiresPrelinkRehash':True,'coherentChangedHeadersIncluded':True,'referencedReadOnlyNotCopied':True})
packet={'schemaVersion':1,'status':'source-only-key-help-owner-packet-prepared','sourceCommit':COMMIT,'sourcePlan':pin(KEY/'KEY-SCOPE-SOURCE-PLAN.json'),'preparedPlan':pin(KEY/'KEY-SCOPE-WINDOW-PREPARED.json'),'officialHelpPath':'data/core/help.json','officialBindingEntries':620,'originalCoreReuse':packet0['originalCoreReuse'],'coherentCompiledReuse':{'count':5,'objects':coherent,'proof':pin(ROOT/'COMPILE-VERIFICATION.json'),'compilePlan':pin(ROOT/'COMPILE-WINDOW-PLAN.json')},'fixture':pin(KEY/'original-key-help.cpp'),'selectedOriginalSupport':pin(KEY/'generated-selected-key-support.cpp'),'selectedDefinitions':sourceplan['selectedOriginalDefinitions'],'fixtureOnlyLeaves':sourceplan['fixtureOnlyLeaves'],'preservedFailureEvidence':[pin(ROOT/f) for f in ['PRODUCER-INITIAL-FAILURE.json','PRODUCER-ESCALATION-REQUEST.json','PRODUCER-ESCALATED-APPROVAL-TIMEOUTS.json']],'baseReviewedOwner':pin(oldowner),'expectedNativeChecksPerCall':36,'plannedNativeCalls':2,'plannedNativeChecks':72,'actualNativeChecks':0,'additionalSemanticIDs':0,'pins':sorted(allpins.values(),key=lambda x:x['path']),'nativeCompilerExecuted':False,'strictLinkClosureProven':False,'originalProducerExecuted':False,'helpDisplayExecuted':False,'RustExecuted':False,'browserExecuted':False,'fullEngineLinked':False,'wholeGameAccepted':False}
packetdata=encode(packet);packetsha=hashlib.sha256(packetdata).hexdigest()
plan={k:base[k] for k in ['schemaVersion','sourceCommit','buildIdentity','cpp2Helper','guard','frozenSDK','launchGate','ownedResourceGuard','rustEnvironment','removeInheritedEnvironment','browserRecoveryHasPriority','parentExclusiveSlotReleaseRequired','stagedTree','exactBaseFlags','affectedOriginalUnitsBeforeFullRelink']}
plan.update(status='source-only-key-help-bounded-owner-prepared',commands=prepared['commands'],sourcePacketSha256=packetsha,sourcePlanSha256=digest(KEY/'KEY-SCOPE-SOURCE-PLAN.json'),outputDirectory=prepared['outputDirectory'],linkObjects=prepared['linkObjects'],exactLinkFlags=prepared['commands'][2]['argv'][32:-2],requiredExports=['cdda_original_key_help_fixture_run','cdda_fixture_diagnostic_call_count','cdda_help_snapshot_pin','cdda_help_snapshot_data','cdda_help_snapshot_size','cdda_help_snapshot_release'],expectedRuntimeResult=prepared['expectedRuntimeResult'],strictLinkClosureProven=False,originalProducerExecuted=False,helpDisplayExecuted=False,RustExecuted=False,browserExecuted=False,fullEngineLinked=False,wholeGameAccepted=False)
require(plan['exactLinkFlags'][0]=='-O0' and len(plan['linkObjects'])==30,'strict thirty object flags')
planpins=dict(allpins);ppath=KEY/'KEY-SCOPE-SOURCE-PACKET.json';planpins[str(ppath)]={'path':str(ppath),'bytes':len(packetdata),'sha256':packetsha};plan['pins']=sorted(planpins.values(),key=lambda x:x['path'])
plandata=encode(plan);plansha=hashlib.sha256(plandata).hexdigest()
old=oldowner.read_text(encoding='utf-8')
imports=old[old.index('from pathlib'):old.index('HERE =')]
constants='''HERE = Path(__file__).resolve().parent.parent
KEY = HERE / "key-scope"
PLAN_PATH = KEY / "KEY-SCOPE-WINDOW-PLAN.json"
PLAN_SHA = "@PLAN@"
PACKET_SHA = "@PACKET@"
CPP2_SHA = "0ed16674c31ab9335b75c71afc8c73b717398f4cbd56613840ee2266e64ea395"
PIN_COUNT = @COUNT@
GIB = 1024 ** 3
STAGES = ["compile-selected-original-key-support", "compile-original-key-help-fixture",
          "strict-link-original-key-help-scope", "execute-original-key-help-scope"]
'''.replace('@PLAN@',plansha).replace('@PACKET@',packetsha).replace('@COUNT@',str(len(plan['pins'])))
constants+='LINK_FLAGS = '+repr(plan['exactLinkFlags'])+'\n\n'
pure=r'''
def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def digest(path):
    value = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            value.update(chunk)
    return value.hexdigest()


def ordinary(path):
    state = Path(path).lstat()
    require(not Path(path).is_symlink() and not getattr(state, "st_file_attributes", 0) & 0x400,
            "reparse/symlink path: " + str(path))


def ordinary_chain(path):
    candidate = Path(path).absolute()
    for current in [candidate, *candidate.parents]:
        ordinary(current)


def checked(path, expected):
    ordinary_chain(path)
    data = Path(path).read_bytes()
    require(hashlib.sha256(data).hexdigest() == expected, "fixed source bytes changed: " + str(path))
    return data


def pin(path):
    ordinary_chain(path)
    p = Path(path).resolve()
    require(p.is_file(), "protected ordinary file")
    return {"path": str(p), "bytes": p.stat().st_size, "sha256": digest(p)}


def within(path, parent):
    try:
        Path(path).resolve().relative_to(Path(parent).resolve())
        return True
    except ValueError:
        return False


def validate_pin_records(records):
    known = {}
    for record in records:
        require(set(record) == {"path", "bytes", "sha256"}, "exact pin schema")
        require(type(record["bytes"]) is int and record["bytes"] >= 0 and
                type(record["sha256"]) is str and re.fullmatch(r"[a-f0-9]{64}", record["sha256"]), "pin types")
        require(record["path"] not in known, "duplicate protected pin")
        require(pin(record["path"]) == record, "protected bytes changed: " + record["path"])
        known[record["path"]] = record


def metadata_tree(root):
    ordinary_chain(root)
    result = {}
    for directory, dirs, files in os.walk(root, followlinks=False):
        for name in [*dirs, *files]:
            file = Path(directory) / name
            ordinary(file)
            state = file.lstat()
            result[str(file)] = [None if file.is_dir() else state.st_size, state.st_mtime_ns,
                                 state.st_mode, getattr(state, "st_file_attributes", 0)]
    return result


def write_json(path, value):
    data = (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    ordinary_chain(Path(path).parent)
    if os.path.lexists(path):
        ordinary_chain(path)
        require(Path(path).read_bytes() == data, "immutable source validation result changed")
    else:
        with Path(path).open("xb") as stream:
            stream.write(data)


def mmd_paths(file):
    line = re.sub(r"\\\r?\n", " ", Path(file).read_text(encoding="utf-8")).splitlines()[0]
    separator = line.find(": ")
    require(separator > 0, "MMD target separator")
    return line[:separator], sorted({str(Path(x).resolve()) for x in line[separator + 2:].split()})


def load_sources():
    # This function reads source and metadata only. No build-helper import, guard or counter call.
    data = checked(PLAN_PATH, PLAN_SHA)
    plan = json.loads(data)
    packet_data = checked(KEY / "KEY-SCOPE-SOURCE-PACKET.json", PACKET_SHA)
    packet = json.loads(packet_data)
    require(plan["sourceCommit"] == "7b2efa5cea38e4d4d97dd0e63b28b9148623da59", "official source")
    require(plan["sourcePacketSha256"] == PACKET_SHA and
            plan["browserRecoveryHasPriority"] is True and plan["parentExclusiveSlotReleaseRequired"] is True,
            "priority/source packet")
    require([x["stage"] for x in plan["commands"]] == STAGES, "exact four stages")
    require(len(plan["pins"]) == PIN_COUNT and packet["originalCoreReuse"]["count"] == 23 and
            packet["coherentCompiledReuse"]["count"] == 5, "exact reuse/pin counts")
    require(plan["exactLinkFlags"] == LINK_FLAGS and plan["affectedOriginalUnitsBeforeFullRelink"] == 231,
            "strict link/full rebuild distinction")
    require(plan["launchGate"]["minimumPhysicalFreeBytes"] == 4 * GIB and
            plan["launchGate"]["minimumExactCommitHeadroomBytes"] == 6 * GIB, "fresh 4/6 gate")
    guard = plan["ownedResourceGuard"]
    require(guard["maximumOwnedTreePrivateBytes"] == GIB and guard["maximumOwnedTreeWorkingSetBytes"] == GIB and
            guard["minimumPhysicalFreeBytes"] == 2 * GIB and guard["minimumExactCommitHeadroomBytes"] == 2 * GIB and
            guard["maximumStageSeconds"] == 180 and guard["sampleIntervalMilliseconds"] == 250,
            "fixed owned caps/floors/time")
    for item in [HERE, KEY, HERE / "build", HERE / "build/sources/src", HERE / "build/objects", HERE / "execution"]:
        ordinary_chain(item)
        require(item.is_dir(), "ordinary source/output ancestry")
    output = HERE / "build/key-scope-run"
    require(Path(plan["outputDirectory"]) == output, "owned exact output directory")
    if os.path.lexists(output):
        ordinary_chain(output)
        require(output.is_dir(), "output directory type")
    metadata_tree(HERE / "build/sources/src")
    source_files = sorted(str(p.resolve()) for p in (HERE / "build/sources/src").rglob("*") if p.is_file())
    staged_pins = sorted(x["path"] for x in plan["pins"] if within(x["path"], HERE / "build/sources/src"))
    require(len(source_files) == 969 and source_files == staged_pins, "coherent exact source membership")
    old = json.loads(checked(HERE / "COMPILE-WINDOW-PLAN.json",
                            "d9023bbce0f8a4b567c71fb630e0db8b3af29ca3a37c19122e7757c32cbf1379"))
    for command, source, stem in zip(plan["commands"][:2],
                                    [KEY / "generated-selected-key-support.cpp", KEY / "original-key-help.cpp"],
                                    ["selected-key-support", "original-key-help-fixture"]):
        expected = [*old["commands"][0]["argv"][:-6], "-MMD", "-MP", "-c", str(source),
                    "-o", str(output / (stem + ".o"))]
        require(command["source"] == str(source) and command["argv"] == expected, "exact coherent compile")
        require(command["outputObject"] == str(output / (stem + ".o")) and
                command["outputDependencyFile"] == str(output / (stem + ".d")) and
                command["outputs"] == [command["outputObject"], command["outputDependencyFile"]], "exact compile outputs")
    expected_objects = [*[x["object"]["path"] for x in packet["originalCoreReuse"]["objects"]],
                        *[x["object"]["path"] for x in packet["coherentCompiledReuse"]["objects"]],
                        *[x["outputObject"] for x in plan["commands"][:2]]]
    require(plan["linkObjects"] == expected_objects and len(expected_objects) == 30, "exact original closure")
    link, runtime = plan["commands"][2:]
    require(link["argv"] == [old["commands"][0]["argv"][0], "-v", *expected_objects, *LINK_FLAGS,
                              "-o", str(output / "original-key-help.mjs")], "strict exact mainless link")
    require(link["outputs"] == [str(output / "original-key-help.mjs"), str(output / "original-key-help.wasm")],
            "exact link outputs")
    require(runtime["argv"] == [str(KEY / "run-original-key-help.mjs")] and runtime["outputs"] == [], "exact driver")
    require(Path(runtime["executable"]).name.casefold() == "node.exe", "pinned native Node")
    for command in plan["commands"]:
        require(command["cwd"] == str(HERE / "build") and command["environment"] == old["commands"][0]["environment"],
                "fixed cwd/frozen one-worker environment")
        for file in command["outputs"]:
            require(within(file, output) and Path(file).parent == output, "output containment")
    require(all(x["executable"] == old["commands"][0]["executable"] for x in plan["commands"][:3]),
            "official Python compiler executable")
    require(len(packet["originalCoreReuse"]["objects"]) == 23 and len(packet["coherentCompiledReuse"]["objects"]) == 5,
            "reuse row counts")
    for row in packet["originalCoreReuse"]["objects"]:
        target, paths = mmd_paths(row["dependencyFile"]["path"])
        require(Path(target).resolve() == Path(row["object"]["path"]).resolve() and paths == sorted(row["actualMmdPaths"]),
                "actual original MMD membership/target")
        require(not any(Path(x).name in ["input.h", "input_context.h", "help.h"] for x in paths), "changed class header reuse")
        require(type(row["success"]["code"]) is int and row["success"]["code"] == 0, "actual original success log")
        for dependency in row["unchangedDependencies"]:
            candidate = HERE / "build/sources" / dependency["file"]
            require(candidate.stat().st_size == dependency["bytes"] and digest(candidate) == dependency["sha256"],
                    "core object prerequisite differs from coherent tree")
    for row in packet["coherentCompiledReuse"]["objects"]:
        target, paths = mmd_paths(row["dependencyFile"]["path"])
        require(Path(target).resolve() == Path(row["object"]["path"]).resolve() and paths == sorted(row["actualMmdPaths"]),
                "actual coherent MMD membership/target")
        receipt = json.loads(Path(row["successfulCompileReceipt"]["path"]).read_bytes())
        command = row["actualCommand"]
        require(receipt["passed"] is True and type(receipt["exitCode"]) is int and receipt["exitCode"] == 0 and
                receipt["argv"] == [command["executable"], *command["argv"]] and receipt["cwd"] == command["cwd"] and
                not receipt["remainingOwnedPidsBeforeJobClose"], "genuine coherent compile receipt")
        cleanup = json.loads(Path(row["closedOuterCleanup"]["path"]).read_bytes())
        require(cleanup["passed"] is True and not cleanup["remainingOwnedJobHandles"], "closed coherent compile job")
        require(str(Path(command["source"]).resolve()) in paths, "actual compiled coherent source")
    for row in [*packet["originalCoreReuse"]["objects"], *packet["coherentCompiledReuse"]["objects"]]:
        require(Path(row["object"]["path"]).read_bytes()[:8] == b"\0asm\1\0\0\0", "actual original/coherent object")
    require(packet["officialHelpPath"] == "data/core/help.json" and packet["officialBindingEntries"] == 620 and
            packet["expectedNativeChecksPerCall"] == 36 and packet["plannedNativeCalls"] == 2 and
            packet["plannedNativeChecks"] == 72 and packet["actualNativeChecks"] == 0, "actual data/planned scope")
    require(plan["requiredExports"] == ["cdda_original_key_help_fixture_run", "cdda_fixture_diagnostic_call_count",
                "cdda_help_snapshot_pin", "cdda_help_snapshot_data", "cdda_help_snapshot_size", "cdda_help_snapshot_release"],
            "fixture plus actual KEEPALIVE transport exports")
    records = [*plan["pins"], pin(PLAN_PATH), pin(__file__)]
    validate_pin_records(records)
    wrapper = checked(plan["guard"]["currentWrapper"]["path"],
                      "0b04ccd828c52c874169b25336a729553c767b0c3580386e007c33a8a00604fb").decode("utf-8")
    require(wrapper.count('(command["stage"] + ".stdout.log")') == 1, "fixed stdout suffix")
    require((HERE / "build/.emscripten").read_text(encoding="utf-8").splitlines()[-1] == "FROZEN_CACHE = True",
            "frozen SDK configuration")
    helper_path = HERE.parent / "integration-overlay/build-plan/cpp-compile/run-compile-window.py"
    helper_data = checked(helper_path, CPP2_SHA)
    return plan, records, data, packet_data, helper_data


def load_execution_helper(helper_data, options):
    # The fixed build framework is imported only after an explicit, exact future release.
    require(options.run and options.parent_released_window and options.runner_sha256 == digest(__file__),
            "guard import requires exact separately released owner")
    require(__debug__ and sys.platform == "win32" and struct.calcsize("P") == 8, "unoptimized64 Windows")
    helper_path = HERE.parent / "integration-overlay/build-plan/cpp-compile/run-compile-window.py"
    require(hashlib.sha256(helper_data).hexdigest() == CPP2_SHA, "fixed build helper bytes")
    helper = types.ModuleType("cdda_key_help_private_fixed_cpp2")
    helper.__file__ = str(helper_path)
    exec(compile(helper_data, str(helper_path), "exec", dont_inherit=True, optimize=0), helper.__dict__)
    helper.validate_inherited_environment()
    return helper

'''
strict=old[old.index('def wasm_exports'):old.index('def verify_stage')].replace('("originalChecksPerRun", 34.0)','("originalChecksPerRun", 36.0)')
verify=r'''
def verify_stage(command, plan, records):
    if command["stage"] in STAGES[:2]:
        obj = Path(command["outputObject"])
        require(obj.read_bytes()[:8] == b"\0asm\1\0\0\0", "actual fixture/support object WASM header")
        target, paths = mmd_paths(command["outputDependencyFile"])
        require(Path(target).resolve() == obj.resolve(), "actual compiled MMD target")
        known = {str(Path(x["path"]).resolve()) for x in records}
        require(not [x for x in paths if x not in known], "unprotected actual compile dependency")
        required = (["translations.h", "output.h", "debug.h", "input.h", "input_context.h"]
                    if command["stage"] == STAGES[0] else
                    ["help.h", "input.h", "input_context.h", "cdda_help_semantic.h", "cdda_help_transport.h"])
        for name in required:
            require(str((HERE / "build/sources/src" / name).resolve()) in paths, "coherent compiled declaration " + name)
        require(str(Path(command["source"]).resolve()) in paths, "actual selected source")
        return {"actualNonSystemDependencies": paths}
    if command["stage"] == STAGES[2]:
        exports = wasm_exports(Path(command["outputs"][1]).read_bytes())
        require({x for x in exports if x.startswith("cdda_")} == set(plan["requiredExports"]),
                "exact fixture and real transport exports")
        require(Path(command["outputs"][0]).stat().st_size > 0, "actual generated native Node glue")
        return {"actualFunctionExports": exports, "strictLinkClosureProven": True}
    return {}

'''
execution=old[old.index('def archive_outputs'):old.index('def main')]
execution=execution.replace('build/producer-run','build/key-scope-run')
execution=execution.replace('ordinary(HERE / "build/key-scope-run")','ordinary_chain(HERE / "build/key-scope-run")')
execution=execution.replace('ordinary(destination)','ordinary_chain(destination)').replace('ordinary(output)','ordinary_chain(output)').replace('ordinary(temporary)','ordinary_chain(temporary)').replace('ordinary(source)','ordinary_chain(source)')
execution=execution.replace('destination.mkdir(parents=True, exist_ok=False)','ordinary_chain(destination.parent)\n    require(not os.path.lexists(destination), "fresh exact attempt; no retries")\n    destination.mkdir(parents=True, exist_ok=False)')
execution=execution.replace('output.mkdir(exist_ok=True)','ordinary_chain(output.parent)\n    if os.path.lexists(output):\n        ordinary_chain(output)\n    output.mkdir(exist_ok=True)')
execution=execution.replace('"preparing-original-producer-window"','"preparing-original-key-help-window"')
execution=execution.replace('"getKeyDescriptionExecuted": False, "helpDisplayExecuted": False,','"originalKeynameExecuted": False, "originalGetDescExecuted": False, "helpDisplayExecuted": False,')
execution=execution.replace('"selectedHelpScopeExecuted": False, "syntheticTransportExecuted": False,','"selectedHelpScopeExecuted": False, "originalTransportPinOwnershipExecuted": False, "syntheticTransportExecuted": False,')
execution=execution.replace('if command["stage"] == STAGES[1]:','if command["stage"] == STAGES[2]:').replace('if command["stage"] == STAGES[2]:\n                    raw','if command["stage"] == STAGES[3]:\n                    raw')
execution=execution.replace('terminal["originalProducerExecuted"] = True','terminal["originalProducerExecuted"] = True\n                    terminal["originalKeynameExecuted"] = True\n                    terminal["originalGetDescExecuted"] = True\n                    terminal["selectedHelpScopeExecuted"] = True\n                    terminal["originalTransportPinOwnershipExecuted"] = True')
execution=execution.replace('selected-original-help-loader-and-binder-passed','selected-original-key-help-scope-passed')
main=r'''
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--run", action="store_true")
    parser.add_argument("--parent-released-window", action="store_true")
    parser.add_argument("--runner-sha256")
    parser.add_argument("--attempt-name", default="semantic-key-help-initial")
    options = parser.parse_args()
    plan, records, data, packet_data, helper_data = load_sources()
    strict_checks = validate_runtime_result_contract(plan["expectedRuntimeResult"])
    if not options.run:
        require(not options.parent_released_window and options.runner_sha256 is None,
                "no-run validation cannot consume a parent release")
        result = {"status": "source-only-key-help-owner-validated", "planSha256": PLAN_SHA,
                  "sourcePacketSha256": PACKET_SHA, "runnerSha256": digest(__file__),
                  "protectedFiles": len(records), "stdoutContractSuffix": ".stdout.log",
                  "strictRuntimeResultSourceChecks": strict_checks, "stages": STAGES,
                  "pristineCoreReuseObjects": 23, "coherentCompiledReuseObjects": 5,
                  "plannedOriginalChecksPerCall": 36, "plannedOriginalCalls": 2, "plannedOriginalChecks": 72,
                  "actualOriginalChecks": 0, "buildHelperImported": False, "guardInvoked": False,
                  "nativeCompilerExecuted": False, "originalProducerExecuted": False, "linkExecuted": False,
                  "helpDisplayExecuted": False, "RustExecuted": False, "browserExecuted": False,
                  "fullEngineLinked": False, "wholeGameAccepted": False}
        write_json(KEY / "KEY-SCOPE-OWNER-SOURCE-VALIDATION.json", result)
        print(json.dumps(result, separators=(",", ":")))
        return 0
    helper = load_execution_helper(helper_data, options)
    return execute(plan, helper, records, data, packet_data, helper_data, options)


if __name__ == "__main__":
    sys.exit(main())
'''
owner=('"""Bounded four-stage actual key/help fixture owner; default is stdlib source validation only."""\n'+imports+constants+pure+strict+verify+execution+main).encode('utf-8')
compile(owner,str(KEY/'run-key-scope-window.py'),'exec',dont_inherit=True,optimize=0)
for name,data in [('KEY-SCOPE-SOURCE-PACKET.json',packetdata),('KEY-SCOPE-WINDOW-PLAN.json',plandata),('run-key-scope-window.py',owner)]:fresh(KEY/name,data)
print(json.dumps({'status':'source-only-owner-packet-prepared','packetSha256':packetsha,'planSha256':plansha,'ownerSha256':hashlib.sha256(owner).hexdigest(),'pinCount':len(plan['pins']),'coherentReuseObjects':len(coherent),'nativeCompilerExecuted':False},separators=(',',':')))
