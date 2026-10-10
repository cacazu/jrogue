# Command text source integration

Status: source-connected command events, reviewed browser-only controlled-drop guard, and new owning naming projections. The naming phase has source parity/contract checks; its coordinated C/WASM build and browser acceptance remain pending. Parent-coordinated earlier binary evidence is unchanged. Upstream is Angband 4.2.6 commit f3082213b73f3e463e3d0d60bff4b00462beae6e.

The 19 reviewed dynamic callsites in cmd-cave.c and cmd-pickup.c now emit source-aware typed events before their unchanged native msg/msgt calls can yield for More. The original 44 static IDs and their 61 callsites keep their accepted callback path. Native AB_TEXT_CAPTURE arguments are not evaluated. Every command addition is tagged; removing those additions reconstructs the two complete accepted source files byte-for-byte, including CRLF. This establishes native source preservation rather than comparing a selected set of copied expressions. Browser behavior has one intentional safety exception for a consumed controlled-drop pointer, described below; undefined post-free feedback is not claimed faithful.

## Coverage

| Source paths | Dynamic envelopes | Typed capture | Japanese renderer status |
| --- | ---: | --- | --- |
| Digging, including diagnostic terrain | 8 | Method enum plus apparent or diagnostic terrain identity | Supported by reviewed template/descriptor resolver source |
| Trap disarm outcomes | 3 | Reviewed displayed-name alias and original sound category | Supported by reviewed template/descriptor resolver source |
| Level feelings | 3 | Only the disclosed grade(s), branch context and original conjunction decision | Supported by reviewed template/descriptor resolver source |
| Gold pickup | 1 | Original sum and diversity result; selected money catalog key copied during the live-kind loop | Supported by two reviewed composition branches and 11 money names |
| Fear, controlled door actions and controlled drop | 4 | Owned schema-v2 selected native actor/object naming parts, copied after the original descriptor | Full reviewed naming composition source connected; new C/WASM/browser acceptance pending |

There are 19 source event insertion points. Fifteen non-monster/object captures keep their previously reviewed resolver source; the remaining four now connect the owning naming captures and reviewed composition described in NAMING_CAPTURE.md. All 19 source paths have complete semantic producers for defined ordinary cases, but the new naming phase is not yet runtime verified. Capture limits, unavailable catalog identities and invalid UTF-8 remain explicit failures. The 48 reviewed command IDs are the 19 envelopes, 27 supporting fragments and two gold composition templates. Supporting IDs are resolved in Rust from the typed values, rather than being selected by matching completed English output. The 11 money name IDs and reviewed terrain/trap aliases are additional data dependencies.

## ABI and ownership

web-semantic.h exposes a bounded owning JSON builder. The canonical envelope is:

```json
{"schema_version":1,"id":"game.dig.rubble.progress","channel":"message","context":"command","widget":"log","severity":0,"sound":0,"params":{"digging_method":{"type":"DiggingMethod","value":"hands"}}}
```

The builder accepts UTF-8 only, escapes strings and bounds the complete JSON to 128 KiB. Controlled JSON syntax must use ab_semantic_json_literal; every external/catalog string must use ab_semantic_json_string. Oversize, invalid UTF-8, allocation failure or an unfinished parameter invalidates the capture, with the original engine path unchanged. These failure paths still require runtime verification.

For valid text events it calls ab_rs_review_event(json,length), then ab_host_semantic_event(json,length,localized), synchronously. Rust localization failure is forwarded as NULL; the host records that unsupported result and keeps the original terminal without rerunning the core or looking up completed English. The JSON and Rust text must be copied immediately by the host; their pointers are not persistent. Event storage is released after the callback.

UI controls use id empty, channel ui, context surface, approved control widgets and typed params. ab_semantic_event_emit_control skips Rust and supplies an empty localized string. Root owns the host allowlist and UI control validation. Static ab_rs_message/ab_host_message remains separate and unchanged.

## Pure captures and source identities

Terrain mapping follows the fixed list-terrain.h order. Apparent terrain is read from player->cave and its mimic; diagnostic terrain intentionally follows the original actual-feature name or unnamed feature-index branch. Trap tidx is assigned in source order by finish_parse_trap and maps to the reviewed displayed-name aliases, so spiked/poison pits and other hidden trap variants do not expose their internal descriptions. Gold sval is 1-based: obj-init.c increments num_svals before assigning it. The 11 gold records map copper through adamantite to money.*.name IDs. No completed English name is compared to select a translation.

Digging method is frozen from the original hands/weapon/swap branch. Feelings expose no undisclosed object grade in the monster-only branch. Gold preserves the native name-comparison diversity outcome, feedback gate, all-object sum, sound thresholds, deletion order and purse update. The selected semantic money key is copied while the kind is live.

Actor selected naming parts are frozen after the original monster_desc point, before controlled actions. These owned JSON values contain only actual pronoun/name/prefix/appositive/offscreen decisions, with no race/entity ordinal or hidden original identity. The controlled actor copies JSON immediately and retains it across deletion; feared attack copies immediately after MDESC_DEFAULT. General naming projections cover the full native MDESC family and monster-list grammar. Source-selected catalog stems and identical indefinite pronoun coalescing protect information suppressed by native text. See NAMING_CAPTURE.md for the complete wire and ownership policy.

## Controlled-drop lifetime safety and remaining descriptor limits

The original drop code calls drop_near before its existing FULL object_desc and ignore check. drop_near can merge or destroy the object without updating the caller's pointer (obj-pile.c:918-920, 992-1010, 1128-1157). Capturing beforehand would also differ: placement and merging can update object knowledge, quantity, charges and inscriptions. Calling object_desc or ignore_item_ok through a freed pointer is an existing concrete lifetime defect, so its undefined output cannot be preserved as meaningful behavior.

Only the browser path now freezes a uintptr_t address while obj is live, immediately before the unchanged drop_near call. After that call, ab_text_object_address_is_live compares the saved integer with the current real cave object table at indices 1 through obj_max minus one. It never dereferences the saved address or evaluates the possibly consumed obj pointer. A matching live object continues through the existing FULL description, ignore check, semantic capture and message in their original order. A missing object breaks out of the command switch before all of those follow-up operations. The normal action-energy tail still executes. Completed placement, absorption/destruction, RNG calls and drop_near feedback/sound are unchanged; no survivor is substituted and no invented secondary description/message is emitted for a consumed object. The native build removes both saved-address and guard blocks and retains the accepted source byte-for-byte.

The lifetime basis is explicit in the engine source: ordinary floor placement calls list_object before returning; absorption and destruction remove the known record, then clear the real cave slot before freeing the original. No reviewed post-deletion branch allocates and lists a replacement real object. Knowledge work may reuse the allocation address for a known replica, but that replica is stored in player->cave rather than the real cave table. An allocated retained/orphaned object still in the real table continues through the original live-object path. The integer must be frozen before a consuming call: converting or passing a freed C pointer afterward would still evaluate an indeterminate pointer value.

The command object parameter performs the secondary live-membership guard, then copies the immutable v2 capture already produced by its one original PREFIX|FULL object_desc call. It reads no known/real object fields and never repeats the descriptor or its everseen mutations. Consumed paths emit no secondary drop capture. The complete selected base/flavor/book/ego/artifact, prefix/plural, known combat, chest/fuel, modifier/charge/annotation grammar and generated-name policy now live in web-naming.[ch] and reviewed naming catalogs. Native English byte limits and independent Japanese reflow are explicit. A missing cached capture is complete:false rather than a fabricated object or a delayed pointer lookup.

## Verification and next build

Run node --test tests/command-semantic-integration.test.mjs tests/naming-capture-source.test.mjs for lightweight source checks. They cover accepted snapshot hashes and full reconstruction, all 19 exact original message calls and capture sequencing, independent source identity tables, native no-evaluation macros, hidden/stale-pointer guards, unchanged static callback, and bounded owning event source. Two additional tests verify the saved-address-before-drop and guard-before-dereference order, the unchanged energy tail, independent engine registration/removal/free provenance, and live/retained/merged/destroyed fixtures through a mechanically translated copy of the exact pure address-scan body. That tiny source-policy fixture executes in Node; it does not compile or execute C, model allocator reuse, or prove the emitted ABI, JSON bytes, allocation handling, render purity or gameplay/browser behavior.

The parent must schedule the next memory-bounded rebuild and add web-naming.c to the adapter source list, register the generic naming envelopes and include the frozen bilingual naming inputs. Existing sources already contain web-text-capture.c and semantic/UI/spell adapters. Previous build/browser/save evidence belongs to its accepted binary; it does not verify this new naming phase. Root owns C/WASM compilation and live browser acceptance. No C engine build, browser job, installer, packaging, publication or Git action was run by this source task.
