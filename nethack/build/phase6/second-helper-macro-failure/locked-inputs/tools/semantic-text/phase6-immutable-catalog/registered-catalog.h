/* Isolated additive proposal, not included by the active build. */
#ifndef NH_RUST_REGISTERED_CATALOG_H
#define NH_RUST_REGISTERED_CATALOG_H
#include <stddef.h>
#include <stdint.h>
#ifdef __cplusplus
extern "C" {
#endif
/* Positive module-local nonrepeating handle; source allocation stays caller-owned. */
int32_t nh_rust_catalog_register(const uint8_t *json, size_t json_length);
/* 0 success; released/unknown handle is -7. Dispose before replacing the module. */
int32_t nh_rust_catalog_release(uint32_t handle);
/* kind=0 text event/1 gameplay envelope; locale=0 JA/1 EN.
 * Full output writes optional separate 1-byte fallback 0/1. Query/undersized
 * output leaves text and fallback untouched. Inputs/output/status must be disjoint.
 * Required/written length excludes NUL; existing negative errors plus -7/-8. */
int32_t nh_rust_format_registered(uint32_t handle, const uint8_t *event,
                                 size_t event_length, uint32_t kind,
                                 uint32_t locale, uint8_t *output,
                                 size_t output_capacity, uint8_t *fallback);
#ifdef __cplusplus
}
#endif
#endif
