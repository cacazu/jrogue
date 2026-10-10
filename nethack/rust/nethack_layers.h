#ifndef NETHACK_RUST_LAYERS_H
#define NETHACK_RUST_LAYERS_H
#include <stdint.h>
#include <stddef.h>
/* Borrowed immutable input, caller-owned nonoverlapping output. For buffer
 * APIs return required bytes (without NUL), negative error on failure; query
 * with output=NULL/capacity=0. Insufficient capacity writes nothing.
 * All pointers stay inside a single Wasm instance; usize=size_t=32 bits there.
 * Output allocation/free uses the engine module's malloc/free. */
enum nh_rust_context {
  NH_COMMAND=0, NH_DIRECTION=1, NH_MENU=2, NH_MORE=3, NH_TEXT=4, NH_YES_NO=5
};
enum nh_rust_modifier { NH_CTRL=1, NH_ALT=2, NH_SHIFT=4, NH_OS_META=8 };
enum nh_rust_error {
  NH_ERROR_POINTER=-1, NH_ERROR_INPUT=-2, NH_ERROR_FORMAT=-3,
  NH_ERROR_SAVE=-4, NH_ERROR_UTF8=-5, NH_ERROR_LIMIT=-6
};
enum nh_rust_locale { NH_JA=0, NH_EN=1 };
enum nh_rust_direction_layout { NH_VI=0, NH_NUMBERPAD=1, NH_PHONEPAD=2, NH_QWERTZ=3 };
uint32_t nh_rust_abi_version(void);
uint32_t nh_rust_default_locale(void);
int32_t nh_rust_keycode(const uint8_t *key, size_t len, uint32_t modifiers, uint32_t context);
int32_t nh_rust_direction(int32_t dx, int32_t dy, uint32_t run, uint32_t context);
int32_t nh_rust_direction_pad(int32_t dx, int32_t dy, uint32_t run, uint32_t context, uint32_t layout);
/* Complete UTF-8 text validation/copy for NH_TEXT context; embedded NUL rejected.
 * Empty completed text valid. Does not send input into the engine. */
int32_t nh_rust_text_insert(const uint8_t *text, size_t len, uint32_t context, uint8_t *output, size_t output_cap);
int32_t nh_rust_format(const uint8_t *catalog, size_t catalog_len,
                      const uint8_t *event, size_t event_len, uint32_t locale,
                      uint8_t *output, size_t output_cap);
int32_t nh_rust_format_fallback(const uint8_t *catalog, size_t catalog_len,
                               const uint8_t *event, size_t event_len, uint32_t locale);
/* Additive semantic gameplay envelope APIs. UI/direct-event v1 APIs above stay
 * unchanged. Envelope: {event:{id,args},context:{api,helperVariant,locationPrefix,quest?}}.
 * Native helper variants select explicit catalog IDs. Raw location qualifiers
 * stay visible and mark Japanese fallback until semantically localized.
 * Optional quest context must be final and captureComplete; source union args
 * must be complete. Native sourceTemplate/decodedLine are diagnostic only.
 * Typed argument event={id,args} supports public name composition: root depth0,
 * nested depths1..8, 512 total nodes, 4096 total slots, 64 slots/node, and 256KiB
 * cumulative literal/ID/argument-name UTF-8. Inner fallback is propagated.
 * Per-call event/placeholder expansions max8192; overflow fails closed.
 * Catalog max16MiB, serialized envelope max256KiB, rendered text max128KiB. */
int32_t nh_rust_format_gameplay(const uint8_t *catalog, size_t catalog_len,
                               const uint8_t *envelope, size_t envelope_len, uint32_t locale,
                               uint8_t *output, size_t output_cap);
int32_t nh_rust_format_gameplay_fallback(const uint8_t *catalog, size_t catalog_len,
                                        const uint8_t *envelope, size_t envelope_len, uint32_t locale);
int32_t nh_rust_save_wrap(const uint8_t *payload, size_t payload_len, uint8_t *output, size_t output_cap);
int32_t nh_rust_save_unwrap(const uint8_t *json, size_t json_len, uint8_t *output, size_t output_cap);
#endif
