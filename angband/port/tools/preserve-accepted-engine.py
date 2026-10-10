"""Preserve independently hashed pre-naming artifacts before the next build."""
import hashlib
import json
from pathlib import Path
import shutil
ROOT=Path(__file__).resolve().parent.parent
target=ROOT/'tests/pre-naming-accepted-snapshot'
target.mkdir(exist_ok=True)
manifest=json.loads((ROOT/'build/manifest.json').read_text(encoding='utf-8'))
for row in manifest['outputs']:
 assert row['name'] in {'game.js','game.wasm','game.data'}
 source=ROOT/'build'/row['name']
 assert hashlib.sha256(source.read_bytes()).hexdigest()==row['sha256']
 destination=target/row['name']
 if destination.exists():assert hashlib.sha256(destination.read_bytes()).hexdigest()==row['sha256']
 else:shutil.copyfile(source,destination)
for relative in ['build/manifest.json','verification.json','tests/source-integration-evidence/build-safety-resources.json',
                 'tests/source-integration-evidence/browser-safety-resources.json']:
 destination=target/Path(relative).name
 if not destination.exists():shutil.copyfile(ROOT/relative,destination)
print(json.dumps({'snapshot':str(target),'engineBuiltAt':manifest['builtAt'],'files':3,'sha256Verified':True}))
