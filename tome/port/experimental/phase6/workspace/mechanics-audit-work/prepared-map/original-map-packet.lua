-- SPDX-License-Identifier: GPL-3.0-or-later
-- One actual map preparation lifetime gate. No draw/FOV/RNG in getters.
-- Parent invokes original redraw_now ONCE between begin and seal; this adapter
-- does not call display, advance particles, update FOV, canSee, or a game tick.
local M={protocol=1}
local operation
local last_epoch=0
local function encode(value)
	local kind=type(value)
	if kind=="boolean" then return value and "true" or "false" end
	if kind=="number" then
		assert(value==value and value~=math.huge and value~=-math.huge,"Finite packet metadata is required")
		return string.format("%.17g",value)
	end
	if kind=="string" then return '"'..value:gsub('[%z\1-\31\\"]',function(c)
		if c=='"' then return '\\"' elseif c=='\\' then return '\\\\' end
		return string.format("\\u%04x",string.byte(c))
	end)..'"' end
	assert(kind=="table","Only owned packet metadata may cross the bridge")
	local keys,fields={},{}
	for key in pairs(value) do assert(type(key)=="string");keys[#keys+1]=key end
	table.sort(keys)
	for _,key in ipairs(keys) do fields[#fields+1]=encode(key)..":"..encode(value[key]) end
	return "{"..table.concat(fields,",").."}"
end
local function owner()
	local g=assert(game,"Original game is absent")
	local level=assert(g.level,"Original level is absent")
	local map=assert(level.map,"Original map is absent")
	return g,level,map,assert(map._map,"Original native map is absent")
end
local function identity_held()
	local g,level,map,native=owner()
	assert(operation and g==operation.game and world==operation.world and level==operation.level and map==operation.map and native==operation.native and g.player==operation.player,"Original map lifecycle changed; do not replay/retry this preparation")
	return g
end
function M.begin(epoch,byte_budget)
	assert(not operation,"An original map preparation already owns the packet gate")
	assert(type(epoch)=="number" and epoch>last_epoch and epoch<=9007199254740991 and epoch==math.floor(epoch),"A monotonically increasing exact application epoch is required")
	local g,level,map,native=owner()
	assert(g.player and not g.player.dead and not g.creating_player and g.paused and g.player:enoughEnergy(),"Original player input boundary is required")
	assert(#(g.dialogs or {})==0 and not g:onTickEndExists(),"Original callbacks/dialogs must first reach their real boundary")
	assert(type(native.webPreparedBegin)=="function","Install original native map capture source first")
	assert(native:webPreparedBegin(epoch,byte_budget))
	last_epoch=epoch
	operation={game=g,world=world,level=level,map=map,native=native,player=g.player,epoch=epoch,start_turn=g.turn,phase="preparing"}
	return M.status()
end
function M.seal(epoch)
	local g=identity_held()
	assert(operation.phase=="preparing" and epoch==operation.epoch,"Original map epoch transition is invalid")
	local result=operation.native:webPreparedSeal(epoch)
	operation.phase="sealed"
	operation.end_turn=g.turn
	return result
end
function M.status()
	local g=identity_held()
	local result=operation.native:webPreparedStatus()
	result.mode="original_stateful_preparation_observer"
	result.start_turn=operation.start_turn
	result.end_turn=operation.end_turn or g.turn
	result.tick_end_pending=not not g:onTickEndExists()
	result.full_renderer_ready=false
	return result
end
function M.bytes()
	identity_held()
	assert(operation.phase=="sealed","Original map packet is not sealed")
	return operation.native:webPreparedBytes()
end
function M.release()
	identity_held()
	assert(operation.phase=="sealed","Cannot release in-flight original preparation")
	assert(operation.native:webPreparedAbort())
	operation=nil
	return true
end
function M.begin_json(epoch,byte_budget) return encode(M.begin(epoch,byte_budget)) end
function M.seal_json(epoch) M.seal(epoch); return encode(M.status()) end
function M.status_json() return encode(M.status()) end
function M.release_json() M.release(); return encode{protocol=1,phase="released"} end
assert(not rawget(_G,"__TOME_WEB_PREPARED_MAP"),"Original map packet adapter is already installed")
_G.__TOME_WEB_PREPARED_MAP=M
return M
