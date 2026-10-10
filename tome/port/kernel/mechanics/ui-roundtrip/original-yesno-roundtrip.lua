-- SPDX-License-Identifier: GPL-3.0-or-later
-- Additive integration diagnostic. Uses genuine classes, player, UI stack and callbacks.
-- It contains no replacement game/dialog/geometry, generation, simulation or RNG.
local module = {protocol=1}
local ui = assert(rawget(_G, "__TOME_WEB_UI"), "Install original UI projection before original game class inheritance")
assert(ui.protocol == 1 and type(ui.snapshot) == "function" and type(ui.command) == "function", "Original UI protocol is unavailable")
local Dialog = require "engine.ui.Dialog"
assert(Dialog.__TOME_WEB_YESNO_METADATA_PROTOCOL == 1, "Mount explicit popup metadata source before the first Dialog require")
local Key = require "engine.Key"
local Mouse = require "engine.Mouse"
local catalog = assert(loadfile("/adapter/ui-roundtrip-catalog.lua"))()
local current
local generation = 0
local function array(value) return setmetatable(value or {}, {__tome_array=true}) end
local function encode(value)
	local kind=type(value)
	if kind=="nil" then return "null" end
	if kind=="boolean" then return value and "true" or "false" end
	if kind=="number" then
		assert(value==value and value~=math.huge and value~=-math.huge)
		return string.format("%.17g",value)
	end
	if kind=="string" then return '"'..value:gsub('[%z\1-\31\\"]',function(c)
		if c=='"' then return '\\"' elseif c=='\\' then return '\\\\' end
		return string.format("\\u%04x",string.byte(c))
	end)..'"' end
	assert(kind=="table", "Only copied observations may cross the bridge")
	local fields={}
	local meta=getmetatable(value)
	if meta and meta.__tome_array then
		for i=1,#value do fields[#fields+1]=encode(value[i]) end
		return "["..table.concat(fields,",").."]"
	end
	local keys={}; for key in pairs(value) do assert(type(key)=="string"); keys[#keys+1]=key end; table.sort(keys)
	for _,key in ipairs(keys) do fields[#fields+1]=encode(key)..":"..encode(value[key]) end
	return "{"..table.concat(fields,",").."}"
end
local function decision(value)
	if value == nil then return "nil" end
	assert(type(value)=="boolean", "Original yesno callback returned an unexpected value")
	return value and "true" or "false"
end
local function stack_matches(before, actual_game)
	if #before ~= #(actual_game.dialogs or {}) then return false end
	for i,dialog in ipairs(before) do if actual_game.dialogs[i] ~= dialog then return false end end
	return true
end
local function token(id,args) return {kind="semantic",id=id,args=args or {}} end
local function text(locale,id,args)
	local template=assert(catalog[locale][id], "Explicit roundtrip text ID is absent")
	return (template:gsub("{([a-z_]+)}",function(key)
		local value=assert(args and args[key], "Explicit roundtrip argument is absent")
		assert(type(value)=="string", "Roundtrip external argument must be text")
		return value -- returned external bytes are not rescanned for placeholders
	end))
end
function module.open(locale)
	locale=locale or "ja"
	assert(locale=="ja" or locale=="en", "Unsupported roundtrip locale")
	local actual_game=assert(game, "Original game is absent")
	local player=assert(actual_game.player, "Original born player is absent")
	assert(not current or current.outcome_count==1, "An original roundtrip dialog is already open")
	assert(#(actual_game.dialogs or {})==0, "Open the narrow roundtrip only at an empty original dialog stack")
	local name=rawget(player,"name")
	assert(type(name)=="string", "Original external player name is absent")
	generation=generation+1
	local record={generation=generation, original_game=actual_game, player=player,
		before={}, events={}, preexit_count=0, outcome_count=0, locale=locale,
		external_name=name, phase="constructing",
		baseline_key=rawget(Key,"current"),baseline_mouse=rawget(Mouse,"current")}
	assert(type(record.baseline_key)=="table" and type(record.baseline_mouse)=="table", "Original current input handlers are absent")
	for i,dialog in ipairs(actual_game.dialogs or {}) do record.before[i]=dialog end
	current=record -- adapter-owned observations; never add these to the game graph
	local d
	local function observe(stage,value)
		assert(game==record.original_game and game.player==record.player, "Original VM/game changed during callback")
		record.events[#record.events+1]={stage=stage,decision=decision(value),
			stack_contains_dialog=false, stack_size=#game.dialogs,
			key_owned_by_dialog=rawget(Key,"current")==d.key,
			mouse_owned_by_dialog=rawget(Mouse,"current")==d.mouse}
		for _,dialog in ipairs(game.dialogs) do
			if dialog==d then record.events[#record.events].stack_contains_dialog=true end
		end
		if stage=="preexit" then record.preexit_count=record.preexit_count+1
		else record.outcome_count=record.outcome_count+1; record.outcome=decision(value); record.phase="closed" end
	end
	d=Dialog:yesnoPopup(
		text(locale,"ui.roundtrip.title"), text(locale,"ui.roundtrip.body",{character_name=name}),
		function(value) observe("outcome",value) end,
		text(locale,"ui.roundtrip.yes"), text(locale,"ui.roundtrip.no"),
		nil, nil, function(value) observe("preexit",value) end,
		{title=token("ui.roundtrip.title"),
		 body=token("ui.roundtrip.body",{character_name={kind="external",value=name}}),
		 yes=token("ui.roundtrip.yes"), no=token("ui.roundtrip.no")})
	record.dialog=d; record.phase="open"
	assert(rawget(Key,"current")==d.key and rawget(Mouse,"current")==d.mouse, "Original registration did not set current input handlers")
	-- Source-owned post-construction boundary, not identity allocation during query.
	ui.synchronize(actual_game)
	local snapshot=ui.snapshot()
	local top=assert(snapshot.stack[#snapshot.stack], "Original popup was not registered")
	assert(top.title.kind=="semantic" and top.title.id=="ui.roundtrip.title", "Original popup title provenance did not roundtrip")
	assert(#top.components==3, "Original yesno factory component shape changed")
	assert(top.components[1].kind=="text" and top.components[1].text.id=="ui.roundtrip.body", "Original Textzone provenance is absent")
	assert(top.components[2].kind=="button" and top.components[2].text.id=="ui.roundtrip.yes", "Original Yes Button provenance is absent")
	assert(top.components[3].kind=="button" and top.components[3].text.id=="ui.roundtrip.no", "Original No Button provenance is absent")
	record.dialog_handle=top.handle
	record.yes_handle=top.components[2].handle
	record.no_handle=top.components[3].handle
	return module.status_json()
end
function module.status()
	local record=current
	if not record then return {protocol=1,installed=true,phase="idle",generation=generation} end
	assert(game==record.original_game and game.player==record.player, "Original game lifecycle changed; install in the new VM")
	local events=array()
	for _,event in ipairs(record.events) do
		events[#events+1]={stage=event.stage,decision=event.decision,
			stack_contains_dialog=event.stack_contains_dialog,stack_size=event.stack_size,
			key_owned_by_dialog=event.key_owned_by_dialog,mouse_owned_by_dialog=event.mouse_owned_by_dialog}
	end
	return {protocol=1,installed=true,phase=record.phase,generation=record.generation,
		locale=record.locale,external_name=record.external_name,
		dialog=record.dialog_handle,yes=record.yes_handle,no=record.no_handle,
		preexit_count=record.preexit_count,outcome_count=record.outcome_count,
		outcome=record.outcome or "pending",events=events,
		stack_restored=stack_matches(record.before,game),
		key_handler_restored=rawget(Key,"current")==record.baseline_key,
		mouse_handler_restored=rawget(Mouse,"current")==record.baseline_mouse}
end
function module.status_json() return encode(module.status()) end
function module.verify_closed(expected)
	assert(expected=="true" or expected=="false" or expected=="nil", "Unsupported original callback expectation")
	local record=assert(current,"No original roundtrip was opened")
	assert(record.phase=="closed" and record.preexit_count==1 and record.outcome_count==1, "Original callbacks did not each run once")
	assert(#record.events==2 and record.events[1].stage=="preexit" and record.events[2].stage=="outcome", "Original callback order changed")
	assert(record.events[1].stack_contains_dialog and not record.events[2].stack_contains_dialog, "Original unregister was not between callbacks")
	assert(record.events[1].key_owned_by_dialog and record.events[1].mouse_owned_by_dialog and not record.events[2].key_owned_by_dialog and not record.events[2].mouse_owned_by_dialog, "Original handler ownership was not transferred during unregister")
	assert(record.events[1].decision==expected and record.outcome==expected, "Original decision or default nil EXIT changed")
	assert(stack_matches(record.before,game), "Original dialog stack was not restored")
	assert(rawget(Key,"current")==record.baseline_key and rawget(Mouse,"current")==record.baseline_mouse, "Original input handler identities were not restored")
	return module.status_json()
end
-- Parent sends commands through its existing tome_native_ui_command export.
-- This helper solely proves that the same stale real handle cannot invoke twice.
function module.verify_stale()
	local record=assert(current,"No original roundtrip was opened")
	assert(record.phase=="closed", "Original dialog must first close")
	local preexit,outcomes=record.preexit_count,record.outcome_count
	local ok,detail=pcall(ui.command,record.dialog_handle,record.yes_handle,"ACCEPT")
	assert(not ok and type(detail)=="string" and detail:find("Stale original dialog handle",1,true), "Stale real dialog action was not rejected at the original live-stack guard")
	assert(preexit==record.preexit_count and outcomes==record.outcome_count and stack_matches(record.before,game), "Stale action repeated original callbacks")
	return encode{protocol=1,stale_rejected=true,generation=record.generation,preexit_count=preexit,outcome_count=outcomes}
end
assert(not rawget(_G,"__TOME_WEB_UI_ROUNDTRIP"), "Roundtrip module is already installed in this original VM")
_G.__TOME_WEB_UI_ROUNDTRIP=module
return module
