"""Reversible observer-only hooks in genuine native map geometry emission.

No C/Lua execution. No original draw/callback/FOV algorithm is replaced.
"""
import argparse
import hashlib
import json
from pathlib import Path

HERE=Path(__file__).resolve().parent
UPSTREAM=Path(r"C:\Users\kit\gameme\jnethack\jrouge\tome\upstream\t-engine4-src-1.7.6")
ORIGINAL_SHA="7b0a56f096faad003551da02e7073948c390cf5fc6c646ac594855881ee69917"
def sha(data): return hashlib.sha256(data).hexdigest()
changes=[]
def change(data,old,new,label,start=None,end=None):
    old,new=old.encode(),new.encode()
    a=data.index(start.encode()) if start else 0
    b=data.index(end.encode(),a) if end else len(data)
    part=data[a:b]
    if part.count(old)!=1: raise ValueError(label+": original anchor changed")
    changes.append({"label":label,"original":old.decode(),"replacement":new.decode()})
    return data[:a]+part.replace(old,new,1)+data[b:]
def transform(data,exact=True):
    changes.clear()
    if exact and sha(data)!=ORIGINAL_SHA: raise ValueError("Original native map hash changed")
    data=change(data,'#include "assert.h"','#include "assert.h"\n#include "tome_prepared_map_capture.h"',"capture declarations")
    # Every invocation has original local map/vertices/texcoords/colors in scope.
    old='\tif ((vert)) glDrawArrays(GL_TRIANGLES, 0, (vert) / 2); \\'
    new='\tif ((vert)) { tome_prepared_map_batch(map, (vert) / 2, vertices, texcoords, colors); glDrawArrays(GL_TRIANGLES, 0, (vert) / 2); } \\'
    data=change(data,old,new,"copy exact scratch batch immediately before original GL draw")
    start,end='void do_quad(','inline void display_map_quad('
    data=change(data,'\t(*vert_idx) += 2 * 6;','\ttome_prepared_map_quad(map, *vert_idx, i, j);\n\t(*vert_idx) += 2 * 6;',"record real per-quad source layer/cell",start,end)
    data=change(data,'\t\tuseNoShader();\n\t\tlua_rawgeti(L, LUA_REGISTRYINDEX, dm->cb_ref);','\t\ttome_prepared_map_event(map, TOME_MAP_OBJECT_CALLBACK_BEGIN);\n\t\tuseNoShader();\n\t\tlua_rawgeti(L, LUA_REGISTRYINDEX, dm->cb_ref);',"object callback entry ledger",start,end)
    data=change(data,'\t\t\tprintf("Display callback error: UID %ld: %s\\n", dm->uid, lua_tostring(L, -1));','\t\t\ttome_prepared_map_error(map);\n\t\t\tprintf("Display callback error: UID %ld: %s\\n", dm->uid, lua_tostring(L, -1));',"observe original object callback error",start,end)
    data=change(data,'\t\tif (lua_isboolean(L, -1)) {','\t\ttome_prepared_map_event(map, TOME_MAP_OBJECT_CALLBACK_END);\n\t\tif (lua_isboolean(L, -1)) {',"object callback returned ledger",start,end)
    start,end='static int map_to_screen(','extern int gl_tex_white;'
    data=change(data,'\tint my = map->my;','\tint my = map->my;\n\ttome_prepared_map_enter(L, map, nb_keyframes);',"one original native map entry",start,end)
    data=change(data,'\tfor (z = 0; z < map->zdepth; z++)\n\t{','\tfor (z = 0; z < map->zdepth; z++)\n\t{\n\t\ttome_prepared_map_layer(map, z);',"retain actual selected mode layer order",start,end)
    data=change(data,'\t\t\tlua_rawgeti(L, LUA_REGISTRYINDEX, map->z_callbacks[z]);','\t\t\ttome_prepared_map_event(map, TOME_MAP_Z_CALLBACK_BEGIN);\n\t\t\tlua_rawgeti(L, LUA_REGISTRYINDEX, map->z_callbacks[z]);',"z callback entry ledger",start,end)
    data=change(data,'\t\t\t\tprintf("Map z-callback error: Z %d: %s\\n", z, lua_tostring(L, -1));','\t\t\t\ttome_prepared_map_error(map);\n\t\t\t\tprintf("Map z-callback error: Z %d: %s\\n", z, lua_tostring(L, -1));',"observe original z callback error",start,end)
    data=change(data,'\t\t\tif (lua_isboolean(L, -1)) {','\t\t\ttome_prepared_map_event(map, TOME_MAP_Z_CALLBACK_END);\n\t\t\tif (lua_isboolean(L, -1)) {',"z callback returned ledger",start,end)
    data=change(data,'\tif (always_show && changed)\n\t{','\tif (always_show && changed)\n\t{\n\t\ttome_prepared_map_event(map, TOME_MAP_NATIVE_FOV_BEGIN);',"native-tail FOV source slot ledger",start,end)
    data=change(data,'\t\tmap->seen_changed = FALSE;','\t\tmap->seen_changed = FALSE;\n\t\ttome_prepared_map_event(map, TOME_MAP_NATIVE_FOV_END);',"original native-tail FOV completion ledger",start,end)
    data=change(data,'\treturn 0;','\ttome_prepared_map_leave(map);\n\treturn 0;',"copy actual last seen texture and close native map slot",start,end)
    data=change(data,'\tint i, j;','\ttome_prepared_map_closed(map);\n\tint i, j;',"observe actual native map close",'static int map_free(','static int map_define_grid_lines(')
    data=change(data,'static const struct luaL_Reg map_reg[] =\n{','static const struct luaL_Reg map_reg[] =\n{\n\t{"webPreparedBegin", tome_prepared_map_begin_lua},\n\t{"webPreparedSeal", tome_prepared_map_seal_lua},\n\t{"webPreparedStatus", tome_prepared_map_status_lua},\n\t{"webPreparedAbort", tome_prepared_map_abort_lua},\n\t{"webPreparedBytes", tome_prepared_map_bytes_lua},',"additive original native-map packet lifecycle API")
    return data
def reverse(data,recipes):
    for item in reversed(recipes):
        old,new=item["original"].encode(),item["replacement"].encode()
        if data.count(new)!=1: raise ValueError("Reverse anchor changed: "+item["label"])
        data=data.replace(new,old,1)
    return data
def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input',type=Path,help='Parent-composed native source; check exact observer anchors, preserve/reverse its bytes')
    args=parser.parse_args()
    original=(args.input or UPSTREAM/'src/map.c').read_bytes()
    generated=transform(original,not bool(args.input))
    assert reverse(generated,changes)==original
    p=HERE/'generated/map_capture.c';p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(generated)
    report={"version":"1.7.6","original":"src/map.c","original_sha256":ORIGINAL_SHA,
        "input_sha256":sha(original),"input_bytes":len(original),"generated_sha256":sha(generated),
        "generated_bytes":len(generated),"reversal_recovers_input_bytes":True,"changes":changes,
        "validation":"Static source generation only; no compiler/native/browser execution"}
    (HERE/'map-capture-provenance.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({k:v for k,v in report.items() if k!='changes'}))
if __name__=='__main__': main()
