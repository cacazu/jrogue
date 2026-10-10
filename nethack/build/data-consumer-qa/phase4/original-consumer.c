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

#line 66 "upstream/NetHack-5.0.0/src/rumors.c"
staticfn void
unpadline(char *line)
{
    char *p = eos(line);

    /* remove newline if still present; caller should have stripped it */
    if (p > line && p[-1] == '\n')
        --p;

    /* remove padding */
    while (p > line && p[-1] == '_')
        --p;

    *p = '\0';
}

#line 84 "upstream/NetHack-5.0.0/src/rumors.c"
staticfn void
init_rumors(dlb *fp)
{
    static const char rumors_header[] = "%d,%ld,%lx;%d,%ld,%lx;0,0,%lx\n";
    int true_count, false_count; /* in file but not used here */
    unsigned long eof_offset;
    char line[BUFSZ];

    (void) dlb_fgets(line, sizeof line, fp); /* skip "don't edit" comment */
    (void) dlb_fgets(line, sizeof line, fp);
    if (sscanf(line, rumors_header, &true_count, &gt.true_rumor_size,
               &gt.true_rumor_start, &false_count, &gf.false_rumor_size,
               &gf.false_rumor_start, &eof_offset) == 7
        && gt.true_rumor_size > 0L
        && gf.false_rumor_size > 0L) {
        gt.true_rumor_end = (long) gt.true_rumor_start + gt.true_rumor_size;
        /* assert( gt.true_rumor_end == false_rumor_start ); */
        gf.false_rumor_end = (long) gf.false_rumor_start + gf.false_rumor_size;
        /* assert( gf.false_rumor_end == eof_offset ); */
    } else {
        gt.true_rumor_size = -1L; /* init failed */
        (void) dlb_fclose(fp);
    }
}

#line 419 "upstream/NetHack-5.0.0/src/rumors.c"
staticfn char *
get_rnd_line(
    dlb *fh,            /* already opened file */
    char *buf,          /* output buffer */
    unsigned bufsiz,    /* (unsigned) sizeof buf */
    int (*rng)(int),    /* random number routine; rn2(N) or similar, 0..N-1 */
    long startpos,      /* location in file of first line of interest */
    long endpos,        /* location one byte past last line of interest;
                         * if 0, end-of-file will be used */
    unsigned padlength) /* expected line length; 0 if no expectations */
{
    char *newl, *xbufp, xbuf[BUFSZ];
    long filechunksize, chunkoffset;
    int trylimit;

    *buf = '\0';
    if (!endpos) {
        (void) dlb_fseek(fh, 0L, SEEK_END);
        endpos = dlb_ftell(fh);
    }
    filechunksize = endpos - startpos;

    /* might be zero (only if file is empty); should complain in that
       case but it could happen over and over, also the suggestion
       that save and restore might fix the problem wouldn't be useful */
    if (filechunksize < 1L)
        return buf;
    /* 'rumors' is about 3/4 of the way to the limit on a 16-bit config
       for the whole, roughly 3/8 of the way for either half; all active
       configurations these days are at least 32-bits anyway */
    nhassert(filechunksize <= INT_MAX); /* essential for rn2() */

    /*
     * Position randomly which will probably be in the middle of a line.
     * (Occasionally by chance it will happen to be at the very start of
     * a line, but we'll have no way of knowing that so have to behave
     * as if it were positioned in the middle.)
     * Read the rest of that line, then use the next one.  If there's no
     * next line (ie, end of file), go back to beginning and use first.
     *
     * When short lines have been padded to length N, only accept long
     * lines if we land within last N+1 characters (+1 is for newline
     * which hasn't been stripped away yet), effectively shortening
     * them to normal length.  That yields even selection distribution.
     */
    for (trylimit = 10; trylimit > 0; --trylimit) {
        chunkoffset = (long) (*rng)((int) filechunksize);
        (void) dlb_fseek(fh, startpos + chunkoffset, SEEK_SET);
        (void) dlb_fgets(buf, bufsiz, fh);
        /* if padlength is 0, accept any position; when non-zero,
           padlength does not count the newline but strlen(buf) does */
        if (!padlength || (unsigned) strlen(buf) <= padlength + 1)
            break;
    }
    /* use next line; for rumors, caller takes care of whether startpos
       and endpos cover just true rumors or just false rumors; reaching
       endpos is equivalent to end-of-file in order to avoid using the
       first false rumor if fseek for a true one lands within the last one */
    if (dlb_ftell(fh) >= endpos || !dlb_fgets(buf, bufsiz, fh)) {
        /* assume failure is due to end-of-file; go back to start */
        (void) dlb_fseek(fh, startpos, SEEK_SET);
        (void) dlb_fgets(buf, bufsiz, fh);
    }
    if ((newl = strchr(buf, '\n')) != 0)
        *newl = '\0';
    /* decrypt line; make sure that our intermediate buffer is big enough */
    xbufp = (strlen(buf) <= sizeof xbuf - 1) ? &xbuf[0]
            : (char *) alloc((unsigned) strlen(buf) + 1);
    Strcpy(buf, xcrypt(buf, xbufp));
    if (xbufp != &xbuf[0])
        free((genericptr_t) xbufp);
    /* strip padding that makedefs adds to short lines */
    if (padlength)
        unpadline(buf);
    return buf;
}

#line 576 "upstream/NetHack-5.0.0/src/rumors.c"
staticfn void
init_oracles(dlb *fp)
{
    int i;
    char line[BUFSZ];
    int cnt = 0;

    /* this assumes we're only called once */
    (void) dlb_fgets(line, sizeof line, fp); /* skip "don't edit" comment*/
    (void) dlb_fgets(line, sizeof line, fp);
    if (sscanf(line, "%5d\n", &cnt) == 1 && cnt > 0) {
        svo.oracle_cnt = (unsigned) cnt;
        svo.oracle_loc = (unsigned long *) alloc((unsigned) cnt * sizeof(long));
        for (i = 0; i < cnt; i++) {
            (void) dlb_fgets(line, sizeof line, fp);
            (void) sscanf(line, "%5lx\n", &svo.oracle_loc[i]);
        }
    }
    return;
}

#line 639 "upstream/NetHack-5.0.0/src/rumors.c"
void
outoracle(boolean special, boolean delphi)
{
    winid tmpwin;
    dlb *oracles;
    int oracle_idx;
    char *endp, line[COLNO], xbuf[BUFSZ];

    /* early return if we couldn't open ORACLEFILE on previous attempt,
       or if all the oracularities are already exhausted */
    if (go.oracle_flg < 0 || (go.oracle_flg > 0 && svo.oracle_cnt == 0))
        return;

    oracles = dlb_fopen(ORACLEFILE, "r");

    if (oracles) {
        if (go.oracle_flg == 0) { /* if this is the first outoracle() */
            init_oracles(oracles);
            go.oracle_flg = 1;
            if (svo.oracle_cnt == 0)
                goto close_oracles;
        }
        /* oracle_loc[0] is the special oracle;
           oracle_loc[1..oracle_cnt-1] are normal ones */
        if (svo.oracle_cnt <= 1 && !special)
            goto close_oracles; /*(shouldn't happen)*/
        oracle_idx = special ? 0 : rnd((int) svo.oracle_cnt - 1);
        (void) dlb_fseek(oracles, (long) svo.oracle_loc[oracle_idx], SEEK_SET);
        if (!special) /* move offset of very last one into this slot */
            svo.oracle_loc[oracle_idx] = svo.oracle_loc[--svo.oracle_cnt];

        tmpwin = create_nhwindow(NHW_TEXT);
        if (delphi)
            putstr(tmpwin, 0,
                   special
                     ? "The Oracle scornfully takes all your gold and says:"
                     : "The Oracle meditates for a moment and then intones:");
        else
            putstr(tmpwin, 0, "The message reads:");
        putstr(tmpwin, 0, "");

        while (dlb_fgets(line, COLNO, oracles) && strcmp(line, "---\n")) {
            if ((endp = strchr(line, '\n')) != 0)
                *endp = 0;
            putstr(tmpwin, 0, xcrypt(line, xbuf));
        }
        display_nhwindow(tmpwin, TRUE);
        destroy_nhwindow(tmpwin);
 close_oracles:
        (void) dlb_fclose(oracles);
    } else {
        couldnt_open_file(ORACLEFILE);
        go.oracle_flg = -1; /* don't try to open it again */
    }
}

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
