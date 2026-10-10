import csv
import hashlib
import json
from collections import Counter
from datetime import datetime,timezone
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont

root=Path(__file__).resolve().parent
inventory=json.loads((root/'inputs/inventory.json').read_text('utf8'))
plan=json.loads((root/'inputs/plan.json').read_text('utf8'))
source=[json.loads((root/'source'/f'{name}.json').read_text('utf8')) for name,_,_ in plan]
validation=json.loads((root/'native-source-validation.json').read_text('utf8'))
assert len(source)==len(validation)==24
assert all(v['source_rows']==16 and v['source_columns_per_row']==[16]*16 and v['every_source_cell_exactly_one_RGBA_color'] and v['subcell_features']==0 and v['lossless_cell_collapse_matches_source'] for v in validation)
targets=inventory['targets']
direct={ident:art['name'] for art in source for ident in art['display_ids']}
aliases={art['name']:art['display_ids'] for art in source}
by_id={(t['category'],t['display_id']):t for t in targets}
for t in targets:
    ident=t['display_id']
    if ident in direct:
        t['asset']=direct[ident]
        t['status']='dedicated' if ident==aliases[t['asset']][0] else 'shared'
        t['mapping_reason']='explicit native-source mapping'
        continue
    ll=t.get('looks_like');seen={ident};chain=[ident]
    for _ in range(10):
        if not isinstance(ll,str) or not ll or ll in seen:break
        seen.add(ll);chain.append(ll)
        if ll in direct:
            t['asset']=direct[ll];t['status']='shared';t['mapping_reason']='upstream explicit looks_like: '+' -> '.join(chain);break
        ll=by_id.get((t['category'],ll),{}).get('looks_like')
status=inventory['summary'].copy()
if (root/'inputs/memory-latest.json').exists():
    observation=json.loads((root/'inputs/memory-latest.json').read_text('utf8'))
    status['memory']=observation['memory']
    status['memory_observed_at']=observation['observed_at']
status['scope']=status['scope'].replace('seven renderable','eight renderable')+' Static candidates can include pseudo/obsolete entries; not an all-runtime-ID count.'
counts=Counter(t['status'] for t in targets)
status.update({k:counts[k] for k in ['dedicated','shared','unsupported']})
status.update({'updated_at':datetime.now(timezone.utc).isoformat(),'native_sprites':24,'first_range_complete':True,'all_game_artwork_complete':False,'source_grid_validation':{'rows':16,'columns':16,'flat_source_cells_per_asset':256,'subcell_features':0,'antialiasing':False,'lossless_export':True,'high_resolution_downsampling':False},'imagegen_usage':'17 original mood/concept drafts only. All final artwork explicitly authored as native palette-cell source matrices; no draft pixels sampled.','rejected_downsample_pipeline':'../rejected-highres-drafts; not counted as completed artwork','game_integration':'not installed/selected; engine runtime not tested','technical_checks_pass':True})
assert counts['dedicated']==24 and sum(counts.values())==status['total']
(root/'status.json').write_text(json.dumps(status,ensure_ascii=False,indent=2),'utf8')
assets=[{'name':art['name'],'source':'source/'+art['name']+'.json','source_grid':'source-grid/'+art['name']+'-source-grid.png','png':'sprites/'+art['name']+'.png','proof':'proof/'+art['name']+'-native-grid-proof.png','explicit_ids':art['display_ids'],'atlas_index':i+2} for i,art in enumerate(source)]
(root/'manifest.json').write_text(json.dumps({'status':status,'assets':assets,'targets':targets},ensure_ascii=False,indent=2),'utf8')
with (root/'id-manifest.csv').open('w',encoding='utf-8-sig',newline='') as f:
    w=csv.writer(f);w.writerow(['category','display_id','status','asset','mapping_reason','source_file','json_pointer'])
    for t in targets:
        origin=t['origins'][0];w.writerow([t['category'],t['display_id'],t['status'],t.get('asset') or '',t.get('mapping_reason',''),origin['file'],origin.get('json_pointer','')])

blank=Image.new('RGBA',(16,16),(0,0,0,0))
unknown=blank.copy();d=ImageDraw.Draw(unknown)
glyph=['01110','10001','00001','00010','00100','00000','00100']
for y,line in enumerate(glyph):
    for x,v in enumerate(line):
        if v=='1':d.rectangle((3+x*2,1+y*2,4+x*2,2+y*2),fill=(242,188,104,255))
(root/'utility').mkdir(exist_ok=True);unknown.save(root/'utility/unknown.png');blank.save(root/'utility/blank.png')
(root/'utility/source.json').write_text(json.dumps({'authoring':'Original native utility cells, not gameplay artwork','unknown':[[list(unknown.getpixel((x,y))) for x in range(16)] for y in range(16)],'blank':[[[0,0,0,0] for x in range(16)] for y in range(16)]},indent=2),'utf8')
images=[blank,unknown]+[Image.open(root/'sprites'/f'{art["name"]}.png').convert('RGBA') for art in source]
atlas=Image.new('RGBA',(128,64))
for i,im in enumerate(images):atlas.paste(im,((i%8)*16,(i//8)*16))
out=root/'tileset/CDDA16_Original';out.mkdir(parents=True,exist_ok=True);atlas.save(out/'tiles.png')
entries=[{'id':['unknown','unknown_terrain'],'fg':1,'rotates':False},{'id':'!nothing','fg':0,'rotates':False}]
for i,art in enumerate(source):entries.append({'id':[t['display_id'] for t in targets if t.get('asset')==art['name']],'fg':i+2,'rotates':False})
ids=[ident for entry in entries for ident in (entry['id'] if isinstance(entry['id'],list) else [entry['id']])]
assert len(ids)==len(set(ids))==counts['dedicated']+counts['shared']+3
config={'tile_info':[{'width':16,'height':16,'pixelscale':1,'iso':False,'zlevel_height':0}],'tiles-new':[{'file':'tiles.png','tiles':entries}]}
(out/'tile_config.json').write_text(json.dumps(config,indent=2),'utf8')
(out/'tileset.txt').write_text('NAME: cdda16_original\nVIEW: CDDA Native 16px (partial artwork)\nJSON: tile_config.json\nTILESET: tiles.png\n','utf8')
checks=[]
for art in source:
    p=root/'sprites'/f'{art["name"]}.png';raw=p.read_bytes();im=Image.open(p)
    assert raw[:8]==b'\x89PNG\r\n\x1a\n' and int.from_bytes(raw[16:20],'big')==int.from_bytes(raw[20:24],'big')==16
    assert im.size==(16,16) and im.mode=='RGBA' and set(im.getchannel('A').get_flattened_data())=={0,255}
    checks.append({'file':'sprites/'+p.name,'PNG_IHDR':[16,16],'decoded_dimensions':[16,16],'mode':im.mode,'binary_alpha':True,'sha256':hashlib.sha256(raw).hexdigest()})
(root/'FINAL-QA.json').write_text(json.dumps({'actual_files_checked':checks,'native_source_grids_validated':24,'every_source_grid':{'columns':16,'rows':16,'flat_cells':256,'subcell_details':0},'source_to_native_export':'lossless one color cell to one PNG pixel; no highres downsampling','tile_IDs_unique':True,'tile_indices_valid':all(0<=e['fg']<26 for e in entries),'count_reconciled':True,'game_runtime_tested':False},indent=2),'utf8')
font=ImageFont.truetype(r'C:\Windows\Fonts\consola.ttf',15)
sheet=Image.new('RGB',(1000,1240),'#121921');d=ImageDraw.Draw(sheet)
d.text((24,18),'CDDA / NATIVE 16 x 16',font=ImageFont.truetype(r'C:\Windows\Fonts\consolab.ttf',26),fill='#e8dcc0')
d.text((24,54),'24 native source grids | 16 columns x 16 rows | 10x preview + 1x native',font=font,fill='#acd1cd')
for i,art in enumerate(source):
    x=(i%5)*200+20;y=(i//5)*230+90
    d.rectangle((x,y,x+159,y+159),fill='#2c3540')
    im=Image.open(root/'sprites'/f'{art["name"]}.png').convert('RGBA');big=im.resize((160,160),Image.Resampling.NEAREST)
    sheet.paste(big,(x,y),big);d.rectangle((x+171,y+72,x+186,y+87),fill='#56626c');sheet.paste(im,(x+171,y+72),im)
    d.text((x,y+171),art['name'],font=font,fill='#e8dcc0');d.text((x,y+195),f'{sum(t.get("asset")==art["name"] for t in targets)} IDs',font=font,fill='#acd1cd')
sheet.save(root/'contact-sheet.png')
native=Image.new('RGBA',(128,48))
for i,art in enumerate(source):native.paste(Image.open(root/'sprites'/f'{art["name"]}.png'),((i%8)*16,(i//8)*16))
native.save(root/'contact-sheet-native.png')
print(json.dumps(status,ensure_ascii=False,indent=2))
