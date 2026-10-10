-- SPDX-License-Identifier: GPL-3.0-or-later
-- Additive early installation function, called by the OWNED existing loader seam.
-- Call immediately after original_require("engine.Game") returns and before
-- mod.class.Game inherits/caches its methods or original birth registration wraps it.
return function(Game,original_require)
	assert(type(Game)=="table" and type(original_require)=="function", "Original engine.Game require result is required")
	local Dialog=original_require("engine.ui.Dialog")
	assert(Dialog.__TOME_WEB_YESNO_METADATA_PROTOCOL==1, "Explicit Dialog metadata leaf was not mounted before first require")
	local ui=rawget(_G,"__TOME_WEB_UI")
	if not ui then
		ui=assert(loadfile("/adapter/original-dialog-view.lua"))()
		ui.install(Game,Dialog)
	end
	assert(ui.protocol==1 and type(ui.bind_text)=="function" and type(ui.command_json)=="function", "Original UI protocol 1 is required")
	return ui
end
