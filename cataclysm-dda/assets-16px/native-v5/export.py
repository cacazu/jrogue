import hashlib
import json
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root=Path(__file__).resolve().parent
for name in ['sprites','source-grid','proof','previews']:(root/name).mkdir(exist_ok=True)
results=[]
selected=set(sys.argv[1:]);previous={v['asset']:v for v in json.loads((root/'native-source-validation.json').read_text('utf8'))} if selected else {}
for file in sorted((root/'source').glob('*.json')):
    data=json.loads(file.read_text('utf8'))
    if selected and data['name'] not in selected:
        cached=previous[data['name']]
        assert cached['source_sha256']==hashlib.sha256(file.read_bytes()).hexdigest()
        assert cached['native_sha256']==hashlib.sha256((root/'sprites'/f'{data["name"]}.png').read_bytes()).hexdigest()
        results.append(cached)
        continue
    rows=data['rows']
    assert data['width']==data['height']==16
    assert len(rows)==16 and all(len(row)==16 for row in rows), 'Source MUST be exactly 16 rows and 16 columns.'
    palette={k:tuple(bytes.fromhex(v[1:])) for k,v in data['palette'].items()}
    assert all(len(c)==4 and c[3] in [0,255] for c in palette.values())
    assert all(c in palette for row in rows for c in row)
    scale=24
    source_grid=Image.new('RGBA',(16*scale,16*scale))
    draw=ImageDraw.Draw(source_grid)
    for y,row in enumerate(rows):
        for x,symbol in enumerate(row):
            draw.rectangle((x*scale,y*scale,(x+1)*scale-1,(y+1)*scale-1),fill=palette[symbol])
    grid_path=root/'source-grid'/f'{data["name"]}-source-grid.png'
    source_grid.save(grid_path)
    # Validate the actual encoded source grid BEFORE lossless export.
    decoded_source=Image.open(grid_path).convert('RGBA')
    pixels=[]
    for y,row in enumerate(rows):
        for x,symbol in enumerate(row):
            block=decoded_source.crop((x*scale,y*scale,(x+1)*scale,(y+1)*scale))
            block_colors=set(block.get_flattened_data())
            assert block_colors=={palette[symbol]}, 'Subcell feature or nonflat color detected.'
            pixels.append(next(iter(block_colors)))
    # No image resize/downsampling: one validated source cell becomes one native pixel.
    native=Image.new('RGBA',(16,16));native.putdata(pixels)
    path=root/'sprites'/f'{data["name"]}.png';native.save(path)
    reopened=Image.open(path).convert('RGBA')
    assert list(reopened.get_flattened_data())==pixels
    reopened.resize((256,256),Image.Resampling.NEAREST).save(root/'previews'/f'{data["name"]}-16x.png')
    font=ImageFont.truetype(r'C:\Windows\Fonts\consola.ttf',13)
    title=ImageFont.truetype(r'C:\Windows\Fonts\consolab.ttf',20)
    proof=Image.new('RGB',(720,550),'#121921');d=ImageDraw.Draw(proof)
    d.text((20,16),data['name']+' / NATIVE SOURCE: 16 COLUMNS x 16 ROWS',font=title,fill='#e8dcc0')
    d.text((20,46),'256 flat cells | 0 subcell details | NO high-resolution reduction',font=font,fill='#acd1cd')
    ox=46;oy=100
    for y,row in enumerate(rows):
        for x,symbol in enumerate(row):
            rgba=palette[symbol]
            bg=(51,61,72) if (x+y)%2 else (40,49,60)
            d.rectangle((ox+x*scale,oy+y*scale,ox+(x+1)*scale-1,oy+(y+1)*scale-1),fill=rgba[:3] if rgba[3] else bg)
    for i in range(17):
        d.line((ox+i*scale,oy,ox+i*scale,oy+16*scale),fill='#88949d')
        d.line((ox,oy+i*scale,ox+16*scale,oy+i*scale),fill='#88949d')
    for i in range(16):
        d.text((ox+i*scale+4,oy-20),str(i+1),font=font,fill='#e8dcc0')
        d.text((ox-25,oy+i*scale+4),str(i+1),font=font,fill='#e8dcc0')
    d.text((465,96),'Native PNG: 16 x 16',font=font,fill='#e8dcc0')
    proof.paste(native,(475,124),native)
    d.text((465,165),'Same cells, 8x preview:',font=font,fill='#e8dcc0')
    preview=native.resize((128,128),Image.Resampling.NEAREST);proof.paste(preview,(475,196),preview)
    d.text((465,355),'SOURCE rows:',font=font,fill='#acd1cd')
    for y,row in enumerate(rows[:10]):d.text((465,375+y*14),row,font=font,fill='#e8dcc0')
    d.text((46,505),'Transparent cells remain alpha 0; artwork cells are alpha 255.',font=font,fill='#acd1cd')
    proof.save(root/'proof'/f'{data["name"]}-native-grid-proof.png')
    results.append({'asset':data['name'],'source_file':'source/'+file.name,'source_sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'source_rows':len(rows),'source_columns_per_row':[len(row) for row in rows],'source_cells':256,'actual_source_grid_png_size':list(decoded_source.size),'pixels_per_flat_source_cell':scale,'every_source_cell_exactly_one_RGBA_color':True,'subcell_features':0,'antialiasing':False,'lossless_cell_collapse_matches_source':True,'native_png_size':list(native.size),'native_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'opaque_cells':sum(c[3]==255 for c in pixels),'transparent_cells':sum(c[3]==0 for c in pixels),'display_ids':data['display_ids'],'imagegen_usage':'original mood/concept drafts only; final art explicitly authored in native palette-cell matrices'})
(root/'native-source-validation.json').write_text(json.dumps(results,indent=2),'utf8')
print(json.dumps(results,indent=2))
