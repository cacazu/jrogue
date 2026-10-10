"""Prepare source-only translations/provenance; never run an engine/test/build."""
from pathlib import Path
import hashlib
import json
import re

ROOT=Path(__file__).resolve().parent
def sha(data): return hashlib.sha256(data).hexdigest()
def output(name,value):
    path=ROOT/name
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")

UI={
"title":("ToME: original save and resume comparison","ToME：原版の保存・再開比較"),
"scope":("This comparison uses the original game/world serializer and loader. Rendering purity and full-campaign compatibility are still being checked.","原版のゲーム・世界の保存処理と読み込み処理を使う比較です。描画の純粋性と全キャンペーンの互換性は引き続き検証中です。"),
"diagnostics":("Developer diagnostics","開発者向け診断"),
"loading":("Loading the original engine and local save store…","原版エンジンとローカル保存領域を読み込み中…"),
"ready":("Ready","操作できます"),
"save":("Save checkpoint","チェックポイントを保存"),
"resume_button":("Reload and resume","再読み込みして再開"),
"resume":("Resuming with the original loader…","原版の読み込み処理で再開中…"),
"saved":("Saved to this browser","このブラウザーに保存しました"),
"saving":("Saving the original game and world…","原版のゲームと世界を保存中…"),
"failed":("The operation could not complete. Details are available in diagnostics.","処理を完了できませんでした。診断に詳細が表示されます。"),
"wait":("Wait","待機"),
}
JA={
"hydration_contract_mismatch":"再開時の設定引き継ぎ条件が一致しません。",
"already_installed":"すでに導入されています。","browser_commit_failed":"ブラウザーへの永続保存に失敗しました。",
"command_gate_closed":"保存・再開中のため操作を受け付けられません。","coroutine_reentry":"コルーチンの再入を検出しました。",
"gate_busy":"排他ゲートが使用中です。","gate_lost":"排他ゲートを失いました。","gate_release_failed":"排他ゲートを解放できませんでした。",
"invalid_commit_transition":"保存状態の遷移が不正です。","invalid_generation":"保存世代の識別子が不正です。",
"invalid_install":"導入条件が不正です。","native_gate_missing":"実際のネイティブ排他ゲートがありません。",
"native_pump_failed":"実際のネイティブ保存処理を進められませんでした。","native_queue_not_drained":"ネイティブ保存キューが完了していません。",
"native_serial_missing":"実際のネイティブ直列化機能がありません。","native_serial_not_idle":"ネイティブ直列化処理が待機状態ではありません。",
"native_serial_not_ready":"ネイティブ直列化処理の準備ができていません。","original_command_missing":"原版の操作処理がありません。",
"original_coroutine_failed":"原版の保存コルーチンに失敗しました。","original_coroutine_missing":"原版の保存コルーチンがありません。",
"original_graph_file_missing":"原版のゲーム・世界保存ファイルがありません。","original_queue_not_drained":"原版の保存キューが完了していません。",
"original_save_failed":"原版の保存処理に失敗しました。","original_saveclass_missing":"原版の保存クラスがありません。",
"original_state_missing":"原版のゲーム状態がありません。","original_state_replaced":"処理中に原版のゲーム状態が置き換わりました。",
"original_i18n_missing":"原版の言語設定取得機能がありません。","invalid_preferred_locale":"保存する原版の言語識別子が不正です。",
"player_boundary_required":"生存中のプレイヤーが次の操作を待つ状態である必要があります。","preflight_failed":"保存開始条件の確認に失敗しました。",
"prior_callbacks_changed_boundary":"先行保存のコールバックが操作待機状態を変更しました。","prior_save_coroutine_invalid":"先行保存コルーチンの状態が不正です。",
"tick_work_pending":"未処理のターン終了処理があります。","invalid_baseline_rng":"比較用の原版乱数状態が不正です。",
"settle_limit_reached":"原版の待機状態への移行が実行上限に達しました。",
"named_resume_requires_strict_host":"名前付き乱数状態の再開には厳密な実行境界を実装したホストが必要です。",
"native_call_failed":"ネイティブ呼び出しに失敗しました。","native_initialization_failed":"ネイティブ初期化に失敗しました。",
"original_dialog_required":"原版のダイアログへの入力が必要です。","original_graph_incomplete":"原版のゲーム・世界の保存が完了していません。",
"original_resume_failed":"原版の再開処理に失敗しました。","original_resume_not_quiescent":"原版の再開処理がまだ静止境界に達していません。",
"original_resume_not_ready":"原版の再開準備ができていません。","original_save_rejected":"原版の保存開始条件を満たしていません。",
"rng_restore_failed":"乱数状態の復元に失敗しました。","rng_restore_mismatch":"復元した乱数状態が保存値と一致しません。",
"fresh_vm_required":"新しい仮想マシンが必要です。","invalid_original_extras":"原版モジュールの追加設定が不正です。",
"invalid_request":"再開要求が不正です。","invalid_restore_transition":"復元状態の遷移が不正です。",
"invalid_save_name":"保存名が不正です。","invalid_start_state":"開始状態が不正です。","loaded_player_not_ready":"読み込んだプレイヤーの準備ができていません。",
"original_display_settle_failed":"原版の読み込み後の描画初期化に失敗しました。","original_game_load_failed":"原版のゲーム読み込みに失敗しました。",
"original_load_sequence_incomplete":"原版の世界・ゲーム・遅延読み込みの順序が完了していません。",
"original_settle_failed":"原版の読み込み後の待機状態への移行に失敗しました。","original_world_load_failed":"原版の世界読み込みに失敗しました。",
"request_missing":"再開要求がありません。","unexpected_birth":"既存の保存を再開する際に新規キャラクター作成が発生しました。",
"unsupported_baseline_layout":"比較用として対応していない乱数形式です。","capture_failed":"乱数状態を取得できませんでした。",
"capture_mode_mismatch":"乱数取得モードが一致しません。","invalid_envelope":"乱数状態の形式が不正です。","none":"乱数診断エラーはありません。",
"restore_failed":"乱数状態を復元できませんでした。","restore_mode_mismatch":"乱数復元モードが一致しません。",
"invalid_file":"ファイルが不正です。","original_handler_missing":"原版の配信ハンドラーがありません。",
"actual_idbfs_required":"実際のIDBFSが必要です。","actual_native_codec_required":"実際のネイティブ乱数形式処理が必要です。",
"already_initialized":"すでに初期化されています。","archive_validation_failed":"実際の保存アーカイブ検証に失敗しました。",
"archive_validator_required":"実際の保存アーカイブ検証機能が必要です。","checkpoint_mode_mismatch":"チェックポイントのモードが一致しません。",
"concurrent_sync":"永続保存の同時実行を検出しました。","crypto_unavailable":"SHA-256を計算するブラウザー機能がありません。",
"file_hash_mismatch":"保存ファイルのハッシュ値が一致しません。","fresh_runtime_home_required":"空の実行時保存領域が必要です。",
"generation_exists":"保存世代がすでに存在します。","incompatible_generation":"保存世代のバージョンまたは実行環境が対応していません。",
"invalid_active_pointer":"現在の保存世代への参照が不正です。","invalid_commit_acknowledgment":"永続保存完了の確認が不正です。",
"invalid_commit_state":"永続保存の状態が不正です。","invalid_file_manifest":"保存ファイル一覧が不正です。",
"invalid_graph_path":"ゲーム・世界の保存先が不正です。","invalid_head":"保存世代への参照が不正です。",
"invalid_read_state":"読み込み状態が不正です。","invalid_relative_path":"相対パスが不正です。",
"invalid_resume_copy_state":"再開用ファイルの複製状態が不正です。","invalid_rng_hex":"乱数状態の16進表記が不正です。",
"invalid_rng_sidecar_path":"乱数付随ファイルの保存先が不正です。","invalid_root":"保存領域のルートが不正です。",
"invalid_runtime_file":"実行時保存ファイルが不正です。","invalid_sidecar_layout":"乱数付随ファイルの形式が不正です。",
"loader_metadata_mismatch":"原版の読み込み設定が一致しません。","manifest_hash_mismatch":"保存マニフェストのハッシュ値が一致しません。",
"multiple_durable_mounts":"永続保存対象のマウントが複数あります。","native_gate_required":"実際のネイティブ排他ゲートが必要です。",
"no_valid_generation":"有効な保存世代がありません。","original_graph_not_complete":"原版のゲーム・世界の保存が完了していません。",
"original_graph_path_invalid":"原版のゲーム・世界の保存先が不正です。","rng_capture_failed":"乱数状態を取得できませんでした。",
"rng_validation_failed":"乱数状態の検証に失敗しました。","roots_overlap":"実行時領域と永続保存領域が重複しています。",
"runtime_file_changed":"保存中に実行時ファイルが変更されました。","sidecar_hash_mismatch":"乱数付随ファイルのハッシュ値が一致しません。",
"symlink_not_supported":"保存領域のシンボリックリンクには対応していません。","unfinished_archive":"未完了の保存アーカイブがあります。",
"actual_fs_required":"実際のブラウザーファイルシステムが必要です。","archive_limit":"保存ZIPが検証容量の範囲外です。",
"browser_deflate_required":"ブラウザーの実際のraw deflate展開機能が必要です。","central_directory_bounds":"ZIP中央ディレクトリの範囲が不正です。",
"central_header_invalid":"ZIP中央ヘッダーが不正です。","data_bounds":"ZIPメンバーデータの範囲が不正です。",
"descriptor_invalid":"ZIPデータ記述子が不正です。","end_record_missing":"ZIP終端レコードがありません。",
"inflation_limit":"ZIP展開結果が検証容量または申告サイズを超えています。","invalid_expected_class":"検証対象の原版クラス名が不正です。",
"invalid_limits":"ZIP検証上限が不正です。","local_header_invalid":"ZIPローカルヘッダーが不正です。",
"local_name_mismatch":"ZIPのローカル名と中央ディレクトリ名が一致しません。","local_size_mismatch":"ZIPのローカルサイズと中央ディレクトリ値が一致しません。",
"main_class_mismatch":"原版保存のルートクラスが一致しません。","member_crc_mismatch":"ZIPメンバーのサイズまたはCRCが一致しません。",
"member_name_invalid":"ZIPメンバー名が不正です。","member_unsupported":"暗号化などの未対応ZIPメンバーがあります。",
"multidisk_unsupported":"複数ディスク形式のZIPには対応していません。","overlapping_members":"ZIPメンバー領域が重複しています。",
}
prefix={"bridge":"保存処理", "flow":"保存・再開", "resume":"再開処理", "rng":"乱数状態", "server":"配信処理", "store":"永続保存", "zip":"保存ZIP検証"}
sources=[p for p in ROOT.rglob("*") if p.is_file() and p.suffix in {".c",".h",".inc",".lua",".mjs",".html"}]
ids=set()
for path in sources:
    ids.update(re.findall(r'''["'](save\.[a-z0-9_]+(?:\.[a-z0-9_]+)+)["']''',path.read_text(encoding="utf-8")))
en,ja={},{}
for key in sorted(ids):
    category,suffix=key.split(".")[1:]
    if category=="ui": en[key],ja[key]=UI[suffix]
    else:
        if suffix not in JA: raise ValueError("Missing Japanese diagnostic: "+key)
        en[key]=category.title()+": "+suffix.replace("_"," ").capitalize()+"."
        ja[key]=prefix[category]+"："+JA[suffix]
output("i18n/en.json",en);output("i18n/ja.json",ja)
output("i18n/manifest.json",{"schema":1,"default_language":"ja","coverage_scope":"Only explicit new adapter text IDs under save-resume-work; not the original game catalog","ids":len(ids),"ui_ids":sum(k.startswith("save.ui.") for k in ids),"developer_diagnostic_ids":sum(not k.startswith("save.ui.") for k in ids),"parameter_policy":"No adapter catalog placeholders; original names and diagnostic details are not translated","catalogs":{"en":"en.json","ja":"ja.json"},"runtime_validation":"Not executed; source-only catalog generation"})

# Verify staged reads against actual official pristine sources before attribution.
upstream=Path(r"C:\Users\kit\gameme\jnethack\jrouge\tome\upstream")
actual=upstream/"unpacked/game"
records=[]
for virtual,original,staged in [
    ("engine/Savefile.lua",actual/"engines/default/engine/Savefile.lua",ROOT.parent/"mechanics-audit-work/source/engine/Savefile.lua"),
    ("engine/SavefilePipe.lua",actual/"engines/default/engine/SavefilePipe.lua",ROOT.parent/"mechanics-audit-work/source/engine/SavefilePipe.lua"),
    ("engine/Module.lua",actual/"engines/default/engine/Module.lua",ROOT.parent/"mechanics-audit-work/source/engine/Module.lua"),
    ("engine/I18N.lua",actual/"engines/default/engine/I18N.lua",ROOT.parent/"bootstrap-work/source/engine/engine/I18N.lua"),
    ("mod/class/Game.lua",actual/"modules/tome/mod/class/Game.lua",ROOT.parent/"mechanics-audit-work/source/mod/class/Game.lua"),
    ("mod/class/World.lua",actual/"modules/tome/mod/class/World.lua",ROOT.parent/"mechanics-audit-work/source/mod/class/World.lua"),
    ("loader/init.lua",upstream/"t-engine4-src-1.7.6/game/loader/init.lua",ROOT.parent/"bootstrap-work/source/game/loader/init.lua"),
]:
    data=original.read_bytes();staged_data=staged.read_bytes()
    if data!=staged_data: raise ValueError("Pristine/staged source differs: "+virtual)
    records.append({"virtual":virtual,"official_source":str(original),"read_copy":str(staged),"bytes":len(data),"sha256":sha(data),"byte_identical":True})
output("original-source-provenance.json",{"schema":1,"sources":records,"original_code_license":"GPL-3.0-or-later; retain upstream license and source provenance","new_adapter_license":"GPL-3.0-or-later","runtime_validation":"Source comparison only; no native/browser save test executed by this agent"})

bundle=[]
for path in sorted(ROOT.rglob("*")):
    if path.is_file() and path.name not in {"source-manifest.json","browser-vfs-inputs.json"} and path.suffix in {".c",".h",".inc",".lua",".mjs",".html",".py",".md",".json"}:
        data=path.read_bytes();bundle.append({"path":path.relative_to(ROOT).as_posix(),"bytes":len(data),"sha256":sha(data)})
canonical=json.dumps(bundle,sort_keys=True,separators=(",",":")).encode("utf-8")
output("source-manifest.json",{"schema":1,"bundle_sha256":sha(canonical),"files":bundle,"runtime_validation":"Source-only; parent must compile and execute actual Chrome save/reload scenario"})
print(json.dumps({"text_ids":len(ids),"bundle_sha256":sha(canonical),"original_sources_verified":len(records)}))
