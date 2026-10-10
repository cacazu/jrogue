typedef void * genericptr_t;
extern char *index(const char *s, int c) __attribute__ ((unavailable));
extern char *rindex(const char *s, int c) __attribute__ ((unavailable));
typedef signed char schar;
typedef unsigned char uchar;
typedef long int ptrdiff_t;
typedef long unsigned int size_t;
typedef int wchar_t;
typedef struct {
  long long __clang_max_align_nonce1
      __attribute__((__aligned__(__alignof__(long long))));
  long double __clang_max_align_nonce2
      __attribute__((__aligned__(__alignof__(long double))));
} max_align_t;
typedef unsigned long int uintptr_t;
typedef long int intptr_t;
typedef signed char int8_t;
typedef short int16_t;
typedef int int32_t;
typedef long long int int64_t;
typedef long long int intmax_t;
typedef unsigned char uint8_t;
typedef unsigned short uint16_t;
typedef unsigned int uint32_t;
typedef long long unsigned int uint64_t;
typedef long long unsigned int uintmax_t;
typedef signed char int_fast8_t;
typedef short int_fast16_t;
typedef int int_fast32_t;
typedef long long int int_fast64_t;
typedef signed char int_least8_t;
typedef short int_least16_t;
typedef int int_least32_t;
typedef long long int int_least64_t;
typedef unsigned char uint_fast8_t;
typedef unsigned short uint_fast16_t;
typedef unsigned int uint_fast32_t;
typedef long long unsigned int uint_fast64_t;
typedef unsigned char uint_least8_t;
typedef unsigned short uint_least16_t;
typedef unsigned int uint_least32_t;
typedef long long unsigned int uint_least64_t;
;
                                                              ;
                                                              ;
                                                               ;
                                                              ;
                                                               ;
                                                              ;
                                                               ;
                                                            ;
typedef long unsigned int __wasi_size_t;
                                                                  ;
                                                                     ;
typedef uint64_t __wasi_filesize_t;
                                                                      ;
                                                                         ;
typedef uint64_t __wasi_timestamp_t;
                                                                       ;
                                                                          ;
typedef uint32_t __wasi_clockid_t;
                                                                     ;
                                                                        ;
typedef uint16_t __wasi_errno_t;
                                                                   ;
                                                                      ;
typedef uint64_t __wasi_rights_t;
                                                                    ;
                                                                       ;
typedef uint32_t __wasi_fd_t;
                                                                ;
                                                                   ;
typedef struct __wasi_iovec_t {
    uint8_t * buf;
    __wasi_size_t buf_len;
} __wasi_iovec_t;
                                                                   ;
                                                                      ;
                                                                            ;
                                                                                ;
typedef struct __wasi_ciovec_t {
    const uint8_t * buf;
    __wasi_size_t buf_len;
} __wasi_ciovec_t;
                                                                    ;
                                                                       ;
                                                                             ;
                                                                                 ;
typedef int64_t __wasi_filedelta_t;
                                                                       ;
                                                                          ;
typedef uint8_t __wasi_whence_t;
                                                                    ;
                                                                       ;
typedef uint64_t __wasi_dircookie_t;
                                                                       ;
                                                                          ;
typedef uint32_t __wasi_dirnamlen_t;
                                                                       ;
                                                                          ;
typedef uint64_t __wasi_inode_t;
                                                                   ;
                                                                      ;
typedef uint8_t __wasi_filetype_t;
                                                                      ;
                                                                         ;
typedef struct __wasi_dirent_t {
    __wasi_dircookie_t d_next;
    __wasi_inode_t d_ino;
    __wasi_dirnamlen_t d_namlen;
    __wasi_filetype_t d_type;
} __wasi_dirent_t;
                                                                     ;
                                                                       ;
                                                                                ;
                                                                               ;
                                                                                   ;
                                                                                 ;
typedef uint8_t __wasi_advice_t;
                                                                    ;
                                                                       ;
typedef uint16_t __wasi_fdflags_t;
                                                                     ;
                                                                        ;
typedef struct __wasi_fdstat_t {
    __wasi_filetype_t fs_filetype;
    __wasi_fdflags_t fs_flags;
    __wasi_rights_t fs_rights_base;
    __wasi_rights_t fs_rights_inheriting;
} __wasi_fdstat_t;
                                                                     ;
                                                                       ;
                                                                                     ;
                                                                                  ;
                                                                                        ;
                                                                                               ;
typedef uint64_t __wasi_device_t;
                                                                    ;
                                                                       ;
typedef uint16_t __wasi_fstflags_t;
                                                                      ;
                                                                         ;
typedef uint32_t __wasi_lookupflags_t;
                                                                         ;
                                                                            ;
typedef uint16_t __wasi_oflags_t;
                                                                    ;
                                                                       ;
typedef uint64_t __wasi_linkcount_t;
                                                                       ;
                                                                          ;
typedef struct __wasi_filestat_t {
    __wasi_device_t dev;
    __wasi_inode_t ino;
    __wasi_filetype_t filetype;
    __wasi_linkcount_t nlink;
    __wasi_filesize_t size;
    __wasi_timestamp_t atim;
    __wasi_timestamp_t mtim;
    __wasi_timestamp_t ctim;
} __wasi_filestat_t;
                                                                       ;
                                                                         ;
                                                                               ;
                                                                               ;
                                                                                     ;
                                                                                  ;
                                                                                 ;
                                                                                 ;
                                                                                 ;
                                                                                 ;
typedef uint64_t __wasi_userdata_t;
                                                                      ;
                                                                         ;
typedef uint8_t __wasi_eventtype_t;
                                                                       ;
                                                                          ;
typedef uint16_t __wasi_eventrwflags_t;
                                                                          ;
                                                                             ;
typedef struct __wasi_event_fd_readwrite_t {
    __wasi_filesize_t nbytes;
    __wasi_eventrwflags_t flags;
} __wasi_event_fd_readwrite_t;
                                                                                 ;
                                                                                   ;
                                                                                            ;
                                                                                           ;
typedef union __wasi_event_u_t {
    __wasi_event_fd_readwrite_t fd_readwrite;
} __wasi_event_u_t;
                                                                      ;
                                                                        ;
typedef struct __wasi_event_t {
    __wasi_userdata_t userdata;
    __wasi_errno_t error;
    __wasi_eventtype_t type;
    __wasi_event_u_t u;
} __wasi_event_t;
                                                                    ;
                                                                      ;
                                                                                 ;
                                                                              ;
                                                                              ;
                                                                           ;
typedef uint16_t __wasi_subclockflags_t;
                                                                           ;
                                                                              ;
typedef struct __wasi_subscription_clock_t {
    __wasi_clockid_t id;
    __wasi_timestamp_t timeout;
    __wasi_timestamp_t precision;
    __wasi_subclockflags_t flags;
} __wasi_subscription_clock_t;
                                                                                 ;
                                                                                   ;
                                                                                        ;
                                                                                             ;
                                                                                                ;
                                                                                            ;
typedef struct __wasi_subscription_fd_readwrite_t {
    __wasi_fd_t file_descriptor;
} __wasi_subscription_fd_readwrite_t;
                                                                                       ;
                                                                                          ;
                                                                                                            ;
typedef union __wasi_subscription_u_t {
    __wasi_subscription_clock_t clock;
    __wasi_subscription_fd_readwrite_t fd_readwrite;
} __wasi_subscription_u_t;
                                                                             ;
                                                                               ;
typedef struct __wasi_subscription_t {
    __wasi_userdata_t userdata;
    __wasi_eventtype_t type;
    __wasi_subscription_u_t u;
} __wasi_subscription_t;
                                                                           ;
                                                                             ;
                                                                                        ;
                                                                                    ;
                                                                                  ;
typedef uint32_t __wasi_exitcode_t;
                                                                      ;
                                                                         ;
typedef uint8_t __wasi_signal_t;
                                                                    ;
                                                                       ;
typedef uint16_t __wasi_riflags_t;
                                                                     ;
                                                                        ;
typedef uint16_t __wasi_roflags_t;
                                                                     ;
                                                                        ;
typedef uint16_t __wasi_siflags_t;
                                                                     ;
                                                                        ;
typedef uint8_t __wasi_sdflags_t;
                                                                     ;
                                                                        ;
typedef uint8_t __wasi_preopentype_t;
                                                                         ;
                                                                            ;
typedef struct __wasi_prestat_dir_t {
    __wasi_size_t pr_name_len;
} __wasi_prestat_dir_t;
                                                                         ;
                                                                            ;
                                                                                          ;
typedef union __wasi_prestat_u_t {
    __wasi_prestat_dir_t dir;
} __wasi_prestat_u_t;
                                                                       ;
                                                                          ;
typedef struct __wasi_prestat_t {
    __wasi_preopentype_t pr_type;
    __wasi_prestat_u_t u;
} __wasi_prestat_t;
                                                                     ;
                                                                        ;
                                                                                  ;
                                                                            ;
__wasi_errno_t __wasi_args_get(
    uint8_t * * argv,
    uint8_t * argv_buf
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("args_get"),
));
__wasi_errno_t __wasi_args_sizes_get(
    __wasi_size_t *argc,
    __wasi_size_t *argv_buf_size
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("args_sizes_get"),
));
__wasi_errno_t __wasi_environ_get(
    uint8_t * * environ,
    uint8_t * environ_buf
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("environ_get"),
));
__wasi_errno_t __wasi_environ_sizes_get(
    __wasi_size_t *argc,
    __wasi_size_t *argv_buf_size
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("environ_sizes_get"),
));
__wasi_errno_t __wasi_clock_res_get(
    __wasi_clockid_t id,
    __wasi_timestamp_t *resolution
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("clock_res_get"),
));
__wasi_errno_t __wasi_clock_time_get(
    __wasi_clockid_t id,
    __wasi_timestamp_t precision,
    __wasi_timestamp_t *time
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("clock_time_get"),
));
__wasi_errno_t __wasi_fd_advise(
    __wasi_fd_t fd,
    __wasi_filesize_t offset,
    __wasi_filesize_t len,
    __wasi_advice_t advice
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("fd_advise"),
));
__wasi_errno_t __wasi_fd_allocate(
    __wasi_fd_t fd,
    __wasi_filesize_t offset,
    __wasi_filesize_t len
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("fd_allocate"),
));
__wasi_errno_t __wasi_fd_close(
    __wasi_fd_t fd
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("fd_close"),
));
__wasi_errno_t __wasi_fd_datasync(
    __wasi_fd_t fd
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("fd_datasync"),
));
__wasi_errno_t __wasi_fd_fdstat_get(
    __wasi_fd_t fd,
    __wasi_fdstat_t *stat
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("fd_fdstat_get"),
));
__wasi_errno_t __wasi_fd_fdstat_set_flags(
    __wasi_fd_t fd,
    __wasi_fdflags_t flags
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("fd_fdstat_set_flags"),
));
__wasi_errno_t __wasi_fd_fdstat_set_rights(
    __wasi_fd_t fd,
    __wasi_rights_t fs_rights_base,
    __wasi_rights_t fs_rights_inheriting
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("fd_fdstat_set_rights"),
));
__wasi_errno_t __wasi_fd_filestat_get(
    __wasi_fd_t fd,
    __wasi_filestat_t *buf
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("fd_filestat_get"),
));
__wasi_errno_t __wasi_fd_filestat_set_size(
    __wasi_fd_t fd,
    __wasi_filesize_t size
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("fd_filestat_set_size"),
));
__wasi_errno_t __wasi_fd_filestat_set_times(
    __wasi_fd_t fd,
    __wasi_timestamp_t atim,
    __wasi_timestamp_t mtim,
    __wasi_fstflags_t fst_flags
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("fd_filestat_set_times"),
));
__wasi_errno_t __wasi_fd_pread(
    __wasi_fd_t fd,
    const __wasi_iovec_t *iovs,
    size_t iovs_len,
    __wasi_filesize_t offset,
    __wasi_size_t *nread
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("fd_pread"),
));
__wasi_errno_t __wasi_fd_prestat_get(
    __wasi_fd_t fd,
    __wasi_prestat_t *buf
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("fd_prestat_get"),
));
__wasi_errno_t __wasi_fd_prestat_dir_name(
    __wasi_fd_t fd,
    uint8_t * path,
    __wasi_size_t path_len
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("fd_prestat_dir_name"),
));
__wasi_errno_t __wasi_fd_pwrite(
    __wasi_fd_t fd,
    const __wasi_ciovec_t *iovs,
    size_t iovs_len,
    __wasi_filesize_t offset,
    __wasi_size_t *nwritten
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("fd_pwrite"),
));
__wasi_errno_t __wasi_fd_read(
    __wasi_fd_t fd,
    const __wasi_iovec_t *iovs,
    size_t iovs_len,
    __wasi_size_t *nread
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("fd_read"),
));
__wasi_errno_t __wasi_fd_readdir(
    __wasi_fd_t fd,
    uint8_t * buf,
    __wasi_size_t buf_len,
    __wasi_dircookie_t cookie,
    __wasi_size_t *bufused
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("fd_readdir"),
));
__wasi_errno_t __wasi_fd_renumber(
    __wasi_fd_t fd,
    __wasi_fd_t to
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("fd_renumber"),
));
__wasi_errno_t __wasi_fd_seek(
    __wasi_fd_t fd,
    __wasi_filedelta_t offset,
    __wasi_whence_t whence,
    __wasi_filesize_t *newoffset
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("fd_seek"),
));
__wasi_errno_t __wasi_fd_sync(
    __wasi_fd_t fd
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("fd_sync"),
));
__wasi_errno_t __wasi_fd_tell(
    __wasi_fd_t fd,
    __wasi_filesize_t *offset
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("fd_tell"),
));
__wasi_errno_t __wasi_fd_write(
    __wasi_fd_t fd,
    const __wasi_ciovec_t *iovs,
    size_t iovs_len,
    __wasi_size_t *nwritten
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("fd_write"),
));
__wasi_errno_t __wasi_path_create_directory(
    __wasi_fd_t fd,
    const char *path,
    size_t path_len
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("path_create_directory"),
));
__wasi_errno_t __wasi_path_filestat_get(
    __wasi_fd_t fd,
    __wasi_lookupflags_t flags,
    const char *path,
    size_t path_len,
    __wasi_filestat_t *buf
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("path_filestat_get"),
));
__wasi_errno_t __wasi_path_filestat_set_times(
    __wasi_fd_t fd,
    __wasi_lookupflags_t flags,
    const char *path,
    size_t path_len,
    __wasi_timestamp_t atim,
    __wasi_timestamp_t mtim,
    __wasi_fstflags_t fst_flags
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("path_filestat_set_times"),
));
__wasi_errno_t __wasi_path_link(
    __wasi_fd_t old_fd,
    __wasi_lookupflags_t old_flags,
    const char *old_path,
    size_t old_path_len,
    __wasi_fd_t new_fd,
    const char *new_path,
    size_t new_path_len
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("path_link"),
));
__wasi_errno_t __wasi_path_open(
    __wasi_fd_t fd,
    __wasi_lookupflags_t dirflags,
    const char *path,
    size_t path_len,
    __wasi_oflags_t oflags,
    __wasi_rights_t fs_rights_base,
    __wasi_rights_t fs_rights_inheriting,
    __wasi_fdflags_t fdflags,
    __wasi_fd_t *opened_fd
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("path_open"),
));
__wasi_errno_t __wasi_path_readlink(
    __wasi_fd_t fd,
    const char *path,
    size_t path_len,
    uint8_t * buf,
    __wasi_size_t buf_len,
    __wasi_size_t *bufused
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("path_readlink"),
));
__wasi_errno_t __wasi_path_remove_directory(
    __wasi_fd_t fd,
    const char *path,
    size_t path_len
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("path_remove_directory"),
));
__wasi_errno_t __wasi_path_rename(
    __wasi_fd_t fd,
    const char *old_path,
    size_t old_path_len,
    __wasi_fd_t new_fd,
    const char *new_path,
    size_t new_path_len
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("path_rename"),
));
__wasi_errno_t __wasi_path_symlink(
    const char *old_path,
    size_t old_path_len,
    __wasi_fd_t fd,
    const char *new_path,
    size_t new_path_len
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("path_symlink"),
));
__wasi_errno_t __wasi_path_unlink_file(
    __wasi_fd_t fd,
    const char *path,
    size_t path_len
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("path_unlink_file"),
));
__wasi_errno_t __wasi_poll_oneoff(
    const __wasi_subscription_t * in,
    __wasi_event_t * out,
    __wasi_size_t nsubscriptions,
    __wasi_size_t *nevents
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("poll_oneoff"),
));
_Noreturn void __wasi_proc_exit(
    __wasi_exitcode_t rval
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("proc_exit")));
__wasi_errno_t __wasi_proc_raise(
    __wasi_signal_t sig
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("proc_raise"),
));
__wasi_errno_t __wasi_sched_yield(
    void
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("sched_yield"),
));
__wasi_errno_t __wasi_random_get(
    uint8_t * buf,
    __wasi_size_t buf_len
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("random_get"),
));
__wasi_errno_t __wasi_sock_recv(
    __wasi_fd_t fd,
    const __wasi_iovec_t *ri_data,
    size_t ri_data_len,
    __wasi_riflags_t ri_flags,
    __wasi_size_t *ro_datalen,
    __wasi_roflags_t *ro_flags
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("sock_recv"),
));
__wasi_errno_t __wasi_sock_send(
    __wasi_fd_t fd,
    const __wasi_ciovec_t *si_data,
    size_t si_data_len,
    __wasi_siflags_t si_flags,
    __wasi_size_t *so_datalen
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("sock_send"),
));
__wasi_errno_t __wasi_sock_shutdown(
    __wasi_fd_t fd,
    __wasi_sdflags_t how
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("sock_shutdown"),
));
typedef unsigned long int size_t;
typedef long int ssize_t;
typedef long long int off_t;
typedef struct _IO_FILE FILE;
typedef __builtin_va_list va_list;
typedef __builtin_va_list __isoc_va_list;
typedef union _G_fpos64_t {
 char __opaque[16];
 long long __lldata;
 double __align;
} fpos_t;
extern FILE *const stdin;
extern FILE *const stdout;
extern FILE *const stderr;
FILE *fopen(const char *restrict, const char *restrict);
FILE *freopen(const char *restrict, const char *restrict, FILE *restrict);
int fclose(FILE *);
int remove(const char *);
int rename(const char *, const char *);
int feof(FILE *);
int ferror(FILE *);
int fflush(FILE *);
void clearerr(FILE *);
int fseek(FILE *, long, int);
long ftell(FILE *);
void rewind(FILE *);
int fgetpos(FILE *restrict, fpos_t *restrict);
int fsetpos(FILE *, const fpos_t *);
size_t fread(void *restrict, size_t, size_t, FILE *restrict);
size_t fwrite(const void *restrict, size_t, size_t, FILE *restrict);
int fgetc(FILE *);
int getc(FILE *);
int getchar(void);
int ungetc(int, FILE *);
int fputc(int, FILE *);
int putc(int, FILE *);
int putchar(int);
char *fgets(char *restrict, int, FILE *restrict);
int fputs(const char *restrict, FILE *restrict);
int puts(const char *);
int printf(const char *restrict, ...);
int fprintf(FILE *restrict, const char *restrict, ...);
int sprintf(char *restrict, const char *restrict, ...);
int snprintf(char *restrict, size_t, const char *restrict, ...);
int vprintf(const char *restrict, __isoc_va_list);
int vfprintf(FILE *restrict, const char *restrict, __isoc_va_list);
int vsprintf(char *restrict, const char *restrict, __isoc_va_list);
int vsnprintf(char *restrict, size_t, const char *restrict, __isoc_va_list);
int scanf(const char *restrict, ...);
int fscanf(FILE *restrict, const char *restrict, ...);
int sscanf(const char *restrict, const char *restrict, ...);
int vscanf(const char *restrict, __isoc_va_list);
int vfscanf(FILE *restrict, const char *restrict, __isoc_va_list);
int vsscanf(const char *restrict, const char *restrict, __isoc_va_list);
void perror(const char *);
int setvbuf(FILE *restrict, char *restrict, int, size_t);
void setbuf(FILE *restrict, char *restrict);
char *tmpnam(char *);
FILE *tmpfile(void);
FILE *fmemopen(void *restrict, size_t, const char *restrict);
FILE *open_memstream(char **, size_t *);
FILE *fdopen(int, const char *);
FILE *popen(const char *, const char *);
int pclose(FILE *);
int fileno(FILE *);
int fseeko(FILE *, off_t, int);
off_t ftello(FILE *);
int dprintf(int, const char *restrict, ...);
int vdprintf(int, const char *restrict, __isoc_va_list);
void flockfile(FILE *);
int ftrylockfile(FILE *);
void funlockfile(FILE *);
int getc_unlocked(FILE *);
int getchar_unlocked(void);
int putc_unlocked(int, FILE *);
int putchar_unlocked(int);
ssize_t getdelim(char **restrict, size_t *restrict, int, FILE *restrict);
ssize_t getline(char **restrict, size_t *restrict, FILE *restrict);
int renameat(int, const char *, int, const char *);
char *ctermid(char *);
char *tempnam(const char *, const char *);
char *cuserid(char *);
void setlinebuf(FILE *);
void setbuffer(FILE *, char *, size_t);
int fgetc_unlocked(FILE *);
int fputc_unlocked(int, FILE *);
int fflush_unlocked(FILE *);
size_t fread_unlocked(void *, size_t, size_t, FILE *);
size_t fwrite_unlocked(const void *, size_t, size_t, FILE *);
void clearerr_unlocked(FILE *);
int feof_unlocked(FILE *);
int ferror_unlocked(FILE *);
int fileno_unlocked(FILE *);
int getw(FILE *);
int putw(int, FILE *);
char *fgetln(FILE *, size_t *);
int asprintf(char **, const char *, ...);
int vasprintf(char **, const char *, __isoc_va_list);
int getloadavg(double loadavg[], int nelem);
typedef int wchar_t;

int atoi (const char *);
long atol (const char *);
long long atoll (const char *);
double atof (const char *);
float strtof (const char *restrict, char **restrict);
double strtod (const char *restrict, char **restrict);
long double strtold (const char *restrict, char **restrict);
long strtol (const char *restrict, char **restrict, int);
unsigned long strtoul (const char *restrict, char **restrict, int);
long long strtoll (const char *restrict, char **restrict, int);
unsigned long long strtoull (const char *restrict, char **restrict, int);
int rand (void);
void srand (unsigned);
void *malloc (size_t);
void *calloc (size_t, size_t);
void *realloc (void *, size_t);
void free (void *);
void *aligned_alloc(size_t, size_t);
_Noreturn void abort (void);
int atexit (void (*) (void));
_Noreturn void exit (int);
_Noreturn void _Exit (int);
int at_quick_exit (void (*) (void));
_Noreturn void quick_exit (int);
char *getenv (const char *);
int system (const char *);
void *bsearch (const void *, const void *, size_t, size_t, int (*)(const void *, const void *));
void qsort (void *, size_t, size_t, int (*)(const void *, const void *));
int abs (int);
long labs (long);
long long llabs (long long);
typedef struct { int quot, rem; } div_t;
typedef struct { long quot, rem; } ldiv_t;
typedef struct { long long quot, rem; } lldiv_t;
div_t div (int, int);
ldiv_t ldiv (long, long);
lldiv_t lldiv (long long, long long);
int mblen (const char *, size_t);
int mbtowc (wchar_t *restrict, const char *restrict, size_t);
int wctomb (char *, wchar_t);
size_t mbstowcs (wchar_t *restrict, const char *restrict, size_t);
size_t wcstombs (char *restrict, const wchar_t *restrict, size_t);
size_t __ctype_get_mb_cur_max(void);
int posix_memalign (void **, size_t, size_t);
int setenv (const char *, const char *, int);
int unsetenv (const char *);
int mkstemp (char *);
int mkostemp (char *, int);
char *mkdtemp (char *);
int getsubopt (char **, char *const *, char **);
int rand_r (unsigned *);
char *realpath (const char *restrict, char *restrict);
long int random (void);
void srandom (unsigned int);
char *initstate (unsigned int, char *, size_t);
char *setstate (char *);
int putenv (char *);
int posix_openpt (int);
int grantpt (int);
int unlockpt (int);
char *ptsname (int);
char *l64a (long);
long a64l (const char *);
void setkey (const char *);
double drand48 (void);
double erand48 (unsigned short [3]);
long int lrand48 (void);
long int nrand48 (unsigned short [3]);
long mrand48 (void);
long jrand48 (unsigned short [3]);
void srand48 (long);
unsigned short *seed48 (unsigned short [3]);
void lcong48 (unsigned short [7]);

void *alloca(size_t);
char *mktemp (char *);
int mkstemps (char *, int);
int mkostemps (char *, int, int);
void *valloc (size_t);
void *memalign(size_t, size_t);
int getloadavg(double *, int);
int clearenv(void);
void *reallocarray (void *, size_t, size_t);
void qsort_r (void *, size_t, size_t, int (*)(const void *, const void *, void *), void *);
extern char* strlwr(char *);
extern char* strupr(char *);
typedef struct __locale_struct * locale_t;

void *memcpy (void *restrict, const void *restrict, size_t);
void *memmove (void *, const void *, size_t);
void *memset (void *, int, size_t);
int memcmp (const void *, const void *, size_t);
void *memchr (const void *, int, size_t);
char *strcpy (char *restrict, const char *restrict);
char *strncpy (char *restrict, const char *restrict, size_t);
char *strcat (char *restrict, const char *restrict);
char *strncat (char *restrict, const char *restrict, size_t);
int strcmp (const char *, const char *);
int strncmp (const char *, const char *, size_t);
int strcoll (const char *, const char *);
size_t strxfrm (char *restrict, const char *restrict, size_t);
char *strchr (const char *, int);
char *strrchr (const char *, int);
size_t strcspn (const char *, const char *);
size_t strspn (const char *, const char *);
char *strpbrk (const char *, const char *);
char *strstr (const char *, const char *);
char *strtok (char *restrict, const char *restrict);
size_t strlen (const char *);
char *strerror (int);
int bcmp (const void *, const void *, size_t);
void bcopy (const void *, void *, size_t);
void bzero (void *, size_t);
char *index (const char *, int);
char *rindex (const char *, int);
int ffs (int);
int ffsl (long);
int ffsll (long long);
int strcasecmp (const char *, const char *);
int strncasecmp (const char *, const char *, size_t);
int strcasecmp_l (const char *, const char *, locale_t);
int strncasecmp_l (const char *, const char *, size_t, locale_t);
char *strtok_r (char *restrict, const char *restrict, char **restrict);
int strerror_r (int, char *, size_t);
char *stpcpy(char *restrict, const char *restrict);
char *stpncpy(char *restrict, const char *restrict, size_t);
size_t strnlen (const char *, size_t);
char *strdup (const char *);
char *strndup (const char *, size_t);
char *strsignal(int);
char *strerror_l (int, locale_t);
int strcoll_l (const char *, const char *, locale_t);
size_t strxfrm_l (char *restrict, const char *restrict, size_t, locale_t);
void *memmem(const void *, size_t, const void *, size_t);
void *memccpy (void *restrict, const void *restrict, int, size_t);
char *strsep(char **, const char *);
size_t strlcat (char *, const char *, size_t);
size_t strlcpy (char *, const char *, size_t);
void explicit_bzero (void *, size_t);
typedef int clock_t;
typedef struct { union { int __i[10]; volatile int __vi[10]; unsigned long __s[10]; } __u; const char *_a_transferredcanvases; } pthread_attr_t;
typedef long long int time_t;
struct timespec { time_t tv_sec; int :8*(sizeof(time_t)-sizeof(long))*(1234==4321); long tv_nsec; int :8*(sizeof(time_t)-sizeof(long))*(1234!=4321); };
typedef int pid_t;
typedef unsigned uid_t;
typedef struct __pthread * pthread_t;
typedef struct __sigset_t { unsigned long __bits[2]; } sigset_t;
typedef struct sigaltstack stack_t;
typedef int greg_t, gregset_t[19];
typedef struct _fpstate {
 unsigned long cw, sw, tag, ipoff, cssel, dataoff, datasel;
 struct {
  unsigned short significand[4], exponent;
 } _st[8];
 unsigned long status;
} *fpregset_t;
struct sigcontext {
 unsigned short gs, __gsh, fs, __fsh, es, __esh, ds, __dsh;
 unsigned long edi, esi, ebp, esp, ebx, edx, ecx, eax;
 unsigned long trapno, err, eip;
 unsigned short cs, __csh;
 unsigned long eflags, esp_at_signal;
 unsigned short ss, __ssh;
 struct _fpstate *fpstate;
 unsigned long oldmask, cr2;
};
typedef struct {
 gregset_t gregs;
 fpregset_t fpregs;
 unsigned long oldmask, cr2;
} mcontext_t;
struct sigaltstack {
 void *ss_sp;
 int ss_flags;
 size_t ss_size;
};
typedef struct __ucontext {
 unsigned long uc_flags;
 struct __ucontext *uc_link;
 stack_t uc_stack;
 mcontext_t uc_mcontext;
 sigset_t uc_sigmask;
 unsigned long __fpregs_mem[28];
} ucontext_t;
union sigval {
 int sival_int;
 void *sival_ptr;
};
typedef struct {
 int si_signo, si_errno, si_code;
 union {
  char __pad[128 - 2*sizeof(int) - sizeof(long)];
  struct {
   union {
    struct {
     pid_t si_pid;
     uid_t si_uid;
    } __piduid;
    struct {
     int si_timerid;
     int si_overrun;
    } __timer;
   } __first;
   union {
    union sigval si_value;
    struct {
     int si_status;
     clock_t si_utime, si_stime;
    } __sigchld;
   } __second;
  } __si_common;
  struct {
   void *si_addr;
   short si_addr_lsb;
   union {
    struct {
     void *si_lower;
     void *si_upper;
    } __addr_bnd;
    unsigned si_pkey;
   } __first;
  } __sigfault;
  struct {
   long si_band;
   int si_fd;
  } __sigpoll;
  struct {
   void *si_call_addr;
   int si_syscall;
   unsigned si_arch;
  } __sigsys;
 } __si_fields;
} siginfo_t;
struct sigaction {
 union {
  void (*sa_handler)(int);
  void (*sa_sigaction)(int, siginfo_t *, void *);
 } __sa_handler;
 sigset_t sa_mask;
 int sa_flags;
 void (*sa_restorer)(void);
};
struct sigevent {
 union sigval sigev_value;
 int sigev_signo;
 int sigev_notify;
 union {
  char __pad[64 - 2*sizeof(int) - sizeof(union sigval)];
  pid_t sigev_notify_thread_id;
  struct {
   void (*sigev_notify_function)(union sigval);
   pthread_attr_t *sigev_notify_attributes;
  } __sev_thread;
 } __sev_fields;
};
int __libc_current_sigrtmin(void);
int __libc_current_sigrtmax(void);
int kill(pid_t, int);
int sigemptyset(sigset_t *);
int sigfillset(sigset_t *);
int sigaddset(sigset_t *, int);
int sigdelset(sigset_t *, int);
int sigismember(const sigset_t *, int);
int sigprocmask(int, const sigset_t *restrict, sigset_t *restrict);
int sigsuspend(const sigset_t *);
int sigaction(int, const struct sigaction *restrict, struct sigaction *restrict);
int sigpending(sigset_t *);
int sigwait(const sigset_t *restrict, int *restrict);
int sigwaitinfo(const sigset_t *restrict, siginfo_t *restrict);
int sigtimedwait(const sigset_t *restrict, siginfo_t *restrict, const struct timespec *restrict);
int sigqueue(pid_t, int, union sigval);
int pthread_sigmask(int, const sigset_t *restrict, sigset_t *restrict);
int pthread_kill(pthread_t, int);
void psiginfo(const siginfo_t *, const char *);
void psignal(int, const char *);
int killpg(pid_t, int);
int sigaltstack(const stack_t *restrict, stack_t *restrict);
int sighold(int);
int sigignore(int);
int siginterrupt(int, int);
int sigpause(int);
int sigrelse(int);
void (*sigset(int, void (*)(int)))(int);
typedef void (*sig_t)(int);
typedef int sig_atomic_t;
void (*signal(int, void (*)(int)))(int);
int raise(int);
_Noreturn void __assert_fail (const char *, const char *, int, const char *);
typedef __builtin_va_list __gnuc_va_list;
typedef __builtin_va_list va_list;
int isalnum(int);
int isalpha(int);
int isblank(int);
int iscntrl(int);
int isdigit(int);
int isgraph(int);
int islower(int);
int isprint(int);
int ispunct(int);
int isspace(int);
int isupper(int);
int isxdigit(int);
int tolower(int);
int toupper(int);
static inline int __isspace(int _c)
{
 return _c == ' ' || (unsigned)_c-'\t' < 5;
}

int isalnum_l(int, locale_t);
int isalpha_l(int, locale_t);
int isblank_l(int, locale_t);
int iscntrl_l(int, locale_t);
int isdigit_l(int, locale_t);
int isgraph_l(int, locale_t);
int islower_l(int, locale_t);
int isprint_l(int, locale_t);
int ispunct_l(int, locale_t);
int isspace_l(int, locale_t);
int isupper_l(int, locale_t);
int isxdigit_l(int, locale_t);
int tolower_l(int, locale_t);
int toupper_l(int, locale_t);
int isascii(int);
int toascii(int);
int dysize(int year);
typedef void * timer_t;
typedef int clockid_t;
struct tm {
 int tm_sec;
 int tm_min;
 int tm_hour;
 int tm_mday;
 int tm_mon;
 int tm_year;
 int tm_wday;
 int tm_yday;
 int tm_isdst;
 long tm_gmtoff;
 const char *tm_zone;
};
clock_t clock (void);
time_t time (time_t *);
double difftime (time_t, time_t);
time_t mktime (struct tm *);
size_t strftime (char *restrict, size_t, const char *restrict, const struct tm *restrict);
struct tm *gmtime (const time_t *);
struct tm *localtime (const time_t *);
char *asctime (const struct tm *);
char *ctime (const time_t *);
int timespec_get(struct timespec *, int);
size_t strftime_l (char * restrict, size_t, const char * restrict, const struct tm * restrict, locale_t);
struct tm *gmtime_r (const time_t *restrict, struct tm *restrict);
struct tm *localtime_r (const time_t *restrict, struct tm *restrict);
char *asctime_r (const struct tm *restrict, char *restrict);
char *ctime_r (const time_t *, char *);
void tzset (void);
struct itimerspec {
 struct timespec it_interval;
 struct timespec it_value;
};
int nanosleep (const struct timespec *, struct timespec *);
int clock_getres (clockid_t, struct timespec *);
int clock_gettime (clockid_t, struct timespec *);
int clock_settime (clockid_t, const struct timespec *);
int clock_nanosleep (clockid_t, int, const struct timespec *, struct timespec *);
int clock_getcpuclockid (pid_t, clockid_t *);
struct sigevent;
int timer_create (clockid_t, struct sigevent *restrict, timer_t *restrict);
int timer_delete (timer_t);
int timer_settime (timer_t, int, const struct itimerspec *restrict, struct itimerspec *restrict);
int timer_gettime (timer_t, struct itimerspec *);
int timer_getoverrun (timer_t);
extern char *tzname[2];
char *strptime (const char *restrict, const char *restrict, struct tm *restrict);
extern int daylight;
extern long timezone;
extern int getdate_err;
struct tm *getdate (const char *);
int stime(const time_t *);
time_t timegm(struct tm *);

typedef struct { intmax_t quot, rem; } imaxdiv_t;
intmax_t imaxabs(intmax_t);
imaxdiv_t imaxdiv(intmax_t, intmax_t);
intmax_t strtoimax(const char *restrict, char **restrict, int);
uintmax_t strtoumax(const char *restrict, char **restrict, int);
intmax_t wcstoimax(const wchar_t *restrict, wchar_t **restrict, int);
uintmax_t wcstoumax(const wchar_t *restrict, wchar_t **restrict, int);
typedef int8_t int8;
typedef uint8_t uint8;
typedef int16_t int16;
typedef uint16_t uint16;
typedef int32_t int32;
typedef uint32_t uint32;
typedef int64_t int64;
typedef uint64_t uint64;
typedef unsigned short ushort;
typedef unsigned int uint;
typedef unsigned long ulong;
typedef int8_t xint8;
typedef int16_t coordxy;
typedef int16_t xint16;
typedef schar boolean;
typedef unsigned char seenV;
typedef unsigned readLenType;
typedef uchar nhsym;
typedef struct nhcoord {
    coordxy x, y;
} coord;
typedef unsigned gid_t;
typedef unsigned useconds_t;

int pipe(int [2]);
int pipe2(int [2], int);
int close(int);
int posix_close(int, int);
int dup(int);
int dup2(int, int);
int dup3(int, int, int);
off_t lseek(int, off_t, int);
int fsync(int);
int fdatasync(int);
ssize_t read(int, void *, size_t);
ssize_t write(int, const void *, size_t);
ssize_t pread(int, void *, size_t, off_t);
ssize_t pwrite(int, const void *, size_t, off_t);
int chown(const char *, uid_t, gid_t);
int fchown(int, uid_t, gid_t);
int lchown(const char *, uid_t, gid_t);
int fchownat(int, const char *, uid_t, gid_t, int);
int link(const char *, const char *);
int linkat(int, const char *, int, const char *, int);
int symlink(const char *, const char *);
int symlinkat(const char *, int, const char *);
ssize_t readlink(const char *restrict, char *restrict, size_t);
ssize_t readlinkat(int, const char *restrict, char *restrict, size_t);
int unlink(const char *);
int unlinkat(int, const char *, int);
int rmdir(const char *);
int truncate(const char *, off_t);
int ftruncate(int, off_t);
int access(const char *, int);
int faccessat(int, const char *, int, int);
int chdir(const char *);
int fchdir(int);
char *getcwd(char *, size_t);
unsigned alarm(unsigned);
unsigned sleep(unsigned);
int pause(void);
pid_t fork(void);
pid_t _Fork(void);
int execve(const char *, char *const [], char *const []);
int execv(const char *, char *const []);
int execle(const char *, const char *, ...);
int execl(const char *, const char *, ...);
int execvp(const char *, char *const []);
int execlp(const char *, const char *, ...);
int fexecve(int, char *const [], char *const []);
_Noreturn void _exit(int);
pid_t getpid(void);
pid_t getppid(void);
pid_t getpgrp(void);
pid_t getpgid(pid_t);
int setpgid(pid_t, pid_t);
pid_t setsid(void);
pid_t getsid(pid_t);
char *ttyname(int);
int ttyname_r(int, char *, size_t);
int isatty(int);
pid_t tcgetpgrp(int);
int tcsetpgrp(int, pid_t);
uid_t getuid(void);
uid_t geteuid(void);
gid_t getgid(void);
gid_t getegid(void);
int getgroups(int, gid_t []);
int setuid(uid_t);
int seteuid(uid_t);
int setgid(gid_t);
int setegid(gid_t);
char *getlogin(void);
int getlogin_r(char *, size_t);
int gethostname(char *, size_t);
char *ctermid(char *);
int getopt(int, char * const [], const char *);
extern char *optarg;
extern int optind, opterr, optopt;
long pathconf(const char *, int);
long fpathconf(int, int);
long sysconf(int);
size_t confstr(int, char *, size_t);
int setreuid(uid_t, uid_t);
int setregid(gid_t, gid_t);
int lockf(int, int, off_t);
long gethostid(void);
int nice(int);
void sync(void);
pid_t setpgrp(void);
char *crypt(const char *, const char *);
void encrypt(char *, int);
void swab(const void *restrict, void *restrict, ssize_t);
int usleep(unsigned);
unsigned ualarm(unsigned, unsigned);
int brk(void *);
void *sbrk(intptr_t);
pid_t vfork(void);
int vhangup(void);
int chroot(const char *);
int getpagesize(void);
int getdtablesize(void);
int sethostname(const char *, size_t);
int getdomainname(char *, size_t);
int setdomainname(const char *, size_t);
int setgroups(size_t, const gid_t *);
char *getpass(const char *);
int daemon(int, int);
void setusershell(void);
void endusershell(void);
char *getusershell(void);
int acct(const char *);
int execvpe(const char *, char *const [], char *const []);
int issetugid(void);
int getentropy(void *, size_t);
extern int optreset;
typedef unsigned id_t;

typedef enum {
 P_ALL = 0,
 P_PID = 1,
 P_PGID = 2,
 P_PIDFD = 3
} idtype_t;
pid_t wait (int *);
pid_t waitpid (pid_t, int *, int );
int waitid (idtype_t, id_t, siginfo_t *, int);
typedef int suseconds_t;
struct timeval { time_t tv_sec; suseconds_t tv_usec; };
typedef unsigned long fd_mask;
typedef struct {
 unsigned long fds_bits[1024 / 8 / sizeof(long)];
} fd_set;
int select (int, fd_set *restrict, fd_set *restrict, fd_set *restrict, struct timeval *restrict);
int pselect (int, fd_set *restrict, fd_set *restrict, fd_set *restrict, const struct timespec *restrict, const sigset_t *restrict);

int gettimeofday (struct timeval *restrict, void *restrict);
struct itimerval {
 struct timeval it_interval;
 struct timeval it_value;
};
int getitimer (int, struct itimerval *);
int setitimer (int, const struct itimerval *restrict, struct itimerval *restrict);
int utimes (const char *, const struct timeval [2]);
struct timezone {
 int tz_minuteswest;
 int tz_dsttime;
};
int futimes(int, const struct timeval [2]);
int futimesat(int, const char *, const struct timeval [2]);
int lutimes(const char *, const struct timeval [2]);
int settimeofday(const struct timeval *, const struct timezone *);
int adjtime (const struct timeval *, struct timeval *);

typedef unsigned long long rlim_t;
struct rlimit {
 rlim_t rlim_cur;
 rlim_t rlim_max;
};
struct rusage {
 struct timeval ru_utime;
 struct timeval ru_stime;
 long ru_maxrss;
 long ru_ixrss;
 long ru_idrss;
 long ru_isrss;
 long ru_minflt;
 long ru_majflt;
 long ru_nswap;
 long ru_inblock;
 long ru_oublock;
 long ru_msgsnd;
 long ru_msgrcv;
 long ru_nsignals;
 long ru_nvcsw;
 long ru_nivcsw;
 long __reserved[16];
};
int getrlimit (int, struct rlimit *);
int setrlimit (int, const struct rlimit *);
int getrusage (int, struct rusage *);
int getpriority (int, id_t);
int setpriority (int, id_t, int);
pid_t wait3 (int *, int, struct rusage *);
pid_t wait4 (pid_t, int *, int, struct rusage *);
extern char *dupstr(const char *) __attribute__((returns_nonnull)) __attribute__((nonnull (1)));
extern char *dupstr_n(const char *string,
                      unsigned *lenout) __attribute__((returns_nonnull)) __attribute__((nonnull));
extern long *alloc(unsigned int) __attribute__((returns_nonnull));
extern long *re_alloc(long *, unsigned int) __attribute__((returns_nonnull));
struct version_info {
    unsigned long incarnation;
    unsigned long feature_set;
    unsigned long entity_count;
};
struct nomakedefs_s {
    const char *build_date;
    const char *copyright_banner_c;
    const char *git_sha;
    const char *git_branch;
    const char *git_prefix;
    const char *version_string;
    const char *version_id;
    unsigned long version_number;
    unsigned long version_features;
    unsigned long ignored_features;
    unsigned long version_sanity1;
    unsigned long build_time;
};
extern struct nomakedefs_s nomakedefs;
enum nhcolortype { no_color, nh_color, rgb_color };
struct nethack_color {
    enum nhcolortype colortyp;
    int tableindex;
    int rgbindex;
    const char *name;
    long r, g, b;
};
typedef struct color_and_attr {
           int color, attr;
} color_attr;
extern const struct nethack_color colortable[];
typedef struct nhl_sandbox_info {
    uint32_t flags;
    uint32_t memlimit;
    uint32_t steps;
    uint32_t perpcall;
} nhl_sandbox_info;
typedef enum NHL_pcall_action {
    NHLpa_panic,
    NHLpa_impossible
} NHL_pcall_action;
enum optchoice { opt_in, opt_out};
enum optset_restrictions {
    set_in_sysconf = 0,
    set_in_config = 1,
    set_viaprog = 2,
    set_gameview = 3,
    set_in_game = 4,
    set_wizonly = 5,
    set_wiznofuz = 6,
    set_hidden = 7
};
enum option_phases {
    phase_not_set = 0,
    builtin_opt = 1,
    syscf_opt,
    rc_file_opt,
    environ_opt,
    cmdline_opt,
    play_opt,
    num_opt_phases
};
extern int optfn_boolean(int, int, boolean, char *, char *);
enum OptType { BoolOpt, CompOpt, OthrOpt };
enum Y_N { No, Yes };
enum Off_On { Off, On };
enum OptSection {
    OptS_General, OptS_Behavior, OptS_Map, OptS_Status, OptS_Advanced
};
enum menu_terminology_preference {
    Term_False, Term_Off, Term_Disabled, Term_Excluded, num_terms
};
struct allopt_t {
    const char *name;
    enum OptSection section;
    int minmatch;
    int expectedbuf;
    int idx;
    enum optset_restrictions setwhere;
    enum OptType opttyp;
    enum Y_N negateok;
    enum Y_N valok;
    enum Y_N dupeok;
    enum Y_N pfx;
    enum menu_terminology_preference termpref;
    boolean opt_in_out, *addr;
    int (*optfn)(int, int, boolean, char *, char *);
    const char *alias;
    const char *descr;
    const char *prefixgw;
    boolean initval, has_handler, dupdetected, disregarded;
};
enum opt {
    opt_prefix_only = -1,
 opt_windowtype,
    opt_playmode,
    opt_name,
    opt_role,
    opt_race,
    opt_gender,
    opt_alignment,
    opt_accessiblemsg,
    opt_acoustics,
    opt_align_message,
    opt_align_status,
    opt_altkeyhandling,
    opt_altmeta,
    opt_armorstatus,
    opt_ascii_map,
    opt_o_autocomplete,
    opt_autodescribe,
    opt_autodig,
    opt_autoopen,
    opt_autopickup,
    opt_o_autopickup_exceptions,
    opt_autoquiver,
    opt_autounlock,
    opt_bgcolors,
    opt_o_bind_keys,
    opt_BIOS,
    opt_blind,
    opt_bones,
    opt_boulder,
    opt_catname,
    opt_checkpoint,
    opt_cmdassist,
    opt_color,
    opt_confirm,
    opt_customcolors,
    opt_customsymbols,
    opt_dark_room,
    opt_deaf,
    opt_DECgraphics,
    opt_debug_hunger,
    opt_debug_mongen,
    opt_debug_overwrite_stairs,
    opt_disclose,
    opt_dogname,
    opt_dropped_nopick,
    opt_dungeon,
    opt_effects,
    opt_eight_bit_tty,
    opt_extmenu,
    opt_female,
    opt_fireassist,
    opt_fixinv,
    opt_font_map,
    opt_font_menu,
    opt_font_message,
    opt_font_size_map,
    opt_font_size_menu,
    opt_font_size_message,
    opt_font_size_status,
    opt_font_size_text,
    opt_font_status,
    opt_font_text,
    opt_force_invmenu,
    opt_fruit,
    opt_fullscreen,
    opt_glyph,
    opt_goldX,
    opt_guicolor,
    opt_help,
    opt_herecmd_menu,
    opt_hilite_pet,
    opt_hilite_pile,
    opt_hilite_status,
    opt_hitpointbar,
    opt_horsename,
    opt_IBMgraphics,
    opt_idlecheckpoint,
    opt_ignintr,
    opt_implicit_uncursed,
    opt_legacy,
    opt_lit_corridor,
    opt_lootabc,
    opt_mail,
    opt_map_mode,
    opt_mention_decor,
    opt_mention_map,
    opt_mention_walls,
    opt_menu_deselect_all,
    opt_menu_deselect_page,
    opt_menu_first_page,
    opt_menu_headings,
    opt_menu_invert_all,
    opt_menu_invert_page,
    opt_menu_last_page,
    opt_menu_next_page,
    opt_menu_objsyms,
    opt_menu_overlay,
    opt_menu_previous_page,
    opt_menu_search,
    opt_menu_select_all,
    opt_menu_select_page,
    opt_menu_shift_left,
    opt_menu_shift_right,
    opt_menu_tab_sep,
    opt_menucolors,
    opt_o_menu_colors,
    opt_menuinvertmode,
    opt_menustyle,
    opt_o_message_types,
    opt_mon_movement,
    opt_monpolycontrol,
    opt_montelecontrol,
    opt_monsters,
    opt_mouse_support,
    opt_msg_window,
    opt_msghistory,
    opt_news,
    opt_nudist,
    opt_null,
    opt_number_pad,
    opt_objects,
    opt_packorder,
    opt_paranoid_confirmation,
    opt_pauper,
    opt_perm_invent,
    opt_perminv_mode,
    opt_petattr,
    opt_pettype,
    opt_pickup_burden,
    opt_pickup_stolen,
    opt_pickup_thrown,
    opt_pickup_types,
    opt_pile_limit,
    opt_player_selection,
    opt_popup_dialog,
    opt_preload_tiles,
    opt_price_quotes,
    opt_pushweapon,
    opt_query_menu,
    opt_quick_farsight,
    opt_rawio,
    opt_reroll,
    opt_rest_on_space,
    opt_roguesymset,
    opt_runmode,
    opt_safe_pet,
    opt_safe_wait,
    opt_sanity_check,
    opt_scores,
    opt_scroll_amount,
    opt_scroll_margin,
    opt_selectsaved,
    opt_showdamage,
    opt_showexp,
    opt_showrace,
    opt_showscore,
    opt_showvers,
    opt_silent,
    opt_softkeyboard,
    opt_sortdiscoveries,
    opt_sortloot,
    opt_sortpack,
    opt_sortvanquished,
    opt_soundlib,
    opt_sounds,
    opt_sparkle,
    opt_spot_monsters,
    opt_splash_screen,
    opt_standout,
    opt_status_updates,
    opt_o_status_cond,
    opt_statushilites,
    opt_o_status_hilites,
    opt_statuslines,
    opt_suppress_alert,
    opt_symset,
    opt_term_cols,
    opt_term_rows,
    opt_terrainstatus,
    opt_tile_file,
    opt_tile_height,
    opt_tile_width,
    opt_tiled_map,
    opt_time,
    opt_timed_delay,
    opt_tips,
    opt_tombstone,
    opt_toptenwin,
    opt_traps,
    opt_travel,
    opt_travel_debug,
    opt_tutorial,
    opt_use_darkgray,
    opt_use_inverse,
    opt_use_truecolor,
    opt_vary_msgcount,
    opt_verbose,
    opt_versinfo,
    opt_voices,
    opt_vt_tiledata,
    opt_vt_sounddata,
    opt_warnings,
    opt_weaponstatus,
    opt_whatis_coord,
    opt_whatis_filter,
    opt_whatis_menu,
    opt_whatis_moveskip,
    opt_windowborders,
    opt_windowcolors,
    opt_wizmgender,
    opt_wizweight,
    opt_wraptext,
    pfx_cond_,
    pfx_font,

    OPTCOUNT
};
typedef struct dlb_directory {
    char *fname;
    long foffset;
    long fsize;
    char handling;
} libdir;
typedef struct dlb_library {
    FILE *fdata;
    long fmark;
    libdir *dir;
    char *sspace;
    long nentries;
    long rev;
    long strsize;
} library;
typedef struct dlb_handle {
    FILE *fp;
    library *lib;
    long start;
    long size;
    long mark;
} dlb;
boolean dlb_init(void);
void dlb_cleanup(void);
dlb *dlb_fopen(const char *, const char *);
int dlb_fclose(dlb *);
int dlb_fread(char *, int, int, dlb *);
int dlb_fseek(dlb *, long, int);
char *dlb_fgets(char *, int, dlb *);
int dlb_fgetc(dlb *);
long dlb_ftell(dlb *);
typedef struct dlb_procs {
    boolean (*dlb_init_proc)(void);
    void (*dlb_cleanup_proc)(void);
    boolean (*dlb_fopen_proc)(dlb *, const char *, const char *);
    int (*dlb_fclose_proc)(dlb *);
    int (*dlb_fread_proc)(char *, int, int, dlb *);
    int (*dlb_fseek_proc)(dlb *, long, int);
    char *(*dlb_fgets_proc)(char *, int, dlb *);
    int (*dlb_fgetc_proc)(dlb *);
    long (*dlb_ftell_proc)(dlb *);
} dlb_procs_t;
extern FILE *fopen_datafile(const char *, const char *, int);
extern unsigned FITSuint_(unsigned long long, const char *, int);
static library dlb_libs[4];
static boolean readlibdir(library * lp);
static boolean find_file(const char *name, library **lib, long *startp,
                         long *sizep);
static boolean lib_dlb_init(void);
static void lib_dlb_cleanup(void);
static boolean lib_dlb_fopen(dlb *, const char *, const char *);
static int lib_dlb_fclose(dlb *);
static int lib_dlb_fread(char *, int, int, dlb *);
static int lib_dlb_fseek(dlb *, long, int);
static char *lib_dlb_fgets(char *, int, dlb *);
static int lib_dlb_fgetc(dlb *);
static long lib_dlb_ftell(dlb *);
boolean open_library(const char *lib_name, library *lp);
void close_library(library * lp);
extern char *eos(char *);
static boolean
readlibdir(library *lp)
{
    int i;
    char *sp;
    long liboffset, totalsize;
    if (fscanf(lp->fdata, "%ld %ld %ld %ld %ld\n", &lp->rev, &lp->nentries,
               &lp->strsize, &liboffset, &totalsize) != 5)
        return ((boolean) 0);
    if (lp->rev > 1 || lp->rev < 1)
        return ((boolean) 0);
    lp->dir = (libdir *) alloc(FITSuint_((lp->nentries * sizeof(libdir)), __func__, 139));
    lp->sspace = (char *) alloc(FITSuint_((lp->strsize), __func__, 140));
    for (i = 0, sp = lp->sspace; i < lp->nentries; i++) {
        lp->dir[i].fname = sp;
        if (fscanf(lp->fdata, "%c%s %ld\n", &lp->dir[i].handling, sp,
                   &lp->dir[i].foffset) != 3) {
            free((genericptr_t) lp->dir);
            free((genericptr_t) lp->sspace);
            lp->dir = (libdir *) 0;
            lp->sspace = (char *) 0;
            return ((boolean) 0);
        }
        sp = eos(sp) + 1;
    }
    for (i = 0; i < lp->nentries; i++) {
        if (i == lp->nentries - 1)
            lp->dir[i].fsize = totalsize - lp->dir[i].foffset;
        else
            lp->dir[i].fsize = lp->dir[i + 1].foffset - lp->dir[i].foffset;
    }
    (void) fseek(lp->fdata, 0L, (0));
    lp->fmark = 0;
    return ((boolean) 1);
}
static boolean
find_file(const char *name, library **lib, long *startp, long *sizep)
{
    int i, j;
    library *lp;
    for (i = 0; i < 4 && dlb_libs[i].fdata; i++) {
        lp = &dlb_libs[i];
        for (j = 0; j < lp->nentries; j++) {
            if (strcmp(name, lp->dir[j].fname) == 0) {
                *lib = lp;
                *startp = lp->dir[j].foffset;
                *sizep = lp->dir[j].fsize;
                return ((boolean) 1);
            }
        }
    }
    *lib = (library *) 0;
    *startp = *sizep = 0;
    return ((boolean) 0);
}
boolean
open_library(const char *lib_name, library *lp)
{
    boolean status = ((boolean) 0);
    lp->fdata = fopen_datafile(lib_name, "r", 4);
    if (lp->fdata) {
        if (readlibdir(lp)) {
            status = ((boolean) 1);
        } else {
            (void) fclose(lp->fdata);
            lp->fdata = (FILE *) 0;
        }
    }
    return status;
}
void
close_library(library *lp)
{
    (void) fclose(lp->fdata);
    free((genericptr_t) lp->dir);
    free((genericptr_t) lp->sspace);
    (void) memset((char *) lp, 0, sizeof(library));
}
static boolean
lib_dlb_init(void)
{
    (void) memset((char *) &dlb_libs[0], 0, sizeof(dlb_libs));
    if (!open_library("nhdat", &dlb_libs[0]))
        return ((boolean) 0);
    return ((boolean) 1);
}
static void
lib_dlb_cleanup(void)
{
    int i;
    for (i = 0; i < 4 && dlb_libs[i].fdata; i++)
        close_library(&dlb_libs[i]);
}
static boolean
lib_dlb_fopen(dlb *dp, const char *name, const char *mode __attribute__((unused)))
{
    long start, size;
    library *lp;
    if (find_file(name, &lp, &start, &size)) {
        dp->lib = lp;
        dp->start = start;
        dp->size = size;
        dp->mark = 0;
        return ((boolean) 1);
    }
    return ((boolean) 0);
}
static int
lib_dlb_fclose(dlb *dp __attribute__((unused)))
{
    return 0;
}
static int
lib_dlb_fread(char *buf, int size, int quan, dlb *dp)
{
    long pos, nread, nbytes;
    if ((dp->size - dp->mark) < (size * quan))
        quan = (int)((dp->size - dp->mark) / size);
    if (quan == 0)
        return 0;
    pos = dp->start + dp->mark;
    if (dp->lib->fmark != pos) {
        fseek(dp->lib->fdata, pos, (0));
        dp->lib->fmark = pos;
    }
    nread = fread(buf, size, quan, dp->lib->fdata);
    nbytes = nread * size;
    dp->mark += nbytes;
    dp->lib->fmark += nbytes;
    return (int) nread;
}
static int
lib_dlb_fseek(dlb *dp, long pos, int whence)
{
    long curpos;
    switch (whence) {
    case (1):
        curpos = dp->mark + pos;
        break;
    case (2):
        curpos = dp->size - pos;
        break;
    default:
        curpos = pos;
        break;
    }
    if (curpos < 0)
        curpos = 0;
    if (curpos > dp->size)
        curpos = dp->size;
    dp->mark = curpos;
    return 0;
}
static char *
lib_dlb_fgets(char *buf, int len, dlb *dp)
{
    int i;
    char *bp, c = 0;
    if (len <= 0)
        return buf;
    if (dp->mark >= dp->size)
        return (char *) 0;
    len--;
    for (i = 0, bp = buf; i < len && dp->mark < dp->size && c != '\n';
         i++, bp++) {
        if (dlb_fread(bp, 1, 1, dp) <= 0)
            break;
        c = *bp;
    }
    *bp = '\0';
    return buf;
}
static int
lib_dlb_fgetc(dlb *dp)
{
    char c;
    if (lib_dlb_fread(&c, 1, 1, dp) != 1)
        return (-1);
    return (int) c;
}
static long
lib_dlb_ftell(dlb *dp)
{
    return dp->mark;
}
static const dlb_procs_t lib_dlb_procs = { lib_dlb_init, lib_dlb_cleanup,
                                    lib_dlb_fopen, lib_dlb_fclose,
                                    lib_dlb_fread, lib_dlb_fseek,
                                    lib_dlb_fgets, lib_dlb_fgetc,
                                    lib_dlb_ftell };
static const dlb_procs_t *dlb_procs;
static boolean dlb_initialized = ((boolean) 0);
boolean
dlb_init(void)
{
    if (!dlb_initialized) {
        dlb_procs = &lib_dlb_procs;
        if (dlb_procs)
            dlb_initialized = (*dlb_procs->dlb_init_proc)();
    }
    return dlb_initialized;
}
void
dlb_cleanup(void)
{
    if (dlb_initialized) {
        (*dlb_procs->dlb_cleanup_proc)();
        dlb_initialized = ((boolean) 0);
    }
}
dlb *
dlb_fopen(const char *name, const char *mode)
{
    FILE *fp;
    dlb *dp;
    if (!dlb_initialized)
        return (dlb *) 0;
    if (!mode || mode[0] != 'r')
        return (dlb *) 0;
    dp = (dlb *) alloc(sizeof(dlb));
    if ((*dlb_procs->dlb_fopen_proc)(dp, name, mode))
        dp->fp = (FILE *) 0;
    else if ((fp = fopen_datafile(name, mode, 4)) != 0)
        dp->fp = fp;
    else {
        free((genericptr_t) dp);
        dp = (dlb *) 0;
    }
    return dp;
}
int
dlb_fclose(dlb *dp)
{
    int ret = 0;
    if (dlb_initialized) {
        if (dp->fp)
            ret = fclose(dp->fp);
        else
            ret = (*dlb_procs->dlb_fclose_proc)(dp);
        free((genericptr_t) dp);
    }
    return ret;
}
int
dlb_fread(char *buf, int size, int quan, dlb *dp)
{
    if (!dlb_initialized || size <= 0 || quan <= 0)
        return 0;
    if (dp->fp)
        return (int) fread(buf, size, quan, dp->fp);
    return (*dlb_procs->dlb_fread_proc)(buf, size, quan, dp);
}
int
dlb_fseek(dlb *dp, long pos, int whence)
{
    if (!dlb_initialized)
        return (-1);
    if (dp->fp)
        return fseek(dp->fp, pos, whence);
    return (*dlb_procs->dlb_fseek_proc)(dp, pos, whence);
}
char *
dlb_fgets(char *buf, int len, dlb *dp)
{
    if (!dlb_initialized)
        return (char *) 0;
    if (dp->fp)
        return fgets(buf, len, dp->fp);
    return (*dlb_procs->dlb_fgets_proc)(buf, len, dp);
}
int
dlb_fgetc(dlb *dp)
{
    if (!dlb_initialized)
        return (-1);
    if (dp->fp)
        return fgetc(dp->fp);
    return (*dlb_procs->dlb_fgetc_proc)(dp);
}
long
dlb_ftell(dlb *dp)
{
    if (!dlb_initialized)
        return 0;
    if (dp->fp)
        return ftell(dp->fp);
    return (*dlb_procs->dlb_ftell_proc)(dp);
}
