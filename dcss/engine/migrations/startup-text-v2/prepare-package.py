"""Derive the v2 packer from the exact reviewed v1 data-only implementation.

Source generation only; never invokes a packager or engine.
"""
from pathlib import Path
import hashlib

HERE = Path(__file__).resolve().parent
original = HERE/'audit/v1-reproduce-font-free-package.py'
assert hashlib.sha256(original.read_bytes()).hexdigest() == 'fd1ab92947f9404f4690091d52b0450c4cc60ae81191850b85815cdd35986252'
source = original.read_text(encoding='utf-8')
source = source[source.index('def main():'):]

def replace(before, after):
    global source
    if source.count(before) != 1:
        raise ValueError('Expected one reviewed package adaptation region: '+before[:80])
    source = source.replace(before, after, 1)

replace("parser.add_argument('--root',type=Path,default=Path(__file__).resolve().parent.parents[2],help='Installed DCSS folder')",
        "parser.add_argument('--root',type=Path,required=True,help='Immutable DCSS baseline folder')")
replace("parser.add_argument('--candidate',type=Path,default=Path('engine/candidates/startup-weapon-reproduced'),help='Exact original or reviewed reproduced candidate beneath engine/candidates')",
        "parser.add_argument('--candidate',type=Path,default=Path('engine/candidates/startup-text-v2'))\n"
        "    parser.add_argument('--patch',type=Path,required=True)\n"
        "    parser.add_argument('--assets-root',type=Path)\n"
        "    parser.add_argument('--contract',type=Path,required=True)\n"
        "    parser.add_argument('--contract-sha256',required=True)\n"
        "    parser.add_argument('--builder-sha256',required=True)")
replace("default=Path(__file__).resolve().parent / 'generated-startup-font-free'",
        "default=Path(__file__).resolve().parent / 'generated-text-v2-font-free'")
replace("if not candidate.is_relative_to(candidates) or candidate==candidates:raise ValueError('Candidate must be a distinct child of engine/candidates')",
        "if candidate != (root/'engine/candidates/startup-text-v2').resolve():raise ValueError('Only the separate reviewed text-v2 candidate is accepted')\n"
        "    patch=args.patch.resolve()\n"
        "    assets=(args.assets_root or root).resolve()\n"
        "    contract_path=args.contract.resolve()\n"
        "    helpers=common.helper_receipts()")
replace("manifest, input_receipt = validate_startup_candidate(root, candidate, sdk)",
        "manifest, input_receipt = common.validate_candidate(root,patch,assets,sdk,contract_path,args.contract_sha256,candidate,args.builder_sha256)")
replace("_, after = validate_startup_candidate(root, candidate, sdk)",
        "_, after = common.validate_candidate(root,patch,assets,sdk,contract_path,args.contract_sha256,candidate,args.builder_sha256)\n"
        "    if common.helper_receipts()!=helpers:raise ValueError('Loaded v2 validation helper changed during packaging')")
replace("'package_helper_sha256': helper_hash,",
        "'package_helper_sha256': helper_hash, 'helper_sources':helpers, 'source_contract_sha256':args.contract_sha256,")
header = '''"""Check/repack the exact reviewed text-v2 candidate; default is read-only.

Data-only official SDK packager, exactly one PDF omission, unchanged WASM.
Requires independently reviewed contract and builder hashes. No game execution,
installation, promotion or runtime proof. GPL-3.0-or-later.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path, PurePosixPath
import shutil
import subprocess
import candidate_common as common
from immutable_baseline import (PIN, OMITTED, PDF_SHA, PDF_BYTES, BASE_DATA_SHA,
    BASE_DATA_BYTES, digest, receipt, require_hash, same_json, under, metadata,
    inventory, validate_payload, loader_slice)

'''
(HERE/'package-font-free.py').write_text(header+source,encoding='utf-8')
print('Derived only the reviewed v2 candidate-validation/CLI adapters; data algorithm retained.')
