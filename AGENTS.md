# エージェント向け索引

文書の新設・整理、依存ライブラリや外部素材の追加・更新、配布対象やライセンス通知の変更では、[文書とライセンスの管理方針](docs/DOCS-AND-LICENSES-ja.md)を読んで従う。

## 作業スキル

- ゲームのRust対応・移植・層分離では、[game-rust-port](.agents/skills/game-rust-port/SKILL.md)を使う。
- 攻略調査・実プレイ・操作記録・記録からの再攻略では、[game-playthrough](.agents/skills/game-playthrough/SKILL.md)を使う。

## Rogueの実装資料

`rogue-nihon/` を変更するときは、変更対象に対応する正本を参照する。

- 層の責務、ABI、入力・保存の判断: [IMPLEMENTATION-ja.md](rogue-nihon/docs/IMPLEMENTATION-ja.md)
- 原作仕様、変更点、回帰条件: [ORIGINAL-SPEC-ja.md](rogue-nihon/docs/ORIGINAL-SPEC-ja.md)
- 翻訳、意味ID、辞書・UI文言: [LOCALIZATION-ja.md](rogue-nihon/docs/LOCALIZATION-ja.md)
- 記号・表示ID、画像、壁・足元の描画: [MAP-DISPLAY-ja.md](rogue-nihon/docs/MAP-DISPLAY-ja.md)

実行方法は作品のREADME、検証コマンドは [tests/README.md](rogue-nihon/tests/README.md) を参照する。上位の `AGENTS.md` の検証指示も適用する。
