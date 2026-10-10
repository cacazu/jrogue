CDDA Native16 / native-v5

対象：固定版0.I-1、commit 7b2efa5cea38e4d4d97dd0e63b28b9148623da59。
実寸16×16 RGBA PNG。原本は16行16列・256単色セルで新規作画し、384×384の原本グリッドを再読み込みして各セルを検査した後、1セルを1ピクセルへ無損失書き出し。高解像度画像の縮小で16px風にしたものではありません。拡大プレビューだけnearest-neighbor。画像生成ツールは元のムード検討に使用し、最終PNGは明示的なネイティブセル行列です。他者のタイル画像を転用していません。

件数
静的候補ID：19,847（コア13,579、広域マップ6,268）。バニラdata/jsonの明示IDと指定runtime IDを数えた母数です。動的に読み込まれた有効IDの総数ではありません。
専用代表ID：1,926。共用：17,595。絵の未対応：326。専用＋共用＝19,521。
実寸画像：絵・カテゴリ代表図案1,831枚、表示UI95枚＝1,926枚。
UI95枚の内訳：フィールドのゾーン等63枚、runtime表示31枚（36 ID）、未探索マップ1枚。UIは人物・モンスターの固有絵とは別です。
補助PNG：接続形32枚、照明マスク5枚、透明セル1枚、診断記号8枚。合計1,972ファイルです。元RGBA行列は1,943種類で、同じ画素のファイルを固有モデルの違いとは数えていません。

絵の未対応326件の内訳
透明表示157件：open airおよびnull vehicle part。下のレイヤーを隠さない透明セル。
非表示58件：always_invisible=trueのトラップ57件、display_field=falseのフィールド1件。
疑似定義79件：PSEUDO、地域の疑似地形・家具など。通常物の固有絵ではありません。
開発・テスト25件：テスト用モンスター、DEBUG_ONLY、デバッグ用定義。
エンジン診断2件：unknown、unknown_terrain。明示的な代用記号で、絵の完成数に含めません。
照明5件：機能マスク。lighting_hiddenだけ全256セルが不透明です。見えない領域を隠すための用途別例外で、透明な前景の絵に含めません。
通常表示する静的な物で、用途・表示先が未分類の候補は0件です。これを全ゲームの全画像完成とは呼びません。

共用の意味
同じ形の代表図案、同じソースのID配列、エンジンが指定したlooks_likeに基づく共用です。各IDの実際の元JSON・ポインタ・表示先をmanifest.jsonとid-manifest.csvに記録しました。明示的な形の分類と理由はfamily_alias_rules、材料継承の補正はsource-material-corrections.jsonで確認できます。
個々の銃器型番・衣服の素材等級・料理のレシピ・モンスター亜種の全器官・部屋内容・数量・ゲーム挙動が等しいとは扱いません。食品・薬品の一部はソースカテゴリを示す代表図案です。
Mod、派生死体、装備・変異の重ね合わせ、季節別・vision level別画像、動的生成IDはこの静的母数の外です。明示的なfield強度293 IDとvehicle variant 1,362 IDは別一覧にし、ベース絵の別名として設定しています。強度の色、車両の破損・開閉・コスメを固有作画したという意味ではありません。

受け取りと導入
index.htmlはローカルの一覧。PNGを相対パスで読み込む自己完結したページです。原寸と6倍表示、カテゴリ、状態、ID検索を使えます。
contact-sheet-review.pngに57枚の代表例、contact-pages/page-01.png以降の33ページに全1,926枚を載せました。source/が原本、sprites/が実寸PNG、source-grid/がセル原本、proof/が検査用図、previews/がnearest-neighbor拡大です。

本体への統合はtileset/CDDA16_Combined_Readyを推奨します。
NAME: cdda16_combined_ready
JSON: tile_config.json
PNG: core-tiles.png、core-functional.png、overmap-tiles.png、overmap-functional.png
静的19,847 IDを一つの標準tile_configで登録しています。元IDにはコア・広域間の衝突がありません。共通の診断・照明IDにはコアの定義を使います。
CDDA16_Core_ReadyとCDDA16_Overmap_Readyは個別表示を調べるための分離版です。
CDDA16_Combined_Connectedは接続形を加えた任意版です。壁・道路の角、T字、交差、端、単独、直線の回転をソースのS/E/W/N順に対応させました。接続形の壁は共用の灰色図形で、素材ごとの色や全形状を描き分けていません。素材色を保持するベース表示はReadyを使います。
本体担当がこのフォルダを独立したgfx資産としてpreloadに含め、統合NAMEを選択し、起動・マップ・広域マップ・移動・重ね表示・接続をゲーム内で確認してください。アセット作業では本体ビルド、リンク、設定変更、Gitへのstage/commit/pushを行っていません。

検証
全1,972 PNGのIHDRとデコード寸法が16×16。全画像が元セルに一致。前景1,926枚は透明セルを持ち、alphaは0/255です。照明の不透明マスクと全透明セルを分離しました。
統合Readyの静的19,847 IDの参照先RGBAは原本と一致。全設定のID衝突0、インデックス範囲内。
Nodeの127.0.0.1サーバーと専用Chromeで全1,972 PNG・アトラス2,009セルを検証。18の代表画像はすべて画素が異なり、原寸16px・6倍pixelated、透明・接続・重ね表示を確認。全33ページの1,926枚、除外一覧6ページ326件、ID検索で画像欠落・ブラウザ例外0。browser-verification/に結果と実際の描画画面を保存します。
元のJSON 3,013ファイル、表示関係6ファイル、既存439枚の原本・PNG878ファイルはハッシュ／バイト一致。元の補足セットを変更せず、v5の雪マーカーだけ小さな5×7の角の形へ再作画して人物の輪郭を残しました。
WASMでの実際の読み込みとゲーム描画は未検証です。この確認は本体担当の作業です。

主要ファイル
manifest.json、id-manifest.csv、status.json、coverage-by-category.json
pictorial-exclusions.json、derived-id-manifest.json、cross-bank-ID-collisions.json
native-source-validation.json、all-native-PNG-QA.json、atlas-source-match.json
ready-config-QA.json、source-preservation-final.json、native-RGBA-duplicates.json

作業結果はローカル納品です。外部Sitesや新規Libraryへの公開は行っていません。
