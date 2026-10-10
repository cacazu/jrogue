/* Added 2026-10-02: isolated Phase7 proposal, NGPL; not installed. */
#ifndef JROGUE_NH_BUFFER_PROTOTYPE_RESTORE_H
#define JROGUE_NH_BUFFER_PROTOTYPE_RESTORE_H
static const struct nh_text_descriptor nh_buffer_site_22df3f92e6728aa9_descriptor = {"nethack.message.restore.getlev.sprintf.pid_d_doesn_t_match_saved_pid.e56e55fdd4", "pline1", NH_TEXT_MESSAGE, NH_TEXT_PLAIN};
static void nh_buffer_site_22df3f92e6728aa9(struct nh_buf_owner *owner, char *destination, const char *format, int value_1, int value_2) {
    uint64_t generation=nh_buf_before_write(owner,destination,BUFSZ,&nh_buffer_site_22df3f92e6728aa9_descriptor);
    nh_buf_scalar_argument(owner,0,"arg_1",NH_TEXT_INTEGER,(int64_t)value_1);
    nh_buf_scalar_argument(owner,1,"arg_2",NH_TEXT_INTEGER,(int64_t)value_2);
    Sprintf(destination, format, value_1, value_2); /* exact original void formatting API */
    nh_buf_after_write(owner,generation,2);
}

static const struct nh_text_descriptor nh_buffer_site_83d94d5a08a69f2f_descriptor = {"nethack.message.restore.getlev.sprintf.this_is_level_d_not_d.7575aefeec", "pline1", NH_TEXT_MESSAGE, NH_TEXT_PLAIN};
static void nh_buffer_site_83d94d5a08a69f2f(struct nh_buf_owner *owner, char *destination, const char *format, int value_1, int value_2) {
    uint64_t generation=nh_buf_before_write(owner,destination,BUFSZ,&nh_buffer_site_83d94d5a08a69f2f_descriptor);
    nh_buf_scalar_argument(owner,0,"arg_1",NH_TEXT_INTEGER,(int64_t)value_1);
    nh_buf_scalar_argument(owner,1,"arg_2",NH_TEXT_INTEGER,(int64_t)value_2);
    Sprintf(destination, format, value_1, value_2); /* exact original void formatting API */
    nh_buf_after_write(owner,generation,2);
}
#endif
