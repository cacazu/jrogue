# 原 C 出力の意味 ID と日本語補完：限定調査

公式 ToME / T-Engine 1.7.6 の実ソースから、82 意味 ID、92 呼出箇所の EN/JA 補完 JSON を作成した。原 C/Lua、他作品、Git index は変更していない。これは選択した native error 出力の資料と辞書であり、ゲーム全体の翻訳率や実行時適用を示すものではない。

## 成果物

- `en.native.json` / `ja.native.json`：`native.error.*` をキーとする文字列辞書。`%s/%d/%c` は意味のある named parameters に変換し、JA は同じ引数を保持する。
- `native-callsite-manifest.json`：原文書式、原ファイル・行・関数・出力 API・C 引数式・型・Lua 表示経路・静的検証の範囲を記録。
- `console-output-manifest.json`：コンソール出力202候補を分離。起動失敗を含むが、デバッグログやコメント中の候補も含み、Lua UI 表示は主張しない。元の printf specifiers と引数式を保持。
- `unselected-lua-values.json`：protocol keys、debug tostring、動的または未調査の戻り値160候補。これらを自動的に翻訳対象とはしない。
- `source-hashes.json` / `source-route-hashes.json`：22 C ソースと、原アーカイブから変更せず抽出した7 Lua consumer の SHA256。
- `independent-validation-report.json` / `parameter-fixtures.json`：独立検査結果と29件の動的引数例。

## 実際のエラー表示経路

原 `src/main.c:201` の `traceback` は、コンソールに出力すると同時に `last_lua_error_head` にエラーを保存する。`src/core_lua.c:555-570` の `lua_check_error`（`core.game.checkError`）が英語の見出しと stack frame を Lua table にする。

通常は `engine/Game.lua:284-289` が `engine.dialogs.ShowErrorStack` を開く。起動時は `engine/Module.lua:911-916` が `engine.BootErrorHandler` を作り、同 handler の44行で同じ dialog を作る。`ShowErrorStack.lua:31` の `table.concat` と106行の `Textzone.new{text=display_errs}` は native rows を直接表示し、`_t` に渡していない。Lua `_t/tformat` seam だけでは、この C 由来本文は翻訳されない。

音声は別経路がある。`src/music.c` のエラーは `engine/interface/GameSound.lua:57-63` と `GameMusic.lua:46-49` が通常 `pcall` で捕捉し、ログへ送り、音声を省略する。これらを常にエラーダイアログに表示される文言とは扱わない。

ZIP add は `src/physfs.c:264` が `nil,error` を返す。限定調査で見つかった `Savefile.lua` の `zip:add` 例はコメントであり、有効な Lua UI consumer は確認していない。serializer type errors は `engine/class.lua:460-474` の実 `core.serial.new` 呼出に対応する。

## 組み込み時の境界

辞書の原文一致は、資料を生成する際に出典を選ぶために使う。実行時の global string replacement には使わない。各 call site で semantic ID と typed parameters を発行し、C/Lua ルールの処理・例外制御・返り値個数を保持したまま、表示境界で辞書を参照する必要がある。この作業ではその原本変更や実行時 transport を実装していない。

パス、関数名、モジュール名、型や状態の technical tokens、外部名は書き換えない。opaque error reason（PHYSFS/SDL/errno 等）には未翻訳の英語が残り得る。これらは別の構造化エラー辞書を必要とし、未知の本文を置換しない。任意の Lua `assert/error` 本文は Lua content seam の範囲として残す。

`bold/italic/underline/normal`、`VERSION`、`__index`、`receiveKey`、mouse button 名などの C 文字列は API/markup 値であり、ここでは翻訳しない。画面に出す設定やヘルプのラベルは caller の Lua UI 辞書で扱う。選択した C 出力内で完全な設定・ヘルプの網羅性は主張しない。

## 軽量検査

開始時の Windows メモリ確認は総約15.8 GiB、空き約3.88 GiB。逐次小ファイル読取と Python JSON/source 照合のみを実行した。コンパイル、リンク、ブラウザー、巨大素材の梱包は行っていない。

独立検査は、82 EN/JA keys、named placeholders、92 原ソース式/行/関数 metadata、22 source hashes、7 unchanged Lua copies、外部引数に含む `%s` と braces の保持を確認した。CJK の実描画、実 native failure flow、browser、全ソース text coverage は未検証。

再生成順は `scan_native_outputs.py`、`trace_lua_consumers.py`、`inspect_selected_routes.py`、`build_native_catalog.py`、`validate_native_catalog.py`。原ソースは `C:\Users\kit\gameme\jnethack\jrouge\tome\upstream\t-engine4-src-1.7.6` を読み、出力はこの作業フォルダーだけへ書く。

原 T-Engine C/Lua の著作権・ライセンスは pristine upstream と抽出ファイルの原ヘッダーに保持している。Lua 標準 C ライブラリの copyright notice は `src/lua/lua.h` 末尾、quoting macros は `src/lua/luaconf.h:201-202` にある。親担当の全体 license/source-availability inventory と併せて扱う。
