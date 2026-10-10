-- ToME 1.7.6 retained-core boot and input characterization driver.
-- This file is an adapter; it contains no actor, combat, generation, or turn rules.
-- It requires the actual native T-Engine Lua registrations and actual Lua sources.
-- License: GPL-3.0-or-later, matching the combined original T-Engine program.

local native_print = print
local settings = rawget(_G, "__TOME_WEB_SETTINGS") or {}
local bridge = {protocol=1, ready=false, stage="native-contract", command_count=0}
local semantic_observer, semantic_diagnostics
_G.__TOME_WEB = bridge

assert(type(core) == "table", "Actual T-Engine core registration is required")
assert(type(core.game) == "table", "Actual T-Engine core.game is required")
assert(type(fs) == "table", "Actual T-Engine PhysFS Lua registration is required")
assert(type(rng) == "table", "Actual T-Engine SFMT RNG Lua registration is required")
assert(type(fs.mount) == "function", "Actual fs.mount is required")
assert(type(rng.seed) == "function", "Actual rng.seed binding is required")
assert(core.game.VERSION == 17, "ToME 1.7.6 requires the native core version 17")

local seed = tonumber(settings.seed) or 176
-- The upstream binding accepts a signed C int; negative values request wall time.
assert(seed == math.floor(seed) and seed >= 0 and seed <= 2147483647, "Seed must be a nonnegative C int")
local name = settings.player_name or ("web_probe_"..tostring(seed))
assert(type(name) == "string" and #name <= 25 and name:match("^[a-zA-Z0-9_-]+$"), "Use a safe, fresh proof character name")
assert(type(core.game.disableConnectivity) == "function", "Actual offline platform capability is required")
core.game.disableConnectivity()
-- These are Emscripten/host adapter mounts; the original modules mount themselves.
-- root_game is the pristine distribution game tree with loader and thirdparty.
-- unpacked_game contains engines/default, modules/tome, and unpacked addons.
if settings.root_game then
	assert(fs.mount(settings.root_game.."/thirdparty", "/", true), "Mount original thirdparty failed")
	assert(fs.mount(settings.root_game, "/", true), "Mount original game loader failed")
end
if settings.unpacked_game then
	assert(fs.mount(settings.unpacked_game, "/", false), "Mount unpacked original modules failed")
end
assert(fs.exists("/loader/pre-init.lua"), "Missing original /loader/pre-init.lua")
assert(fs.exists("/loader/init.lua"), "Missing original /loader/init.lua")
assert(fs.exists("/engines/default/engine/version.lua"), "Missing unpacked original engine")
assert(fs.exists("/modules/tome/mod/init.lua"), "Missing unpacked original ToME module")
assert(fs.exists("/modules/tome-1.7.6.team"), "Missing genuine archived ToME module discovery package")
assert(fs.exists("/config.lua"), "Missing pristine game/thirdparty/config.lua mount")

local function entity_view(e)
	-- Map object-stack containers are not entity identities. Keep the agreed
	-- native-entity schema strict instead of inventing a uid for a container.
	if type(e) ~= "table" or type(e.uid) ~= "number" then return nil end
	return {uid=e.uid, name=e.name, display=e.display,
		color_r=e.color_r, color_g=e.color_g, color_b=e.color_b}
end

-- Finite, read-only characterization view. This is not an original savefile.
-- Do not call updateFOV, canSee, draw, name resolvers, or RNG from snapshot().
-- Production display must still honor the original invisibility/ESP cache policy.
function bridge.snapshot()
	local out = {protocol=1, ready=bridge.ready}
	if type(game) ~= "table" then return out end
	local g = {turn=game.turn, paused=game.paused}
	out.game = g
	local p = game.player
	if type(p) == "table" then
		g.player = {uid=p.uid, name=p.name, x=p.x, y=p.y, level=p.level,
			life=p.life, max_life=p.max_life, energyBase=p.energyBase, dead=p.dead}
		if type(p.energy) == "table" then
			g.player.energy = {value=p.energy.value, mod=p.energy.mod}
		end
	end
	local l = game.level
	if type(l) == "table" and type(l.map) == "table" then
		local m = l.map
		local map_class = assert(package.loaded["engine.Map"], "Original engine.Map must be loaded")
		local mv = {w=m.w, h=m.h, cells={}}
		g.level = {level=l.level, map=mv}
		for y = 0, m.h - 1 do
			for x = 0, m.w - 1 do
				local index = x + y * m.w
				local tile = m.map[index]
				local value = m.seens and m.seens[index]
				local seen = value ~= nil and value ~= false and value ~= 0
				local remembered = not not (m.remembers and m.remembers[index])
				local c = {x=x, y=y, seen=seen, remembered=remembered}
				if tile then
					if seen or remembered then c.terrain = entity_view(tile[map_class.TERRAIN]) end
					if seen then
						c.actor = entity_view(tile[map_class.ACTOR])
						c.object = entity_view(tile[map_class.OBJECT])
						c.trap = entity_view(tile[map_class.TRAP])
					end
				end
				mv.cells[#mv.cells+1] = c
			end
		end
	end
	return out
end

-- Deterministic JSON encoding of a finite bridge view, never the actor graph.
local function encode_json(v)
	local typ = type(v)
	if typ == "nil" then return "null" end
	if typ == "boolean" then return v and "true" or "false" end
	if typ == "number" then
		assert(v == v and v ~= math.huge and v ~= -math.huge, "Non-finite snapshot number")
		return string.format("%.17g", v)
	end
	if typ == "string" then
		return '"'..v:gsub('[%z\1-\31\\"]', function(c)
			if c == '"' then return '\\"' end
			if c == '\\' then return '\\\\' end
			return string.format("\\u%04x", string.byte(c))
		end)..'"'
	end
	assert(typ == "table", "Bridge JSON supports finite data tables only")
	local fields = {}
	if v[1] ~= nil then
		for i = 1, #v do fields[#fields+1] = encode_json(v[i]) end
		return "["..table.concat(fields, ",").."]"
	end
	local keys = {}
	for k in pairs(v) do assert(type(k) == "string", "Snapshot object keys must be strings"); keys[#keys+1] = k end
	table.sort(keys)
	for _, k in ipairs(keys) do fields[#fields+1] = encode_json(k)..":"..encode_json(v[k]) end
	return "{"..table.concat(fields, ",").."}"
end
function bridge.snapshot_json() return encode_json(bridge.snapshot()) end

-- Presentation coverage is a separate diagnostic envelope. Gameplay snapshots
-- keep their existing schema, and baseline runs do not load any semantic hook.
function bridge.localization_json()
	if not semantic_observer then return encode_json({enabled=false}) end
	local diagnostics = semantic_diagnostics and semantic_diagnostics.collect(semantic_observer)
	return encode_json({enabled=true, status=semantic_observer:status(),
		diagnostics=diagnostics, coverage=semantic_observer:coverage_snapshot()})
end

local allowed_commands = {
	MOVE_LEFT=true, MOVE_RIGHT=true, MOVE_UP=true, MOVE_DOWN=true,
	MOVE_LEFT_UP=true, MOVE_LEFT_DOWN=true, MOVE_RIGHT_UP=true, MOVE_RIGHT_DOWN=true,
	MOVE_STAY=true,
	ATTACK_OR_MOVE_LEFT=true, ATTACK_OR_MOVE_RIGHT=true,
	ATTACK_OR_MOVE_UP=true, ATTACK_OR_MOVE_DOWN=true,
	ATTACK_OR_MOVE_LEFT_UP=true, ATTACK_OR_MOVE_LEFT_DOWN=true,
	ATTACK_OR_MOVE_RIGHT_UP=true, ATTACK_OR_MOVE_RIGHT_DOWN=true,
}
function bridge.command(virtual)
	assert(bridge.ready, "Original birth and starting level have not completed")
	assert(allowed_commands[virtual], "Unsupported original virtual key")
	assert(game.key and game.key.virtuals and game.key.virtuals[virtual], "Original virtual key is not bound")
	assert(not game.player.dead, "Original player is dead")
	assert(#game.dialogs == 0, "A real original dialog must be handled before gameplay input")
	local before = bridge.snapshot()
	game.key:triggerVirtual(virtual)
	-- Original Game/GameEnergyBased drive all energy, NPC, effect, and turn rules.
	-- A host tick limit is a runaway guard; reaching it is an error, not fake success.
	local max_ticks = tonumber(settings.max_ticks_per_command) or 10000
	local ticks = 0
	repeat
		game:tick()
		ticks = ticks + 1
		if ticks >= max_ticks then error("Original rule loop did not reach a player pause") end
	until game.player.dead or (game.paused and game.player:enoughEnergy()) or #game.dialogs > 0
	bridge.command_count = bridge.command_count + 1
	return {protocol=1, command=virtual, ticks=ticks, before=before, after=bridge.snapshot()}
end
function bridge.command_json(virtual) return encode_json(bridge.command(virtual)) end

function bridge.birth_done()
	assert(game.player and game.level and game.level.map, "Original birth hook lacks a player or map")
	assert(game.player.descriptor.subrace == "Cornac", "Unexpected original descriptor")
	assert(game.player.descriptor.subclass == "Berserker", "Unexpected original descriptor")
	bridge.ready = true
	bridge.stage = "original-birth-complete"
	native_print("TOME_REAL_BIRTH_JSON="..bridge.snapshot_json())
end

-- Hook only the presentation/input registration seam. Delegate the complete
-- original registration, then feed unchanged Birther methods their own defaults.
-- No birth descriptor, stat, equipment, starting zone, NPC, or rule is replaced.
if settings.semantic_bootstrap then
	assert(type(settings.semantic_module) == "string", "Mounted semantic module path is required")
	assert(type(settings.semantic_options) == "string", "Mounted semantic options path is required")
	assert(type(settings.semantic_observer) == "string", "Mounted semantic observer path is required")
	local bootstrap = assert(loadfile(settings.semantic_bootstrap))()
	semantic_observer = bootstrap.new{
		semantic_path=settings.semantic_module, options_path=settings.semantic_options,
		observer_path=settings.semantic_observer,
		preferences={ready=settings.locale_preferences_ready == true,
			preferred_locale=settings.preferred_locale},
		callbacks={trace_limit=128},
	}
	semantic_diagnostics = assert(loadfile("/adapter/localization/native_semantic_diagnostics.lua"))()
end
local original_require = require
local installed = false
local installed_source_overlay = false
local source_overlay = settings.root_game and (settings.root_game.."/build-overlay")
local installed_engine_overlay = false
local engine_overlay = settings.root_game and (settings.root_game.."/engine-overlay")
_G.require = function(module_name)
	if module_name == "engine.SavefilePipe" and engine_overlay and not installed_engine_overlay then
		-- Mount the exact engine platform leaf before its FIRST original load;
		-- module setup happens later, after engine initialization and I18N.
		assert(not package.loaded[module_name], "SavefilePipe platform overlay was mounted too late")
		assert(fs.mount(engine_overlay, "/", false), "Mount original serial platform-pump overlay failed")
		assert(fs.exists("/engine/SavefilePipe.lua"), "Original serial platform overlay leaf is absent")
		installed_engine_overlay = true
	end
	local result = original_require(module_name)
	if semantic_observer then semantic_observer:on_required(module_name, result) end
	if module_name == "config" then
		-- Original engine/init.lua preserves offline defaults when this original
		-- first-run setting exists. The platform deliberately supplies it offline.
		result.settings.firstrun_gdpr = true
		result.settings.disable_all_connectivity = true
	end
	if module_name == "engine.Module" and source_overlay and not installed_source_overlay then
		installed_source_overlay = true
		local original_definition = assert(result.loadDefinition)
		result.loadDefinition = function(self, ...)
			local mod = original_definition(self, ...)
			if mod and mod.short_name == "tome" then
				local original_load = assert(mod.load)
				mod.load = function(mode, ...)
					if mode ~= "setup" then return original_load(mode, ...) end
					-- Original archive setup and additional teams run unchanged.
					-- Afterwards a separate reviewed build file shadows only the
					-- unused ffi import; no gameplay definition is substituted.
					local first, second = original_load(mode, ...)
					assert(fs.mount(source_overlay, "/", false), "Mount audited source overlay failed")
					assert(fs.exists("/mod/class/AsciiMap.lua"), "Audited source overlay leaf is absent")
					return first, second
				end
			end
			return mod
		end
	end
	if module_name == "engine.Game" and not installed then
		installed = true
		local original_register = assert(result.registerDialog)
		result.registerDialog = function(self, dialog)
			local value = original_register(self, dialog)
			if dialog.actor_base and dialog.descriptors_by_type and dialog.makeDefault and not bridge.birth_automated then
				bridge.birth_automated = true
				bridge.stage = "original-birther-input"
				dialog:makeDefault()
			end
			return value
		end
	end
	return result
end

bridge.stage = "original-pre-init"
assert(loadfile("/loader/pre-init.lua"))()
math.randomseed(seed) -- pre-init seeded this from os.time; host provides replay seed.
rng.seed(seed)
bridge.stage = "original-loader"
-- loader/init.lua executes assignments in __module_extra_info, not a table literal.
local extra = 'no_birth_popup=true;set_addons={};birth_done_script="__TOME_WEB.birth_done()"'
assert(loadfile("/loader/init.lua"))("te4", "1.7.6", "tome", name, true, extra, "default")
bridge.stage = bridge.ready and "original-game-running" or "original-game-awaiting-birth"
native_print("TOME_REAL_BOOT_JSON="..bridge.snapshot_json())
return bridge
