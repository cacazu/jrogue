import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.dirname(HERE);
export const UPSTREAM = 'C:/Users/kit/gameme/jnethack/jrouge/cataclysm-dda/upstream/Cataclysm-DDA-7b2efa5cea38e4d4d97dd0e63b28b9148623da59';
export const COMMIT = '7b2efa5cea38e4d4d97dd0e63b28b9148623da59';
export const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
export const pin = filename => { const bytes = fs.readFileSync(filename); return {path:path.resolve(filename),bytes:bytes.length,sha256:sha(bytes)}; };
export const require = (yes, message) => { if (!yes) throw new Error(message); };

// The pinned upstream manifest is authoritative for every source byte. No fetch,
// compiler, Cargo, browser, port, SDK or original-source mutation happens here.
export function checkedSources() {
  const proofName = path.join(ROOT, 'upstream-integrity.json');
  const proof = JSON.parse(fs.readFileSync(proofName, 'utf8'));
  const manifestName = path.join(ROOT, 'audit/github-stable-tree.json');
  const manifest = JSON.parse(fs.readFileSync(manifestName, 'utf8'));
  require(proof.result === 'PASS' || proof.result === 'pass' || proof.result === 'passed', 'pristine integrity proof not passed');
  require(manifest.sha === proof.tree_sha && manifest.truncated === false, 'official complete tree identity mismatch');
  // CPP2 already pins the complete original input_context header dependency set.
  const compileName = path.join(ROOT,'integration-overlay/build-plan/cpp-compile/compile-plan.json');
  const compile = JSON.parse(fs.readFileSync(compileName,'utf8'));
  require(compile.sourceCommit === COMMIT, 'CPP2 source commit changed');
  const originals = [...compile.baseline.originalDependencies];
  const available = new Map(originals.map(record => [path.resolve(record.path), record]));
  const sourceNames = ['input_context.cpp','input_context.h','input.cpp','input.h','translation.cpp','translation.h','sdltiles.cpp','ui_manager.h','game.h'];
  const sources = new Map();
  for (const name of sourceNames) {
    const filename = path.join(UPSTREAM,'src',name);
    const bytes = fs.readFileSync(filename);
    const blob = manifest.tree.find(x => x.path === 'src/'+name && x.type === 'blob');
    const gitSha = crypto.createHash('sha1').update(Buffer.concat([Buffer.from('blob '+bytes.length+'\0'),bytes])).digest('hex');
    require(blob && blob.sha === gitSha, 'official source Git blob mismatch: '+name);
    const saved = available.get(path.resolve(filename));
    if (saved) require(saved.sha256 === sha(bytes) && saved.bytes === bytes.length, 'CPP2 original pin mismatch: '+name);
    sources.set(name,{ filename, bytes, text:bytes.toString('utf8'), pin:pin(filename) });
  }
  // These exact source pins are independently recorded in the source selection
  // report; extraction has no silent alternate source or fallback implementation.
  return {sources, compile, originals, proof:pin(proofName), manifest};
}

// Extract one exact C++ definition with a brace scanner that skips comments and
// literals. It accepts a fixed, unique signature; this is not a C++ parser.
export function definition(text, signature) {
  const start = text.indexOf(signature);
  require(start >= 0 && text.indexOf(signature,start+signature.length) < 0, 'definition signature absent/ambiguous: '+signature);
  const open = text.indexOf('{', start+signature.length);
  require(open >= 0, 'definition body missing');
  let depth=0, state='code';
  for(let i=open;i<text.length;i++) {
    const c=text[i], n=text[i+1];
    if(state==='line') {if(c==='\n')state='code';continue;}
    if(state==='block'){if(c==='*'&&n==='/'){state='code';i++;}continue;}
    if(state==='string'||state==='char'){if(c==='\\'){i++;continue;}if(c===(state==='string'?'"':"'"))state='code';continue;}
    if(c==='/'&&n==='/'){state='line';i++;continue;}
    if(c==='/'&&n==='*'){state='block';i++;continue;}
    if(c==='"'){state='string';continue;}
    if(c==="'"){state='char';continue;}
    if(c==='{')depth++;
    if(c==='}'&&--depth===0)return {text:text.slice(start,i+1),start,end:i+1};
  }
  throw new Error('unterminated selected definition');
}

export const SELECTIONS = [
 ['input_context.cpp','const std::string &input_context::input_to_action( const input_event &inp ) const'],
 ['input_context.cpp','void input_context::register_action( const std::string &action_descriptor )'],
 ['input_context.cpp','void input_context::register_action( const std::string &action_descriptor,\n'],
 ['input_context.cpp','const std::string &input_context::handle_input()'],
 ['input_context.cpp','const std::string &input_context::handle_input( const int timeout )'],
 ['input_context.cpp','input_event input_context::get_raw_input()'],
 ['input_context.cpp','void input_context::set_timeout( int val )'],
 ['input_context.cpp','void input_context::reset_timeout()'],
 ['input_context.cpp','bool input_context::is_event_type_enabled( const input_event_t type ) const'],
 ['input_context.cpp','bool input_context::is_registered_action( const std::string &action_name ) const'],
 ['input.cpp','const std::vector<input_event> &input_manager::get_input_for_action( const std::string\n'],
 ['input.cpp','const action_attributes &input_manager::get_action_attributes(\n'],
 ['input.cpp','translation input_manager::get_default_action_name( const std::string &action_id ) const'],
 ['input.cpp','keyboard_mode input_manager::actual_keyboard_mode( const keyboard_mode preferred_keyboard_mode )'],
 ['translation.cpp','translation::translation( const std::string &str, const no_translation_tag )'],
 ['translation.cpp','translation translation::no_translation( const std::string &str )'],
 ['translation.cpp','translation no_translation( const std::string &str )'],
 ['translation.cpp','bool translation::empty() const'],
 ['translation.cpp','bool translation::operator==( const translation &that ) const'],
 ['sdltiles.cpp','void input_manager::set_timeout( const int delay )'],
];

export function prepare({write=true}={}) {
  const data=checkedSources(), records=[];
  const hookName=path.join(ROOT,'integration-overlay/hook-input-wait.inc');
  const hook=fs.readFileSync(hookName,'utf8');
  const patchedName=path.join(ROOT,'integration-overlay/generated/src/input_context.cpp');
  const patched=fs.readFileSync(patchedName,'utf8');
  require(sha(Buffer.from(patched))==='1e63b50e874d5339713a0d1dfc12fcfc1885bb7d893ef2c581443a2afb153fca','frozen original-class hook source changed');
  require(sha(Buffer.from(hook))==='deda71f6f15d0a2a2a0992499bbc8789069581c9abb311bde8f23ed173ab400c','frozen hook changed');
  const pieces=[
    '// Generated bounded original member definitions. See SOURCE-SELECTION.json.\n'+
    '// Original source: CleverRaven/Cataclysm-DDA '+COMMIT+'; CC BY-SA 3.0.\n'+
    '// This is an isolated original-class executable, not the complete engine.\n'+
    '#include <algorithm>\n#include <stdexcept>\n#include "input_context.h"\n#include "input.h"\n#include "translation.h"\n#include "cata_utility.h"\n#include "game.h"\n#include "ui_manager.h"\n#include "browser_input_snapshot.h"\n\n'+
    'static const std::string default_context_id( "default" );\n'+
    'static const std::string CATA_ERROR = "ERROR";\nstatic const std::string ANY_INPUT = "ANY_INPUT";\n'+
    'static const std::string HELP_KEYBINDINGS = "HELP_KEYBINDINGS";\n'+
    'static const std::string TIMEOUT = "TIMEOUT";\n'+
    '// Platform timeout mirror only; no SDL poll or screen event processing.\nint inputdelay = -1;\n'
  ];
  for(const [file,signature] of SELECTIONS){
    const original=data.sources.get(file), selection=definition(original.text,signature);
    let selected=selection.text, hookAdded=false;
    if(signature==='const std::string &input_context::handle_input( const int timeout )'){
      const actual=definition(patched,signature);
      const anchor='    next_action.type = input_event_t::error;';
      require(selection.text.split(anchor).length===2,'hook anchor changed');
      require(actual.text===selection.text.replace(anchor,hook+anchor),'hook alters original handler outside insertion');
      selected=actual.text;hookAdded=true;
    }
    const firstLine=original.text.slice(0,selection.start).split('\n').length;
    records.push({source:file,signature,firstLine,lastLine:firstLine+selection.text.split('\n').length-1,
      originalByteSha256:sha(Buffer.from(selection.text)),generatedByteSha256:sha(Buffer.from(selected)),
      originalBytes:Buffer.byteLength(selection.text),generatedBytes:Buffer.byteLength(selected),observerHookAdded:hookAdded});
    pieces.push('\n#line '+firstLine+' "'+original.filename.replaceAll('\\','/')+'"\n'+selected+'\n');
  }
  pieces.push('\n#include \"../fixture-leaves.cpp\"\n');
  const result=pieces.join('');
  const report={schemaVersion:1,status:'source-prepared-no-native-build',sourceCommit:COMMIT,
    selectedOriginalDefinitions:records,sourceFiles:[...data.sources.values()].map(x=>x.pin),
    hook:pin(hookName),frozenPatchedInputContext:pin(patchedName),fixtureLeaves:pin(path.join(HERE,'fixture-leaves.cpp')),
    upstreamIntegrity:data.proof,officialTree:pin(path.join(ROOT,'audit/github-stable-tree.json')),
    cpp2Plan:pin(path.join(ROOT,'integration-overlay/build-plan/cpp-compile/compile-plan.json')),
    generatedSource:{path:path.join(HERE,'generated/original-members.cpp'),bytes:Buffer.byteLength(result),sha256:sha(Buffer.from(result))},
    officialClassHeadersUnmodified:true,replacementInputContextClass:false,privatePublicMacro:false,
    originalMemberExecutionVerified:false,originalActionContextLookupVerified:false,liveEngineIntegrated:false,
    commandAuthorization:'Denied(UntrackedNativeReaders)',compilerExecuted:false};
  if(write){fs.mkdirSync(path.join(HERE,'generated'),{recursive:true});fs.writeFileSync(report.generatedSource.path,result);fs.writeFileSync(path.join(HERE,'SOURCE-SELECTION.json'),JSON.stringify(report,null,2)+'\n');}
  return {result,report,data};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const {report}=prepare();console.log(JSON.stringify({status:report.status,definitions:report.selectedOriginalDefinitions.length,generated:report.generatedSource}));
}
