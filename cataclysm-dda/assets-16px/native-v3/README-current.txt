CDDA Native 16px / 累計69種類（第二便45種類追加）

最初の24種類のPNGとセル原本は変更していません。first24-preservation.json参照。
正規原本はsource/*.json。全て16行×16列で1文字=1画素です。
源画像source-grid/*.pngの各24×24ブロックが1色であることを、PNG再読込み後に
256セル全て検証してから、1セルを1画素として16×16へ無損失出力します。
高解像度絵の縮小・サンプリング・平均・量子化ではありません。
sprites/*.pngは全69枚が実寸16×16、RGBA、アルファ0/255です。
画像生成ツールの17枚のムード下書きは完成品に数えず、その画素も使用していません。

現在の対応
母数: 固定版0.I-1のvanilla明示ID候補19,847。
専用69 ID、共用1,725 ID、未対応18,053 ID。
69種類の個別画像で1,794の候補IDを描く対応であり、1,794種類の独自画像ではありません。
共用は以下の出典つき規則に限ります:
  1. セル原本に明示した複数ID（人物の性別/NPC、同系アイテム等）。
  2. 同じJSONオブジェクトのid配列。同じ描画データを持つ定義です。
  3. 上流のcopy-from/looks_like処理をソースで確認したレンダラーの参照経路。
  4. 6個の明示したテンプレート描画アンカー。モンスター/地形/広域の粗い共用表示。
各候補のmapping_reasonと出典はmanifest.json / id-manifest.csvへ記録します。
trapに存在しないlooks_like参照を推測していません。
外見参照のないアイテムを名前だけで似た絵へ大量に割り当てていません。
共用表示があるものでも、個別の姿・材質・装備差分を専用に描いたとは扱いません。
全ゲーム用アートは未完成です。

母数の限界
これは静的なソースのID候補です。現在ロードされる実行時全表示物の数ではありません。
PSEUDOや旧移行用定義を含む場合があります。Mod、強度、回転/接続、季節、死体、
装備/変異overlay、広域のvision_levelなどの派生IDは母数外です。
inputs/appearance-index.jsonは外見属性と参照経路の監査用で、ゲーム処理の代替ではありません。

本体描画との形式契約
tileset/CDDA16_Core と tileset/CDDA16_Overmap はCDDA標準形式です。
それぞれtileset.txt / tile_config.json / tiles.pngを含みます。
tile_info: width=16, height=16, pixelscale=1, iso=false。
本体と広域マップは別のタイルセットとしてコンパイルしています。
coreは66枚のゲーム画像、overmapは3枚の広域画像。アトラス番号は各パック内で独立。
同名IDが別カテゴリで使われる場合に混ぜることを避け、ID重複も検査します。
設定名: 本体TILES=cdda16_core、広域OVERMAP_TILES=cdda16_overmap。
USE_TILESは上流のタイル描画切替です。DISTANT_TILESも本体側のパックで別途検査します。
パッケージへの追加はgfx/CDDA16_Core とgfx/CDDA16_Overmapを新規登録する形式です。
Emscripten配布は事前ロード/仮想FS登録が必要で、HTMLの隣へのPNGコピーだけでは導入されません。
このタスクではビルド/リンク、仮想FS、本体設定、既存タイルセットを変更していません。
実際のエンジンでの読み込み・表示QAは本体担当と行う残件です。
legacy-first24-tile-configは以前の24種類だけの設定です。現行69種類の設定には使いません。

確認用
contact-sheet-batch2.png: 新しい45種類の原寸と10倍表示。
contact-sheet.png: 累計69種類。contact-sheet-native.png: 原寸一覧。
proof/*-native-grid-proof.png: 各16列×16行のセル確認図。
native-source-validation.json: 全256セル/画像の単色性と無損失出力検証。
FINAL-QA.json: PNG実寸と標準形式、アトラス番号/IDの検査結果。
compile.py: 原本と出典つき共用経路から標準パックを構成する軽量処理。
export.py: セル原本を検証してPNGへ出力する軽量処理。

継続
未対応18,053件を外見の定義で分類し、追加のまとまったネイティブ画像を作成します。
まず残りの生物の基本形、壁/ドア素材、収納/衣類/道具/食料、広域建物/道路と
照明・視界・接続・装備overlayを優先します。
未対応や派生IDを ? で表示できても、アート完成には数えません。
