"""Reproduce 400 source-only Japanese selected-resource drafts, batches 13--16.

Original epitaph.txt and bogusmon.txt: Copyright (c) 2015/2016 Pasi Kallinen.
Retain their notices and NetHack General Public License; no native application.
"""
import hashlib
import json
from pathlib import Path

BASE = Path(__file__).resolve().parent
MANIFEST_SHA = "a860641aca07e53b78c055ad3e67085aa05ef0ed226a8e5ccee35593258b61a8"
INPUT_HASHES = {
    13: "a4608ba5587873e5796dc0be85fc723d8255310db58f5931b96a3d57af51747c",
    14: "0169e177a0c705d25326953682a96037596fd7461dec14e4017c1fd7204b92aa",
    15: "b08d2b07620f1e2d9a55b50a49fa57d28a805df713cc9e57beebe91b987274b9",
    16: "3cedaa1fe2a5443275af0a40e8dcbfeb9d17de45f788427c059d5d7cdfd12d38",
}

# These are translation decisions, never native identity or gameplay contracts.
DETAILS = {
    (13, 1): "The idiomatic offer to pay and the grave's literal 'on me' joke coexist; no actual payment event is inferred.",
    (13, 3): "The selected personal-name spelling is transliterated; tree crushing remains explicit. The timber pun is not corrected into a different name.",
    (13, 5): "Virtually remains figurative; no digital simulation or actual survival fact is added.",
    (13, 8): "Dante's is the selected possessive place phrase; its establishment type remains unspecified. The greeting and level question remain without adding a shop, business or actual hell level.",
    (13, 13): "Appeal is the source's attraction wordplay; no extra legal proceeding is asserted.",
    (13, 17): "Wind is translated as the bodily wind in the explicit death-by-retention joke, with location, release and cause retained.",
    (13, 19): "The promise remains future and qualified by one or two days; no certainty or schedule event is generated.",
    (13, 23): "The unusual shoulder idiom is kept without inventing a particular demon or companion.",
    (13, 24): "Being led on and now being gone remain; no unsupported cause of death is added.",
    (13, 27): "Both burning-heart and literal heartburn clauses remain; no romantic or medical diagnosis is inferred.",
    (13, 28): "Keep jumbo versus shrimp's smallness rather than normalizing the deliberate oxymoron.",
    (13, 29): "Keep giant versus pigmy rather than normalizing the deliberate oxymoron or adding a species identity.",
    (13, 37): "Nightmare remains the displayed label; no equine anatomy, powers or actual monster species are asserted.",
    (13, 42): "Both rot and grub remain in the selected compound; no attacks or disease are inferred.",
    (13, 44): "Master and lichen remain; the compound is not corrected into an actual game monster.",
    (13, 49): "Sleazoid is an invented selected label, transliterated without inventing anatomy or etymology.",
    (13, 53): "Battlemech is the selected coined name; no franchise-specific chassis or capability is imported.",
    (13, 58): "Y2K remains exact, and bug retains the displayed computer/insect wordplay; no date-dependent claim is made.",
    (13, 60): "Arch-pedant expresses an extreme pedant, without adding a particular rank or office.",
    (13, 64): "The printed diagonal movement is retained as text only; no grid-bug movement rule is changed.",
    (13, 66): "Newsgroup troll retains the online-arrogance joke; no true troll identity is inferred.",
    (13, 72): "Retain both the moneylender idiom and shark surface word; no actual debt or aquatic anatomy is queried.",
    (13, 74): "The coined poultry-plus-geist name is represented as a chicken spirit; no additional spirit powers are added.",
    (13, 75): "Stuffing, raccoon and puppet all remain; no living raccoon is inferred.",
    (13, 77): "Wee retains smallness, green retains color and blobbie remains an invented diminutive name.",
    (13, 78): "Retain the were/platypus coined label; no real transformation state or anatomy is exported.",
    (13, 79): "Hag and bolding remain; this spelling is not repaired to 'bag of holding'.",
    (13, 82): "Keep spelling and bee as the displayed wordplay rather than replacing it with a real competition event.",
    (13, 85): "Pigasus is transliterated as the invented pig/Pegasus name without asserting hidden wings or genealogy.",
    (13, 86): "Semigorgon remains a coined name; no amount of monster power is inferred.",
    (13, 88): "Large and microbat are both retained, including the deliberate size contrast.",
    (13, 89): "Small and megabat are both retained, including the deliberate size contrast.",
    (13, 90): "Uberhulk remains the exact invented label; do not substitute an actual umber hulk.",
    (13, 91): "Retain tofu/turkey word formation without importing a recipe or dietary properties.",
    (13, 93): "Keep the shrinking-violet literal surface; the idiomatic shyness remains possible, not an asserted character trait.",
    (13, 94): "Shallow is preserved and is not silently corrected to the real 'deep one' name.",
    (13, 98): "Omnibus is transliterated to preserve its bus/collection uncertainty, without selecting a vehicle identity.",
    (13, 99): "Slinky is the selected label; no actual spring geometry or brand-specific asset is imported.",
    (13, 100): "Maxotaur is transliterated, retaining the max/min wordplay without turning it into the actual minotaur.",
    (14, 1): "Millitaur is transliterated, retaining the invented numerical-prefix wordplay without turning it into a minotaur.",
    (14, 4): "Quale is a selected unfamiliar label; the Japanese transliteration adds no theory of consciousness or physical identity.",
    (14, 5): "Holloway is transliterated without assuming whether it is a name or a road noun.",
    (14, 8): "Voussoir is rendered by the architectural noun for an arch stone, without adding shape or material details.",
    (14, 11): "Keep tooth plus saying/prophecy, not the unmodified 'soothsayer' spelling.",
    (14, 13): "Owl and pug remain the selected compound; no hybrid biology is inferred.",
    (14, 14): "Pugasus is an invented name; do not replace it with pigasus or Pegasus.",
    (14, 18): "Doozer is transliterated; no biography, franchise rule or machine identity is added.",
    (14, 20): "Lhurgoyf remains a transliterated proper/coined name; no card statistics or attacks are imported.",
    (14, 21): "Phelddagrif remains a transliterated proper/coined name; no card statistics or anatomy are imported.",
    (14, 23): "Retain the were/moustache joke as a selected label, without exporting a real transformation state.",
    (14, 25): "Choplet is a coined selected word, transliterated without a guessed object identity.",
    (14, 26): "Pommelbug is a coined selected word, transliterated without a guessed weapon or insect anatomy.",
    (14, 27): "Quest and sprout remain; no actual quest eligibility or plant identity is inferred.",
    (14, 31): "Paskald remains the selected unfamiliar invented name; no etymology is asserted.",
    (14, 32): "Brogmoid remains the selected unfamiliar invented name; no old game's mechanics are imported.",
    (14, 33): "Dornbeast remains the selected invented name; no old game's mechanics or anatomy are imported.",
    (14, 34): "Retain ancient, multiple hues and dragon; no elemental powers are added.",
    (14, 40): "Aquator is transliterated; no armor-rusting ability is added from another game.",
    (14, 44): "Xeroc is transliterated; no copying or disguised-object behavior is added.",
    (14, 50): "Unusual size remains unusual size, without an invented numeric measurement.",
    (14, 52): "The exact selected personal-name phrase is transliterated without adding fire-prevention instructions.",
    (14, 53): "Capitalized Luggage remains the selected name; no extra leg count or enchanted-container powers are imported.",
    (14, 57): "Nickelpede is an invented name, transliterated without replacing it with a centipede.",
    (14, 58): "Wiggle remains an unfamiliar selected label; no specific anatomy is guessed.",
    (14, 61): "The conventional Japanese coined push/pull name preserves the two opposed directions; no anatomy is added.",
    (14, 63): "Tribble remains the selected name; no reproduction behavior is imported.",
    (14, 64): "Klingon remains the selected name; no real target's race is revealed.",
    (14, 65): "Borg remains the selected name; no assimilation ability is imported.",
    (14, 66): "Ewok remains the selected name; no real target's race is revealed.",
    (14, 68): "Ohmu is rendered as the source name's Japanese spelling; no size, lore or attacks are added.",
    (14, 70): "Nyaasu is rendered as the selected name, not a real monster species or a moveset.",
    (14, 74): "Invid is transliterated without importing a hidden species classification or abilities.",
    (14, 76): "Boomer remains transliterated to preserve the selected name's ambiguity; no age or explosion is asserted.",
    (14, 79): "Retain ravenous, the Bugblatter name and Traal; no invisibility or lore is added.",
    (14, 80): "Retain leathery wing texture and avian; do not silently name a bat.",
    (14, 81): "Teenage, mutant, ninja and turtle all remain; no particular named team member is chosen.",
    (14, 84): "Retain Audrey and the numeral II; no plant biology or appetite is imported.",
    (14, 86): "Retain one eye, one horn, flight, purple and people-eating. English modifier ambiguity is not resolved with extra species facts.",
    (14, 90): "Questing beast is treated as the selected named phrase; no list of composite anatomy is added.",
    (14, 93): "Mother-in-law remains an in-law relation; no specific spouse gender or identity is added.",
    (15, 3): "Liger remains the public label; no parentage or genetic identity is additionally asserted.",
    (15, 5): "Corpulent and porpoise both remain; no exact weight is added.",
    (15, 10): "Wolpertinger is transliterated as a selected folklore name without specifying body parts.",
    (15, 11): "Elwedritsche is transliterated as a selected folklore name without specifying body parts.",
    (15, 12): "Skvader is transliterated as a selected folklore name without specifying body parts.",
    (15, 14): "Tatzelwurm is transliterated as a selected folklore name without specifying body parts.",
    (15, 15): "Dahu is transliterated as a selected folklore name without specifying leg lengths.",
    (15, 16): "Dropbear remains a coined name; no predatory behavior is imported.",
    (15, 17): "Wild and haggis remain; do not normalize this joke to cooked food or assert biological facts.",
    (15, 21): "Hippocampus remains the selected ambiguous name; no anatomical structure or hybrid biology is chosen.",
    (15, 29): "Wandering remains wandering; no hallucination, gaze attack or romantic behavior is inferred.",
    (15, 31): "Retain both the technical pointer noun and its dangling surface without an actual memory fault claim.",
    (15, 33): "Retain the floating-point computer pun; no native arithmetic mode is changed.",
    (15, 37): "Peer remains transliterated, retaining its person/computer-peer ambiguity.",
    (15, 39): "Keep wire and shark distinct as printed, rather than normalizing to a software product name.",
    (15, 40): "Keep stray and tab; do not repair the spelling to 'stray cat'.",
    (15, 41): "Bohrbug remains the coined bug name; no determinism property is added.",
    (15, 42): "Mandelbug remains the coined bug name; no complexity property is added.",
    (15, 43): "Schroedinbug remains the coined bug name; no quantum behavior is imported.",
    (15, 44): "Heisenbug remains the coined bug name; no observability behavior is imported.",
    (15, 46): "Scrag is transliterated without guessing an attack or a carcass identity.",
    (15, 47): "Crow T. Robot preserves the selected name and middle initial; no machine specification is added.",
    (15, 50): "Ooblecks is an invented selected label, transliterated without specifying a material or powers.",
    (15, 51): "Terracotta material and warrior remain the selected public label, without narrowing to a particular burial-statue tradition or asserting the actual target's material.",
    (15, 59): "First-category perpetual motion retains its original numbered class, without asserting it actually works.",
    (15, 60): "Big, dumb and object remain; no astrophysical origin or capabilities are imported.",
    (15, 63): "The selected robot prospects for kittens; no mining resources or actual robot state are queried.",
    (15, 64): "Guillemet is transliterated as the selected typographic label; no actual source delimiter changes.",
    (15, 65): "Solidus is transliterated, preserving typographic/coin uncertainty without adding an identity.",
    (15, 66): "Obelus is transliterated as the selected typographic label; no actual arithmetic operator changes.",
    (15, 67): "Dingbat remains transliterated, preserving the ornament/insult ambiguity.",
    (15, 68): "Keep bold plus face rather than correcting the printed word split to a font setting.",
    (15, 69): "Boustrophedon is rendered as the writing-direction term, with no change to the renderer's direction.",
    (15, 70): "Ligature is rendered as the typographic joined-character noun in this selected label, not a formatting instruction.",
    (15, 72): "Dinkus remains the selected typographic name; no separator is emitted as a command.",
    (15, 74): "Retain voluptuous and ampersand; no hidden gender or anatomy is assigned.",
    (15, 76): "Strong Bad remains the selected proper name, not an invented alignment or strength value.",
    (15, 78): "Smakken is a coined selected name, transliterated without invented anatomy.",
    (15, 79): "Mimmoth is the selected coined spelling, not repaired into mammoth.",
    (15, 80): "Keep the contradictory one-winged and dewinged qualifiers plus stab-bat; do not repair the source joke.",
    (15, 81): "Invisible and pink remain the intentional contradiction in the named unicorn joke; no actual visibility or color query.",
    (15, 84): "El Pollo Diablo remains the selected Spanish name; no biography or extra powers are imported.",
    (15, 86): "Retain the explicit weighted qualifier and Companion Cube name; no internal placement of weights, construction, exact mass or puzzle behavior is added.",
    (15, 87): "Manbearpig remains the coined name without an anatomy inventory.",
    (15, 88): "Retain bonsai and kitten as the printed joke, without importing how-to claims.",
    (15, 89): "Tie-thulu remains the selected altered name; do not silently replace it with Cthulhu.",
    (15, 91): "The source's stretched long spelling is represented by conspicuously stretched Japanese length, not normalized away.",
    (15, 96): "Tridude remains the selected invented name; no amount of actual anatomy is inferred.",
    (15, 97): "Orcus cosmicus remains the selected mock-taxonomic phrase, transliterated without actual taxonomy.",
    (15, 99): "Quylthulg remains an unfamiliar coined name; no other game's summoning powers are added.",
    (15, 100): "Greater, hell and beast remain; no specific combat tier or attack is inferred.",
    (16, 1): "Vendor and Yizard remain, preserving the altered Wizard-of-Yendor joke rather than repairing it.",
    (16, 4): "Ijyb remains the selected invented personal name without guessed biography or gender.",
    (16, 5): "Gloorx Vloq remains the selected invented personal name without guessed biography or gender.",
    (16, 7): "Unicorn, Pegasus and kitten remain the intentionally combined public label; no real creature identity is inferred.",
    (16, 9): "Preserve wight rather than correcting it to white, retaining the deliberate supremacist wordplay.",
    (16, 12): "The figment is explicitly of 'your' imagination; no objective monster identity or mental condition is asserted.",
    (16, 14): "Ghoti is preserved as an unusual spelled label through transliteration, not silently normalized to fish. Its spelling/pronunciation joke remains noted and no aquatic identity is exported.",
    (16, 15): "Vermicious knid remains the selected coined name without importing literary powers.",
    (16, 20): "Retain antagonistic plus eleven-sided/string word formation. The odd compound is not repaired to a real guitar or species.",
    (16, 21): "Mock role remains a simulated role; it is not repaired to the actual rock mole name.",
    (16, 26): "Gloating remains gloating, not floating; no floating-eye powers are inferred.",
    (16, 27): "Flush remains the source's altered golem qualifier; no flesh material is inferred.",
    (16, 28): "Martyr remains martyr, not Mordor; no geographical origin is imported.",
    (16, 29): "Mortar remains mortar, not Mordor; no geographical origin is imported.",
    (16, 30): "Blog remains blog, not blob; no acid-blob anatomy or powers are imported.",
    (16, 31): "Acute remains acute/sharp, not acid; no acid property is imported.",
    (16, 32): "Aria remains an aria, not air; no air-elemental state is imported.",
    (16, 33): "Aliasing remains aliasing, not alignment; no priest alignment is queried.",
    (16, 34): "Aligned is kept generic as congruent/aligned; no specific alignment, target identity or priesthood is inferred.",
    (16, 35): "Aligned and parquet both remain; no specific alignment or priest identity is inferred.",
    (16, 36): "Aligned and proctor both remain; no specific alignment or priest identity is inferred.",
    (16, 37): "Baby and balky remain; this is not normalized to a black dragon or given elemental powers.",
    (16, 38): "Baby and blues remain; this is not normalized to a blue dragon or given elemental powers.",
    (16, 39): "Baby and caricature remain; this is not normalized to a crocodile.",
    (16, 40): "Baby and crochet remain; this is not normalized to a crocodile.",
    (16, 41): "Baby and grainy remain; this is not normalized to a gray dragon.",
    (16, 42): "Baby, bong and worm remain; bong is the water-pipe noun, not a repaired 'long'.",
    (16, 43): "Baby, long and word remain; word is not repaired to worm.",
    (16, 44): "Baby, parable and worm remain; parable is not repaired to purple.",
    (16, 45): "Barfed remains expelled/vomited, not barbed; no actual vomiting event is generated.",
    (16, 46): "Beer remains beer, not barrow; the selected wight remains a lexical label only.",
    (16, 47): "Boor remains a rude person, not barrow; no actual wight behavior is inferred.",
    (16, 48): "Brawny remains muscular, not brown; no actual mold anatomy is exported.",
    (16, 49): "Rave remains the selected rave word, not cave; no actual venue or spider origin is inferred.",
    (16, 50): "Clue remains clue, not clay or glue; no real golem material is inferred.",
    (16, 51): "Bust is transliterated to retain its chest/sculpture/broken ambiguity, not repaired to dust.",
    (16, 52): "Errata remains corrections, not earth; no earth-elemental state is inferred.",
    (16, 53): "Elastic remains elastic, not electric; no electricity state is inferred.",
    (16, 54): "Electrocardiogram remains that printed diagnostic noun, not electric; no actual medical event is added.",
    (16, 55): "Fir remains the tree noun, not fire; no fire resistance or attack is inferred.",
    (16, 56): "Tire remains the tyre noun, not fire; no fire resistance or attack is inferred.",
    (16, 57): "Flamingo remains the bird noun, not flaming; no fire property is inferred.",
    (16, 58): "Fallacy remains fallacy, not flesh; no actual golem material is inferred.",
    (16, 59): "Frizzed is the selected frizzed-hair adjective, not a repaired 'forest'.",
    (16, 60): "Forest and centerfold remain; the name is not repaired to forest centaur.",
    (16, 61): "Fierceness remains fierceness, not freezing; no cold property is inferred.",
    (16, 62): "Frosted is transliterated to retain frosting/icing ambiguity; neither sugar nor actual cold properties are additionally asserted.",
    (16, 63): "Geriatric remains old-age related, not garter; no exact target age is queried.",
    (16, 64): "Gnat remains the small fly noun, not giant; no actual species identity is inferred.",
    (16, 65): "Bath remains bath, not bat; giant remains giant.",
    (16, 66): "Grant remains the financial grant noun, not giant; no actual money event is inferred.",
    (16, 67): "Greater remains greater, not garter; no actual species identity is inferred.",
    (16, 68): "Grind remains grind, not grid; no original grid-bug movement behavior is imported.",
    (16, 69): "Mango remains mango, not mimic; giant remains giant.",
    (16, 70): "Glossy remains glossy, not glass; no actual golem material is inferred.",
    (16, 71): "Laureate remains an honored/awarded person, not lord; no kingship or exact office is added.",
    (16, 72): "Dummy remains dummy, not mummy; no actual undead identity is inferred.",
    (16, 73): "Gooier retains the comparative degree rather than silently normalizing to gray ooze.",
    (16, 74): "Slide remains slide, not slime; green remains green.",
    (16, 75): "Nacho remains nacho, not naga; guardian remains guardian.",
    (16, 76): "Pun remains pun, not pup; no hound offspring or actual hell identity is queried.",
    (16, 77): "Purist remains purist, not priest; high remains high without adding a religious office.",
    (16, 78): "Hairnet remains hairnet, not horned; no real devil anatomy is inferred.",
    (16, 79): "Trowel remains trowel, not troll; ice remains ice.",
    (16, 80): "Beet remains beetroot, not bee; killer remains killer.",
    (16, 81): "Feather remains feather, not leather; no actual golem material is queried.",
    (16, 82): "Lounge remains lounge, not long; worm remains worm.",
    (16, 83): "Lymph remains lymph, not nymph; no actual anatomy is queried.",
    (16, 84): "Pager remains pager, not paper; no actual golem material is queried.",
    (16, 85): "Pie remains pie, not pit; fiend remains fiend.",
    (16, 86): "Prophylactic remains preventative, not purple; no sexual/medical object or actual worm power is added.",
    (16, 87): "Sock remains sock, not rock; mole remains mole.",
    (16, 88): "Rogue remains rogue, not rock; piercer remains the selected creature-name component only.",
    (16, 89): "Seesawing retains back-and-forth movement, not shocking; no electricity state is inferred.",
    (16, 90): "Simile remains a comparison figure, not small; mimic remains mimic.",
    (16, 91): "Moldier retains its comparative moldiness rather than being corrected to soldier ant.",
    (16, 92): "Stain remains stain, not steam; vortex remains vortex.",
    (16, 93): "Scone remains scone, not stone; giant remains giant.",
    (16, 94): "Umbrella remains umbrella, not umber; hulk remains the selected hulk component.",
    (16, 95): "Mace remains mace, not mage; vampire remains vampire, without actual powers.",
    (16, 96): "Verbal remains word-related, not vorpal; jabberwock remains the selected name.",
    (16, 97): "Water and lemon remain separate source words; no repair to water elemental.",
    (16, 98): "Water and melon remain the printed split-word joke; no repair to water elemental.",
    (16, 99): "Winged and grizzly remain; no repair to winged gargoyle or true bear identity.",
    (16, 100): "Yellow remains yellow, not yellow light; wight remains the selected name.",
}

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def load(path):
    return json.loads(path.read_text(encoding="utf-8"))

def notes(batch, index, original):
    english = original["english_named_template"]
    source_names = {r["source"] for r in original["source_records"]}
    note = ("New Japanese translation of the complete originally selected public line "
            + repr(english) + ". Original source_records, transformations, selected-line "
            "positions and empty argument union remain exact. Preserve qualifiers, "
            "negation, odd spelling, numbers and deliberate joke contradictions. ")
    if "dat/epitaph.txt" in source_names:
        note += ("This is the epitaph's speaker/text, not an engine fact or a new claim "
                 "about cause of death, actual graves, rewards or characters. ")
    if "dat/bogusmon.txt" in source_names:
        note += ("This is the native already selected hallucination label only. "
                 "Native prefix-code stripping/name grammar remains in source evidence; "
                 "no prefix code, source index or real monster identity belongs in the "
                 "player event. Invented/proper names are transliterated without importing "
                 "lore, hidden anatomy, powers or another game's mechanics. ")
    if (batch, index) in DETAILS:
        note += DETAILS[(batch, index)] + " "
    note += ("No native text/name/state/RNG/knowledge helper is rerun. Bind only the "
             "completed original public selection, using proven native resource offsets "
             "and the same event lifetime; never rendered-English matching. Unsupported "
             "downstream grammar, capitalization or printf precision retains the whole "
             "original English frame. Source meaning approved; generated makedefs "
             "offsets, rights review of incorporation, native capture and runtime remain unapproved.")
    return note

def main():
    manifest_path = BASE / "resource-authoring-batches.json"
    assert digest(manifest_path) == MANIFEST_SHA
    manifest = load(manifest_path)
    data_path = BASE / "random-selected-text-batches-13-16.translation-data.json"
    data = load(data_path)
    assert data["input_manifest_sha256"] == MANIFEST_SHA
    assert data["runtime_binding_approved"] is False
    outputs = []
    for number in range(13, 17):
        source_path = BASE / ("random-selected-text-batch-%d.json" % number)
        assert digest(source_path) == INPUT_HASHES[number]
        source = load(source_path)
        japanese = data["batch_%d" % number]
        assert len(japanese) == len(source["entries"]) == 100
        entries = []
        for index, (original, translated) in enumerate(zip(source["entries"], japanese), 1):
            assert original["argument_schemas"] == original["typed_arguments"] == []
            assert isinstance(translated, str) and translated
            assert all(r["source"] in {"dat/epitaph.txt", "dat/bogusmon.txt"} for r in original["source_records"])
            entries.append({
                "id": original["id"],
                "english_named_template": original["english_named_template"],
                "whole_message_ja": translated,
                "source_review_status": "faithful-official-source-equivalent",
                "translation_notes": notes(number, index, original),
                "typed_arguments": original["typed_arguments"],
                "argument_schemas": original["argument_schemas"],
                "source_records": original["source_records"],
                "runtime_binding_approved": False,
            })
        target = source_path.with_name(source_path.stem + ".authored.json")
        authored = {
            "schema_version": 1,
            "source_commit": manifest["source_commit"],
            "input_sha256": INPUT_HASHES[number],
            "input_manifest_sha256": MANIFEST_SHA,
            "translation_data_sha256": digest(data_path),
            "source_rights": "Original epitaph.txt/bogusmon.txt copyright (c) 2015/2016 Pasi Kallinen. Retain original notices and NGPL; fresh Japanese from selected upstream labels, no third-party excerpt reuse or assets.",
            "scope": "Whole originally selected public text; source review only. Resource source-index mapping, public consumer, completed grammar and runtime remain unapproved.",
            "runtime_binding_approved": False,
            "entries": entries,
        }
        target.write_bytes((json.dumps(authored, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))
        outputs.append({"path": target.name, "ids": len(entries), "bytes": target.stat().st_size, "sha256": digest(target)})
    print(json.dumps(outputs))

if __name__ == "__main__":
    main()
