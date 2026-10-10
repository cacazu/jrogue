"""Apply reviewed source-origin observers to the exact official DCSS source.

Default/--check is a read-only dry run. --apply changes only recognized work-copy
message.cc. Never edits pristine upstream, headers, gameplay rules, or Git.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
BASE_SHA256 = '63d0aa5d84e3f82301fb948d0f4e4c80bc113971aa273ade7ae539c8844a4784'
BEGIN = '// BEGIN jrogue semantic-canned adapter v1\n'
END = '// END jrogue semantic-canned adapter v1\n'

def digest(data):
    return hashlib.sha256(data).hexdigest()

def normalized(data):
    return data.decode('utf-8').replace('\r\n', '\n')

def replace_once(text, before, after):
    if text.count(before) != 1:
        raise ValueError('Expected one pinned source anchor: ' + before[:100])
    return text.replace(before, after, 1)

def canned_region(text):
    first = text.index('void canned_msg(canned_message_type which_message)\n')
    last = text.index('// Note that this function *completely* blocks messaging', first)
    return first, last, text[first:last]

def patch_canned(region):
    original = region
    # Bind the original feet predicate once, at the same originating print site.
    feet = ('        case MSG_SOMETHING_APPEARS:\n'
            '            mprf("Something appears %s!",\n'
            '                 player_has_feet() ? "at your feet" : "before you");\n'
            '            break;\n')
    bound_feet = (
        '        case MSG_SOMETHING_APPEARS:\n        {\n'
        '            const bool _dcss_canned_at_feet = player_has_feet();\n'
        '            mprf("Something appears %s!",\n'
        '                 _dcss_canned_at_feet ? "at your feet" : "before you");\n'
        '            break;\n        }\n')
    region = replace_once(region, feet, bound_feet)
    ids = set()
    print_sites = 0
    pattern = re.compile(r'(?m)^(?P<indent> +)(?P<call>mpr(?:f|_nojoin)?\([\s\S]*?\);)')
    def wrap(match):
        nonlocal print_sites
        print_sites += 1
        call, indent = match['call'], match['indent']
        cases = re.findall(r'case (MSG_[A-Z_]+):', region[:match.start()])
        enum = cases[-1]
        if enum == 'MSG_SOMETHING_APPEARS':
            choices = ['game.canned.something_appears.at_feet',
                       'game.canned.something_appears.before_you']
            selector = '_dcss_canned_at_feet'
        elif enum in ('MSG_EMPTY_HANDED_ALREADY', 'MSG_EMPTY_HANDED_NOW'):
            endings = {'Your mouth': 'mouth', 'empty-clawed': 'claws',
                       'empty-tentacled': 'tentacles', 'empty-handed': 'hands'}
            suffix = next((value for token,value in endings.items() if token in call), None)
            if suffix is None:
                raise ValueError('Unknown pinned empty-handed print branch')
            choices = ['game.canned.empty_handed_already.' + suffix,
                       'game.canned.empty_handed_now.' + suffix]
            selector = 'which_message == MSG_EMPTY_HANDED_ALREADY'
        elif enum == 'MSG_MAGIC_DRAIN':
            drain_sites = {
                'mpr("You feel momentarily drained.");': 'hp_casting',
                'mprf(MSGCH_WARN, "You suddenly feel drained of magical energy!");':
                    'magic_energy',
            }
            if call not in drain_sites:
                raise ValueError('Unknown pinned magic-drain print branch')
            choices = ['game.canned.magic_drain.' + drain_sites[call]]
        else:
            choices = ['game.canned.' + enum.removeprefix('MSG_').lower()]
        ids.update(choices)
        expression = ('"' + choices[0] + '"') if len(choices) == 1 else (
            selector + ' ? "' + choices[0] + '" : "' + choices[1] + '"')
        # Braces are mandatory for the original unbraced if/else print branches.
        lines = call.splitlines()
        shifted = '\n'.join(indent + '    ' + line[len(indent):]
                            if line.startswith(indent) else indent + '    ' + line
                            for line in lines)
        return (indent + '_dcss_canned_print(' + expression + ', [&]() {\n' +
                shifted + '\n' + indent + '});')
    patched = pattern.sub(wrap, region)
    if print_sites != 40 or len(ids) != 45:
        raise ValueError(f'Unexpected canned coverage: {print_sites} sites/{len(ids)} IDs')
    if re.findall(r'case MSG_[A-Z_]+:', patched) != re.findall(r'case MSG_[A-Z_]+:', region):
        raise ValueError('Canned enum/control ordering changed')
    # Invert only generated observers and the single predicate binding. Requiring
    # exact recovery proves all canonical calls, predicates and side effects are
    # retained, including their indentation and branch/statement ordering.
    wrappers = re.compile(
        r'(?m)^(?P<indent> +)_dcss_canned_print([^\n]+), \[&\]\(\) \{\n'
        r'(?P<body>[\s\S]*?)\n(?P=indent)\}\);')
    def unwrap(match):
        lines = match['body'].splitlines()
        if any(not line.startswith('    ') for line in lines):
            raise ValueError('Generated print wrapper indentation changed')
        return '\n'.join(line[4:] for line in lines)
    recovered, removed = wrappers.subn(unwrap, patched)
    if removed != print_sites:
        raise ValueError('Generated print wrappers cannot be inverted exactly')
    recovered = replace_once(recovered, bound_feet, feet)
    if recovered != original:
        raise ValueError('Canonical canned calls/predicates/control ordering changed')
    return patched, sorted(ids)

def render(pristine, adapter):
    insertion = (BEGIN + '// adapter-sha256: ' + digest(adapter.encode()) + '\n' +
                 adapter + END + '\n')
    anchor = 'static void _mpr(string text, msg_channel_type channel=MSGCH_PLAIN, int param=0,\n'
    patched = replace_once(pristine, anchor, insertion + anchor)
    patched = replace_once(patched,
        '    static bool _doing_c_message_hook = false;\n',
        '    static bool _doing_c_message_hook = false;\n'
        '    const char *_dcss_canned_id = _dcss_canned_take_pending();\n')
    patched = replace_once(patched,
        '    if (you.duration[DUR_QUAD_DAMAGE])\n        fs.all_caps();',
        '    const bool _dcss_canned_shout = you.duration[DUR_QUAD_DAMAGE] != 0;\n'
        '    if (_dcss_canned_shout)\n        fs.all_caps();')
    patched = replace_once(patched,
        '    buffer.add(msg);\n\n    if (!crawl_state.io_inited)\n',
        '    buffer.add(msg);\n'
        '    _dcss_canned_accepted(_dcss_canned_id, msg.turn,\n'
        '                           static_cast<int>(msg.channel), msg.param,\n'
        '                           colour_msg(colour) & 15, msg.join, nojoin,\n'
        '                           domore, do_flash_screen, _dcss_canned_shout);\n'
        '\n    if (!crawl_state.io_inited)\n')
    first, last, region = canned_region(patched)
    region, ids = patch_canned(region)
    patched = patched[:first] + region + patched[last:]
    return patched, ids

def verify_source_map(pristine, ids):
    path = ROOT / 'locales/gameplay/canned-source-map.json'
    data = path.read_bytes()
    source_map = json.loads(data)
    records = source_map['records']
    if (source_map['release'] != '0.34.1' or
        source_map['commit'] != '1eebc1a2892e1c89776a0d7a10691f8dac8d9796' or
        source_map['source'] != 'canned-v1' or
        sorted(record['id'] for record in records) != ids):
        raise ValueError('Canned catalog source map does not match generated IDs/version')
    channels = {'MSGCH_PLAIN': 0, 'MSGCH_PROMPT': 2, 'MSGCH_WARN': 6,
                'MSGCH_EXAMINE_FILTER': 24}
    for record in records:
        call = record['emitter']['source_call']
        if call + ';' not in pristine or record['parameters'] != {}:
            raise ValueError('Canned catalog canonical source call/parameters mismatch')
        channel_match = re.match(r'mpr(?:f|_nojoin)?\((MSGCH_[A-Z_]+),', call)
        channel = channel_match[1] if channel_match else 'MSGCH_PLAIN'
        if (record['channel'] != channel or record['channel_value'] != channels[channel] or
            record['nojoin'] != call.startswith('mpr_nojoin(') or
            record['original_control']['param'] != 0):
            raise ValueError('Canned catalog original channel/control tuple mismatch')
    return digest(data)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    if args.check and args.apply:
        parser.error('--check and --apply are mutually exclusive')
    upstream = ROOT / 'upstream/crawl-ref/source/message.cc'
    target = ROOT / 'engine/work/crawl-ref/source/message.cc'
    include = ROOT / 'engine/semantic-canned.inc'
    base_bytes = upstream.read_bytes()
    if digest(base_bytes) != BASE_SHA256:
        raise ValueError('Pristine message.cc does not match reviewed DCSS 0.34.1 checkout bytes')
    pristine = normalized(base_bytes)
    adapter = normalized(include.read_bytes()).rstrip('\n') + '\n'
    generated, ids = render(pristine, adapter)
    source_map_hash = verify_source_map(pristine, ids)
    newline = '\r\n' if b'\r\n' in base_bytes else '\n'
    expected = generated.replace('\n', newline).encode()
    current = target.read_bytes()
    recognized = 'pristine' if current == base_bytes else 'current-patch' if current == expected else None
    if recognized is None:
        old = re.search(re.escape(BEGIN) + r'// adapter-sha256: ([0-9a-f]{64})\n([\s\S]*?)' +
                        re.escape(END), normalized(current))
        if old and digest(old[2].encode()) == old[1]:
            prior, _ = render(pristine, old[2])
            if current == prior.replace('\n', newline).encode():
                recognized = 'recognized-prior-patch'
    if recognized is None:
        raise ValueError('Refusing to overwrite unrecognized work message.cc changes')
    changed = current != expected
    if args.apply and changed:
        target.write_bytes(expected)
    report = {'upstream_version': '0.34.1',
              'upstream_commit': '1eebc1a2892e1c89776a0d7a10691f8dac8d9796',
              'pristine_sha256': BASE_SHA256, 'adapter_sha256': digest(adapter.encode()),
              'generated_message_sha256': digest(expected), 'recognized_work': recognized,
              'would_change': changed, 'applied': bool(args.apply and changed),
              'canonical_print_sites': 40, 'canned_enums': 37, 'semantic_ids': ids,
              'canonical_region_inverse_verified': True,
              'source_map_sha256': source_map_hash,
              'source_map_verified': True,
              'modified_source_units': ['message.cc'], 'modified_headers': []}
    print(json.dumps(report, indent=2))

if __name__ == '__main__':
    main()
