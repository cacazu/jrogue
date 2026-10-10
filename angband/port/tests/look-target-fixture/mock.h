#ifndef LOOK_MOCK_H
#define LOOK_MOCK_H
#include <stdbool.h>
#include <stdint.h>
#include <stddef.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdarg.h>
#define N_ELEMENTS(a) (sizeof(a)/sizeof((a)[0]))
#define ABS(a) ((a)<0?-(a):(a))
struct loc {int x,y;};
struct player {struct loc grid;};
struct monster {int hp,maxhp;bool destroyed;int m_timed[8];};
struct feature {char *name;int fidx;struct feature *mimic;};
struct square {int feat;};
struct chunk {struct square known;};
extern struct player *player;
extern struct chunk *cave;
extern struct feature *f_info;
enum {MON_TMD_SLEEP,MON_TMD_HOLD,MON_TMD_DISEN,MON_TMD_CONF,MON_TMD_FEAR,MON_TMD_STUN,MON_TMD_SLOW,MON_TMD_FAST};
#include "feature-enum.h"
struct monster *cave_monster(struct chunk *chunk,int index);
bool monster_is_destroyed(struct monster *monster);
struct square *square(struct chunk *chunk,struct loc location);
size_t my_strcpy(char *buffer,const char *text,size_t size);
size_t my_strcat(char *buffer,const char *text,size_t size);
int strnfmt(char *buffer,size_t size,const char *format,...);
#endif
