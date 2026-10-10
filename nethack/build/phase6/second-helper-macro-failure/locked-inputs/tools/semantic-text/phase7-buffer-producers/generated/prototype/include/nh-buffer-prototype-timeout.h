/* Added 2026-10-02: isolated Phase7 proposal, NGPL; not installed. */
#ifndef JROGUE_NH_BUFFER_PROTOTYPE_TIMEOUT_H
#define JROGUE_NH_BUFFER_PROTOTYPE_TIMEOUT_H
static const struct nh_text_descriptor nh_buffer_site_9aea105070e38eb5_descriptor = {"nethack.message.timeout.wiz_timeout_queue.sprintf.current_time_ld.4b67f8046d", "putstr", NH_TEXT_PUTSTR, NH_TEXT_PLAIN};
static void nh_buffer_site_9aea105070e38eb5(struct nh_buf_owner *owner, char *destination, const char *format, long value_1) {
    uint64_t generation=nh_buf_before_write(owner,destination,BUFSZ,&nh_buffer_site_9aea105070e38eb5_descriptor);
    nh_buf_scalar_argument(owner,0,"arg_1",NH_TEXT_INTEGER,(int64_t)value_1);
    Sprintf(destination, format, value_1); /* exact original void formatting API */
    nh_buf_after_write(owner,generation,1);
}

static const struct nh_text_descriptor nh_buffer_site_b809121586bb9e40_descriptor = {"nethack.message.timeout.wiz_timeout_queue.sprintf.swallow_countdown_is_u.229154440f", "putstr", NH_TEXT_PUTSTR, NH_TEXT_PLAIN};
static void nh_buffer_site_b809121586bb9e40(struct nh_buf_owner *owner, char *destination, const char *format, unsigned int value_1) {
    uint64_t generation=nh_buf_before_write(owner,destination,BUFSZ,&nh_buffer_site_b809121586bb9e40_descriptor);
    nh_buf_scalar_argument(owner,0,"arg_1",NH_TEXT_UNSIGNED,(int64_t)value_1);
    Sprintf(destination, format, value_1); /* exact original void formatting API */
    nh_buf_after_write(owner,generation,1);
}

static const struct nh_text_descriptor nh_buffer_site_f1923aeb969e3fad_descriptor = {"nethack.message.timeout.wiz_timeout_queue.sprintf.vault_counter_is_d.fb6b863c4f", "putstr", NH_TEXT_PUTSTR, NH_TEXT_PLAIN};
static void nh_buffer_site_f1923aeb969e3fad(struct nh_buf_owner *owner, char *destination, const char *format, int value_1) {
    uint64_t generation=nh_buf_before_write(owner,destination,BUFSZ,&nh_buffer_site_f1923aeb969e3fad_descriptor);
    nh_buf_scalar_argument(owner,0,"arg_1",NH_TEXT_INTEGER,(int64_t)value_1);
    Sprintf(destination, format, value_1); /* exact original void formatting API */
    nh_buf_after_write(owner,generation,1);
}
#endif
