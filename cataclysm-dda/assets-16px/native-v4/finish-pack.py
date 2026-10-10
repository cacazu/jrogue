"""Pack optional diagnostic tilesets and visibility masks; audit original sources."""
import ctypes,hashlib,json,math,shutil,zipfile
from collections import Counter
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
root=Path(__file__).resolve().parent
fallback=json.loads((root/'fallback/manifest.json').read_text('utf8'))
for e in fallback['entries']:
 if 'no static symbol' in e['source_mapping'] or 'unsupported Unicode' in e['source_mapping']:e['purpose']='explicit_placeholder'
(root/'fallback/manifest.json').write_text(json.dumps(fallback,ensure_ascii=False,indent=2),'utf8')

utility=root/'utility';utility.mkdir(exist_ok=True);masks=[];checks=[]
for name,color,density in [('lighting_hidden','151b24ff',4),('lighting_lowlight_light','151b24ff',1),('lighting_lowlight_dark','151b24ff',3),('lighting_boomered_light','697047ff',1),('lighting_boomered_dark','4b503bff',3)]:
 rows=[''.join('F' if (x+y*3)%4<density else '.' for x in range(16)) for y in range(16)];pal={'.':'00000000','F':color};data={'name':name,'width':16,'height':16,'rows':rows,'palette':{k:'#'+v for k,v in pal.items()},'purpose':'Engine visibility utility mask, separate from transparent pictorial art.','opacity_exception':name=='lighting_hidden','exception_reason':'HIDDEN visibility must conceal all 256 cells; cata_tiles.cpp 3155-3157. Never count as transparent foreground artwork.' if name=='lighting_hidden' else None}
 (utility/f'{name}.json').write_text(json.dumps(data,indent=2),'utf8');sp=Image.new('RGBA',(16,16));pixels=[tuple(bytes.fromhex(pal[c])) for row in rows for c in row];sp.putdata(pixels);sp.save(utility/f'{name}.png');encoded=Image.open(utility/f'{name}.png').convert('RGBA');assert list(encoded.get_flattened_data())==pixels
 grid=Image.new('RGBA',(384,384));draw=ImageDraw.Draw(grid)
 for y,row in enumerate(rows):
  for x,c in enumerate(row):draw.rectangle((x*24,y*24,(x+1)*24-1,(y+1)*24-1),fill=tuple(bytes.fromhex(pal[c])))
 grid.save(utility/f'{name}-source-grid.png');decoded=Image.open(utility/f'{name}-source-grid.png').convert('RGBA')
 for y in range(16):
  for x in range(16):assert set(decoded.crop((x*24,y*24,(x+1)*24,(y+1)*24)).get_flattened_data())=={pixels[y*16+x]}
 masks.append({'id':name,'png':f'utility/{name}.png','utility':True,'transparent_foreground_artwork':False,'fully_opaque_exception':name=='lighting_hidden'})
 checks.append({'asset':name,'size':[16,16],'source_cells':256,'flat_cell_source_verified':True,'subcell_features':0,'alpha_values':sorted(set(p[3] for p in pixels)),'fully_opaque_visibility_exception':name=='lighting_hidden'})
(utility/'validation.json').write_text(json.dumps(checks,indent=2),'utf8')
manifest=json.loads((root/'manifest.json').read_text('utf8'));original_status=manifest['status'];targets=manifest['targets'];fallback_by_key={(e['category'],e['display_id']):e for e in fallback['entries']};masks_by_id={m['id']:m for m in masks}
for t in targets:
 key=(t['category'],t['display_id'])
 if key in fallback_by_key:t['fallback_asset']=fallback_by_key[key]['fallback_asset'];t['fallback_purpose']=fallback_by_key[key]['purpose']
 if t['category']=='runtime' and t['display_id'] in masks_by_id:t['fallback_asset']=masks_by_id[t['display_id']]['png'];t['fallback_purpose']='visibility_utility'

atlas_checks=[]
for bank in ['core','overmap']:
 folder='CDDA16_Core' if bank=='core' else 'CDDA16_Overmap';src=root/'tileset'/folder;dest=root/'tileset'/(folder+'_Fallback');dest.mkdir(exist_ok=True)
 cfg=json.loads((src/'tile_config.json').read_text('utf8'));base=cfg['tiles-new'][0];arts=[a for a in fallback['assets'] if a['bank']==bank];bank_masks=masks if bank=='core' else []
 override_ids={e['display_id'] for e in fallback['entries'] if e['bank']==bank}|{m['id'] for m in bank_masks}
 base_entries=[]
 for entry in base['tiles']:
  ids=entry['id'] if isinstance(entry['id'],list) else [entry['id']];ids=[i for i in ids if i not in override_ids]
  if ids:base_entries.append({**entry,'id':ids})
 cfg['tiles-new'][0]['tiles']=base_entries;shutil.copy2(src/'tiles.png',dest/'tiles.png')
 base_image=Image.open(src/'tiles.png');offset=(base_image.width//16)*(base_image.height//16);count=len(arts)+len(bank_masks);atlas=Image.new('RGBA',(256,math.ceil(count/16)*16));entries=[]
 for i,a in enumerate(arts):
  sp=Image.open(root/a['png']).convert('RGBA');assert sp.size==(16,16);atlas.paste(sp,((i%16)*16,(i//16)*16))
  ids=[e['display_id'] for e in fallback['entries'] if e['fallback_asset']==a['name'] and e['display_id'] not in masks_by_id]
  if ids:entries.append({'id':ids,'fg':offset+i,'rotates':False})
 for j,m in enumerate(bank_masks):
  i=len(arts)+j;sp=Image.open(root/m['png']).convert('RGBA');atlas.paste(sp,((i%16)*16,(i//16)*16));entries.append({'id':m['id'],'fg':offset+i,'rotates':False})
 atlas.save(dest/'diagnostic.png');cfg['tiles-new'].append({'file':'diagnostic.png','tiles':entries});(dest/'tile_config.json').write_text(json.dumps(cfg,ensure_ascii=False,indent=2),'utf8');(dest/'tileset.txt').write_text(f'NAME: cdda16_{bank}_fallback\nVIEW: CDDA Native 16px {bank} with diagnostic stencils\nJSON: tile_config.json\nTILESET: tiles.png\n','utf8')
 ids=[ident for group in cfg['tiles-new'] for ent in group['tiles'] for ident in (ent['id'] if isinstance(ent['id'],list) else [ent['id']])];assert len(ids)==len(set(ids))
 expected={t['display_id'] for t in targets if ('overmap' if t['category']=='overmap_terrain' else 'core')==bank};assert expected<=set(ids)
 assert all(0<=e['fg']<offset+atlas.width//16*(atlas.height//16) for e in entries)
 reloaded=Image.open(dest/'diagnostic.png').convert('RGBA');assert all(list(reloaded.crop(((i%16)*16,(i//16)*16,(i%16+1)*16,(i//16+1)*16)).get_flattened_data())==list(Image.open(root/a['png']).convert('RGBA').get_flattened_data()) for i,a in enumerate(arts))
 atlas_checks.append({'bank':bank,'tile_ID_count':len(ids),'explicit_static_candidates':len(expected),'all_static_candidates_mapped':True,'ID_collisions':0,'diagnostic_sprite_cells':count,'native_fallback_matches_atlas':True,'base_sprite_offset':offset,'atlas_size':list(atlas.size),'engine_tested':False})
# Lightweight memory snapshot; no engine build, renderer launch, or browser.
class MemoryStatus(ctypes.Structure):
 _fields_=[('dwLength',ctypes.c_uint32),('dwMemoryLoad',ctypes.c_uint32),('ullTotalPhys',ctypes.c_uint64),('ullAvailPhys',ctypes.c_uint64),('ullTotalPageFile',ctypes.c_uint64),('ullAvailPageFile',ctypes.c_uint64),('ullTotalVirtual',ctypes.c_uint64),('ullAvailVirtual',ctypes.c_uint64),('ullAvailExtendedVirtual',ctypes.c_uint64)]
mem=MemoryStatus();mem.dwLength=ctypes.sizeof(mem);assert ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(mem));memory={'physical_available_bytes':mem.ullAvailPhys,'commit_available_bytes':mem.ullAvailPageFile,'physical_load_percent':mem.dwMemoryLoad};(root/'memory-final.json').write_text(json.dumps(memory,indent=2),'utf8')

src=Path(r'C:\Users\kit\gameme\jnethack\jrouge\cataclysm-dda\upstream\Cataclysm-DDA-7b2efa5cea38e4d4d97dd0e63b28b9148623da59')
source_records=json.loads((root/'inputs/source-files.json').read_text('utf8'));source_records=source_records['files'] if isinstance(source_records,dict) else source_records
modified=[]
for rec in source_records:
 if hashlib.sha256((src/rec['path']).read_bytes()).hexdigest()!=rec['sha256']:modified.append(rec['path'])
assert not modified
baseline=root.parent/'native-v3';unchanged=[]
for folder in ['source','sprites']:
 for p in (baseline/folder).glob('*'):
  q=root/folder/p.name;assert p.read_bytes()==q.read_bytes(),p;unchanged.append(f'{folder}/{p.name}')

status={**original_status,'native_pictorial_sprites':439,'native_diagnostic_stencils':len(fallback['assets']),'native_visibility_masks':len(masks),'total_native_16x16_files':439+len(fallback['assets'])+len(masks),'pictorial_unsupported':original_status['unsupported'],'static_candidate_count':len(targets),'static_candidates_with_explicit_tile_mapping':len(targets),'all_game_artwork_complete':False,'diagnostic_fallback_is_not_pictorial_completion':True,'placeholder_IDs':sum(e['purpose']=='explicit_placeholder' for e in fallback['entries']),'source_files_checked_unchanged':len(source_records),'baseline69_files_unchanged':len(unchanged),'game_integration':'Optional core and overmap standard tile configs include all 19847 explicit static candidates; WASM preload and engine test pending with main owner. No engine build/settings change.'}
manifest['status']=status;manifest['diagnostic_fallback']='fallback/manifest.json';manifest['visibility_utility']=masks;(root/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),'utf8');(root/'status.json').write_text(json.dumps(status,ensure_ascii=False,indent=2),'utf8')
(root/'source-preservation-final.json').write_text(json.dumps({'fixed_release':'0.I-1','fixed_commit':'7b2efa5cea38e4d4d97dd0e63b28b9148623da59','source_json_files_checked':len(source_records),'changed_source_files':modified,'baseline69_files_checked':len(unchanged),'all_baseline_files_byte_identical':True},indent=2),'utf8');(root/'diagnostic-atlas-QA.json').write_text(json.dumps(atlas_checks,indent=2),'utf8')
print(json.dumps({'native_art':439,'diagnostic_stencils':len(fallback['assets']),'visibility_masks':len(masks),'all_explicit_static_IDs_mapped':len(targets),'pictorial_dedicated':status['dedicated'],'pictorial_shared':status['shared'],'pictorial_unsupported':status['unsupported'],'placeholder_IDs':status['placeholder_IDs'],'baseline_preserved_files':len(unchanged),'source_unchanged_files':len(source_records),'memory':memory,'atlas_checks':atlas_checks},indent=2))
