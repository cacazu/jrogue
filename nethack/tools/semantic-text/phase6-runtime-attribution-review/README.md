# Rust compiler_builtins attribution evidence

This review adds evidence only. Existing license folders, runtime provenance, installed toolchains, Rust source/proof checkpoints, build inputs and engine artifacts were preserved. No compiler, Node, browser, installer or downloaded code ran.

The selected Phase 6 Rust staticlib has 269 compiler_builtins object members. Every member name and payload is identical to the installed Rust 1.98.1 wasm32-unknown-emscripten `libcompiler_builtins-299604ffea0f91fe.rlib`. The in-tree package metadata declares compiler_builtins 0.1.160; its exact source revision is official Rust commit `48a229ceaefd4985c50990b14116b6d856af0985`. A separate standalone compiler-builtins repository commit is not inferred.

`review-official.json` records six byte-identical installed/official pinned source files, the installed distribution metadata, all 269 member digests, and precise original notice recommendations. The literal declared license expression is preserved as metadata without interpretation.

Recommended additive notice files, copied verbatim from the exact installed source paths recorded in the report:

- `library/compiler-builtins/LICENSE.txt`: 15,078 bytes; SHA256 `ab6eec6caf0fa5775e411c7a8bc6a45c4ef2956b0980b157ab74fc5cd62a928b`.
- `library/compiler-builtins/libm/LICENSE.txt`: 14,088 bytes; SHA256 `3823dda7cf046602f4b4e77ec8e227863dc4736037cc85bb33d9f19febe16bb7`.

The component license explicitly references compiler-rt/CREDITS.TXT. This reference was independently checked at official LLVM snapshot `439c28996aae50467c2c1e18e10b901e33ddf279`. Its 1,049 original bytes match the existing bundled credits, SHA256 `a9901f47a089da41e4690682d00ce4cedaa2baf41fedbe79beee366d43ac2461`. This equality is specific evidence; the review does not assume the Emscripten license automatically covers a distinct Rust component.

`notice-certificate.json` and `original-comment-notices.txt` preserve a bounded inventory of 23 distinct original copyright/license comment blocks, with 75 installed-source occurrences. Every distinct block is verified against a representative immutable official Rust source file; all recorded local occurrences are checked as original byte ranges. The verbatim block bundle can be added separately when preserving component notices. The scan is finite and is not a complete per-file license audit.

The certificate also verifies the existing actual Rust proof and all 11 selected source files plus two project-provenance inputs against their current immutable checkpoint. Additive notice metadata need not change that checkpoint or the existing 14-artifact runtime bundle.

The archive-member comparison proves presence in the selected staticlib, not retention of particular members or routines in final linked WASM. No license compatibility or rights conclusion is made. No official distribution archive was independently downloaded or validated; the exact source-file matches and installed package metadata are the recorded binding.

For reproduction, run `review.py --online --output <fresh-name>.json` using the documented SDK Python. Public HTTPS permission may be necessary. `certify-notices.py` requires its certificate/bundle paths to be absent; preserve prior reports and use an isolated copy of this evidence folder for a fresh reproduction. The local-only report was retained separately as `review-local.json`.