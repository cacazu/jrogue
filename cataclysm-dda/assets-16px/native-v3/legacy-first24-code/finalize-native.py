import hashlib
import json
import zipfile
from datetime import datetime,timezone
from pathlib import Path

root=Path(__file__).resolve().parent
upstream=Path(r'C:\Users\kit\gameme\jnethack\jrouge\cataclysm-dda\upstream\Cataclysm-DDA-7b2efa5cea38e4d4d97dd0e63b28b9148623da59')
sources=json.loads((root/'inputs/source-files.json').read_text('utf8'))
render=json.loads((root/'inputs/render-source-hashes.json').read_text('utf8'))
changed=[]
for record in sources:
    p=upstream/record['path']
    if not p.exists() or hashlib.sha256(p.read_bytes()).hexdigest()!=record['sha256']:changed.append(record['path'])
for path,sha in render.items():
    if hashlib.sha256((upstream/path).read_bytes()).hexdigest()!=sha:changed.append(path)
evidence={'verified_at':datetime.now(timezone.utc).isoformat(),'source_json_files_checked':len(sources),'render_reference_files_checked':len(render),'changed_files':changed,'source_preserved':not changed,'engine_build_or_link_started':False,'browser_started':False,'game_settings_or_original_tilesets_changed':False,'shared_git_staged_committed_pushed':False}
(root/'source-preservation.json').write_text(json.dumps(evidence,indent=2),'utf8')
assert not changed
status=json.loads((root/'status.json').read_text('utf8'))
assert status['native_sprites']==24 and status['technical_checks_pass'] and status['first_range_complete']
assert status['dedicated']+status['shared']+status['unsupported']==status['total']
out=root.parent/'CDDA-Native-16px-first24.zip'
files=sorted(p for p in root.rglob('*') if p.is_file())
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    for p in files:z.write(p,'CDDA-Native-16px/'+p.relative_to(root).as_posix())
print(json.dumps({'archive':str(out),'bytes':out.stat().st_size,'files':len(files),'status':status,'source_preservation':evidence},indent=2))
