"""Finalize only root-reviewed actual Rust75/formatter90 pins; no build or game.
GPL-3.0-or-later. Pending/source/mock evidence can never finalize this proposal.
"""
from pathlib import Path
import argparse, copy, json
import candidate_common as common
from candidate_common import base

def main():
    p=argparse.ArgumentParser(description=__doc__)
    for name in ('spec','rust-gate','formatter-gate','root','patch','assets-root','sdk','output'):
        p.add_argument('--'+name,type=Path,required=True)
    for name in ('spec-sha256','recipe-sha256','rust-gate-sha256','formatter-gate-sha256'):
        p.add_argument('--'+name,required=True)
    a=p.parse_args()
    base.require_hash(a.spec.resolve(),common.require_sha(a.spec_sha256))
    if common.require_sha(a.recipe_sha256)!=common.recipe_digest():raise ValueError('Explicit reviewed recipe SHA drift')
    c=copy.deepcopy(common.load_json(a.spec.resolve()));common.validate_pending_spec(c)
    if any(c.get(k) is not None for k in ('recipe_sha256','rust_gate','formatter_gate')):
        raise ValueError('Only an explicit pending source specification may be finalized')
    if c.get('cxx11_compatibility') is None:raise ValueError('Pending reviewed C++11 compatibility source')
    for file,sha in ((a.rust_gate,a.rust_gate_sha256),(a.formatter_gate,a.formatter_gate_sha256)):
        base.require_hash(file.resolve(),common.require_sha(sha))
    assets=a.assets_root.resolve()
    boundary={'path':'build/boundary.wasm',**base.receipt(common.regular(assets,'build/boundary.wasm'))}
    if boundary['sha256']==common.OLD_BOUNDARY_SHA:raise ValueError('Old V2 Rust artifact4085 is forbidden')
    formatter={'path':'web/startup-text.mjs',**base.receipt(common.regular(assets,'web/startup-text.mjs'))}
    rust=common.load_json(a.rust_gate.resolve());format_gate=common.load_json(a.formatter_gate.resolve())
    common.validate_rust_gate(rust,boundary)
    common.validate_formatter_gate(format_gate,boundary,c['startup_text']['ids'],formatter)
    c['recipe_sha256']=a.recipe_sha256;c['rust_gate']=rust;c['formatter_gate']=format_gate;c['formatter']=formatter
    for x in c['assets']:
        if x['path']=='build/boundary.wasm':x.update(boundary)
        common.checked_file(assets,x)
    c['startup_text'].update(boundary_sha256=boundary['sha256'],boundary_bytes=boundary['bytes'],bridge_sha256=formatter['sha256'])
    c['formatter_repin_inverse']=common.validate_formatter_repin(common.checked_file(a.patch.resolve(),c['frozen_formatter']),assets/formatter['path'],boundary)
    pin=common.bridge_pin(assets/formatter['path'])
    expected=common.load_json(common.checked_file(a.patch.resolve(),c['frozen_formatter_pin']))
    expected['boundary']={'path':'/build/boundary.wasm','bytes':boundary['bytes'],'sha256':boundary['sha256']}
    if pin!=expected:raise ValueError('The new formatter changes more than the explicitly reviewed boundary repin')
    # Native90 actual VM evidence is mandatory before a final contract exists.
    common.library_file(a.patch.resolve(),c)
    output=a.output.resolve()
    if output.parent!=common.HERE or output.exists():raise ValueError('Create a new final contract in this reviewed source stage only')
    with output.open('x',encoding='utf-8',newline='\n') as f:json.dump(c,f,ensure_ascii=False,indent=2);f.write('\n')
    print(json.dumps({'contract':str(output),'sha256':base.digest(output),'recipe_sha256':a.recipe_sha256,
        'boundary':boundary,'actual_rust_tests':75,'semantic_ids':90,
        'operation':'source-only construction; root must perform explicit build-candidate --check before heavy build'},indent=2))

if __name__=='__main__':main()
