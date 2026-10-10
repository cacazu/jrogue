-- SPDX-License-Identifier: GPL-3.0-or-later
-- Observe the genuine Module load flow; never replace loadGame/delay/prerun/run.
local M = {}
local function pipe_idle(pipe)
	return pipe and #pipe.pipe == 0 and #pipe.on_done == 0 and not pipe.saving
		and (not pipe.waiton or not next(pipe.waiton))
		and (not pipe.co or coroutine.status(pipe.co) == "dead")
end

function M.acquire(spec)
	assert(type(spec) == "table" and spec.schema == 1, "save.resume.invalid_request")
	assert(spec.mode == "baseline_original_resume" and spec.rng_layout == 1, "save.resume.unsupported_baseline_layout")
	assert(type(spec.generation) == "string" and #spec.generation >= 1 and #spec.generation <= 128
		and spec.generation:match("^[A-Za-z0-9_%-]+$"), "save.resume.invalid_generation")
	assert(rawget(_G, "game") == nil and rawget(_G, "world") == nil and rawget(_G, "savefile_pipe") == nil
		and not package.loaded["engine.Module"] and not package.loaded["mod.class.Game"], "save.resume.fresh_vm_required")
	assert(core.game.browserCheckpointAcquire(spec.generation, 3) == true, "save.resume.gate_busy")
	local self = {spec=spec, phase="loading", ticks=0, loads={world=0, game=0}}
	local observed = setmetatable({}, {__mode="k"})
	local function held() return core.game.browserCheckpointHeld(spec.generation) == true end
	local function fail(id, detail)
		self.phase, self.error = "failed", {id=id, detail=tostring(detail or "")}
	end
	function self:observeSavefile(Savefile)
		if observed[Savefile] then return end
		local original_world, original_game = assert(Savefile.loadWorld), assert(Savefile.loadGame)
		Savefile.loadWorld = function(save, ...)
			local w, err = original_world(save, ...)
			assert(w, "save.resume.original_world_load_failed")
			self.loads.world = self.loads.world + 1
			self.world = w
			return w, err
		end
		Savefile.loadGame = function(save, ...)
			local g, delay = original_game(save, ...)
			assert(g and type(delay) == "function", "save.resume.original_game_load_failed")
			self.loads.game = self.loads.game + 1
			self.game = g
			local function completed(...) self.delay_completed = true; return ... end
			return g, function(...) return completed(delay(...)) end
		end
		observed[Savefile] = {world=original_world, game=original_game,
			wrapper_world=Savefile.loadWorld, wrapper_game=Savefile.loadGame}
	end
	function self:install(bridge, encode_json)
		assert(self.loads.world == 1 and self.loads.game == 1 and self.delay_completed
			and game == self.game and world == self.world and held(), "save.resume.original_load_sequence_incomplete")
		for Savefile, saved in pairs(observed) do
			if Savefile.loadWorld == saved.wrapper_world then Savefile.loadWorld = saved.world end
			if Savefile.loadGame == saved.wrapper_game then Savefile.loadGame = saved.game end
		end
		-- Returning from the unmodified Module instanciate establishes that its
		-- original prerun/run calls returned. Observe delayed load; do not call
		-- it twice or use SavefilePipe:doLoad (which drops the second return).
		self.phase = "settling"
		bridge.ready = false
		local function status()
			return {protocol=1, mode=spec.mode, generation=spec.generation, phase=self.phase,
				error=self.error, settle_ticks=self.ticks, delay_completed=self.delay_completed,
				original_display_settle_passes=self.visual_settled and 1 or 0,
				world_loaded=self.loads.world, game_loaded=self.loads.game,
				renderer_purity_claim=false, domain_load_equivalence_claim=false}
		end
		function bridge.resume_poll_json()
			if self.phase ~= "settling" then return encode_json(status()) end
			if not held() or game ~= self.game or world ~= self.world then
				fail("save.resume.original_state_replaced"); return encode_json(status())
			end
			local g, serial = game, core.serial
			if g.creating_player or not g.player or g.player.dead or not g.level then
				fail("save.resume.loaded_player_not_ready"); return encode_json(status())
			end
			if g.dialogs and #g.dialogs > 0 then
				-- Original dialog input is required. Do not auto-dismiss it or claim
				-- restoration while a required original load callback is unfinished.
				return encode_json({protocol=1, mode=spec.mode, generation=spec.generation,
					phase="original-dialog-required", dialog_count=#g.dialogs, settle_ticks=self.ticks})
			end
			if not self.visual_settled then
				-- Comparison-only genuine post-load display initialization. Retain
				-- original effects, then inspect/settle any resulting domain work;
				-- restore saved RNG only AFTER this and original callbacks finish.
				local ok, detail = pcall(core.display.forceRedraw)
				if not ok then fail("save.resume.original_display_settle_failed", detail)
				else self.visual_settled = true end
				return encode_json(status())
			end
			local ok, pumped = pcall(serial.browserPump, 1, 65536)
			if not ok or pumped == -1 or (pumped ~= 0 and pumped ~= 1) then
				fail("save.resume.native_pump_failed", pumped); return encode_json(status())
			end
			local ns = serial.browserStatus()
			local at_input = g.paused and g.player:enoughEnergy() and
				(not g.onTickEndExists or not g:onTickEndExists())
			if not at_input or not pipe_idle(savefile_pipe) or ns.idle ~= true or ns.completions ~= 0 then
				if self.ticks >= 10000 then
					fail("save.resume.settle_limit_reached")
					return encode_json(status()) -- Keep gate and original callbacks.
				end
				ok, pumped = pcall(function() return g:tick() end)
				self.ticks = self.ticks + 1
				if not ok then fail("save.resume.original_settle_failed", pumped) end
			else
				self.phase = "restore-required"
			end
			return encode_json(status())
		end
		function bridge.resume_restored_json(generation)
			assert(generation == spec.generation and self.phase == "restore-required" and held(), "save.resume.invalid_restore_transition")
			-- Host invokes this ONLY after actual native envelope validation and
			-- complete RNG restoration succeed, with no intervening original tick.
			assert(core.game.browserCheckpointRelease(generation) == true, "save.resume.gate_release_failed")
			self.phase, bridge.ready, bridge.stage = "ready", true, "original-resume-ready"
			return encode_json(status())
		end
		return bridge
	end
	return self
end

return M
