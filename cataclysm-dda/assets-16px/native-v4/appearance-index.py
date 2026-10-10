"""Conservative source appearance facts; no engine writes or guessed names."""
import json
from pathlib import Path
from collections import defaultdict

root=Path(__file__).resolve().parent
src=Path(r'C:\Users\kit\gameme\jnethack\jrouge\cataclysm-dda\upstream\Cataclysm-DDA-7b2efa5cea38e4d4d97dd0e63b28b9148623da59')
inventory=json.loads((root/'inputs/inventory.json').read_text('utf8'))
categories={'ITEM':'item','MONSTER':'monster','terrain':'terrain','furniture':'furniture','field_type':'field','trap':'trap','vehicle_part':'vehicle_part','overmap_terrain':'overmap_terrain'}
records=defaultdict(list)
for p in sorted((src/'data/json').rglob('*.json')):
    entries=json.loads(p.read_bytes())
    if not isinstance(entries,list):entries=[entries]
    for i,e in enumerate(entries):
        if not isinstance(e,dict) or e.get('type') not in categories:continue
        cat=categories[e['type']]
        ids=e.get('id',e.get('abstract'))
        if not ids:continue
        ids=ids if isinstance(ids,list) else [ids]
        for ident in ids:
            records[(cat,ident)].append({'data':e,'origin':{'file':p.relative_to(src).as_posix(),'json_pointer':'/'+str(i)}})

def unambiguous(cat,ident):
    recs=records.get((cat,ident),[])
    if not recs:return None
    # Multiple records are accepted only when the entire definition agrees.
    if len({json.dumps(r['data'],sort_keys=True) for r in recs})>1:return None
    return recs[0]

memo={}
def resolve(cat,ident,seen=()):
    key=(cat,ident)
    if key in memo:return memo[key]
    if key in seen:return None
    rec=unambiguous(cat,ident)
    if not rec:return None
    data=rec['data'];parent=data.get('copy-from')
    inherited=resolve(cat,parent,seen+(key,)) if parent else {}
    if parent and inherited is None:return None
    fields={k:v for k,v in (inherited or {}).items() if not k.startswith('_')}
    # Only direct appearance facts. Nested slots retained for structural audits,
    # not treated as a full gameplay loader/emulator.
    fields.update({k:v for k,v in data.items() if k not in ['id','abstract','type','copy-from','looks_like']})
    for mode in ['extend','delete']:
        for key,values in data.get(mode,{}).items():
            if key in ['flags','subtypes','covers','species'] and isinstance(values,list):
                old=fields.get(key,[])
                if isinstance(old,list):
                    fields[key]=(old+[v for v in values if v not in old]) if mode=='extend' else [v for v in old if v not in values]
    inherited_ll=(inherited or {}).get('_looks_like',[])
    own=data.get('looks_like')
    if own is not None:
        ll=own if isinstance(own,list) else [own]
    elif cat in ['terrain','furniture']:
        ll=[parent] if parent else inherited_ll
    elif cat=='overmap_terrain':
        ll=([parent] if parent else [])+inherited_ll
    elif cat=='monster':
        ll=inherited_ll or ([parent] if parent else [])
    elif cat=='item':
        real=unambiguous(cat,parent) if parent else None
        # Item_factory::has_template checks concrete templates, not abstracts.
        ll=[parent] if real and 'id' in real['data'] else inherited_ll
    else:
        ll=inherited_ll
    fields['_looks_like']=[x for x in ll if isinstance(x,str) and x]
    fields['_chain']=list((inherited or {}).get('_chain',[]))+[ident]
    fields['_origin']=rec['origin']
    fields['_id_array']=data.get('id') if isinstance(data.get('id'),list) else [ident]
    memo[key]=fields
    return fields

out=[]
keep={'name','symbol','sym','color','bodytype','species','material','volume','weight','subtypes','category','weapon_category','skill','ammo','ammo_type','comestible_type','container','covers','flags','armor','pocket_data','variants','variants_bases','symbols','symbols_broken','intensity_levels','phase','casing','_looks_like','_chain','_origin','_id_array'}
def appearance_only(facts):
    return {k:v for k,v in facts.items() if k in keep} if facts is not None else None
for t in inventory['targets']:
    cat=t['category'];ident=t['display_id'];raw_id=ident[3:] if cat=='vehicle_part' else ident
    facts=resolve(cat,raw_id) if cat!='runtime' else None
    out.append({'category':cat,'display_id':ident,'appearance_unambiguous':facts is not None,'facts':appearance_only(facts)})
abstracts=[]
for (cat,ident),recs in records.items():
    r=unambiguous(cat,ident)
    if r and 'abstract' in r['data']:
        abstracts.append({'category':cat,'id':ident,'facts':appearance_only(resolve(cat,ident))})
(root/'inputs/appearance-index.json').write_text(json.dumps({'candidates':out,'abstracts':abstracts,'rules':{'terrain_furniture':'mapdata.cpp 1010-1013 copy-from sets looks_like, explicit looks_like overrides','item':'item_factory.cpp 4198-4206: concrete copy-from becomes looks_like; abstract inheritance retains parent looks_like; explicit override wins','monster':'monstergenerator.cpp 786-789: inherited nonempty looks_like retained; otherwise copy-from; explicit override wins','overmap':'overmap.cpp 918-928: explicit list overrides; otherwise prepend copy-from to inherited looks_like','ambiguity':'Any multiple source definitions differing in content are left unresolved; not assumed active runtime load order.'}},ensure_ascii=False,indent=2),'utf8')
print(json.dumps({'resolved':sum(x['appearance_unambiguous'] for x in out),'ambiguous_or_runtime':sum(not x['appearance_unambiguous'] for x in out),'abstracts':len(abstracts),'source_json_files':3013}))
