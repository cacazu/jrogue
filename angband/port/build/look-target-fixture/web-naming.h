#ifndef LOOK_NAMING_MOCK_H
#define LOOK_NAMING_MOCK_H
#include "angband.h"
#define AB_NAMING_SNAPSHOT_MAX_BYTES (128U*1024U)
struct ab_naming_snapshot {char *json;uint32_t length;};
bool ab_naming_copy_object_snapshot(struct ab_naming_snapshot *,const char *);
bool ab_naming_copy_monster_snapshot(struct ab_naming_snapshot *,const char *);
void ab_naming_snapshot_release(struct ab_naming_snapshot *);
#endif
