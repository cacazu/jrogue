"""Independent read-only review evidence for browser_host's frozen 800 drafts.

Writes only this reviewer's separate report, never peer authoring or runtime.
Original NetHack source and notices remain under the NGPL.
"""
from collections import Counter
import hashlib
import json
from pathlib import Path

BASE = Path(__file__).resolve().parent
SOURCE = BASE.parents[2] / "official-source-audit/NetHack-5.0.0"
CHECKPOINT = "random-selected-text-batches-1-8.source-verification.json"
CHECKPOINT_SHA = "922b7bfd6299ee6a8d3da0feeb63e9563af3e5652ffcf3b97d9a670c8a318df6"

FINDINGS = [
    (1, 6, "added-size-qualifier", "長い", "刀ならワームを真っ二つにできるかもしれない。",
     "English says 'a worm', not a long worm. Remove the added size/species qualifier; no gameplay knowledge may supply it."),
    (2, 98, "added-direction", "斜めに", "格子虫は、横切ると攻撃してこないという。",
     "English says 'when you cross it', not diagonally. Remove the imported movement direction and retain the cross wordplay without explaining a game rule."),
    (5, 12, "invented-causal-ability", "耳を聞こえなくする", "耳の聞こえない杖（deaf）は、羊の杖（sheep）より危険な武器だ。",
     "The deliberately odd selected name is 'wand of deaf'. Expanding it to a wand which makes ears deaf adds a causal ability. Keep deaf/sheep words and the original comparison without repairing the joke into mechanics."),
    (5, 25, "omitted-emphasis", "よく効く", "バナナの皮は、キーストーン・コップに特によく効く。",
     "The source explicitly says 'especially well'; retain especially rather than ordinary well."),
    (5, 43, "added-front-position", "正面の相手", "正しい方向へ向け、直接対する相手に直接の一撃をまっすぐ当てよう。",
     "A direct opponent is rendered as an opponent in front. The source supplies no front-facing position; keep the direct/direction repetition without adding spatial state."),
    (5, 52, "instruction-became-autonomous-result", "人間はみな二マス離れる", "ニンニクを10片食べ、人間をみな二マス離しておこう。",
     "The source instructs the reader to eat and keep humans at a distance. Current Japanese asserts that every human moves away on its own. Preserve the command and agency, with ten cloves/two squares exact."),
    (6, 81, "added-kingship", "ドワーフの王", "ドワーフの領主は鎧が軽いので、つるはしを持てるという。",
     "The selected public title is dwarf lord, not dwarf king. Preserve lord without adding kingship; consistent source-reviewed lord terminology is acceptable."),
    (8, 56, "changed-time-word", "夜に", "夕方にモーニングスターを使っても、効果はない。",
     "Evening was changed to night. Retain evening and the morning/evening joke contrast."),
    (8, 72, "possession-became-transformation", "薬にできた", "わあ！　果物ジュースの薬を手にできたのに！",
     "Could have had a potion became could have made/turned it into a potion. Preserve availability/possession and the counterfactual, without inventing a transformation or recipe."),
    (8, 83, "extortion-narrowed-to-letter", "恐喝状", "手紙を売って金持ちになれるかもしれないが、恐喝されないよう気をつけろ！",
     "Being blackmailed is replaced by watching for an extortion letter. Preserve being the target of extortion; the letter joke must not narrow the original threat or drop its passive meaning."),
    (8, 87, "dark-narrowed-to-skin", "色黒", "背が高く、黒っぽく、ぞっとする生き物に出会うだろう……",
     "Dark is rendered as skin complexion. The source's creature label supplies no skin/body identity; retain dark without assuming skin."),
]
TERMINOLOGY = [
    (1, 1, "telepathy", "テレパシーが使えるなら、目隠しはとても役に立つ。",
     "念話 can suggest mental communication; the original public ability term is telepathy. Original display.c/do_wear.c comments describe sensing. Prefer the broader original term テレパシー; this is a terminology precision suggestion, not dictionary-certified etymology."),
    (2, 64, "telepathy", "テレパシーはただの技だ。やり方さえわかれば簡単だ。",
     "Use the same source telepathy term as batch1 #1; avoid implying an added communication ability."),
    (8, 19, "moves-versus-turns", "腹が減ったら、30手でピザが届き、間に合わなければ無料だという。",
     "English specifies 30 moves. Prefer 30手 if move and global turn are intentionally distinct; this is a source-word precision suggestion, not a claim about scheduling."),
]

def load(path):
    return json.loads(path.read_text(encoding="utf-8"))

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    checkpoint_path = BASE / CHECKPOINT
    assert digest(checkpoint_path) == CHECKPOINT_SHA, "Peer checkpoint changed; review must be rebased explicitly"
    checkpoint = load(checkpoint_path)
    errors, artifacts, by_position = [], [], {}
    counts = Counter()
    source_cache = {}
    for artifact in checkpoint["artifacts"]:
        number = artifact["batch"]
        assert 1 <= number <= 8
        original_path = BASE / artifact["input"]
        authored_path = BASE / artifact["authored"]
        if digest(original_path) != artifact["input_sha256"]:
            errors.append("Input hash changed: " + original_path.name)
        if digest(authored_path) != artifact["authored_sha256"]:
            errors.append("Authored hash changed: " + authored_path.name)
        original = load(original_path)
        authored = load(authored_path)
        if len(original["entries"]) != 100 or len(authored["entries"]) != 100:
            errors.append("Unexpected batch count: " + str(number))
        if authored.get("input_sha256") != artifact["input_sha256"]:
            errors.append("Authored input identity changed: " + str(number))
        for index, (expected, actual) in enumerate(zip(original["entries"], authored["entries"]), 1):
            context = str(number) + ":" + str(index)
            by_position[(number, index)] = actual
            counts["reviewed_ids"] += 1
            if expected["id"] != actual["id"]:
                errors.append(context + " ID/order mismatch")
            if expected["source_records"] != actual["source_records"]:
                errors.append(context + " source records altered")
            if expected["argument_schemas"] != actual["argument_schemas"] or actual["argument_schemas"] != []:
                errors.append(context + " argument union changed")
            if actual.get("runtime_binding_approved") is not False:
                errors.append(context + " runtime flag not false")
            english = expected["english_named_template"]
            japanese = actual["whole_message_ja"]
            if english.startswith("[cookie] "):
                counts["cookie_marker_source_units"] += 1
                if not japanese.startswith("[cookie] "):
                    errors.append(context + " original cookie markup not preserved")
                if not any("not eligible for runtime" in note or "not eligible" in note
                           for note in actual["translation_notes"]):
                    errors.append(context + " cookie runtime deferral not explicit")
            for record in expected["source_records"]:
                counts["source_records"] += 1
                counts[record["source"]] += 1
                if record["source"] not in source_cache:
                    path = SOURCE / record["source"]
                    source_cache[record["source"]] = (digest(path), path.read_text(encoding="utf-8").splitlines())
                sha, lines = source_cache[record["source"]]
                if sha != record["source_sha256"]:
                    errors.append(context + " original source hash mismatch")
                if record["source_start_line"] != record["source_end_line"]:
                    errors.append(context + " not a single selected line")
                line = lines[record["source_start_line"] - 1]
                if line != record["original_resource_line"]:
                    errors.append(context + " selected resource line changed")
                prefix = record.get("original_bogusmon_prefix_code")
                if prefix:
                    counts["bogusmon_prefix_source_units"] += 1
                selected = line[1:] if prefix else line
                if selected != record["english_source_literal"]:
                    errors.append(context + " original selected prefix transformation changed")
                if record["source"].startswith("dat/rumors."):
                    if not record.get("no_truth_class_in_player_event"):
                        errors.append(context + " truth-class guard missing")
                    if not expected["id"].startswith("nethack.resource.rumor."):
                        errors.append(context + " truth-neutral rumor ID shape changed")
        artifacts.append({"batch": number, "reviewed_ids": 100,
                          "input_sha256": artifact["input_sha256"],
                          "authored_sha256": artifact["authored_sha256"]})
    findings = []
    for batch, index, kind, observed_fragment, suggested, reason in FINDINGS:
        actual = by_position[(batch, index)]
        if observed_fragment not in actual["whole_message_ja"]:
            errors.append("Finding checkpoint does not match " + str((batch, index)))
        findings.append({"batch": batch, "entry_index_one_based": index,
                         "id": actual["id"], "english": actual["english_named_template"],
                         "observed_japanese": actual["whole_message_ja"], "kind": kind,
                         "suggested_japanese": suggested, "reason": reason,
                         "disposition": "source-only owner correction proposed; not applied",
                         "source_records": actual["source_records"]})
    terms = []
    for batch, index, kind, suggested, reason in TERMINOLOGY:
        actual = by_position[(batch, index)]
        terms.append({"batch": batch, "entry_index_one_based": index,
                      "id": actual["id"], "english": actual["english_named_template"],
                      "observed_japanese": actual["whole_message_ja"], "kind": kind,
                      "suggested_japanese": suggested, "reason": reason,
                      "disposition": "terminology precision suggestion; owner decision pending"})
    report = {
        "schema_version": 1,
        "status": "source-only-fidelity-findings-for-owner" if not errors else "checkpoint-validation-failed",
        "reviewer": "jp_batch2",
        "frozen_checkpoint": CHECKPOINT,
        "frozen_checkpoint_sha256": CHECKPOINT_SHA,
        "counts": dict(counts),
        "source_evidence_error_count": len(errors),
        "source_evidence_errors": errors,
        "concrete_fidelity_findings": findings,
        "concrete_fidelity_finding_count": len(findings),
        "terminology_suggestions": terms,
        "terminology_suggestion_count": len(terms),
        "reviewed_artifacts": artifacts,
        "native_transform_review": {
            "cookie": "Original rumors.c removes the exact [cookie] prefix from the selected public buffer after native selection; reviewed source catalogs retain markup and explicit runtime ineligibility. No producer or localization overlay is approved by this report.",
            "bogusmon": "No bogusmon units occur in reviewed batches1--8; exact original prefix-code transformations remain a separate contract for later name-label queues.",
            "rumor_truth": "Truth-neutral semantic IDs retained; true/false filenames and guards are offline developer evidence only. No runtime event projection or truth-bucket exposure is approved.",
        },
        "review_limits": [
            "Read every English/Japanese pair across all 800 original IDs, including uncertainty, negation, qualifiers, counts/dates, name/key examples, intentional false rumors and joke adaptations.",
            "No peer authored/input/source/runtime/config/browser files were changed. Corrections are sent by messages for the owner after its serial browser job drains.",
            "Source-equivalence statuses are author declarations; this independent review identified concrete meaning shifts and does not certify all literary etymology, Latin or obscure allusions.",
            "Raw Latin/name inscriptions such as ad aerarium/Owlbreath and parser-significant Elbereth are not independently dictionary-certified here; retaining names/syntax must not become a blanket translation exemption.",
            "No native compiler, Node, browser, dynamic callback/lifetime, makedefs resource-offset, RNG trace, gameplay, parser or publication coverage is claimed.",
        ],
        "runtime_binding_approved": False,
        "runtime_approved_ids": 0,
        "compiled_pipeline_verified": False,
        "browser_invoked": False,
        "node_invoked": False,
    }
    target = BASE / "random-selected-text-batches-1-8.jp-batch2-fidelity-review.json"
    target.write_bytes((json.dumps(report, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))
    print(json.dumps({"path": target.name, "sha256": digest(target), "counts": dict(counts),
                      "source_evidence_errors": len(errors), "concrete_findings": len(findings),
                      "terminology_suggestions": len(terms), "runtime_approved_ids": 0}))
    if errors:
        raise SystemExit(1)

if __name__ == "__main__":
    main()
