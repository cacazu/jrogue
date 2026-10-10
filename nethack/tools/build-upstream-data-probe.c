/* Added 2026-10-02: standalone official DLB resource verification.
 * Calls the unmodified upstream reader outside any live game.
 */
#include "config.h"
#include "dlb.h"
#include <stdio.h>

FILE *fopen_datafile(const char *name, const char *mode, int prefix) {
    (void)prefix;
    return fopen(name, mode);
}
int main(int argc, char **argv) {
    const char *names[] = {"nhlib.lua", "nhcore.lua", "dungeon.lua", "help"};
    unsigned i, count=argc > 1 ? (unsigned)argc - 1 : sizeof(names)/sizeof(names[0]);
    int ok = dlb_init();
    printf("DLB init=%d filename=%s\n", ok, DLBFILE);
    if (!ok) return 1;
    for (i=0;i<count;++i) {
        const char *name=argc > 1 ? argv[i+1] : names[i];
        unsigned char buffer[4096];
        unsigned hash=2166136261U;
        long size=0;
        int n,j;
        dlb *f=dlb_fopen(name,"r");
        if (!f) { printf("MISSING %s\n", name); return 2; }
        while ((n=dlb_fread((char *)buffer,1,sizeof(buffer),f)) > 0) {
            size+=n;
            for(j=0;j<n;++j) { hash^=buffer[j]; hash*=16777619U; }
        }
        printf("%s\t%ld\t%u\n", name,size,hash);
        dlb_fclose(f);
    }
    dlb_cleanup();
    return 0;
}
