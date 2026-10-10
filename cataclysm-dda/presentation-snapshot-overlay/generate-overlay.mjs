import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const own = path.dirname(fileURLToPath(import.meta.url)), staging = path.dirname(own);
const upstream = process.env.CDDA_PRISTINE_ROOT ??
  'C:/Users/kit/gameme/jnethack/jrouge/cataclysm-dda/upstream/Cataclysm-DDA-7b2efa5cea38e4d4d97dd0e63b28b9148623da59';
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const commit = '7b2efa5cea38e4d4d97dd0e63b28b9148623da59';
const audit = JSON.parse(fs.readFileSync(path.join(staging,'determinism-audit/SOURCE-MANIFEST.json')));
if (audit.upstream_commit !== commit) throw new Error('audit commit');
const paths = ['src/sdltiles.cpp','src/cursesport.h','src/cursesport.cpp','src/cursesdef.h',
  'src/sdl_font.h','src/sdl_font.cpp','src/color_loader.h','src/catacharset.h','src/catacharset.cpp',
  'src/wcwidth.cpp','src/output.h','src/output.cpp','src/ui_manager.cpp','src/input_context.cpp',
  'src/input_context.h','src/input_enums.h','src/cata_imgui.cpp','src/ncurses_def.cpp'];
const originals = new Map();
const pins = paths.map(source => {
  const bytes = fs.readFileSync(path.join(upstream, source));
  const expected = audit.files.find(entry=>entry.source===source);
  if (!expected || expected.sha256!==sha(bytes) || expected.bytes!==bytes.length) throw new Error(`pin differs ${source}`);
  originals.set(source,bytes.toString('utf8')); return {source,bytes:bytes.length,sha256:sha(bytes)};
});
const original = originals.get('src/sdltiles.cpp');
const edits = [
  {old:'#include "sdltiles.h" // IWYU pragma: associated\n',replacement:'#include "sdltiles.h" // IWYU pragma: associated\n#include "browser_text_snapshot.h"\n'},
  {old:'    SDL_RenderPresent( renderer.get() );\n    SetRenderTarget( renderer, display_buffer );\n',
    replacement:'    SDL_RenderPresent( renderer.get() );\n    SetRenderTarget( renderer, display_buffer );\n' +
      '    // Source-only observer hook: original display target is already restored.\n' +
      '    cdda_text_present_committed();\n'},
  {old:'    const bool option_use_draw_ascii_lines_routine = get_option<bool>( "USE_DRAW_ASCII_LINES_ROUTINE" );\n    bool update = false;\n',
    replacement:'    const bool option_use_draw_ascii_lines_routine = get_option<bool>( "USE_DRAW_ASCII_LINES_ROUTINE" );\n    bool update = false;\n' +
      '    // Copy complete raw text-window cells before native touched/draw flags are consumed.\n' +
      '    const cdda_text_font_role observed_font_role = font.get() == ::font.get() ? cdda_text_font_role::ui :\n' +
      '            font.get() == map_font.get() ? cdda_text_font_role::map :\n' +
      '            font.get() == overmap_font.get() ? cdda_text_font_role::overmap : cdda_text_font_role::unknown;\n' +
      '    cdda_text_observe_window( w, *font, observed_font_role, offset,\n' +
      '                              point( WindowWidth, WindowHeight ), scaling_factor,\n' +
      '                              option_use_draw_ascii_lines_routine );\n'},
].map(edit=>{
  const at=original.indexOf(edit.old);if(at<0||original.indexOf(edit.old,at+1)>=0)throw new Error('nonunique hook');
  return {...edit,startLine:original.slice(0,at).split('\n').length,
    oldCount:edit.old.split('\n').length-1,newCount:edit.replacement.split('\n').length-1};
}).sort((a,b)=>a.startLine-b.startLine);
let patch='diff --git a/src/sdltiles.cpp b/src/sdltiles.cpp\n--- a/src/sdltiles.cpp\n+++ b/src/sdltiles.cpp\n', offset=0;
const lines=original.split('\n');let generated=original;
for(const edit of edits){
  const before=Math.min(3,edit.startLine-1),after=Math.min(3,lines.length-1-(edit.startLine-1+edit.oldCount));
  const start=edit.startLine-before;
  patch+=`@@ -${start},${before+edit.oldCount+after} +${start+offset},${before+edit.newCount+after} @@\n`;
  for(const line of lines.slice(start-1,edit.startLine-1))patch+=` ${line}\n`;
  for(const line of edit.old.slice(0,-1).split('\n'))patch+=`-${line}\n`;
  for(const line of edit.replacement.slice(0,-1).split('\n'))patch+=`+${line}\n`;
  for(const line of lines.slice(edit.startLine-1+edit.oldCount,edit.startLine-1+edit.oldCount+after))patch+=` ${line}\n`;
  offset+=edit.newCount-edit.oldCount;generated=generated.replace(edit.old,edit.replacement);
}
for(const name of ['browser_text_snapshot.h','browser_text_snapshot.cpp']){
  const data=fs.readFileSync(path.join(own,'src',name),'utf8'),source=`src/${name}`;
  patch+=`diff --git a/${source} b/${source}\nnew file mode 100644\n--- /dev/null\n+++ b/${source}\n@@ -0,0 +1,${data.split('\n').length-1} @@\n`;
  for(const line of data.slice(0,-1).split('\n'))patch+=`+${line}\n`;
}
fs.mkdirSync(path.join(own,'generated/src'),{recursive:true});
fs.writeFileSync(path.join(own,'generated/src/sdltiles.cpp'),generated);
fs.writeFileSync(path.join(own,'presentation-snapshot.patch'),patch);
fs.writeFileSync(path.join(own,'source-pins.json'),JSON.stringify({upstream_commit:commit,upstream_tag:'0.I-1',
  official_repository:'https://github.com/CleverRaven/Cataclysm-DDA',files:pins},null,2)+'\n');
fs.copyFileSync(path.join(staging,'help-semantic-slice/LICENSE-UPSTREAM.txt'),path.join(own,'LICENSE-UPSTREAM.txt'));
const dependencyDir=path.join(staging,'engine-build/objects');
function dependencyNames(relative='') {
  return fs.readdirSync(path.join(dependencyDir,relative),{withFileTypes:true}).flatMap(entry=>{
    const name=path.join(relative,entry.name);
    return entry.isDirectory()?dependencyNames(name):entry.isFile()&&name.endsWith('.d')?[name.replace(/\\/g,'/')]:[];
  });
}
const dependencies=dependencyNames().sort().map(name=>{
  const bytes=fs.readFileSync(path.join(dependencyDir,name));
  const text=bytes.toString('utf8').replace(/\\\r?\n/g,' ').replace(/\\/g,'/');
  const source=text.match(/[^\s:]+\/src\/[^\s]+\.(?:cpp|c)(?=\s|$)/)?.[0];
  return {name,bytes:bytes.length,sha256:sha(bytes),source:source?.slice(source.lastIndexOf('/src/')+1),text};
});
const watched=['cursesdef.h','cursesport.h','sdl_font.h','input_context.h'];
const headerCounts=Object.fromEntries(watched.map(header=>[header,dependencies.filter(dep=>new RegExp(`/src/${header.replace('.', '\\.')}(?=\\s|$)`).test(dep.text)).map(dep=>dep.source).filter(Boolean).sort()]));
const baselineManifest=fs.readFileSync(path.join(staging,'engine-build/build-manifest.json'));
const rebuild=dependencies.filter(dep=>dep.source==='src/sdltiles.cpp');
if(rebuild.length!==1)throw new Error('need exact existing SDL dependency record');
fs.writeFileSync(path.join(own,'REBUILD-EVIDENCE.json'),JSON.stringify({schema:1,
  status:'READ_EXISTING_DEPENDENCY_RECORDS_ONLY_NO_BUILD',upstream_commit:commit,
  baseline_manifest_sha256:sha(baselineManifest),dependency_files_read:dependencies.length,
  dependency_total_bytes:dependencies.reduce((n,d)=>n+d.bytes,0),
  dependency_record_manifest_sha256:sha(JSON.stringify(dependencies.map(({text,...rest})=>rest))),
  original_headers_modified:[],existing_translation_units_requiring_rebuild:rebuild.map(({text,...rest})=>rest),
  existing_translation_unit_rebuild_count:rebuild.length,new_translation_units:['src/browser_text_snapshot.cpp'],
  new_translation_unit_count:1,full_relink_required:true,
  hypothetical_original_header_dependency_counts:Object.fromEntries(watched.map(header=>[header,headerCounts[header].length])),
  hypothetical_original_header_dependency_union:[...new Set(Object.values(headerCounts).flat())].sort(),
  dependent_paths:headerCounts,object_reuse_or_build_performed:false},null,2)+'\n');
fs.writeFileSync(path.join(own,'SOURCE-PREPARATION.json'),JSON.stringify({schema:1,upstream_commit:commit,
  status:'SOURCE_ONLY_UNAPPLIED_UNCOMPILED_UNCONNECTED',
  modified_original_cpp:['src/sdltiles.cpp'],modified_original_headers:[],new_native_files:['src/browser_text_snapshot.h','src/browser_text_snapshot.cpp'],
  class_layout_or_signature_changes:false,
  snapshot_family:'cdda-native-text-submissions/1',complete_window_cells:true,full_canvas_complete:false,
  input_authority:'none_native_input_unchanged',semantic_text_id_coverage:'none_raw_native_presentation_observation',
  patch:{path:'presentation-snapshot.patch',bytes:Buffer.byteLength(patch),sha256:sha(patch)},
  generated:{source:'src/sdltiles.cpp',bytes:Buffer.byteLength(generated),sha256:sha(generated)},
  native_compiled:false,rust_compiled:false,native_rust_connected:false,browser_tested:false,
  gameplay_render_purity_verified:false,existing_sources_or_build_modified:false},null,2)+'\n');
console.log(JSON.stringify({status:'source only',source_pins:pins.length,original_cpp:1,original_headers:0,
  patch_bytes:Buffer.byteLength(patch),patch_sha256:sha(patch),dependency_files:dependencies.length,
  existing_TU_rebuilds:rebuild.length,new_TUs:1}));
