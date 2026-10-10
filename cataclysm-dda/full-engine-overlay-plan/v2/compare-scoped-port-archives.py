"""Compare recorded scoped file hashes with cached official archives; never extract."""
from pathlib import Path
import json,hashlib,re,tarfile
from datetime import datetime,timezone
ROOT=Path(__file__).resolve().parents[2]
HERE=Path(__file__).resolve().parent
SDK=Path(r"C:\Users\kit\emsdk\upstream\emscripten")
AUDIT=HERE/"METADATA-DELTA-index000-SCOPED.json"
raw=AUDIT.read_bytes()
assert hashlib.sha256(raw).hexdigest()=="8d3deb1d161ab2d9238326987b0e97250f1f3b902e5398972d6eebf187dae1b6"
rows=json.loads(raw)["phases"]["beforeFixedHelperImports"]["ports"]["changes"]
results=[]
for name,version,archiveName in [("harfbuzz","3.2.0","harfbuzz.2.0.tar.xz"),("libpng","1.6.58","libpng.6.58.tar.gz"),("zlib","1.3.2","zlib.3.2.tar.gz")]:
    definition=SDK/"tools/ports"/(name+".py")
    source=definition.read_bytes()
    text=source.decode()
    declared=re.search(r"^(?:VERSION|TAG)\s*=\s*['\"]([^'\"]+)['\"]",text,re.M).group(1)
    sha512=re.search(r"^HASH\s*=\s*['\"]([^'\"]+)['\"]",text,re.M).group(1)
    assert declared==version
    archive=ROOT/"engine-build/ports"/archiveName
    archiveRaw=archive.read_bytes()
    assert hashlib.sha512(archiveRaw).hexdigest()==sha512
    compared=[]
    errors=[]
    with tarfile.open(archive,"r:*") as t:
        members={m.name.removeprefix("./"):m for m in t.getmembers() if m.isfile()}
        for row in rows:
            if not row["member"].startswith(name+"/") or not row.get("afterBytes"):
                continue
            relative=row["member"][len(name)+1:]
            expected=row["afterBytes"]
            member=members.get(relative)
            content=t.extractfile(member).read() if member is not None else None
            sha=hashlib.sha256(content).hexdigest() if content is not None else None
            producer="verified archive member"
            producerPin={"member":relative,"sha256":sha}
            overrideName={"libpng":"pnglibconf.h","zlib":"zconf.h"}.get(name)
            if sha!=expected["sha256"] and overrideName and relative==name+"-"+version+"/"+overrideName:
                override=SDK/"tools/ports"/name/overrideName
                content=override.read_bytes()
                sha=hashlib.sha256(content).hexdigest()
                producer="documented official SDK "+overrideName+" override"
                producerPin={"path":str(override),"bytes":len(content),"sha256":sha}
            if content is None or sha!=expected["sha256"] or len(content)!=expected["bytes"]:
                errors.append({"member":relative,"reason":"content differs or archive member absent","archiveOrOverrideSha256":sha,"scopedSha256":expected["sha256"]})
            else:
                compared.append({"path":expected["path"],"bytes":expected["bytes"],"sha256":sha,"producer":producer,"producerPin":producerPin,"archiveMember":relative})
        licenseName="COPYING" if name=="harfbuzz" else "LICENSE"
        licenseMember=members[name+"-"+version+"/"+licenseName]
        licenseContent=t.extractfile(licenseMember).read()
    results.append({"name":name,"version":version,"definition":{"path":str(definition),"bytes":len(source),"sha256":hashlib.sha256(source).hexdigest()},"fetchLines":[l.strip() for l in text.splitlines() if "fetch_project" in l],"archive":{"path":str(archive),"bytes":len(archiveRaw),"sha256":hashlib.sha256(archiveRaw).hexdigest(),"sha512":sha512,"matchesSDKHash":True},"license":{"member":licenseMember.name,"bytes":len(licenseContent),"sha256":hashlib.sha256(licenseContent).hexdigest(),"text":licenseContent.decode()},"matchedFiles":len(compared),"matchedBytes":sum(r["bytes"] for r in compared),"errors":errors,"files":compared})
out={"status":"archive-comparison-pass" if all(not r["errors"] for r in results) else "archive-comparison-diagnostics","utc":datetime.now(timezone.utc).isoformat(),"sourceAudit":{"path":str(AUDIT),"bytes":len(raw),"sha256":hashlib.sha256(raw).hexdigest()},"actualExtractedBytesFromScopedAudit":True,"currentExtractedBytesRehashedHere":False,"ports":results,"scope":"default standard-library-only cached archive read; no extraction, imported port code, compiler or network","writer":"unidentified","publicationScope":"Linked-library notices already preserved; no extracted test/contrib/font source assets enter any website payload."}
destination=HERE/"SCOPED-PORTS-ARCHIVE-COMPARISON.json"
assert not destination.exists(),"fresh evidence output required"
destination.write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps({"status":out["status"],"output":str(destination),"ports":[{k:r[k] for k in ("name","version","matchedFiles","matchedBytes","errors","archive")} for r in results]},indent=2))
