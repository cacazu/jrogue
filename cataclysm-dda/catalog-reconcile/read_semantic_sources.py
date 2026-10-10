"""Lightweight source excerpts used to ground the integration document."""
from pathlib import Path
import re

from reconcile import DEFAULT_SOURCE

SLICES = [
    ("src/translation.cpp", 296, 349),
    ("src/text_snippets.cpp", 24, 94),
    ("src/text_snippets.cpp", 239, 304),
    ("src/help.h", 1, 80),
    ("data/mods/MindOverMatter/help_files.json", 1, 25),
]
for name, start, stop in SLICES:
    print("\nFILE " + name)
    for number, line in enumerate((DEFAULT_SOURCE / name).read_text(encoding="utf-8").splitlines(), 1):
        if start <= number <= stop:
            print(f"{number}:{line}")

NAMES = [
    "src/json.h", "src/generic_factory.h", "src/item_factory.cpp", "src/itype.h",
    "src/mtype.h", "src/monstergenerator.cpp", "src/monster.cpp", "src/item.cpp",
    "src/item_tname.cpp", "src/npctalk.cpp", "src/dialogue.cpp",
    "src/translation_manager_impl.cpp", "src/translation_document.cpp",
    "src/translation.cpp", "src/input_context.cpp",
]
PATTERN = re.compile(r'(?:std::string\s+(?:item::|itype::|mtype::|monster::)|\.read\(\s*"(?:name|description)|dialogue::dynamic_line|parse_tags\(|::Translate|GetPlural|GetString|rng_bits|one_in\(|get_action_name)')
for name in NAMES:
    path = DEFAULT_SOURCE / name
    if path.exists():
        print("\nTARGET SYMBOLS " + name)
        found = [(i, l) for i, l in enumerate(path.read_text(encoding="utf-8").splitlines(), 1) if PATTERN.search(l)]
        for i, line in found[:35]:
            print(f"{i}:{line}")
