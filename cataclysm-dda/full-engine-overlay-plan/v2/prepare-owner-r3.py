"""Fresh scoped-context source-only revision; never load a Windows guard or compiler."""
from pathlib import Path
import ast,copy,hashlib,json,os,shutil,stat,types
from datetime import datetime,timezone

HERE=Path(__file__).resolve().parent
OLD_OWNER_SHA="d0391b547b037b97c898343a74ba1daefc0647d53fdeade7921986657829e336"
OLD_PACKET_SHA="26ee578f2ee49b7a9b582a9695dde2760f0ee85e2eeff112f96c87365dbfb5f0"
PLAN_SHA="208c9b5dffb6822752dc155e80fb7ad187fd9735fccb80ab9eb0264655546b03"
AUDIT_SHA="8d3deb1d161ab2d9238326987b0e97250f1f3b902e5398972d6eebf187dae1b6"

def require(value,message):
    if not value:
        raise RuntimeError(message)
def sha(data):
    return hashlib.sha256(data).hexdigest()
def exact(file,expected):
    raw=file.read_bytes()
    require(sha(raw)==expected,"immutable evidence changed: "+str(file))
    return raw
def replace_once(text,old,new):
    require(text.count(old)==1,"revision source anchor changed: "+old)
    return text.replace(old,new)

owner_bytes=exact(HERE/"run-owner-window-r2.py",OLD_OWNER_SHA)
packet_bytes=exact(HERE/"OWNER-PINS-r2.json",OLD_PACKET_SHA)
full_bytes=exact(HERE/"FULL-INTEGRATION-PLAN.json",PLAN_SHA)
audit_bytes=exact(HERE/"METADATA-DELTA-index000-SCOPED.json",AUDIT_SHA)
full=json.loads(full_bytes)
old=json.loads(packet_bytes)
audit=json.loads(audit_bytes)
comparison_path=HERE/"SCOPED-PORTS-ARCHIVE-COMPARISON.json"
comparison=json.loads(comparison_path.read_bytes())
require(comparison["status"]=="archive-comparison-pass","official archive comparison did not pass")
require(comparison["sourceAudit"]["sha256"]==AUDIT_SHA,"archive comparison audit identity differs")
require(audit["all4220BytePinsUnchanged"] and audit["allThreePhasesAgree"],"scoped audit disagrees")
require(sum(port["matchedFiles"] for port in comparison["ports"])==4243,"exact added-file closure differs")
require(sum(port["matchedBytes"] for port in comparison["ports"])==96038870,"exact added bytes differ")
require(not any(port["errors"] for port in comparison["ports"]),"source provenance diagnostics unresolved")
require(set(audit["phases"]["beforeFixedHelperImports"])==set(old["acceptedTreeBaselines"]),"tree scope differs")

text=owner_bytes.decode("utf-8")
require(text.count('"OWNER-PINS-r2.json"')>=2,"packet anchors absent")
text=text.replace('"OWNER-PINS-r2.json"','"OWNER-PINS-r3.json"')
text=replace_once(text,'"OWNER-SOURCE-VALIDATION-r2-"','"OWNER-SOURCE-VALIDATION-r3-"')
text=replace_once(text,'packet["ownerRevision"] == "r2"','packet["ownerRevision"] == "r3"')
ast.parse(text)
runner=HERE/"run-owner-window-r3.py"
packet_path=HERE/"OWNER-PINS-r3.json"
require(not os.path.lexists(runner) and not os.path.lexists(packet_path),"fresh r3 paths required")
with runner.open("x",encoding="utf-8",newline="\n") as stream:
    stream.write(text)
module=types.ModuleType("cdda_source_only_owner_r3_preparer")
module.__file__=str(runner)
exec(compile(text,str(runner),"exec",dont_inherit=True,optimize=0),module.__dict__)
cpp2=module.load_cpp2()
cpp2.validate_pin_records(old["pins"])
expected=copy.deepcopy(old["acceptedTreeBaselines"])
for name,delta in audit["phases"]["beforeFixedHelperImports"].items():
    require(len(expected[name])==delta["membersBefore"],"prior tree count differs")
    for row in delta["changes"]:
        before=row["beforeMetadata"]
        require((expected[name].get(row["member"]) if before is not None else None)==
                ([None if v is None else int(v) for v in before] if before is not None else None),
                "delta before metadata differs")
        require(before is None and row["afterMetadata"] is not None,"unexpected non-addition in source audit")
        require(row["member"] not in expected[name],"addition already in old baseline")
        expected[name][row["member"]]=[None if v is None else int(v) for v in row["afterMetadata"]]
    require(len(expected[name])==delta["membersAfter"],"expected scoped tree count differs")
current=module.capture_accepted_trees(full,cpp2)
require(current==expected,"fresh scoped context differs from exact reviewed audit, no silent baseline refresh")
records={row["path"].lower():row for row in old["pins"]}
for port in comparison["ports"]:
    for entry in port["files"]:
        record={key:entry[key] for key in ("path","bytes","sha256")}
        actual=module.pin(record["path"])
        require(actual==record,"scoped added file changed since archive comparison")
        records[record["path"].lower()]=record
    for key in ("definition","archive"):
        record={key2:port[key][key2] for key2 in ("path","bytes","sha256")}
        require(module.pin(record["path"])==record,"official port input changed")
        records[record["path"].lower()]=record
    notice=HERE.parents[1]/"baseline-preview/web/notices/compiler-ports"/{
        "harfbuzz":"HarfBuzz-COPYING.txt","libpng":"libpng-LICENSE.txt","zlib":"zlib-LICENSE.txt"}[port["name"]]
    require(module.pin(notice)["sha256"]==port["license"]["sha256"],"copied notice differs from official archive")
override=Path(r"C:\Users\kit\emsdk\upstream\emscripten\tools\ports\zlib\zconf.h")
for file in [runner,Path(__file__),HERE/"compare-scoped-port-archives.py",HERE/"run-owner-window-r2.py",HERE/"OWNER-PINS-r2.json",
             HERE/"METADATA-DELTA-index000-SCOPED.json",comparison_path,override]:
    record=module.pin(file)
    records[record["path"].lower()]=record
png_override=Path(r"C:\Users\kit\emsdk\upstream\emscripten\tools\ports\libpng\pnglibconf.h")
record=module.pin(png_override)
records[record["path"].lower()]=record
full_port_files=0
full_port_bytes=0
for member,metadata in sorted(current["ports"].items()):
    if stat.S_ISREG(metadata[2]):
        record=module.pin(Path(full["frozenSDK"]["ports"])/member)
        records[record["path"].lower()]=record
        full_port_files+=1
        full_port_bytes+=record["bytes"]
packet=copy.deepcopy(old)
packet.update(ownerRevision="r3",runnerSha256=module.digest(runner),
              previousOwnerPacket=module.pin(HERE/"OWNER-PINS-r2.json"),
              acceptedTreeBaselines=expected,
              acceptedExecutionScope="require_escalated; exact scoped ports visibility; no default-context omission",
              scopedDeltaEvidence=module.pin(HERE/"METADATA-DELTA-index000-SCOPED.json"),
              scopedPortContentProvenance=module.pin(comparison_path),
              unchangedOriginalBytePinCount=4220,
              additionalOfficialPortSourceFiles=4243, fullScopedPortFileCount=full_port_files, fullScopedPortBytes=full_port_bytes,
              exactProtectedFingerprintClosureRequired=True,
              sourceAndGeneratedMembershipRetainedAcrossEveryWindow=True)
packet["pins"]=sorted(records.values(),key=lambda row:row["path"].lower())
cpp2.validate_pin_records(packet["pins"])
require(module.capture_accepted_trees(full,cpp2)==expected,"metadata changed during source preparation")
require(sha((HERE/"run-owner-window-r2.py").read_bytes())==OLD_OWNER_SHA and
        sha((HERE/"OWNER-PINS-r2.json").read_bytes())==OLD_PACKET_SHA,"immutable r2 changed")
module.fresh_owned_file(packet_path)
module.write_json(packet_path,packet)
result={"status":"fresh-scoped-r3-prepared-no-launch","utc":datetime.now(timezone.utc).isoformat(),
        "runner":module.pin(runner),"packet":module.pin(packet_path),"planSha256":PLAN_SHA,
        "protectedFiles":len(packet["pins"]),"treeMembers":{name:len(tree) for name,tree in expected.items()},
        "diskFreeBytes":shutil.disk_usage(HERE).free,"WindowsGuardLoaded":False,
        "compilerExecuted":False,"browserExecuted":False,"fullLinkReleased":False}
module.write_json(HERE/"OWNER-PREPARATION-r3.json",result)
print(json.dumps(result,indent=2))
