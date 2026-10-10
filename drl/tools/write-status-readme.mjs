import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=async name=>JSON.parse(await readFile(path.join(root,name),'utf8'));
const [englishRaw,japaneseRaw]=await Promise.all(['en.json','ja.json'].map(name=>readFile(path.join(root,'localization',name))));
const english=JSON.parse(englishRaw),japanese=JSON.parse(japaneseRaw);
const evidence=await read('localization/verification.json');
const link=await read('core-adapted/build/browser-core/link-evidence.json');
const browser=await read('port/tests/output/original-game/evidence.json');
const adapterSha=createHash('sha256').update(await readFile(path.join(root,'port/dist/drl_web_port.wasm'))).digest('hex');
const browserStatus=`結果は${browser.result}、完了チェックは${browser.checks.length}件です。検証した本体は\`${browser.artifacts['drl-core.wasm'].sha256}\`です。`;
for(const [name,raw] of [['en.json',englishRaw],['ja.json',japaneseRaw]]){
if(createHash('sha256').update(raw).digest('hex')!==evidence.files[name]?.sha256)throw Error(`README requires verified catalog bytes: ${name}`);
}
if(Object.keys(english).sort().join('\0')!==Object.keys(japanese).sort().join('\0'))throw Error('Catalog key mismatch');
const count=Object.keys(english).length;
if(evidence.catalogIds!==count)throw Error('README requires the verified coherent catalog snapshot');
const literalDispositions=evidence.textCandidateDispositions.literalDispositions;
const pendingVisible=literalDispositions['pending-visible-or-composed-text-review'];
const pendingAmbiguous=literalDispositions['pending-ambiguous-literal-role-review'];
const pendingDynamic=evidence.textCandidateDispositions.dynamicDispositions['pending-dynamic-producer-review'];
const nativeFixtures=evidence.executedNativeFixtures.fixtures;
for(const name of ['json-contract','semantic','feeling','item','history']){
if(nativeFixtures[name]?.status!=='passed'||nativeFixtures[name].failed!==0)throw Error(`README requires passing native fixture evidence: ${name}`);
}
if(link.result?.exit_code!==0||!link.imports_validated||!link.source_inputs_unchanged||!link.archives_unchanged)throw Error('README requires a successful, unchanged-input full-core link receipt');
const compilerSourceRecords=link.compiled_sources?.files?.length??0;
const overlay=await read('core-adapted/adaptation-manifest.json');
const checkpoint=await read('docs/CURRENT-CHECKPOINT.json');
const rustTests=checkpoint.executed_runtime_checks.current_rust.tests_passed;
const correspondingSourceStatus=compilerSourceRecords===0
?'リンク記録のコンパイラ由来ソース一覧は現在0件で、最終的な対応ソース証明は再構築・確認待ちです。'
:`リンク記録にはコンパイラ由来ソース${compilerSourceRecords}件があり、最終的な対応ソースとの照合を続けています。`;
const death=checkpoint.executed_runtime_checks.original_death_report_profile;
const clean=checkpoint.executed_runtime_checks.corresponding_source_clean_compile;
const lines=[
'# DRL 0.10.11a ローカルブラウザ版 — 作業中',
'',
'**原作エンジンの新規ゲーム、基本操作、戦闘、連続移動の中断と保存・再開を実Chromeで検証しています。全面日本語化、全キャンペーンと完全な状態の描画純粋性は未完了です。**',
'',
'ユーザーの完了条件は、HTML版の作成とNodeを使ったローカル実ブラウザ検証です。外部サイトへの配備は対象外です。',
'',
'ゲームの状態・規則・RNG・コンテンツ・保存形式は原作Pascal/Luaに残し、表示・入力・ブラウザ環境をRustで分離します。[計画](https://chatgpt.com/space/page_2ca2b2b56c0481919dc6359685d3bf4f)と、その後の原作エンジン維持の指示に従います。',
'',
'公式安定版は[0_10_11a](https://github.com/chaosforgeorg/drl/releases/tag/0_10_11a)、コミット`a6f965072b3a25b768c91dbced00367f1b57d865`。Valkyrieは`f89735a741a968997656c2d48a003ec569db7f22`、Luaは公式5.1.5です。原本を別保存し、選択した305ソースファイルはバイト単位で保全しています。共有フォルダの`upstream/`には498原本ファイル、36,020,866バイトをハッシュ検証して保存しました。',
'',
`EN/JAカタログは同一キーの**${count.toLocaleString('en-US')}意味ID**です。[カタログ検証](localization/verification.json)ではNode契約${evidence.nodeTests.passed}件、感情文のソース照合${evidence.feelingSidecarOracle.passed}件、アイテム名のソース照合${evidence.itemNameSidecarOracle.passed}件が通過し、${evidence.patchedFiles}原本ファイルに${evidence.patches.toLocaleString('en-US')}箇所の保護付きパッチを適用しています。設定、メニュー、ヘルプ8文書、登録名称・説明、ゲームメッセージ、改名、履歴を段階的に接続しています。可視・合成原文${pendingVisible}件、未分類${pendingAmbiguous.toLocaleString('en-US')}件、動的生成箇所${pendingDynamic}件などが残り、全面翻訳は未完了です。ゲーム内の英語Name値や比較規則は保っています。`,
'',
'公式FPCソースからWASMコンパイラ、WASI RTL、必要8パッケージを構築済みです。公式JSONランタイムの4ユニットもコンパイル済みですが、JSONパッケージ全体の構築とは別です。原作Pascal本体はコンパイルとWASMリンクが通過しました。生成ツリーは'+overlay.files.length+'ファイル、プラットフォーム変換は'+overlay.changes.length+'箇所です。共有Windowsの資源制限は解除済みで、親タスクがメモリを測定しながらビルドを直列実行しています。',
'',
`[本体リンク記録](core-adapted/build/browser-core/link-evidence.json)のWASMは${link.wasm_bytes.toLocaleString('en-US')}バイト、SHA-256は\`${link.wasm_sha256}\`です。インポート、入力ソース・アーカイブの不変性検査は通過しています。${correspondingSourceStatus}物理Enter、タッチ入力、15文字を超える名前入力のフレーム単位の受け渡しを修正しました。`,
'',
`混合Pascal/LuaはNodeと実Chromeで共有アロケーター、JSPI継続、UTF-8のプローブが通過しました。Rustネイティブ${rustTests}テスト、警告を許可しないClippy、rustfmt、実Chromeのホスト能力27テストも通過しています。ネイティブ比較はJSONアダプター${nativeFixtures['json-contract'].passed}件、意味テキスト${nativeFixtures.semantic.passed}件、感情文${nativeFixtures.feeling.passed}件、アイテム名${nativeFixtures.item.passed}件、履歴${nativeFixtures.history.passed}件が通過しています。これらは原作の保存統合やキャンペーンの完走検証とは別の証拠です。`,
'',
`現在のRust WASMアダプターは\`${adapterSha}\`です。[実Chromeホスト検証](port/tests/output/core-host-browser.json)は27件の能力プローブ記録です。本体の実操作は[原作ゲーム検証](port/tests/output/original-game/evidence.json)に分けて記録しています。${browserStatus}`,
'',
'本体用HTMLは`port/web/game.html`、ローカル配信は`port/web/server.mjs`です。アーティファクトと許可された資産を準備したうえで次を実行します。詳しい構築順序・実行状況は[ローカル実行手順](docs/LOCAL-RUN.md)を参照してください。',
'',
'```powershell',
'node port/web/server.mjs',
'# http://127.0.0.1:4189/game.html',
'# 別の端末で、本体PC/モバイル検証を実行',
'node port/tests/original-game-browser.mjs',
'```',
'',
'本体の検証ではシード検証、新規ゲーム、名前、持ち物・装備・ヘルプ・設定、PCとタッチ移動、原作保存と新しいWASMインスタンスでの再開、同じ保存からの決定的な継続を確認しています。描画・言語・画面サイズ変更では現在の限定DRLP項目と全MT状態が不変です。これは全世界状態の純粋性証明ではありません。同じ開いたヘルプの本文・タイトル・固定キー表示は、スクロール位置を保ってJA/EN/JAに再描画されます。[戦闘・連続移動の検証](docs/ORIGINAL-COMBAT-RUNTIME-EVIDENCE.json)では原作ドア操作、敵の照準・命中・撃破と経験値、被ダメージ、RunDelay=0でのShift+方向/Esc中断が通過しました。敵UID/正確なHP/撃破の帰属、死亡・勝利・全キャンペーン、全テキストと全ツールチェーンの新規構築が残っています。',
'',
'| 場所 | 内容 |',
'| --- | --- |',
'| `upstream/`、`native/` | 分離した原本と、変更していない原作ソースの選択。 |',
'| `core-overlay/`、`tools/adapt-core.mjs` | 原作を保ったブラウザ・ABI・意味テキストの接続。 |',
'| `port/src/` | Rustの表示・入力・環境境界。logicは原作と接続する契約と参照検証。 |',
'| `port/web/` | 本体HTML、Node配信、ブラウザ接続。 |',
'| `localization/` | 意味ID、EN/JA JSON、型付き引数、原文監査と残作業。 |',
'| `docs/` | 原本・機能・ライセンス・実行済み検証と未実行項目。 |',
'',
'コードはGPL 2.0、ValkyrieとLuaはMIT。原作ASCIIアート22件はCC BY-SA 4.0と著作者表示を維持します。ブラウザ資産はサイレント音声・システムフォントを使い、Doom由来音声、FMOD、Steam、未確認フォント、商用ゲーム資産を含みません。完成したローカル成果物には、実際のリンク対象の通知と対応ソースを添えます。',
'',
'[進捗と完了条件](docs/MIGRATION-STATUS.md)、[FPC構築](docs/FPC-WASM-BUILD.md)、[Lua ABI](docs/LUA-WASI-ABI.md)、[本体接続](docs/CORE-BRIDGE.md)、[依存ライセンス](docs/CORE-DEPENDENCY-LICENSES.md)。他ゲームと共有Git index/commit/pushは変更していません。',
] ;
if(death?.result==='pass')lines.push('',`原作の死亡・戦闘記録・ハイスコア・プロフィール保存と新規インスタンスでの再読込は${death.checks_passed}検証を通過しました。[実行証拠](docs/ORIGINAL-DEATH-RUNTIME-EVIDENCE.json)には未翻訳のレポート見出し／フッターも明記しています。`);
if(clean?.clean_compile_verified)lines.push('',`対応ソースを空の作業先へ復元し、原作139ソースとRustアダプターをクリーン構築しました。原作WASMはバイト一致、Rustは依存ソースの絶対パスによりハッシュが異なります。[構築証拠](docs/SOURCE-CLEAN-BUILD-EVIDENCE.json)と[差分監査](docs/CLEAN-RUST-ADAPTER-DIFF.json)を参照してください。ツールチェーン全体の新規ブートストラップは別項目です。`);
await writeFile(path.join(root,'README.md'),lines.join('\n')+'\n');
console.log(JSON.stringify({readme:'README.md',catalog_ids:count,delivery:'local HTML and Node browser verification',full_port_complete:false}));
