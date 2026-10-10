/* Added 2026-10-02: isolated Phase7 proposal, NGPL; not installed. */
#ifndef JROGUE_NH_BUFFER_PROTOTYPE_CMD_H
#define JROGUE_NH_BUFFER_PROTOTYPE_CMD_H
static const struct nh_text_descriptor nh_buffer_site_722a59ef51484031_descriptor = {"nethack.message.cmd.doc_extcmd_flagstr.sprintf.m_command_accepts_s_prefix.924571b52b", "add_menu_str", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN};
static void nh_buffer_site_722a59ef51484031(struct nh_buf_owner *owner, char *destination, const char *format, const char * value_1) {
    uint64_t generation=nh_buf_before_write(owner,destination,QBUFSZ,&nh_buffer_site_722a59ef51484031_descriptor);
    (void)nh_buf_text_argument(owner,0,"arg_1",value_1);
    Sprintf(destination, format, value_1); /* exact original void formatting API */
    nh_buf_after_write(owner,generation,1);
}

static const struct nh_text_descriptor nh_buffer_site_3519e34dec8c76fb_descriptor = {"nethack.message.cmd.help_dir.sprintf.and_press_the_c_key.e80a985965", "putstr", NH_TEXT_PUTSTR, NH_TEXT_PLAIN};
static void nh_buffer_site_3519e34dec8c76fb(struct nh_buf_owner *owner, char *destination, const char *format, int value_1) {
    uint64_t generation=nh_buf_before_write(owner,destination,BUFSZ,&nh_buffer_site_3519e34dec8c76fb_descriptor);
    nh_buf_scalar_argument(owner,0,"arg_1",NH_TEXT_INTEGER,(int64_t)value_1);
    Sprintf(destination, format, value_1); /* exact original void formatting API */
    nh_buf_after_write(owner,generation,1);
}
#endif
