import hashlib,json,re,zipfile
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parent;src=Path(r'C:\Users\kit\gameme\jnethack\jrouge\cataclysm-dda\upstream\Cataclysm-DDA-7b2efa5cea38e4d4d97dd0e63b28b9148623da59/src')
# Verify native edge connectivity against engine enum + canonical branch results.
header=(src/'cata_tiles.h').read_text('utf8');enum=re.search(r'enum class NEIGHBOUR\s*\{(.*?)\}',header,re.S).group(1);bits={name:int(value) for name,value in re.findall(r'(SOUTH|EAST|WEST|NORTH)\s*=\s*(\d+)',enum)};assert bits=={'SOUTH':1,'EAST':2,'WEST':4,'NORTH':8}
engine_results={0:('unconnected',0),15:('center',0),1:('end_piece',0),2:('end_piece',1),8:('end_piece',2),4:('end_piece',3),9:('edge',0),6:('edge',1),3:('corner',0),10:('corner',1),12:('corner',2),5:('corner',3),7:('t_connection',0),11:('t_connection',1),14:('t_connection',2),13:('t_connection',3)}
checks=[]
for bank,family in [('core','wall'),('overmap','road')]:
 folder='CDDA16_Core_Supplement' if bank=='core' else 'CDDA16_Overmap_Supplement';cfg=json.loads((root/'tileset'/folder/'tile_config.json').read_text('utf8'));offset=0;atlas=None
 for gr in cfg['tiles-new']:
  if gr['file']=='supplement.png':atlas=Image.open(root/'tileset'/folder/gr['file']).convert('RGBA');entries=gr['tiles'];break
  im=Image.open(root/'tileset'/folder/gr['file']);offset+=im.width//16*(im.height//16)
 entry=next(e for e in entries if e.get('multitile'));subs={e['id']:e for e in entry['additional_tiles']}
 for val in range(16):
  sub,rotation=engine_results[val];idx=subs[sub]['fg'][rotation]-offset;x=idx%8*16;y=idx//8*16;cell=atlas.crop((x,y,x+16,y+16));a=cell.getchannel('A');actual={'NORTH':any(a.getpixel((x,0)) for x in range(16)),'SOUTH':any(a.getpixel((x,15)) for x in range(16)),'WEST':any(a.getpixel((0,y)) for y in range(16)),'EAST':any(a.getpixel((15,y)) for y in range(16))};expected={direction:bool(val&bit) for direction,bit in bits.items()};assert actual==expected,(bank,val,actual,expected);checks.append({'bank':bank,'engine_neighbor_mask':val,'subtile':sub,'rotation':rotation,'native_alpha_edges_match_engine_directions':True})
(root/'connection-direction-QA.json').write_text(json.dumps({'source_enum':'src/cata_tiles.h105-110','source_branches':'src/cata_tiles.cpp5075-5201','engine_bits':bits,'native_source_bits':{'NORTH':1,'WEST':2,'EAST':4,'SOUTH':8},'different_orders_reconciled':True,'checks':checks,'engine_runtime_tested':False},indent=2),'utf8')
records=json.loads((root.parent/'native-v4/all-native-PNG-QA.json').read_text('utf8'))['files'];changed=[]
for rec in records:
 if hashlib.sha256((root.parent/'native-v4'/rec['file']).read_bytes()).hexdigest()!=rec['sha256']:changed.append(rec['file'])
assert not changed
pixels={};paths=list((root/'sprites').glob('*.png'));assert len(paths)==68
for p in paths:
 im=Image.open(p);assert im.size==(16,16) and im.mode=='RGBA';sig=hashlib.sha256(im.tobytes()).hexdigest();pixels.setdefault(sig,[]).append(p.stem)
status=json.loads((root/'status.json').read_text('utf8'));status.update({'new_native_files':68,'distinct_RGBA_pixel_matrices':len(pixels),'repeated_geometry_is_not_unique_art':{s:n for s,n in pixels.items() if len(n)>1},'base_native_files_checked_unchanged':len(records),'connection_direction_contract_checks_passed':len(checks),'engine_runtime_tested':False});(root/'status.json').write_text(json.dumps(status,indent=2),'utf8')
road=json.loads((root/'road-derived-IDs.json').read_text('utf8'));road['derived_count']=len(road['base_IDs'])*16;road['base_ID_count']=len(road['base_IDs']);(root/'road-derived-IDs.json').write_text(json.dumps(road,indent=2),'utf8')
zp=root.parent/'CDDA-Native-16px-integration-supplement.zip'
with zipfile.ZipFile(zp,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for p in sorted(root.rglob('*')):
  if p.is_file() and '__pycache__' not in p.parts:z.write(p,p.relative_to(root))
with zipfile.ZipFile(zp) as z:assert z.testzip() is None
print(json.dumps({'native_files':68,'distinct_RGBA_images':len(pixels),'base_original_files_unchanged':len(records),'connection_contract_checks':len(checks),'zip_bytes':zp.stat().st_size,'zip_sha256':hashlib.sha256(zp.read_bytes()).hexdigest()},indent=2))
