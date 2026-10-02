/* Display-only localization. Gameplay, recordings and diagnostics retain English. */
#include "LocalizedText.h"
#include <ctype.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define TEXT_COLOR_ESCAPE 25
#define LOCALE_BUFFER 16384
#define ARG_SIZE 1024
typedef struct LocaleEntry { const char *id, *source, *translated, *kinds; int weight; const char *domains[16]; } LocaleEntry;
typedef struct LocalePhoneme { const char *source, *translated; } LocalePhoneme;
#include "LocalizedTextData.h"

static int japanese = 0;
int localeVerifyScreens = 0;
int localeVerificationStopInputLoop = 0;
int localeAuditGameText = 0;

int localeSetLanguage(const char *language) {
    if (!strcmp(language, "ja")) japanese = 1;
    else if (!strcmp(language, "en")) japanese = 0;
    else return 0;
    return 1;
}
const char *localeLanguage(void) { return japanese ? "ja" : "en"; }
void localeToggleLanguage(void) { japanese = !japanese; }

uint32_t localeDecode(const char *text, size_t *offset) {
    const unsigned char *s = (const unsigned char *)text + *offset;
    uint32_t value;
    size_t length;
    if (s[0] < 128) { (*offset)++; return s[0]; }
    if (s[0] >= 0xc2 && s[0] <= 0xdf) { length = 2; value = s[0] & 31; }
    else if (s[0] >= 0xe0 && s[0] <= 0xef) { length = 3; value = s[0] & 15; }
    else if (s[0] >= 0xf0 && s[0] <= 0xf4) { length = 4; value = s[0] & 7; }
    else { (*offset)++; return 0xfffd; }
    for (size_t i = 1; i < length; i++) {
        if (!s[i] || (s[i] & 0xc0) != 0x80) { (*offset)++; return 0xfffd; }
        value = (value << 6) | (s[i] & 63);
    }
    if ((length == 3 && value < 0x800) || (length == 4 && value < 0x10000)
        || value > 0x10ffff || (value >= 0xd800 && value <= 0xdfff)) {
        (*offset)++; return 0xfffd;
    }
    *offset += length;
    return value;
}

int localeCodepointWidth(uint32_t cp) {
    if (!cp || cp == '\n' || cp == '\r') return 0;
    if ((cp >= 0x300 && cp <= 0x36f) || (cp >= 0xfe00 && cp <= 0xfe0f)) return 0;
    return (cp >= 0x1100 && (cp <= 0x115f || cp == 0x2329 || cp == 0x232a
        || (cp >= 0x2e80 && cp <= 0xa4cf) || (cp >= 0xac00 && cp <= 0xd7a3)
        || (cp >= 0xf900 && cp <= 0xfaff) || (cp >= 0xfe10 && cp <= 0xfe6f)
        || (cp >= 0xff01 && cp <= 0xff60) || (cp >= 0xffe0 && cp <= 0xffe6)
        || cp >= 0x1f300)) ? 2 : 1;
}

static void appendBytes(char *output, size_t capacity, size_t *used, const char *text, size_t length) {
    if (*used + length >= capacity) return;
    memcpy(output + *used, text, length);
    *used += length;
    output[*used] = 0;
}

void localeCopyText(char *output, size_t capacity, const char *text) {
    size_t index = 0, used = 0;
    if (!capacity) return;
    output[0] = 0;
    while (text[index]) {
        size_t begin = index;
        if ((unsigned char)text[index] == TEXT_COLOR_ESCAPE && strlen(text + index) >= 4) index += 4;
        else localeDecode(text, &index);
        if (used + index - begin >= capacity) break;
        appendBytes(output, capacity, &used, text + begin, index - begin);
    }
}

#define copyText localeCopyText

int localeDisplayWidth(const char *english) {
    char localized[LOCALE_BUFFER];
    localeDisplay(localized, sizeof localized, english);
    return localeTextWidth(localized);
}

size_t localeDisplayGlyphs(const char *english, uint32_t *glyphs, size_t capacity) {
    char localized[LOCALE_BUFFER];
    localeDisplay(localized, sizeof localized, english);
    size_t offset = 0, used = 0;
    while (localized[offset]) {
        if ((unsigned char)localized[offset] == TEXT_COLOR_ESCAPE && strlen(localized + offset) >= 4) { offset += 4; continue; }
        uint32_t cp = localeDecode(localized, &offset);
        int cells = localeCodepointWidth(cp);
        if (!cells) continue;
        if (used + cells > capacity) break;
        glyphs[used++] = cp < 128 ? cp : LOCALIZED_GLYPH_BASE + cp;
        if (cells == 2) glyphs[used++] = LOCALIZED_CONTINUATION;
    }
    return used;
}

int localeTextWidth(const char *text) {
    size_t index = 0;
    int width = 0;
    while (text[index]) {
        if ((unsigned char)text[index] == TEXT_COLOR_ESCAPE && strlen(text + index) >= 4) index += 4;
        else width += localeCodepointWidth(localeDecode(text, &index));
    }
    return width;
}

static int asciiEqual(char a, char b) {
    return tolower((unsigned char)a) == tolower((unsigned char)b);
}

/* A bounded, literal-template matcher. Arguments are snapshots of English values. */
static int placeholder(const char *p, int *length) {
    if (*p != '{' || !isdigit((unsigned char)p[1])) return -1;
    char *end;
    long value = strtol(p + 1, &end, 10);
    if (*end != '}' || value >= 16) return -1;
    *length = (int)(end + 1 - p);
    return (int)value;
}

static int validArgument(const char *text, size_t length, char kind, const char *domain) {
    if (domain) {
        int found=0;
        for (const char *p=domain;;) {
            const char *end=strchr(p,31);
            size_t n=end?(size_t)(end-p):strlen(p);
            if (n==length) {
                size_t i=0;while(i<n&&asciiEqual(p[i],text[i]))i++;
                if(i==n){found=1;break;}
            }
            if(!end)break;
            p=end+1;
        }
        if(!found)return 0;
    }
    if (kind == 'e') return length == 0;
    if (kind == 'g') return !length || (length == 1 && *text == 'n');
    if (kind == 'r') {
        const char *values[] = {"", "s", "es", "ies", "st", "nd", "rd", "th", "'s", "s'"};
        for (int i = 0; i < sizeof values / sizeof *values; i++)
            if (strlen(values[i]) == length && !strncmp(text, values[i], length)) return 1;
        return 0;
    }
    if (kind == 'c') return length == 1;
    if (kind == 'k') {
        if(length>200)return 0;
        for(size_t i=0;i<length;i++)if(strchr(",.;!?\n",text[i]))return 0;
        const char *verbs[]={" bears "," bear "," carries "," carry "," will "," can "," is "," are "," have "," has "," was "," were "};
        for(size_t v=0;v<sizeof verbs/sizeof *verbs;v++) {
            size_t n=strlen(verbs[v]);
            for(size_t i=0;i+n<=length;i++) {
                size_t j=0;while(j<n&&asciiEqual(text[i+j],verbs[v][j]))j++;
                if(j==n)return 0;
            }
        }
    }
    if (kind == 'n' || kind == 'i') {
        char number[128], *end;
        if (!length || length >= sizeof number) return 0;
        memcpy(number, text, length); number[length] = 0;
        if (kind=='i') strtoll(number,&end,10); else strtod(number, &end);
        return end != number && !*end;
    }
    if (kind == 'p') {
        const char *values[] = {"you", "he", "she", "it", "him", "her", "your", "his", "its", "yourself", "himself", "herself", "itself"};
        for (int i = 0; i < sizeof values / sizeof *values; i++) {
            if (strlen(values[i]) != length) continue;
            size_t j = 0;
            while (j < length && asciiEqual(values[i][j], text[j])) j++;
            if (j == length) return 1;
        }
        return 0;
    }
    if (kind == 's') {
        for (size_t i=0; i<length; i++)
            if (text[i]=='\n' || (strchr(".!?",text[i]) && (i+1==length || text[i+1]==' ' || text[i+1]==')'))) return 0;
    }
    return 1;
}

static int containsAnchors(const char *pattern, const char *text) {
    const char *cursor = text;
    while (*pattern) {
        int length;
        if (placeholder(pattern,&length) >= 0) { pattern += length; continue; }
        const char *anchor = pattern;
        while (*pattern && placeholder(pattern,&length) < 0) pattern++;
        size_t n = pattern-anchor;
        int found = 0;
        while (*cursor) {
            size_t i = 0;
            while (i<n && cursor[i] && asciiEqual(anchor[i],cursor[i])) i++;
            if (i==n) { cursor+=n; found=1; break; }
            cursor++;
        }
        if (!found) return 0;
    }
    return 1;
}

static uint32_t failedMatches[17][LOCALE_BUFFER];
static uint32_t matchGeneration;

static int matchTemplateInner(const char *pattern, const char *text, const char *kinds, const char *const *domains,
                              char args[16][ARG_SIZE], int depth, const char *begin, uint32_t generation,
                              int prefix, size_t *consumed) {
    size_t offset = text-begin;
    if (depth > 16) return 0;
    if (offset < LOCALE_BUFFER && failedMatches[depth][offset] == generation) return 0;
    while (*pattern) {
        int placeholderLength;
        int argument = placeholder(pattern, &placeholderLength);
        if (argument >= 0) {
            pattern += placeholderLength;
            size_t maximum = strlen(text);
            if (maximum >= ARG_SIZE) maximum = ARG_SIZE - 1;
            char kind = argument < strlen(kinds) ? kinds[argument] : 's';
            size_t minimum = 0;
            if (kind == 'e') maximum = 0;
            else if (kind == 'c' || kind == 'g') maximum = maximum > 1 ? 1 : maximum;
            else if (kind == 'r') maximum = maximum > 3 ? 3 : maximum;
            else if (kind == 'p') maximum = maximum > 8 ? 8 : maximum;
            else if (kind == 'k') maximum = maximum > 200 ? 200 : maximum;
            else if (kind == 'n' || kind == 'i') {
                char *end;
                if (kind=='i') strtoll(text,&end,10); else strtod(text,&end);
                minimum = maximum = end-text;
                if (!maximum || maximum >= ARG_SIZE) goto failed;
            }
            if (kind == 's') {
                for (size_t i=0; i<maximum; i++) {
                    if (text[i]=='\n' || (strchr(".!?",text[i]) && text[i+1]==' ')) { maximum=i+1; break; }
                }
            }
            /* Prefer the shortest capture that lets the following literal match. */
            for (size_t length = minimum; length <= maximum; length++) {
                if (!validArgument(text, length, kind, domains[argument])) continue;
                int nextPlaceholderLength;
                if (*pattern && placeholder(pattern, &nextPlaceholderLength) < 0 && !asciiEqual(*pattern, text[length])) continue;
                if (!prefix && !*pattern && text[length]) continue;
                if (matchTemplateInner(pattern, text + length, kinds, domains, args, depth + 1, begin, generation, prefix, consumed)) {
                    memcpy(args[argument], text, length);
                    args[argument][length] = 0;
                    return 1;
                }
            }
            goto failed;
        }
        if (!*text || !asciiEqual(*pattern++, *text++)) goto failed;
    }
    if (prefix || !*text) { if (consumed) *consumed = text-begin; return 1; }
failed:
    if (offset < LOCALE_BUFFER) failedMatches[depth][offset] = generation;
    return 0;
}

static int matchPattern(const char *pattern, const char *text, const char *kinds, const char *const *domains, char args[16][ARG_SIZE], int prefix, size_t *consumed) {
    const char *p=pattern, *t=text;
    int length;
    while (*p && placeholder(p,&length)<0) {
        if (!*t || !asciiEqual(*p++,*t++)) return 0;
    }
    if (!containsAnchors(pattern,text)) return 0;
    if (!++matchGeneration) { memset(failedMatches,0,sizeof failedMatches); matchGeneration = 1; }
    return matchTemplateInner(pattern,text,kinds,domains,args,0,text,matchGeneration,prefix,consumed);
}

static int matchTemplate(const char *pattern, const char *text, const char *kinds, const char *const *domains, char args[16][ARG_SIZE], int depth) {
    return matchPattern(pattern,text,kinds,domains,args,0,NULL);
}

static void translatePlain(char *output, size_t capacity, const char *text, int depth);

static void expandEntry(char *output, size_t capacity, const LocaleEntry *entry,
                        char args[16][ARG_SIZE], int depth) {
    size_t used=0;
    output[0]=0;
    for (const char *p=entry->translated; *p;) {
        int length, argument=placeholder(p,&length);
        if (argument>=0) {
            char translated[ARG_SIZE*3];
            char kind=argument<strlen(entry->kinds)?entry->kinds[argument]:'s';
            if (kind=='r'||kind=='g'||kind=='e'||((!strcmp(args[argument],"s")||!strcmp(args[argument],"n"))&&kind=='s')) translated[0]=0;
            else {
                char value[ARG_SIZE];copyText(value,sizeof value,args[argument]);
                size_t end=strlen(value),start=0;
                while(end&&value[end-1]==' ')value[--end]=0;
                while(value[start]==' ')start++;
                translatePlain(translated,sizeof translated,value+start,depth+1);
            }
            appendBytes(output,capacity,&used,translated,strlen(translated));
            p+=length;
        } else {
            size_t n=0; localeDecode(p,&n);
            appendBytes(output,capacity,&used,p,n); p+=n;
        }
    }
}

static int literalWeight(const char *pattern) {
    int weight=0,length;
    while (*pattern) {
        if (placeholder(pattern,&length)>=0) pattern+=length;
        else { if (isalpha((unsigned char)*pattern)) weight++; pattern++; }
    }
    return weight;
}

static int phonemeWord(char *output, size_t capacity, const char *word, size_t length) {
    char result[ARG_SIZE*3];
    size_t offset=0,used=0;
    result[0]=0;
    while (offset<length) {
        size_t best=0; const char *translated=NULL;
        for (size_t i=0;i<sizeof localePhonemes/sizeof *localePhonemes;i++) {
            size_t n=strlen(localePhonemes[i].source);
            if (n<=best||offset+n>length) continue;
            size_t j=0;
            while (j<n&&asciiEqual(word[offset+j],localePhonemes[i].source[j])) j++;
            if (j==n) {best=n;translated=localePhonemes[i].translated;}
        }
        if (!best) return 0;
        appendBytes(result,sizeof result,&used,translated,strlen(translated));
        offset+=best;
    }
    if (!length) return 0;
    copyText(output,capacity,result); return 1;
}

static void translateUncached(char *output, size_t capacity, const char *text, int depth) {
    char args[16][ARG_SIZE], bestArgs[16][ARG_SIZE];
    if (depth>16) {copyText(output,capacity,text);return;}
    int englishWord=0;
    for (size_t i=0;text[i]&&text[i+1];i++) {
        if ((unsigned char)text[i]<128&&(unsigned char)text[i+1]<128&&isalpha((unsigned char)text[i])&&isalpha((unsigned char)text[i+1])) {englishWord=1;break;}
    }
    if (!englishWord) {copyText(output,capacity,text);return;}

    /* Try exact source phrases and complete formatted messages. */
    for (size_t i=0;i<sizeof localeEntries/sizeof *localeEntries;i++) {
        const LocaleEntry *entry=&localeEntries[i];
        if (!matchTemplate(entry->source,text,entry->kinds,entry->domains,args,0)) continue;
        if ((!strcmp(entry->source,"the {0}")||!strcmp(entry->source,"a {0}")||!strcmp(entry->source,"an {0}"))&&!strcmp(entry->translated,"{0}")) {
            char probe[ARG_SIZE*3];translatePlain(probe,sizeof probe,args[0],depth+1);
            if (!strcmp(probe,args[0])) continue;
        }
        expandEntry(output,capacity,entry,args,depth);return;
    }

    /* Detail panels put a generated name on the first line, then paragraphs.
       Resolve that name as a complete expression, including runes and counts. */
    const char *newline=strchr(text,'\n');
    if(newline&&newline-text<256&&newline[1]=='\n'&&!memchr(text,'.',newline-text)) {
        char heading[256], translatedHeading[1024], body[LOCALE_BUFFER];
        memcpy(heading,text,newline-text);heading[newline-text]=0;
        translatePlain(translatedHeading,sizeof translatedHeading,heading,depth+1);
        translatePlain(body,sizeof body,newline+2,depth+1);
        size_t used=0;output[0]=0;
        appendBytes(output,capacity,&used,translatedHeading,strlen(translatedHeading));
        appendBytes(output,capacity,&used,"\n\n",2);
        appendBytes(output,capacity,&used,body,strlen(body));return;
    }

    /* A stream of source fragments: retain the longest literal/template prefix
       before advancing. This also retains complete multi-sentence flavor text
       when an origin note, combat math, or a runic clause follows it. */
    size_t used=0,offset=0;
    output[0]=0;
    while (text[offset]) {
        const LocaleEntry *best=NULL;
        size_t consumed=0;
        int score=-1;
        for (size_t i=0;i<sizeof localeEntries/sizeof *localeEntries;i++) {
            const LocaleEntry *entry=&localeEntries[i];
            if (entry->source[0]!='{'&&!asciiEqual(entry->source[0],text[offset])) continue;
            int weight=entry->weight;
            int formatted=strchr(entry->source,'{')!=NULL;
            if (formatted&&weight<8) continue;
            if (weight<score) continue;
            size_t n=0;
            if (formatted) {
                /* A trailing untyped string has no deterministic fragment end. */
                const char *tail=strrchr(entry->source,'{');int length;
                int argument=placeholder(tail,&length);
                if (argument>=0&&!tail[length]&&(argument>=strlen(entry->kinds)||entry->kinds[argument]=='s')) continue;
            }
            if (!matchPattern(entry->source,text+offset,entry->kinds,entry->domains,args,1,&n)||!n) continue;
            size_t sourceLength=strlen(entry->source);
            if (offset&&isalpha((unsigned char)text[offset-1])&&isalpha((unsigned char)entry->source[0])) continue;
            if (isalpha((unsigned char)entry->source[sourceLength-1])&&isalpha((unsigned char)text[offset+n])) continue;
            if (!formatted&&sourceLength==1&&offset&&strchr("([",text[offset-1])&&strchr(")]",text[offset+n])) continue;
            if (weight>score||n>consumed) {best=entry;score=weight;consumed=n;if(formatted)memcpy(bestArgs,args,sizeof args);}
        }
        if (best) {
            char translated[LOCALE_BUFFER];
            expandEntry(translated,sizeof translated,best,bestArgs,depth);
            appendBytes(output,capacity,&used,translated,strlen(translated));
            offset+=consumed;
        } else {
            size_t next=offset;localeDecode(text,&next);
            if ((unsigned char)text[offset]<128&&isalpha((unsigned char)text[offset])) {
                while ((unsigned char)text[next]<128&&isalpha((unsigned char)text[next])) next++;
                char title[ARG_SIZE*3];
                if (phonemeWord(title,sizeof title,text+offset,next-offset)) {
                    appendBytes(output,capacity,&used,title,strlen(title));offset=next;continue;
                }
            }
            appendBytes(output,capacity,&used,text+offset,next-offset);offset=next;
        }
    }
}

/* Repeated names and color anchors recur across every paragraph of a tooltip. */
static void translatePlain(char *output, size_t capacity, const char *text, int depth) {
    typedef struct TranslationCache { char source[4096], translated[4096]; int depth; } TranslationCache;
    static TranslationCache cache[256];
    uint32_t hash=2166136261u;
    size_t length=strlen(text);
    if (length>=sizeof cache[0].source||depth>10) {translateUncached(output,capacity,text,depth);return;}
    for(size_t i=0;i<length;i++)hash=(hash^(unsigned char)text[i])*16777619u;
    hash^=depth;
    TranslationCache *entry=cache+hash%256;
    if(entry->depth==depth&&!strcmp(entry->source,text)) {copyText(output,capacity,entry->translated);return;}
    char result[LOCALE_BUFFER];
    translateUncached(result,sizeof result,text,depth);
    if(strlen(result)<sizeof entry->translated) {
        copyText(entry->source,sizeof entry->source,text);
        copyText(entry->translated,sizeof entry->translated,result);
        entry->depth=depth;
    }
    copyText(output,capacity,result);
}

void localeDisplay(char *output, size_t capacity, const char *english) {
    char plain[LOCALE_BUFFER], translated[LOCALE_BUFFER];
    size_t index = 0, used = 0;
    if (!capacity) return;
    if (!japanese) { copyText(output, capacity, english); return; }
    /* Existing binary color escapes are recognized before UTF-8 decoding. */
    while (english[index] && used + 1 < sizeof plain) {
        if ((unsigned char)english[index] == TEXT_COLOR_ESCAPE && strlen(english + index) >= 4) index += 4;
        else plain[used++] = english[index++];
    }
    plain[used] = 0;
    size_t leading = 0;
    while (plain[leading] == ' ') leading++;
    size_t end = strlen(plain);
    while (end > leading && plain[end - 1] == ' ') end--;
    size_t trailing = strlen(plain) - end;
    plain[end] = 0;
    translatePlain(translated, sizeof translated, plain + leading, 0);
    if (!strcmp(translated, plain + leading)) { copyText(output, capacity, english); return; }
    if (leading >= 2 && trailing) {
        int padding = (int)(leading + trailing) + localeTextWidth(plain + leading) - localeTextWidth(translated);
        if (padding < 0) padding = 0;
        leading = padding / 2;
        trailing = padding - leading;
    }
    output[0] = 0;
    used = 0;
    /* Preserve colors attached to translated arguments and hotkey characters. */
    typedef struct ColorInsertion { size_t offset; char escape[4]; } ColorInsertion;
    ColorInsertion insertions[64];
    int insertionCount = 0;
    size_t lastAnchorEnd = 0;
    for (size_t scan = 0; english[scan] && insertionCount < 64;) {
        if ((unsigned char)english[scan] != TEXT_COLOR_ESCAPE || strlen(english + scan) < 4) { scan++; continue; }
        size_t runStart = scan + 4, runEnd = runStart;
        while (english[runEnd] && (unsigned char)english[runEnd] != TEXT_COLOR_ESCAPE) runEnd++;
        char run[ARG_SIZE], runTranslation[ARG_SIZE * 3];
        size_t length = runEnd - runStart;
        if (length >= sizeof run) { scan = runEnd; continue; }
        memcpy(run, english + runStart, length); run[length] = 0;
        size_t first = 0;
        while (run[first] == ' ') first++;
        while (length > first && run[length - 1] == ' ') run[--length] = 0;
        translatePlain(runTranslation, sizeof runTranslation, run + first, 0);
        char *anchor = *runTranslation ? strstr(translated, runTranslation) : NULL;
        size_t offset;
        if (anchor) {
            offset = anchor - translated;
            lastAnchorEnd = offset + strlen(runTranslation);
        } else if (lastAnchorEnd) {
            offset = lastAnchorEnd; lastAnchorEnd = 0;
        } else if (!scan) offset = 0;
        else {
            /* Help lines change to white after the translated key label. */
            char *colon = strchr(translated, ':');
            if (colon && runEnd == strlen(english)) offset = colon + 1 - translated;
            else { scan = runEnd; continue; }
        }
        insertions[insertionCount].offset = offset;
        memcpy(insertions[insertionCount++].escape, english + scan, 4);
        scan = runEnd;
    }
    for (int i = 1; i < insertionCount; i++) {
        ColorInsertion value = insertions[i];
        int j = i;
        while (j && insertions[j - 1].offset > value.offset) { insertions[j] = insertions[j - 1]; j--; }
        insertions[j] = value;
    }
    /* A leading message color also colors unanchored dynamic templates. */
    if ((unsigned char)english[0] == TEXT_COLOR_ESCAPE && strlen(english) >= 4)
        appendBytes(output, capacity, &used, english, 4);
    for (size_t i = 0; i < leading; i++) appendBytes(output, capacity, &used, " ", 1);
    int insertion = 0;
    for (size_t offset = 0; offset <= strlen(translated);) {
        while (insertion < insertionCount && insertions[insertion].offset == offset)
            appendBytes(output, capacity, &used, insertions[insertion++].escape, 4);
        if (!translated[offset]) break;
        size_t next = offset;
        localeDecode(translated, &next);
        if (used + next - offset >= capacity) break;
        appendBytes(output, capacity, &used, translated + offset, next - offset);
        offset = next;
    }
    for (size_t i = 0; i < trailing; i++) appendBytes(output, capacity, &used, " ", 1);
}

int localeWrap(char *output, size_t capacity, const char *text, int width) {
    size_t index = 0, used = 0;
    int column = 0, lines = 1;
    if (!capacity || width < 1) return 0;
    output[0] = 0;
    while (text[index]) {
        size_t begin = index;
        if ((unsigned char)text[index] == TEXT_COLOR_ESCAPE && strlen(text + index) >= 4) {
            index += 4;
            appendBytes(output, capacity, &used, text + begin, 4);
            continue;
        }
        uint32_t cp = localeDecode(text, &index);
        int cells = localeCodepointWidth(cp);
        if (cp == '\n') { column = 0; lines++; }
        else if (column + cells > width) {
            appendBytes(output, capacity, &used, "\n", 1);
            column = 0; lines++;
            if (cp == ' ') continue;
        }
        appendBytes(output, capacity, &used, text + begin, index - begin);
        column += cells;
    }
    return lines;
}

int localeRunTextTests(void) {
    char output[LOCALE_BUFFER], wrapped[LOCALE_BUFFER];
    int failures = 0;
    localeSetLanguage("ja");
    localeDisplay(output, sizeof output, "you found 10 pieces of gold.");
    failures += strcmp(output, "金貨を10枚見つけた。") != 0;
    localeDisplay(output, sizeof output, "You found 123 pieces of gold.");
    failures += strcmp(output, "金貨を123枚見つけた。") != 0;
    localeDisplay(output, sizeof output, "You are hungry. (x2)");
    failures += strcmp(output, "空腹になった。（2回）") != 0;
    localeDisplay(output, sizeof output, "You feel stronger");
    failures += strcmp(output, "力が増した。") != 0;
    failures += localeTextWidth("日本語ABC") != 9;
    failures += localeWrap(wrapped, sizeof wrapped, "日本語表示", 6) != 2;
    failures += strcmp(wrapped, "日本語\n表示") != 0;
    localeDisplay(output, sizeof output, "an untranslated message");
    failures += strcmp(output, "an untranslated message") != 0;
    localeDisplay(output, sizeof output, "     New Game     ");
    failures += localeTextWidth(output) != 18;
    char colored[] = {25, 120, 80, 40, 'y','o','u',' ', 'f','o','u','n','d',' ', '1','0',' ', 'p','i','e','c','e','s',' ', 'o','f',' ', 'g','o','l','d','.',0};
    localeDisplay(output, sizeof output, colored);
    failures += memcmp(output, colored, 4) != 0;
    failures += localeTextWidth(output) != localeTextWidth("金貨を10枚見つけた。");
    char tiny[7];
    localeDisplay(tiny, sizeof tiny, "You are hungry.");
    size_t offset = 0;
    while (tiny[offset]) failures += localeDecode(tiny, &offset) == 0xfffd;
    failures += offset >= sizeof tiny;
    offset = 0;
    failures += localeDecode("\xE3", &offset) != 0xfffd || offset != 1;
    offset = 0;
    failures += localeDecode("\xED\xA0\x80", &offset) != 0xfffd;
    localeSetLanguage("en");
    localeDisplay(output, sizeof output, "you found 10 pieces of gold.");
    failures += strcmp(output, "you found 10 pieces of gold.") != 0;
    fprintf(stderr, "Localization text checks: %s\n", failures ? "FAILED" : "passed");
    return failures != 0;
}
