/* Fixed signatures avoid the measured FPC wasm32 C-varargs compiler defect. */
#include <stdint.h>
#include <stdarg.h>
#include <string.h>
#include <stdlib.h>
#include <stdio.h>
#include <errno.h>
#include <stddef.h>
#include "lua.h"
#include "lauxlib.h"
#include "ldo.h"
extern unsigned char __heap_base;
extern unsigned char __stack_low;
extern unsigned char __stack_high;
void *drl_wasi_heap_base(void) {return &__heap_base;}
void *drl_wasi_stack_low(void) {return &__stack_low;}
void *drl_wasi_stack_high(void) {return &__stack_high;}
/* Enable with wasm-ld --wrap=FPC_WASM_SETINITIALHEAPBLOCKSTART. */
extern void __real_FPC_WASM_SETINITIALHEAPBLOCKSTART(void *);
void __wrap_FPC_WASM_SETINITIALHEAPBLOCKSTART(void *reported_stack_pointer) {
  (void)reported_stack_pointer;
  __real_FPC_WASM_SETINITIALHEAPBLOCKSTART(&__heap_base);
}
void drl_set_alloc_errno(void) {errno=ENOMEM;}
const char *drl_lua_pushfstring_is(lua_State *L,const char *format,int32_t i,const char *s) {
  return lua_pushfstring(L,format,i,s);
}
int drl_lua_error_is(lua_State *L,const char *format,int32_t i,const char *s) {
  return luaL_error(L,format,i,s);
}
/* Target-specific packed varargs supports an adapted Pascal formatter once tested. */
_Static_assert(sizeof(va_list)==sizeof(void*),"WASM varargs pointer ABI");
const char *drl_lua_pushvfstring_packed(lua_State *L,const char *format,void *area) {
  va_list ap;memcpy(&ap,&area,sizeof(ap));return lua_pushvfstring(L,format,ap);
}
int drl_lua_error_packed(lua_State *L,const char *format,void *area) {
  luaL_where(L,1);drl_lua_pushvfstring_packed(L,format,area);lua_concat(L,2);return lua_error(L);
}
/* Lua longjmp bypasses Pascal managed-local cleanup. Catch only while formatting,
   return to Pascal to release its new temporaries, then rethrow the same status.
   rawrunprotected adds no Lua call frame, preserving luaL_where's source level. */
struct drl_format_request {
  const char *format;void *area;int with_prefix;const char *result;
};
static void drl_format_protected_body(lua_State *L,void *data) {
  struct drl_format_request *request=data;
  if(request->with_prefix)luaL_where(L,1);
  request->result=drl_lua_pushvfstring_packed(L,request->format,request->area);
  if(request->with_prefix){lua_concat(L,2);request->result=lua_tostring(L,-1);}
}
const char *drl_lua_format_protected(lua_State *L,const char *format,void *area,
                                    int32_t with_prefix,int32_t *status) {
  struct drl_format_request request={format,area,with_prefix,NULL};
  *status=luaD_rawrunprotected(L,drl_format_protected_body,&request);
  return *status?NULL:request.result;
}
void drl_lua_raise_status(lua_State *L,int32_t status) {luaD_throw(L,status);}
int drl_lua_platform_error(lua_State *L,const char *id,const char *english) {
  lua_getfield(L,LUA_GLOBALSINDEX,"ui");
  if(!lua_istable(L,-1)){
    /* Standalone interpreter probe has no DRL UI registration. */
    lua_pop(L,1);return luaL_error(L,"%s",english);
  }
  lua_getfield(L,-1,"semantic_text");luaL_checktype(L,-1,LUA_TFUNCTION);
  luaL_where(L,1);lua_insert(L,-2);
  lua_pushstring(L,id);lua_pushstring(L,english);lua_newtable(L);
  lua_call(L,3,1);luaL_checktype(L,-1,LUA_TSTRING);
  lua_concat(L,2);
  return lua_error(L);
}
__attribute__((import_module("drl_host"),import_name("sleep")))
void drl_probe_host_sleep(uint32_t milliseconds);
void drl_probe_suspend(uint32_t milliseconds) {drl_probe_host_sleep(milliseconds);}
int drl_allocator_probe(void) {
  for(unsigned start=8;start<4096;start+=17){
    unsigned char *p=malloc(start);if(!p)return 1;
    if((uintptr_t)p%_Alignof(max_align_t))return 6;
    for(unsigned i=0;i<start;i++)p[i]=(unsigned char)(i*7+3);
    unsigned char *q=realloc(p,start*2);if(!q)return 2;
    for(unsigned i=0;i<start;i++)if(q[i]!=(unsigned char)(i*7+3))return 3;
    unsigned char *r=realloc(q,start/2);if(!r)return 4;
    for(unsigned i=0;i<start/2;i++)if(r[i]!=(unsigned char)(i*7+3))return 5;
    free(r);
  }
  return 0;
}
int drl_interleaved_probe(unsigned char *pascal_block,unsigned count,void (*pascal_scratch)(int)) {
  for(unsigned round=0;round<64;round++) {
    unsigned size=513+round*19;
    unsigned char *a=malloc(size),*b=calloc(size,1);
    if(!a||!b)return 1;
    for(unsigned i=0;i<size;i++){a[i]=(unsigned char)(i+round);if(b[i])return 2;}
    pascal_scratch((int)round);
    for(unsigned i=0;i<size;i++)if(a[i]!=(unsigned char)(i+round))return 3;
    for(unsigned i=0;i<count;i++)if(pascal_block[i]!=(unsigned char)(i*3+5))return 4;
    free(a);free(b);
  }
  return 0;
}
int drl_fileio_probe(void) {
  FILE *f=fopen("/probe/allocator-io.bin","w+");if(!f)return 1;
  unsigned char *a=malloc(32768),*b=calloc(32768,1);if(!a||!b)return 2;
  for(unsigned i=0;i<32768;i++)a[i]=(unsigned char)(i*11+7);
  if(fwrite(a,1,32768,f)!=32768)return 3;
  if(fflush(f)||fseek(f,0,SEEK_SET))return 4;
  if(fread(b,1,32768,f)!=32768)return 5;
  if(memcmp(a,b,32768))return 6;
  free(a);free(b);if(fclose(f))return 7;return 0;
}
int drl_allocator_failure_probe(void) {
  /* Prevent LLVM's builtin malloc/free folding from replacing this failure
     fixture with a constant. These calls must reach the linked Pascal owner. */
  void *(*volatile allocate)(size_t)=malloc;
  void *(*volatile resize)(void *,size_t)=realloc;
  unsigned char *p=allocate(64);if(!p)return 1;
  memset(p,0x5a,64);
  void *unexpected=allocate(128u*1024u*1024u);if(unexpected){free(unexpected);return 2;}
  void *replacement=resize(p,128u*1024u*1024u);if(replacement){free(replacement);return 3;}
  for(unsigned i=0;i<64;i++)if(p[i]!=0x5a)return 4;
  free(p);return 0;
}
