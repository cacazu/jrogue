/* Source-only additive presentation observers; original native APIs unchanged.
 * Generated data and actually loaded archive must be certified before use.
 * This proposal is not included in the active build.
 */
#ifndef NH_RESOURCE_ORIGIN_H
#define NH_RESOURCE_ORIGIN_H
struct nh_resource_value {
    const char *id;
    const char *quoted_id;
    int valid;
};
int nh_resource_enable_archive(const char *actual_sha256);
void nh_resource_disable_all(void);
void nh_resource_opened(const void *handle, const char *name,
                        long original_archive_start, long original_member_size);
void nh_resource_closed(const void *handle);
void nh_resource_seeked(const void *handle, long original_position);
void nh_resource_read(const void *handle, long original_start,
                      long original_end, int original_line_complete);
void nh_resource_reset_value(void);
void nh_resource_selected(const void *handle);
void nh_resource_control_removed(void);
struct nh_resource_value nh_resource_value_snapshot(void);
void nh_resource_value_emit_begin(const struct nh_resource_value *copied_value,
                                 int original_quoted_consumer);
void nh_resource_display_begin(const void *handle, int original_consumer_recipe);
void nh_resource_display_end(void);
const char *nh_resource_current_event_json(void);
void nh_resource_group_begin(int original_window, const void *handle);
void nh_resource_group_row(int original_window, const void *handle);
void nh_resource_group_finish(int original_window, const void *handle);
const char *nh_resource_group_event_json(int original_window);
#endif
