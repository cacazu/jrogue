/* Added 2026-10-02: isolated observations of public doname pieces; NGPL. */
#ifndef JROGUE_NH_SEMANTIC_OBJECT_PUBLIC_H
#define JROGUE_NH_SEMANTIC_OBJECT_PUBLIC_H
#include "nh-semantic-name-grammar.h"

#define NH_OBJECT_PUBLIC_PARTS 24
#define NH_OBJECT_PUBLIC_JSON 4096
#define NH_OBJECT_PUBLIC_POOLS 32
enum nh_object_public_zone { NH_OBJECT_PREFIX, NH_OBJECT_SUFFIX };
enum nh_object_public_number {
    NH_OBJECT_QUANTITY, NH_OBJECT_ENCHANTMENT,
    NH_OBJECT_CHARGES, NH_OBJECT_CONTENT_COUNT
};
/* Caller-owned observations do not borrow event or native temporary buffers.
 * The base snapshot is captured immediately after the original xname returns.
 * Source-bound writes supply pieces; no struct obj/game state is consulted. */
struct nh_object_public_snapshot {
    struct nh_name_grammar_snapshot base;
    uint64_t pool_generation;
    int valid, pending, zone, article;
    unsigned count, prefix_count, article_index;
    size_t used, before_length, pending_capacity, prefix_capacity;
    size_t offset[NH_OBJECT_PUBLIC_PARTS], length[NH_OBJECT_PUBLIC_PARTS];
    unsigned char is_prefix[NH_OBJECT_PUBLIC_PARTS];
    char prefix[BUFSZ], suffix[BUFSZ], before[BUFSZ];
    char pieces[NH_OBJECT_PUBLIC_JSON];
    const char *pending_pointer;
    long public_long;
    int public_int[2];
    unsigned captured;
    char public_plural[BUFSZ];
};
void nh_object_public_init(struct nh_object_public_snapshot *, const char *);
/* Called only by the separate registry copy's original range invalidator. */
void nh_object_public_pool_invalidate(const char *, size_t);
void nh_object_public_begin(struct nh_object_public_snapshot *, const char *,
                            enum nh_object_public_zone, size_t);
long nh_object_public_long(struct nh_object_public_snapshot *, long);
int nh_object_public_int(struct nh_object_public_snapshot *, unsigned, int);
const char *nh_object_public_plural(struct nh_object_public_snapshot *,
                                    const char *);
void nh_object_public_literal(struct nh_object_public_snapshot *, const char *,
                              const char *, size_t, int);
void nh_object_public_number(struct nh_object_public_snapshot *, const char *,
                             const char *, enum nh_object_public_number);
void nh_object_public_article_finish(struct nh_object_public_snapshot *,
                                     const char *);
void nh_object_public_bind(struct nh_object_public_snapshot *, const char *);
#endif
