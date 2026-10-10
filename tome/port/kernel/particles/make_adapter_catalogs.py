"""Generate exact en/ja semantic diagnostic catalogs from the owned C sources."""
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
TEXTS = {
    "engine.rng_phase.none": ("No random-state error.", "乱数状態のエラーはありません。"),
    "engine.rng_phase.not_initialized": ("Random-state ownership has not been initialized.", "乱数状態の管理が初期化されていません。"),
    "engine.rng_phase.not_quiescent": ("A random-state switch requires an idle callback boundary.", "乱数状態を切り替えるには、実行中の処理がすべて終了している必要があります。"),
    "engine.rng_phase.already_initialized_or_busy": ("Random-state ownership is already initialized or busy.", "乱数状態の管理はすでに初期化されているか、処理中です。"),
    "engine.rng_phase.codec_size_mismatch": ("An original random-state codec has an unexpected size.", "元の乱数状態の保存形式のサイズが一致しません。"),
    "engine.rng_phase.capture_failed": ("The original random state could not be captured.", "元の乱数状態を取得できませんでした。"),
    "engine.rng_phase.callback_reentry": ("A callback cannot enter this random-state phase.", "この乱数処理段階では、処理を開始できません。"),
    "engine.rng_phase.callback_boundary_mismatch": ("The random-state callback boundary does not match.", "乱数処理の開始と終了が一致しません。"),
    "engine.rng_phase.capture_or_validation_failed": ("Random-state capture or validation failed.", "乱数状態の取得または検証に失敗しました。"),
    "engine.rng_phase.install_failed": ("The validated random state could not be installed.", "検証済みの乱数状態を適用できませんでした。"),
    "engine.rng_phase.invalid_buffers": ("Named random-state buffers are missing or overlap.", "名前付き乱数状態の領域が未指定か、重複しています。"),
    "engine.rng_phase.invalid_saved_banks": ("The saved gameplay or visual random state is invalid.", "保存されたゲーム処理または表示処理の乱数状態が不正です。"),
    "engine.rng_phase.invalid_snapshot_buffer": ("The named random-state snapshot buffer has an invalid size.", "名前付き乱数状態の保存領域のサイズが不正です。"),
    "engine.rng_phase.invalid_snapshot": ("The named random-state snapshot is invalid.", "名前付き乱数状態の保存データが不正です。"),
    "engine.particles.none": ("No particle-platform error.", "パーティクル処理のエラーはありません。"),
    "engine.particles.lua_panic": ("The original particle Lua state failed during initialization.", "元のパーティクル用Lua環境の初期化に失敗しました。"),
    "engine.particles.vm_allocation_failed": ("The original particle Lua state could not be allocated.", "元のパーティクル用Lua環境を確保できませんでした。"),
    "engine.particles.pre_init_failed": ("The original particle loader pre-initialization failed.", "元のパーティクルローダーの事前初期化に失敗しました。"),
    "engine.particles.emitter_init_panic": ("An original particle emitter failed during initialization.", "元のパーティクル発生器の初期化に失敗しました。"),
    "engine.particles.emitter_cleanup_panic": ("An original particle emitter failed during cleanup.", "元のパーティクル発生器の終了処理に失敗しました。"),
    "engine.particles.keyframe_queue_overflow": ("The pending particle keyframe queue overflowed.", "未処理のパーティクル更新キューが上限を超えました。"),
    "engine.particles.lane_not_ready": ("The original particle lane is missing or faulted.", "元のパーティクル処理レーンが存在しないか、異常状態です。"),
    "engine.particles.lifecycle_reentry": ("The particle lane cannot retire during an active update.", "更新処理中は、パーティクル処理レーンを終了できません。"),
    "engine.particles.retirement_allocation_failed": ("Particle retirement ownership could not be allocated.", "パーティクル終了処理の管理領域を確保できませんでした。"),
    "engine.particles.lifecycle_reentry_or_fault": ("The particle lane cannot initialize during an update or fault.", "更新処理中または異常状態では、パーティクル処理レーンを初期化できません。"),
    "engine.particles.lane_allocation_failed": ("The original particle lane could not be allocated.", "元のパーティクル処理レーンを確保できませんでした。"),
    "engine.particles.lane_mutex_failed": ("The original particle lane mutex could not be created.", "元のパーティクル処理レーンのミューテックスを作成できませんでした。"),
    "engine.particles.not_visual_barrier": ("Particle preparation requires an idle visual phase.", "パーティクルの準備には、表示処理が待機状態である必要があります。"),
    "engine.particles.main_gl_context_required": ("Particle preparation requires the original main GL context.", "パーティクルの準備には、元のメインGLコンテキストが必要です。"),
    "engine.particles.invalid_frame_budget": ("The particle keyframe budget is invalid.", "パーティクル更新の処理件数が不正です。"),
}

sources = [ROOT / "tome_rng_phases.c", ROOT / "generated/particles_cooperative.c"]
source_ids = set()
for source in sources:
    source_ids.update(re.findall(r'"(engine\.(?:rng_phase|particles)\.[a-z_]+)"', source.read_text(encoding="utf-8")))
if source_ids != set(TEXTS):
    raise ValueError("diagnostic coverage mismatch: missing=" + repr(sorted(source_ids - set(TEXTS))) + " extra=" + repr(sorted(set(TEXTS) - source_ids)))
destination = ROOT / "i18n"
destination.mkdir(exist_ok=True)
for locale, index in [("en", 0), ("ja", 1)]:
    data = {key: TEXTS[key][index] for key in sorted(TEXTS)}
    (destination / (locale + ".json")).write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
manifest = {
    "scope": "Only the new exact particle-platform and RNG-phase adapter diagnostic IDs; not an original-game catalog",
    "default_locale": "ja",
    "count": len(TEXTS),
    "classification": "developer diagnostic; not currently rendered directly to players",
    "ids": {key: {"parameters": [], "classification": "developer_diagnostic"} for key in sorted(TEXTS)},
    "source_sha256": {str(path.relative_to(ROOT)): hashlib.sha256(path.read_bytes()).hexdigest() for path in sources},
    "generation": "Source-only exact-ID and en/ja set coverage checked; no application/runtime test executed",
}
(destination / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"ids": len(TEXTS), "destination": str(destination), "exact_source_id_coverage": True}))
