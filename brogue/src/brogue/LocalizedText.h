#ifndef LOCALIZED_TEXT_H
#define LOCALIZED_TEXT_H

#include <stddef.h>
#include <stdint.h>

/* Values above Unicode are reserved for display text, never game/map glyphs. */
#define LOCALIZED_GLYPH_BASE 0x110000
#define LOCALIZED_CONTINUATION LOCALIZED_GLYPH_BASE
#define LANGUAGE_KEY 2000

int localeSetLanguage(const char *language);
const char *localeLanguage(void);
void localeToggleLanguage(void);
void localeDisplay(char *output, size_t capacity, const char *english);
int localeTextWidth(const char *text);
int localeDisplayWidth(const char *english);
size_t localeDisplayGlyphs(const char *english, uint32_t *glyphs, size_t capacity);
void localeCopyText(char *output, size_t capacity, const char *text);
uint32_t localeDecode(const char *text, size_t *offset);
int localeCodepointWidth(uint32_t codepoint);
int localeWrap(char *output, size_t capacity, const char *text, int width);
int localeRunTextTests(void);
extern int localeVerifyScreens;
extern int localeVerificationStopInputLoop;
extern int localeAuditGameText;
void localeAuditGeneratedText(void);
void localeVerifyGameScreens(void);

#endif
