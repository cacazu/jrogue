/* Added 2026-10-02: isolated Phase7 proposal; NGPL. Not installed. */
#ifndef JROGUE_NH_BUFFER_PRODUCER_H
#define JROGUE_NH_BUFFER_PRODUCER_H
#include "nh-semantic.h"
#include <stddef.h>
#include <stdint.h>

/* Explicit local ownership, not a global pointer/English registry. Copying this
 * struct or escaping its pointers is forbidden. Heap nh_text_begin copies all
 * arguments before an original window call can Asyncify/yield. */
#define NH_BUF_ARGS 4U
#define NH_BUF_BYTES 256U
struct nh_buf_owner {
    char *buffer;
    size_t capacity, length, count;
    uint64_t generation;
    const struct nh_text_descriptor *descriptor;
    int valid, args_valid;
    char original[NH_BUF_BYTES];
    struct nh_text_argument args[NH_BUF_ARGS];
    char text[NH_BUF_ARGS][NH_BUF_BYTES];
};
void nh_buf_invalidate(struct nh_buf_owner *);
uint64_t nh_buf_before_write(struct nh_buf_owner *, char *, size_t,
                             const struct nh_text_descriptor *);
int nh_buf_text_argument(struct nh_buf_owner *, size_t, const char *,
                          const char *);
void nh_buf_scalar_argument(struct nh_buf_owner *, size_t, const char *,
                            enum nh_text_argument_kind, int64_t);
void nh_buf_after_write(struct nh_buf_owner *, uint64_t, size_t);
void nh_buf_putstr(struct nh_buf_owner *, winid, int, const char *);
void nh_buf_add_menu_str(struct nh_buf_owner *, winid, const char *);
void nh_buf_pline1(struct nh_buf_owner *, const char *);
#endif
