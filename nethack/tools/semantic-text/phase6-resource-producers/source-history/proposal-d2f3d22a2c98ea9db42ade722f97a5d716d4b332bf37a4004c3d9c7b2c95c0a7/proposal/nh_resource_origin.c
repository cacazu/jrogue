/* Isolated source proposal. The environment certifies the actual immutable
 * archive before any observer can return an identity. No game state, RNG,
 * native names, text lookup, file reads, ftell, or selection replay occurs here.
 * Handle slots own IO provenance only; they are not a text-pointer registry.
 * The current engine is synchronous; a threaded adapter must supply TLS.
 */
#include <stdio.h>
#include <string.h>
#include "nh_resource_origin.h"

struct nh_member { const char *name, *sha256; long archive_start, size; };
struct nh_origin {
    int member;
    long start, end;
    const char *id, *quoted_id, *trimmed_id, *tty_id;
    int control_pending, kind;
    long group_start;
    int ordinal;
};
struct nh_group_origin {
    int member;
    long start, end;
    const char *id;
    int rows;
};
#include "generated/nh_resource_origin_data.inc"
#define NHCOUNT(a) ((int) (sizeof (a) / sizeof (a)[0]))
#define NHRESOURCE_HANDLES 64
struct nh_open {
    const void *handle;
    int member, read_origin;
    long cursor;
};
static struct nh_open nh_open_files[NHRESOURCE_HANDLES];
static int nh_archive_certified;
static const struct nh_origin *nh_last_selected;
static int nh_last_control_removed;
static const char *nh_scoped_id;
static char nh_scoped_json[256];
static struct {
    const void *handle;
    int owner, origin, rows, valid, complete;
    char json[256];
} nh_group;

void nh_resource_disable_all(void)
{
    memset(nh_open_files, 0, sizeof nh_open_files);
    memset(&nh_group, 0, sizeof nh_group);
    nh_archive_certified = 0;
    nh_last_selected = 0;
    nh_last_control_removed = 0;
    nh_scoped_id = 0;
    nh_scoped_json[0] = '\0';
}

int nh_resource_enable_archive(const char *actual_sha256)
{
    nh_resource_disable_all();
    /* This compares environment hash metadata, never completed native text.
     * Passing a hard-coded expected hash without hashing loaded bytes is invalid.
     */
    nh_archive_certified = actual_sha256
        && !strcmp(actual_sha256, NH_RESOURCE_EXPECTED_ARCHIVE_SHA);
    return nh_archive_certified;
}

static struct nh_open *nh_find_open(const void *handle)
{
    int i;
    if (!nh_archive_certified || !handle)
        return 0;
    for (i = 0; i < NHRESOURCE_HANDLES; ++i)
        if (nh_open_files[i].handle == handle)
            return &nh_open_files[i];
    return 0;
}

void nh_resource_opened(const void *handle, const char *name,
                        long original_archive_start, long original_member_size)
{
    int member, slot;
    if (!nh_archive_certified || !handle || !name)
        return;
    for (member = 0; member < NHCOUNT(nh_members); ++member)
        if (!strcmp(name, nh_members[member].name))
            break;
    if (member == NHCOUNT(nh_members))
        return;
    if (nh_members[member].archive_start != original_archive_start
        || nh_members[member].size != original_member_size)
        return; /* selected library/member layout must be the certified bundle */
    for (slot = 0; slot < NHRESOURCE_HANDLES; ++slot)
        if (!nh_open_files[slot].handle)
            break;
    if (slot == NHRESOURCE_HANDLES)
        return; /* explicit original-text fallback on capacity exhaustion */
    nh_open_files[slot].handle = handle;
    nh_open_files[slot].member = member;
    nh_open_files[slot].read_origin = -1;
    nh_open_files[slot].cursor = 0;
}

void nh_resource_closed(const void *handle)
{
    struct nh_open *file = nh_find_open(handle);
    if (file)
        memset(file, 0, sizeof *file);
}

void nh_resource_seeked(const void *handle, long original_position)
{
    struct nh_open *file = nh_find_open(handle);
    if (file) {
        file->cursor = original_position;
        file->read_origin = -1;
    }
}

void nh_resource_read(const void *handle, long original_start,
                      long original_end, int original_line_complete)
{
    struct nh_open *file = nh_find_open(handle);
    int i;
    if (!file)
        return;
    file->cursor = original_end;
    file->read_origin = -1;
    if (!original_line_complete)
        return;
    for (i = 0; i < NHCOUNT(nh_origins); ++i)
        if (nh_origins[i].member == file->member
            && nh_origins[i].start == original_start
            && nh_origins[i].end == original_end) {
            file->read_origin = i;
            return;
        }
}

void nh_resource_reset_value(void)
{
    nh_last_selected = 0;
    nh_last_control_removed = 0;
}

void nh_resource_selected(const void *handle)
{
    struct nh_open *file = nh_find_open(handle);
    nh_resource_reset_value();
    if (file && file->read_origin >= 0
        && nh_origins[file->read_origin].kind == 0)
        nh_last_selected = &nh_origins[file->read_origin];
}

void nh_resource_control_removed(void)
{
    /* Called inside the original executed removal branch, with no second test. */
    if (nh_last_selected && nh_last_selected->control_pending)
        nh_last_control_removed = 1;
}

struct nh_resource_value nh_resource_value_snapshot(void)
{
    struct nh_resource_value value;
    memset(&value, 0, sizeof value);
    if (nh_last_selected
        && (!nh_last_selected->control_pending || nh_last_control_removed)) {
        value.id = nh_last_selected->id;
        value.quoted_id = nh_last_selected->quoted_id;
        value.valid = 1;
    }
    return value; /* caller copies this value immediately, never keeps a buffer */
}

void nh_resource_value_emit_begin(const struct nh_resource_value *copied_value,
                                 int original_quoted_consumer)
{
    nh_scoped_id = 0;
    nh_scoped_json[0] = '\0';
    if (!copied_value || !copied_value->valid)
        return;
    nh_scoped_id = original_quoted_consumer ? copied_value->quoted_id
                                         : copied_value->id;
    if (nh_scoped_id)
        (void) snprintf(nh_scoped_json, sizeof nh_scoped_json,
             "{\"event\":{\"id\":\"%s\",\"args\":{}},"
             "\"context\":{\"api\":\"%s\",\"helperVariant\":\"%s\"}}",
             nh_scoped_id, original_quoted_consumer ? "verbalize" : "pline",
             original_quoted_consumer ? "quoted" : "plain");
}

void nh_resource_display_begin(const void *handle, int original_consumer_recipe)
{
    struct nh_open *file = nh_find_open(handle);
    const struct nh_origin *origin;
    nh_scoped_id = 0;
    nh_scoped_json[0] = '\0';
    if (!file || file->read_origin < 0)
        return;
    origin = &nh_origins[file->read_origin];
    if (origin->kind != 1)
        return;
    if (original_consumer_recipe == 1)
        nh_scoped_id = origin->trimmed_id;
    else if (original_consumer_recipe == 2)
        nh_scoped_id = origin->tty_id;
    if (nh_scoped_id)
        (void) snprintf(nh_scoped_json, sizeof nh_scoped_json,
             "{\"event\":{\"id\":\"%s\",\"args\":{}},"
             "\"context\":{\"api\":\"putstr\",\"helperVariant\":\"plain\"}}",
             nh_scoped_id);
}

void nh_resource_display_end(void)
{
    nh_scoped_id = 0;
    nh_scoped_json[0] = '\0';
}

const char *nh_resource_current_event_json(void)
{
    return nh_scoped_id ? nh_scoped_json : 0;
}

void nh_resource_group_begin(int original_window, const void *handle)
{
    struct nh_open *file = nh_find_open(handle);
    int i;
    memset(&nh_group, 0, sizeof nh_group);
    nh_group.origin = -1;
    if (!file)
        return;
    for (i = 0; i < NHCOUNT(nh_group_origins); ++i)
        if (nh_group_origins[i].member == file->member
            && nh_group_origins[i].start == file->cursor) {
            nh_group.handle = handle;
            nh_group.owner = original_window;
            nh_group.origin = i;
            nh_group.valid = 1;
            return;
        }
}

void nh_resource_group_row(int original_window, const void *handle)
{
    struct nh_open *file = nh_find_open(handle);
    const struct nh_origin *row;
    if (!nh_group.valid || nh_group.owner != original_window
        || nh_group.handle != handle || !file || file->read_origin < 0) {
        nh_group.valid = 0;
        return;
    }
    row = &nh_origins[file->read_origin];
    if (row->kind != 2 || row->group_start != nh_group_origins[nh_group.origin].start
        || row->ordinal != nh_group.rows) {
        nh_group.valid = 0;
        return;
    }
    ++nh_group.rows;
}

void nh_resource_group_finish(int original_window, const void *handle)
{
    struct nh_open *file = nh_find_open(handle);
    const struct nh_origin *last;
    const struct nh_group_origin *group;
    if (!nh_group.valid || nh_group.owner != original_window
        || nh_group.handle != handle || !file || file->read_origin < 0)
        return;
    group = &nh_group_origins[nh_group.origin];
    last = &nh_origins[file->read_origin];
    if (last->kind == 3 && last->group_start == group->start
        && last->end == group->end && last->ordinal == group->rows
        && nh_group.rows == group->rows) {
        nh_group.complete = 1;
        (void) snprintf(nh_group.json, sizeof nh_group.json,
             "{\"event\":{\"id\":\"%s\",\"args\":{}},"
             "\"context\":{\"api\":\"oracle_group\",\"helperVariant\":\"plain\"}}",
             group->id);
    }
}

const char *nh_resource_group_event_json(int original_window)
{
    return nh_group.complete && nh_group.owner == original_window
        ? nh_group.json : 0;
}
