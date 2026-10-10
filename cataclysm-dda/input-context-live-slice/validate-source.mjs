import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {HERE,ROOT,COMMIT,pin,sha,prepare,definition} from './prepare-source.mjs';
const checks=[];
function check(name,fn){fn();checks.push({name,passed:true});}
const actual=prepare({write:false});
check('exact generated original members reproduce from verified original source',()=>assert.deepEqual(fs.readFileSync(actual.report.generatedSource.path),Buffer.from(actual.result)));
check('all nine selected source files match official Git blob identities',()=>assert.equal(actual.report.sourceFiles.length,9));
check('twenty selected definitions have exactly one original handler hook',()=>{
 assert.equal(actual.report.selectedOriginalDefinitions.length,20);
 assert.equal(actual.report.selectedOriginalDefinitions.filter(x=>x.observerHookAdded).length,1);
 for(const record of actual.report.selectedOriginalDefinitions)if(!record.observerHookAdded)assert.equal(record.originalByteSha256,record.generatedByteSha256);
});
check('original exception and timeout behavior retain exact source ordering',()=>{
 const h=definition(actual.data.sources.get('input_context.cpp').text,'const std::string &input_context::handle_input( const int timeout )').text;
 assert.equal(h.includes('try'),false);assert.equal(h.includes('catch'),false);
 assert(h.indexOf('const int old_timeout')<h.indexOf('if( timeout >= 0 )'));
 assert(h.indexOf('inp_mngr.set_timeout( old_timeout )')>h.indexOf('while( true )'));
});
check('const observer does not invoke native mutating resolver',()=>{
 const h=fs.readFileSync(path.join(ROOT,'integration-overlay/hook-input-wait.inc'),'utf8').replaceAll(/\/\/[^\n]*/g,'');
 assert.equal(/get_input_for_action\s*\(|get_action_attributes\s*\(|action_contexts\s*\[/.test(h),false);
 assert(h.includes('const auto &contexts = inp_mngr.action_contexts'));
});
check('native lazy default insertion remains separate from observer',()=>{
 const h=definition(actual.data.sources.get('input.cpp').text,'const action_attributes &input_manager::get_action_attributes(\n').text;
 assert(h.includes('default_action_context[action_id].name = get_default_action_name( action_id )'));
});
check('no private-public macro or replacement input_context/input_manager class',()=>{
 const leaf=fs.readFileSync(path.join(HERE,'fixture-leaves.cpp'),'utf8');
 assert.equal(/#\s*define\s+(private|protected)|class\s+input_(context|manager)\s*[{:]|struct\s+input_(context|manager)\s*[{:]|#\s*include\s*["<].*input_context\.cpp/.test(leaf),false);
 assert(leaf.includes('class keybindings_ui {'));
});
check('source scanner handles braces inside comments and escaped strings',()=>{
 const selected=definition('prefix\nvoid f() { /* } */ const char *s="\\\"}"; // }\n if(true){ } }\nsuffix','void f()');
 assert.equal(selected.text,'void f() { /* } */ const char *s="\\\"}"; // }\n if(true){ } }');
});
check('source scanner rejects absent and ambiguous definitions',()=>{
 assert.throws(()=>definition('void a() {}','void b()'),/absent/);
 assert.throws(()=>definition('void a() {}\nvoid a() {}','void a()'),/ambiguous/);
});
check('source scanner rejects unterminated definitions',()=>assert.throws(()=>definition('void a() { "}";','void a()'),/unterminated/));
check('original class constructor action is retained and language branch remains unclaimed',()=>{
 const h=actual.data.sources.get('input_context.h').text;
 assert(h.includes('register_action( "toggle_language_to_en" )'));
 const leaf=fs.readFileSync(path.join(HERE,'fixture-leaves.cpp'),'utf8');
 assert(leaf.includes('keybindings_ui::bind("default", "toggle_language_to_en", {})'));
});
check('frozen Rust authorization stays denied for untracked native readers',()=>{
 const c=fs.readFileSync(path.join(ROOT,'integration-overlay/rust-snapshot-consumer/src/consumer.rs'),'utf8');
 const m=fs.readFileSync(path.join(ROOT,'integration-overlay/rust-snapshot-consumer/src/model.rs'),'utf8');
 assert(c.includes('UntrackedNativeReaders'));assert(m.includes('UntrackedNativeReaders'));
 const enumBody=m.slice(m.indexOf('pub enum CommandAuthorization'));
 assert.equal(/\bAllowed\b/.test(enumBody),false);
});
const report={schemaVersion:1,status:'source-provenance-and-regressions-passed-no-native-execution',sourceCommit:COMMIT,checks,
 pins:[pin(path.join(HERE,'prepare-source.mjs')),pin(path.join(HERE,'validate-source.mjs')),pin(actual.report.generatedSource.path),pin(path.join(HERE,'fixture-leaves.cpp')),pin(path.join(HERE,'test-wasm.mjs'))],
 compilerExecuted:false,originalSelectedMembersExecuted:false,liveEngineIntegrated:false,commandAuthorization:'Denied(UntrackedNativeReaders)',wholeGameVerified:false};
fs.writeFileSync(path.join(HERE,'SOURCE-CHECKS.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,checks:checks.length,generated:actual.report.generatedSource}));
