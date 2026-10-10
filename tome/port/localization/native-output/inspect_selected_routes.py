"""Copy a few original Lua consumers and emit narrow reviewed source windows."""
from pathlib import Path
import zipfile

SOURCE = Path(r"C:\Users\kit\gameme\jnethack\jrouge\tome\upstream\t-engine4-src-1.7.6")
ROOT = Path(__file__).resolve().parent
SELECTED = {
    "engine/Game.lua": [(275, 299)],
    "engine/Module.lua": [(903, 931)],
    "engine/interface/GameSound.lua": [(48, 78)],
    "engine/interface/GameMusic.lua": [(39, 61)],
    "engine/class.lua": [(451, 476)],
    "engine/dialogs/ShowErrorStack.lua": [(23, 94)],
    "engine/BootErrorHandler.lua": [(20, 100)],
}


def main():
    output = ROOT / "source-routes"
    output.mkdir(exist_ok=True)
    with zipfile.ZipFile(SOURCE / "game/engines/te4-1.7.6.teae") as archive:
        for name, windows in SELECTED.items():
            data = archive.read(name)
            target = output / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
            lines = data.decode("utf-8").splitlines()
            print(name)
            for first, last in windows:
                for number in range(first, min(last, len(lines)) + 1):
                    print(str(number) + ": " + lines[number - 1])


if __name__ == "__main__":
    main()
