"""Source-only parent-run transformation; never invoke tools or native code.

Extract the exact original main-loop SDL switch into a reusable platform helper.
It retains every switch-body byte and keeps the desktop loop calling that body.
Only the owned generated output changes; current retained source is untouched.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ORIGINAL_SHA256 = "8359b9c86572d3b5ad5c5e6db632f3225e3a1154b2d1e30d3aae0503b581e79b"
COMMIT = "624a67329fe2ad440c5b344785a9c73fcf22ae63"

def prepare(original: Path, retained: Path, output: Path) -> dict:
    pristine = original.read_bytes()
    if hashlib.sha256(pristine).hexdigest() != ORIGINAL_SHA256:
        raise ValueError("Unexpected official original main.c")
    data = retained.read_bytes()
    if not data.startswith(pristine):
        raise ValueError("Retained original prefix must remain byte-identical")
    output = output.resolve()
    if not output.is_relative_to(HERE) or output.suffix != ".c":
        raise ValueError("Generated source must stay inside rust-platform-input-work")
    nl = b"\r\n" if b"\r\n" in pristine else b"\n"
    start_anchor = b"\t\t\tswitch(event.type)"
    end_anchor = nl + b"\t\t}" + nl + nl + b"\t\t/* draw the scene */"
    if data.count(start_anchor) != 1:
        raise ValueError("Exact original event-switch anchor not unique")
    start = data.index(start_anchor)
    end = data.index(end_anchor, start)
    switch = data[start:end]
    if b"SDL_USEREVENT" not in switch or b"on_event(&event)" not in switch:
        raise ValueError("Original switch did not contain required unchanged paths")
    body = data[:start] + b"\t\t\ttome_main_dispatch_original_event(&event);" + data[end:]
    main_anchor = b"int main(int argc, char *argv[])"
    if body.count(main_anchor) != 1:
        raise ValueError("Exact main anchor not unique")
    declaration = b"void tome_main_dispatch_original_event(SDL_Event *event);" + nl
    body = body.replace(main_anchor, declaration + main_anchor, 1)
    helper = nl + b"/* Authored platform extraction: the following original switch is byte-identical. */" + nl
    helper += b"void tome_main_dispatch_original_event(SDL_Event *input)" + nl + b"{" + nl
    helper += b"\tSDL_Event event = *input;" + nl + switch + nl
    helper += b"\t*input = event;" + nl + b"}" + nl
    helper += b"int tome_main_original_reboot_pending(void)" + nl + b"{" + nl
    helper += b"\treturn core_def && core_def->corenum != 0;" + nl + b"}" + nl
    helper += b"int tome_main_physical_prepare_initial_boot(void)" + nl + b"{" + nl
    helper += b"\t/* Original boot_lua:1195, restricted to pristine browser initialization. */" + nl
    helper += b"\tif (!L || !core_def || current_game != LUA_NOREF || core_def->corenum != -1 ||" + nl
    helper += b"\t    !core_def->coretype || strcmp(core_def->coretype, \"te4core\") ||" + nl
    helper += b"\t    core_def->reboot_engine || core_def->reboot_engine_version || core_def->reboot_module ||" + nl
    helper += b"\t    core_def->reboot_name || core_def->reboot_new || core_def->reboot_einfo) return 0;" + nl
    helper += b"\tcore_def->corenum = 0;" + nl + b"\treturn 1;" + nl + b"}" + nl
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(body + helper)
    evidence = {"schema_version":1,"source_commit":COMMIT,"original_sha256":ORIGINAL_SHA256,
        "retained_sha256":hashlib.sha256(data).hexdigest(),"switch_sha256":hashlib.sha256(switch).hexdigest(),
        "original_switch_byte_identical":True,"original_full_body_byte_identical":False,
        "changed_slots":["event switch call extraction","helper forward declaration","platform helper appendix"],
        "generated_sha256":hashlib.sha256(body+helper).hexdigest(),"output":str(output),
        "build_or_runtime_executed":False}
    output.with_suffix(".provenance.json").write_text(json.dumps(evidence,indent=2)+"\n",encoding="utf-8")
    return evidence

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--original",type=Path,required=True)
    parser.add_argument("--retained",type=Path,required=True)
    parser.add_argument("--output",type=Path,default=HERE/"generated/main_physical_state.c")
    args=parser.parse_args()
    print(json.dumps(prepare(args.original,args.retained,args.output)))

if __name__ == "__main__":
    main()
