import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {reconstructInterface} from '../migration/interface-data/native-parity.mjs';
import {reconstructTextInput} from '../migration/text-input/native-parity.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const current=read('logic/ui-input.c');
const baseline=read('tests/accepted-source-snapshot/ui-input.c');
const rust=read('rust/src/application_text.rs');
const helper=current.match(/#ifdef __EMSCRIPTEN__ \/\* AB_TEXT_PURE \*\/[\s\S]*?#endif \/\* AB_TEXT_PURE \*\//)[0];
const oldUI=/#ifdef __EMSCRIPTEN__ \/\* AB_UI_PURE \*\/[\s\S]*?#endif \/\* AB_UI_PURE \*\/(?:\r\n|\n)?/g;
const stripGame=source=>source.replace(/\/\* AB_REPLAY_BEGIN \*\/[\s\S]*?\/\* AB_REPLAY_END \*\//g,'').replace(/\/\* AB_GAME_DYNAMIC_BEGIN \*\/[\s\S]*?\/\* AB_GAME_DYNAMIC_END \*\//g,'').replace(/\/\* AB_GAME_STATIC_BEGIN \*\/[\s\S]*?\/\* AB_GAME_STATIC_END \*\//g,'');

test('default editor native branch reconstructs the original accepted bytes',()=>{
 assert.equal(stripGame(reconstructInterface(reconstructTextInput(current))).replace(oldUI,''),baseline);
 assert.equal(current.includes('\0'),false,'source contains no accidental NUL bytes');
 const native=reconstructTextInput(current);
 assert.match(native,/oshift = utf8_fskip\(buf \+ \*curs, 1, NULL\);/,'unsafe native DELETE is preserved only in native source');
 assert.match(current,/return ab_web_text_keypress\(buf, buflen, curs, len, keypress, firsttime\);/);
});

test('Rust uses actual native key constants and source printability rather than broad Unicode heuristics',()=>{
 const keys=read('logic/ui-event.h');
 for(const name of ['ESCAPE','KC_ENTER','ARROW_LEFT','ARROW_RIGHT','KC_DELETE','KC_BACKSPACE']){
  const sourceCode=Number(keys.match(new RegExp('#define\\s+'+name+'\\s+(0x[0-9a-f]+)','i'))[1]);
  const rustCode=Number(rust.match(new RegExp('pub const '+name+': u32 = (0x[0-9a-f]+);','i'))[1]);
  assert.equal(rustCode,sourceCode,name);
 }
 assert.match(read('logic/ui-event.c'),/return kc != ESCAPE && utf32_isprint\(kc\);/);
 assert.match(read('logic/z-util.c'),/case 14:[\s\S]*?return false;/);
 assert.match(rust,/\(4\.\.=14\)\.contains\(&plane\)/);
 assert.match(rust,/\(0xfe00\.\.=0xfe0f\)\.contains\(&code\)/);
 assert.doesNotMatch(rust,/\.is_control\(/);
 assert.doesNotMatch(helper,/keycode_isprint\(|utf32_to_utf8\(|memmove\(/,'policy moved out of the C adapter');
});

test('one bounded immutable capture produces a fully checked transactional effect and original bell',()=>{
 assert.equal((helper.match(/status = ab_rs_text_edit\(/g)??[]).length,1);
 assert.match(helper,/memchr\(buf, '\\0', buflen\) != buf \+ \*len/);
 assert.match(helper,/output = malloc\(buflen\);/);
 assert.match(helper,/effect\[0\] != 1U/);
 assert.match(helper,/effect\[5\] \|\| effect\[6\] \|\| effect\[7\]/);
 assert.match(helper,/memchr\(output, '\\0', output_length\)/);
 assert.ok(helper.indexOf('status != 0')<helper.indexOf('memcpy(buf, output'));
 assert.ok(helper.indexOf('!= changed')<helper.indexOf('memcpy(buf, output'));
 assert.match(helper,/if \(effect\[4\] & 2U\) bell\(\);/);
 assert.doesNotMatch(helper,/askfor_aux_keypress\(/,'no invalid-capture fallback or duplicate key dispatch');
 assert.doesNotMatch(helper,/\b(?:randint\w*|Rand\w*|one_in_|player_random_name|file_open)\s*\(/);
 assert.doesNotMatch(rust.split('// AB_TEXT_FFI_BOUNDARY:')[0].replace(/\/\/[^\n]*/g,''),/\b(?:unsafe|extern|thread_local|RefCell|randint|random)\b/);
});

test('FFI validates ranges, alignment, disjoint outputs and flags before every transactional write',()=>{
 assert.match(rust,/start\.checked_add\(length\)/);
 assert.match(rust,/core::arch::wasm32::memory_size\(0\)/);
 assert.match(rust,/std::mem::align_of::<u32>\(\)/);
 assert.match(rust,/spans_overlap\(&input_range, &output_range\)/);
 assert.match(rust,/spans_overlap\(&input_range, &effect_range\)/);
 assert.match(rust,/spans_overlap\(&output_range, &effect_range\)/);
 assert.match(rust,/first_time > 1/);
 const ffi=rust.slice(rust.indexOf('pub unsafe extern "C" fn ab_rs_text_edit('),rust.indexOf('pub unsafe extern "C" fn ab_rs_text_truncate('));
 assert.ok(ffi.indexOf('let words = edited.effect_words()?')<ffi.indexOf('std::ptr::copy_nonoverlapping'));
 assert.ok(ffi.indexOf('let original = std::str::from_utf8')<ffi.indexOf('std::ptr::copy_nonoverlapping'));
 for(const fixture of ['ffi_unicode_edit_writes_owned_output_once_with_effect_and_canary_guards',
  'ffi_invalid_null_flags_alignment_alias_and_utf8_leave_both_outputs_unchanged',
  'ffi_truncate_empty_partial_complete_and_invalid_prefix_are_transactional']) assert.ok(rust.includes('fn '+fixture+'('));
});

test('help delegates every key once to the shared editor and preserves opaque draft capture',()=>{
 const help=read('logic/web-help-text.c');
 const keyHandler=help.slice(help.indexOf('static bool help_keypress('),help.indexOf('bool ab_help_askfor('));
 assert.equal((keyHandler.match(/askfor_aux_keypress\(/g)??[]).length,1);
 assert.doesNotMatch(keyHandler,/KC_DELETE|utf8_fskip|memmove|ab_rs_text_edit/);
 assert.match(keyHandler,/ab_ui_input\("query", buffer, "verbatim_user_text"\)/);
});

test('Rust fixtures exercise firsttime controls, Unicode boundaries, byte capacity and literal modifiers',()=>{
 for(const fixture of ['first_time_controls_accept_cancel_move_clear_or_replace_exactly',
  'every_unicode_delete_and_backspace_cursor_preserves_valid_text_and_bounds',
  'insertion_capacity_counts_utf8_bytes_and_first_time_replacement_is_not_rolled_back',
  'literal_modifier_and_unicode_printability_policy_match_pinned_source',
  'invalid_captures_return_errors_and_valid_effect_words_are_bounded',
  'default_truncation_preserves_ascii_and_never_splits_cjk_or_supplementary_scalars',
  'native_ascii_byte_editor_matches_every_key_at_every_cursor_and_capacity_boundary']) assert.ok(rust.includes('fn '+fixture+'('));
 assert.match(rust,/"A罠😀𠀀Z"/);
 assert.match(rust,/modifiers in \[0, 1, 2, 4, 8, 16, 255\]/);
 assert.match(rust,/\[1, 1, 3, 1, DONE, 0, 0, 0\]/);
});

test('both default initializers use a bounded scalar-safe prefix before the original key loops',()=>{
 assert.equal((current.match(/if \(!ab_web_text_initialize\(buf, len\)\) return false;/g)??[]).length,2);
 assert.match(helper,/first_null = memchr\(buf, 0, capacity - 1\);/);
 assert.match(helper,/terminator > prefix_length \|\| terminator >= capacity/);
 assert.ok(helper.indexOf('status != 0')<helper.indexOf('buf[terminator] = 0;'));
 assert.match(rust,/Err\(error\) if error\.error_len\(\)\.is_none\(\) => Ok\(error\.valid_up_to\(\)\)/);
 assert.match(rust,/Err\(_\) => Err\(TextInputError::InvalidBuffer\)/);
 const native=reconstructTextInput(current);
 assert.equal((native.match(/buf\[len-1\] = '\\0';/g)??[]).length,2);
});
