# Dungeon Crawl Stone Soup 日本語 Web 移行

公式 DCSS **0.34.1**（[crawl/crawl](https://github.com/crawl/crawl)、コミット `1eebc1a2892e1c89776a0d7a10691f8dac8d9796`）の完全なゲームをブラウザーで動かし、Rust で入力・表示・保存・プラットフォーム境界を分離しています。原本は別に保持しています。日本語を既定とし、英語と日本語の JSON を意味 ID と型付きパラメーターで結びます。全ゲームの日本語移行は継続中です。

**V2 はインストール済みで、`http://127.0.0.1:4186/` で配信しています。** 最終 Chrome 10 ケース・62 ラベルに合格した候補を 2026-10-03 UTC に切り替え、旧 V1 を履歴に保持しました。切り替え後の HTTP・分離ヘッダーと、インストール済み対応ソースの 2 つの `--check` を実際に確認しています。

## 起動と検証範囲

インストール済み `dcss` で `node web/server.mjs` を実行すると、`http://127.0.0.1:4186/` でローカル配信します。既存サーバーがある場合は所有プロセスと作成時刻を確認して再利用します。Node はファイル配信、ブラウザーの Worker は完全な原作エンジンを担当します。通常は native WebAssembly exceptions を使う JSPI、`?reference=1` は Rust 比較画面、`?core=1&runtime=jspi` は明示的な原作画面です。

今回の範囲はローカル HTML、Node、実際の Chrome です。外部 Sites への公開は今回の範囲に含まれません。390px の検証はデスクトップ Chrome の画面・タッチ設定であり、実機スマートフォンや IME 完了の証拠ではありません。

## V2 の確認済み結果

| 対象 | 実際の結果 |
|---|---|
| Rust | 63 テスト、fmt、offline/locked Clippy、release WASM が合格。実 Rust フォーマッター 470 プローブも合格。 |
| EN/JA JSON | 各 456 ID。パラメーターなし 409、パラメーターあり 47（scalar 32、structured 15）。 |
| 原作表示の接続 | 45 表示 ID：起動固定 11、起動バリエーション 12、HUD 22。36 source-site ID、32 原作式の記録範囲に対応。 |
| 完全な原作ビルド | 331 オブジェクトを再利用し、`newgame.cc` と `output.cc` の 2 個を再コンパイル、333 個全体をリンク。 |
| Node 原作実行 | 6 実行・36 アサーション、ロケール比較 17 が合格。 |
| 保存 FIFO | authored mocks 129、独立レビュー mocks 7 が合格。統合配置の再実行 13 は 129 の一部の再検証。 |
| 最終 Chrome | 新規 10 ケース、全て exit 0、合計 62 チェックラベルが合格。 |

45 は物理 C++ 呼び出し箇所の数ではありません。ネイティブ許可リストはパラメーターなし 34 ID とパラメーターあり 11 ID です。起動バリエーション 12 には空パラメーターの welcome が含まれます。固定起動 11 のうち説明文 5 は現在の console メニューに見えません。456 は登録カタログ数であり、ゲーム全体の文章数や翻訳率ではありません。

最終実行は 2026-10-02 UTC、記録名 `browser-v2-matrix-20261002-final-r3`、aggregate SHA-256 `0e8ba1ff7441622f8f5b649142cfb1e2954e29ab97df938c4abe665fa0332bc7` です。2026-10-03 の文書・画像確認時刻と混同しません。

## 4 層と保存

C++ は原作ルール、状態、45 本の永続 PCG ストリームを維持します。Rust の logic/domain は比較用ルールと境界の不変条件、input/application は入力・使用例・意味イベント、display/presentation は意味 ID・型付き書式・CJK 描画、platform/adapters は Worker・WASM・Canvas・IndexedDB を担当します。[ARCHITECTURE.md](docs/ARCHITECTURE.md) に実際の境界を記録しています。

表示 ID は原作の出力元で発行します。英語から ID を推測したり、全体置換したりしません。外部のプレイヤー名はそのまま扱います。描画はゲーム状態や RNG を変更しません。ネイティブの言語はセッション開始時に固定し、Rust のコピーされた意味履歴はロケール別に再描画できます。

V2 保存は原作ファイルを保持し、別のバージョン付き意味履歴を含めます。セッションと原作イベント番号を別々に検証し、復帰時にゲームへイベントを再実行しません。FIFO 修正は保存要求を受けた時に位置を予約し、その保存応答に対応する履歴を、後続入力が生成するイベントより先に取り込みます。復帰の実証では旧 `(session 1, sequence 1)` を保持し、新しい session 2 の基準を 0 とし、`game.canned.no_spells` の新 `(2,1)` を受理しました。

## 表示の限界と次の作業

実際の新しい画像では日本語 HUD 見出しが読めます。ActorTitle、species、武器・quiver・place・WelcomeBack、終了画面は英語が残ります。武器選択の行名、claws、unarmed も英語で、準備済み `startup.weapon.row` は未接続です。390px では外側の見出しと選択欄が折り返し、固定幅の原作 terminal は横・縦にスクロールします。初期位置では HUD が右側にあり、操作欄にはページスクロールで到達します。

死亡・勝利は実際の原作終了画面まで到達した controlled WIZARD 検証です。無補助の全キャンペーン、実機モバイル、IME、完全な日本語化は主張しません。

別の private V3 Rust 候補は実 attempt H で fmt、75 テスト（失敗 0）、Clippy、release WASM に合格しました。これはインストール済み V2 の 63 テスト・境界 WASM とは別です。V3 の C++ コンパイル、原作履歴 sidecar の実行、保存・45 RNG 比較、ブラウザー確認は未完了で、混在する原文・意味付き繰り返し等の表示課題も残ります。実失敗 A–G と修正過程を保持しています。[V4-SOURCE-PLAN.md](docs/V4-SOURCE-PLAN.md) は次の具体的な移行計画です。

インストール後の実 Chrome 確認も23ラベルに合格しました。最終10ケース・62ラベルとは別の実行です。

## 原本とライセンス

原作コードは GPL-2.0-or-later、新規 Rust・ツールは GPL-3.0-or-later、組み合わせた配布は GPL-3.0-or-later です。PCG、Lua、SQLite、zlib、Rust、Emscripten/LLVM 等の通知を保持し、バイナリーには変更を含む対応ソースと実際の再現手順を添付します。上流へのリンクだけでは足りません。

console payload は未使用の印刷用 `docs/quickstart.pdf` だけを除いた原作 1,448 ファイル、全 143 vault、help、credits を保持します。原本 PDF と完全な元 payload は保存しています。ブラウザー payload に tiles、音声、フォント、PDF は含めず、文字はシステムフォントを使います。[BUILD.md](engine/BUILD.md) に固定 SDK と再現上の制限を記録しています。
