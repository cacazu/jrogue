const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert');
const root = path.resolve('semantic-display-live-slice');
const own = path.join(root, 'key-scope');
const staged = path.join(root, 'build/sources/src');
const upstream = 'C:/Users/kit/gameme/jnethack/jrouge/cataclysm-dda/upstream/Cataclysm-DDA-7b2efa5cea38e4d4d97dd0e63b28b9148623da59';
const commit = '7b2efa5cea38e4d4d97dd0e63b28b9148623da59';
const sha = x => crypto.createHash('sha256').update(x).digest('hex');
const norm = x => x.replace(/\r\n/g, '\n');
const read = p => norm(fs.readFileSync(p, 'utf8'));
const sourceRows = [];
function definition(file, marker) {
  const exactMarker = '\n' + marker;
  const stagedText = read(path.join(staged, file));
  const pristineText = read(path.join(upstream, 'src', file));
  function extract(text) {
    const begin = text.indexOf(exactMarker);
    assert(begin >= 0, file + ': missing ' + marker);
    assert.strictEqual(begin, text.lastIndexOf(exactMarker), file + ': ambiguous ' + marker);
    const open = text.indexOf('\n{', begin);
    assert(open > begin);
    const close = text.indexOf('\n}', open);
    assert(close > open);
    return { text: text.slice(begin + 1, close + 2) + '\n', line: text.slice(0, begin + 1).split('\n').length };
  }
  const a = extract(stagedText), b = extract(pristineText);
  assert.strictEqual(a.text, b.text, file + ': selected original definition changed');
  sourceRows.push({ file, marker, pristineStartLine: b.line, bytes: Buffer.byteLength(a.text), sha256: sha(a.text), stagedSha256: sha(fs.readFileSync(path.join(staged, file))), pristineSha256: sha(fs.readFileSync(path.join(upstream, 'src', file))) });
  return a.text;
}
const baseSupport = read(path.join(root, 'fixtures/generated-original-support.cpp'));
assert.strictEqual(sha(fs.readFileSync(path.join(root, 'fixtures/generated-original-support.cpp'))), '9e64ede969a0c7cd2999906142a8ae40e1a1f84517e58a76596b3fadca4bbd49');
const selected = [
  definition('action.cpp', 'void load_keyboard_settings('),
  definition('action.cpp', 'void parse_keymap('),
  definition('action.cpp', 'std::string action_ident('),
  definition('action.cpp', 'action_id look_up_action('),
  definition('game.cpp', 'input_context get_default_mode_input_context()'),
  definition('rng.cpp', 'int djb2_hash('),
  definition('sdltiles.cpp', 'void input_manager::set_timeout(')
];
const nativeSDL = read(path.join(staged, 'sdltiles.cpp'));
const pristineSDL = read(path.join(upstream, 'src/sdltiles.cpp'));
const delayMatches = nativeSDL.match(/^static int inputdelay[^\n]*;/gm);
assert(delayMatches && delayMatches.length === 1, 'single native SDL timeout initializer');
assert(pristineSDL.includes(delayMatches[0]));
sourceRows.push({ file: 'sdltiles.cpp', marker: 'static inputdelay initializer', bytes: Buffer.byteLength(delayMatches[0] + '\n'), sha256: sha(delayMatches[0] + '\n'), declaration: delayMatches[0] });
const support = [
  '// Fixture-only selected original support, not complete original translation units.',
  '// CC BY-SA 3.0; pinned upstream 0.I-1. Unexpected diagnostic leaves still abort.',
  '#include "../fixtures/generated-original-support.cpp"',
  '#include "action.h"',
  '#include "input_context.h"',
  '#include "filesystem.h"',
  '#include "path_info.h"',
  '#include <istream>',
  '#include <map>',
  '#include <set>',
  '#include <string>',
  'static void parse_keymap( std::istream &, std::map<char, action_id> &, std::set<action_id> & );',
  delayMatches[0],
  '',
  selected.join('\n'),
  '',
  '// Explicit fixture platform capability: this Node/MEMFS harness has no gamepad.',
  '// This does not execute native SDL gamepad enumeration or a browser input adapter.',
  'bool gamepad_available() { return false; }',
  ''
].join('\n');
const originalBindingsBytes = fs.readFileSync(path.join(upstream, 'data/raw/keybindings.json'));
const originalBindings = JSON.parse(originalBindingsBytes.toString('utf8'));
const helpBytes = fs.readFileSync(path.join(upstream, 'data/core/help.json'));
const helpData = JSON.parse(helpBytes.toString('utf8'));
const movement = helpData.find(x => x.type === 'help' && x.name === 'Movement');
assert(movement && movement.messages.length === 6, 'actual original Movement topic');
const jsondirBody = definition('path_info.cpp', 'cata_path PATH_INFO::jsondir()');
const coreLoadBody = definition('game.cpp', 'void game::load_core_data()');
sourceRows.slice(-2).forEach(row => { row.role = 'source_identity_proof_only_not_compiled_support'; });
assert(jsondirBody.includes('return datadir_path_value / "core";'));
assert(coreLoadBody.includes('load_data_from_dir( PATH_INFO::jsondir(), "core" );'));
const reviewed = read(path.join(staged, 'reviewed_definitions.inc'));
const messagesMatch = reviewed.match(/reviewed_movement_messages[\s\S]*?=\s*\{\{?([\s\S]*?)\}\}?\s*;/);
assert(messagesMatch, 'reviewed Movement messages array');
const messageTokens = messagesMatch[1].match(/"(?:\\.|[^"\\])*"/g) || [];
const reviewedMessages = messageTokens.map(token => JSON.parse(token));
assert.deepStrictEqual(reviewedMessages, movement.messages, 'all six binder strings equal actual official resource');
const binder = read(path.join(staged, 'cdda_help_semantic.cpp'));
assert(binder.includes('file == PATH_INFO::jsondir() / "help.json"'));
const init = read(path.join(upstream, 'src/init.cpp'));
assert(init.includes('add( "help", &help::load );'));
const pathProof = { schemaVersion:1, status:'pure_actual_source_path_and_six_strings_verified', upstreamCommit:commit, actualResource:'data/core/help.json', bytes:helpBytes.length, sha256:sha(helpBytes), jsondirDefinition:sourceRows[sourceRows.length-2], loadCoreDefinition:sourceRows[sourceRows.length-1], initRegistration:{file:'src/init.cpp',sha256:sha(fs.readFileSync(path.join(upstream,'src/init.cpp'))),expression:'add( "help", &help::load );'}, binderExpression:'file == PATH_INFO::jsondir() / "help.json"', frozenBinderSha256:sha(fs.readFileSync(path.join(staged,'cdda_help_semantic.cpp'))), reviewedDefinitionsSha256:sha(fs.readFileSync(path.join(staged,'reviewed_definitions.inc'))), exactOriginalMovementMessages:6, frozenBinderCorrectionRequired:false, generatorPhysicalPathCorrection:'data/json/help.json -> data/core/help.json only in fresh generator', actualProducerExecuted:false };
const binding = key => ({ input_method: 'keyboard_code', key });
const testAction = (id, bindings, category = 'default', name) => {
  const result = { id, category, version: 2, bindings };
  if (name !== undefined) result.name = name;
  return result;
};
const fixtureCategory = 'SEMANTIC_KEYS_FIXTURE';
const preferences = [
  testAction('TEST_ONE', [binding('a')]),
  testAction('TEST_TWO', [binding('a'), binding('b')]),
  testAction('TEST_THREE', [binding('a'), binding('b'), binding('c')]),
  testAction('TEST_OVERRIDE', [binding('g')]),
  testAction('TEST_OVERRIDE', [binding('x')], fixtureCategory),
  testAction('TEST_LOCAL_EMPTY', [], fixtureCategory),
  testAction('TEST_LOCAL_UNDER', [binding('g')]),
  testAction('TEST_LOCAL_UNDER', [], fixtureCategory),
  testAction('TEST_DISABLED_CHAR', [{ input_method: 'keyboard_char', key: 'a' }]),
  testAction('TEST_LITERAL', [binding('u')], fixtureCategory, 'プレイヤーAlice')
];
function raw(value, tag) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  assert(!text.includes(')' + tag + '"'));
  return 'R"' + tag + '(' + text + ')' + tag + '"';
}
assert(read(path.join(staged, 'cata_path.h')).includes('get_unrelative_path'));
const fixture = [
  '// Real original key-name/get_desc/help-scope fixture SOURCE ONLY; not compiled or run.',
  '// Original C++ producers remain authoritative. No translation matcher or key-name table replacement.',
  '#include "input.h"',
  '#include "input_context.h"',
  '#include "input_enums.h"',
  '#include "cached_options.h"',
  '#include "game.h"',
  '#include "help.h"',
  '#include "cdda_help_semantic.h"',
  '#include "cdda_help_transport.h"',
  '#include "json_loader.h"',
  '#include "flexbuffer_json.h"',
  '#include "json.h"',
  '#include "path_info.h"',
  '#include <filesystem>',
  '#include <fstream>',
  '#include <stdexcept>',
  '#include <string>',
  '',
  'bool test_mode = false;',
  'namespace {',
  'void store( const std::filesystem::path &file, const char *bytes ) {',
  '    std::filesystem::create_directories( file.parent_path() );',
  '    std::ofstream out( file, std::ios::binary | std::ios::trunc );',
  '    if( !out ) { throw std::runtime_error( "fixture MEMFS open failed" ); }',
  '    out << bytes;',
  '    if( !out ) { throw std::runtime_error( "fixture MEMFS write failed" ); }',
  '}',
  'std::string copy_pin( uint32_t pin ) {',
  '    const size_t size = cdda_help_snapshot_size( pin );',
  '    const uint8_t *data = cdda_help_snapshot_data( pin );',
  '    if( data == nullptr || size == 0 ) { throw std::runtime_error( "fixture pin missing" ); }',
  '    return std::string( reinterpret_cast<const char *>( data ), size );',
  '}',
  '}',
  '',
  'extern "C" int cdda_original_key_help_fixture_run() {',
  '    int checks = 0;',
  '    const auto check = [&]( bool value ) {',
  '        if( !value ) { throw std::runtime_error( "original key/help assertion" ); }',
  '        ++checks;',
  '    };',
  '    PATH_INFO::init_base_path( "" );',
  '    PATH_INFO::init_user_dir( "/tmp/cdda-original-key-help-fixture" );',
  '    PATH_INFO::set_standard_filenames();',
  '    Json::globally_report_unvisited_members( false );',
  '    inp_mngr = input_manager();',
  '    keycode_mode = true; // Explicit fixture capability; no physical browser key delivery claim.',
  '    store( PATH_INFO::keybindings().get_unrelative_path(), ' + raw(originalBindingsBytes.toString('utf8'), 'cdda_native_keys') + ' );',
  '    store( PATH_INFO::keybindings_vehicle().get_unrelative_path(), "[]" );',
  '    store( PATH_INFO::user_keybindings().get_unrelative_path(), ' + raw(preferences, 'cdda_test_prefs') + ' );',
  '    store( std::filesystem::path( PATH_INFO::keymap() ), "" );',
  '    inp_mngr.init(); // REAL load_keyboard_settings, init_keycode_mapping, reset_timeout and JSON load.',
  '    check( inp_mngr.get_keyname( \'a\', input_event_t::keyboard_char, true ) == "a" );',
  '    check( inp_mngr.get_keyname( \'~\', input_event_t::keyboard_char, false ) == "~" );',
  '    check( inp_mngr.get_keyname( \'~\', input_event_t::keyboard_code, true ) == "~" );',
  '    check( inp_mngr.get_keyname( inp_mngr.get_keycode( input_event_t::keyboard_code, "UP" ), input_event_t::keyboard_code, false ) == "UP" );',
  '    check( inp_mngr.get_keyname( inp_mngr.get_keycode( input_event_t::keyboard_char, "F12" ), input_event_t::keyboard_char, false ) == "F12" );',
  '    check( inp_mngr.get_keyname( 1, input_event_t::keyboard_char, false ) == "CTRL+A" );',
  '    check( inp_mngr.get_keyname( 2147483647, input_event_t::keyboard_code, true ) == "UNKNOWN_2147483647" );',
  '    check( inp_mngr.get_keyname( 2147483647, input_event_t::keyboard_code, false ) == "unknown key 2147483647" );',
  '    check( inp_mngr.get_keyname( JOY_LEFT, input_event_t::gamepad, true ) == "JOY_LEFT" );',
  '    check( inp_mngr.get_keyname( static_cast<int>( MouseInput::ScrollWheelUp ), input_event_t::mouse, true ) == "SCROLL_UP" );',
  '    input_event sequence;',
  '    sequence.type = input_event_t::keyboard_char;',
  '    sequence.sequence = { \'a\', \'b\' };',
  '    sequence.modifiers = { keymod_t::shift, keymod_t::alt, keymod_t::ctrl };',
  '    check( sequence.long_description() == "CTRL-ALT-SHIFT-ab" );',
  '    check( sequence.short_description() == "^⌥⇧ab" );',
  '    input_context ctxt( "SEMANTIC_KEYS_FIXTURE", keyboard_mode::keycode );',
  '    check( ctxt.get_desc( "ANY_INPUT" ) == "(*)" );',
  '    check( ctxt.get_desc( "TEST_GLOBAL_EMPTY" ) == "Unbound globally!" );',
  '    check( ctxt.get_desc( "TEST_LOCAL_EMPTY" ) == "Unbound locally!" );',
  '    check( ctxt.get_desc( "TEST_LOCAL_UNDER" ) == "Unbound locally!  Underlying global." );',
  '    check( ctxt.get_desc( "TEST_OVERRIDE" ) == "x" );',
  '    check( ctxt.get_desc( "TEST_DISABLED_CHAR" ) == "None applicable" );',
  '    check( ctxt.get_desc( "TEST_ONE", 0, []( const input_event & ) { return false; } ) == "None applicable" );',
  '    check( ctxt.get_desc( "TEST_THREE" ) == "a, b, or c" );',
  '    check( ctxt.get_desc( "TEST_THREE", 1 ) == "a" );',
  '    check( ctxt.get_desc( "TEST_THREE", 2 ) == "a or b" );',
  '    check( ctxt.get_desc( "TEST_TWO" ) == "a or b" );',
  '    check( ctxt.get_desc( "TEST_ONE" ) == "a" );',
  '    check( ctxt.get_action_name( "TEST_LITERAL" ) == "プレイヤーAlice" );',
  '    help::reset();',
  '    const JsonObject topic = json_loader::from_string( ' + raw(movement, 'cdda_native_help') + ' ).get_object();',
  '    help::load( topic, "core", cata_path(), PATH_INFO::jsondir() / "help.json" );',
  '    const auto metadata = get_help().observe_loaded_topic( movement_placeholder );',
  '    check( metadata.has_value() );',
  '    cdda_help_transport::attach();',
  '    uint32_t held_pin = 0;',
  '    std::string held;',
  '    {',
  '        cdda_help_semantic::selected_help_scope scope( &*metadata );',
  '        held_pin = cdda_help_snapshot_pin();',
  '        check( held_pin != 0 );',
  '        held = copy_pin( held_pin );',
  '        check( json_loader::from_string( held ).get_object().get_bool( "available" ) );',
  '        check( held.find( "help.core.movement.name" ) != std::string::npos );',
  '        check( held.find( "help.core.movement.controls" ) != std::string::npos );',
  '        check( held.find( "help.core.movement.doors" ) != std::string::npos );',
  '        check( held.find( "press_open" ) != std::string::npos );',
  '    }',
  '    check( copy_pin( held_pin ) == held ); // Old owned bytes survive native scope destruction.',
  '    const uint32_t cleared_pin = cdda_help_snapshot_pin();',
  '    bool logically_cleared = cleared_pin == 0;',
  '    if( cleared_pin != 0 ) {',
  '        logically_cleared = !json_loader::from_string( copy_pin( cleared_pin ) ).get_object().get_bool( "available" );',
  '        cdda_help_snapshot_release( cleared_pin );',
  '    }',
  '    check( logically_cleared );',
  '    cdda_help_snapshot_release( held_pin );',
  '    check( cdda_help_snapshot_data( held_pin ) == nullptr );',
  '    check( cdda_help_snapshot_size( held_pin ) == 0 );',
  '    help::reset();',
  '    return checks;',
  '}',
  ''
].join('\n').replace('movement_placeholder', String(movement.order));
assert.strictEqual((fixture.match(/movement_placeholder/g) || []).length, 0);
const expectedChecks = (fixture.match(/\bcheck\( /g) || []).length;
assert(expectedChecks >= 35);
assert(fixture.includes('inp_mngr.init();'));
assert(fixture.includes('sequence.long_description()'));
assert(fixture.includes('sequence.short_description()'));
assert(fixture.includes('cdda_help_semantic::selected_help_scope scope'));
assert(!fixture.includes('#define private'));
const exactTimeout = 'exec_command failed: CreateProcess { message: "Rejected(\\"The automatic permission approval review did not finish before its deadline. Do not assume the action is unsafe based on the timeout alone. You may retry once, or ask the user for guidance or explicit approval.\\")" }';
const approval = {
  schemaVersion: 1,
  status: 'source_only_transcript_projection_no_escalated_CreateProcess',
  attempt: 'semantic-help-producer-escalated',
  source: 'Two actual functions.exec tool failures in this delegated agent transcript; not native program stdout.',
  observations: [
    { orchestrationCell: '111', phase: 'first_scoped_approval_request', exactToolMessage: exactTimeout, ownerStarted: false },
    { orchestrationCell: '113', phase: 'parent_permitted_single_approval_request_retry', exactToolMessage: exactTimeout, ownerStarted: false }
  ],
  nativeAttemptFolderCreated: fs.existsSync(path.join(root, 'execution/semantic-help-producer-escalated')),
  furtherApprovalRequestsHeldByParent: true,
  gatesOrCompilerOrLinkOrRuntimeExecuted: false
};
assert.strictEqual(approval.nativeAttemptFolderCreated, false);
const plan = {
  schemaVersion: 1,
  status: 'actual_original_key_and_help_scope_source_prepared_uncompiled_unexecuted',
  upstreamCommit: commit,
  sourceTree: 'semantic-display-live-slice/build/sources/src',
  sourceTreeMembershipMustRemain: 969,
  selectedOriginalDefinitions: sourceRows,
  sourceResources: [
    { path: 'data/raw/keybindings.json', bytes: originalBindingsBytes.length, sha256: sha(originalBindingsBytes), officialEntries: originalBindings.length, embeddedByteIdentically: true },
    { path: 'data/core/help.json', bytes: helpBytes.length, sha256: sha(helpBytes), selectedTopic: movement.name, selectedOrder: movement.order, selectedMessages: movement.messages.length, topicValuesPreserved: true }
  ],
  supportBaseSha256: sha(fs.readFileSync(path.join(root, 'fixtures/generated-original-support.cpp'))),
  originalWholeObjectsEligibleForSubsequentDependencyValidation: ['help.o', 'input.o', 'input_context.o', 'cdda_help_semantic.o', 'cdda_help_transport.o'],
  fixtureOnlyLeaves: [
    { function: 'gamepad_available', behavior: 'false for this Node/MEMFS capability fixture; not native SDL enumeration' },
    { function: 'realDebugmsg / DebugLog', behavior: 'Inherited support leaves increment and abort on every call; no silent diagnostic success' }
  ],
  fixtureState: ['test_mode=false', 'keycode_mode=true', 'empty original old keymap', 'exact pristine primary bindings', 'empty vehicle fixture', 'version-2 fixture-only preference actions', 'owned Node MEMFS only; NODERAWFS disabled'],
  expectedChecksPerCall: expectedChecks,
  intendedActualMethods: ['input_manager::init', 'input_manager::init_keycode_mapping', 'input_manager::load', 'input_manager::get_keycode', 'input_manager::get_keyname', 'input_event::long_description', 'input_event::short_description', 'input_context::get_desc', 'input_context::get_action_name', 'get_default_mode_input_context', 'help::load/reset/get_help', 'help::observe_loaded_topic', 'cdda_help_semantic::selected_help_scope constructor/destructor', 'cdda_help_transport::attach/encode/publish', 'cdda_help_snapshot_pin/data/size/release'],
  caseDimensions: ['portable/localized English gettext fallback', 'ASCII/tilde/F-key/control/mouse/gamepad names', 'unknown signed-i32 code', 'modifier and sequence order', 'ANY_INPUT', 'global/local unbound and underlying global', 'local binding override', 'disabled type and explicit filter', 'max-limit and one/two/three separators', 'external UTF-8 literal name', 'source-bound Movement IDs and key parameter', 'owned help pin after native scope destruction and clear', 'stale pin release'],
  outstandingBeforeLaunch: ['Independent source review and exact coherent MMD/object validation', 'New bounded compile/link/runtime packet using existing reviewed guard, fresh resources and separate parent release', 'Strict link closure remains unproved; no undefined-symbol suppression', 'CPP compilation may reveal real header/API errors; no source-only pass may substitute for it', 'Whole engine still requires 231 affected original translation units rebuilt'],
  excludedProofs: ['native SDL event polling', 'original help::display_help / scrollable_text UI', 'real browser Asyncify ordering', 'Japanese gettext catalog loading', 'actual Rust semantic help acceptance/rendering', 'full engine relink', 'complete gameplay flow'],
  originalProducersExecuted: false,
  nativeCompilerExecuted: false,
  RustExecuted: false,
  browserExecuted: false,
  additionalSemanticIDs: 0
};
const packetFiles = [['generated-selected-key-support.cpp', support], ['original-key-help.cpp', fixture], ['fixture-preferences.json', JSON.stringify(preferences, null, 2) + '\n']];
for(const [name, text] of packetFiles) fs.writeFileSync(path.join(own, name), text);
plan.generatedFiles = packetFiles.map(([name]) => ({ path: 'key-scope/' + name, bytes: fs.statSync(path.join(own, name)).size, sha256: sha(fs.readFileSync(path.join(own, name))) }));
fs.writeFileSync(path.join(own, 'KEY-SCOPE-SOURCE-PLAN.json'), JSON.stringify(plan, null, 2) + '\n');
fs.writeFileSync(path.join(own, 'HELP-SOURCE-PATH-VERIFICATION.json'), JSON.stringify(pathProof, null, 2) + '\n');
fs.writeFileSync(path.join(root, 'PRODUCER-ESCALATED-APPROVAL-TIMEOUTS.json'), JSON.stringify(approval, null, 2) + '\n');
console.log(JSON.stringify({ status: plan.status, selectedOriginalDefinitions: sourceRows.length, expectedChecksPerCall: expectedChecks, resourceEntries: originalBindings.length, supportSha256: plan.generatedFiles[0].sha256, fixtureSha256: plan.generatedFiles[1].sha256, planSha256: sha(fs.readFileSync(path.join(own, 'KEY-SCOPE-SOURCE-PLAN.json'))), approvalTimeoutProjectionSha256: sha(fs.readFileSync(path.join(root, 'PRODUCER-ESCALATED-APPROVAL-TIMEOUTS.json'))), actualNativeOrRustOrBrowserExecution: false }));