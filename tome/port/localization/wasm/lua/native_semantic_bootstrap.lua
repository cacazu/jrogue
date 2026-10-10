-- SPDX-License-Identifier: GPL-3.0-or-later
-- Construct the reviewed observer before the platform's existing require hook.
-- This helper never replaces require or executes the original loader itself.
local M={}
local function load_module(path)
	assert(type(path)=="string" and path~="","Explicit mounted semantic adapter path required")
	local chunk,reason=loadfile(path)
	assert(chunk,reason)
	return chunk()
end
function M.new(settings)
	assert(type(settings)=="table","Semantic bootstrap settings required")
	assert(type(settings.preferences)=="table" and settings.preferences.ready==true,
		"Hydrate persisted locale or establish a fresh profile before semantic bootstrap")
	local semantic=load_module(settings.semantic_path)
	local options=load_module(settings.options_path)
	local observer_factory=load_module(settings.observer_path)
	local observer=observer_factory.new(options.new(semantic,settings.preferences,settings.callbacks))
	assert(type(observer.on_required)=="function","Actual semantic native require observer required")
	return observer
end
return M
