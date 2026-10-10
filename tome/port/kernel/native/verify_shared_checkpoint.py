"""Verify only task-owned source/catalog bytes after copying the ToME checkpoint."""
from pathlib import Path
import hashlib
import json

WORK = Path(__file__).resolve().parent.parent
TOME = Path(r"C:\Users\kit\gameme\jnethack\jrouge\tome")
shared = TOME / "port"
checkpoint = json.loads((WORK / "localization-kernel-work/ROOT-CHECKPOINT.json").read_text(encoding="utf-8"))
verified = 0
for relative, expected in checkpoint["deliverable_sha256"].items():
    if relative.startswith("localization-kernel-work/"):
        destination = shared / "localization" / relative.removeprefix("localization-kernel-work/")
    elif relative.startswith("localization-c-output-work/"):
        destination = shared / "localization/native-output" / relative.removeprefix("localization-c-output-work/")
    else:
        raise SystemExit("Unexpected non-ToME checkpoint source")
    if not destination.is_file():
        raise SystemExit(f"Missing checkpoint file: {destination}")
    digest = hashlib.sha256(destination.read_bytes()).hexdigest()
    if digest != expected:
        raise SystemExit(f"Mismatched checkpoint bytes: {destination}")
    verified += 1
status = json.loads((TOME / "STATUS.json").read_text(encoding="utf-8"))
assert status["production_semantic_ids"] == 24825
assert status["approved_japanese_supplement_ids"] == 307
assert status["japanese_supplement_review_required_ids"] == 172
assert status["site_url"] is None and status["full_game_boot_verified"] is False
result = {"task_owned_files_sha256_verified": verified, "destination": str(shared), "source_checkpoint_bytes_match": True, "git_index_touched": False, "other_games_touched": False, "site_url": None}
(WORK / "localization-kernel-work/shared-checkpoint-validation.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
print(json.dumps(result))
