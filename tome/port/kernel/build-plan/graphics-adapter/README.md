# Retained ToME GLU sphere adapter

`tome_glu_quadric.c` supplies exactly the five missing GLU functions used by the original ToME 1.7.6 Lua graphics binding: `gluNewQuadric`, `gluDeleteQuadric`, `gluQuadricNormals`, `gluQuadricTexture`, and `gluSphere`. The actual binding is in pristine `src/core_lua.c:2677–2704`; it requests smooth normals, texture coordinates, and a sphere with 64 slices and 64 stacks. There is no `src/display.c` in the acquired release; its display implementation is `display_sdl.c`.

The implementation is independently authored MIT code. It includes the installed SDK's unchanged `GL/glu.h` declarations, whose own SGI notice remains in the SDK header; no SGI or Mesa implementation was copied. Retaining the full ToME kernel still entails its original GPL and media obligations.

The adapter emits real triangles through `glBegin`, `glNormal3f`, `glTexCoord2f`, `glVertex3f`, and `glEnd`. Quadric state is allocated per object. Defaults are smooth outward normals, filled faces, and disabled texture generation. Smooth, flat, and absent normals are supported. Texture coordinates follow the GLU polar convention: Z is the pole axis, the longitudinal seam starts on +Y, and texture t increases south to north. Shared seam positions and exact poles avoid cracks. Winding faces outward; cap degenerates are omitted. These defaults and mappings follow the [GLU 1.3 quadrics specification, chapter 6](https://registry.khronos.org/OpenGL/specs/gl/glu1.3.pdf).

This is the five-function subset required by the retained source. Additional GLU primitives, draw-style/orientation setters, and error callbacks are not implemented. Null objects, negative/nonfinite radii, fewer than three slices, and fewer than two stacks emit no geometry; invalid normal enums preserve existing state. Radius zero emits coincident vertices with valid smooth normals. It changes only current normal/texture attributes as ordinary GLU drawing does; it does not alter transforms, colors, enables, texture binding, simulation, or RNG.

Compile the adapter as C, then add its object to the final game link:

```powershell
& 'C:\Users\kit\emsdk\upstream\emscripten\emcc.exe' `
  -std=c11 -O2 -Wall -Wextra -Werror `
  -c .\tome_glu_quadric.c -o .\tome_glu_quadric.o
```

The game's final `em++` link requires `-sLEGACY_GL_EMULATION=1` and `-lm`, in addition to the existing original-kernel/SDL flags. No include override, extra library, SDK installation, or pristine-source mutation is required. Do not link `test_quadric.c` into the game: its GL functions are a test recorder only.

## Measured verification

Production compilation passed with Emscripten 6.0.8 and `-Wall -Wextra -Werror`; the object is 2,235 bytes. `llvm-nm --defined-only` reports exactly the five requested external symbols. The separate test module is 25,928 bytes, keeping this check small during the parent memory hold.

```powershell
& 'C:\Users\kit\emsdk\upstream\emscripten\emcc.exe' `
  -std=c11 -O1 -Wall -Wextra -Werror `
  .\tome_glu_quadric.c .\test_quadric.c `
  -sENVIRONMENT=node -sEXIT_RUNTIME=1 -sWASM_ASYNC_COMPILATION=0 `
  -lm -o .\test_quadric.js
& 'C:\Program Files\nodejs\node.exe' .\test_quadric.js
```

The recorder test passed, exit 0. It checks all 8,064 nondegenerate outward triangles at the exact original 64×64 subdivision, sphere radius, smooth/flat/absent normals, polar UV mapping and seam equality, object state isolation, deterministic repeatability, invalid inputs, and zero radius. `evidence.json` records hashes, symbols, and the result. This verifies command geometry; the parent owns actual browser rendering with the full retained engine.
