"""Thin ordered transport: unchanged scoped SDK owner once per untouched index."""
from pathlib import Path
import argparse,ast,ctypes,hashlib,json,os,re,subprocess,sys,types
from ctypes import wintypes

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
OWNER_SHA="2af7f79539fd6332564add22770d04299888edf1cc60d5396d92c46853fec5ba"
PACKET_SHA="4b06db92f6712fb090b0e45ed1458cb3ed3449dfc4019899dd5625e531aa7568"
FIP_SHA="208c9b5dffb6822752dc155e80fb7ad187fd9735fccb80ab9eb0264655546b03"

def require(condition,message):
    if not condition:
        raise RuntimeError(message)
def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def write_new(path,value):
    require(not os.path.lexists(path),"fresh batch evidence required: "+str(path))
    with Path(path).open("x",encoding="utf-8",newline="\n") as output:
        json.dump(value,output,ensure_ascii=False,indent=2)
        output.write("\n")
def pin(path):
    path=Path(path)
    return {"path":str(path),"bytes":path.stat().st_size,"sha256":sha(path)}
def load_owner():
    path=HERE/"run-owner-window-r3.py"
    require(sha(path)==OWNER_SHA,"immutable R3 owner changed")
    source=path.read_bytes()
    ast.parse(source)
    module=types.ModuleType("cdda_serial_exact_r3_owner")
    module.__file__=str(path)
    exec(compile(source,str(path),"exec",dont_inherit=True,optimize=0),module.__dict__)
    return module
def options(index,run=False,attempt=None):
    return types.SimpleNamespace(mode="compile",index=index,run=run,parent_released_window=run,
                                 runner_sha256=OWNER_SHA,packet_sha256=PACKET_SHA,attempt_name=attempt)
def creation_filetime(handle):
    kernel=ctypes.WinDLL("kernel32",use_last_error=True)
    fn=kernel.GetProcessTimes
    fn.argtypes=[wintypes.HANDLE,*([ctypes.POINTER(wintypes.FILETIME)]*4)]
    fn.restype=wintypes.BOOL
    values=[wintypes.FILETIME() for _ in range(4)]
    require(fn(wintypes.HANDLE(int(handle)),*[ctypes.byref(v) for v in values]),
            "source-owner creation identity query failed")
    return str((values[0].dwHighDateTime<<32)|values[0].dwLowDateTime)

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--run",action="store_true")
    parser.add_argument("--parent-released-window",action="store_true")
    parser.add_argument("--driver-sha256")
    parser.add_argument("--plan-sha256")
    parser.add_argument("--attempt-name")
    args=parser.parse_args()
    require(__debug__ and sys.platform=="win32","unoptimized Windows required")
    owner=load_owner()
    owner.ordinary_owned(HERE,anchor=ROOT,directory=True)
    plan_path=owner.ordinary_owned(HERE/"SERIAL-COMPILE-PLAN-r3.json")
    plan=json.loads(plan_path.read_bytes())
    require(plan["driver"]["sha256"]==sha(__file__) and plan["driver"]==pin(__file__),"driver pin differs")
    require(plan["owner"]==pin(HERE/"run-owner-window-r3.py") and plan["owner"]["sha256"]==OWNER_SHA,"owner plan pin differs")
    require(plan["packet"]==pin(HERE/"OWNER-PINS-r3.json") and plan["packet"]["sha256"]==PACKET_SHA,"packet plan pin differs")
    require(plan["fullPlan"]==pin(HERE/"FULL-INTEGRATION-PLAN.json") and plan["fullPlan"]["sha256"]==FIP_SHA,"full plan pin differs")
    require(plan["indices"]==list(range(235)) and plan["fullLinkPermitted"] is False,"ordered compile-only scope differs")
    full,packet,cpp2,records,command,bridge=owner.validate(options(0))
    python=Path(plan["sdkPython"]["path"])
    require(plan["sdkPython"]==pin(python) and any(row==plan["sdkPython"] for row in records),"SDK Python pin differs")
    require(Path(sys.executable).resolve()==python.resolve(),"exact reviewed SDK Python required")
    for index,row in enumerate(plan["commands"]):
        expected=[str(python),"-B","-I",str(HERE/"run-owner-window-r3.py"),"--mode","compile",
                  "--index",str(index),"--run","--parent-released-window","--runner-sha256",OWNER_SHA,
                  "--packet-sha256",PACKET_SHA,"--attempt-name","v2-compile-%03d-r3-initial"%index]
        require(row["index"]==index and row["argv"]==expected and row["cwd"]==str(ROOT),
                "exact ordered source-owner command differs")
    require(len(plan["commands"])==235,"exact compile command count differs")
    if not args.run:
        result={"status":"serial-source-plan-validated-no-launch","driver":pin(__file__),"plan":pin(plan_path),
                "protectedFiles":len(records),"indices":235,"WindowsGuardLoaded":False,
                "compilerExecuted":False,"browserExecuted":False,"fullLinkPermitted":False}
        owner.write_json(HERE/"SERIAL-SOURCE-VALIDATION-r3.json",result)
        print(json.dumps(result),flush=True)
        return
    require(args.parent_released_window and args.driver_sha256==sha(__file__) and
            args.plan_sha256==sha(plan_path),"root release and exact driver/plan pins required")
    require(args.attempt_name is not None and re.fullmatch(r"[a-z0-9][a-z0-9-]{1,63}",args.attempt_name),
            "explicit ordinary batch attempt name required")
    destination=owner.ordinary_owned(HERE/"execution"/args.attempt_name,directory=True,allow_missing=True)
    require(not os.path.lexists(destination),"existing/dangling batch evidence preserved")
    destination.mkdir(parents=True)
    owner.ordinary_owned(destination,directory=True)
    frozen_plan_sha=sha(plan_path)
    terminal={"status":"serial-in-progress","driver":pin(__file__),"plan":pin(plan_path),
              "fullLinkPermitted":False,"steps":[],"completedIndices":[],"verifiedPreviousIndices":[]}
    current_child=None
    try:
        for row in plan["commands"]:
            require(pin(__file__)==plan["driver"] and sha(plan_path)==frozen_plan_sha,
                    "immutable serial transport changed; stop before next owner")
            index=row["index"]
            receipt=owner.receipt_file(full,index)
            if os.path.lexists(receipt):
                owner.verify_receipt(full,index,cpp2,records,bridge,packet)
                terminal["verifiedPreviousIndices"].append(index)
                print(json.dumps({"index":index,"status":"existing-genuine-receipt-verified-no-rerun"}),flush=True)
                continue
            native_attempt=HERE/"execution"/row["argv"][-1]
            require(not os.path.lexists(native_attempt),"untouched source-owner attempt required")
            output_names=[destination/("%03d.source-owner.%s.log"%(index,stream)) for stream in ("stdout","stderr")]
            for file in output_names:
                owner.fresh_owned_file(file)
            step={"index":index,"argv":row["argv"],"cwd":row["cwd"],"sourceOwnerSDKOnly":True,
                  "rawOutputFiles":[str(file) for file in output_names]}
            terminal["steps"].append(step)
            interrupted=False
            with output_names[0].open("xb") as stdout,output_names[1].open("xb") as stderr:
                current_child=subprocess.Popen(row["argv"],cwd=row["cwd"],stdout=stdout,stderr=stderr,
                                               stdin=subprocess.DEVNULL,shell=False)
                step["sourceOwnerPID"]=current_child.pid
                try:
                    step["sourceOwnerCreationFILETIMEDecimal"]=creation_filetime(current_child._handle)
                except BaseException:
                    # Do not kill by name or race an owner. Wait for its fixed guard/cleanup to finish.
                    while current_child.poll() is None:
                        try:
                            current_child.wait()
                        except KeyboardInterrupt:
                            interrupted=True
                    raise
                while True:
                    try:
                        exit_code=current_child.wait()
                        break
                    except KeyboardInterrupt:
                        interrupted=True
                step["sourceOwnerExitCode"]=exit_code
                current_child._handle.Close()
                step["sourceOwnerHandleClosed"]=True
                current_child=None
            step["rawOutputPins"]=[pin(file) for file in output_names]
            step["interruptionObserved"]=interrupted
            require(pin(__file__)==plan["driver"] and sha(plan_path)==frozen_plan_sha,
                    "immutable serial transport changed after source owner")
            require(exit_code==0,"source-owner nonzero; stop without retry")
            require(os.path.lexists(receipt),"no genuine success receipt; stop on no-fit/browser-priority/failure")
            owner.verify_receipt(full,index,cpp2,records,bridge,packet)
            step["receipt"]=pin(receipt)
            step["status"]="genuine-original-tuple-compile-passed-and-closed"
            write_new(destination/("%03d.serial-step.json"%index),step)
            terminal["completedIndices"].append(index)
            print(json.dumps({"index":index,"status":step["status"],"receipt":step["receipt"],
                              "sourceOwnerPID":step["sourceOwnerPID"],
                              "sourceOwnerCreationFILETIMEDecimal":step["sourceOwnerCreationFILETIMEDecimal"]}),flush=True)
            require(not interrupted,"interruption stops further indices after current owner closes")
        terminal["status"]="all-235-genuine-compile-receipts-verified-full-link-unreleased"
    except BaseException as error:
        terminal.update(status="serial-stopped-no-automatic-retry",failure=repr(error))
        raise
    finally:
        if current_child is not None:
            # Only this exact source owner; wait for its bounded native guard and own cleanup.
            while current_child.poll() is None:
                try:
                    current_child.wait()
                except KeyboardInterrupt:
                    pass
            current_child._handle.Close()
            terminal["sourceOwnerClosedAfterStop"]=True
        try:
            for step in terminal["steps"]:
                step["rawOutputPins"]=[pin(owner.ordinary_owned(file)) for file in step["rawOutputFiles"]
                                      if os.path.lexists(file)]
                step_path=destination/("%03d.serial-step.json"%step["index"])
                if not os.path.lexists(step_path):
                    write_new(step_path,step)
                else:
                    require(json.loads(owner.ordinary_owned(step_path).read_bytes())==step,
                            "existing serial step content differs")
        except BaseException as error:
            terminal.update(status="serial-failed-evidence-archive",archiveFailure=repr(error))
        try:
            write_new(destination/"terminal.json",terminal)
        except BaseException as error:
            terminal.update(status="serial-failed-terminal-write",terminalWriteFailure=repr(error))
            print(json.dumps(terminal),flush=True)
            raise
        print(json.dumps({"status":terminal["status"],"completedIndices":terminal["completedIndices"],
                          "fullLinkPermitted":False,"failure":terminal.get("failure")}),flush=True)

if __name__=="__main__":
    main()
