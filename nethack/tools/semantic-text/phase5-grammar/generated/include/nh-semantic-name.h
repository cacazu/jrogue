/* Added 2026-10-02: public name descriptors; distributed under the NGPL. */
#ifndef JROGUE_NH_SEMANTIC_NAME_H
#define JROGUE_NH_SEMANTIC_NAME_H
#include <stddef.h>
struct permonst;
enum nh_name_object_field { NH_NAME_OBJECT_NAME, NH_NAME_OBJECT_APPEARANCE };
void nh_text_name_invalidate(const char *);
void nh_text_name_invalidate_range(const char *, size_t);
void nh_text_name_monster(const char *, const struct permonst *, const char *,
                          const char *, int, int);
void nh_text_name_object(const char *, const char *, int,
                         enum nh_name_object_field, const char *);
void nh_text_name_generic(const char *, const char *);
/* Returned JSON is presentation-owned and must be copied before another bind. */
const char *nh_text_name_event(const char *);
#endif
