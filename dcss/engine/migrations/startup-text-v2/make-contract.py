"""Finalize an independently reviewed v2 source specification with new Rust pins.

Only source/receipt construction; no baseline scan, compiler, packager or engine.
An explicit reviewed specification hash, recipe hash and new boundary pins are
required. Input source/catalog hashes are checked, never inferred or blessed.
"""
from pathlib import Path
import argparse
import json
import candidate_common as common
from candidate_common import base

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--spec',type=Path,required=True)
    parser.add_argument('--spec-sha256',required=True)
    parser.add_argument('--recipe-sha256',required=True)
    parser.add_argument('--boundary-sha256',required=True)
    parser.add_argument('--boundary-bytes',type=int,required=True)
    parser.add_argument('--patch',type=Path,required=True)
    parser.add_argument('--assets-root',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args()
    spec=args.spec.resolve()
    base.require_hash(spec,common.require_sha(args.spec_sha256))
    recipe=common.require_sha(args.recipe_sha256)
    if recipe!=common.recipe_digest():raise ValueError('Reviewed recipe source bundle drift')
    boundary=common.require_sha(args.boundary_sha256)
    if args.boundary_bytes<=0:raise ValueError('New Rust boundary byte count must be positive')
    contract=common.load_json(spec)
    if (contract.get('schema_version')!=2 or contract.get('source')!='startup-text-v2'
        or contract.get('upstream')!=base.PIN or contract.get('recipe_version')!=2
        or contract.get('recipe_sha256') is not None):
        raise ValueError('Only the independently reviewed pending text-v2 specification is accepted')
    contract['recipe_sha256']=recipe
    startup=contract['startup_text']
    if startup.get('boundary_sha256') is not None or startup.get('boundary_bytes') is not None:
        raise ValueError('Pending specification must explicitly reserve the new Rust boundary pins')
    startup['boundary_sha256']=boundary;startup['boundary_bytes']=args.boundary_bytes
    assets=contract['assets']
    matches=[entry for entry in assets if entry['path']=='build/boundary.wasm']
    if len(matches)!=1 or matches[0].get('sha256') is not None or matches[0].get('bytes') is not None:
        raise ValueError('Exactly one explicit pending Rust artifact receipt is required')
    matches[0]['sha256']=boundary;matches[0]['bytes']=args.boundary_bytes
    patch=args.patch.resolve();asset_root=args.assets_root.resolve()
    for entry in contract['overrides']:common.checked_file(patch,entry['transformed'])
    for name in ('library','formatter','source_receipts'):common.checked_file(patch,contract[name])
    for entry in assets:common.checked_file(asset_root,entry)
    output=args.output.resolve()
    if output.exists():raise ValueError('Preserve an existing reviewed contract; this tool never overwrites one')
    if not output.parent.is_dir():raise ValueError('Explicit output parent directory must already exist')
    text=json.dumps(contract,indent=2,ensure_ascii=False)+'\n'
    output.write_text(text,encoding='utf-8')
    print(json.dumps({'contract':str(output),'sha256':base.digest(output),
        'spec_sha256':args.spec_sha256,'recipe_sha256':recipe,
        'boundary_sha256':boundary,'boundary_bytes':args.boundary_bytes,
        'operation':'source-only receipt construction; candidate preflight remains required'},indent=2))

if __name__=='__main__':main()
