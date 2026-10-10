-- SPDX-License-Identifier: GPL-3.0-or-later
-- Options for the actual content_inventory native_i18n_install observer.
-- This does not replace require or install another I18N/locale implementation.
local M={}
function M.new(semantic,preferences,callbacks)
	assert(type(semantic)=="table" and type(semantic.install)=="function","Actual semantic_i18n module required")
	assert(type(preferences)=="table" and preferences.ready==true,"Persisted locale must be hydrated before native font priming")
	assert(type(__TOME_SEMANTIC_RESOLVE)=="function" and type(__TOME_SEMANTIC_SUPPLEMENT)=="function","Register actual native-to-Rust resolver before original start")
	callbacks=callbacks or {}
	local supplements=setmetatable({}, {
		__index=function(_,id) return __TOME_SEMANTIC_SUPPLEMENT(id) end,
		__newindex=function() error("Reviewed semantic supplements are immutable") end,
	})
	assert(type(__TOME_SEMANTIC_FORMAT_POLICY)=="function","Actual reviewed format policy lookup required")
	-- Each lookup projects a fresh validated policy; neither this proxy nor a
	-- previously returned Lua table can alter the immutable Rust policy store.
	local allowed={}
	for _,id in ipairs({
		"game.modules.tome.mod.class.uiset.classicplayerdisplay.method.display.maketexturebar.tformat.parameter",
		"game.modules.tome.mod.dialogs.charactersheet.method.drawdialog.tformat.parameter_parameter_parameter",
	}) do allowed[id]=true end
	local policies=setmetatable({}, {
		__index=function(_,id) if allowed[id] then return __TOME_SEMANTIC_FORMAT_POLICY(id) end end,
		__newindex=function() error("Reviewed semantic format policies are immutable") end,
	})
	return {semantic=semantic,resolve=__TOME_SEMANTIC_RESOLVE,supplements=supplements,format_policies=policies,
		default_locale="ja_JP",locale_preferences_ready=true,preferred_locale=preferences.preferred_locale,
		on_unmapped=callbacks.on_unmapped,on_missing_japanese=callbacks.on_missing_japanese,
		on_native_delegate=callbacks.on_native_delegate,trace_limit=callbacks.trace_limit}
end
return M
