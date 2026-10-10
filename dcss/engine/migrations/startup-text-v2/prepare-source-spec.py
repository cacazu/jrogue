"""Build a pending contract spec from a pinned reviewed text-v2 union receipt.

Source-only construction. Pins come from the independently reviewed receipt;
only byte counts are measured. No compiler, package or game is run.
"""
from pathlib import Path
import argparse
import copy
import json
import candidate_common as common
from candidate_common import base

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--patch',type=Path,required=True)
    parser.add_argument('--receipt-sha256',required=True)
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args()
    patch=args.patch.resolve()
    receipt_file=common.regular(patch,'source-receipts.json')
    base.require_hash(receipt_file,common.require_sha(args.receipt_sha256))
    receipt=common.load_json(receipt_file)
    if receipt.get('schema_version')!=2 or receipt.get('source_only') is not True:
        raise ValueError('Only the reviewed source-only v2 union receipt is accepted')
    startup=copy.deepcopy(receipt['startup_text'])
    if startup.get('source')!='startup-text-v2' or startup.get('upstream')!=base.PIN:
        raise ValueError('Source/commit mismatch in reviewed union receipt')
    files={entry['path']:entry for entry in receipt['files']}
    if len(files)!=len(receipt['files']):raise ValueError('Duplicate reviewed source file')
    def file_record(path,sha):
        source=common.regular(patch,path)
        base.require_hash(source,common.require_sha(sha))
        return {'path':path,**base.receipt(source)}
    overrides=[]
    for entry in receipt['native_overrides']:
        index=entry['object_index']
        if index not in common.ALLOWED_OVERRIDES:raise ValueError('Unreviewed native override index')
        name,old_sha=common.ALLOWED_OVERRIDES[index]
        if entry['native_path']!='crawl-ref/source/'+name or entry['original_sha256']!=old_sha:
            raise ValueError('Native source identity mismatch')
        transformed=file_record('engine/'+name,entry['final_sha256'])
        if files['engine/'+name]['sha256']!=transformed['sha256']:
            raise ValueError('Source file and override pins disagree')
        boundaries=[item for item in startup['source_boundaries'] if item.get('source')==base.NATIVE_SOURCE+'/'+name]
        if not boundaries:raise ValueError('Canonical source boundary metadata is missing')
        ids=[id for id in startup['ids'] if any(id in item['ids'] for item in boundaries)]
        actions=entry['inverse_actions']
        if not isinstance(actions,list):raise ValueError('Consolidated source inverses must be an explicit list')
        overrides.append({'index':index,'source':base.NATIVE_SOURCE+'/'+name,'original_sha256':old_sha,
            'transformed':transformed,'inverse_actions':[{key:action[key] for key in ('before','after')} for action in actions],
            'ids':ids,'source_boundaries':boundaries})
    overrides.sort(key=lambda entry:entry['index'])
    library=file_record('engine/library.js',receipt['library']['final_sha256'])
    if receipt['library']['base_sha256']!=base.LIB_BASE_SHA:raise ValueError('Original library base pin drift')
    formatter=file_record('web/startup-text.mjs',files['web/startup-text.mjs']['sha256'])
    assets=[]
    for entry in receipt['assets']:
        path=entry['path']
        if not isinstance(path,str) or not path.startswith('/locales/'):
            raise ValueError('Unexpected reviewed catalog namespace')
        assets.append(file_record(path[1:],entry['sha256']))
    if len({entry['path'] for entry in assets})!=len(assets):raise ValueError('Duplicate catalog asset')
    # Rust pins stay an explicit root-owned gate. The final constructor requires
    # the parent to provide the measured boundary receipt again; formatter pin
    # consistency is checked by build-candidate --check before any heavy work.
    startup['boundary_sha256']=None;startup['boundary_bytes']=None
    assets.insert(0,{'path':'build/boundary.wasm','bytes':None,'sha256':None})
    spec={'schema_version':2,'source':'startup-text-v2','upstream':base.PIN,'recipe_version':2,'recipe_sha256':None,
        'overrides':overrides,'library':library,
        'library_inverse_actions':[{key:action[key] for key in ('before','after')} for action in receipt['library']['inverse_actions']],
        'formatter':formatter,'source_receipts':file_record('source-receipts.json',args.receipt_sha256),
        'assets':assets,'startup_text':startup}
    output=args.output.resolve()
    if output.exists():raise ValueError('Preserve existing pending specification; this tool never overwrites it')
    if not output.parent.is_dir():raise ValueError('Explicit output parent must already exist')
    output.write_text(json.dumps(spec,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    print(json.dumps({'spec':str(output),'sha256':base.digest(output),'receipt_sha256':args.receipt_sha256,
        'ids':len(startup['ids']),'override_indices':[entry['index'] for entry in overrides],
        'operation':'source-only pending spec; Rust pins and full candidate preflight still required'},indent=2))

if __name__=='__main__':main()
