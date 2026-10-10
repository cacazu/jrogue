/* Added 2026-10-02: source-selected quest observations; NGPL. */
#ifndef JROGUE_NH_QUEST_SEMANTIC_H
#define JROGUE_NH_QUEST_SEMANTIC_H
#include "nh-semantic.h"
struct nh_quest_group;
struct nh_quest_group *nh_quest_begin(const char *, const char *, uint32_t,
                                     const char *);
void nh_quest_end(struct nh_quest_group *);
void nh_quest_base(char, const char *);
void nh_quest_modified(char, char, const char *, size_t);
struct nh_text_scope *nh_quest_line(enum nh_text_kind, int, const char *);
void nh_quest_line_done(struct nh_text_scope *);
#endif
