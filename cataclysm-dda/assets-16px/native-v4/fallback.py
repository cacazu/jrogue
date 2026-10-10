"""Original native stencil glyphs. Diagnostic fallback, NOT completed pictorial artwork."""
import hashlib,json,math
from collections import defaultdict,Counter
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
root=Path(__file__).resolve().parent;out=root/'fallback'
for folder in ['source','sprites','source-grid']:(out/folder).mkdir(parents=True,exist_ok=True)
# Each slash-separated line is an original 5-cell-wide monochrome stencil row.
font={
'A':'01110/10001/10001/11111/10001/10001/10001','B':'11110/10001/10001/11110/10001/10001/11110','C':'01111/10000/10000/10000/10000/10000/01111','D':'11110/10001/10001/10001/10001/10001/11110','E':'11111/10000/10000/11110/10000/10000/11111','F':'11111/10000/10000/11110/10000/10000/10000','G':'01111/10000/10000/10111/10001/10001/01111','H':'10001/10001/10001/11111/10001/10001/10001','I':'11111/00100/00100/00100/00100/00100/11111','J':'00111/00010/00010/00010/00010/10010/01100','K':'10001/10010/10100/11000/10100/10010/10001','L':'10000/10000/10000/10000/10000/10000/11111','M':'10001/11011/10101/10101/10001/10001/10001','N':'10001/11001/10101/10101/10011/10001/10001','O':'01110/10001/10001/10001/10001/10001/01110','P':'11110/10001/10001/11110/10000/10000/10000','Q':'01110/10001/10001/10001/10101/10010/01101','R':'11110/10001/10001/11110/10100/10010/10001','S':'01111/10000/10000/01110/00001/00001/11110','T':'11111/00100/00100/00100/00100/00100/00100','U':'10001/10001/10001/10001/10001/10001/01110','V':'10001/10001/10001/10001/10001/01010/00100','W':'10001/10001/10001/10101/10101/10101/01010','X':'10001/10001/01010/00100/01010/10001/10001','Y':'10001/10001/01010/00100/00100/00100/00100','Z':'11111/00001/00010/00100/01000/10000/11111',
'0':'01110/10001/10011/10101/11001/10001/01110','1':'00100/01100/00100/00100/00100/00100/01110','2':'01110/10001/00001/00010/00100/01000/11111','3':'11110/00001/00001/01110/00001/00001/11110','4':'00010/00110/01010/10010/11111/00010/00010','5':'11111/10000/10000/11110/00001/00001/11110','6':'01110/10000/10000/11110/10001/10001/01110','7':'11111/00001/00010/00100/01000/01000/01000','8':'01110/10001/10001/01110/10001/10001/01110','9':'01110/10001/10001/01111/00001/00001/01110',
'?':'01110/10001/00001/00010/00100/00000/00100','!':'00100/00100/00100/00100/00100/00000/00100','@':'01110/10001/10111/10101/10111/10000/01110','#':'01010/11111/01010/01010/11111/01010/00000','%':'11001/11010/00100/01000/10110/00110/00000','&':'01100/10010/10100/01000/10101/10010/01101','$':'00100/01111/10100/01110/00101/11110/00100','*':'00000/10101/01110/11111/01110/10101/00000','+':'00000/00100/00100/11111/00100/00100/00000','-':'00000/00000/00000/11111/00000/00000/00000','=':'00000/00000/11111/00000/11111/00000/00000','/':'00001/00001/00010/00100/01000/10000/10000','\\':'10000/10000/01000/00100/00010/00001/00001','|':'00100/00100/00100/00100/00100/00100/00100','<':'00010/00100/01000/10000/01000/00100/00010','>':'01000/00100/00010/00001/00010/00100/01000','^':'00100/01010/10001/00000/00000/00000/00000','~':'00000/00000/01001/10110/00000/00000/00000','_':'00000/00000/00000/00000/00000/00000/11111','(':'00010/00100/01000/01000/01000/00100/00010',')':'01000/00100/00010/00010/00010/00100/01000','[':'01110/01000/01000/01000/01000/01000/01110',']':'01110/00010/00010/00010/00010/00010/01110','{':'00011/00100/00100/11000/00100/00100/00011','}':'11000/00100/00100/00011/00100/00100/11000',':':'00000/00100/00100/00000/00100/00100/00000',';':'00000/00100/00100/00000/00100/00100/01000',',':'00000/00000/00000/00000/00100/00100/01000','.':'00000/00000/00000/00000/00000/00100/00100',"'":'00100/00100/01000/00000/00000/00000/00000','"':'01010/01010/01010/00000/00000/00000/00000',' ':'00000/00000/00000/00000/00000/00000/00000',
'a':'00000/00000/01110/00001/01111/10001/01111','b':'10000/10000/10110/11001/10001/10001/11110','c':'00000/00000/01110/10000/10000/10000/01110','d':'00001/00001/01101/10011/10001/10001/01111','e':'00000/00000/01110/10001/11111/10000/01110','f':'00110/01001/01000/11100/01000/01000/01000','g':'00000/01111/10001/10001/01111/00001/01110','h':'10000/10000/10110/11001/10001/10001/10001','i':'00100/00000/01100/00100/00100/00100/01110','j':'00010/00000/00110/00010/00010/10010/01100','k':'10000/10000/10010/10100/11000/10100/10010','l':'01100/00100/00100/00100/00100/00100/01110','m':'00000/00000/11010/10101/10101/10101/10101','n':'00000/00000/10110/11001/10001/10001/10001','o':'00000/00000/01110/10001/10001/10001/01110','p':'00000/11110/10001/10001/11110/10000/10000','q':'00000/01111/10001/10001/01111/00001/00001','r':'00000/00000/10110/11001/10000/10000/10000','s':'00000/00000/01111/10000/01110/00001/11110','t':'01000/01000/11100/01000/01000/01001/00110','u':'00000/00000/10001/10001/10001/10011/01101','v':'00000/00000/10001/10001/10001/01010/00100','w':'00000/00000/10001/10001/10101/10101/01010','x':'00000/00000/10001/01010/00100/01010/10001','y':'00000/10001/10001/01111/00001/00001/01110','z':'00000/00000/11111/00010/00100/01000/11111',
}
colors={'black':'29313bff','white':'e8dcc0ff','light_gray':'9aa5aaff','dark_gray':'68737cff','red':'873e32ff','light_red':'b35636ff','green':'697047ff','light_green':'909567ff','brown':'8b664bff','yellow':'f2bc68ff','blue':'243b53ff','light_blue':'7395aaff','cyan':'41656aff','light_cyan':'acd1cdff','magenta':'645370ff','pink':'9b849bff','light_magenta':'9b849bff'}
# Hand-authored Unicode box-line primitives, not copied from any font raster.
connections={'│':'NS','─':'EW','┌':'ES','┐':'WS','└':'EN','┘':'WN','├':'NES','┤':'NSW','┬':'ESW','┴':'NEW','┼':'NESW','║':'NS','═':'EW','╔':'ES','╗':'WS','╚':'EN','╝':'WN','╠':'NES','╣':'NSW','╦':'ESW','╩':'NEW','╬':'NESW'}
facts=json.loads((root/'inputs/appearance-index.json').read_text('utf8'));facts={(x['category'],x['display_id']):x['facts'] or {} for x in facts['candidates']}
manifest=json.loads((root/'manifest.json').read_text('utf8'));groups=defaultdict(list)
for t in manifest['targets']:
 if t['status']!='unsupported':continue
 f=facts.get((t['category'],t['display_id']),{});glyph=f.get('symbol',f.get('sym'));color=f.get('color');origin='source symbol/color'
 if t['category']=='vehicle_part':
  variants=f.get('variants',[]);glyph=variants[0].get('symbols') if variants and isinstance(variants[0],dict) else f.get('symbols');origin='first listed vehicle variant symbols, generic fallback only'
 if t['category']=='field':
  levels=f.get('intensity_levels',[]);glyph=levels[0].get('sym') if levels else None;color=levels[0].get('color',color) if levels else color;origin='first intensity level, base-ID diagnostic only; derived intensity not claimed'
 if isinstance(glyph,list):glyph=glyph[0] if glyph else None
 if isinstance(glyph,str) and glyph:glyph=glyph[0]
 else:glyph='?';origin+='; no static symbol, explicit question-mark placeholder'
 exact=glyph in font or glyph in connections
 if not exact:origin+='; unsupported Unicode stencil replaced by explicit question mark'
 if not isinstance(color,str) or color not in colors:color='white';origin+='; neutral diagnostic color, runtime/default color not asserted'
 bank='overmap' if t['category']=='overmap_terrain' else 'core'
 groups[(bank,glyph,color,exact)].append((t,origin))

assets=[];entries=[];validation=[];signatures={}
for (bank,glyph,color,exact),members in sorted(groups.items()):
 grid=[['.']*16 for _ in range(16)]
 if glyph in connections:
  arms=connections[glyph]
  for y in range(16):
   for x in range(16):
    if (6<=x<=9 and ((y<=9 and 'N' in arms) or (y>=6 and 'S' in arms))) or (6<=y<=9 and ((x<=9 and 'W' in arms) or (x>=6 and 'E' in arms))):grid[y][x]='F'
 else:
  rows=font[glyph if exact else '?'].split('/')
  for y,row in enumerate(rows):
   for x,v in enumerate(row):
    if v=='1':
     for yy in [1+y*2,2+y*2]:
      for xx in [3+x*2,4+x*2]:grid[yy][xx]='F'
 # One native-pixel dark outline preserves readability against light map tiles.
 for y in range(16):
  for x in range(16):
   if grid[y][x]=='F':
    for dx,dy in [(-1,0),(1,0),(0,-1),(0,1)]:
     xx=x+dx;yy=y+dy
     if 0<=xx<16 and 0<=yy<16 and grid[yy][xx]=='.':grid[yy][xx]='X'
 rows=[''.join(r) for r in grid];pal={'.':'00000000','X':'151b24ff','F':colors[color]};pixels=[tuple(bytes.fromhex(pal[c])) for row in rows for c in row];sig=hashlib.sha256(bytes(v for p in pixels for v in p)).hexdigest();key=(bank,sig)
 name=signatures.get(key)
 if name is None:
  name=f'fallback_{bank}_{len(assets):04d}';signatures[key]=name
  source={'name':name,'width':16,'height':16,'rows':rows,'palette':{k:'#'+v for k,v in pal.items()},'authoring':'Original native stencil. Diagnostic SYMBOL/PLACEHOLDER FALLBACK, not pictorial completion.','glyph':glyph,'color':color,'exact_stencil':exact}
  (out/'source'/f'{name}.json').write_text(json.dumps(source,ensure_ascii=False,indent=2),'utf8')
  source_png=Image.new('RGBA',(384,384));d=ImageDraw.Draw(source_png)
  for y,row in enumerate(rows):
   for x,c in enumerate(row):d.rectangle((x*24,y*24,(x+1)*24-1,(y+1)*24-1),fill=tuple(bytes.fromhex(pal[c])))
  gp=out/'source-grid'/f'{name}.png';source_png.save(gp);decoded=Image.open(gp).convert('RGBA');native_pixels=[]
  for y,row in enumerate(rows):
   for x,c in enumerate(row):
    values=set(decoded.crop((x*24,y*24,(x+1)*24,(y+1)*24)).get_flattened_data());assert values=={tuple(bytes.fromhex(pal[c]))};native_pixels.append(next(iter(values)))
  native=Image.new('RGBA',(16,16));native.putdata(native_pixels);np=out/'sprites'/f'{name}.png';native.save(np);assert list(Image.open(np).convert('RGBA').get_flattened_data())==pixels
  assets.append({'name':name,'bank':bank,'glyph':glyph,'color':color,'exact_stencil':exact,'png':np.relative_to(root).as_posix(),'source':(out/'source'/f'{name}.json').relative_to(root).as_posix(),'transparent_pixels':sum(p[3]==0 for p in pixels)})
  validation.append({'asset':name,'rows':16,'columns_per_row':[16]*16,'every_source_cell_exactly_one_RGBA_color':True,'cells':256,'subcell_features':0,'native_size':[16,16],'lossless_cell_export':True,'png_sha256':hashlib.sha256(np.read_bytes()).hexdigest(),'pictorial_artwork':False})
 for t,origin in members:entries.append({'category':t['category'],'display_id':t['display_id'],'bank':bank,'fallback_asset':name,'purpose':'diagnostic_symbol' if exact else 'explicit_placeholder','source_mapping':origin,'glyph':glyph,'source_color':color,'pictorial_status':'unsupported'})
(out/'manifest.json').write_text(json.dumps({'assets':assets,'entries':entries,'pictorial_completion_count':0,'purpose':'Separate original native stencil fallback. Every target remains pictorially unsupported; no all-game completion claim.'},ensure_ascii=False,indent=2),'utf8');(out/'native-source-validation.json').write_text(json.dumps(validation,indent=2),'utf8')
for bank in ['core','overmap']:
 arts=[a for a in assets if a['bank']==bank];im=Image.new('RGB',(800,math.ceil(len(arts)/10)*100+60),'#121921');d=ImageDraw.Draw(im);fnt=ImageFont.truetype(r'C:\Windows\Fonts\consola.ttf',11)
 d.text((16,15),'DIAGNOSTIC STENCILS / NOT PICTORIAL COMPLETION / '+bank,font=fnt,fill='#e8dcc0')
 for i,a in enumerate(arts):
  x=i%10*80;y=i//10*100+50;sp=Image.open(root/a['png']).convert('RGBA');big=sp.resize((64,64),Image.Resampling.NEAREST);im.paste(big,(x+8,y),big);d.text((x+2,y+70),a['name'][-4:]+' '+a['color'][:6],font=fnt,fill='#acd1cd')
 im.save(out/f'contact-sheet-{bank}.png')
print(json.dumps({'native_fallback_stencils':len(assets),'fallback_IDs':len(entries),'actual_symbol_stencil_IDs':sum(e['purpose']=='diagnostic_symbol' for e in entries),'explicit_placeholder_IDs':sum(e['purpose']=='explicit_placeholder' for e in entries),'pictorial_completion_added':0}))
