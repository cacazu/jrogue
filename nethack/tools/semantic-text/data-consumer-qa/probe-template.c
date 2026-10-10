/* Added 2026-10-02: isolated source-faithful NetHack data consumer probe.
 * Official function bodies are inserted byte-for-byte by prepare.py and
 * remain subject to the NetHack license included with the pristine source.
 * This process has no live game, browser, save, or presentation callbacks.
 */
#include "config.h"
#include "dlb.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <limits.h>

/* Original declarations/constants copied from include/wintype.h. */
typedef int winid;
#define NHW_TEXT 5

/* Only fields touched by the original consumer functions are represented.
 * These are isolated test fixtures, never linked to any running game. */
static struct { int oracle_flg; } go;
static struct { unsigned oracle_cnt; unsigned long *oracle_loc; } svo;
static struct { long true_rumor_size, true_rumor_end;
                unsigned long true_rumor_start; } gt;
static struct { long false_rumor_size, false_rumor_end;
                unsigned long false_rumor_start; } gf;
static unsigned qa_oracle_index, qa_line_count, qa_cr_count;
static unsigned qa_random_calls, qa_random_range;
static long qa_random_offset;

extern char *eos(char *);
extern char *xcrypt(const char *, char *);
static void qa_hex(const char *s) {
    const unsigned char *p = (const unsigned char *) s;
    for (; *p; ++p) printf("%02x", (unsigned) *p);
}
FILE *fopen_datafile(const char *name, const char *mode, int prefix) {
    (void) prefix;
    return fopen(name, mode);
}
void nhassert_failed(const char *expression, const char *file, int line) {
    fprintf(stderr, "Original consumer assertion: %s at %s:%d\n",
            expression, file, line);
    exit(91);
}
static void couldnt_open_file(const char *name) {
    fprintf(stderr, "Original consumer cannot open %s\n", name);
    exit(92);
}
/* The selection input is fixed so every original indexed record is tested.
 * This stub counts the exact original calls; no gameplay RNG is linked. */
static int rnd(int n) {
    ++qa_random_calls; qa_random_range = (unsigned) n;
    if (qa_oracle_index < 1 || qa_oracle_index > (unsigned) n) exit(93);
    return (int) qa_oracle_index;
}
static int qa_rng(int n) {
    ++qa_random_calls; qa_random_range = (unsigned) n;
    if (qa_random_offset < 0 || qa_random_offset >= n) exit(94);
    return (int) qa_random_offset;
}
static winid create_nhwindow(int type) {
    if (type != NHW_TEXT) exit(95);
    return 1;
}
static void putstr(winid window, int attr, const char *line) {
    if (window != 1 || attr != 0) exit(96);
    printf("ORACLE_LINE\t%u\t%u\t", qa_oracle_index, qa_line_count++);
    qa_hex(line); putchar('\n');
    if (strchr(line, '\r')) ++qa_cr_count;
}
static void display_nhwindow(winid window, boolean blocking) {
    if (window != 1 || !blocking) exit(97);
}
static void destroy_nhwindow(winid window) { if (window != 1) exit(98); }

/*@@ORIGINAL_FUNCTIONS@@*/

static void qa_oracles(void) {
    dlb *f;
    unsigned count, i;
    unsigned long *all_offsets;
    char line[BUFSZ];
    f = dlb_fopen(ORACLEFILE, "r");
    if (!f || f->fp != NULL) exit(81); /* actual archive path required */
    init_oracles(f);
    count = svo.oracle_cnt;
    if (!count || count > 1000) exit(82);
    all_offsets = malloc((count + 1) * sizeof *all_offsets);
    if (!all_offsets) exit(83);
    memcpy(all_offsets, svo.oracle_loc, count * sizeof *all_offsets);
    if (!dlb_fgets(line, sizeof line, f)
        || sscanf(line, "%5lx", &all_offsets[count]) != 1) exit(84);
    printf("ORACLE_HEADER\t%u\t%ld\n", count, f->size);
    for (i = 0; i <= count; ++i)
        printf("ORACLE_OFFSET\t%u\t%lu\n", i, all_offsets[i]);
    dlb_fclose(f);
    free(svo.oracle_loc); svo.oracle_loc = NULL; svo.oracle_cnt = 0;
    for (i = 0; i < count; ++i) {
        go.oracle_flg = 0;
        qa_oracle_index = i; qa_line_count = qa_cr_count = 0;
        qa_random_calls = qa_random_range = 0;
        outoracle((boolean) (i == 0), FALSE);
        printf("ORACLE_RESULT\t%u\t%u\t%u\t%u\t%u\t%u\n",
               i, qa_line_count, qa_cr_count, qa_random_calls,
               qa_random_range, svo.oracle_cnt);
        free(svo.oracle_loc); svo.oracle_loc = NULL; svo.oracle_cnt = 0;
    }
    free(all_offsets);
}

static void qa_random_section(const char *name, dlb *f, long start, long end,
                              unsigned padlength) {
    long positions[2000], position, size = end - start;
    unsigned count = 0, i;
    char line[BUFSZ];
    if (size <= 0 || f->fp != NULL) exit(85);
    dlb_fseek(f, start, SEEK_SET);
    while ((position = dlb_ftell(f)) < end
           && dlb_fgets(line, sizeof line, f)) {
        if (count >= sizeof positions / sizeof positions[0]) exit(86);
        positions[count++] = position;
    }
    printf("RANDOM_HEADER\t%s\t%u\t%ld\t%ld\t%u\n",
           name, count, start, end, padlength);
    for (i = 0; i < count; ++i) {
        qa_random_offset = positions[i ? i - 1 : count - 1] - start;
        qa_random_calls = qa_random_range = 0;
        get_rnd_line(f, line, sizeof line, qa_rng, start, end, padlength);
        printf("RANDOM_RESULT\t%s\t%u\t%ld\t%u\t%u\t%ld\t",
               name, i, qa_random_offset, qa_random_calls, qa_random_range,
               dlb_ftell(f));
        qa_hex(line); putchar('\n');
    }
}
static void qa_random_data(void) {
    dlb *f;
    const char *names[] = { BOGUSMONFILE, ENGRAVEFILE, EPITAPHFILE };
    unsigned i;
    char header[BUFSZ];
    f = dlb_fopen(RUMORFILE, "r");
    if (!f || f->fp != NULL) exit(87);
    init_rumors(f);
    if (gt.true_rumor_size <= 0 || gf.false_rumor_size <= 0) exit(88);
    printf("RUMOR_HEADER\t%lu\t%ld\t%ld\t%lu\t%ld\t%ld\t%ld\n",
           gt.true_rumor_start, gt.true_rumor_end, gt.true_rumor_size,
           gf.false_rumor_start, gf.false_rumor_end, gf.false_rumor_size,
           f->size);
    qa_random_section("rumors.true", f, (long) gt.true_rumor_start,
                      gt.true_rumor_end, MD_PAD_RUMORS);
    qa_random_section("rumors.false", f, (long) gf.false_rumor_start,
                      gf.false_rumor_end, MD_PAD_RUMORS);
    dlb_fclose(f);
    for (i = 0; i < sizeof names / sizeof names[0]; ++i) {
        long start;
        f = dlb_fopen(names[i], "r");
        if (!f || f->fp != NULL || !dlb_fgets(header, sizeof header, f)) exit(89);
        start = dlb_ftell(f);
        qa_random_section(names[i], f, start, f->size,
                          i == 0 ? MD_PAD_BOGONS : MD_PAD_RUMORS);
        dlb_fclose(f);
    }
}
int main(void) {
    printf("MACROS\tUNIX=%d\tWIN32=%d\tMSDOS=%d\t_WIN32=%d\tDLBLIB=%d\tCROSS_TO_WASM=%d\n",
#ifdef UNIX
        1,
#else
        0,
#endif
#ifdef WIN32
        1,
#else
        0,
#endif
#ifdef MSDOS
        1,
#else
        0,
#endif
#ifdef _WIN32
        1,
#else
        0,
#endif
#ifdef DLBLIB
        1,
#else
        0,
#endif
#ifdef CROSS_TO_WASM
        1
#else
        0
#endif
    );
    if (!dlb_init()) return 80;
    printf("DLB_ARCHIVE\t%s\n", DLBFILE);
    qa_oracles(); qa_random_data();
    dlb_cleanup();
    puts("COMPLETE");
    return 0;
}
