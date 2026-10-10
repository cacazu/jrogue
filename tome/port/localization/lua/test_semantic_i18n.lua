-- Execute with the official Lua 5.1.5 WASM CLI already built in lua-work.
-- The entire original I18N.lua is loaded unchanged; only engine.class setup is stubbed.
local project = assert(os.getenv("TOME_TEXT_TEST_ROOT"), "TOME_TEXT_TEST_ROOT required")
local upstream_i18n = assert(os.getenv("TOME_I18N_SOURCE"), "TOME_I18N_SOURCE required")
package.preload["engine.class"] = function() class = {make=function() end}; return class end
module = function() end
_M = {}
dofile(upstream_i18n)
local native = _M
local original_t, original_tformat, original_nt = _t, string.tformat, _nt
local adapter = dofile(project .. "/lua/semantic_i18n.lua")
local checks = 0
local function check(condition, label) checks = checks + 1; assert(condition, label) end
local en = { ["tome.birth.berserker.name"]="Berserker", ["tome.ui.format"]="%s has %d", ["tome.ui.gap"]="Missing official", ["tome.ui.special"]="Special %s", ["tome.ui.tag"]="Berserker" }
local ja = { ["tome.birth.berserker.name"]="狂戦士", ["tome.ui.format"]="%d個・%s", ["tome.ui.special"]="特別%s", ["tome.ui.tag"]="別文脈", ["tome.ui.gap"]={} }
en["tome.ui.article"] = "an"
ja["tome.ui.article"] = ""
local function entry(owner, tag, order, special)
  return { owner=owner, tag=tag, japanese_args_order=order or {}, special_tokens=special or {}, printf_contract={safe=true}, source_locations={} }
end
local registry = { entries={
  ["tome.birth.berserker.name"]=entry("birth.class.warrior", "birth descriptor name"),
  ["tome.ui.format"]=entry("UI.format", "tformat", {2,1}),
  ["tome.ui.gap"]=entry("UI.gap", "_t"),
  ["tome.ui.special"]=entry("UI.special", "tformat", {}, {{value="special"}}),
  ["tome.ui.tag"]=entry("UI.tag", "_t"),
  ["tome.ui.article"]=entry("UI.article", "_t"),
}, routes={}, japanese_configuration={} }
local function route(source, tag, id)
  table.insert(registry.routes, {source=source,tag=tag,default_id=id,aliases={id},format_ambiguity=false})
end
route("Berserker", "birth descriptor name", "tome.birth.berserker.name")
route("Berserker", "_t", "tome.ui.tag")
route("%s has %d", "tformat", "tome.ui.format")
route("Missing official", "_t", "tome.ui.gap")
route("Special %s", "tformat", "tome.ui.special")
route("an", "_t", "tome.ui.article")
native:t("ja_JP", "an", "", "_t")
native:t("ja_JP", "Berserker", "狂戦士", "birth descriptor name")
native:t("ja_JP", "Berserker", "別文脈", "_t")
native:t("ja_JP", "%s has %d", "%d個・%s", "tformat", {2,1})
native:t("ja_JP", "Special %s", "特別%s", "tformat", nil, {native=true})
native.setFlag("ja_JP", "tformat_special", function(source, tag, order, special, value)
  check(special.native == true, "original special metadata retained")
  return "NATIVE:" .. value
end)
native:setLocale("ja_JP")
local missing, delegated, unmapped = 0, 0, 0
local api = adapter.catalogue(en, ja, registry, {
  native_i18n=native,
  sync_native_locale=function(locale) native:setLocale(locale) end,
  on_missing_japanese=function(id) missing=missing+1; check(id == "tome.ui.gap", "missing ID reported") end,
  on_native_delegate=function(id, reason) delegated=delegated+1; check(id == "tome.ui.special" and reason == "special", "special ID delegated") end,
  on_unmapped=function() unmapped=unmapped+1 end,
})
local resolved = api.resolve("Berserker", "birth descriptor name")
check(resolved.id == "tome.birth.berserker.name" and resolved.template == "狂戦士", "actual official birth text")
local no_context, reason = api.resolve("Berserker", "unknown")
check(no_context == nil and reason == "ambiguous_tag_fallback", "conflicting tags never guessed")
local installed = adapter.install(api)
check(_nt == original_nt and _nt("Berserker") == "Berserker", "catalogue-only _nt unchanged")
check(_t(nil) == nil, "nil source preserved")
check(original_t("an") == "" and _t("an") == "", "official empty native translation preserved without English fallback")
local empty_resolved = api.resolve_id("tome.ui.article")
check(empty_resolved.template == "" and empty_resolved.missing_official_japanese == false, "official empty semantic target is present")
check(("an"):tformat() == "", "empty native format template preserved")
check(_t("Berserker", "birth descriptor name") == "狂戦士", "original _t routed to semantic ID")
check(_t("Berserker") == "別文脈", "default tag preserved")
check(("%s has %d"):tformat("外部ユーザーName", 7) == "7個・外部ユーザーName", "argument reordering and external names unchanged")
check(_t("Missing official") == "Missing official" and missing == 1, "explicit missing Japanese fallback")
check(("Special %s"):tformat("unchanged") == "NATIVE:unchanged" and delegated == 1, "original special processor executes")
check(_t("unmapped original") == "unmapped original" and unmapped == 1, "native unmapped fallback preserved")
api.set_locale("en_US")
check(("%s has %d"):tformat("ExternalName", 7) == "ExternalName has 7", "English original order restored")
check(_t("Missing official") == "Missing official" and missing == 1, "English is not counted as missing Japanese")
local before = math.random
math.random = function() error("presentation called RNG") end
check(("%s has %d"):tformat("Name", 2) == "Name has 2", "formatting is RNG independent")
math.random = before
installed.uninstall()
check(_t == original_t and string.tformat == original_tformat, "native handlers restored")

-- Effective metadata is read from the original VM rather than reconstructed
-- from a declaration. Exercise source-wide special flags and retained nil args.
native:t("ja_JP", "Shared tag source", "alpha target", "alpha")
native:t("ja_JP", "Shared tag source", "beta target", "beta")
native:t("ja_JP", "Across %s", "native %s", "other", nil, {cross_tag=true})
native:t("ja_JP", "Across %s", "native %s", "tformat")
native:t("ja_JP", "Retained %s %d", "%d %s", "tformat", {2,1})
native:t("ja_JP", "Retained %s %d", "%d %s", "tformat")
native:t("ja_JP", "Empty order %s", "empty %s", "tformat", {})
native:setLocale("ja_JP")
local bridge = adapter.native_contracts(native)
check(bridge("Shared tag source", "unknown").template == "beta target", "native last-registration nil fallback")
check(bridge("Retained %s %d", "tformat").args_order[1] == 2, "native nil argument metadata survives explicit-tag reset")
local small_en = { ["tome.test.cross"]="Across %s", ["tome.test.retained"]="Retained %s %d", ["tome.test.empty"]="Empty order %s" }
local small_ja = { ["tome.test.cross"]="native %s", ["tome.test.retained"]="%d %s", ["tome.test.empty"]="empty %s" }
local small = {entries={ ["tome.test.cross"]=entry("test.cross", "tformat"), ["tome.test.retained"]=entry("test.retained", "tformat"), ["tome.test.empty"]=entry("test.empty", "tformat") }, routes={}, japanese_configuration={}}
for id, source in pairs(small_en) do table.insert(small.routes,{source=source,tag="tformat",default_id=id,aliases={id},format_ambiguity=false}) end
native.setFlag("ja_JP", "tformat_special", function(source, tag, order, special, value)
  check(special.cross_tag == true, "cross-tag native special metadata")
  return _t(source,tag):format(value)
end)
local delegated_reasons = {}
local small_api = adapter.catalogue(small_en, small_ja, small, {native_i18n=native,
  on_native_delegate=function(_,why) table.insert(delegated_reasons,why) end})
local small_installed = adapter.install(small_api)
check(_t("Shared tag source", "unknown") == "beta target", "wrapper preserves exact native fallback")
check(("Across %s"):tformat("ExternalName") == "native ExternalName", "source-wide native special gate preserved")
check(("Retained %s %d"):tformat("Name",7) == "7 Name", "effective reordered args delegated")
local native_failed = pcall(original_tformat, "Empty order %s", "Name")
local adapter_failed = pcall(string.tformat, "Empty order %s", "Name")
check(native_failed == false and adapter_failed == false, "present empty native args table semantics preserved")
check(_t("Shared tag source", "alpha") == "alpha target", "native delegation error restores adapter depth")
check(delegated_reasons[1] == "special" and delegated_reasons[2] == "active_native_argument_order", "delegation reasons reported")
small_installed.uninstall()
-- Owner aliases match both virtual suffixes and physical source paths.
small.entries["tome.test.cross"].source_locations={{file="game/modules/tome/test.lua",line=12}}
small.routes[1].default_id=nil
local cross_route
for _, item in ipairs(small.routes) do if item.source == "Across %s" then cross_route=item end end
cross_route.default_id=nil
local alias_api=adapter.catalogue(small_en,small_ja,small)
check(alias_api.resolve("Across %s","tformat","@C:/source/game/modules/tome/test.lua",12).id == "tome.test.cross", "physical caller path suffix selects semantic owner")
print("TOME_SEMANTIC_I18N_TESTS=" .. checks)
