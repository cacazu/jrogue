# Original-engine mobile canvas diagnosis

This is a source diagnosis and a proposed platform-only fix. No browser, engine build, server, engine code, or shell was changed by this task. The reported live reproduction is from the browser QA owner: desktop backing resolution 1280 × 640 becomes 390 × 195 after a 390 × 844 mobile viewport change, and the native popup is cropped.

## Verified cause

The original engine distinguishes a logical SDL window from a browser-scaled canvas. The current shell accidentally tells SDL that the CSS rectangle owns the logical window size.

1. `shell/baseline.css:13` declares `canvas { width: 100%; height: 100%; ... }`. `shell/baseline-shell.js:20–28` also writes explicit pixel CSS dimensions in `fitCanvas()`, including the call from `Module.onRuntimeInitialized` before original C++ window creation. The ResizeObserver and MutationObserver can invoke the same function during startup.
2. The compiled official SDL port is `engine-build/ports/sdl2/SDL-release-2.32.10/src/video/emscripten/SDL_emscriptenvideo.c`. `Emscripten_CreateWindow`, lines 228–241, sets the backing canvas to **1 × 1**, reads its CSS rectangle, and stores `external_size = floor(css_w) != 1 || floor(css_h) != 1`. When external CSS dimensions remain explicit, this flag becomes true. For a resizable window it immediately adopts that CSS size and sends `SDL_WINDOWEVENT_RESIZED`.
3. Original upstream `src/sdltiles.cpp:253–259` makes a resizable SDL window. Lines 281–284 explicitly clear `SDL_WINDOW_ALLOW_HIGHDPI` for Emscripten. SDL therefore uses pixel ratio 1 (`SDL_emscriptenvideo.c:219–223`); changing device pixel ratio is not a solution.
4. `Emscripten_RegisterEventHandlers`, `SDL_emscriptenevents.c:995`, registers the window resize callback. `Emscripten_HandleResize`, lines 884–924, starts from `window->w/h`, then reads `emscripten_get_element_css_size` when the cached `external_size` is true (903–905). It writes that width/height to the backing store (907) and sends `SDL_WINDOWEVENT_RESIZED` (920). The fitted 390 × 195 DOM rectangle thus becomes a 390 × 195 engine surface.
5. Original `src/sdltiles.cpp:3051–3052` records those dimensions, and `handle_resize` at 1822–1838 assigns `WindowWidth/Height` and reconstructs render targets/UI. Its terminal minimum clamp at 1831–1832 can require more cells than the new small surface can contain. This explains a cropped popup instead of a scaled complete frame.

The actual generated candidate runtime agrees with the installed sources: `baseline-preview/web/cataclysm-tiles.js:7334–7340` directly assigns `canvas.width/height` in `_emscripten_set_canvas_element_size`; lines 7559–7568 read `getBoundingClientRect()` in `_emscripten_get_element_css_size`; lines 10620–10669 deliver the registered browser resize callback. This is SDL2's C window adapter, rather than the older `Browser.resizeListeners` implementation.

## Minimal fix for shell owner to review

Keep the existing CSS-only scale calculation, but let the original SDL creation probe run against the natural intrinsic canvas first:

```js
function fitCanvas() {
  // SDL has to finish window creation without explicit CSS canvas dimensions.
  if (!diagnostics.menuReady) return;
  // Existing stage/width/height guards and CSS-only fit calculation follow.
}
```

Remove `width: 100%; height: 100%` from the canvas stylesheet. Leave the canvas with intrinsic `width: auto; height: auto` until `menuready`; do not add a max-width, transform, fixed dimensions, or a stretched grid alignment during that interval. Existing `#stage { place-items: center; }` supports the intrinsic 1 × 1 probe. Gate **all** fitting paths, including runtime initialized, ResizeObserver, and MutationObserver, through the same readiness guard. The existing `menuready` handler already sets `diagnostics.menuReady = true` before calling `fitCanvas()`.

With a natural 1 × 1 CSS rectangle at the probe, SDL caches `external_size=false` and creates its backing store from the original requested window dimensions. After menu readiness, CSS fitting can scale the visible rectangle. On viewport resize, SDL uses its own unchanged window dimensions instead of the display rectangle. Do not hard-code 1280 × 640: preserve whatever resolution the original options select. In this source, `WinCreate()` has one call at `sdltiles.cpp:3770`; ordinary later `SDL_SetWindowSize` operations retain that window's cached external-size flag.

Do not override `getBoundingClientRect`, report fake CSS geometry, reset backing attributes after SDL has resized, or blanket-stop browser resize events. Those approaches can leave SDL/window/render dimensions inconsistent or break input mapping. A new engine window created after CSS fitting would need a new unstyled creation interval; the current source's single `WinCreate()` call bounds this startup fix, and that lifecycle limitation should remain documented.

## Input contract to preserve

SDL needs the **real displayed** rectangle for coordinates. `Emscripten_HandleMouseMove`, `SDL_emscriptenevents.c:615–641`, multiplies DOM target coordinates by `window->w / client_w` and `window->h / client_h`. `Emscripten_HandleTouch`, lines 751–787, normalizes touch coordinates by that same real CSS size. Preserve an aspect-correct rectangle on the canvas element itself, and keep the existing zero border/padding. No coordinate rewrite or gameplay input remap is necessary for this fix.

## Bounded verification required before claiming a fix

- Extend the shell VM harness to provide canvas styles, intrinsic dimensions, and observer callbacks. Verify runtime initialization and pre-menu observations never set CSS canvas width/height; menu readiness enables fitting; later intrinsic engine changes fit CSS without writing backing dimensions. This is a regression guard for the adapter, not actual SDL evidence.
- In the existing QA-owned browser, reload at desktop size and record intrinsic canvas dimensions, displayed bounds, phase, and errors. Open the same original-engine popup and retain the complete-frame screenshot.
- Change to 390 × 844 and to a landscape mobile viewport. Backing dimensions must stay equal to the original engine resolution, the entire popup must remain visible, and the displayed aspect ratio must match it. Repeat from a **fresh mobile-first page load**: desktop-first-only verification misses the creation-probe problem.
- Check pointer/touch hits at separated locations and use existing helper controls. Verify focused text input/IME behavior remains unchanged. A screenshot alone does not establish SDL coordinate correctness.
- Check resize redraws as well as dimensions: `Emscripten_HandleResize:907` unconditionally reassigns backing dimensions even when equal. If that clears a visible WebGL frame without a redraw, retain the failure and diagnose that behavior separately; do not call a stable dimension reading a pass while the screen is blank.
- Preserve all original gameplay/RNG/save behavior and bytes. No engine rebuild is required for the proposed shell/CSS change. Browser startup/full-game/save/mobile completion gates remain pending until their own actual evidence passes.
