CDDA16px 接続・派生ID・オーバーレイ補助

原寸16x16、透明背景、256単色セルの追加アート。保存済みnative-v4/439枚を変更しません。
Runtimeオーバーレイは人物/装備の固有絵とは別に集計。接続タイルはN/W/E/Sの16組合せを道路と壁の2種類で制作。元コードの角・T字・直線・端・単独の回転と対応します。
field_intNと車両variantは明示された元データから別分母で一覧化し、元画像を共用。強度別の描き分け、破損/開放差分、装備/変異オーバーレイ、Modは完成扱いにしません。
Core_Supplement/Overmap_Supplementはnative-v4の診断設定を含む3枚アトラス設定です。複製したgfx配布入力へ置き、WASM preloadは本体側で既存リンク完了後に反映します。
本体未適用、WASMでの読込・描画順・接続方向の実機確認は未検査です。src/data/共有Gitへの変更なし。
status.jsonとderived-id-manifest.json、road-derived-IDs.json、native-source-validation.json、atlas-QA.jsonを参照してください。
