#include "angband.h"
#include "web-replay-environment.h"
#ifdef __EMSCRIPTEN__
#include <string.h>
#include <unistd.h>
extern void ab_host_save_error(const char *);
static void ab_replay_bad(void) {
    ab_host_save_error("save.replay_mismatch");
    quit("Browser replay environment mismatch");
}
static uint32_t ab_begin(const char *site,uint32_t kind) {
    uint32_t mode=ab_rs_replay_environment_begin(site,kind);
    if(mode>1) ab_replay_bad();
    return mode;
}
static const uint8_t *ab_facts(uint32_t expected) {
    const uint8_t *p=ab_rs_replay_environment_data();
    if(!p || ab_rs_replay_environment_len()!=expected) ab_replay_bad();
    return p;
}
static void ab_commit(const char *site,uint32_t kind,const uint8_t *p,uint32_t len,bool replay) {
    uint32_t result=ab_rs_replay_environment_commit(site,kind,p,len);
    if(replay && result) ab_replay_bad();
}
static void ab_put32(uint8_t *p,uint32_t v) { for(unsigned i=0;i<4;i++) p[i]=(uint8_t)(v>>(8*i)); }
static uint32_t ab_get32(const uint8_t *p) { uint32_t v=0;for(unsigned i=0;i<4;i++) v|=(uint32_t)p[i]<<(8*i);return v; }
static void ab_put64(uint8_t *p,uint64_t v) { for(unsigned i=0;i<8;i++) p[i]=(uint8_t)(v>>(8*i)); }
static uint64_t ab_get64(const uint8_t *p) { uint64_t v=0;for(unsigned i=0;i<8;i++) v|=(uint64_t)p[i]<<(8*i);return v; }

time_t ab_web_replay_time(const char *site,time_t *out) {
    uint8_t owned[8]; bool replay=ab_begin(site,1)!=0; time_t result;
    _Static_assert(sizeof(time_t)<=8,"Owned clock integer shape");
    if(replay) { memcpy(owned,ab_facts(8),8); result=(time_t)(int64_t)ab_get64(owned); if(out) *out=result; }
    else { result=time(out); ab_put64(owned,(uint64_t)(int64_t)result); }
    ab_commit(site,1,owned,8,replay); return result;
}
struct tm *ab_web_replay_localtime(const char *site,const time_t *value) {
    static struct tm restored; uint8_t owned[36]; bool replay=ab_begin(site,2)!=0;
    struct tm *result;
    if(replay) {
        int *fields[]={&restored.tm_sec,&restored.tm_min,&restored.tm_hour,&restored.tm_mday,&restored.tm_mon,&restored.tm_year,&restored.tm_wday,&restored.tm_yday,&restored.tm_isdst};
        memcpy(owned,ab_facts(36),36); memset(&restored,0,sizeof(restored));
        for(unsigned i=0;i<9;i++) *fields[i]=(int32_t)ab_get32(owned+4*i);
        result=&restored;
    } else {
        result=localtime(value); if(!result) ab_replay_bad();
        const int fields[]={result->tm_sec,result->tm_min,result->tm_hour,result->tm_mday,result->tm_mon,result->tm_year,result->tm_wday,result->tm_yday,result->tm_isdst};
        for(unsigned i=0;i<9;i++) ab_put32(owned+4*i,(uint32_t)fields[i]);
    }
    ab_commit(site,2,owned,36,replay); return result;
}
char *ab_web_replay_ctime(const char *site,const time_t *value) {
    static char restored[128]; bool replay=ab_begin(site,3)!=0; char *result; uint32_t len;
    if(replay) {
        len=ab_rs_replay_environment_len();const uint8_t *p=ab_rs_replay_environment_data();
        if(!p || !len || len>sizeof(restored) || p[len-1]!=0 || memchr(p,0,len-1)) ab_replay_bad();
        memcpy(restored,p,len); result=restored;
    } else {
        result=ctime(value);if(!result) ab_replay_bad();
        size_t n=strlen(result)+1;if(n>sizeof(restored)) ab_replay_bad();len=(uint32_t)n;
    }
    ab_commit(site,3,(const uint8_t *)result,len,replay);return result;
}
int ab_web_replay_pid(const char *site) {
    uint8_t owned[4];bool replay=ab_begin(site,4)!=0;int result;
    if(replay) { memcpy(owned,ab_facts(4),4);result=(int32_t)ab_get32(owned); }
    else { result=(int)getpid();ab_put32(owned,(uint32_t)result); }
    ab_commit(site,4,owned,4,replay);return result;
}
static uint32_t ab_fs_context(uint8_t out[8192],const char *first,const char *second) {
    size_t a=strlen(first)+1,b=second?strlen(second)+1:0;
    if(a>4096 || b>4096 || a+b>=8192) ab_replay_bad();
    memcpy(out,first,a);if(b) memcpy(out+a,second,b);return (uint32_t)(a+b);
}
bool ab_web_replay_fs_begin(const char *site,uint32_t kind,const char *first,const char *second,bool *result) {
    uint8_t context[8192];uint32_t n=ab_fs_context(context,first,second);
    if(!ab_begin(site,kind)) return false;
    const uint8_t *p=ab_facts(n+1);
    if(memcmp(p,context,n) || p[n]>1) ab_replay_bad();
    context[n]=p[n];*result=p[n]!=0;ab_commit(site,kind,context,n+1,true);return true;
}
bool ab_web_replay_fs_result(const char *site,uint32_t kind,const char *first,const char *second,bool result) {
    uint8_t context[8192];uint32_t n=ab_fs_context(context,first,second);context[n]=(uint8_t)result;
    ab_commit(site,kind,context,n+1,false);return result;
}
#endif
