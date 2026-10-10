import csv,hashlib,html,json,math,zipfile
from collections import Counter
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
root=Path(__file__).resolve().parent;m=json.loads((root/'manifest.json').read_text('utf8'));s=m['status'];f=json.loads((root/'fallback/manifest.json').read_text('utf8'));arts=m['assets'];targets=m['targets']
with (root/'id-manifest.csv').open('w',encoding='utf-8-sig',newline='') as file:
 w=csv.writer(file);w.writerow(['category','display_id','pictorial_status','pictorial_asset','mapping_reason','diagnostic_fallback_asset','diagnostic_purpose','source_file','json_pointer'])
 for t in targets:
  o=t['origins'][0];w.writerow([t['category'],t['display_id'],t['status'],t.get('asset') or '',t.get('mapping_reason',''),t.get('fallback_asset',''),t.get('fallback_purpose',''),o['file'],o.get('json_pointer','')])

rows=[]
for category in ['monster','item','terrain','furniture','vehicle_part','field','trap','overmap_terrain','runtime']:
 ts=[t for t in targets if t['category']==category];counts=Counter(t['status'] for t in ts);rows.append({'category':category,'total':len(ts),'dedicated':counts['dedicated'],'shared':counts['shared'],'pictorial_unsupported':counts['unsupported']})
(root/'coverage-by-category.json').write_text(json.dumps(rows,indent=2),'utf8')
guide='''CDDA Native 16px / 固定版 0.I-1 / 第3バッチ累計
==================================================
実寸16×16 PNG。画像原本は16行×16列の明示的な色セル行列です。
画像生成ツールはオリジナルの雰囲気検討に使用しました。最終画像はその高解像度画像を縮小せず、独立した256セルの原本を作成しています。他作品の絵や既存タイル画像は転用していません。

成果と正確な対象数
・終末世界の絵: 439枚。代表ID439件、共用画像のID8,109件、計8,548件。
・絵が未対応: 11,299件。診断用の自作記号866枚を別フォルダに用意。
・診断用フォールバック: 元データに記号があるものはその記号を使用。84件は記号が静的に不明、または自作Unicode字形がないため明示的な「?」です。全アート完成として数えません。
・視界マスク: 5枚。lighting_hidden のみ完全不透明な例外。隠れた視界を覆うためのエンジン用補助で、透明背景の絵439枚とは別枠です。
・PNG合計1,310枚(絵439 + 記号866 + マスク5)。アトラス・拡大プレビュー・セル検査PNGはこの数に含めません。
・表示候補19,847件(バニラJSONの明示的な具体ID19,800 + ランタイムID47)を全件一覧化。obsolete/PSEUDOなども含む静的候補数であり、起動時に有効なID総数ではありません。
・モンスターの体型、衣類のカバー部位、アイテム種別、地形・車両のフラグ、オーバーマップの継承元に基づく共用クラスです。個々の生物種・服装型番・部屋内容の固有の絵ではありません。共用ルールはinputsのfamily-aliases JSONと分類スクリプトに記録。

ファイルの見方
index.html を通常のファイルとして開くと、全候補IDを検索でき、絵と補助記号を区別して確認できます。ネット接続不要です。
sprites/: 絵439枚の原寸PNG。source/: 同じ名前の16×16セルJSON原本。
source-grid/: 検査用の384×384 PNG。1セル24×24の単色ブロックを再読込し、全256ブロックの色が一致してから無損失で1セル→1ピクセルを書き出しました。
proof/: 16列16行の番号と原寸・8倍表示。previews/: nearest-neighborによる16倍表示。
contact-sheet-review.png: 代表例の原寸と8倍表示。
contact-sheet-<カテゴリ>.png: 各カテゴリの全画像一覧。
fallback/: 診断用記号の原寸PNG・原本・単色セル検査画像・全11,299件の対応表。
id-manifest.csv/manifest.json: 全候補のID・元データ位置・絵の対応状態・共用根拠・補助表示。
coverage-by-category.json: カテゴリ別の総数、代表ID、共用、未対応。

導入(本体担当者向け、現在のゲームには適用していません)
固定ソース: Cataclysm-DDA-7b2efa5cea38e4d4d97dd0e63b28b9148623da59。
tileset/CDDA16_Core と CDDA16_Overmap は絵のみ。Core側13579候補、Overmap側6268候補を別に扱い、グローバル文字列ID衝突を避けています。
tileset/CDDA16_Core_Fallback と CDDA16_Overmap_Fallback は未対応IDの診断記号も含む試験用の完成設定です。全19,847静的候補の明示的タイル登録と、各アトラスのセル・PNG一致を検査済み。
4フォルダのうち希望するペアを、複製したゲーム配布用gfxフォルダへコピーしてください。TILES/USE_TILESでCore、OVERMAP_TILESでOvermapを選択します。NAME は cdda16_core(_fallback)、cdda16_overmap(_fallback) です。
WASMではgfxが仮想FSにpreloadされます。HTML横にPNGを置くだけでは読めません。既存リンク終了後に、本体担当者が配布元gfx/preloadへ追加して実機表示を確認してください。この作業ではエンジンビルド・リンク・設定変更をしていません。
実行時表示、複数画像ファイルを持つ診断設定のWASM読込、描画順、マスク、セーブの互換性は本体側の確認待ちです。

範囲外と残作業
Mods、実行時生成の車両派生ID・フィールド強度ID・地形接続/回転/季節/表示距離の派生、死体、装備・変異の重ね絵、個別品種の固有絵は網羅していません。
通常のエンジンlooks_likeを確認して共用するほか、明示的な静的ID登録を行っています。接続別のadditional_tilesや視界別オーバーマップ用派生アートは未作成です。
絵11,299件と上記派生を、記号に置き換えたことで作成済みとは扱いません。必要な固有絵は個別制作を継続する対象です。

保存・検査
元JSON3,013ファイルと既存69枚の原本/PNG138ファイルが変更なし。共有Gitにstage/commit/pushしていません。
native-source-validation.json、fallback/native-source-validation.json、utility/validation.json、diagnostic-atlas-QA.json、source-preservation-final.jsonに検査結果。
再生成は順番に実行: export.py → compile.py → fallback.py → finish-pack.py → deliver.py。
creature-families.py/object-families.pyは当時の未対応スナップショットからの一回限りの制作履歴です。完成入力の上で再実行せず、既存原本から上記エクスポートを使ってください。
Libraryの保存結果IDは親フォルダのhandoff資料に記録します。Windowsにos.setxattrがないためLibraryの来歴xattrは書き込めませんでしたが、アップロード成功はLibrary応答で確認済みです。
'''
(root/'README-ja.txt').write_text(guide,'utf8');(root/'README-current.txt').write_text(guide,'utf8')
# Summary proofs: enough space to identify outlines and preserve native-size comparison.
font=ImageFont.truetype(r'C:\Windows\Fonts\consola.ttf',13);title=ImageFont.truetype(r'C:\Windows\Fonts\consolab.ttf',22)
def sheet(selected,path,label):
 im=Image.new('RGB',(1000,math.ceil(len(selected)/6)*190+70),'#121921');d=ImageDraw.Draw(im);d.text((18,14),label,font=title,fill='#e8dcc0');d.text((18,44),'Native 16x16 + 8x nearest-neighbor; original cell matrices',font=font,fill='#acd1cd')
 for i,a in enumerate(selected):
  x=i%6*166+14;y=i//6*190+70;sp=Image.open(root/a['png']).convert('RGBA');big=sp.resize((128,128),Image.Resampling.NEAREST);d.rectangle((x,y,x+127,y+127),fill='#46515a');im.paste(big,(x,y),big);d.rectangle((x+139,y+55,x+154,y+70),fill='#46515a');im.paste(sp,(x+139,y+55),sp)
  label=a['name'];d.text((x,y+135),label[:20],font=font,fill='#e8dcc0');d.text((x,y+153),label[20:40],font=font,fill='#e8dcc0');d.text((x,y+171),str(sum(t.get('asset')==a['name'] for t in targets))+' IDs (incl shared)',font=font,fill='#acd1cd')
 im.save(root/path)
for cat in sorted({a['category'] for a in arts}):sheet([a for a in arts if a['category']==cat],f'contact-sheet-{cat}.png','CDDA NATIVE / '+cat)
review_names=['survivor','soldier','cop','shocker','spitter','runner','zombie','brute','skeleton','dog','cat','ant','wall','door_closed','window','grass','stairs_up','shallow_water','bed','table','locker','fridge','pistol','combat_knife']
selected=[a for n in review_names for a in arts if a['name']==n]
for kind in ['boots','pants','jacket','helmet','book','meat','fruit','rifle','solar','crate','plant','building']:
 a=next((a for a in arts if '_'+kind+'_' in a['name']),None)
 if a:selected.append(a)
sheet(selected,'contact-sheet-review.png','CDDA / ORIGINAL 16 x 16 / REPRESENTATIVE ART')

picpaths={a['name']:a['png'] for a in arts};fallbackpaths={a['name']:a['png'] for a in f['assets']}
data={'status':s,'art':[{'name':a['name'],'category':a['category'],'png':a['png'],'ids':sum(t.get('asset')==a['name'] for t in targets)} for a in arts],'targets':[{'id':t['display_id'],'category':t['category'],'status':t['status'],'asset':t.get('asset'),'png':picpaths.get(t.get('asset')) or fallbackpaths.get(t.get('fallback_asset')) or (t.get('fallback_asset') if t.get('fallback_purpose')=='visibility_utility' else None),'fallback':t.get('fallback_purpose'),'origin':t['origins'][0]['file']+(t['origins'][0].get('json_pointer') or '')} for t in targets]}
page='''<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>CDDA 16px 原本・ID対応一覧</title><style>body{background:#121921;color:#e8dcc0;font:16px system-ui;margin:24px}h1{font-size:25px}p{max-width:1000px;line-height:1.7}button,input,select{background:#29313b;color:#e8dcc0;border:1px solid #68737c;border-radius:5px;padding:10px;margin:5px}input{width:320px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:15px}.card{padding:16px;background:#202b35;border-radius:8px;overflow-wrap:anywhere}.pic{height:106px;display:flex;align-items:center;gap:24px}.big{width:96px;height:96px;image-rendering:pixelated;background:#46515a}.native{width:16px;height:16px;image-rendering:pixelated;background:#46515a}.tag{font-size:13px;color:#acd1cd}.missing{color:#f2bc68}small{display:block;color:#9aa5aa}#pager{margin:16px 0}</style><h1>CDDA / 実寸16×16アセット</h1><p>終末世界の絵439枚。19,847候補IDのうち、代表439件・共用8,109件に絵があり、11,299件は絵が未対応です。未対応の記号補助は別枠です。全アート完成ではありません。原寸と6倍表示を比較できます。</p><p>固定版0.I-1 / 256単色セルから無損失書出し / 既存ソース・本体設定は変更していません。<a href="README-ja.txt" style="color:#acd1cd">導入資料</a>・<a href="id-manifest.csv" style="color:#acd1cd">全ID一覧CSV</a>・<a href="contact-sheet-review.png" style="color:#acd1cd">画像一覧</a></p><div><select id="mode"><option value="art">作成した絵を確認</option value="targets">表示IDと対応状態を確認</option></select><select id="cat"><option value="">全カテゴリ</option></select><select id="state"><option value="">全状態</option><option value="dedicated">代表ID</option><option value="shared">共用画像</option><option value="unsupported">絵が未対応・記号補助</option></select><input id="search" placeholder="IDや画像名で検索"></div><div id="pager"><span id="count"></span><button id="prev">前へ</button><button id="next">次へ</button></div><div class="grid" id="grid"></div><script>const data=DATA;let page=0;const $=x=>document.getElementById(x),escape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));for(const c of [...new Set(data.targets.map(x=>x.category))].sort())$('cat').add(new Option(c,c));function render(){const mode=$('mode').value,q=$('search').value.toLowerCase(),cat=$('cat').value,state=$('state').value;let arr=(mode==='art'?data.art:data.targets).filter(x=>(!cat||x.category===cat)&&(!q||(x.name||x.id).toLowerCase().includes(q))&&(mode==='art'||!state||x.status===state));page=Math.min(page,Math.max(0,Math.ceil(arr.length/60)-1));$('count').textContent=`${arr.length}件 / ${page+1}ページ`;$('grid').innerHTML=arr.slice(page*60,(page+1)*60).map(x=>`<div class="card"><div class="pic">${x.png?`<img class="big" src="${escape(x.png)}" loading="lazy"><img class="native" src="${escape(x.png)}" loading="lazy">`:'画像なし'}</div><p>${escape(x.name||x.id)}</p><div class="tag ${x.status==='unsupported'?'missing':''}">${escape(x.category)} / ${mode==='art'?x.ids+'件に共用を含めて対応':({dedicated:'代表IDの絵',shared:'共用画像',unsupported:'絵は未対応 / '+(x.fallback==='visibility_utility'?'視界マスク':'記号補助')}[x.status])}</div>${x.origin?`<small>${escape(x.origin)}</small>`:''}</div>`).join('');$('prev').disabled=page===0;$('next').disabled=(page+1)*60>=arr.length}for(const id of ['mode','cat','state','search'])$(id).addEventListener('input',()=>{page=0;render()});$('prev').onclick=()=>{page--;render()};$('next').onclick=()=>{page++;render()};render();</script></html>'''
(root/'index.html').write_text(page.replace('DATA',json.dumps(data,ensure_ascii=False).replace('<','\\u003c')),'utf8')
# Retained first69 introduction/config is history, not current instructions.
for obsolete in ['legacy-first24-code','legacy-first24-tile-config']:
 pass
all_checks=[]
for folder in ['sprites','fallback/sprites','utility']:
 for p in (root/folder).glob('*.png'):
  if 'source-grid' in p.name:continue
  im=Image.open(p);raw=p.read_bytes();assert im.size==(16,16) and im.mode=='RGBA';assert int.from_bytes(raw[16:20],'big')==int.from_bytes(raw[20:24],'big')==16
  alpha=set(im.getchannel('A').get_flattened_data());assert alpha<={0,255};assert 0 in alpha or p.name=='lighting_hidden.png';all_checks.append({'file':p.relative_to(root).as_posix(),'size':[16,16],'alpha_values':sorted(alpha),'sha256':hashlib.sha256(raw).hexdigest()})
assert len(all_checks)==1310
(root/'all-native-PNG-QA.json').write_text(json.dumps({'native_file_count':len(all_checks),'pictorial':439,'diagnostic':866,'utility':5,'opaque_exception':'utility/lighting_hidden.png','all_dimensions_16x16':True,'all_RGBA':True,'binary_alpha':True,'files':all_checks},indent=2),'utf8')
atlas_matches=[]
for a in arts:
 config=Path(a['tile_config']);atlas=Image.open(root/config.parent/'tiles.png').convert('RGBA');i=a['atlas_index'];cell=atlas.crop(((i%8)*16,(i//8)*16,(i%8+1)*16,(i//8+1)*16));assert list(cell.get_flattened_data())==list(Image.open(root/a['png']).convert('RGBA').get_flattened_data());atlas_matches.append({'asset':a['name'],'match':True})
(root/'atlas-source-match.json').write_text(json.dumps(atlas_matches,indent=2),'utf8')
(root/'batch3-coverage.json').write_text(json.dumps({'previous_pictorial_images':69,'new_pictorial_images':370,'total_pictorial_images':439,'previous_mapped_pictorial_IDs':1794,'current_mapped_pictorial_IDs':8548,'new_mapped_pictorial_IDs':6754,'original_first69_preserved':True,'symbol_fallback_does_not_count_as_art':True},indent=2),'utf8')
zip_path=root.parent/'CDDA-Native-16px-439art-with-diagnostic.zip'
with zipfile.ZipFile(zip_path,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for p in sorted(root.rglob('*')):
  if p.is_file() and '__pycache__' not in p.parts and not any(part.startswith('legacy-first24') for part in p.parts):z.write(p,p.relative_to(root))
with zipfile.ZipFile(zip_path) as z:assert z.testzip() is None;assert len([n for n in z.namelist() if n.startswith('sprites/') and n.endswith('.png')])==439
print(json.dumps({'archive':str(zip_path),'bytes':zip_path.stat().st_size,'sha256':hashlib.sha256(zip_path.read_bytes()).hexdigest(),'native_PNG_QA_count':len(all_checks),'picture_atlas_matches':len(atlas_matches),'coverage':rows},indent=2))
