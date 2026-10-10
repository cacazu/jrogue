"""Original native creature silhouettes; shared structural classes, not species-unique art."""
import hashlib,json
from collections import defaultdict
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parent
palette={'.':'00000000','X':'151b24ff','H':'5d4036ff','S':'e8dcc0ff','B':'bd996fff','O':'4b503bff','L':'909567ff','J':'68737cff','P':'29313bff','R':'8b664bff','G':'9aa5aaff','D':'c4cbc4ff','K':'f3eee1ff','r':'56312eff','q':'873e32ff','Q':'b35636ff','o':'df843dff','Y':'f2bc68ff','v':'697047ff','V':'b3b98bff','U':'294747ff','u':'41656aff','T':'6c9293ff','C':'acd1cdff','M':'39354dff','N':'645370ff','F':'9b849bff','n':'414b57ff','W':'352b2bff','b':'243b53ff','t':'7395aaff'}
templates={
'bird': ['.......XXX....','......XmmSX...','.....XmmmXYX..','....XmmmX.XX..','.XXXXmmmmX....','XmmmmmmmmX....','.XmmmmmmX.....','..XXXXXXX.....','....X..X......','....Y..Y......'],
'flying_bird':['X..........X..','XmX......XmX..','XmmmX..XmmmX..','.XmmmXXmmmX...','..XmmmmmmX....','...XmmSmmX....','....XmYmX.....','.....XXX......'],
'fish':['......X.......','...XXXmXXX....','..XmmmmmmmXX..','.XmmSmmmmmmmXX','Xmmmmmmmmmmmmm','XmmmmmmmmmmmXX','.XmmmmmmmXXX..','..XXXmXXX.....','.....X........'],
'frog':['..XX......XX..','.XmmX....XmmX.','.XmSX....XSmX.','..XmmmmmmmmX..','.XmmmmmmmmmmX.','XmmmmmmmmmmmmX','XmmmXXmmXXmmmX','.XmmX....XmmX.','..XXX....XXX..'],
'snake':['...XXXXXX.....','..XmmmmmmX....','.XmXXXXmmX....','.XmX..XmmX....','.XmX..XmmX....','.XmX.XmmX.....','.XmXXmmX......','..XmmmmX......','...XXXmmXXXX..','......XmmmmmX.','.......XXXmSX.','..........XX..'],
'pig':['.XX......XX...','.XmmXXXXXmmX..','..XmmmmmmmmX..','.XmmmmmmmSmmX.','XmmmmmmmmXYYmX','XmmmmmmmmXYYmX','.XmmmmmmXXXXX.','..XmXmXmXmX...','..XXX.XXX.....'],
'spider':['X..X......X..X','.X.X......X.X.','..XXXX..XXXX..','....XmmmmX....','XXXXmmmmmmXXXX','....XmmmmX....','..XXXX..XXXX..','.X.X......X.X.','X..X......X..X'],
'horse':['.......XX.....','......XmmX....','......XmSX....','...XXXmmmmXX..','..XmmmmmmmXX..','XXmmmmmmmX....','X.XmmmmmmX....','...XmXXmmX....','...XmX.XmX....','...XmX.XmX....','...XXX.XXX....'],
'bear':['..XX....XX....','.XmmXXXXmmX...','..XmmmmmmX....','.XmmSmSmmmX...','XmmmmmmmmmmX..','XmmmmXXmmmmX..','XmmmmmSmmmmX..','.XmmmmmmmmX...','..XmmmmmmX....','..XmmXXmmX....','..XXXX.XXX....'],
'crab':['..XXX....XXX..','.XmmmX..XmmmX.','..XmX....XmX..','..XmXXXXXXmX..','.XmmmmmmmmmmX.','X.XmmmmmmmmX.X','X.XmmmmmmmmX.X','X..XmX..XmX..X','...XXX..XXX...'],
'turtle':['...XXXXXX.....','..XmmLmmmX....','.XmmLLLmmmX...','XmmLXXXLmmmXXX','XmmLXmmXLmmmSm','XmmLXXXLmmmXXX','.XmmLLLmmmX...','..XmX..XmX....','..XXX..XXX....'],
'blob':['......XXX.....','....XXmmmXX...','...XmmLmmmmX..','..XmmLLLmmmmX.','.XmmmLLmmmmmmX','XmmmmmmmmmmmmX','XmmLmmmmmLmmmX','.XmmmmmmmmmmX.','..XXXXXXXXXX..'],
'lizard':['XX........XX..','.XmX.....XmSX.','..XmXXXXXXmmX.','...XmmmmmmmmX.','..X.XmmmmmmX.X','.X..XmX..XmX.X','....XXX..XXX..'],
'insect':['...X....X.....','....X..X......','....XmmX......','..XXmXXmXX....','.X..XmmX..X...','X....XX....X..','..XXXmmXXX....','.X..XmmX..X...','X....XX....X..','..XXmmmmXX....','.X.XmmmmX.X...','X...XmmX...X..','.....XX.......'],
'flying_insect':['...X....X.....','....XmmX......','.CCCXmmXCCC...','CCCCXmmXCCCC..','CCCCXmmXCCCC..','.CCCXmmXCCC...','....XmmX......','...XmXXmX.....','...XX..XX.....'],
'migo':['...X....X.....','...XmXXmX.....','....XmmX......','..XXmmmmXX....','.XmmmmmmmmX...','XmmXmmmmXmmX..','Xm.XmmmmX.mX..','XX..XmmX..XX..','...XmmmmX.....','..XmX..XmX....','.XmX....XmX...','..XX....XX....'],
'cow':['..Y......Y....','.YX......XY...','.YmXXXXXXmY...','..XmmmmmmX....','.XmmSmSmmmX...','XmmmmmmmmmmX..','XmmmmmmmmmmX..','XmmmmmmYYmmX..','.XmmmmmYYmX...','..XmmmmmmX....','..XmXXmXXmX...','..XXX.XXXX....'],
'kangaroo':['...X..X.......','...XmXmX......','....XmmSX.....','.....XmmX.....','....XmmmmX....','...XmmmmmmX...','..XmmmXmmmmX..','..XXX.XmmmmX..','......XmmmmmXX','.....XmmXXmmmm','....XmmX..XXX.','...XXXX.......'],
'human':['....XXXX....','...XmmmSX...','...XmXXmX...','....XmmX....','...XmmmmX...','.XXmmmmmmXX.','XmmXmmmmXmmX','XXXXmmmmXXXX','...XmmmmX...','....XmmX....','...XmmmmX...','...XmXXmX...','...XmXXmX...','...XXX.XXX..'],
'robot':['...XXXXXXXX...','...XGGGGGGX...','...XGYYGYYX...','...XXXXXXXX...','.XXmmmmmmmmXX.','XGmmmmXXmmmmGX','XGmmXGGGGXmmGX','XGmmXGGGGXmmGX','.XXmmmmmmmmXX.','...XXmmmmXX...','..XGGX..XGGX..','..XGGX..XGGX..','..XXXX..XXXX..'],
'fungus':['.....XXXX.....','...XXmmmmXX...','..XmmSSSmmmX..','.XmmSmmmmSmmX.','XmmmmmmmmmmmmX','XXXXXXXXXXXXXX','.....XSSX.....','.....XSSX.....','....XSSSSX....','...XXXXXXXX...'],
'trifacet':['......XX......','.....XmmX.....','....XmmmmX....','...XmmXXmmX...','..XmmXGGXmmX..','.XmmXGGGGXmmX.','XmmXXXXXXXXmmX','.XXmmXGGXmmXX.','..XXmmXXmmXX..','...XXmmmmXX...','....XXXXXX....'],
'apeirohedra':['....XXXXXXXX..','...XmmXXXXmX..','..XmmXmmmXmX..','.XmmXmmmXXmX..','XmmXXXXXXmmX..','XmmXmmmmXmmX..','XmmXmmmmXmmX..','XmmXmmmmXmmX..','XmmXXXXXXmmX..','.XXmXmmXXmX...','..XXmmmXmmX...','...XXXXXXX....']
}
# Native templates already designed in previous batches, not high-res references.
for name in ['dog','cat','skeleton','ant']:
    data=json.loads((root/'source'/f'{name}.json').read_text('utf8'))
    rows=data['rows']
    substitutions={'dog':{'R':'m','B':'L','H':'m'},'cat':{'J':'m','G':'L'},'skeleton':{'S':'m','K':'L'},'ant':{'R':'m'}}[name]
    templates[name]=[''.join(substitutions.get(c,c) for c in line) for line in rows]

color_main={'black':'P','white':'S','light_gray':'G','dark_gray':'n','red':'q','light_red':'Q','green':'v','light_green':'L','brown':'R','yellow':'Y','blue':'b','light_blue':'t','cyan':'u','light_cyan':'C','magenta':'N','pink':'F','light_magenta':'F'}
data=json.loads((root/'inputs/appearance-index.json').read_text('utf8'))
previous=json.loads((root/'manifest.json').read_text('utf8'))
unsupported={(t['category'],t['display_id']) for t in previous['targets'] if t['status']=='unsupported'}
def material_set(raw):
    if isinstance(raw,dict):return sorted(raw.keys())
    if isinstance(raw,list):return sorted(v.get('type','') if isinstance(v,dict) else v for v in raw)
    return [str(raw)] if raw else []
def choose(f):
    body=f.get('bodytype');species=set(f.get('species',[]));mat=set(material_set(f.get('material')))
    if body=='human' and 'bone' in mat:return 'skeleton'
    if body=='human' and mat & {'steel','iron','aluminum','plastic'}:return 'robot'
    if body=='bird':return 'flying_bird' if 'FLIES' in f.get('flags',[]) else 'bird'
    if body=='dog' and str(f.get('symbol','')).lower()=='c':return 'cat'
    if body=='flying insect':return 'flying_insect'
    if body in templates:return body
    if 'ROBOT' in species:return 'robot'
    if 'FUNGUS' in species:return 'fungus'
    if 'BLOB' in species:return 'blob'
    return None

groups=defaultdict(list)
for candidate in data['candidates']:
    if candidate['category']!='monster' or ('monster',candidate['display_id']) not in unsupported:continue
    f=candidate['facts'] or {};kind=choose(f)
    color=f.get('color')
    if kind and isinstance(color,str) and color in color_main:
        key=(kind,color,tuple(material_set(f.get('material'))),tuple(sorted(f.get('species',[]))),str(f.get('symbol','')))
        groups[key].append(candidate)
image_signatures={}
for p in (root/'sprites').glob('*.png'):
    image_signatures[hashlib.sha256(Image.open(p).convert('RGBA').tobytes()).hexdigest()]=p.stem
plan=json.loads((root/'inputs/plan.json').read_text('utf8'));base_count=len(plan)
aliases=[];new_art=[];mutable={}
for profile,members in sorted(groups.items()):
    kind,color,materials,species,symbol=profile
    pattern=templates[kind];w=max(map(len,pattern));h=len(pattern);assert w<=16 and h<=16,(kind,w,h)
    x0=(16-w)//2;y0=(16-h)//2;rows=['.'*16 for _ in range(16)]
    for y,line in enumerate(pattern):
        line=line.replace('m',color_main[color]);rows[y+y0]='.'*x0+line+'.'*(16-x0-len(line))
    used=set(''.join(rows));rgba=[tuple(bytes.fromhex(palette[c])) for row in rows for c in row]
    sig=hashlib.sha256(bytes(v for px in rgba for v in px)).hexdigest()
    art=image_signatures.get(sig)
    ids=[m['display_id'] for m in members]
    if art is None:
        art='creature_'+kind+'_'+color
        if (root/'source'/f'{art}.json').exists():art+='_'+sig[:6]
        source={'name':art,'width':16,'height':16,'category':'monster','authoring':'Original native structural-family silhouette and palette variant. Every symbol is one source pixel. No high-resolution sampling. Shared family representation, not unique species anatomy.','palette':{c:'#'+palette[c] for c in sorted(used)},'rows':rows,'display_ids':[ids[0]],'structural_family':kind,'display_palette':color}
        mutable[art]=source;image_signatures[sig]=art
        plan.append([art,[ids[0]],'native structural creature family: '+kind+'/'+color]);new_art.append(art)
    aliases.append({'rule':'creature_structural_family_v1','asset':art,'category':'monster','member_ids':ids,'match_fields':{'native_archetype':kind,'source_color':color,'source_materials':list(materials),'source_species':list(species),'source_symbol':symbol},'meaning':'Shared native family silhouette with source color. Not species-unique art and not gameplay equivalence. Every member retains original engine ID and behavior.','source_origins':[m['facts']['_origin'] for m in members]})
for name,s in mutable.items():(root/'source'/f'{name}.json').write_text(json.dumps(s,indent=2),'utf8')
(root/'inputs/plan.json').write_text(json.dumps(plan,indent=2),'utf8')
(root/'inputs/creature-family-aliases.json').write_text(json.dumps({'rules':aliases,'new_native_art':new_art,'source_profile_groups':len(groups),'member_IDs':sum(len(a['member_ids']) for a in aliases),'coarse_family_art_not_unique_species':True},ensure_ascii=False,indent=2),'utf8')
print(json.dumps({'previous_native_art':base_count,'new_distinct_native_images':len(new_art),'total_native_art':len(plan),'source_profile_groups':len(groups),'monster_IDs_shared_or_dedicated':sum(len(a['member_ids']) for a in aliases)},indent=2))
