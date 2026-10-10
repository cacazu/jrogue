/* Added 2026-10-02: explicit public English fallback event; NGPL.
 * Source-reviewed slots only. This copies the original public string without
 * name, gameplay, knowledge or RNG queries. Player input stays plain text.
 */
#include "hack.h"
#include "nh-phase4-values.h"
#define NH_PHASE4_STRING_MAX 65536
#define NH_PHASE4_JSON_MAX 262144

char *nh_phase4_public_raw(const char *text) {
    static const char prefix[]="{\"id\":\"nethack.public_text.original\",\"args\":{\"original\":{\"type\":\"text\",\"value\":\"";
    static const char suffix[]="\"}}}";
    static const char hex[]="0123456789abcdef";
    const unsigned char *p=(const unsigned char *)text;
    size_t length=0, i=0, escaped=0, used;
    char *result;
    if (!text) return NULL;
    while (length <= NH_PHASE4_STRING_MAX && p[length]) ++length;
    if (length > NH_PHASE4_STRING_MAX) return NULL;
    while (i < length) {
        unsigned c=p[i++], need=0, low=0x80, high=0xbf;
        escaped+=c < 0x20 ? 6 : (c == '"' || c == '\\' ? 2 : 1);
        if (c < 0x80) continue;
        if (c >= 0xc2 && c <= 0xdf) need=1;
        else if (c >= 0xe0 && c <= 0xef) {
            need=2;if (c == 0xe0) low=0xa0;if (c == 0xed) high=0x9f;
        } else if (c >= 0xf0 && c <= 0xf4) {
            need=3;if (c == 0xf0) low=0x90;if (c == 0xf4) high=0x8f;
        } else return NULL;
        if (i+need > length || p[i] < low || p[i] > high) return NULL;
        ++i;++escaped;
        while (--need) { if (p[i] < 0x80 || p[i] > 0xbf) return NULL;++i;++escaped; }
    }
    if (escaped+sizeof(prefix)+sizeof(suffix)-1 > NH_PHASE4_JSON_MAX) return NULL;
    result=(char *)malloc(escaped+sizeof(prefix)+sizeof(suffix)-1);
    if (!result) return NULL;
    memcpy(result,prefix,sizeof(prefix)-1);used=sizeof(prefix)-1;
    for (i=0;i<length;++i) {
        unsigned char c=p[i];
        if (c < 0x20) {
            result[used++]='\\';result[used++]='u';result[used++]='0';result[used++]='0';
            result[used++]=hex[c>>4];result[used++]=hex[c&15];
        } else {
            if (c == '"' || c == '\\') result[used++]='\\';
            result[used++]=(char)c;
        }
    }
    memcpy(result+used,suffix,sizeof(suffix));
    return result;
}
