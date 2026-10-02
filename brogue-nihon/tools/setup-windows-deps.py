"""Download pinned SDL2 development libraries into this checkout only."""
import hashlib
import io
from pathlib import Path
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
PACKAGES = [
    ("SDL", "release-2.32.10", "SDL2-devel-2.32.10-VC.zip", "af347939395a58b365846aaea27391e69f9ec9d4dd650d6ac40802159b418a6e"),
    ("SDL_image", "release-2.8.12", "SDL2_image-devel-2.8.12-VC.zip", "9e14b4166d6c905db18dbe5bbe2288bca17874a0944c70b457cd31b31f0ecf8f"),
    ("SDL_ttf", "release-2.24.0", "SDL2_ttf-devel-2.24.0-VC.zip", "2dea8ea01e04756ead27e196a681034ed71342562a75b512ea279fcdfde83307"),
]
for repo, tag, filename, expected in PACKAGES:
    destination = ROOT / ".deps" / repo
    if destination.is_dir():
        print("Already available:", repo)
        continue
    url = f"https://github.com/libsdl-org/{repo}/releases/download/{tag}/{filename}"
    data = urllib.request.urlopen(url).read()
    digest = hashlib.sha256(data).hexdigest()
    if expected and digest != expected:
        raise SystemExit("Unexpected archive checksum: " + filename)
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        if archive.testzip() is not None:
            raise SystemExit("Invalid ZIP: " + filename)
        for entry in archive.infolist():
            target = (destination / entry.filename).resolve()
            if destination.resolve() not in target.parents:
                raise SystemExit("Unsafe archive path: " + entry.filename)
        archive.extractall(destination)
    print(filename, digest)
