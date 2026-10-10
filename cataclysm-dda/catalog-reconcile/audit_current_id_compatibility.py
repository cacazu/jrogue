"""Lightweight grammar/schema audit of only the 539 reviewed addition IDs."""
from collections import Counter
import json
from pathlib import Path
import re

from reconcile import digest

ROOT = Path(__file__).resolve().parent.parent
paths = {locale: ROOT / "ja-current" / f"{locale}.json" for locale in ("en", "ja")}
catalogs = {locale: json.loads(path.read_text(encoding="utf-8")) for locale, path in paths.items()}
assert set(catalogs["en"]["entries"]) == set(catalogs["ja"]["entries"])
reasons, rejected, accepted = Counter(), [], []
for identifier in catalogs["en"]["entries"]:
    failures = []
    if not identifier or len(identifier.encode("utf-8")) > 160:
        failures.append("empty-or-over-160-bytes")
    if any(not re.fullmatch(r"[a-z][a-z0-9_]*", part) for part in identifier.split(".")):
        failures.append("component-not-lowercase-ascii-identifier")
    if "%" in identifier:
        reasons["contains-percent-escape"] += 1
    if any(part.isdecimal() for part in identifier.split(".")):
        reasons["has-numeric-only-component"] += 1
    if any(c.isupper() for c in identifier):
        reasons["contains-uppercase"] += 1
    if failures:
        rejected.append({"id": identifier, "reasons": failures})
        reasons.update(failures)
    else:
        accepted.append(identifier)
result = {"scope": "Only the 539 reviewed IDs in ja-current/en.json and ja.json; no whole inventory scan or catalog mutation",
          "sourceCommit": catalogs["en"]["source_commit"], "ids": len(catalogs["en"]["entries"]),
          "idSetsEqual": True, "acceptedByCurrentRustTextId": len(accepted), "rejectedByCurrentRustTextId": len(rejected),
          "nonExclusiveReasons": dict(reasons), "rejectedExamples": rejected[:12], "acceptedExamples": accepted[:12],
          "catalogSchemaCompatibleWithRustCatalogFromJson": False,
          "schemaDifferences": {"topLevelUnsupportedFields": ["source_commit", "scope"],
                                "additionEntryFields": ["context", "text", "printfParameters"],
                                "requiredRustEntryFields": ["parameters", "other"],
                                "optionalRustEntryFields": ["plural_parameter", "one"]},
          "inputSha256": {str(p.relative_to(ROOT)): digest(p) for p in paths.values()},
          "rustTextIdGrammarSource": "rust-contracts/logic/src/lib.rs::TextId::try_from",
          "rustCatalogSchemaSource": "rust-contracts/presentation/src/lib.rs::RawCatalog/RawEntry",
          "runtimeConnected": False}
out = ROOT / "docs/SEMANTIC-ID-COMPATIBILITY.json"
out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(result, ensure_ascii=False, indent=2))
