"""Derive only the isolated physical browser sources; never run/build the game."""
from pathlib import Path
import hashlib
import json

HERE=Path(__file__).resolve().parent
WORK=HERE.parent.parent
def sha(data):return hashlib.sha256(data).hexdigest()
def replace_once(text,old,new,label):
    if text.count(old)!=1:raise ValueError("Changed tested source anchor: "+label)
    return text.replace(old,new,1)

def main():
    sources={name:(WORK/"bootstrap-work"/name).read_bytes() for name in ("play-browser.html","play-browser.mjs")}
    html=sources["play-browser.html"].decode("utf-8").replace("\r\n","\n")
    html=replace_once(html,'<script type="module" src="/play-browser.mjs"></script>',
        '<script type="module" src="/physical-play-browser.mjs"></script>',"module URL")
    html=replace_once(html,'<details>','''<p data-physical-text-id="input.ui.scope"></p>
<div id="physical-text-row" hidden><label for="physical-text" data-physical-text-id="input.ui.text_input"></label>
<textarea id="physical-text" rows="2" autocomplete="off" spellcheck="false"></textarea>
<span data-physical-text-id="input.ui.preedit"></span><output id="physical-preedit"></output></div>
<button id="physical-focus" data-physical-text-id="input.ui.focus_canvas"></button>
<details>''',"explicit native text proxy")
    js=sources["play-browser.mjs"].decode("utf-8").replace("\r\n","\n")
    js=replace_once(js,"import {saveBaselineCheckpoint} from '/checkpoint/baseline_flow.mjs';",
        "import {saveBaselineCheckpoint} from '/checkpoint/baseline_flow.mjs';\nimport {PhysicalPlayOwner} from '/physical/physical-play-owner.mjs';","physical import")
    js=replace_once(js,"let session,native,vfs,store,resolver,lastPresentation,lastSave;",
        "let session,native,vfs,store,resolver,lastPresentation,lastSave,physicalOwner;","owner state")
    js=replace_once(js,"mode:'fresh_japanese_original_core_increment'","mode:'isolated_original_physical_input_candidate'","candidate report")
    js=replace_once(js,"return report.passed&&!operation&&!nativeGate&&!session?.failure&&",
        "return report.passed&&!operation&&!nativeGate&&!physicalOwner?.busy&&!physicalOwner?.failed&&!session?.failure&&","single physical/native gate")
    js=replace_once(js,"async function save(){\n  if(!mayOperate()", "async function save(){\n  await physicalOwner.suspendAndDrain();\n  if(!mayOperate()","input drain before save")
    js=replace_once(js,"onStatus:value=>{report.save_operation=copy(value);compactDiagnostics();}",
        "onStatus:value=>{report.save_operation=copy(value);physicalOwner.samplePhysicalWhileSave(value);compactDiagnostics();}","held save probe hook")
    js=replace_once(js,"operation=null;observeGate();present(lastPresentation);\n  }\n}\nasync function purity()",
        "operation=null;observeGate();if(!nativeGate&&!physicalOwner.failed)physicalOwner.resume();present(lastPresentation);\n  }\n}\nasync function purity()","resume input after actual gate release")
    js=replace_once(js,"beforeStart:({module})=>{",'''beforeStart:({module})=>{
      physicalOwner=new PhysicalPlayOwner({module,canvas,textTarget:document.querySelector('#physical-text'),snapshot:raw,rng,
        onStatus:value=>{report.physical_status=copy(value);if(value.busy&&operation===null)operation='physical';},
        onSettled:async value=>{
          originalVisualFrame();checkedPresentation(await session.dispatch({op:'snapshot'}).completion);observeLocalization();
          report.physical_last_settled=copy(value);
        },onIdle:()=>{if(operation==='physical')operation=null;if(lastPresentation)present(lastPresentation);},
        onError:error=>{report.physical_error={id:error.textId||error.message,status:error.status};
          print(physicalOwner.label(error.textId||error.message));session.fail(error);}});
      report.physical_prepare=physicalOwner.prepare();''',"prepare after init before actual original start")
    js=replace_once(js,"observeGate();originalVisualFrame();\n  checkedPresentation(await session.dispatch({op:'snapshot'}).completion);",
        "await physicalOwner.start();report.physical_claim=copy(physicalOwner.claimed);\n  observeGate();originalVisualFrame();\n  checkedPresentation(await session.dispatch({op:'snapshot'}).completion);","host after actual original start")
    js=replace_once(js,"session.bindControls({keyTarget:window,controlsRoot:root,ownHandledInput:true,",
        "session.bindControls({keyTarget:null,controlsRoot:root,ownHandledInput:true,","disable previous virtual keyboard owner")
    js=replace_once(js,"request?.op==='snapshot'?mayRead():mayOperate()});",
        "request?.op==='snapshot'?mayRead():mayOperate()&&physicalOwner.accepting});","serialize optional existing UI control clicks")
    js=replace_once(js,"canvas.focus();\n}catch(error)",'''window.tomePhysicalProbe={status:()=>physicalOwner.status(),backend:()=>physicalOwner.backend(),ui:()=>physicalOwner.ui(),
    diagnostic:()=>physicalOwner.diagnostic(),frameErrors:()=>physicalOwner.frameErrors(),settled:()=>physicalOwner.settled(),focus:()=>canvas.focus({preventScroll:true}),
    raw,rng,calls:()=>({...nativeCalls}),gateExclusion:()=>physicalOwner.gateExclusion(save)};
  canvas.focus();
}catch(error)''',"actual physical probe")
    outputs={"physical-play-browser.html":html.encode("utf-8"),"physical-play-browser.mjs":js.encode("utf-8")}
    for name,data in outputs.items():(HERE/name).write_bytes(data)
    for name,data in sources.items():
        if (WORK/"bootstrap-work"/name).read_bytes()!=data:raise RuntimeError("Frozen input changed during derivation")
    provenance={"schema":1,"source_only":True,"original_gameplay_rewritten":False,"default_delivery_changed":False,
        "sources":[{"path":"bootstrap-work/"+name,"sha256":sha(data),"bytes":len(data)} for name,data in sources.items()],
        "derived":[{"path":name,"sha256":sha(data),"bytes":len(data)} for name,data in outputs.items()],
        "changes":["normalize derivative CRLF to LF","prepare at actual beforeStart seam","FocusedInputHost after original birth","disable old window virtual-key owner",
          "single physical/native action gate","drain before full save and resume after gate release","readonly backend/menu probes and actual exclusion attempts",
          "explicit original text proxy and existing 31-ID EN/JA catalogs"],"runtime_execution":"Not performed by source generation"}
    (HERE/"source-provenance.json").write_text(json.dumps(provenance,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(provenance))

if __name__=="__main__":main()
