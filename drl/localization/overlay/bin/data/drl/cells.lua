-- Modified 2026-10-02 for the DRL browser presentation/semantic text adaptation; original gameplay/domain names retained.
local function avoids_fluid_contact( being )
	if being.flags[ BF_ENVIROSAFE ] then return true end
	if being.flags[ BF_FLY ] then return true end
	if being:is_player() then
		if being:is_perk( "inv" ) then return true end
		if being:is_perk( "enviro" ) then return true end
	end
	return false
end

local function is_fluid_hazard( being, resistance )
	if avoids_fluid_contact( being ) then return false end
	return being:get_total_resistance( resistance, TARGET_FEET ) ~= 100
end

function drl.register_cells()

	register_cell "floor"
	{
		name       = "floor",
		ascii      = "\250",
		asciilow   = '.',
		set        = CELLSET_FLOORS,
		flags      = { CF_FLOOR },
		blname     = "blood",
		blcolor    = RED;
		bloodto    = "bloodpool";
		blsprite   = SPRITE_BLOOD;
		sprite     = {
			SPRITE_FLOOR, -- phobos
			SPRITE_PLATEFLOOR, -- deimos
			SPRITE_BIOFLOOR, -- hell alt
			SPRITE_TETRISFLOOR, -- phobos alt
			SPRITE_GRATEFLOOR, -- deimos alt
			SPRITE_HELLFLOOR, -- hell
			SPRITE_HEXFLOOR, -- phobos alt 2
			SPRITE_GREENFLOOR, -- babel
		}
	}

-- Tech Walls --

	register_cell "wall_destroyed"
	{
		name       = "rubble",
		blname     = "blooded rubble",
		ascii      = "\250",
		asciilow   = '.',
		color 	   = DARKGRAY,
		set        = CELLSET_FLOORS,
		blcolor    = RED,
		sprite     = SPRITE_RUBBLE,
		blsprite   = SPRITE_BLOOD,
		sflags     = { SF_MULTI, SF_FLOOR },
	}

	register_cell "wall"
	{
		name       = "base wall",
		blname     = "blooded wall",
		ascii      = "#",
		color      = { LIGHTGRAY, DARKGRAY, LIGHTGRAY, WHITE, BLUE, BROWN, BROWN },
		blcolor    = RED,
		armor      = 10,
		hp         = 10,
		set        = CELLSET_WALLS,
		flags      = { CF_BLOCKLOS, CF_BLOCKSHOT, CF_BLOCKFLY, CF_BLOCKMOVE, CF_STICKWALL },
		sprite     = { 
			SPRITE_WALL, -- phobos
			SPRITE_TECHWALL, -- deimos
			SPRITE_WALL, -- hell (unused)
			SPRITE_PANELWALL, -- phobos (alt)
			{ sprite = SPRITE_CYBERWALL, coscolor   = { 0.1,0.1,0.8,1.0 }, }, -- 5
			SPRITE_WALL, -- hell (unused)
			SPRITE_PIPEWALL, -- phobos (alt 2)
		},
		blsprite   = SPRITE_WALLBLOOD,
		destroyto  = "wall_destroyed",
		sflags     = { SF_MULTI },
	}

-- Tech Walls End --

-- Hell Walls --

	register_cell "rwall"
	{
		name       = "bloodstone",
		blname     = "blooded bloodstone",
		ascii      = "#",
		color      = RED,
		blcolor    = LIGHTRED,
		armor      = 10,
		hp         = 15,
		set        = CELLSET_WALLS,
		flags      = { CF_BLOCKLOS, CF_BLOCKSHOT, CF_BLOCKFLY, CF_BLOCKMOVE, CF_STICKWALL },
		coscolor   = { 1.0,0.1,0.1,1.0 },
		sprite     = {
			SPRITE_BRICKWALL,
			SPRITE_BRICKWALL,
			SPRITE_BRICKWALL,
			SPRITE_BRICKWALL,
			SPRITE_STONEWALL,
			SPRITE_STONEWALL,
			SPRITE_STONEWALL,
			SPRITE_STONEWALL,
		},
		blsprite   = SPRITE_WALLBLOOD,
		destroyto  = "wall_destroyed",
		sflags     = { SF_MULTI },
	}

-- Hell Walls End --

-- Ice Walls --
	register_cell "iwall"
	{
		name       = "ice wall",
		blname     = "blooded ice wall",
		ascii      = "#",
		color      = LIGHTBLUE,
		blcolor    = RED,
		armor      = 3,
		hp         = 3,
		set        = CELLSET_WALLS,
		flags      = { CF_BLOCKLOS, CF_BLOCKSHOT, CF_BLOCKFLY, CF_BLOCKMOVE, CF_STICKWALL, CF_FRAGILE },
		coscolor   = { 0.6,0.6,1.0,1.0 },
		sprite     = SPRITE_CAVEWALL,
		blsprite   = SPRITE_WALLBLOOD,
		sflags     = { SF_MULTI },
		destroyto  = "wall_destroyed",
	}

-- Ice Walls End --

-- Cave Walls --

	register_cell "cwall"
	{
		name       = "cave wall",
		blname     = "blooded cave wall",
		ascii      = "#",
		color      = { DARKGRAY, BROWN, RED },
		sprite     = {
			{ sprite = SPRITE_CAVEWALL, coscolor   = { 0.3,0.3,0.3,1.0 }, }, -- 5
			{ sprite = SPRITE_CAVEWALL, coscolor   = { 1.0,0.6,0.2,1.0 }, }, -- 6
			{ sprite = SPRITE_LAVAWALL, }, -- 7
		},
		destroyto  = "wall_destroyed",
		blcolor    = RED,
		armor      = 15,
		hp         = 30,
		set        = CELLSET_WALLS,
		flags      = { CF_BLOCKLOS, CF_BLOCKSHOT, CF_BLOCKFLY, CF_BLOCKMOVE, CF_STICKWALL },
		blsprite   = SPRITE_WALLBLOOD,
		sflags     = { SF_MULTI },
	}

	register_cell "cfloor"
	{
		name       = "floor",
		ascii      = "\250",
		asciilow   = '.',
		set        = CELLSET_FLOORS,
		blname     = "blood",
		blcolor    = RED;
		bloodto    = "bloodpool";
		blsprite   = SPRITE_BLOOD;
		sprite     = {
			SPRITE_CAVEFLOOR, -- cave 0
			SPRITE_HELLFLOOR, -- cave 1
			SPRITE_REDFLOOR,  -- cave 2
		}
	}

-- Cave Walls End --

-- Green Walls --
	register_cell "gwall"
	{
		name       = "green wall",
		blname     = "blooded green wall",
		ascii      = "#",
		color      = GREEN,
		blcolor    = RED,
		armor      = 15,
		hp         = 10,
		set        = CELLSET_WALLS,
		flags      = { CF_BLOCKLOS, CF_BLOCKSHOT, CF_BLOCKFLY, CF_BLOCKMOVE, CF_STICKWALL },
		sprite     = SPRITE_BOSSWALL,
		deco       = { SPRITE_DECO_SKULL_1, SPRITE_DECO_SKULL_2, SPRITE_DECO_SKULL_3, SPRITE_DECO_SKULL_4 },
		blsprite   = SPRITE_WALLBLOOD,
		sflags     = { SF_MULTI },
		destroyto  = "wall_destroyed",
	}

-- Green Walls End --

-- Crates --

	register_cell "crate"
	{
		name       = "crate",
		blname     = "blooded crate",
		ascii      = "#",
		color      = BLUE,
		blcolor    = RED,
		armor      = 5,
		hp         = 5,
		set        = CELLSET_WALLS,
		flags      = {CF_BLOCKLOS, CF_BLOCKSHOT, CF_BLOCKFLY, CF_BLOCKMOVE, CF_STICKWALL},
		sprite     = SPRITE_YBOX,
		blsprite   = SPRITE_WALLBLOOD,
	}

	register_cell "ycrate"
	{
		name       = "crate",
		blname     = "blooded crate",
		ascii      = "#",
		color      = BROWN,
		blcolor    = RED,
		armor      = 5,
		hp         = 5,
		set        = CELLSET_WALLS,
		flags      = {CF_BLOCKLOS, CF_BLOCKSHOT, CF_BLOCKFLY, CF_BLOCKMOVE, CF_STICKWALL},
		sprite     = SPRITE_WBOX,
		blsprite   = SPRITE_WALLBLOOD,
	}


-- End Crates --

-- Doors --

	register_cell "door"
	{
		name       = "closed door",
		ascii      = "+",
		color      = BROWN,
		armor      = 4,
		hp         = 6,
		flags      = {CF_BLOCKLOS, CF_BLOCKSHOT, CF_BLOCKFLY, CF_BLOCKMOVE, CF_FRAGILE, CF_OVERLAY, CF_STICKWALL, CF_OPENABLE, CF_RUNSTOP, CF_HIGHLIGHT},
		set        = CELLSET_DOORS,
		sprite     = { 
			SPRITE_STRONGDOOR, 
			SPRITE_DOOR,
			SPRITE_HELLDOOR,
			SPRITE_IRONDOOR,
			SPRITE_UACDOOR,
			SPRITE_BROWNDOOR,
			SPRITE_GREENDOOR,
		},
		sftime     = 25,

		OnAct = function(c,being)
			being:msg(ui.semantic_text("message.door.open", "You open the door."))
			level:play_sound( "door.open", being.position )
			level.map[ c ] = "odoor"
			being.scount = being.scount - 500
			level:animate_cell( c, -3 )
			return true
		end,
	}

	register_cell "odoor"
	{
		name       = "open door",
		ascii      = "/",
		color      = BROWN,
		set        = CELLSET_DOORS,
		flags      = {CF_NOCHANGE, CF_NORUN, CF_OVERLAY, CF_STICKWALL, CF_CLOSABLE, CF_RUNSTOP, CF_NUKABLE, CF_HIGHLIGHT },
		sprite     = {
			SPRITE_STRONGOPENDOOR,
			SPRITE_OPENDOOR,
			SPRITE_HELLOPENDOOR,
			SPRITE_IRONOPENDOOR,
			SPRITE_UACOPENDOOR,
			SPRITE_SKULLOPENDOOR,
			SPRITE_BROWNOPENDOOR,
			SPRITE_GREENOPENDOOR,
		},
		sftime     = 25,

		OnAct = function(c,being)
			if level:get_being(c) == nil and level:get_item(c) == nil then
				being:msg(ui.semantic_text("message.door.close", "You close the door."))
				level:play_sound( "door.close", being.position )
				level.map[ c ] = "door"
				being.scount = being.scount - 500
				level:animate_cell( c, 3 )
				return true
			else
				being:msg(ui.semantic_text("message.door.blocked", "There's something blocking the door."))
				return false
			end
		end,
	}

	register_cell "ldoor"
	{
		name       = "locked door",
		ascii      = "+",
		color      = BROWN,
		set        = CELLSET_DOORS,
		armor      = 6,
		hp         = 6,
		flags      = { CF_BLOCKLOS, CF_BLOCKSHOT, CF_BLOCKFLY, CF_BLOCKMOVE, CF_FRAGILE, CF_OVERLAY, CF_STICKWALL, CF_OPENABLE, CF_RUNSTOP, CF_HIGHLIGHT },
		sprite     = { SPRITE_DOOR, SPRITE_DOOR, SPRITE_HELLDOOR, },

		OnAct = function(c,being)
			being:msg(ui.semantic_text("message.door.locked", "The door is locked."))
			if being:is_player() then
				level:play_sound( "door.fail", being.position )
			end
			return false
		end,
	}

-- End Doors --

-- Stairs --

	register_cell "stairs"
	{
		name       = "down stairs",
		ascii      = ">",
		color      = LIGHTGRAY,
		color_dark = LIGHTGRAY,
		flags      = { CF_NOCHANGE, CF_NORUN, CF_OVERLAY, CF_CRITICAL, CF_HIGHLIGHT, CF_STAIRS, CF_STAIRSENSE },
		sprite     = SPRITE_GRAYSTAIRS,

		OnEnter = function(c,being)
			being:msg(ui.semantic_text("message.stairs.down-here", "There are stairs leading downward here."))
		end,

		OnExit = function(c)
			local linfo = player.episode[level.index]
			player:exit( linfo.exit, 0.5 )
		end,
	}

	register_cell "rstairs"
	{
		name       = "down stairs",
		ascii      = ">",
		color      = LIGHTRED,
		color_dark = RED,
		flags      = {CF_NOCHANGE, CF_NORUN, CF_OVERLAY, CF_CRITICAL, CF_HIGHLIGHT, CF_STAIRS},
		sprite     = SPRITE_REDSTAIRS,

		OnEnter = function(c,being)
			local linfo = player.episode[level.index]
			being:msg(ui.semantic_text("message.cell.special-stairs.destination", "There are stairs leading to {{destination}} here.", {{name="destination",kind="string",value=(function(destination) return ui.registry_text('level',destination.script,'base_game','name',destination.name) end)(player.episode[linfo.special])}}))
		end,

		OnExit = function(c)
			local linfo = player.episode[level.index]
			local sinfo = player.episode[linfo.special]
			if sinfo and sinfo.script and levels[sinfo.script].entry then
				do local drl_history_depth = level.index; local drl_history_entry = levels[sinfo.script].entry; local drl_history_registry_id = sinfo.script; player:add_history( levels[sinfo.script].entry ); if drl_history_registry_id == "abyssal_plains" and drl_history_entry == "On @1 he romped upon the Abyssal Plains." then ui.remember_semantic_history("history.level-entry.abyssal-plains", "On level {{depth}} he romped upon the Abyssal Plains.", {{name="depth",kind="integer",value=tostring(drl_history_depth)}}) elseif drl_history_registry_id == "hells_arena" and drl_history_entry == "On @1 he entered Hell's Arena." then ui.remember_semantic_history("history.level-entry.hells-arena", "On level {{depth}} he entered Hell's Arena.", {{name="depth",kind="integer",value=tostring(drl_history_depth)}}) elseif drl_history_registry_id == "hells_armory" and drl_history_entry == "On @1 he entered Hell's Armory." then ui.remember_semantic_history("history.level-entry.hells-armory", "On level {{depth}} he entered Hell's Armory.", {{name="depth",kind="integer",value=tostring(drl_history_depth)}}) elseif drl_history_registry_id == "halls_of_carnage" and drl_history_entry == "On @1 he ventured into the Halls of Carnage." then ui.remember_semantic_history("history.level-entry.halls-of-carnage", "On level {{depth}} he ventured into the Halls of Carnage.", {{name="depth",kind="integer",value=tostring(drl_history_depth)}}) elseif drl_history_registry_id == "central_processing" and drl_history_entry == "On @1 he trekked through Central Processing." then ui.remember_semantic_history("history.level-entry.central-processing", "On level {{depth}} he trekked through Central Processing.", {{name="depth",kind="integer",value=tostring(drl_history_depth)}}) elseif drl_history_registry_id == "the_chained_court" and drl_history_entry == "On @1 he stormed the Chained Court." then ui.remember_semantic_history("history.level-entry.the-chained-court", "On level {{depth}} he stormed the Chained Court.", {{name="depth",kind="integer",value=tostring(drl_history_depth)}}) elseif drl_history_registry_id == "containment_area" and drl_history_entry == "On @1 he arrived at the Containment Area." then ui.remember_semantic_history("history.level-entry.containment-area", "On level {{depth}} he arrived at the Containment Area.", {{name="depth",kind="integer",value=tostring(drl_history_depth)}}) elseif drl_history_registry_id == "deimos_lab" and drl_history_entry == "On @1 he entered Deimos Lab." then ui.remember_semantic_history("history.level-entry.deimos-lab", "On level {{depth}} he entered Deimos Lab.", {{name="depth",kind="integer",value=tostring(drl_history_depth)}}) elseif drl_history_registry_id == "unholy_cathedral" and drl_history_entry == "On @1 he invaded the Unholy Cathedral!" then ui.remember_semantic_history("history.level-entry.unholy-cathedral", "On level {{depth}} he invaded the Unholy Cathedral!", {{name="depth",kind="integer",value=tostring(drl_history_depth)}}) elseif drl_history_registry_id == "house_of_pain" and drl_history_entry == "On @1 he trespassed on the House of Pain." then ui.remember_semantic_history("history.level-entry.house-of-pain", "On level {{depth}} he trespassed on the House of Pain.", {{name="depth",kind="integer",value=tostring(drl_history_depth)}}) elseif drl_history_registry_id == "the_lava_pits" and drl_history_entry == "On @1 he entered the Lava Pits." then ui.remember_semantic_history("history.level-entry.the-lava-pits", "On level {{depth}} he entered the Lava Pits.", {{name="depth",kind="integer",value=tostring(drl_history_depth)}}) elseif drl_history_registry_id == "limbo" and drl_history_entry == "On @1 he was foolish enough to enter Limbo!" then ui.remember_semantic_history("history.level-entry.limbo", "On level {{depth}} he was foolish enough to enter Limbo!", {{name="depth",kind="integer",value=tostring(drl_history_depth)}}) elseif drl_history_registry_id == "military_base" and drl_history_entry == "On @1 he marched into the Military Base." then ui.remember_semantic_history("history.level-entry.military-base", "On level {{depth}} he marched into the Military Base.", {{name="depth",kind="integer",value=tostring(drl_history_depth)}}) elseif drl_history_registry_id == "the_mortuary" and drl_history_entry == "On @1 he was foolish enough to enter the Mortuary!" then ui.remember_semantic_history("history.level-entry.the-mortuary", "On level {{depth}} he was foolish enough to enter the Mortuary!", {{name="depth",kind="integer",value=tostring(drl_history_depth)}}) elseif drl_history_registry_id == "mt_erebus" and drl_history_entry == "On @1 he arrived at Mt. Erebus." then ui.remember_semantic_history("history.level-entry.mt-erebus", "On level {{depth}} he arrived at Mt. Erebus.", {{name="depth",kind="integer",value=tostring(drl_history_depth)}}) elseif drl_history_registry_id == "phobos_lab" and drl_history_entry == "On @1 he sneaked into the Phobos Lab." then ui.remember_semantic_history("history.level-entry.phobos-lab", "On level {{depth}} he sneaked into the Phobos Lab.", {{name="depth",kind="integer",value=tostring(drl_history_depth)}}) elseif drl_history_registry_id == "city_of_skulls" and drl_history_entry == "On @1 he found the City of Skulls." then ui.remember_semantic_history("history.level-entry.city-of-skulls", "On level {{depth}} he found the City of Skulls.", {{name="depth",kind="integer",value=tostring(drl_history_depth)}}) elseif drl_history_registry_id == "spiders_lair" and drl_history_entry == "On @1 he ventured into the Spider's Lair." then ui.remember_semantic_history("history.level-entry.spiders-lair", "On level {{depth}} he ventured into the Spider's Lair.", {{name="depth",kind="integer",value=tostring(drl_history_depth)}}) elseif drl_history_registry_id == "toxin_refinery" and drl_history_entry == "On @1 he waded into the Toxin Refinery." then ui.remember_semantic_history("history.level-entry.toxin-refinery", "On level {{depth}} he waded into the Toxin Refinery.", {{name="depth",kind="integer",value=tostring(drl_history_depth)}}) elseif drl_history_registry_id == "the_vaults" and drl_history_entry == "On @1 he entered the Vaults." then ui.remember_semantic_history("history.level-entry.the-vaults", "On level {{depth}} he entered the Vaults.", {{name="depth",kind="integer",value=tostring(drl_history_depth)}}) elseif drl_history_registry_id == "the_wall" and drl_history_entry == "On @1 he witnessed the Wall." then ui.remember_semantic_history("history.level-entry.the-wall", "On level {{depth}} he witnessed the Wall.", {{name="depth",kind="integer",value=tostring(drl_history_depth)}}) end end
			end
			player:exit( linfo.special, 0.5 )
		end,

		OnDescribe = function(c)
			local linfo = player.episode[level.index]
			return "stairs leading to "..player.episode[linfo.special].name
		end,
	}

	register_cell "ystairs"
	{
		name       = "down stairs",
		ascii      = ">",
		color      = YELLOW,
		color_dark = YELLOW,
		coscolor   = { 1.0,1.0,0.0,1.0 },
		flags      = {CF_NOCHANGE, CF_NORUN, CF_OVERLAY, CF_CRITICAL, CF_HIGHLIGHT, CF_STAIRS},
		sprite     = SPRITE_STAIRS,
	}

-- End Stairs --

-- Fluids --

	register_cell "water"
	{
		name       = "water",
		ascii      = "=",
		color      = COLOR_WATER,
		flags      = { CF_LIQUID, CF_NOCHANGE },
		sprite     = SPRITE_WATER,
		sflags     = { SF_FLOW, SF_FLUID },
		move_cost  = 1.25,
		set        = CELLSET_FLUIDS,
	}

	register_cell "mud"
	{
		name       = "mud",
		ascii      = "=",
		color      = COLOR_MUD,
		flags      = { CF_LIQUID, CF_NOCHANGE },
		sprite     = SPRITE_MUD,
		sflags     = { SF_FLOW, SF_FLUID },
		move_cost  = 1.65,
		set        = CELLSET_FLUIDS,
	}

	register_cell "acid"
	{
		name       = "acid",
		ascii      = "=",
		color      = COLOR_ACID,
		flags      = { CF_LIQUID, CF_NOCHANGE, CF_NORUN, CF_HAZARD, CF_HIGHLIGHT},
		sprite     = SPRITE_ACID,
		sflags     = { SF_FLOW, SF_FLUID },
		move_cost  = 1.25,
		set        = CELLSET_FLUIDS,

		OnEnter = function(c,being)
			if avoids_fluid_contact( being ) then return end
			local fully_resisted = being:get_total_resistance( "acid", TARGET_FEET ) == 100
			local damage   = 6
			if DIFFICULTY == DIFF_EASY then damage = damage / 2 end
			if being:is_player() then
				if being:is_perk("running") then damage = damage / 2 end
				if not fully_resisted then
					ui.msg(ui.semantic_text("message.hazard.acid", "Argh!!! Acid!"))
					if core.game_time() % 3 == 0 then
						being:play_sound("hit")
					end
				end
			end
			if fully_resisted then damage = 0 end
			being:apply_damage(damage,TARGET_FEET,DAMAGE_ACID,"acid")
		end,

		OnHazardQuery = function( being )
			return is_fluid_hazard( being, "acid" )
		end,
	}

	register_cell "lava"
	{
		name       = "lava",
		ascii      = "=",
		color      = COLOR_LAVA,
		flags      = { CF_LIQUID, CF_NOCHANGE, CF_NORUN, CF_HAZARD, CF_HIGHLIGHT},
		sprite     = SPRITE_LAVA,
		sflags     = { SF_FLOW, SF_FLUID },
		move_cost  = 1.25,
		set        = CELLSET_FLUIDS,

		OnEnter = function(c,being)
			if avoids_fluid_contact( being ) then return end
			local fully_resisted = being:get_total_resistance( "fire", TARGET_FEET ) == 100
			local damage = 12
			if DIFFICULTY == DIFF_EASY then damage = damage / 2 end
			if being:is_player() then
				if being:is_perk("running") then damage = damage / 2 end
				if not fully_resisted then
					ui.msg(ui.semantic_text("message.hazard.lava", "Argh!!! Lava!"))
					if core.game_time() % 3 == 0 then
						being:play_sound("hit")
					end
				end
			end
			if fully_resisted then damage = 0 end
			being:apply_damage(damage,TARGET_FEET,DAMAGE_FIRE,"lava")
		end,

		OnHazardQuery = function( being )
			return is_fluid_hazard( being, "fire" )
		end,

	}

	register_cell "blood"
	{
		name       = "blood",
		ascii      = "=",
		color      = COLOR_BLOOD,
		flags      = { CF_LIQUID, CF_NOCHANGE, CF_NORUN, CF_HIGHLIGHT },
		sprite     = SPRITE_BLOODLAVA,
		sflags     = { SF_FLOW, SF_FLUID },
		move_cost  = 1.25,
		set        = CELLSET_FLUIDS,

		OnEnter = function(c,being)
			if not being:is_player() then return end
			if avoids_fluid_contact( being ) then return end
			local fully_resisted = being:get_total_resistance( "plasma", TARGET_FEET ) == 100
			local damage = 12
			if DIFFICULTY == DIFF_EASY then damage = damage / 2 end
			if being:is_perk("running") then damage = damage / 2 end
			if not fully_resisted then
				ui.msg(ui.semantic_text("message.hazard.blood", "Argh!!! Blood!"))
				if core.game_time() % 3 == 0 then
					being:play_sound("hit")
				end
			end
			if fully_resisted then damage = 0 end
			being:apply_damage( damage, TARGET_FEET, DAMAGE_PLASMA, "blood" )
		end,

		OnHazardQuery = function( being )
			if not being:is_player() then return false end
			return is_fluid_hazard( being, "plasma" )
		end,
	}

-- End Fluids --

-- Misc --

	register_cell "bridge"
	{
		name       = "bridge",
		ascii      = "=",
		color      = BROWN,
		set        = CELLSET_FLOORS,
		sprite     = SPRITE_BRIDGE,
		blname     = "blood",
		blcolor    = RED;
		blsprite   = SPRITE_BLOOD;
		sflags     = { SF_FLUID },
	}

	register_cell "rock"
	{
		name       = "Phobos rock",
		ascii      = ".",
		color      = RED,
		set        = CELLSET_FLOORS,
		sprite     = SPRITE_CAVEFLOOR,
		sflags     = { SF_FLUID },
	}

	register_cell "nukecell"
	{
		id         = "nukecell",
		name       = "a nuke!",
		ascii      = "0",
		color      = RED,
		color_dark = RED,
		flags      = { CF_NOCHANGE, CF_NORUN, CF_OVERLAY, CF_NUKABLE, CF_CRITICAL, CF_HIGHLIGHT},
		sprite     = SPRITE_NUKE,
		sframes    = 2,
	}

-- End Misc --

	register_cell "crate_ammo"
	{
		name       = "crate",
		blname     = "blooded crate",
		ascii      = "#",
		color      = LIGHTRED,
		blcolor    = RED,
		armor      = 5,
		hp         = 5,
		set        = CELLSET_WALLS,
		flags      = {CF_BLOCKLOS, CF_BLOCKSHOT, CF_BLOCKFLY, CF_BLOCKMOVE, CF_STICKWALL, CF_FRAGILE},
		sprite     = SPRITE_WBOXC,
		blsprite   = SPRITE_WALLBLOOD,
		coscolor   = {1.0,0.0,0.0,1.0},

		OnDestroy = function(c)
			if math.random(4) == 1 then
				local item_spawn = {"ammo","shell"}
				if math.random(5) == 1 then
					item_spawn = {"pammo","pshell"}
				end
				level:drop_item( table.random_pick( item_spawn ), c, true, true, true )
			end
		end,
	}

	register_cell "crate_armor"
	{
		name       = "crate",
		blname     = "blooded crate",
		ascii      = "#",
		color      = YELLOW,
		blcolor    = RED,
		armor      = 5,
		hp         = 5,
		set        = CELLSET_WALLS,
		flags      = {CF_BLOCKLOS, CF_BLOCKSHOT, CF_BLOCKFLY, CF_BLOCKMOVE, CF_STICKWALL, CF_FRAGILE},
		sprite     = SPRITE_YBOXC,
		blsprite   = SPRITE_WALLBLOOD,
		coscolor   = {1.0,1.0,0.0,1.0},

		OnDestroy = function(c)
			if math.random(4) == 1 then
				local item_spawn = {"garmor","sboots","smed"}
				if math.random(5) == 1 then
					item_spawn = {"barmor","pboots","lmed"}
				end
				level:drop_item( table.random_pick( item_spawn ), c, true, true, true )
			end
		end,
	}

end
