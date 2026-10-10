/* SPDX-License-Identifier: GPL-3.0-or-later
 * Observation-only native map geometry capture; original preparation runs once.
 * This incomplete packet is not a full renderer, resource snapshot or savefile.
 */
#include "lua.h"
#include "display.h"
#include "types.h"
#include "auxiliar.h"
#include "lauxlib.h"
#include "tome_prepared_map_capture.h"
#include "checkpoint_gate.h"
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <limits.h>

#define PACKET_HEADER 64u
#define QUAD_CAPACITY 5000u /* unchanged src/map.c705 QUADS_PER_BATCH */
#define MAX_PACKET (64u*1024u*1024u)
typedef char captured_glfloat_must_be_32_bits[(sizeof(GLfloat)==4)?1:-1];
typedef struct {int layer,x,y;} quad_metadata;
typedef struct {
    lua_State *owner;
    const map_type *map;
    unsigned char *bytes;
    size_t length,capacity,limit;
    uint64_t epoch;
    unsigned flags,events,batches,entered,returned,depth;
    int state,layer,keyframes,w,h,z;
    quad_metadata quads[QUAD_CAPACITY];
    unsigned quad_count;
} capture_state;
static capture_state capture;

static void put32(unsigned char *p,uint32_t n) {
    for (unsigned i=0;i<4;i++) p[i]=(unsigned char)(n>>(8u*i));
}
static void put64(unsigned char *p,uint64_t n) {
    for (unsigned i=0;i<8;i++) p[i]=(unsigned char)(n>>(8u*i));
}
static void putfloat(unsigned char *p,float value) {
    uint32_t bits;
    memcpy(&bits,&value,4);
    put32(p,bits);
}
static int active(const map_type *map) {
    return capture.state==1 && capture.map==map && capture.depth==1 &&
        capture.returned==0 && !(capture.flags&TOME_MAP_LIFECYCLE_ERROR);
}
static unsigned char *reserve(size_t amount) {
    if (capture.flags&TOME_MAP_OVERFLOW) return NULL;
    if (amount>capture.limit || capture.length>capture.limit-amount) {
        capture.flags|=TOME_MAP_OVERFLOW; return NULL;
    }
    size_t need=capture.length+amount;
    if (need>capture.capacity) {
        size_t next=capture.capacity;
        while (next<need) next=next>capture.limit/2?capture.limit:next*2;
        unsigned char *grown=realloc(capture.bytes,next);
        if (!grown) {capture.flags|=TOME_MAP_OVERFLOW; return NULL;}
        capture.bytes=grown; capture.capacity=next;
    }
    unsigned char *p=capture.bytes+capture.length;
    capture.length=need;
    return p;
}
static unsigned char *record(unsigned kind,size_t payload) {
    if (payload>UINT32_MAX-16u) {capture.flags|=TOME_MAP_OVERFLOW; return NULL;}
    unsigned char *p=reserve(16u+payload);
    if (!p) return NULL;
    put32(p,kind); put32(p+4,(uint32_t)(16u+payload));
    put32(p+8,++capture.events); put32(p+12,(uint32_t)capture.layer);
    return p+16;
}
void tome_prepared_map_enter(lua_State *state,map_type *map,int keyframes) {
    if (capture.state!=1) return;
    if (state!=capture.owner || map!=capture.map || capture.depth || capture.entered) {
        capture.flags|=TOME_MAP_LIFECYCLE_ERROR;
        capture.depth++; return;
    }
    capture.depth=1; capture.entered=1; capture.keyframes=keyframes;
    capture.w=map->w; capture.h=map->h; capture.z=map->zdepth;
}
void tome_prepared_map_layer(const map_type *map,int layer) {
    if (active(map)) capture.layer=layer;
}
void tome_prepared_map_quad(const map_type *map,int vertex_float_offset,int x,int y) {
    if (!active(map)) return;
    if (vertex_float_offset<0 || vertex_float_offset%12 || (unsigned)vertex_float_offset/12>=QUAD_CAPACITY) {
        capture.flags|=TOME_MAP_ARRAY_STATE_MISMATCH; return;
    }
    unsigned index=(unsigned)vertex_float_offset/12;
    capture.quads[index]=(quad_metadata){capture.layer,x,y};
    capture.quad_count=index+1;
}
void tome_prepared_map_batch(const map_type *map,int count,const GLfloat *vertices,const GLfloat *uv,const GLfloat *colors) {
    if (!active(map) || count==0) return;
    /* Original scratch arrays are consumed BEFORE original glDrawArrays/reset.
     * Reject cached foreign client arrays rather than dereference unknown data. */
    if (count<0 || count%6 || (unsigned)count>QUAD_CAPACITY*6u ||
        gl_c_vertices_ptr!=vertices || gl_c_texcoords_ptr!=uv || gl_c_colors_ptr!=colors ||
        gl_c_vertices_nb!=2 || gl_c_texcoords_nb!=2 || gl_c_colors_nb!=4 ||
        capture.quad_count!=(unsigned)count/6u) {
        capture.flags|=TOME_MAP_ARRAY_STATE_MISMATCH; capture.quad_count=0; return;
    }
    for (int i=0;i<count*2;i++) if (!isfinite(vertices[i]) || !isfinite(uv[i])) {
        capture.flags|=TOME_MAP_NONFINITE; capture.quad_count=0; return;
    }
    for (int i=0;i<count*4;i++) if (!isfinite(colors[i])) {
        capture.flags|=TOME_MAP_NONFINITE; capture.quad_count=0; return;
    }
    GLfloat modelview[16],projection[16];
    for (unsigned i=0;i<16;i++) modelview[i]=projection[i]=NAN;
    GLint viewport[4]={0},scissor[4]={0},bindings[6]={0};
    glGetFloatv(GL_MODELVIEW_MATRIX,modelview);
    glGetFloatv(GL_PROJECTION_MATRIX,projection);
    glGetIntegerv(GL_VIEWPORT,viewport); glGetIntegerv(GL_SCISSOR_BOX,scissor);
    glGetIntegerv(GL_ACTIVE_TEXTURE,&bindings[0]);
    glGetIntegerv(GL_TEXTURE_BINDING_2D,&bindings[1]);
    glGetIntegerv(GL_BLEND_SRC_RGB,&bindings[2]); glGetIntegerv(GL_BLEND_DST_RGB,&bindings[3]);
    glGetIntegerv(GL_BLEND_SRC_ALPHA,&bindings[4]); glGetIntegerv(GL_BLEND_DST_ALPHA,&bindings[5]);
    for (unsigned i=0;i<16;i++) if (!isfinite(modelview[i]) || !isfinite(projection[i])) {
        capture.flags|=TOME_MAP_NONFINITE; capture.quad_count=0; return;
    }
    if (gl_c_shader) capture.flags|=TOME_MAP_UNIFORMS_MISSING;
    unsigned quads=(unsigned)count/6u;
    unsigned char *p=record(TOME_MAP_BATCH,216u+(size_t)count*32u+(size_t)quads*12u);
    if (!p) {capture.quad_count=0; return;}
    put32(p,GL_TRIANGLES); put32(p+4,(uint32_t)count);
    put32(p+8,(uint32_t)bindings[1]); put32(p+12,gl_c_shader);
    put32(p+16,gl_c_fbo); put32(p+20,(uint32_t)bindings[0]);
    put32(p+24,quads); put32(p+28,capture.flags);
    for (unsigned i=0;i<4;i++) {put32(p+32+4*i,(uint32_t)viewport[i]); put32(p+48+4*i,(uint32_t)scissor[i]);}
    put32(p+64,glIsEnabled(GL_BLEND)?1u:0u); put32(p+68,glIsEnabled(GL_SCISSOR_TEST)?1u:0u);
    for (unsigned i=0;i<4;i++) put32(p+72+4*i,(uint32_t)bindings[i+2]);
    for (unsigned i=0;i<16;i++) {putfloat(p+88+4*i,modelview[i]); putfloat(p+152+4*i,projection[i]);}
    p+=216;
    for (int i=0;i<count*2;i++,p+=4) putfloat(p,vertices[i]);
    for (int i=0;i<count*2;i++,p+=4) putfloat(p,uv[i]);
    for (int i=0;i<count*4;i++,p+=4) putfloat(p,colors[i]);
    for (unsigned i=0;i<quads;i++,p+=12) {
        put32(p,(uint32_t)capture.quads[i].layer); put32(p+4,(uint32_t)capture.quads[i].x); put32(p+8,(uint32_t)capture.quads[i].y);
    }
    capture.batches++; capture.quad_count=0;
}
void tome_prepared_map_event(const map_type *map,unsigned kind) {
    if (!active(map)) return;
    if (kind>=TOME_MAP_OBJECT_CALLBACK_BEGIN && kind<=TOME_MAP_Z_CALLBACK_END)
        capture.flags|=TOME_MAP_FOREIGN_GL_MISSING;
    if (kind==TOME_MAP_NATIVE_FOV_BEGIN) capture.flags|=TOME_MAP_NATIVE_FOV_SLOT_OBSERVED;
    (void)record(kind,0);
}
void tome_prepared_map_error(const map_type *map) {
    if (active(map)) capture.flags|=TOME_MAP_CALLBACK_ERROR;
}
void tome_prepared_map_closed(const map_type *map) {
    if (capture.state==1 && capture.map==map) capture.flags|=TOME_MAP_LIFECYCLE_ERROR;
}
void tome_prepared_map_leave(const map_type *map) {
    if (capture.state!=1) return;
    if (capture.depth!=1 || map!=capture.map) {
        capture.flags|=TOME_MAP_LIFECYCLE_ERROR;
        if (capture.depth) capture.depth--; return;
    }
    if (!(capture.flags&TOME_MAP_LIFECYCLE_ERROR)) {
        /* Actual mutable visibility texture CPU cache AFTER original native FOV.
         * Do not calculate visibility or regenerate the texture for this copy. */
        if (map->seens_map && map->seens_map_w>0 && map->seens_map_h>0 &&
            (size_t)map->seens_map_w<=MAX_PACKET/4u/(size_t)map->seens_map_h) {
            size_t bytes=(size_t)map->seens_map_w*(size_t)map->seens_map_h*4u;
            unsigned char *p=record(TOME_MAP_SEEN_BYTES,16u+bytes);
            if (p) {
                put32(p,map->seens_texture); put32(p+4,(uint32_t)map->seens_map_w);
                put32(p+8,(uint32_t)map->seens_map_h); put32(p+12,GL_BGRA);
                memcpy(p+16,map->seens_map,bytes);
            }
        } else capture.flags|=TOME_MAP_RESOURCE_LEASES_MISSING;
    }
    capture.returned++; capture.depth=0;
}
static uint64_t epoch_arg(lua_State *L,int index) {
    lua_Number value=luaL_checknumber(L,index);
    luaL_argcheck(L,value>=1 && value<=9007199254740991.0 && floor(value)==value,index,"Exact positive epoch is required");
    return (uint64_t)value;
}
static int valid_owner(lua_State *L,const map_type *map,uint64_t epoch) {
    return capture.owner==L && capture.map==map && capture.epoch==epoch;
}
int tome_prepared_map_begin_lua(lua_State *L) {
    map_type *map=auxiliar_checkclass(L,"core{map}",1);
    uint64_t epoch=epoch_arg(L,2);
    lua_Integer limit=luaL_optinteger(L,3,16u*1024u*1024u);
    luaL_argcheck(L,limit>=4096 && limit<=MAX_PACKET,3,"Packet budget must be4096..67108864bytes");
    luaL_argcheck(L,!tome_web_checkpoint_busy(),1,"Original save/resume checkpoint exclusion is held");
    luaL_argcheck(L,capture.state!=1,1,"Original map preparation is already active");
    unsigned char *next=malloc(4096);
    if (!next) return luaL_error(L,"Prepared map packet allocation failed");
    free(capture.bytes); memset(&capture,0,sizeof(capture));
    capture.owner=L; capture.map=map; capture.epoch=epoch; capture.bytes=next;
    capture.capacity=4096; capture.limit=(size_t)limit; capture.length=PACKET_HEADER;
    capture.state=1; capture.layer=-1;
    capture.flags=TOME_MAP_RESOURCE_LEASES_MISSING|TOME_MAP_GL_STATE_PARTIAL;
    lua_pushboolean(L,1); return 1;
}
int tome_prepared_map_seal_lua(lua_State *L) {
    map_type *map=auxiliar_checkclass(L,"core{map}",1);
    uint64_t epoch=epoch_arg(L,2);
    luaL_argcheck(L,valid_owner(L,map,epoch) && capture.state==1,1,"Original map capture owner/epoch changed");
    luaL_argcheck(L,capture.entered==1 && capture.returned==1 && !capture.depth,1,"Exactly one original native map preparation must return");
    memcpy(capture.bytes,"TMP1",4); put32(capture.bytes+4,1);
    put32(capture.bytes+8,PACKET_HEADER); put32(capture.bytes+12,capture.flags);
    put64(capture.bytes+16,capture.epoch); put32(capture.bytes+24,(uint32_t)capture.length);
    put32(capture.bytes+28,capture.events); put32(capture.bytes+32,capture.batches);
    put32(capture.bytes+36,(uint32_t)capture.w); put32(capture.bytes+40,(uint32_t)capture.h);
    put32(capture.bytes+44,(uint32_t)capture.z); put32(capture.bytes+48,(uint32_t)capture.keyframes);
    put32(capture.bytes+52,capture.entered); put32(capture.bytes+56,capture.returned); put32(capture.bytes+60,0);
    capture.state=2;
    return tome_prepared_map_status_lua(L);
}
int tome_prepared_map_status_lua(lua_State *L) {
    map_type *map=auxiliar_checkclass(L,"core{map}",1);
    luaL_argcheck(L,capture.owner==L && capture.map==map,1,"Original map packet owner changed");
    lua_newtable(L);
#define STATUS_INT(name,value) do {lua_pushnumber(L,(lua_Number)(value));lua_setfield(L,-2,name);} while(0)
    STATUS_INT("protocol",1); STATUS_INT("epoch",capture.epoch); STATUS_INT("flags",capture.flags);
    STATUS_INT("bytes",capture.length); STATUS_INT("events",capture.events); STATUS_INT("batches",capture.batches);
    STATUS_INT("entered",capture.entered); STATUS_INT("returned",capture.returned);
    STATUS_INT("depth",capture.depth);
    STATUS_INT("keyframes",capture.keyframes);
    lua_pushstring(L,capture.state==2?"sealed":"preparing"); lua_setfield(L,-2,"phase");
    lua_pushboolean(L,0); lua_setfield(L,-2,"full_renderer_ready");
#undef STATUS_INT
    return 1;
}
int tome_prepared_map_abort_lua(lua_State *L) {
    map_type *map=auxiliar_checkclass(L,"core{map}",1);
    luaL_argcheck(L,capture.owner==L && capture.map==map && !capture.depth,1,"Cannot abort an in-flight original map preparation");
    free(capture.bytes); memset(&capture,0,sizeof(capture)); lua_pushboolean(L,1); return 1;
}
const unsigned char *tome_prepared_map_packet(lua_State *L,size_t *length) {
    if (!length || capture.owner!=L || capture.state!=2) return NULL;
    *length=capture.length; return capture.bytes;
}
int tome_prepared_map_bytes_lua(lua_State *L) {
    map_type *map=auxiliar_checkclass(L,"core{map}",1);
    luaL_argcheck(L,capture.owner==L && capture.map==map && capture.state==2,1,"Original map packet is not sealed");
    lua_pushlstring(L,(const char *)capture.bytes,capture.length); return 1;
}
