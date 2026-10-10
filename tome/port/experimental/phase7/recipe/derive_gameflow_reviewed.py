"""Pure exact body projection for parent-verified corrected road and stairs-v3.

No original server/game imports, process launches, writes, callback or RNG use.
The held derivation is preserved and receives one reviewed passive text oracle.
"""
from derive_gameflow import derive_gameflow

OLD_ORACLE = "window.__tomeRoadEvents=[];for(const kind of ['keydown','keyup'])window.addEventListener(kind,event=>{if(window.__tomeRoadEvents.length<64)window.__tomeRoadEvents.push({type:event.type,key:event.key,code:event.code,trusted:event.isTrusted,composing:event.isComposing,target_id:event.target?.id||null});},{capture:true,passive:true});"
EARLY_TEXT_ORACLE = "window.__tomeStairTextEvents=[];window.addEventListener('keypress',event=>{if(window.__tomeStairTextEvents.length<16)window.__tomeStairTextEvents.push({type:event.type,key:event.key,code:event.code,charCode:event.charCode,trusted:event.isTrusted});},{capture:true,passive:true});"


def derive_gameflow_profiles(work):
    base = derive_gameflow(work)
    updated = dict(base)
    for route in ("/play-browser.mjs", "/physical-play-browser.mjs"):
        text = base[route].decode("utf-8")
        if text.count(OLD_ORACLE) != 1:
            raise ValueError("Exact old passive-key source anchor changed")
        updated[route] = text.replace(OLD_ORACLE, EARLY_TEXT_ORACLE + OLD_ORACLE, 1).encode("utf-8")
    # Cache-corrected server derives from stairs-v3 server. They serve identical
    # script/HTML/owner/host/labels; only explicit Lua/provenance routes differ.
    return {"gameflow": dict(updated), "stairs": dict(updated)}
