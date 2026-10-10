// GPL-3.0-or-later. Source data capture only; never executes Lua or builds.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const project=path.dirname(import.meta.dirname);
const roots=JSON.parse(fs.readFileSync(path.join(project,'inventory-work/inventory-output/summary.json'),'utf8')).sourceRoots;
const specs=[
 ['game/engines/default/engine/init.lua',/require "config"|require "engine.I18N"|settings.locale|I18N:loadLocale|I18N:setLocale/],
 ['game/engines/default/engine/I18N.lua',/function _M:loadLocale|forceFontPackage|function _M:setLocale|function _M:resetBreakTextAllCharacter|function _M:getLocalesData|breakTextAllCharacter/],
 ['game/engines/default/engine/Module.lua',/breakTextAllCharacter\(false\)|mod.load\("setup"\)|I18N:loadLocale|I18N:resetBreakTextAllCharacter|mod.load\("init"\)/],
 ['game/engines/default/engine/dialogs/LanguageSelect.lua',/function _M:select|saveSettings\("locale"|settings.locale|game:saveGame|util.showMainMenu/],
 ['game/engines/default/engine/utils.lua',/function util.showMainMenu|discard the current lua|core.game.reboot/],
 ['game/engines/default/data/font/packages/default.lua',/id = "japanese"|\/data\/font\/ja_JP/],
 ['game/engines/default/data/locales/engine/ja_JP.lua',/^locale |^forceFontPackage|^setFlag/],
 ['game/modules/tome/data/locales/ja_JP.lua',/^locale |^setFlag/],
 ['game/modules/tome/mod/init.lua',/^i18n_support|font_packages_definitions/],
 ['game/thirdparty/config.lua',/^settings =|function loadString|function loadFunction|^load =/],
 ['game/engines/default/engine/Actor.lua',/function _M:getName|_t\(self.name, "entity name"\)/],
 ['game/modules/tome/mod/class/Actor.lua',/function _M:getName|_t\(self.name, "entity name"\)/],
 ['game/modules/tome/mod/class/Player.lua',/require "mod.class.Actor"|class.inherit\(/],
];
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const sources=specs.map(([file,predicate])=>{
 const root=roots.find(root=>fs.existsSync(path.join(root,file)));
 if(!root)throw Error(`Original source is not available: ${file}`);
 const bytes=fs.readFileSync(path.join(root,file));
 return {file,sha256:hash(bytes),bytes:bytes.length,evidence:bytes.toString('utf8').split(/\r?\n/).flatMap((text,index)=>predicate.test(text)?[{line:index+1,text}]:[])};
});
const deliverables=['native_i18n_install.lua','require-observer-integration.lua','README.md'].map(file=>{
 const bytes=fs.readFileSync(path.join(import.meta.dirname,file));return {file,sha256:hash(bytes),bytes:bytes.length};
});
const report={schema_version:1,source_commit:'624a67329fe2ad440c5b344785a9c73fcf22ae63',source_status:'unchanged original files read only',adapter_status:'staged source; not executed or runtime-verified',sources,deliverables,host_contract:{required_callback:'resolve(source,tag,caller_file,caller_line,actual_native_locale)',native_default:'ja_JP',configuration_key:'config.settings.locale',persisted_locale_must_be_ready:true,rust_to_native_binding_implemented_here:false},memory:process.memoryUsage()};
fs.writeFileSync(path.join(import.meta.dirname,'source-contract-evidence.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({sources:sources.length,deliverables:deliverables.length,memory:report.memory}));
