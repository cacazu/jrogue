-- SPDX-License-Identifier: GPL-3.0-or-later
-- Source-only application scheduling boundary for the exact Game.lua overlay.
-- Original gameplay methods remain original; this coordinates when they run.
-- Host must provide proven phase/context ownership. No runtime validation yet.

local M = {}

local function integer(value)
	return type(value) == "number" and value == value and value >= 0
		and value <= 9007199254740991 and value == math.floor(value)
end

function M.new(host, original_wasd_schedule)
	assert(type(host) == "table", "render boundary host required")
	for _, name in ipairs({"gameplay_phase_held", "presentation_phase_held", "simulation_revision", "visual_range"}) do
		assert(type(host[name]) == "function", "render boundary host missing "..name)
	end
	assert(type(original_wasd_schedule) == "function", "verbatim original WASD scheduler required")
	local games = setmetatable({}, {__mode="k"}) -- adapter metadata stays outside saved game graph
	local self = {}

	function self:enabled(game)
		local state = games[game]
		return state ~= nil and state.enabled == true
	end

	function self:enableFor(game)
		assert(type(game) == "table" and type(game.updateFOV) == "function", "original Game required")
		assert(host.gameplay_phase_held(game) == true, "original gameplay phase not held")
		assert(not game.creating_player and game.player and game.level, "enable after original birth/load")
		assert(not games[game], "render boundary already configured")
		games[game] = {enabled=true, epoch=0, prepared=nil}
		return true
	end

	function self:invalidate(game)
		local state = games[game]
		if state then state.prepared = nil end
	end

	function self:beforeTick(game, epoch, recorded_repeat_keyframes)
		local state = assert(games[game], "render boundary not enabled")
		assert(host.gameplay_phase_held(game) == true, "original gameplay phase not held")
		assert(integer(epoch) and epoch > state.epoch, "nonmonotonic application epoch")
		assert(integer(recorded_repeat_keyframes) and recorded_repeat_keyframes <= 30, "invalid recorded repeat delta")
		state.epoch, state.prepared = epoch, nil
		-- Execute the verbatim original display WASD bookkeeping at the input
		-- boundary, then let original Game:tick run its original onTickEnd methods.
		-- This does not execute a Rust movement/attack implementation.
		original_wasd_schedule(game, recorded_repeat_keyframes)
		return true
	end

	function self:afterTick(game, epoch)
		local state = assert(games[game], "render boundary not enabled")
		assert(host.gameplay_phase_held(game) == true, "original gameplay phase not held")
		assert(epoch == state.epoch, "application epoch mismatch")
		state.prepared = nil
		if game:onTickEndExists() then return nil, "original_tick_end_work_pending" end
		local level = game.level
		local map = level and level.map
		if map and map.finished and map.changed then
			-- Exact original FOV mechanics: sensing/trap memory, invisibility RNG,
			-- Arcane Eye effects, combat-entry talents and party visibility.
			game:updateFOV()
		end
		if game:onTickEndExists() then return nil, "original_tick_end_work_pending" end
		local revision = host.simulation_revision(game)
		assert(integer(revision), "host simulation revision required")
		local player = game.player
		state.prepared = {epoch=epoch, revision=revision, level=level, map=map,
			turn=game.turn, player=player, x=player and player.x, y=player and player.y,
			native_fov_prepared=false}
		return true
	end

	function self:prepareNativeFOV(game, epoch)
		local state = assert(games[game], "render boundary not enabled")
		local stamp = assert(state.prepared, "primary original FOV not prepared")
		assert(host.gameplay_phase_held(game) == true, "original gameplay phase not held")
		assert(epoch == state.epoch and stamp.epoch == epoch, "application epoch mismatch")
		assert(not stamp.native_fov_prepared, "native-tail FOV already prepared")
		local map = game.level and game.level.map
		assert(map == stamp.map and game.level == stamp.level, "original map changed before native-tail FOV")
		-- Original src/map.c:1922-1933 executes this SECOND FOV call at the map
		-- draw tail for smooth_fov && changed, after native object/z callbacks.
		-- The host must reach this same logical slot through segmented source
		-- preparation. Calling it earlier than unclassified domain callbacks is
		-- not faithful ordering and must not be presented as proved behavior.
		local smooth = config.settings.tome.smooth_fov
		local required = map and map.finished and map.changed and smooth
		if required then game:updateFOV() end
		if game:onTickEndExists() then
			state.prepared = nil
			return nil, "original_tick_end_work_pending"
		end
		stamp.revision = host.simulation_revision(game)
		assert(integer(stamp.revision), "host simulation revision required")
		stamp.turn, stamp.player = game.turn, game.player
		stamp.x, stamp.y = game.player and game.player.x, game.player and game.player.y
		stamp.native_fov_prepared, stamp.native_fov_required = true, not not required
		return true
	end

	function self:assertPrepared(game, map)
		local state = assert(games[game], "render boundary not enabled")
		local stamp = assert(state.prepared, "original logical presentation work not prepared")
		assert(host.presentation_phase_held(game) == true, "original presentation phase not held")
		assert(stamp.epoch == state.epoch and stamp.revision == host.simulation_revision(game), "simulation changed after preparation")
		assert(stamp.level == game.level and stamp.map == map and stamp.turn == game.turn, "original level/turn changed after preparation")
		assert(stamp.player == game.player and (not game.player or (stamp.x == game.player.x and stamp.y == game.player.y)), "original player changed after preparation")
		assert(not game:onTickEndExists(), "original tick-end work appeared during presentation")
		return true
	end

	function self:beforeFrame(game)
		-- Host calls this before redraw_now(), including paths that the original
		-- Game:display returns early (for example resolution-change dialogs).
		return self:assertPrepared(game, game.level and game.level.map)
	end

	function self:assertNativePrepared(game, native_map)
		local map = game.level and game.level.map
		self:assertPrepared(game, map)
		local stamp = games[game].prepared
		assert(map and rawget(map, "_map") == native_map, "unclassified native map FOV receiver")
		assert(stamp.native_fov_prepared and stamp.native_fov_required, "second original native-tail FOV not prepared")
		return true
	end

	function self:visualRange(game, lower, upper)
		assert(host.presentation_phase_held(game) == true, "original presentation phase not held")
		-- Host must invoke the retained rng.range algorithm on the actual separate
		-- presentation RNG context, under its native quiescence/ownership service.
		-- Do not seed or use an invented RNG in this adapter.
		local value = host.visual_range(lower, upper)
		assert(type(value) == "number" and value == value and value >= math.min(lower, upper)
			and value <= math.max(lower, upper) and value == math.floor(value), "invalid original visual range result")
		return value
	end

	return self
end

return M
