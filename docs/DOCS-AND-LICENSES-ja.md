# 文書とライセンスの管理方針

このリポジトリの文書整理、依存・外部素材の取り込み、配布内容の変更に適用する。各作品の個別ライセンス条件が追加の義務を定めている場合は、その条件も満たす。

## 文書を残す基準

- 実装を決める判断、その理由、原作仕様と現実装の対応、守るべき回帰条件を残す。
- 同じ仕様の正本は1か所に置く。READMEは実行手順と索引、testsのREADMEは検証の実行手順を持ち、仕様を重複させない。
- tests内の文書を整理するときは、固有の仕様・期待結果を実装資料へ移してから削除する。テストコード自体の根拠となる条件を失わせない。
- 一時的な計画、作業日誌、過去のPASS件数、終了した監査や検証の要約、現実装に合わない説明は削除する。再生成できる詳細結果はローカルの検証出力へ置く。
- Rogueの実装資料は [IMPLEMENTATION](../rogue-nihon/docs/IMPLEMENTATION-ja.md)、[ORIGINAL-SPEC](../rogue-nihon/docs/ORIGINAL-SPEC-ja.md)、[LOCALIZATION](../rogue-nihon/docs/LOCALIZATION-ja.md)、[MAP-DISPLAY](../rogue-nihon/docs/MAP-DISPLAY-ja.md) の4文書に集約する。利用者向けのライセンス案内は別に残す。
- 削除・移動後はREADME、AGENTS、検証コードと残存文書の参照を更新する。

## ライセンスを残す基準

対象は、リポジトリで再配布する原作ソース・取り込んだコードや素材、配布バイナリ・JavaScriptに組み込む依存とランタイム。コンパイラーを使用しただけでSDK全体の通知を収録するものとは扱わない。

1. 原作ソースの著作権表示、ライセンス条件、免責文、必要なファイル内の表示を保持する。Rogueの [logic/LICENSE.TXT](../rogue-nihon/logic/LICENSE.TXT) とソースヘッダーはそのまま残す。
2. 外部依存は配布ターゲット、機能、実際のビルド根に基づいて抽出する。Cargo.lock全件、別OS用、未使用機能、開発・テスト専用の依存を一律には保存しない。
3. ビルド時専用の依存は、生成物へコード・テンプレートが移るかを確認する。Rogueは生成コードの範囲を過少に扱わないため、対象ビルドの `normal,build` 依存を収録範囲とする。これは全件が実行時にリンクされるという意味ではない。
4. SDKから生成物へ入る標準ライブラリ、libc、compiler builtins、JavaScriptランタイムの通知を残す。Rustは使用版の `rust-src` のstd依存をターゲット別に抽出し、コンパイラー、テスト用ライブラリ、他ターゲットの通知を外す。
5. `OR` の選択肢は採用した条件を記録する。Rogueでは選択可能なMITを優先する。`AND`、追加の著作権表示、Unicodeなどのデータライセンス、第三者通知は独立に保持する。選択肢であると確認できない原文はそのまま残す。
6. 通知本文を集約してよい。同一本文は共有し、各構成要素との対応を残す。著作権者・条件・免責文・必要なNOTICEや例外条項を要約で置き換えず、原文の内容を維持する。上流ソース内の表示は別途保持する。
7. 調査資料は版、採用条件、通知、出典、対象との対応に絞る。ライセンス取得元のローカル絶対パスやSDKの資料一式を配布用の対応表へ入れない。
8. 実際に配布する物の条件に合わせて通知を添付する。ZIPは案内からまとめて取得する手段として使う。ゲーム・ソースを配布するときは、必要な通知をその配布物にも含める。
9. Rogueのゲーム画面の外部リンクはGitHubへの1つとし、その先の作品READMEからライセンス案内・通知原文・ZIPへ辿れる構成にする。独立したライセンスボタンの表示を配布条件として扱わず、通知の保持・添付と画面の導線を分ける。

判断の根拠は [MITの表示保持条件](https://opensource.org/license/mit)、[BSDのソース・バイナリ再配布条件](https://opensource.org/license/bsd-3-clause)、[Apache-2.0の第4条](https://www.apache.org/licenses/LICENSE-2.0)。Rustは [標準ライブラリとツールチェーン全体の通知を区別している](https://github.com/rust-lang/rust/blob/1.98.1/COPYRIGHT)。その他のライセンスは個別の原文で条件を確認する。

## Rogueでの更新手順

正本は [licenses/THIRD-PARTY.txt](../rogue-nihon/licenses/THIRD-PARTY.txt) と [licenses/manifest.json](../rogue-nihon/licenses/manifest.json)。本文は原文を共有し、対応表は構成要素ごとの採用条件・ターゲット・出典・本文のハッシュと位置を持つ。[THIRD-PARTY-NOTICES.md](../rogue-nihon/THIRD-PARTY-NOTICES.md) は説明と索引、[docs/LICENSES-ja.md](../rogue-nihon/docs/LICENSES-ja.md) は利用者向け案内とする。

依存・機能・ターゲット、ツールチェーン、素材を変更したら、次の順で更新する。対象は `build.ps1` の `rogue-layers / wasm32-unknown-emscripten` と `build-ui.ps1` の `rogue-browser-display / wasm32-unknown-unknown`。ビルド根や機能を変える場合は収集処理も変更する。

1. 配布物と再配布ソースを確認し、[tools/collect-licenses.py](../rogue-nihon/tools/collect-licenses.py) で通知を再生成する。Python 3.11以上、使用版のRustと `rust-src`、Emscripten SDKが必要。`rogue-nihon/` から `python tools/collect-licenses.py --sdk-root <SDKの場所>` を実行する。
2. 素材の出典が変わったときは原文を取得し、`--asset-notice <Lucideのライセンス原文>` で更新する。通常は既存の検証済み本文を再利用する。Rustの版が変わった場合は対応する版のMIT原文を取得する。
3. 再生成差分で対象、版、採用条件、追加通知を照合する。新しい例外・ライセンス形式や取得できない原文は出典を確認して収集処理へ追加する。無関係と確認できた旧文書・旧通知を削除する。
4. `python tools/collect-licenses.py --sdk-root <SDKの場所> --check` が成功することを確認する。[tools/pack-licenses.ps1](../rogue-nihon/tools/pack-licenses.ps1) でZIPを更新する。この処理は指定された5文書だけを収録し、本文のハッシュと対応を検証する。
5. 案内と全ローカル参照、ZIPの中身・原文の一致を確認する。PlaywrightでゲームのGitHubリンクを確認し、リンク先の作品READMEからライセンス案内・ZIPへ辿れることを照合する。案内・ZIPを変更した場合はローカル版の取得も確認し、結果を完了報告へ記載する。

完了条件は、対象の全構成要素が通知へ対応し、原文の内容が保持され、対象外の文書がなく、案内・索引・ZIPが同じ構成を参照していること。
