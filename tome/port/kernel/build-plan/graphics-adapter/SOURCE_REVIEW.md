# Retained graphics startup source review

This review performs no compile, link, test, browser, server, packaging, or Git action. The parent owns those measured jobs. The parent-owned `native-core-work/browser-build/link-result.json` now records exit 0 for the corrected browser link; `tome_graphics_adapter.log` is empty. Real initialization/rendering remains a separate browser result.

## GLEW initializer

Original `src/glew.c:8881–8884` declares `glewContextInit` static when `GLEW_MX` is unset. Calling it from another translation unit caused the measured undefined-symbol error. The adapter now calls `__real_glewInit` through a linker wrapper. Original GL version/extension detection and procedure loading run unchanged; the original GLX phase then reports its unsupported-platform status because the browser has no GLX entrypoints. The bootstrap accepts only `GLEW_ERROR_GLX_VERSION_11_ONLY` as this known platform absence and rejects every other GLEW error. No invented capability flags or unresolved-symbol suppression are involved.

Installed SDK `libglemu.js:428–438` adds its implemented legacy extension names to the actual WebGL extension list, including multitexture, shader objects, and framebuffer objects. These are the SDK's compatibility implementation, not flags manufactured by this adapter. Installed settings default `GL_ENABLE_GET_PROC_ADDRESS=true` and `GL_TRACK_ERRORS=true`; the SDL/EGL provider delegates procedure lookup to the existing Emscripten implementation. Original `main.c:1562–1570` separately applies its safe-mode policy to advanced rendering features.

## Real texture bytes

Installed SDK `libwebgl.js:1675–1715` forwards internal format and upload format to WebGL. It does not normalize desktop component counts 3/4 or BGR/BGRA byte data, and its pixel-view helper runs before a context-method hook can intervene. Original surface and map/noise allocations use precisely those cases. The two C-call wrappers therefore normalize before the helper, with real channel conversion, source unpack layout, and restoration. Required linker options are:

```
-Wl,--wrap=glewInit
-Wl,--wrap=glTexImage2D
-Wl,--wrap=glTexSubImage2D
-sLEGACY_GL_EMULATION=1
```

The wrapper scope leaves SDK-internal imports and procedure-table functions intact. Current `test-graphics-logic.mjs` and `make-browser-test.mjs` have upload-specific cases prepared for the parent. The old local object/HTML/reports must not be treated as proof of the new source revision until regenerated or superseded by parent-owned evidence.

## SDL window surface

Cached official SDL2 is `SDL-release-2.32.10`. `src/video/SDL_video.c:2704` explicitly defaults `ShouldAttemptTextureFramebuffer` to false on Emscripten. `SDL_GetWindowSurface` uses `Emscripten_CreateWindowFramebuffer`; `SDL_emscriptenframebuffer.c:33–59` allocates a real `SDL_PIXELFORMAT_BGR888` RGB surface with the actual window pixel size and returns its pixels/pitch. This creation path does not request a 2D browser canvas, so a valid non-null surface is expected under the default policy.

Check the actual returned pointer and propagate allocation failure. Original `core_lua.c:677–682`, `wait.c:49–54,122–123`, and `display_sdl.c:42` dereference its dimensions/format. If a different hint/driver makes the window surface unavailable, an original-compatible explicit backing surface is `SDL_CreateRGBSurfaceWithFormat(0,w,h,32,SDL_PIXELFORMAT_BGR888)` using `SDL_GetWindowSizeInPixels` dimensions. It must be owned/freed by the adapter and resized alongside the GL window.

`Emscripten_UpdateWindowFramebuffer` is different: `SDL_emscriptenframebuffer.c:82–85` requests `Browser.createContext(canvas,false,true)`, i.e. a 2D canvas. Keep the original GL presentation on `SDL_GL_SwapWindow`; avoid mixing software-window updates into the same WebGL canvas. An explicit framebuffer-acceleration hint of `0` can keep the documented software metadata path deterministic if external hints would otherwise override it.

## Sphere capacity

The original sphere uses 64 slices/stacks and smooth textured normals. Its 8,064 triangles contain 24,192 vertices. The SDK records four position, three normal, and four texture-coordinate floats per such vertex, about 1,064,448 bytes, within the installed default `GL_MAX_TEMP_BUFFER_SIZE=2,097,152`. This is source-derived capacity evidence; it does not replace a real sphere draw test. No sphere compile/runtime failure is asserted.

## Measured luminance fixture failure

The parent's real Chrome 154 WebGL probe failed at the non-renderable luminance case after the preceding actual RGBA/RGB/BGRA readbacks, packing checks, upload conversions, state restoration, and forced RGBA shader fallback had reached their assertions successfully. The luminance fixture supplied four bytes for two rows of two one-byte texels while `UNPACK_ALIGNMENT` was 4. That layout requires a four-byte row stride and six source bytes, so the attempted upload is invalid; the recorded dimensions are not proof that WebGL accepted it. Sampling an incomplete texture yields black.

`make-browser-test.mjs` now supplies `[32,64,0,0,128,255]` for the padded rows and checks the real WebGL error immediately after allocation. The production blit is unchanged because the measured failure does not establish a defect in its draw or state restoration. The parent must regenerate the HTML and repeat the actual browser probe; this source review runs no test.
