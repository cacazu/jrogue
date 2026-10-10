-- SPDX-License-Identifier: GPL-3.0-or-later
-- Comparison-only original save operation. Original screenshot/display effects
-- execute unchanged; this module makes no pure-render or graph-consistency claim.
-- No duplicate pipe, graph serializer, RNG, save callback consumer or game tick.
local M = {}

local function queue_empty(pipe)
	return #pipe.pipe == 0 and #pipe.on_done == 0 and not pipe.saving
		and (not pipe.waiton or next(pipe.waiton) == nil)
		and (not pipe.co or coroutine.status(pipe.co) == "dead")
end
local function generation_valid(value)
	return type(value) == "string" and #value >= 1 and #value <= 128
		and value:match("^[A-Za-z0-9_%-]+$") ~= nil
end

function M.install(bridge, encode_json, loader_metadata)
	assert(type(bridge) == "table" and type(encode_json) == "function", "save.bridge.invalid_install")
	assert(not bridge.full_save_begin_json, "save.bridge.already_installed")
	local native = assert(core and core.game, "save.bridge.native_gate_missing")
	for _, name in ipairs({"browserCheckpointAcquire", "browserCheckpointHeld", "browserCheckpointRelease"}) do
		assert(type(native[name]) == "function", "save.bridge.native_gate_missing")
	end
	local op = {phase="idle", mode="baseline_original_checkpoint", protocol=1}
	local prepare
	local function diagnostics()
		local g, pipe = rawget(_G, "game"), rawget(_G, "savefile_pipe")
		local d = {game_present=g ~= nil, world_present=rawget(_G,"world") ~= nil, pipe_present=pipe ~= nil}
		if g then
			d.turn, d.paused, d.creating_player = g.turn, g.paused, not not g.creating_player
			d.player_present, d.level_present = g.player ~= nil, g.level ~= nil
			d.dialog_count = g.dialogs and #g.dialogs or 0
			if g.player then
				d.player_dead = not not g.player.dead
				local ok, value = pcall(function() return g.player:enoughEnergy() end)
				d.enough_energy = ok and not not value
			end
			if g.onTickEndExists then
				local ok, value = pcall(function() return g:onTickEndExists() end)
				d.tick_end_pending = ok and not not value
			end
		end
		if pipe then
			d.pipe_count, d.on_done_count, d.saving = #pipe.pipe, #pipe.on_done, not not pipe.saving
			d.coroutine_status = pipe.co and coroutine.status(pipe.co) or "absent"
			local n = 0; for _ in pairs(pipe.waiton or {}) do n = n + 1 end; d.waiton_count = n
		end
		if core.serial and type(core.serial.browserStatus) == "function" then
			local ok, value = pcall(core.serial.browserStatus)
			if ok then d.native_status = value end
		end
		return d
	end
	local function status()
		return {protocol=1, mode=op.mode, phase=op.phase, generation=op.generation,
			save_name=op.save_name, error=op.error, polls=op.polls or 0,
			graph_paths=op.graph_paths,
			loader=op.loader or loader_metadata,
			original_save_effects=true, renderer_purity_claim=false}
	end
	local function failure(id, detail)
		op.phase = "failed"
		op.error = {id=id, detail=tostring(detail or "")}
		-- Keep the gate and prior durable generation. Recovery is a fresh module;
		-- mutations made by the original serializer are not reversible here.
		return status()
	end
	local function held()
		return native.browserCheckpointHeld(op.generation) == true
	end
	local function preflight()
		local g, pipe, serial = rawget(_G, "game"), rawget(_G, "savefile_pipe"), core.serial
		if not g or not pipe or not world or not config or not config.settings then
			return nil, "save.bridge.original_state_missing"
		end
		if g.creating_player or not g.player or g.player.dead or not g.level or
			not g.paused or not g.player:enoughEnergy() or (g.dialogs and #g.dialogs ~= 0) then
			return nil, "save.bridge.player_boundary_required"
		end
		if g.onTickEndExists and g:onTickEndExists() then return nil, "save.bridge.tick_work_pending" end
		local pending = not queue_empty(pipe)
		if pending and (not pipe.co or coroutine.status(pipe.co) ~= "suspended") then
			return nil, "save.bridge.prior_save_coroutine_invalid"
		end
		for _, name in ipairs({"browserWorkerReady", "browserPump", "browserStatus", "browserError"}) do
			if not serial or type(serial[name]) ~= "function" then return nil, "save.bridge.native_serial_missing" end
		end
		if serial.browserWorkerReady() ~= true then return nil, "save.bridge.native_serial_not_ready" end
		local ns = serial.browserStatus()
		if type(ns) ~= "table" or ns.ready ~= true or ns.error or
			(not pending and (ns.idle ~= true or ns.completions ~= 0)) then
			return nil, "save.bridge.native_serial_not_idle"
		end
		return {game=g, pipe=pipe, serial=serial, prior_pending=pending}
	end
	local function request_original_full_save()
		op.phase = "serializing"
		local ok, err = pcall(function() op.state.game:saveGame() end)
		if not ok then return failure("save.bridge.original_save_failed", err) end
		return status()
	end
	function bridge.full_save_settle_json(generation)
		local function prepared_status()
			return {protocol=1, mode="baseline_original_checkpoint", phase=prepare.phase,
				generation=prepare.generation, settle_ticks=prepare.ticks, error=prepare.error,
				diagnostics=diagnostics(), original_tick_only=true, renderer_purity_claim=false}
		end
		local function prepare_failed(id, detail)
			prepare.phase, prepare.error = "failed", {id=id, detail=tostring(detail or "")}
			return encode_json(prepared_status()) -- Retain gate; no invented rollback.
		end
		if prepare and prepare.generation == generation then
			if prepare.phase ~= "settling" then return encode_json(prepared_status()) end
		elseif prepare and prepare.phase ~= "consumed" then
			return encode_json({protocol=1, mode=op.mode, phase="rejected", error={id="save.bridge.gate_busy"}})
		else
			if not generation_valid(generation) or (op.phase ~= "idle" and op.phase ~= "complete") then
				return encode_json({protocol=1, mode=op.mode, phase="rejected", error={id="save.bridge.invalid_generation"}})
			end
			local g, pipe, serial = rawget(_G,"game"), rawget(_G,"savefile_pipe"), core.serial
			if not g or not pipe or not world or not g.player or g.player.dead or not g.level or
				g.creating_player or not g.paused or not g.player:enoughEnergy() or (g.dialogs and #g.dialogs > 0) then
				return encode_json({protocol=1, mode=op.mode, phase="rejected", error={id="save.bridge.player_boundary_required"}, diagnostics=diagnostics()})
			end
			if not serial or type(serial.browserPump) ~= "function" or type(serial.browserStatus) ~= "function" or
				type(serial.browserWorkerReady) ~= "function" or serial.browserWorkerReady() ~= true then
				return encode_json({protocol=1, mode=op.mode, phase="rejected", error={id="save.bridge.native_serial_not_ready"}, diagnostics=diagnostics()})
			end
			if native.browserCheckpointAcquire(generation, 1) ~= true then
				return encode_json({protocol=1, mode=op.mode, phase="rejected", error={id="save.bridge.gate_busy"}})
			end
			prepare = {phase="settling", generation=generation, game=g, pipe=pipe, ticks=0}
		end
		if native.browserCheckpointHeld(generation) ~= true or game ~= prepare.game or savefile_pipe ~= prepare.pipe then
			return prepare_failed("save.bridge.original_state_replaced")
		end
		if game.player.dead or game.creating_player or (game.dialogs and #game.dialogs > 0) then
			return prepare_failed("save.bridge.player_boundary_required")
		end
		local at_input = game.paused and game.player:enoughEnergy()
		local pending = game.onTickEndExists and game:onTickEndExists()
		if at_input and not pending then
			-- Keep the same gate across prepared -> strict original preflight ->
			-- Game.saveGame. The host may not render or accept commands here.
			prepare.phase = "prepared"
			return encode_json(prepared_status())
		end
		if prepare.ticks >= 10000 then return prepare_failed("save.bridge.settle_limit_reached") end
		local ok, value = pcall(core.serial.browserPump, 1, 65536)
		if not ok or (value ~= 0 and value ~= 1) then return prepare_failed("save.bridge.native_pump_failed", value) end
		-- This is an explicit application lifecycle step. Paused original
		-- GameTurnBased.tick still calls engine.Game.tick, which executes the
		-- original onTickEnd queue and original registered coroutines. No input,
		-- queue cancellation, forced pause/energy, display, snapshot or RNG reset.
		ok, value = pcall(function() return game:tick() end)
		prepare.ticks = prepare.ticks + 1
		if not ok then return prepare_failed("save.bridge.original_settle_failed", value) end
		return encode_json(prepared_status())
	end
	function bridge.full_save_begin_json(generation)
		if op.phase ~= "idle" and op.phase ~= "complete" then return encode_json(status()) end
		if not generation_valid(generation) then
			return encode_json({protocol=1, mode=op.mode, phase="rejected", error={id="save.bridge.invalid_generation"}})
		end
		local ok, state, err = pcall(preflight)
		if not ok or not state then
			return encode_json({protocol=1, mode=op.mode, phase="rejected",
				error={id=ok and err or "save.bridge.preflight_failed", detail=not ok and tostring(state) or nil},
				diagnostics=diagnostics()})
		end
		local prepared_gate = prepare and prepare.phase == "prepared" and prepare.generation == generation
			and native.browserCheckpointHeld(generation) == true and prepare.game == state.game and prepare.pipe == state.pipe
		if not prepared_gate and native.browserCheckpointAcquire(generation, 1) ~= true then
			return encode_json({protocol=1, mode=op.mode, phase="rejected", error={id="save.bridge.gate_busy"}})
		end
		if prepared_gate then prepare.phase = "consumed" end
		op.generation, op.save_name, op.state = generation, state.game.save_name, state
		op.error = nil
		op.graph_paths = nil
		op.loader = nil
		op.phase, op.polls = state.prior_pending and "draining-prior" or "serializing", 0
		-- Exact original Game:saveGame: highscore/hotkeys, game screenshot/clone,
		-- original world save and optional charsheet work. forceWait may complete
		-- synchronously through the actual platform SavefilePipe overlay.
		if not state.prior_pending then request_original_full_save() end
		return encode_json(status())
	end
	function bridge.full_save_poll_json()
		if op.phase ~= "serializing" and op.phase ~= "draining-prior" then return encode_json(status()) end
		if not held() then return encode_json(failure("save.bridge.gate_lost")) end
		if game ~= op.state.game or savefile_pipe ~= op.state.pipe then
			return encode_json(failure("save.bridge.original_state_replaced"))
		end
		op.polls = op.polls + 1
		local ok, result = pcall(op.state.serial.browserPump, 1, 65536)
		if not ok or result == -1 or (result ~= 0 and result ~= 1) then
			return encode_json(failure("save.bridge.native_pump_failed", ok and op.state.serial.browserError() or result))
		end
		local co = op.state.pipe.co
		if not co then return encode_json(failure("save.bridge.original_coroutine_missing")) end
		if coroutine.status(co) ~= "dead" then
			if coroutine.status(co) ~= "suspended" then return encode_json(failure("save.bridge.coroutine_reentry")) end
			ok, result = coroutine.resume(co)
			if not ok then return encode_json(failure("save.bridge.original_coroutine_failed", result)) end
		end
		if coroutine.status(co) == "dead" then
			if not queue_empty(op.state.pipe) then return encode_json(failure("save.bridge.original_queue_not_drained")) end
			local ns = op.state.serial.browserStatus()
			if type(ns) ~= "table" or ns.ready ~= true or ns.error or ns.idle ~= true or ns.completions ~= 0 then
				return encode_json(failure("save.bridge.native_queue_not_drained"))
			end
			if game.__coroutines and game.__coroutines.savefilepipe == co then game.__coroutines.savefilepipe = nil end
			if op.phase == "draining-prior" then
				if (game.onTickEndExists and game:onTickEndExists()) or not game.paused or
					not game.player:enoughEnergy() or (game.dialogs and #game.dialogs > 0) then
					return encode_json(failure("save.bridge.prior_callbacks_changed_boundary"))
				end
				return encode_json(request_original_full_save())
			end
			-- Preserve the original Savefile:init slot sanitization and call its
			-- actual filename helpers. getRealPath resolves actual mounted files;
			-- no graph constructor/loader is invoked merely to discover paths.
			local Savefile = package.loaded[op.state.pipe.saveclass]
			if not Savefile then return encode_json(failure("save.bridge.original_saveclass_missing")) end
			local slot = op.save_name:gsub("[^a-zA-Z0-9_-.]", "_"):lower()
			local game_path = fs.getRealPath("/save/"..slot.."/"..Savefile:nameLoadGame())
			local world_path = fs.getRealPath("/save//"..Savefile:nameLoadWorld())
			if not game_path or game_path == "" or not world_path or world_path == "" then
				return encode_json(failure("save.bridge.original_graph_file_missing"))
			end
			op.graph_paths = {game=game_path, world=world_path}
			-- Capture the authoritative original locale as inert loader metadata
			-- only after real graph/callback completion. The first return is the
			-- actual current locale ID, not translated text or a UI guess.
			local I18N = package.loaded["engine.I18N"]
			if not I18N or type(I18N.getLocalesData) ~= "function" then
				return encode_json(failure("save.bridge.original_i18n_missing"))
			end
			local locale_ok, locale = pcall(function() return I18N:getLocalesData() end)
			if not locale_ok or type(locale) ~= "string" or #locale < 1 or #locale > 64 or
				not locale:match("^[A-Za-z0-9][A-Za-z0-9_@%.%-]*$") then
				return encode_json(failure("save.bridge.invalid_preferred_locale"))
			end
			op.loader = {}
			for key, value in pairs(loader_metadata) do op.loader[key] = value end
			op.loader.preferred_locale = locale
			op.phase = "graph-complete"
			-- Host must NOW capture actual RNG, validate/copy all original graph
			-- files, and commit. This state is not durable save success.
		end
		return encode_json(status())
	end
	function bridge.full_save_persisting_json(generation)
		if generation ~= op.generation or op.phase ~= "graph-complete" or not held() then
			return encode_json(failure("save.bridge.invalid_commit_transition"))
		end
		op.phase = "persisting"
		return encode_json(status())
	end
	function bridge.full_save_committed_json(generation)
		if generation ~= op.generation or op.phase ~= "persisting" or not held() then
			return encode_json(failure("save.bridge.invalid_commit_transition"))
		end
		-- Application calls this ONLY after the actual IDBFS success callback.
		if native.browserCheckpointRelease(generation) ~= true then
			return encode_json(failure("save.bridge.gate_release_failed"))
		end
		op.phase = "complete"
		return encode_json(status())
	end
	function bridge.full_save_failed_json(detail)
		if op.phase == "idle" or op.phase == "complete" then return encode_json(status()) end
		return encode_json(failure("save.bridge.browser_commit_failed", detail))
	end
	local original_command = assert(bridge.command, "save.bridge.original_command_missing")
	bridge.command = function(...)
		assert(op.phase == "idle" or op.phase == "complete", "save.bridge.command_gate_closed")
		return original_command(...)
	end
	return bridge
end

return M
