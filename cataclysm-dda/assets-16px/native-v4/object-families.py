"""Original cell art for source-defined object classes; shared, never unique-ID art."""
import hashlib,json
from collections import defaultdict
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parent
palette={'.':'00000000','X':'151b24ff','S':'e8dcc0ff','B':'bd996fff','L':'909567ff','J':'68737cff','P':'29313bff','R':'8b664bff','G':'9aa5aaff','D':'c4cbc4ff','K':'f3eee1ff','q':'873e32ff','Q':'b35636ff','Y':'f2bc68ff','v':'697047ff','V':'b3b98bff','u':'41656aff','T':'6c9293ff','C':'acd1cdff','N':'645370ff','F':'9b849bff','n':'414b57ff','b':'243b53ff','t':'7395aaff'}
color_main={'black':'P','white':'S','light_gray':'G','dark_gray':'n','red':'q','light_red':'Q','green':'v','light_green':'L','brown':'R','yellow':'Y','blue':'b','light_blue':'t','cyan':'u','light_cyan':'C','magenta':'N','pink':'F','light_magenta':'F'}
templates={
'book':['XXXXXXXXXX','XmSmmmmmmX','XmSmmmmmmX','XmSmmmmmmX','XmSmmSSmmX','XmSmmSSmmX','XmSmmmmmmX','XmSmmmmmmX','XmSmmmmmmX','XSSSSSSSSX','XXXXXXXXXX'],
'boots':['.XXX....XXX...','.XmmX...XmmX..','.XmmX...XmmX..','.XmmX...XmmX..','.XmSX...XmSX..','.XmSmX..XmSmX.','XmmmmmXXmmmmmX','XXXXXXXXXXXXXX'],
'pants':['XXXXXXXXXX','XmSSSSSSmX','XmmmmmmmmX','XmmmmmmmmX','XmXmmmmXmX','XmXXmmXXmX','XmX.XX.XmX','XmX....XmX','XmX....XmX','XmX....XmX','XmX....XmX','XXX....XXX'],
'jacket':['...XXXXXX...','..XmXSSXmX..','.XmmmXXmmmX.','XmmmmSSmmmmX','XmXmmSSmmXmX','XmXmmSSmmXmX','XmXmmSSmmXmX','XXXmmSSmmXXX','..XmmmmmmX..','..XXXXXXXX..'],
'helmet':['...XXXXXX...','..XmmmmmmX..','.XmmmmmmmmX.','XmmmmmmmmmmX','XmGGGGGGGGmX','XGXXXXXXXXGX','XX........XX'],
'hat':['...XXXXXX...','..XmmmmmmX..','..XmmmmmmX..','..XmmmmmmX..','..XSSSSSSX..','XXmmmmmmmmXX','XXXXXXXXXXXX'],
'gloves':['.XX....XX...','XmmX..XmmX..','XmmX..XmmX..','XmmXXXmmXX..','XmmmmmXmmmX.','XmmmmmXmmmX.','.XmmXXXmmX..','..XX...XX...'],
'goggles':['XXXXXXXXXXXXXX','XmmGGmXXmGGmmX','XmmGGmXXmGGmmX','XXXXXXXXXXXXXX'],
'magazine':['XXXXXX','XmmmmX','XmmSmX','XmmSmX','XmmSmX','XmmSmX','XmmSmX','XmmmmX','XmmmmX','.XXXXX'],
'rifle':['.........XXX..','XXXXXXXXXmmX..','XGmmmmmmmmmmXX','.XXXXXXXXXXXXX','.....XGmX.....','.....XmmX.....','.....XXXX.....'],
'shotgun':['..........XX..','XXXXXXXXXXmmX.','XGGGmmmmmmmmXX','XXXXXXXXXXXXXX','.....XXmX.....','.....XmmX.....','.....XXXX.....'],
'bow':['..XX....','..XmmX..','..X.SmX.','..X..SmX','XXXXXSmX','..X..SmX','..X.SmX.','..XmmX..','..XX....'],
'meat':['....XXXXXX....','..XXmmmmmmXX..','.XmmmmSmmmmXX.','XmmSmmmmSmmmmX','XmmmSmmSmmmmmX','XmmmmmSmmmmmmX','.XmmmmmmmSmmX.','..XXXXXXXXXX..'],
'fruit':['....X.........','...XmX........','..XXmXXX......','.XmmmmmmXX....','XmmSmmmmmmX...','XmmSmmmmmmX...','XmmmmmmmmmX...','.XmmmmmmmX....','..XXXXXXX.....'],
'grain':['..X....X....X.','.XmX..XmX..XmX','..XmX..XmX..X.','...XmXXmXmXX..','....XmmmmX....','....XmmmmX....','....XmmmmX....','....XXXXXX....'],
'seed':['..XX.....XX...','.XmmX...XmmX..','..XX.....XX...','......XX......','.....XmmX.....','......XX......','..XX..........','.XmmX.........','..XX..........'],
'bionic':['...XXXXXXXX...','...XmGmmGmX...','.XXXmGmmGmXXX.','XmGmmmmmmmmGmX','.XXXmGmmGmXXX.','...XmGmmGmX...','...XXXXXXXX...'],
'tank':['...XXXXXX...','...XGmmGX...','..XmmmmmmX..','.XmmmmmmmmX.','XmmSmmmmmmmX','XmmSmmmmmmmX','XmmSmmmmmmmX','XmmmmmmmmmmX','XmmmmmmmmmmX','XXXXXXXXXXXX'],
'solar':['XXXXXXXXXXXXXX','XmGmmGmmGmmmmX','XGGGGGGGGGGGGX','XmGmmGmmGmmmmX','XGGGGGGGGGGGGX','XmGmmGmmGmmmmX','XXXXXXXXXXXXXX'],
'crate':['XXXXXXXXXXXX','XmmXmmmmXmmX','XmXmXmmXmXmX','XmmmXmmXmmmX','XmmmmXXmmmmX','XmmmmXXmmmmX','XmmmXmmXmmmX','XmXmXmmXmXmX','XmmXmmmmXmmX','XXXXXXXXXXXX'],
'plant':['....X...X.....','...XmX.XmX....','..XmmXmXmmX...','...XmmmmmmX...','..XmmmmmmmmX..','....XmmXX.....','.....XmX......','.....XmX......','...XXXXXXXX...','..XRRRRRRRRX..','...XXXXXXXX...'],
'flower':['.....XXX......','...XXmmmXX....','..XmmmmmSmX...','..XmmYYYmmX...','...XmYYYmX....','....XXXXX.....','......XvX.....','....XvXvX.....','.....XvvX.....','......XXX.....'],
'terrain_wall':['XXXXXXXXXXXXXX','XmmmmXmmmmmmmX','XmmmmXmmmmmmmX','XmmmmXmmmmmmmX','XXXXXXXXXXXXXX','XmmXmmmmmmXmmX','XmmXmmmmmmXmmX','XXXXXXXXXXXXXX','XmmmmmmXmmmmmX','XmmmmmmXmmmmmX','XmmmmmmXmmmmmX','XXXXXXXXXXXXXX'],
'terrain_floor':['XXXXXXXXXXXXXX','XmmmmmmmmmmmmX','XmXmmmmXmmmmmX','XmmmmmmmmmmmmX','XmmmmmmmmmmXmX','XmmmmXmmmmmmmX','XmmmmmmmmmmmmX','XmmmmmmmXmmmmX','XmmmmmmmmmmmmX','XmXmmmmmmmmmmX','XmmmmmmmmXmmmX','XXXXXXXXXXXXXX'],
'building':['...XXXXXXXX...','..XmmmmmmmmX..','.XmmmmmmmmmmX.','XXXXXXXXXXXXXX','XGmmGGmmGGmmGX','XGmmGGmmGGmmGX','XmmmmmmmmmmmmX','XGmmGGmmGGmmGX','XGmmGGmmGGmmGX','XmmmmXXmmmmmmX','XmmmmSSmmmmmmX','XXXXXXXXXXXXXX'],
'overmap_water':['..mmm....mmm..','.mCCCm..mCCCm.','mCmmmCmmCmmmCm','mCmmmCmmCmmmCm','.mCCCm..mCCCm.','..mmm....mmm..','..mmm....mmm..','.mCCCm..mCCCm.','mCmmmCmmCmmmCm','.mCCCm..mCCCm.','..mmm....mmm..'],
}
for name in ['pistol','vehicle_seat','vehicle_door','gas_engine','wheel','battery' if (root/'source/battery.json').exists() else 'flashlight','window','stairs_up','stairs_down']:
 a=json.loads((root/'source'/f'{name}.json').read_text('utf8'));templates[name]=a['rows']

def materials(raw):
 if isinstance(raw,dict):return sorted(raw)
 if isinstance(raw,list):return sorted(x.get('type','') if isinstance(x,dict) else x for x in raw)
 return [str(raw)] if raw else []
def choose(cat,f):
 flags=set(f.get('flags',[]));subs=set(f.get('subtypes',[]));mat=set(materials(f.get('material')));glyph=f.get('symbol',f.get('sym'));chain=set(f.get('_chain',[]))
 if cat=='item':
  if 'BOOK' in subs:return 'book'
  if 'BIONIC_ITEM' in subs:return 'bionic'
  if 'SEED' in subs:return 'seed'
  if 'MAGAZINE' in subs:return 'magazine'
  if 'WHEEL' in subs:return 'wheel'
  if 'ENGINE' in subs:return 'gas_engine'
  if 'GUN' in subs:
   return {'rifle':'rifle','shotgun':'shotgun','pistol':'pistol','smg':'rifle','archery':'bow'}.get(f.get('skill'))
  if 'ARMOR' in subs:
   covers=set(f.get('covers',[]))
   for part in f.get('armor',[]):
    covers.update(part.get('covers',[]));mat.update(materials(part.get('material')))
   if covers & {'foot_l','foot_r'} and not covers & {'leg_l','leg_r','torso'}:return 'boots'
   if covers & {'head'} and not covers & {'torso','leg_l','leg_r'}:return 'helmet' if mat & {'steel','iron','aluminum','kevlar','plastic'} else 'hat'
   if covers=={'eyes'}:return 'goggles'
   if covers & {'hand_l','hand_r'} and not covers & {'arm_l','arm_r','torso'}:return 'gloves'
   if covers & {'leg_l','leg_r'} and not covers & {'torso','arm_l','arm_r','head'}:return 'pants'
   if 'torso' in covers and not covers & {'leg_l','leg_r','head'}:return 'jacket'
  if 'COMESTIBLE' in subs and f.get('comestible_type')=='FOOD':
   if mat & {'flesh','hflesh','iflesh','bone'}:return 'meat'
   if mat & {'fruit','veggy'}:return 'fruit'
   if mat & {'wheat','corn'}:return 'grain'
 if cat=='terrain':
  if 'WALL' in flags:return 'terrain_wall'
  if 'WINDOW' in flags:return 'window'
  if 'GOES_UP' in flags:return 'stairs_up'
  if 'GOES_DOWN' in flags:return 'stairs_down'
  if 'FLAT' in flags and glyph=='.':return 'terrain_floor'
 if cat=='furniture':
  if 'FLOWER' in flags:return 'flower'
  if 'PLANT' in flags:return 'plant'
  if 'CONTAINER' in flags and glyph in ['#','0','O']:return 'crate'
  if 'CAN_SIT' in flags and glyph in ['h','c','C']:return 'vehicle_seat'
 if cat=='vehicle_part':
  for flag,art in [('WHEEL','wheel'),('SOLAR_PANEL','solar'),('ENGINE','gas_engine'),('FLUIDTANK','tank'),('SEAT','vehicle_seat'),('DOOR','vehicle_door')]:
   if flag in flags:return art
 if cat=='overmap_terrain':
  if chain & {'generic_city_building_no_sidewalk','generic_city_building','generic_mall','generic_city_building_roof','generic_mansion_entrance','apartments_tower_any','apartments_tower_roof_any','generic_private_resort','generic_stadium_park','generic_bastion_fort','generic_evac_center'}:return 'building'
  if chain & {'generic_water','generic_water_shore','generic_lake','generic_ocean','river_center','lake_surface'}:return 'overmap_water'
 return None

appearance=json.loads((root/'inputs/appearance-index.json').read_text('utf8'));manifest=json.loads((root/'manifest.json').read_text('utf8'));uncovered={(x['category'],x['display_id']) for x in manifest['targets'] if x['status']=='unsupported'}
groups=defaultdict(list)
for x in appearance['candidates']:
 if (x['category'],x['display_id']) not in uncovered:continue
 f=x['facts'] or {};kind=choose(x['category'],f);color=f.get('color')
 if kind and isinstance(color,str) and color in color_main:groups[(x['category'],kind,color)].append(x)
signatures={hashlib.sha256(Image.open(p).convert('RGBA').tobytes()).hexdigest():p.stem for p in (root/'sprites').glob('*.png')}
plan=json.loads((root/'inputs/plan.json').read_text('utf8'));start=len(plan);rules=[];added=[]
for (cat,kind,color),members in sorted(groups.items()):
 pattern=templates[kind];w=max(map(len,pattern));h=len(pattern);assert w<=16 and h<=16
 rows=['.'*16 for _ in range(16)];x0=(16-w)//2;y0=(16-h)//2
 for y,line in enumerate(pattern):rows[y0+y]='.'*x0+line.replace('m',color_main[color])+'.'*(16-x0-len(line))
 sig=hashlib.sha256(bytes(v for line in rows for c in line for v in bytes.fromhex(palette[c]))).hexdigest();art=signatures.get(sig);ids=[m['display_id'] for m in members]
 # Separate atlas banks: an identical shape in overmap and core must still be available in both.
 if art and cat=='overmap_terrain':
  prior=json.loads((root/'source'/f'{art}.json').read_text('utf8'))
  if prior.get('category')!='overmap_terrain':art=None
 if art is None:
  art='object_'+cat+'_'+kind+'_'+color
  data={'name':art,'width':16,'height':16,'category':cat,'authoring':'Original native 256-cell matrix. Shared structural object class; not a unique depiction of every mapped ID.','palette':{c:'#'+palette[c] for c in sorted(set(''.join(rows)))},'rows':rows,'display_ids':[ids[0]],'structural_family':kind,'display_palette':color}
  (root/'source'/f'{art}.json').write_text(json.dumps(data,indent=2),'utf8');signatures[sig]=art;plan.append([art,[ids[0]],'native shared '+cat+' '+kind+' '+color]);added.append(art)
 rules.append({'rule':'object_structural_family_v1','category':cat,'asset':art,'member_ids':ids,'match_fields':{'native_archetype':kind,'source_color':color,'classifier':'choose(category, appearance facts) in object-families.py'},'meaning':'Shared structural-class icon and source color; not individual anatomy, equipment model, room contents, behavior, or exact size. Original engine IDs unchanged.','source_origins':[m['facts']['_origin'] for m in members]})
(root/'inputs/plan.json').write_text(json.dumps(plan,indent=2),'utf8');(root/'inputs/object-family-aliases.json').write_text(json.dumps({'rules':rules,'new_native_art':added,'member_IDs':sum(len(r['member_ids']) for r in rules)},ensure_ascii=False,indent=2),'utf8')
print(json.dumps({'previous_native':start,'new_native':len(added),'total_native':len(plan),'profile_groups':len(groups),'new_member_IDs':sum(len(r['member_ids']) for r in rules)}))
