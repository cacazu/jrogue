/* Narrow platform adapter for the source-execution proof only.
 * ToME's bundled lauxlib.c loads files through four PhysicsFS functions.
 * Preserve lauxlib.c unchanged and connect those functions to ordinary stdio.
 * This does not implement PhysicsFS archives, mounts, game save I/O or security.
 */
#include <stdio.h>
#include <stdlib.h>
#include "physfs.h"

typedef struct ProofFile {
    FILE *file;
    int owns_file;
} ProofFile;

PHYSFS_File *PHYSFS_openRead(const char *filename) {
    FILE *file = filename ? fopen(filename, "rb") : stdin;
    if (!file) return NULL;
    ProofFile *handle = (ProofFile *)malloc(sizeof(ProofFile));
    if (!handle) {
        if (filename) fclose(file);
        return NULL;
    }
    handle->file = file;
    handle->owns_file = filename != NULL;
    return (PHYSFS_File *)handle;
}

PHYSFS_sint64 PHYSFS_read(PHYSFS_File *opaque, void *buffer,
                         PHYSFS_uint32 object_size, PHYSFS_uint32 object_count) {
    ProofFile *handle = (ProofFile *)opaque;
    size_t count = fread(buffer, object_size, object_count, handle->file);
    if (ferror(handle->file)) return -1;
    return (PHYSFS_sint64)count;
}

int PHYSFS_eof(PHYSFS_File *opaque) {
    return feof(((ProofFile *)opaque)->file);
}

int PHYSFS_close(PHYSFS_File *opaque) {
    ProofFile *handle = (ProofFile *)opaque;
    int result = handle->owns_file ? fclose(handle->file) == 0 : 1;
    free(handle);
    return result;
}
