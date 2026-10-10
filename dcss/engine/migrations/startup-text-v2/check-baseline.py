"""Read-only official DCSS source/object/data preflight. Never runs build/game.

Only evidence writes target the adjacent writable staging directory.
"""
from pathlib import Path
import argparse
import json
import time
from candidate_common import base

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root',type=Path,required=True)
    parser.add_argument('--sdk',type=Path,default=Path(r'C:\Users\kit\emsdk'))
    args=parser.parse_args()
    started=time.monotonic()
    manifest=base.validate_native_baseline(args.root.resolve(),args.sdk.resolve())
    report={'operation':'read-only immutable baseline source/object/payload validation',
        'units':manifest['units'],'compiler_fingerprint':manifest['compiler_fingerprint'],
        'manifest_sha256':base.NATIVE_MANIFEST_SHA,'payload_files':1449,
        'official_vault_files':143,'wall_seconds':time.monotonic()-started,'status':'PASS'}
    (Path(__file__).resolve().parent/'BASELINE-PREFLIGHT.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(report,indent=2))

if __name__=='__main__':main()
