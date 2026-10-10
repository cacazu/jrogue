import csv,hashlib,json,math
from collections import Counter,defaultdict
from datetime import datetime,timezone
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont

root=Path(__file__).resolve().parent
inventory=json.loads((root/'inputs/inventory.json').read_text('utf8'))
plan=json.loads((root/'inputs/plan.json').read_text('utf8'))
appearance=json.loads((root/'inputs/appearance-index.json').read_text('utf8'))
source=[json.loads((root/'source'/f'{name}.json').read_text('utf8')) for name,_,_ in plan]
validation=json.loads((root/'native-source-validation.json').read_text('utf8'))
assert len(source)==len(validation)==len(plan)
assert all(v['source_rows']==16 and v['source_columns_per_row']==[16]*16 and v['every_source_cell_exactly_one_RGBA_color'] and v['subcell_features']==0 and v['lossless_cell_collapse_matches_source'] for v in validation)
family_rules=[]
for rules_file in ['creature-family-aliases.json','object-family-aliases.json']:
    if (root/'inputs'/rules_file).exists():family_rules+=json.loads((root/'inputs'/rules_file).read_text('utf8'))['rules']
family_members={}
for rule in family_rules:
    for ident in rule['member_ids']:
        key=(rule['category'],ident)
        assert key not in family_members or family_members[key]['asset']==rule['asset'],key
        family_members[key]=rule
targets=inventory['targets'];by_id={(t['category'],t['display_id']):t for t in targets}
facts={(x['category'],x['display_id']):x for x in appearance['candidates']}
abstracts={}
for x in appearance['abstracts']:
    ident=('vp_' if x['category']=='vehicle_part' else '')+x['id']
    abstracts[(x['category'],ident)]={'category':x['category'],'display_id':ident,'facts':x['facts'],'abstract':True}
def bank(cat):return 'overmap' if cat=='overmap_terrain' else 'core'

direct={};asset_bank={};asset_category={};representative={}
for art in source:
    cats={t['category'] for t in targets if t['display_id'] in art['display_ids']}
    cat=art.get('category')
    if not cat:
        assert len(cats)==1,(art['name'],cats)
        cat=next(iter(cats))
    asset_category[art['name']]=cat;asset_bank[art['name']]=bank(cat)
    for ident in art['display_ids']:
        key=(bank(cat),ident)
        assert key not in direct or direct[key]==art['name'],('ID conflict',key)
        direct[key]=art['name']
    representative[(cat,art['display_ids'][0])]=art['name']
anchors=[
 {'category':'terrain','display_id':'t_natural_floor_abstract','asset':'dirt','reason':'t_dirt inherits this natural-floor template; shared coarse floor fallback'},
 {'category':'terrain','display_id':'t_abstract_wall_concrete','asset':'wall','reason':'t_wall inherits concrete-wall template; shared concrete-wall fallback'},
 {'category':'monster','display_id':'mon_zombie_base','asset':'zombie','reason':'mon_zombie inherits this generic human-zombie template; direct tile anchor for renderer looks_like fallback'},
 {'category':'overmap_terrain','display_id':'generic_open_land','asset':'overmap_field','reason':'field inherits this open-land template; shared overmap fallback'},
 {'category':'overmap_terrain','display_id':'generic_forest','asset':'overmap_forest','reason':'forest inherits this forest template; shared overmap fallback'},
 {'category':'overmap_terrain','display_id':'generic_city_house','asset':'overmap_house','reason':'house_01 and its same-definition house family inherit this house template; shared overmap fallback'}]
for a in anchors:
    assert (a['category'],a['display_id']) in abstracts
    direct[(bank(a['category']),a['display_id'])]=a['asset']

# A concrete id-array in ONE source object describes identical render facts.
# This is recorded separately from engine looks_like fallback and never unique art.
siblings={}
for art in source:
    cat=asset_category[art['name']]
    for ident in art['display_ids']:
        f=(facts.get((cat,ident),{}).get('facts') or {})
        for sibling in f.get('_id_array',[]):
            sibling=('vp_' if cat=='vehicle_part' else '')+sibling
            sf=(facts.get((cat,sibling),{}).get('facts') or {})
            if sf.get('_origin')==f.get('_origin') and (cat,sibling) in by_id:
                siblings.setdefault((cat,sibling),(art['name'],f.get('_origin')))

def resolve(cat,ident,budget=10,seen=()):
    global_key=(bank(cat),ident)
    if global_key in direct:return direct[global_key],[(cat,ident)]
    key=(cat,ident)
    if budget<=0 or key in seen or key in abstracts:return None
    node=facts.get(key)
    if not node or not node['appearance_unambiguous']:return None
    ll=(node['facts'] or {}).get('_looks_like',[])
    # No looks_like branch exists for TRAP in cata_tiles.cpp; don't invent one.
    if cat in ['trap','runtime']:return None
    for parent in ll:
        options=[(cat,parent)]
        if cat=='vehicle_part':options=[(cat,'vp_'+parent),(cat,parent),('furniture',parent)]
        for next_cat,next_ident in options:
            result=resolve(next_cat,next_ident,budget-1,seen+(key,))
            if result:return result[0],[(cat,ident)]+result[1]
        budget-=1
        if budget<=0:break
    return None

for t in targets:
    cat=t['category'];ident=t['display_id'];key=(cat,ident)
    t['status']='unsupported';t['asset']=None
    if (bank(cat),ident) in direct:
        t['asset']=direct[(bank(cat),ident)]
        t['status']='dedicated' if representative.get(key)==t['asset'] else 'shared'
        t['mapping_reason']='explicit native artwork mapping'
    elif key in siblings:
        t['asset'],origin=siblings[key];t['status']='shared'
        t['mapping_reason']='same source JSON id-array: '+origin['file']+'#'+origin['json_pointer']
    elif key in family_members:
        rule=family_members[key];t['asset']=rule['asset'];t['status']='shared'
        t['mapping_reason']='explicit shared structural family: '+json.dumps(rule['match_fields'],sort_keys=True)
    else:
        match=resolve(cat,ident)
        if match:
            t['asset']=match[0];t['status']='shared'
            t['mapping_reason']='source-defined renderer looks_like: '+' -> '.join(c+':'+i for c,i in match[1])

counts=Counter(t['status'] for t in targets)
status=inventory['summary'].copy();status['scope']=status['scope'].replace('seven renderable','eight renderable')+' Static source candidates, including possible obsolete/pseudo definitions; not active runtime total.'
status.update({k:counts[k] for k in ['dedicated','shared','unsupported']})
status.update({'updated_at':datetime.now(timezone.utc).isoformat(),'native_sprites':len(source),'new_batch_sprites':len(source)-69,'all_game_artwork_complete':False,'source_grid_validation':{'rows':16,'columns':16,'cells_per_sprite':256,'flat_cells':True,'subcell_features':0,'high_resolution_downsampling':False},'game_integration':'standard core/overmap tilesets compiled; no engine load tested or settings modified','technical_checks_pass':True,'virtual_template_anchors':anchors,'imagegen_usage':'Original mood studies only; final artwork is explicit native palette-cell source.'})
assert sum(counts.values())==len(targets)
native=Image.new('RGBA',(16,16));unknown=native.copy();d=ImageDraw.Draw(unknown)
for y,line in enumerate(['01110','10001','00001','00010','00100','00000','00100']):
    for x,v in enumerate(line):
        if v=='1':d.rectangle((3+x*2,1+y*2,4+x*2,2+y*2),fill=(242,188,104,255))

asset_info=[];bank_qa=[]
for which in ['core','overmap']:
    art_list=[a for a in source if asset_bank[a['name']]==which]
    name='CDDA16_Core' if which=='core' else 'CDDA16_Overmap'
    out=root/'tileset'/name;out.mkdir(parents=True,exist_ok=True)
    atlas=Image.new('RGBA',(128,math.ceil((len(art_list)+2)/8)*16))
    atlas.paste(unknown,(16,0))
    entries=[{'id':['unknown','unknown_terrain'],'fg':1,'rotates':False},{'id':'!nothing','fg':0,'rotates':False}]
    for i,a in enumerate(art_list):
        idx=i+2;path=root/'sprites'/f'{a["name"]}.png';im=Image.open(path).convert('RGBA')
        raw=path.read_bytes()
        assert im.size==(16,16) and int.from_bytes(raw[16:20],'big')==int.from_bytes(raw[20:24],'big')==16
        assert set(im.getchannel('A').get_flattened_data())=={0,255}
        atlas.paste(im,((idx%8)*16,(idx//8)*16))
        ids=[t['display_id'] for t in targets if t.get('asset')==a['name'] and bank(t['category'])==which]
        ids+=[x['display_id'] for x in anchors if x['asset']==a['name'] and bank(x['category'])==which]
        entries.append({'id':sorted(set(ids)),'fg':idx,'rotates':False})
        asset_info.append({'name':a['name'],'category':asset_category[a['name']],'bank':which,'source':'source/'+a['name']+'.json','png':'sprites/'+a['name']+'.png','proof':'proof/'+a['name']+'-native-grid-proof.png','explicit_ids':a['display_ids'],'atlas_index':idx,'tile_config':'tileset/'+name+'/tile_config.json'})
    ids=[x for e in entries for x in (e['id'] if isinstance(e['id'],list) else [e['id']])]
    assert len(ids)==len(set(ids)),(which,'duplicate tile ID')
    atlas.save(out/'tiles.png')
    config={'tile_info':[{'width':16,'height':16,'pixelscale':1,'iso':False,'zlevel_height':0}],'tiles-new':[{'file':'tiles.png','tiles':entries}]}
    (out/'tile_config.json').write_text(json.dumps(config,indent=2),'utf8')
    (out/'tileset.txt').write_text(f'NAME: cdda16_{which}\nVIEW: CDDA Native 16px {which} (partial artwork)\nJSON: tile_config.json\nTILESET: tiles.png\n','utf8')
    bank_qa.append({'bank':which,'artwork_sprites':len(art_list),'atlas_size':list(atlas.size),'tile_ID_count':len(ids),'IDs_unique':True,'indices_in_bounds':all(0<=e['fg']<len(art_list)+2 for e in entries)})
(root/'manifest.json').write_text(json.dumps({'status':status,'assets':asset_info,'alias_rules':appearance['rules'],'template_anchors':anchors,'family_alias_rules':family_rules,'targets':targets},ensure_ascii=False,indent=2),'utf8')
(root/'status.json').write_text(json.dumps(status,ensure_ascii=False,indent=2),'utf8')
with (root/'id-manifest.csv').open('w',encoding='utf-8-sig',newline='') as f:
    w=csv.writer(f);w.writerow(['category','display_id','status','asset','mapping_reason','source_file','json_pointer'])
    for t in targets:
        o=t['origins'][0];w.writerow([t['category'],t['display_id'],t['status'],t.get('asset') or '',t.get('mapping_reason',''),o['file'],o.get('json_pointer','')])
(root/'FINAL-QA.json').write_text(json.dumps({'native_sprite_count':len(source),'source_grid_validation_file':'native-source-validation.json','all_native_PNG_IHDR_and_decoded_dimensions':[16,16],'every_cell_verified_flat_before_lossless_export':True,'banks':bank_qa,'counts_reconciled':True,'engine_runtime_tested':False},indent=2),'utf8')
font=ImageFont.truetype(r'C:\Windows\Fonts\consola.ttf',15)
def sheet(arts,filename,title):
    im=Image.new('RGB',(1000,math.ceil(len(arts)/5)*230+90),'#121921');d=ImageDraw.Draw(im)
    d.text((24,18),title,font=ImageFont.truetype(r'C:\Windows\Fonts\consolab.ttf',26),fill='#e8dcc0')
    d.text((24,54),f'{len(arts)} native 16x16 cell grids | 10x display + 1x native | NO highres reduction',font=font,fill='#acd1cd')
    for i,a in enumerate(arts):
        x=(i%5)*200+20;y=(i//5)*230+90;d.rectangle((x,y,x+159,y+159),fill='#2c3540')
        sp=Image.open(root/'sprites'/f'{a["name"]}.png').convert('RGBA');big=sp.resize((160,160),Image.Resampling.NEAREST)
        im.paste(big,(x,y),big);d.rectangle((x+171,y+72,x+186,y+87),fill='#56626c');im.paste(sp,(x+171,y+72),sp)
        d.text((x,y+171),a['name'],font=font,fill='#e8dcc0');d.text((x,y+195),f'{sum(t.get("asset")==a["name"] for t in targets)} IDs',font=font,fill='#acd1cd')
    im.save(root/filename)
sheet(source,'contact-sheet.png','CDDA / NATIVE 16 x 16 / ALL CURRENT ART')
sheet(source[69:],'contact-sheet-batch3.png','CDDA / NATIVE 16 x 16 / CREATURE FAMILIES')
native_sheet=Image.new('RGBA',(128,math.ceil(len(source)/8)*16))
for i,a in enumerate(source):native_sheet.paste(Image.open(root/'sprites'/f'{a["name"]}.png'),((i%8)*16,(i//8)*16))
native_sheet.save(root/'contact-sheet-native.png')
print(json.dumps({'native_sprites':len(source),'new_batch':len(source)-69,'dedicated':counts['dedicated'],'shared':counts['shared'],'unsupported':counts['unsupported'],'banks':bank_qa},indent=2))
