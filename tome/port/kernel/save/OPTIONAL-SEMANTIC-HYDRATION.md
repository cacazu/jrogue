# Optional host hydration before original resume

`baseline_flow.mjs` accepts an optional `beforeOriginalStart(freshModule, {request, verified})` callback in `resumeBaselineCheckpoint`. The callback runs exactly once after the genuine `tome_native_init` succeeds and the actual `tome_native_set_resume_request` accepts the saved original request, immediately before `tome_native_start_resume` executes the original loader. Its synchronous result or Promise is awaited. A thrown error stops loading and propagates; no fallback birth, reinitialization, retry, reseed or fake recovery is introduced.

The combined Rust/Japanese host can use this callback to register its actual Rust semantic adapter and invoke the parent's actual native semantic-resume capability with hydrated Japanese preferences before original module text is resolved. The host owns callback installation, error handling and disabled input/frame scheduling during hydration. It must not execute original start/load itself or call native initialization a second time.

At actual graph completion, the additive save module reads the first return from the unchanged original `engine.I18N:getLocalesData()`: the authoritative current native locale ID. It copies original loader metadata and stores this ID as `loader.preferred_locale`. The store persists that field and returns `request.preferred_locale` from the validated manifest before original resume starts. IDs are bounded to 1–64 ASCII identifier characters; `en_US`, `ja_JP` and other original locale IDs are preserved unchanged. This is a font/bootstrap hint, not a translated string and not a replacement for the saved original configuration loaded later. The semantic host must pass the validated saved hint, rather than forcing Japanese onto a saved English profile.

```js
await resumeBaselineCheckpoint(freshModule, store, {
  verified,
  onStatus,
  beforeOriginalStart: async (actualModule, {request, verified: checked}) => {
    // Register the host's actual Rust semantic instance and use the parent's
    // verified semantic-resume C API here, checking its actual success result.
    // Do not duplicate tome_native_init or tome_native_start_resume.
  },
});
```

When the option is omitted, there is no extra callback or await between accepted request and original start. The existing default page, checkpoint Lua, store, original driver, serializer, RNG restoration and original load ordering remain untouched.

A separate combined birth host that needs an `afterNativeInit` stage can place its semantic hydration call after its own single successful native init and before its own original native start. This change adds no second birth-page initialization or default-page hook. The Rust/UI agent's combined source entry remains fresh-character-only; root owns a dedicated semantic-resume entry that can use the new hook. This folder adds no parallel page.

The earlier original baseline run passed 24 checks at source-bundle SHA-256 `05bc53ae5b97419e4f94fba56f50a84c70a88c70ec122f8d7fe7fe8df75e6765`. This additive callback is source-only until the parent runs the default regression and actual hydrated Japanese save/resume scenario. The existing result remains evidence for the earlier baseline revision; it is not execution evidence for a supplied semantic callback.
