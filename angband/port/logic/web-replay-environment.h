#ifndef AB_WEB_REPLAY_ENVIRONMENT_H
#define AB_WEB_REPLAY_ENVIRONMENT_H
#ifdef __EMSCRIPTEN__
#include <stdint.h>
#include <time.h>
#include <stdbool.h>

#define AB_REPLAY_EVENT_WORDS 16U
#define AB_REPLAY_WAIT_WORDS 54U
/* All Rust spans copied synchronously. No pointer survives an Asyncify yield.
 * Event: kind,code,mods,x,y,button,w,h,origin,groupLo,groupHi,index,count,0,0,0.
 * kind: 0 none,1 keyboard,2 mouse,3 logical resize,4 native button.
 * Wait: 1,wait,scan,command,savedDepth,w,h,offsetX,offsetY,queueLength,
 *       generated,turn,depth,hp,x,y,RNG[38]. */
uint32_t ab_rs_replay_enabled(void);
uint32_t ab_rs_replay_bootstrap_rng(const uint32_t *,uint32_t);
/* wait mode: 0 live,1 recorded,2 target (now live),3 mismatch. */
uint32_t ab_rs_replay_wait(const uint32_t *,uint32_t);
uint32_t ab_rs_replay_next(uint32_t *,uint32_t);
uint32_t ab_rs_replay_validate_event(const uint32_t *,uint32_t);
uint32_t ab_rs_replay_commit(const uint32_t *,uint32_t,int32_t);
uint32_t ab_rs_replay_flush(void);
const uint8_t *ab_rs_replay_save(void); /* shared ab_rs_save_len/status */
uint32_t ab_rs_resize(uint32_t,uint32_t);
/* Host returns 1 typed event,0 empty; fills all16 words synchronously. */
uint32_t ab_host_event(uint32_t *,uint32_t);
uint32_t ab_host_sync_pending(void);
void ab_host_replay_target(void);

/* Environment begin:0 live/legacy,1 replay facts,2 mismatch. Result bytes stay
 * valid until the next environment begin/commit. Live cap failures poison
 * saving but must not stop ordinary engine execution.
 * kind1 time=8 LE signed seconds;2 localtime=9 LE signed int fields;
 * 3 ctime=NUL-terminated original bytes<=128;4 PID=4 LE signed int;
 * 5 file_exists=pathNUL,bool;6 file_newer=firstNUL,secondNUL,bool. */
uint32_t ab_rs_replay_environment_begin(const char *,uint32_t);
const uint8_t *ab_rs_replay_environment_data(void);
uint32_t ab_rs_replay_environment_len(void);
uint32_t ab_rs_replay_environment_commit(const char *,uint32_t,const uint8_t *,uint32_t);
time_t ab_web_replay_time(const char *,time_t *);
struct tm *ab_web_replay_localtime(const char *,const time_t *);
char *ab_web_replay_ctime(const char *,const time_t *);
int ab_web_replay_pid(const char *);
bool ab_web_replay_fs_begin(const char *,uint32_t,const char *,const char *,bool *);
bool ab_web_replay_fs_result(const char *,uint32_t,const char *,const char *,bool);
#endif
#endif
