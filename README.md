# jrouge

外国産ローグライクを日本語化する複数作品の作業リポジトリです。作品名とフォルダ名は **`元の作品名-nihon`** に統一します。

| 作品 | 元作品 | 起動・開発 | ライセンス |
|---|---|---|---|
| [brogue-nihon](brogue-nihon/README.md) | Brogue: Community Edition 1.15.1 | Windows: `brogue-nihon/bin/brogue-nihon.cmd`。ビルドは [BUILD.md](brogue-nihon/BUILD.md) | [GNU AGPL v3](brogue-nihon/LICENSE.txt) |
| [rogue-nihon](rogue-nihon/README.md) | 古典Rogue / RRP Rogue 5.4.4 | `rogue-nihon/` で `.\start.ps1`、ブラウザで `http://127.0.0.1:4173/` | [原典のBSD形式ライセンス](rogue-nihon/logic/LICENSE.TXT)、[依存物の通知](rogue-nihon/THIRD-PARTY-NOTICES.md) |

RogueはCのゲームロジックとRustの表示・入力・プラットフォームを分けたWeb版です。日本語の本文、品名、怪物、ヘルプ、設定、終了画面と、入力途中の保存・復元に対応します。構造と検証範囲は作品内のREADMEを参照してください。[取得元・版・ハッシュ](rogue-nihon/docs/PROVENANCE-ja.md)も記録しています。

BrogueはSDL版の英語・日本語表示切替に対応します。ゲームデータ、録画、診断出力は英語を保持します。[翻訳辞書と検証方法](brogue-nihon/locales/README.md)を参照してください。

- Brogue upstream: https://github.com/tmewett/BrogueCE
- Brogue source release: https://github.com/tmewett/BrogueCE/releases/tag/v1.15.1

各作品の原著作権表示とライセンスを保持します。今後の作品も同じリポジトリ内に追加します。

## Gitで管理するもの

ソース、翻訳JSON、ビルド・テストスクリプト、説明・取得記録、ライセンスを管理します。Rogueの起動に必要な `build/game.js`、`game.wasm`、ビルドmanifestも含めます。

SDK、依存ライブラリの展開物、コンパイラキャッシュ、Brogueの実行ファイル・DLL、プレイヤー保存、テスト用バイナリ、詳細トレース、スクリーンショット、ローカル配達記録は管理対象外です。取得アーカイブとバックアップはローカルで保持します。
