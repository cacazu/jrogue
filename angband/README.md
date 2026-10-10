# Angband

公式 Angband4.2.6 の完全な元ソースを未変更で保ち、原作 C エンジンに Rust の入力・アプリケーション・表示・保存を接続したローカル HTML 版です。日本語を既定にしています。完全な日本語化・表示分離・長期キャンペーンの受け入れは段階的に進めています。

- upstream/Angband-4.2.6.tar.gz: 完全な公式配布ソース。
- upstream/angband-4.2.6/: 固定コミットの未変更ソース。
- port/: 改変版、Rust 層、HTML、意味 ID と英語・日本語 JSON、テスト、対応ソース配布。
- source-lock.json: 出典、固定コミット、アーカイブ SHA-256。

```powershell
Set-Location port
node web/server.mjs
```

起動 URL は http://127.0.0.1:4173/web/ です。今回の WEB 公開は HTML 作成と Node によるローカル実ブラウザー検証です。最新の正確な検証結果は port/verification.json、実装契約は port/docs/MIGRATION.md、残作業は port/migration/NEXT-MILESTONE.md を参照してください。古い検証結果を更新後のバイナリーへ流用しません。

ゲームの専用タイル、音声、フォントは Web 版に配布せず、文字表示とシステムフォントを使います。原作の通知を保ち、GPL v2 の選択肢に従う対応ソースと依存通知を添付します。別タイトルや共有 Git の index/commit/push は変更しません。
