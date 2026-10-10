"""Native connection/overlay additions and conservative derived-ID aliases. No engine edits."""
import csv,hashlib,json,math,re,shutil,zipfile
from collections import Counter,defaultdict
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
root=Path(__file__).resolve().parent;base=root.parent/'native-v4';src=Path(r'C:\Users\kit\gameme\jnethack\jrouge\cataclysm-dda\upstream\Cataclysm-DDA-7b2efa5cea38e4d4d97dd0e63b28b9148623da59')
for folder in ['source','sprites','source-grid','tileset']:(root/folder).mkdir(parents=True,exist_ok=True)
palette={'.':'00000000','X':'151b24ff','G':'9aa5aaff','J':'68737cff','P':'29313bff','S':'e8dcc0ff','Y':'f2bc68ff','Q':'b35636ff','R':'8b664bff','C':'acd1cdff','T':'6c9293ff','L':'909567ff','q':'873e32ff'}
sources=[]
def add(name,rows,purpose):
 assert len(rows)==16 and all(len(r)==16 for r in rows);used=set(''.join(rows));assert used<=set(palette)
 data={'name':name,'width':16,'height':16,'rows':rows,'palette':{c:'#'+palette[c] for c in sorted(used)},'purpose':purpose,'authoring':'Original native 16x16 cell matrix; no raster sampling or high-resolution reduction.'};(root/'source'/f'{name}.json').write_text(json.dumps(data,indent=2),'utf8');sources.append(data);return name
def blank():return [['.']*16 for _ in range(16)]
def commit(name,g,purpose):return add(name,[''.join(r) for r in g],purpose)
def line(g,x0,y0,x1,y1,c):
 n=max(abs(x1-x0),abs(y1-y0))
 for i in range(n+1):g[round(y0+(y1-y0)*i/max(1,n))][round(x0+(x1-x0)*i/max(1,n))]=c
def rect(g,x0,y0,x1,y1,c):
 for y in range(y0,y1+1):
  for x in range(x0,x1+1):g[y][x]=c

# Native arrows and markers. These are engine overlays, not creature/equipment illustrations.
overlays={}
for name,color in [('cursor','Y'),('highlight','C'),('highlight_item','Y'),('overlay_hostile_sees_player','Q'),('overlay_neutral_sees_player','Y'),('overlay_friendly_sees_player','L'),('overlay_other_sees_player','C')]:
 g=blank()
 for x0,y0,dx,dy in [(0,0,1,1),(15,0,-1,1),(0,15,1,-1),(15,15,-1,-1)]:line(g,x0,y0,x0+dx*3,y0,color);line(g,x0,y0,x0,y0+dy*3,color)
 overlays[name]=commit(name,g,'Original native transparent selection/attitude overlay, matched to exact runtime ID')
for name,color in [('weather_rain_drop','C'),('weather_acid_drop','L'),('weather_snowflake','S')]:
 g=blank()
 if name.endswith('snowflake'):
  for a in [(3,3,11,11),(3,11,11,3),(7,2,7,12),(2,7,12,7)]:line(g,*a,color)
 else:
  line(g,5,3,3,7,color);line(g,12,7,10,11,color)
 overlays[name]=commit(name,g,'Original native weather overlay; exact runtime ID')
for name,color in [('animation_bullet_normal','Y'),('animation_bullet_shrapnel','G'),('animation_bullet_flame','Q')]:
 g=blank();rect(g,6,6,9,9,color);g[7][7]='S';overlays[name]=commit(name,g,'Original native projectile marker; exact runtime ID')
for name,rad,color in [('explosion',6,'Q'),('explosion_medium',4,'Q'),('explosion_weak',2,'Y'),('animation_hit',3,'Q')]:
 g=blank()
 for y in range(16):
  for x in range(16):
   distance=abs(x-7)+abs(y-7)
   if distance<=rad:g[y][x]='Y' if distance<=rad//2 else color
 overlays[name]=commit(name,g,'Original native explosion/hit center marker; no frame animation or full explosion-border set claimed')
for name in ['animation_line','line_target','line_trail']:
 g=blank();line(g,1,7,14,7,'C');g[7][7]='S';overlays[name]=commit(name,g,'Original native horizontal aim/trail marker; rotations/trajectory must be checked in engine')
g=blank()
for x,y in [(5,5),(6,6),(7,7),(9,5),(10,6),(11,7),(3,9),(4,10),(5,11),(7,9),(8,10),(9,11)]:g[y][x]='R'
overlays['footstep']=commit('footstep',g,'Original native footstep overlay')
g=blank();line(g,3,4,11,11,'Q');line(g,3,11,11,4,'Y');overlays['graffiti']=commit('graffiti',g,'Original native generic graffiti overlay; individual graffiti content not represented')
g=blank();rect(g,4,4,11,11,'q');rect(g,6,2,9,13,'Q');rect(g,2,6,13,9,'Q');overlays['zombie_revival_indicator']=commit('zombie_revival_indicator',g,'Original native corpse-revival warning overlay')
g=blank();rect(g,4,5,11,11,'Q');rect(g,6,2,9,4,'Q');overlays['infrared_creature']=commit('infrared_creature',g,'Original native generic heat silhouette; not unique monster art')
for name,color in [('bash_complete','L'),('bash_effective','Y'),('bash_ineffective','Q')]:
 g=blank();line(g,3,3,12,12,color);line(g,12,3,3,12,color);overlays[name]=commit(name,g,'Original native bash result overlay')
g=blank()
for y in range(9,14):
 for x in range(3,13):
  if abs(x-7)+abs(y-11)<6:g[y][x]='P'
overlays['shadow']=commit('shadow',g,'Original native shadow overlay; binary-alpha utility')
for direction,(dx,dy) in {'n':(0,-1),'ne':(1,-1),'e':(1,0),'se':(1,1),'s':(0,1),'sw':(-1,1),'w':(-1,0),'nw':(-1,-1)}.items():
 g=blank();tip=(7+dx*5,7+dy*5);line(g,7-dx*4,7-dy*4,*tip,'Y');line(g,*tip,tip[0]-dx*3+dy*3,tip[1]-dy*3-dx*3,'Y');line(g,*tip,tip[0]-dx*3-dy*3,tip[1]-dy*3+dx*3,'Y');name='run_'+direction;overlays[name]=commit(name,g,'Original native movement direction overlay')

# Explicit sixteen connectivity masks; road and wall differ in surface/palette.
connections={}
for family in ['road','wall']:
 for mask in range(16):
  g=blank();active=lambda x,y:(5<=x<=10 and 5<=y<=10) or (mask&1 and 5<=x<=10 and y<=10) or (mask&2 and 5<=y<=10 and x<=10) or (mask&4 and 5<=y<=10 and x>=5) or (mask&8 and 5<=x<=10 and y>=5)
  for y in range(16):
   for x in range(16):
    if active(x,y):g[y][x]='J' if family=='road' else 'G'
  for y in range(16):
   for x in range(16):
    if active(x,y) and any(0<=x+dx<16 and 0<=y+dy<16 and not active(x+dx,y+dy) for dx,dy in [(-1,0),(1,0),(0,-1),(0,1)]):g[y][x]='X'
  if family=='road':
   for y in range(16):
    for x in range(16):
     if active(x,y) and ((x==7 and y%4<2) or (y==7 and x%4<2)):g[y][x]='Y'
  else:
   for y in range(16):
    for x in range(16):
     if g[y][x]=='G' and (y%4==0 or (x+(2 if y//4%2 else 0))%6==0):g[y][x]='J'
  name=f'{family}_connect_{mask:02d}';connections[(family,mask)]=commit(name,g,'Original native connected '+family+' geometry; mask bits N=1,W=2,E=4,S=8')

validation=[]
for a in sources:
 pal={c:tuple(bytes.fromhex(v[1:])) for c,v in a['palette'].items()};grid=Image.new('RGBA',(384,384));d=ImageDraw.Draw(grid)
 for y,row in enumerate(a['rows']):
  for x,c in enumerate(row):d.rectangle((x*24,y*24,(x+1)*24-1,(y+1)*24-1),fill=pal[c])
 gp=root/'source-grid'/f'{a["name"]}.png';grid.save(gp);decoded=Image.open(gp).convert('RGBA');pixels=[]
 for y,row in enumerate(a['rows']):
  for x,c in enumerate(row):
   values=set(decoded.crop((x*24,y*24,(x+1)*24,(y+1)*24)).get_flattened_data());assert values=={pal[c]};pixels.append(next(iter(values)))
 native=Image.new('RGBA',(16,16));native.putdata(pixels);p=root/'sprites'/f'{a["name"]}.png';native.save(p);assert list(Image.open(p).get_flattened_data())==pixels;assert {0,255}==set(native.getchannel('A').get_flattened_data())
 validation.append({'asset':a['name'],'cells':256,'source_rows':16,'source_columns_per_row':[16]*16,'all_cells_single_RGBA':True,'subcell_features':0,'native_size':[16,16],'lossless_export':True,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
(root/'native-source-validation.json').write_text(json.dumps(validation,indent=2),'utf8')
appearance=json.loads((base/'inputs/appearance-index.json').read_text('utf8'));facts={(x['category'],x['display_id']):x['facts'] or {} for x in appearance['candidates']};manifest=json.loads((base/'manifest.json').read_text('utf8'));targets=manifest['targets'];by_id={(x['category'],x['display_id']):x for x in targets};derived=[]
for (cat,ident),f in facts.items():
 if cat=='field':
  for i,_ in enumerate(f.get('intensity_levels',[]),1):derived.append({'category':cat,'base_id':ident,'display_id':ident+'_int'+str(i),'scope':'explicit source intensity level','pictorial_status':by_id[(cat,ident)]['status'],'meaning':'shared base image; intensity-specific visual anatomy NOT authored','origin':f.get('_origin')})
 if cat=='vehicle_part':
  variants=[v.get('id','') for v in f.get('variants',[]) if isinstance(v,dict)];bases=[v.get('id','') for v in f.get('variants_bases',[]) if isinstance(v,dict)];variants+= [b+'_'+v if v else b for b in bases for v in variants.copy()]
  for v in sorted(set(variants)):
   if v:derived.append({'category':cat,'base_id':ident,'display_id':ident+'_'+v,'scope':'source variant / variants_bases Cartesian expansion','pictorial_status':by_id[(cat,ident)]['status'],'meaning':'shared base image; unique cosmetic variant/open/broken art NOT authored','origin':f.get('_origin')})
# Derived IDs stay a separate denominator. Conflicts with explicit originals are not overwritten.
derived=[d for d in derived if (d['category'],d['display_id']) not in by_id];unique={}
for d in derived:
 k=(d['category'],d['display_id']);assert k not in unique or unique[k]['base_id']==d['base_id'];unique[k]=d
derived=list(unique.values());(root/'derived-id-manifest.json').write_text(json.dumps(derived,ensure_ascii=False,indent=2),'utf8')

config_checks=[]
for bank in ['core','overmap']:
 name='CDDA16_Core' if bank=='core' else 'CDDA16_Overmap';source=base/'tileset'/(name+'_Fallback');dest=root/'tileset'/(name+'_Supplement');dest.mkdir(exist_ok=True)
 cfg=json.loads((source/'tile_config.json').read_text('utf8'));offset=0
 for group in cfg['tiles-new']:
  im=Image.open(source/group['file']);offset+=im.width//16*(im.height//16);shutil.copy2(source/group['file'],dest/group['file'])
 chosen=sources if bank=='core' else [a for a in sources if a['name'].startswith('road_connect_')];indices={a['name']:offset+i for i,a in enumerate(chosen)};atlas=Image.new('RGBA',(128,math.ceil(len(chosen)/8)*16))
 for i,a in enumerate(chosen):atlas.paste(Image.open(root/'sprites'/f'{a["name"]}.png'),((i%8)*16,(i//8)*16))
 atlas.save(dest/'supplement.png');entries=[];index={}
 for group in cfg['tiles-new']:
  for e in group['tiles']:
   for ident in e['id'] if isinstance(e['id'],list) else [e['id']]:index[ident]=e
 if bank=='core':
  for ident,art in overlays.items():
   old=index.get(ident)
   if old:
    ids=old['id'] if isinstance(old['id'],list) else [old['id']];old['id']=[i for i in ids if i!=ident]
   entries.append({'id':ident,'fg':indices[art],'rotates':False})
  # One copy of source canonical masks with explicit per-rotation indices.
  masks={'center':[15]*4,'corner':[12,5,3,10],'t_connection':[14,13,7,11],'edge':[9,6,9,6],'end_piece':[8,4,1,2],'unconnected':[0]*4}
  walls={t['display_id'] for t in targets if t['category']=='terrain' and 'WALL' in facts.get(('terrain',t['display_id']),{}).get('flags',[])}
  split=[]
  for group in cfg['tiles-new']:
   for e in group['tiles']:
    ids=e['id'] if isinstance(e['id'],list) else [e['id']];wall_ids=[i for i in ids if i in walls]
    if wall_ids:
     e['id']=[i for i in ids if i not in walls];split.append({'id':wall_ids,'fg':indices['wall_connect_00'],'rotates':True,'multitile':True,'additional_tiles':[{'id':k,'fg':[indices[connections[('wall',mask)]] for mask in ms],'rotates':True} for k,ms in masks.items()]})
  entries+=split
  for d in derived:
   if d['display_id'] in index:continue
   e=index[d['base_id']];entries.append({'id':d['display_id'],'fg':e['fg'],'rotates':e.get('rotates',False)})
 else:
  # Exact suffixes from overmap.cpp267-284. End suffix names describe the ending rather than open direction.
  suffix_masks={'_isolated':0,'_end_south':1,'_end_west':4,'_ne':5,'_end_north':8,'_ns':9,'_es':12,'_nes':13,'_end_east':2,'_wn':3,'_ew':6,'_new':7,'_sw':10,'_nsw':11,'_esw':14,'_nesw':15}
  roads=[t['display_id'] for t in targets if t['category']=='overmap_terrain' and 'LINEAR' in facts.get(('overmap_terrain',t['display_id']),{}).get('flags',[]) and 'ROAD' in facts.get(('overmap_terrain',t['display_id']),{}).get('flags',[])]
  road_masks={'center':[15]*4,'corner':[12,5,3,10],'t_connection':[14,13,7,11],'edge':[9,6,9,6],'end_piece':[8,4,1,2],'unconnected':[0]*4}
  for ident in roads:
   old=index[ident];old_ids=old['id'] if isinstance(old['id'],list) else [old['id']];old['id']=[i for i in old_ids if i!=ident]
   entries.append({'id':ident,'fg':indices['road_connect_00'],'rotates':True,'multitile':True,'additional_tiles':[{'id':k,'fg':[indices[connections[('road',mask)]] for mask in ms],'rotates':True} for k,ms in road_masks.items()]})
   for suffix,mask in suffix_masks.items():
    tile=ident+suffix
    if tile not in index:entries.append({'id':tile,'fg':indices[connections[('road',mask)]],'rotates':False})
  (root/'road-derived-IDs.json').write_text(json.dumps({'source':'overmap.cpp267-284 and 1068','base_IDs':roads,'derived_count':sum(len(e['id']) if isinstance(e['id'],list) else 1 for e in entries),'meaning':'native geometry for source ROAD+LINEAR families, no claim of unique map contents','suffix_masks':suffix_masks},indent=2),'utf8')
 for group in cfg['tiles-new']:group['tiles']=[e for e in group['tiles'] if e['id']]
 cfg['tiles-new'].append({'file':'supplement.png','tiles':entries});(dest/'tile_config.json').write_text(json.dumps(cfg,ensure_ascii=False,indent=2),'utf8');(dest/'tileset.txt').write_text(f'NAME: cdda16_{bank}_supplement\nVIEW: CDDA Native 16px {bank} with overlays/connections\nJSON: tile_config.json\nTILESET: tiles.png\n','utf8')
 allids=[i for gr in cfg['tiles-new'] for e in gr['tiles'] for i in (e['id'] if isinstance(e['id'],list) else [e['id']])];assert len(allids)==len(set(allids)),bank
 configs=[e for gr in cfg['tiles-new'] for e in gr['tiles']];assert all(0<=e['fg']<offset+atlas.width//16*(atlas.height//16) for e in configs)
 for e in entries:
  for sub in e.get('additional_tiles',[]):assert len(sub['fg'])==4 and all(offset<=n<offset+len(chosen) for n in sub['fg'])
 config_checks.append({'bank':bank,'explicit_tile_ID_count':len(allids),'ID_collisions':0,'supplement_atlas_cells':len(chosen),'all_indices_in_bounds':True,'WASM_engine_tested':False})

im=Image.new('RGB',(1000,math.ceil(len(sources)/8)*155+60),'#121921');d=ImageDraw.Draw(im);font=ImageFont.truetype(r'C:\Windows\Fonts\consola.ttf',11);d.text((16,16),'CDDA ORIGINAL NATIVE 16x16 / OVERLAYS + CONNECTION GEOMETRY',font=font,fill='#e8dcc0')
for i,a in enumerate(sources):
 x=i%8*125+8;y=i//8*155+60;sp=Image.open(root/'sprites'/f'{a["name"]}.png').convert('RGBA');big=sp.resize((96,96),Image.Resampling.NEAREST);d.rectangle((x,y,x+95,y+95),fill='#46515a');im.paste(big,(x,y),big);im.paste(sp,(x+100,y+40),sp);d.text((x,y+102),a['name'][:18],font=font,fill='#e8dcc0');d.text((x,y+119),a['name'][18:36],font=font,fill='#e8dcc0')
 if len(a['name'])>36:d.text((x,y+136),a['name'][36:],font=font,fill='#e8dcc0')
im.save(root/'contact-sheet.png');(root/'atlas-QA.json').write_text(json.dumps(config_checks,indent=2),'utf8')
stats={'new_native_16x16_files':len(sources),'new_runtime_overlays':len(overlays),'native_connection_masks':32,'derived_field_intensity_IDs':sum(x['category']=='field' for x in derived),'derived_vehicle_variant_IDs':sum(x['category']=='vehicle_part' for x in derived),'static_inventory_denominator_unchanged':19847,'base439_source_unchanged':True,'engine_tested':False,'meaning':'Supplement is separate native overlay/geometry art. Intensity/vehicle aliases reuse base images, not unique appearance or per-variant completion.'};(root/'status.json').write_text(json.dumps(stats,indent=2),'utf8')
(root/'README-ja.txt').write_text('CDDA16px 接続・派生ID・オーバーレイ補助\n\n原寸16x16、透明背景、256単色セルの追加アート。保存済みnative-v4/439枚を変更しません。\nRuntimeオーバーレイは人物/装備の固有絵とは別に集計。接続タイルはN/W/E/Sの16組合せを道路と壁の2種類で制作。元コードの角・T字・直線・端・単独の回転と対応します。\nfield_intNと車両variantは明示された元データから別分母で一覧化し、元画像を共用。強度別の描き分け、破損/開放差分、装備/変異オーバーレイ、Modは完成扱いにしません。\nCore_Supplement/Overmap_Supplementはnative-v4の診断設定を含む3枚アトラス設定です。複製したgfx配布入力へ置き、WASM preloadは本体側で既存リンク完了後に反映します。\n本体未適用、WASMでの読込・描画順・接続方向の実機確認は未検査です。src/data/共有Gitへの変更なし。\nstatus.jsonとderived-id-manifest.json、road-derived-IDs.json、native-source-validation.json、atlas-QA.jsonを参照してください。\n','utf8')
zp=root.parent/'CDDA-Native-16px-integration-supplement.zip'
with zipfile.ZipFile(zp,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for p in sorted(root.rglob('*')):
  if p.is_file() and '__pycache__' not in p.parts:z.write(p,p.relative_to(root))
with zipfile.ZipFile(zp) as z:assert z.testzip() is None
print(json.dumps({**stats,'config_checks':config_checks,'zip_bytes':zp.stat().st_size,'zip_sha256':hashlib.sha256(zp.read_bytes()).hexdigest()},indent=2))
