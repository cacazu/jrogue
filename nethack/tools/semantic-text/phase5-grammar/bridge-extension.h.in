/* Added 2026-10-02: copied public article/case observations; NGPL. */
#ifndef JROGUE_NH_SEMANTIC_NAME_GRAMMAR_H
#define JROGUE_NH_SEMANTIC_NAME_GRAMMAR_H
#include "nh-semantic-name.h"
#include <stdint.h>

/* BUFSZ is the original public-name bound from hack.h. The snapshot owns
 * its bytes and event: it borrows no registry storage across nextobuf(). */
#define NH_NAME_GRAMMAR_JSON 4096
struct nh_name_grammar_snapshot {
    const char *source_pointer;
    uint64_t source_generation;
    size_t original_length;
    int valid;
    char original[BUFSZ];
    char event[NH_NAME_GRAMMAR_JSON];
};
enum nh_name_grammar_case {
    NH_NAME_GRAMMAR_LOWER,
    NH_NAME_GRAMMAR_UPPER
};
void nh_text_name_grammar_capture(struct nh_name_grammar_snapshot *, const char *);
void nh_text_name_grammar_append(struct nh_name_grammar_snapshot *, const char *,
                                  const char *, size_t, const char *);
void nh_text_name_grammar_case(struct nh_name_grammar_snapshot *, const char *,
                                enum nh_name_grammar_case, const char *);
#endif
