-- SPDX-License-Identifier: GPL-3.0-or-later
-- Browser checkpoint orchestration around the retained ToME 1.7.6 serializer.
-- This source-only adapter is not yet runtime validated. It creates no game,
-- actor, SavefilePipe, serializer, RNG, worker, renderer, or persistence mock.
-- The host must implement and prove the boundary described in SAVE-BOUNDARY.md.

local M = {}

local required_host_functions = {
	"preflight", "barrier_held", "begin_graph", "graph_complete",
	"poll_commit", "finish", "failed",
}

local function no_pending_saves(pipe)
	return #pipe.pipe == 0 and #pipe.on_done == 0 and not pipe.saving
		and (not pipe.waiton or next(pipe.waiton) == nil)
		and (not pipe.co or coroutine.status(pipe.co) == "dead")
end

local function current_original_state()
	local g = rawget(_G, "game")
	local pipe = rawget(_G, "savefile_pipe")
	local cfg = rawget(_G, "config")
	local w = rawget(_G, "world")
	if not g or not pipe or not cfg or not cfg.settings or not w then
		return nil, "original_game_not_ready"
	end
	if g.creating_player or not g.player or g.player.dead or not g.level then
		return nil, "living_player_boundary_required"
	end
	if not g.paused or (g.dialogs and #g.dialogs ~= 0) then
		return nil, "player_input_boundary_required"
	end
	if type(g.player.enoughEnergy) ~= "function" or not g.player:enoughEnergy() then
		return nil, "player_energy_boundary_required"
	end
	if type(g.saveGame) ~= "function" or type(pipe.pushGeneric) ~= "function" then
		return nil, "original_save_api_missing"
	end
	local native = rawget(_G, "core")
	local serial = native and native.serial
	if not serial or type(serial.browserWorkerReady) ~= "function"
		or type(serial.browserPump) ~= "function" or type(serial.browserStatus) ~= "function"
		or type(serial.browserError) ~= "function" then
		return nil, "native_save_platform_unavailable"
	end
	local ok, ready = pcall(serial.browserWorkerReady)
	if not ok or ready ~= true then return nil, "native_save_platform_not_ready" end
	if not cfg.settings.background_saves or (pipe.max_before_wait or 0) <= 2 then
		return nil, "nonblocking_original_save_configuration_required"
	end
	if not no_pending_saves(pipe) then return nil, "existing_save_must_finish" end
	return {game=g, pipe=pipe, world=w, serial=serial}
end

function M.new(host)
	assert(type(host) == "table", "checkpoint host required")
	for _, name in ipairs(required_host_functions) do
		assert(type(host[name]) == "function", "checkpoint host missing "..name)
	end
	local self = {phase="idle", host=host, generation=nil, state=nil, error=nil}
	local function barrier_ok()
		local ok, held = pcall(host.barrier_held, self.generation)
		return ok and held == true
	end

	local function fail(code, detail)
		self.phase, self.error = "failed", {code=code, detail=tostring(detail or "")}
		-- The host retains the barrier and prior durable generation on failure.
		-- This adapter cannot undo mutations performed by the original serializer.
		pcall(host.failed, self.generation, code, self.error.detail)
		return nil, code, self.error.detail
	end

	function self:status()
		-- This is metadata about the operation, not a replacement game snapshot.
		return {phase=self.phase, generation=self.generation, error=self.error}
	end

	function self:begin(generation)
		if self.phase ~= "idle" then return nil, "checkpoint_operation_in_progress" end
		if type(generation) ~= "string" or #generation < 1 or #generation > 128
			or not generation:match("^[A-Za-z0-9_%-]+$") then
			return nil, "invalid_generation_identifier"
		end
		local state, err = current_original_state()
		if not state then return nil, err end
		-- Preflight must hold the real native/application barrier, stage a working
		-- generation, disable command/frame reentry, and verify native save worker.
		-- It must return false when any requirement is not implemented or proven.
		local ok, accepted, reason = pcall(host.preflight, generation, state.game.save_name)
		if not ok then return nil, "host_preflight_failed", tostring(accepted) end
		if accepted ~= true then return nil, "host_boundary_unavailable", tostring(reason or "") end
		self.generation, self.state, self.phase = generation, state, "starting"
		if not barrier_ok() then return fail("checkpoint_barrier_missing") end
		ok, reason = pcall(host.begin_graph, generation)
		if not ok or reason ~= true then return fail("graph_staging_failed", reason) end
		-- Keep the exact game/world serializer. Its screenshot and metadata work
		-- run inside the host's classified original-source save/render boundary.
		ok, reason = pcall(function() state.game:saveGame() end)
		if not ok then return fail("original_save_failed", reason) end
		-- queueing two saves should remain asynchronous with the required config.
		-- Other callbacks/addons can queue more; never pretend the host can prevent
		-- an original forceWait without auditing the exact selected content.
		if not state.pipe.co or coroutine.status(state.pipe.co) == "dead" then
			return fail("original_save_coroutine_missing")
		end
		self.phase = "serializing"
		return true
	end

	function self:poll()
		if self.phase == "idle" or self.phase == "complete" then return self:status() end
		if self.phase == "failed" then return nil, self.error.code, self.error.detail end
		if not barrier_ok() then return fail("checkpoint_barrier_lost") end
		if rawget(_G, "game") ~= self.state.game or rawget(_G, "savefile_pipe") ~= self.state.pipe then
			return fail("original_state_replaced_during_save")
		end
		if self.phase == "serializing" then
			local pipe = self.state.pipe
			-- Progress the real browser queue service provided by serial-platform-work.
			-- ZIP close/rename are atomic steps outside a strict elapsed-time budget.
			local pumped, pump_status = pcall(self.state.serial.browserPump, 1, 65536)
			if not pumped or pump_status == -1 then
				local _, detail = pcall(self.state.serial.browserError)
				return fail("native_save_pump_failed", detail or pump_status)
			end
			if pump_status ~= 0 and pump_status ~= 1 then return fail("invalid_native_pump_status", pump_status) end
			local co = pipe.co
			if not co then return fail("original_save_coroutine_missing") end
			local status = coroutine.status(co)
			if status ~= "dead" then
				if status ~= "suspended" then return fail("original_save_coroutine_reentry") end
				-- Resume the ORIGINAL coroutine once; never steal popSaveReturn(),
				-- never run game:tick(), and never create a duplicate save coroutine.
				-- A resume is not a strict time budget: original callbacks may be slow.
				local ok, err = coroutine.resume(co)
				if not ok then return fail("original_save_coroutine_failed", err) end
			end
			if coroutine.status(co) == "dead" then
				if not no_pending_saves(pipe) then return fail("original_save_did_not_drain") end
				local checked, native_status = pcall(self.state.serial.browserStatus)
				if not checked or type(native_status) ~= "table" or native_status.ready ~= true
					or native_status.error or native_status.idle ~= true
					or native_status.completions ~= 0 then
					return fail("native_save_queue_did_not_drain")
				end
				-- Original Game:tick normally removes completed registered coroutines.
				-- Release only this same completed entry while host exclusively owns Lua.
				if self.state.game.__coroutines and self.state.game.__coroutines.savefilepipe == co then
					self.state.game.__coroutines.savefilepipe = nil
				end
				-- Host now validates final graph archives, captures all THREE original
				-- gameplay RNG components, writes a versioned sidecar, and starts one
				-- IDBFS transaction. Returning true means started, not durable success.
				local ok, started, reason = pcall(host.graph_complete, self.generation, self.state.game.save_name)
				if not ok or started ~= true then return fail("graph_completion_failed", reason or started) end
				self.phase = "persisting"
			end
		end
		if self.phase == "persisting" then
			local ok, result, reason = pcall(host.poll_commit, self.generation)
			if not ok then return fail("browser_persist_failed", result) end
			if result == "failed" then return fail("browser_persist_failed", reason) end
			if result == "committed" then
				-- Host returns committed ONLY after IDBFS transaction oncomplete.
				local finished, detail = pcall(host.finish, self.generation)
				if not finished or detail ~= true then return fail("checkpoint_release_failed", detail) end
				self.phase = "complete"
			elseif result ~= "pending" then return fail("invalid_persist_status", result) end
		end
		return self:status()
	end

	return self
end

return M
