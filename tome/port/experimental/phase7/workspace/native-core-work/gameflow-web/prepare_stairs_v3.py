"""Exact additive source-only witness candidate; historical proofs stay intact."""
import hashlib,json,pathlib
root=pathlib.Path(__file__).resolve().parent
def digest(data):return hashlib.sha256(data).hexdigest()
def derive(name,out,replacements):
 raw=(root/name).read_bytes();text=raw.decode('utf-8');old=text
 for before,after in replacements:
  assert text.count(before)==1,(name,before)
  text=text.replace(before,after,1)
 check=text
 for before,after in reversed(replacements):
  assert check.count(after)==1
  check=check.replace(after,before,1)
 assert check.encode('utf-8')==raw
 body=text.encode('utf-8');(root/out).write_bytes(body)
 return {'input':name,'input_sha256':digest(raw),'output':out,'output_sha256':digest(body),'reversal_exact_bytes':True,'replacements':len(replacements)}
oracle="window.__tomeStairTextEvents=[];window.addEventListener('keypress',event=>{if(window.__tomeStairTextEvents.length<16)window.__tomeStairTextEvents.push({type:event.type,key:event.key,code:event.code,charCode:event.charCode,trusted:event.isTrusted});},{capture:true,passive:true});"
rows=[derive('server.mjs','stairs-server.mjs',[(" const keyOracle=\"window.__tomeRoadEvents=[];"," const keyOracle=\""+oracle+"window.__tomeRoadEvents=[];")])]
late="  await evaluate(`window.__tomeStairTextEvents=[];window.addEventListener('keypress',e=>{if(window.__tomeStairTextEvents.length<16)window.__tomeStairTextEvents.push({type:e.type,key:e.key,code:e.code,charCode:e.charCode,trusted:e.isTrusted});},true)`);"
rows.append(derive('spawn-exit-scenario.mjs','spawn-exit-scenario-v3.mjs',[
 (late,"  check('passive text oracle exists before owner listeners',await evaluate('Array.isArray(window.__tomeStairTextEvents)'));"),
 ("(endCalls.tome_physical_text||0)>(startCalls.tome_physical_text||0),{text_events:result.text_events}","(endCalls.tome_physical_text||0)===(startCalls.tome_physical_text||0)+1&&result.text_events.length===1&&result.text_events[0].trusted===true&&result.text_events[0].charCode===60&&result.text_events[0].key==='<', {text_events:result.text_events}"),
 ("'same original player survives genuine transition',after.player.identity===before.player.identity&&after.player.uid===before.player.uid&&after.player.name===before.player.name&&after.player.life===before.player.life&&after.player.level===before.player.level&&after.trace_sequence===before.trace_sequence","'same valid player UID and descriptors survive genuine transition',Number.isInteger(before.player.uid)&&before.player.uid>0&&after.player.uid===before.player.uid&&after.player.name===before.player.name&&after.player.life===before.player.life&&after.player.level===before.player.level&&JSON.stringify(after.player.descriptor)===JSON.stringify(before.player.descriptor)&&after.player.death_count===before.player.death_count&&after.trace_sequence===before.trace_sequence")]))
(root/'STAIRS-V3-PROVENANCE.json').write_text(json.dumps({'schema_version':1,'actual_browser_verified':False,'source_only':True,'files':rows,'unknown_player_pointer_identity':True,'same_player_check':'valid original UID, descriptors, life, level, death count and external name'},indent=2)+'\n',encoding='utf-8')
print(json.dumps(rows))
