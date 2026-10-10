import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const wasmUrl=new URL('../build/producer-run/original-producer.wasm',import.meta.url);
const {default:createModule}=await import('../build/producer-run/original-producer.mjs');
const module=await createModule({wasmBinary:await readFile(fileURLToPath(wasmUrl))});
assert.equal(typeof module._cdda_original_help_fixture_run,'function');
assert.equal(typeof module._cdda_fixture_diagnostic_call_count,'function');
assert.equal(module._cdda_fixture_diagnostic_call_count(),0);
const first=module._cdda_original_help_fixture_run();
assert.equal(first,34);
assert.equal(module._cdda_fixture_diagnostic_call_count(),0);
const second=module._cdda_original_help_fixture_run();
assert.equal(second,34);
assert.equal(module._cdda_fixture_diagnostic_call_count(),0);
console.log(JSON.stringify({status:'selected-original-help-loader-and-binder-passed',originalChecksPerRun:first,
  runs:2,totalActualNativeChecks:first+second,diagnosticCalls:module._cdda_fixture_diagnostic_call_count(),
  selectedOriginalSupportDefinitions:3,originalCoreObjects:23,getKeyDescriptionExecuted:false,helpDisplayExecuted:false,originalSelectedHelpScopeExecuted:false,
  RustAcceptanceExecuted:false,fullEngineLinked:false,browserExecuted:false,wholeGameAccepted:false}));
