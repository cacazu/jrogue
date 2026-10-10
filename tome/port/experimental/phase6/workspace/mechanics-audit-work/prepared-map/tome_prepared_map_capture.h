/* SPDX-License-Identifier: GPL-3.0-or-later */
#ifndef TOME_PREPARED_MAP_CAPTURE_H
#define TOME_PREPARED_MAP_CAPTURE_H
#include <stddef.h>
#include <stdint.h>
#include "lua.h"
#include "map.h"
enum tome_map_capture_event {
    TOME_MAP_BATCH=1, TOME_MAP_OBJECT_CALLBACK_BEGIN=2,
    TOME_MAP_OBJECT_CALLBACK_END=3, TOME_MAP_Z_CALLBACK_BEGIN=4,
    TOME_MAP_Z_CALLBACK_END=5, TOME_MAP_NATIVE_FOV_BEGIN=6,
    TOME_MAP_NATIVE_FOV_END=7, TOME_MAP_SEEN_BYTES=8
};
enum tome_map_capture_gap {
    TOME_MAP_RESOURCE_LEASES_MISSING=1u, TOME_MAP_FOREIGN_GL_MISSING=2u,
    TOME_MAP_UNIFORMS_MISSING=4u, TOME_MAP_GL_STATE_PARTIAL=8u,
    TOME_MAP_ARRAY_STATE_MISMATCH=16u, TOME_MAP_CALLBACK_ERROR=32u,
    TOME_MAP_OVERFLOW=64u, TOME_MAP_LIFECYCLE_ERROR=128u,
    TOME_MAP_NONFINITE=256u, TOME_MAP_NATIVE_FOV_SLOT_OBSERVED=512u
};
void tome_prepared_map_enter(lua_State *,map_type *,int);
void tome_prepared_map_layer(const map_type *,int);
void tome_prepared_map_quad(const map_type *,int,int,int);
void tome_prepared_map_batch(const map_type *,int,const GLfloat *,const GLfloat *,const GLfloat *);
void tome_prepared_map_event(const map_type *,unsigned);
void tome_prepared_map_error(const map_type *);
void tome_prepared_map_leave(const map_type *);
void tome_prepared_map_closed(const map_type *);
int tome_prepared_map_begin_lua(lua_State *);
int tome_prepared_map_seal_lua(lua_State *);
int tome_prepared_map_status_lua(lua_State *);
int tome_prepared_map_abort_lua(lua_State *);
int tome_prepared_map_bytes_lua(lua_State *);
/* Pure borrowed packet read. Copy immediately; next successful begin/abort
 * invalidates it. Does not invoke Lua/native draw/FOV/RNG or touch map state. */
const unsigned char *tome_prepared_map_packet(lua_State *,size_t *);
#endif
