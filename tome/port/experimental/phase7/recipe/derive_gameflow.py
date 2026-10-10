"""Pure text/data derivation of the exact current original gameflow responses.

No game/server imports, process launches, writes, simulation or RNG calls.
Sources are preserved as raw UTF8 bytes, including original CRLF.
"""
import json
from pathlib import Path


def derive_gameflow(work):
    work = Path(work)
    physical = work / "rust-platform-input-work"
    def text(path):
        return path.read_bytes().decode("utf-8")
    def exact(source, before, after):
        if source.count(before) != 1:
            raise ValueError("Reviewed gameflow source anchor mismatch: " + before)
        return source.replace(before, after, 1)
    html = text(physical / "integration-web/physical-play-browser.html")
    html = html.replace("#original", "#canvas")
    html = exact(html, 'id="original"', 'id="canvas"')
    script = text(physical / "integration-web/physical-play-browser.mjs")
    script = exact(script, "import nativeFactory from '/native/tome-native.mjs';",
                   "import nativeFactory from '/native/tome-native.mjs';\nimport {prepareFreshNativeCanvas,readNativeDisplayContract} from '/physical/native-canvas-contract.mjs';\nimport {NativeTextboxFixture,installNativeTextboxFixture,settlePendingOriginalFocus} from '/textbox/native-textbox-fixture.mjs';\nimport {installNativeGameFlowObserver,NativeGameFlowProbe} from '/game-flow/native-game-flow-probe.mjs';\nlet flowInstallation,flowProbe;")
    script = exact(script, "canvas=document.querySelector('#original');", "canvas=document.querySelector('#canvas');\nconst canvasLease=prepareFreshNativeCanvas(canvas,{freshDocument:true});")
    script = exact(script, "      module.ccall=(name,...args)=>{", "      module.ccall=(name,...args)=>{\n        if(name==='tome_native_init')canvasLease.beforeNativeInit(module);")
    script = exact(script, "    beforeStart:({module})=>{", "    beforeStart:async ({module})=>{\n      await installNativeTextboxFixture(module,'/textbox/native-textbox-fixture.lua');")
    prepare = "      report.physical_prepare=physicalOwner.prepare();"
    script = exact(script, prepare, prepare + "\n      const flowProvenance=await fetchJson('/game-flow/observer-provenance.json');\n      flowInstallation=await installNativeGameFlowObserver(module,'/game-flow/visible-flow-observer.lua',flowProvenance.derivative_sha256);\n      report.planar_compat_install=module.ccall('tome_planar_client_array_refresh_install','number',[],[]);\n      if(report.planar_compat_install!==1)throw Error('render.error.client_array_contract');")
    probe = "    raw,rng,calls:()=>({...nativeCalls}),gateExclusion:()=>physicalOwner.gateExclusion(save)};"
    script = exact(script, probe, "    displayContract:()=>readNativeDisplayContract(native),planarCompat:()=>JSON.parse(native.ccall('tome_planar_client_array_refresh_status','string',[],[])),\n" + probe)
    host = text(physical / "audit-new/pointer-dispatch-candidate/serialized-pointer-host.mjs")
    for before, after in [
        ("from '../../browser/focused-input-host.mjs'", "from '/physical/focused-input-host-base.mjs'"),
        ("from '../../browser/physical-input-wasm.mjs'", "from '/physical/physical-input-wasm.mjs'"),
        ("from '../resize-candidate/native-canvas-contract.mjs'", "from '/physical/native-canvas-contract.mjs'"),
    ]:
        host = exact(host, before, after)
    owner = text(physical / "integration-web/physical-play-owner.mjs")
    owner = exact(owner, "import {FocusedInputHost} from '/physical/focused-input-host.mjs';", "import {SerializedPointerHost as FocusedInputHost} from '/physical/focused-input-host.mjs';")
    owner = exact(owner, "keys.length!==31", "keys.length!==54")
    owner = exact(owner, "    this.claimed=this.host.start();", "    this.host.completedOriginalFrame();\n    this.claimed=this.host.start();")
    start = "  await physicalOwner.start();report.physical_claim=copy(physicalOwner.claimed);"
    script = exact(script, start, "  observeGate();originalVisualFrame();\n" + start)
    script = exact(script, "  observeGate();originalVisualFrame();\n  checkedPresentation(await session.dispatch({op:'snapshot'}).completion);", "  observeGate();\n  checkedPresentation(await session.dispatch({op:'snapshot'}).completion);")
    script = exact(script, start, start + "\n  report.initial_focus_settlement=await settlePendingOriginalFocus(physicalOwner.original);\n  originalVisualFrame();physicalOwner.host.completedOriginalFrame();\n  flowProbe=new NativeGameFlowProbe({module:native,original:physicalOwner.original,ownerDiagnostic:()=>physicalOwner.diagnostic(),canObserve:()=>mayRead(),installation:flowInstallation});\n  report.game_flow_installation=flowProbe.attachAfterBirth();\n  window.tomeGameFlowProbe=flowProbe.readOnlyFacade();")
    script = exact(script, "  canvas.focus();", "  const textboxLabels=await fetchJson('/textbox/i18n/ja.json');\n  const textbox=new NativeTextboxFixture({module:native,inputHost:physicalOwner.host,original:physicalOwner.original,\n    onOriginalFrame:async status=>{await physicalOwner.onSettled(status);physicalOwner.host.completedOriginalFrame();}});\n  window.tomeTextboxProbe={open:initial=>{canvas.focus({preventScroll:true});return textbox.open(initial,{title:textboxLabels['textbox.fixture.title'],field:textboxLabels['textbox.fixture.field'],cancel:textboxLabels['textbox.fixture.cancel']});},\n    close:()=>textbox.close(),status:()=>textbox.status(),focusStatus:()=>textbox.focus(),display:()=>readNativeDisplayContract(native),\n    installation:()=>({installed_pre_start:true}),inputHost:()=>physicalOwner.diagnostic(),physical:()=>physicalOwner.status()};\n  canvas.focus();")
    key_oracle = "window.__tomeRoadEvents=[];for(const kind of ['keydown','keyup'])window.addEventListener(kind,event=>{if(window.__tomeRoadEvents.length<64)window.__tomeRoadEvents.push({type:event.type,key:event.key,code:event.code,trusted:event.isTrusted,composing:event.isComposing,target_id:event.target?.id||null});},{capture:true,passive:true});"
    script = exact(script, start, key_oracle + "\n" + start)
    result = {
        "/physical-play-browser.html": html.encode("utf-8"),
        "/play-browser.html": html.encode("utf-8"),
        "/physical-play-browser.mjs": script.encode("utf-8"),
        "/play-browser.mjs": script.encode("utf-8"),
        "/physical/focused-input-host.mjs": host.encode("utf-8"),
        "/physical/physical-play-owner.mjs": owner.encode("utf-8"),
    }
    for locale in ("en", "ja"):
        base = json.loads(text(physical / "i18n" / (locale + ".json")))
        delta = {}
        for group in ("resize-candidate", "pointer-dispatch-candidate", "textbox-native-candidate"):
            delta.update(json.loads(text(physical / "audit-new" / group / (locale + ".json"))))
        if len(base) != 31 or len(delta) != 23 or set(base).intersection(delta):
            raise ValueError("Exact gameflow physical54-label contract changed")
        if any(key.isdecimal() for key in base | delta):
            raise ValueError("Unexpected integer JSON key needs JS-order review")
        result["/physical/i18n/" + locale + ".json"] = json.dumps(base | delta, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return result
