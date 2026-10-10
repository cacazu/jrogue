-- SPDX-License-Identifier: GPL-3.0-or-later
-- Source-only presentation/input seam for ORIGINAL engine.Game/ui components.
-- Load and install at the parent loader seam; this is not an alternate game.
local adapter = {protocol=1}
local handles = setmetatable({}, {__mode="k"})
local tokens = setmetatable({}, {__mode="k"})
local next_handle = 0
local installed = false
local allowed = {ACCEPT=true, EXIT=true, MOVE_UP=true, MOVE_DOWN=true, MOVE_LEFT=true, MOVE_RIGHT=true}
local function array(value) return setmetatable(value or {}, {__tome_array=true}) end
local function identity(value, prefix)
	if not handles[value] then next_handle=next_handle+1; handles[value]=prefix.."_"..next_handle end
	return handles[value]
end
local function finite(value)
	assert(type(value)=="number" and value==value and value~=math.huge and value~=-math.huge, "Original UI geometry is absent/non-finite")
	return value
end
local function class_name(value) return value.__CLASSNAME or value._NAME or "unknown" end
local function class_is(value, name, seen)
	seen=seen or {}
	if type(value)~="table" or seen[value] then return false end
	seen[value]=true
	if class_name(value)==name then return true end
	for _,base in ipairs(value._BASES or {}) do if class_is(base,name,seen) then return true end end
	local meta=getmetatable(value)
	return meta and type(meta.__index)=="table" and class_is(meta.__index,name,seen) or false
end
local function sync_dialog(dialog)
	identity(dialog,"d")
	for _,slot in ipairs(dialog.uis or {}) do if type(slot.ui)=="table" then identity(slot.ui,"c") end end
end
function adapter.synchronize(original_game)
	for _,dialog in ipairs(original_game.dialogs or {}) do sync_dialog(dialog) end
end

-- Called by the source-ID-aware original i18n/construction overlay. The field
-- identifies provenance at assignment, not by looking up a rendered English string.
-- For list rows call bind_text(row, original display_prop, token).
function adapter.bind_text(owner, field, token)
	assert(type(owner)=="table" and type(field)=="string" and type(token)=="table", "Invalid text provenance binding")
	assert(token.kind=="semantic" or token.kind=="external", "Only explicit semantic/external text is publishable")
	tokens[owner]=tokens[owner] or {}; tokens[owner][field]=token
end
local function copy_text(owner,field)
	local value=owner[field]
	if value==nil then return nil end
	local token=tokens[owner] and tokens[owner][field]
	if not token then return {kind="unresolved",source=type(value)=="string" and value or "non-string original UI text"} end
	if token.kind=="external" then return {kind="external",value=assert(token.value)} end
	local args={}
	for key,arg in pairs(token.args or {}) do
		assert(type(key)=="string" and type(arg)=="table", "Invalid semantic argument")
		if arg.kind=="external" then args[key]={kind="external",value=assert(arg.value)}
		elseif arg.kind=="number" then args[key]={kind="number",value=finite(arg.value)}
		elseif arg.kind=="text" then args[key]={kind="text",id=assert(arg.id)}
		else error("Unsupported semantic argument kind") end
	end
	return {kind="semantic",id=assert(token.id),args=args}
end
local function actions(key)
	local result=array()
	for name in pairs(allowed) do if key and key.virtuals and type(key.virtuals[name])=="function" then result[#result+1]=name end end
	table.sort(result)
	return result
end
local function component_view(slot)
	local ui=slot.ui
	assert(handles[ui], "Original component was not registered at a presentation boundary")
	local kind="unsupported"
	if class_is(ui,"engine.ui.Button") then kind="button"
	elseif class_is(ui,"engine.ui.Textzone") then kind="text"
	elseif class_is(ui,"engine.ui.List") then kind="list" end
	local out={handle=handles[ui],class_name=class_name(ui),kind=kind,
		bounds={x=finite(slot.x),y=finite(slot.y),w=finite(ui.w),h=finite(ui.h)},
		hidden=not not (slot.hidden or ui.hide),focused=not not ui.focused,can_focus=not not ui.can_focus,
		input_blocked_until=ui.key and ui.key.disable_until,actions=actions(ui.key),items=array()}
	if kind=="button" or kind=="text" then out.text=copy_text(ui,"text") end
	if kind=="list" then
		local prop=ui.display_prop or "name"
		for i,item in ipairs(ui.list or {}) do out.items[#out.items+1]={index=i,text=assert(copy_text(item,prop))} end
		out.selection=ui.sel; out.scroll=ui.scroll
	end
	return out
end
-- Query only: never allocate identities, change focus, generate textures, call
-- isEnabled/display/getTime/updateFOV, run name resolvers, or sample RNG here.
function adapter.snapshot()
	local original_game=assert(game,"Original game is absent")
	local out={protocol=1,stack=array()}
	for i,dialog in ipairs(original_game.dialogs or {}) do
		assert(handles[dialog], "Original dialog was not registered at a presentation boundary")
		local d={handle=handles[dialog],class_name=class_name(dialog),
			bounds={x=finite(dialog.display_x),y=finite(dialog.display_y),w=finite(dialog.w),h=finite(dialog.h)},
			active=i==#original_game.dialogs,title=copy_text(dialog,"title"),
			input_blocked_until=dialog.key and dialog.key.disable_until,actions=actions(dialog.key),components=array()}
		for _,slot in ipairs(dialog.uis or {}) do if type(slot.ui)=="table" then d.components[#d.components+1]=component_view(slot) end end
		if dialog.focus_ui and dialog.focus_ui.ui then d.focused=handles[dialog.focus_ui.ui] end
		out.stack[#out.stack+1]=d
	end
	return out
end

-- Typed original virtual input. Opaque handles are rechecked against the live
-- top dialog; callbacks may open/close dialogs or change gameplay naturally.
function adapter.command(dialog_handle,target_handle,virtual)
	assert(allowed[virtual], "Unsupported original dialog virtual key")
	local original_game=assert(game,"Original game is absent")
	local dialog=original_game.dialogs and original_game.dialogs[#original_game.dialogs]
	assert(dialog and handles[dialog]==dialog_handle,"Stale original dialog handle")
	assert(dialog.key and dialog.key:isEnabled(),"Original dialog input is temporarily disabled")
	local key=dialog.key
	if target_handle and target_handle~="" then
		local target,index
		for i,slot in ipairs(dialog.uis or {}) do if slot.ui and handles[slot.ui]==target_handle then target=slot;index=i;break end end
		assert(target and not target.hidden and not target.ui.hide,"Stale/hidden original component handle")
		assert(target.ui.can_focus,"Original component cannot receive keyboard focus")
		dialog:setFocus(index)
		key=target.ui.key
		assert(key and key:isEnabled(),"Original component input is temporarily disabled")
	end
	assert(key.virtuals and type(key.virtuals[virtual])=="function","Original virtual key is not bound")
	key:triggerVirtual(virtual)
	adapter.synchronize(assert(game)) -- explicit post-input metadata boundary
	local command={dialog=dialog_handle,key=virtual}
	if target_handle and target_handle~="" then command.target=target_handle end
	return {protocol=1,command=command,after=adapter.snapshot()}
end

local function encode(value)
	local kind=type(value)
	if kind=="nil" then return "null" end
	if kind=="boolean" then return value and "true" or "false" end
	if kind=="number" then return string.format("%.17g",finite(value)) end
	if kind=="string" then return '"'..value:gsub('[%z\1-\31\\"]',function(c)
		if c=='"' then return '\\"' elseif c=='\\' then return '\\\\' end
		return string.format("\\u%04x",string.byte(c))
	end)..'"' end
	assert(kind=="table","Only copied UI values may cross the bridge")
	local fields={}
	local meta=getmetatable(value)
	if meta and meta.__tome_array then
		for i=1,#value do fields[#fields+1]=encode(value[i]) end
		return "["..table.concat(fields,",").."]"
	end
	local keys={};for k in pairs(value) do assert(type(k)=="string");keys[#keys+1]=k end;table.sort(keys)
	for _,k in ipairs(keys) do fields[#fields+1]=encode(k)..":"..encode(value[k]) end
	return "{"..table.concat(fields,",").."}"
end
function adapter.snapshot_json() return encode(adapter.snapshot()) end
function adapter.command_json(dialog,target,key) return encode(adapter.command(dialog,target,key)) end

local function wrap(class,name,after)
	local original=class[name]
	if type(original)~="function" then return end
	class[name]=function(self,...)
		local function pack(...) return {n=select("#",...),...} end
		local values=pack(original(self,...))
		after(self)
		return unpack(values,1,values.n)
	end
end
function adapter.install(Game,Dialog)
	assert(not installed,"Original UI seam is already installed")
	installed=true
	for _,name in ipairs({"registerDialog","registerDialogAt","replaceDialog","unregisterDialog"}) do wrap(Game,name,adapter.synchronize) end
	for _,name in ipairs({"loadUI","setupUI","replaceUI"}) do wrap(Dialog,name,sync_dialog) end
	if type(game)=="table" and game.dialogs then adapter.synchronize(game) end
	_G.__TOME_WEB_UI=adapter
	return adapter
end
return adapter
