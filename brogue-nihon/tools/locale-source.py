"""Shared source normalization for display dictionaries and their coverage audit."""
import re
import importlib.util
import sys
from functools import lru_cache
from pathlib import Path

DISPLAY_CATEGORIES = ("ui", "messages", "content", "help", "errors")
PROJECT_TITLE = "brogue-nihon"

def display_words(text):
    """The chosen project title is intentional Latin text, not an untranslated word."""
    text = re.sub(r'(?<![A-Za-z0-9_])' + re.escape(PROJECT_TITLE) + r'(?![A-Za-z0-9_-])', '', text)
    return re.findall(r'[A-Za-z]+', text)

FORMAT = re.compile(r"%(?:\d+\$)?[-+ #0']*(?:\d+|\*)?(?:\.(?:\d+|\*))?(?:hh|ll|[hljztL])?[diouxXfFeEgGaAcspn%]|\$(?:HIMSELFHERSELF|HISHER|HIMHER|HESHE)\b")

def normalize(text):
    arguments = []
    def argument(match):
        if match[0] == '%%':
            return '%'
        arguments.append(match[0])
        return '{' + str(len(arguments) - 1) + '}'
    return FORMAT.sub(argument, text).strip(), arguments

def display_pattern(entry):
    """Only parse printf directives in a format operand, never a literal '20% as'."""
    calls = entry['sources']
    printf = any((s.get('call') in ('sprintf', 'vsprintf') and s.get('argument_index') == 1)
                 or (s.get('call') in ('snprintf', 'vsnprintf') and s.get('argument_index') == 2)
                 or (s.get('call') in ('initializeMainMenuButton','setButtonText') and s.get('argument_index') == 1)
                 for s in calls)
    arguments = []
    old_arguments = []
    def convert(match):
        if match[0] == '%%':
            return '%' if printf else '%%'
        index = len(old_arguments)
        old_arguments.append(match[0])
        if match[0].startswith('%') and not printf:
            return match[0]
        arguments.append((index, match[0]))
        return '{' + str(len(arguments)-1) + '}'
    return FORMAT.sub(convert, entry['text']).replace('****', '').strip(), arguments

def argument_kinds(pattern, arguments):
    kinds = []
    suffixes = {'bear','hit','image','item','duplicate','appear','dangle','gleam','shatter','ignore','plunge','vomit','float','choke','gag','burn','charge','remain','turn','flask','contain','parchment','mango','potion','ration','ring','charm','scroll','staff','wand','piece'}
    for i, (_,fmt) in enumerate(arguments):
        kind = 'p' if fmt.startswith('$') else 'c' if fmt.endswith('c') else 'i' if fmt[-1:] in 'diouxX' else 'n' if fmt[-1:] in 'fFeEgGaA' else 's'
        match = re.search(r'\{' + str(i) + r'\}', pattern)
        if kind == 's' and match:
            before, after = pattern[:match.start()], pattern[match.end():]
            word = re.search(r'([A-Za-z]+)$',before)
            if word and word[1].lower() == 'a' and (not after or after.startswith(' ')): kind = 'g'
            elif word and word[1].lower() in suffixes: kind = 'r'
            elif before[-1:].isalpha() and after[:1].isalpha(): kind = 'e'
            elif re.search(r'\{\d+\}$',before):
                previous = int(re.search(r'\{(\d+)\}$',before)[1])
                if arguments[previous][1][-1:] in 'diouxXfFeEgGaA':
                    kind = 'r' if after.startswith(' floor') else 'e'
            elif re.match(r'\{\d+\}',after):
                following = int(re.match(r'\{(\d+)\}',after)[1])
                if arguments[following][1][-1:] in 'diouxXfFeEgGaA': kind = 'e'
        kinds.append(kind)
    return ''.join(kinds)

@lru_cache(None)
def source_calls(path):
    """Locate actual format operands and their following C arguments."""
    spec = importlib.util.spec_from_file_location('locale_extractor', Path(__file__).with_name('extract-text-catalogs.py'))
    lexer = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = lexer
    spec.loader.exec_module(lexer)
    source = path.read_text(encoding='utf8')
    tokens, _ = lexer.tokenize(source)
    calls = {}
    blocks = [0]
    for i, token in enumerate(tokens):
        if token.raw == '{': blocks.append(token.end)
        elif token.raw == '}' and len(blocks)>1: blocks.pop()
        if token.raw != '(' or not i or tokens[i-1].raw not in ('sprintf', 'snprintf', 'vsprintf', 'vsnprintf'):
            continue
        nesting = 0
        start = i+1
        args = []
        for j in range(i+1, len(tokens)):
            raw = tokens[j].raw
            if raw == ')' and not nesting:
                args.append(tokens[start:j]); break
            if raw == ',' and not nesting:
                args.append(tokens[start:j]); start = j+1; continue
            if raw in ('(', '[', '{'): nesting += 1
            if raw in (')', ']', '}'): nesting -= 1
        position = 2 if tokens[i-1].raw in ('snprintf', 'vsnprintf') else 1
        if len(args) <= position: continue
        fmt = args[position]
        if not fmt or not any(t.kind == 'string' for t in fmt): continue
        formats = []
        previous = None
        for t in fmt:
            if t.kind == 'string':
                if previous and previous.kind == 'string': formats[-1] += lexer.decode_literal(t.raw)
                else: formats.append(lexer.decode_literal(t.raw))
            previous = t
        values = []
        for arg in args[position+1:]:
            expr = source[arg[0].start:arg[-1].end] if arg else ''
            strings = [lexer.decode_literal(t.raw) for t in arg if t.kind == 'string']
            pronouns = {'$HESHE':['he','she','it'], '$HIMHER':['him','her','it'], '$HISHER':['his','her','its'], '$HIMSELFHERSELF':['himself','herself','itself']}
            for token, replacements in pronouns.items():
                strings = [s.replace(token,p) for s in strings for p in (replacements if token in s else [''])]
            identifiers = [t.raw for t in arg if t.kind == 'identifier']
            color = bool(re.search(r'escape|colorcode', expr, re.I)) and all(not s for s in strings)
            # Literal alternatives constrain adjacent %s operands without guessing boundaries.
            domain = strings if strings and (all(t.kind in ('string','punct','number','identifier') for t in arg)) else []
            if strings and any(t.raw in ('sprintf','strcat','strcpy') for t in arg): domain = []
            if not any(t.raw == '?' for t in arg) and not all(t.kind == 'string' for t in arg): domain = []
            if expr.strip() == 'preposition':
                preceding = source[blocks[-1]:tokens[i].start]
                domain = [lexer.decode_literal(m[1]) for m in re.finditer(r'strcpy\(preposition,\s*("(?:\\.|[^"\\])*")\)',preceding)]
            name = bool(re.fullmatch(r'(?:theName|[A-Za-z_]*(?:[nN]ame|[nN]ameString)|root|runicName)',expr.strip()) or re.search(r'(?:\.|->)(?:name|monsterName)$',expr.strip()))
            suffix = expr.strip() == 'pluralization'
            values.append((color, domain, name, suffix))
        for text in formats: calls[text] = values
    return calls

def runtime_arguments(entry, pattern, arguments):
    """Infer colors and finite grammar choices from the actual printf arguments."""
    kinds = list(argument_kinds(pattern, arguments))
    domains = [''] * len(kinds)
    root = Path(__file__).resolve().parents[1]
    for origin in entry.get('sources', []):
        if origin.get('call') in ('initializeMainMenuButton','setButtonText') and origin.get('argument_index') == 1:
            return ''.join('e' if fmt.endswith('s') else kinds[i] for i,(_,fmt) in enumerate(arguments)),domains
        values = source_calls(root / origin['file']).get(entry.get('source',entry.get('text','')))
        if values is None: continue
        for index, (old_index, fmt) in enumerate(arguments):
            if fmt.startswith('$') or old_index >= len(values): continue
            color, domain, name, suffix = values[old_index]
            if fmt.endswith('s') and color:
                kinds[index] = 'e'
            elif fmt.endswith('s') and domain:
                if all(not s.strip() for s in domain):
                    kinds[index] = 'e'
                    continue
                domains[index] = '\x1f'.join(domain)
                if all(s in ('','s','es','ies','st','nd','rd','th',"'s","s'") for s in domain):
                    kinds[index] = 'r'
                if kinds[index] in 'egr' and any(s not in ('','n','s','es','ies','st','nd','rd','th',"'s","s'") for s in domain):
                    kinds[index] = 's'
            elif fmt.endswith('s') and name:
                kinds[index] = 'k'
            elif fmt.endswith('s') and suffix:
                kinds[index] = 'r'
                domains[index] = '\x1fs'
        break
    return ''.join(kinds), domains
