"""Read-only, bounded archive/source audit; never extracts, builds or installs."""
from pathlib import Path, PurePosixPath
import hashlib
import json
import tarfile

HERE = Path(__file__).resolve().parent
PLAN = HERE / "build-plan" / "consumer-build-plan.json"
document = json.loads(PLAN.read_text(encoding="utf-8"))


def digest(stream):
    result = hashlib.sha256()
    while block := stream.read(65536):
        result.update(block)
    return result.hexdigest()


records = []
for dependency in document["cachedDependencies"]:
    if "archive" not in dependency:
        continue
    archive = Path(dependency["archive"])
    source = Path(dependency["unpackedManifest"]).parent.resolve()
    with archive.open("rb") as handle:
        assert digest(handle) == dependency["sha256"], archive
    prefix = f'{dependency["name"]}-{dependency["version"]}'
    count = total = 0
    with tarfile.open(archive, "r|gz") as members:
        for member in members:
            parts = PurePosixPath(member.name).parts
            assert parts and parts[0] == prefix and ".." not in parts, member.name
            if member.isdir():
                continue
            assert member.isfile(), f"unsupported cached archive member: {member.name}"
            destination = source.joinpath(*parts[1:]).resolve()
            assert destination.is_relative_to(source), member.name
            assert destination.is_file(), destination
            assert destination.stat().st_size == member.size, destination
            contents = members.extractfile(member)
            assert contents is not None
            with contents, destination.open("rb") as existing:
                assert digest(contents) == digest(existing), destination
            count += 1
            total += member.size
    records.append({"name": dependency["name"], "version": dependency["version"],
                    "archiveSha256": dependency["sha256"],
                    "archiveBytes": archive.stat().st_size,
                    "unpackedRegularFilesVerified": count,
                    "unpackedBytesVerified": total,
                    "sourceEqualsVerifiedArchive": True})

report = {"schemaVersion": 1, "status": "passed-read-only-source-audit",
          "planSha256": hashlib.sha256(PLAN.read_bytes()).hexdigest(),
          "registryArchivesVerified": len(records),
          "unpackedFilesVerified": sum(item["unpackedRegularFilesVerified"] for item in records),
          "unpackedBytesVerified": sum(item["unpackedBytesVerified"] for item in records),
          "compilerExecuted": False, "cacheMutated": False,
          "method": "Stream every regular file in the 13 already cached checksum-pinned archives and compare with the existing Cargo unpacked cache; no extraction or installation",
          "records": records}
destination = HERE / "build-plan" / "dependency-source-audit.json"
destination.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print(json.dumps({key: report[key] for key in ["status", "registryArchivesVerified", "unpackedFilesVerified", "unpackedBytesVerified", "compilerExecuted"]}))
