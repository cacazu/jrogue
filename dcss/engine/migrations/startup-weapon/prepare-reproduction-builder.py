"""Source-only derivation of the reviewed configurable reproduction recipe."""
from pathlib import Path
import hashlib

HERE=Path(__file__).resolve().parent
old=HERE.parent/'dcss-startup-build-work/build-startup.py'
text=old.read_text(encoding='utf-8')
if hashlib.sha256(old.read_bytes()).hexdigest()!='fed917abb533ec1eb62102b6a376fc7724643a6c3ac05ecdbf3a84dca90803f7':
    raise ValueError('Executed original builder changed')

def edit(before,after):
    global text
    if text.count(before)!=1:raise ValueError('Expected one source transformation: '+before)
    text=text.replace(before,after,1)

edit("GAME=Path(r'C:\\Users\\kit\\gameme\\jnethack\\jrouge\\dcss')", "GAME=HERE.parents[2]")
edit("PATCH=HERE.parent/'dcss-startup-work'", "PATCH=HERE/'inputs'")
edit("OUT=GAME/'engine/candidates/startup-weapon'", "OUT=GAME/'engine/candidates/startup-weapon-reproduced'")
edit("def validate():", '''def relocate_flags(flags,old_root):
    return [flag.replace(old_root,str(GAME)) for flag in flags]
def manifest_root(manifest):
    ending='engine\\\\work-wasm-eh\\\\crawl-ref\\\\source'
    matches=[flag[2:] for flag in manifest['cxx_flags'] if flag.startswith('-I') and flag.endswith(ending)]
    if len(matches)!=1:raise ValueError('Expected exactly one original native source include')
    original=matches[0][:-len(ending)].rstrip('\\\\/')
    return original
def validate():''')
edit("def validate():\n    require_hash(BASE/'manifest.json',MANIFEST_BASE)", "def validate():\n    require_hash(HERE/'audit/executed-build-startup.py','fed917abb533ec1eb62102b6a376fc7724643a6c3ac05ecdbf3a84dca90803f7')\n    require_hash(HERE/'audit/executed-font-free-startup-package.py','52e44e62ea2ed5b8d13de2b862401b2899b3c13fa08df2074257d38b167ec921')\n    require_hash(BASE/'manifest.json',MANIFEST_BASE)")
edit("common=manifest['cxx_flags'][:-1]", "old_root=manifest_root(manifest)\n    common=relocate_flags(manifest['cxx_flags'][:-1],old_root)")
edit("'baseline_compiler_fingerprint':FP,'same_compile_flags':manifest['cxx_flags'],", "'baseline_compiler_fingerprint':FP,'same_compile_flags':relocate_flags(manifest['cxx_flags'],old_root),\n       'baseline_cxx_flags':manifest['cxx_flags'],'reproduction_schema_version':1,")
edit("def main():\n    parser=", "def main():\n    global GAME,PATCH,BASE,SOURCE,OUT,SDK,PYTHON,EMCC\n    parser=")
edit("args=parser.parse_args();base,index,receipt=validate()", '''parser.add_argument('--root',type=Path,default=GAME,help='DCSS folder; default is three directories above this migration recipe')
    parser.add_argument('--patch',type=Path,default=PATCH,help='Reviewed migration inputs; default is the adjacent inputs folder')
    parser.add_argument('--out',type=Path,default=Path('engine/candidates/startup-weapon-reproduced'),help='New candidate directory, relative to --root or absolute beneath its engine/candidates')
    parser.add_argument('--sdk',type=Path,default=SDK,help='Installed official Emscripten 6.0.8 SDK root')
    args=parser.parse_args()
    GAME=args.root.resolve();PATCH=args.patch.resolve();SDK=args.sdk.resolve()
    BASE=GAME/'engine/build-jspi-wasm-eh';SOURCE=GAME/'engine/work-wasm-eh/crawl-ref/source'
    OUT=(args.out if args.out.is_absolute() else GAME/args.out).resolve()
    candidates=(GAME/'engine/candidates').resolve()
    if not OUT.is_relative_to(candidates) or OUT==candidates:raise ValueError('Output must be a distinct child of DCSS engine/candidates')
    if (SDK/'upstream/emscripten/emscripten-version.txt').read_text().strip().strip('"')!='6.0.8':
        raise ValueError('The reviewed official Emscripten 6.0.8 SDK is required')
    PYTHON=SDK/'python/3.13.3_64bit/python.exe';EMCC=SDK/'upstream/emscripten/emcc.py'
    base,index,receipt=validate()
    flags=receipt['same_compile_flags']
    receipt['output_candidate']=OUT.relative_to(GAME).as_posix()''')
edit("*base['cxx_flags']]", "*flags]")
edit("flags=list(base['link_flags'])", "flags=relocate_flags(base['link_flags'],manifest_root(base))")
edit("'compiler_fingerprint':FP,'cxx_flags':base['cxx_flags'],", "'compiler_fingerprint':FP,'cxx_flags':receipt['same_compile_flags'],")
edit("'link_response_sha256':response_hash,'outputs':outputs,'build_helper_sha256':helper_hash,", "'link_response_sha256':response_hash,'outputs':outputs,'build_helper_sha256':helper_hash,\n        'audit_executed_builder_sha256':'fed917abb533ec1eb62102b6a376fc7724643a6c3ac05ecdbf3a84dca90803f7',")
edit("Default --check never compiles, links, installs or imports another Python tool.", "Default --check never compiles, links, installs or imports another Python tool.\nDefaults resolve solely inside the installed DCSS migration folder; --sdk\nselects the official installed external toolchain. Root relocation only rebases\nreviewed include/link paths, preserving the canonical header/flags fingerprint.")
output=HERE/'reproduce-startup.py'
output.write_text(text,encoding='utf-8')
print(output)
print(hashlib.sha256(output.read_bytes()).hexdigest())
