CDDA Native 16px / 固定版 0.I-1 / 第3バッチ累計
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
