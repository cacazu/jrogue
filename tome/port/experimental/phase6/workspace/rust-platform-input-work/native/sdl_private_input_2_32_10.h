/* SPDX-License-Identifier: GPL-3.0-or-later
 * ABI declarations for the pinned official SDL 2.32.10 event backend. No SDL
 * implementation is copied here. See source-provenance.json / README.md. These
 * private symbols are a version-specific build dependency, not a stable API. */
#ifndef TOME_SDL_PRIVATE_INPUT_H
#define TOME_SDL_PRIVATE_INPUT_H
#include <SDL.h>
#if SDL_MAJOR_VERSION != 2 || SDL_MINOR_VERSION != 32 || SDL_PATCHLEVEL != 10
#error "This source-only input candidate is pinned to official SDL 2.32.10"
#endif
extern int SDL_SendKeyboardKeyAndKeycode(Uint8, SDL_Scancode, SDL_Keycode);
extern int SDL_SendKeyboardText(const char *);
extern int SDL_SendMouseMotion(SDL_Window *, Uint32, int, int, int);
extern int SDL_SendMouseButton(SDL_Window *, Uint32, Uint8, Uint8);
extern int SDL_SendMouseWheel(SDL_Window *, Uint32, float, float, SDL_MouseWheelDirection);
extern void SDL_SetKeyboardFocus(SDL_Window *);
extern void SDL_SetMouseFocus(SDL_Window *);
#endif
