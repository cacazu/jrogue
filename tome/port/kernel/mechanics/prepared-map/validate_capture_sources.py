"""Read-only source/format checks. Does not compile or execute original C/Lua."""
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import zipfile
HERE=Path(__file__).resolve().parent
UPSTREAM=Path(r"C:\Users\kit\gameme\jnethack\jrouge\tome\upstream\t-engine4-src-1.7.6")
def sha(data): return hashlib.sha256(data).hexdigest()
def main():
    spec=importlib.util.spec_from_file_location('observer_generator',HERE/'make_map_capture_overlay.py')
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    original=(UPSTREAM/'src/map.c').read_bytes()
    actual=(HERE/'generated/map_capture.c').read_bytes()
    assert sha(original)==module.ORIGINAL_SHA
    assert actual==module.transform(original)
    assert module.reverse(actual,module.changes)==original
    provenance=json.loads((HERE/'map-capture-provenance.json').read_text(encoding='utf-8'))
    assert provenance['generated_sha256']==sha(actual)
    assert len(module.changes)==len(provenance['changes'])
    c=(HERE/'tome_prepared_map_capture.c').read_text(encoding='utf-8')
    lua=(HERE/'original-map-packet.lua').read_text(encoding='utf-8')
    bridge=(HERE/'native_prepared_map_exports.c').read_text(encoding='utf-8')
    assert 'capture.flags=TOME_MAP_RESOURCE_LEASES_MISSING|TOME_MAP_GL_STATE_PARTIAL' in c
    assert 'tome_web_checkpoint_busy()' in c and 'tome_web_checkpoint_busy()' in bridge
    assert 'full_renderer_ready=false' in lua
    assert not re.search(r'(?:rng\.|math\.random|updateFOV\(|canSee\(|:display\(|:tick\()',lua)
    start=c.index('const unsigned char *tome_prepared_map_packet(')
    end=c.index('int tome_prepared_map_bytes_lua(',start)
    getter=c[start:end]
    assert not any(word in getter for word in ['lua_call','lua_pcall','glGet','rng','map->'])
    exports=re.findall(r'EMSCRIPTEN_KEEPALIVE (?:const char \*|const unsigned char \*|int |unsigned )(tome_native_prepared_map_[a-z_]+)\(',bridge)
    assert len(exports)==8 and len(set(exports))==8
    schema=json.loads((HERE/'packet-schema.json').read_text(encoding='utf-8'))
    assert schema['packet_header_bytes']==64 and schema['event_prefix_bytes']==16 and schema['batch']['fixed_payload_bytes']==216
    assert 16+216+32*6+12==436  # Actual six-vertex single quad batch.
    audit=json.loads((HERE/'lua-read-audit/source-evidence.json').read_text(encoding='utf-8'))
    originals={}
    excerpt_lines=0
    for member in audit['members']:
        archive=UPSTREAM/('game/modules/tome-1.7.6.team' if member['archive']=='tome' else 'game/engines/te4-1.7.6.teae')
        with zipfile.ZipFile(archive) as z: content=z.read(member['path'])
        assert sha(content)==member['member_sha256']
        lines=content.decode('utf-8').splitlines()
        for excerpt in member['excerpts']:
            assert lines[excerpt['start_line']-1:excerpt['end_line']]==excerpt['lines']
            excerpt_lines+=len(excerpt['lines'])
        originals[member['path']]=sha(content)
    for name in ['src/map.c','src/map.h','src/tgl.h','src/useshader.h']:
        originals[name]=sha((UPSTREAM/name).read_bytes())
    files={}
    for p in HERE.rglob('*'):
        if p.is_file() and '__pycache__' not in p.parts and p.name!='source-validation.json':
            files[str(p.relative_to(HERE)).replace('\\','/')]=dict(bytes=p.stat().st_size,sha256=sha(p.read_bytes()))
    result=dict(mode='static_source_only',original_map_sha256=sha(original),generated_map_sha256=sha(actual),
        original_map_bytes=len(original),generated_map_bytes=len(actual),reversible_observer_changes=len(module.changes),
        original_members=originals,verified_lua_excerpt_lines=excerpt_lines,native_exports=exports,
        full_renderer_ready=False,files=files,not_executed=['compiler/linker','Lua/native runtime','browser','GL query support','real packet byte validation','Rust replay','state/RNG purity'])
    (HERE/'source-validation.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({k:v for k,v in result.items() if k not in ('original_members','files')}))
if __name__=='__main__':main()
