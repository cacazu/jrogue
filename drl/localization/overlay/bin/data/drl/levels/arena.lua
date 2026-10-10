-- Modified 2026-10-02 for the DRL browser presentation/semantic text adaptation; original gameplay/domain names retained.
-- HELL'S ARENA ---------------------------------------------------------

register_level "hells_arena"
{

	name  = "Hell's Arena",
	entry = "On @1 he entered Hell's Arena.",
	welcome = "You enter Hell's Arena",
	level = 2,

	OnRegister = function ()

		register_medal "chessmaster1"
		{
			name = "Chessmaster's Token",
			desc = "Complete Hell's Arena on AoMs/AoI on UV",
			hidden  = true,
		}

		register_medal "chessmaster2"
		{
			name = "Chessmaster's Cross",
			desc = "Complete Hell's Arena on AoMs/AoI on N!",
			hidden  = true,
			removes = { "chessmaster1" },
		}

		register_medal "hellchampion"
		{
			name = "Hell Champion Medal",
			desc = "Clear Hell's Arena",
			hidden  = true,
		}

		register_medal "hellchampion2"
		{
			name = "Hell Arena Key",
			desc = "Clear Hell's Arena w/o damage",
			hidden  = true,
			removes = { "hellchampion" },
		}

		register_medal "hellchampion3"
		{
			name = "Hell Arena Pwnage Medal",
			desc = "Clear Hell's Arena w/o damage on N!",
			hidden  = true,
			removes = { "hellchampion", "hellchampion2", },
		}

		register_badge "arena1"
		{
			name  = "Arena Bronze Badge",
			desc  = "Complete Hell's Arena",
			level = 1,
		}

		register_badge "arena2"
		{
			name  = "Arena Silver Badge",
			desc  = "Complete Hell's Arena on UV",
			level = 2,
		}

		register_badge "arena3"
		{
			name  = "Arena Gold Badge",
			desc  = "Complete Hell's Arena on AoMr on UV",
			level = 3,
		}

		register_badge "arena4"
		{
			name  = "Arena Platinum Badge",
			desc  = "Complete Hell's Arena on Nightmare!",
			level = 4,
		}

		register_badge"arena5"
		{
			name  = "Arena Diamond Badge",
			desc  = "Complete Hell's Arena on AoB on N!",
			level = 5,
		}
	end,

	Create = function ()
		core.special_create()
		level:set_generator_style( 1 )
		level:fill( "rwall" )
		level:fill( "floor", area.FULL_SHRINKED )
		local translation = {
			['.'] = "floor",
			[','] = { "water", flags = { LFBLOOD } },
			['#'] = "rwall",
			['>'] = "stairs"
		}

		local corners = {[[
#######################
#######################
####...................
####...................
####...................
]],[[
##############
##############
##############
#####......###
#####.........
]],[[
#######################
###########............
#####..................
##.....................
#......................
]],[[
############
#########...
######......
####........
###.........
##..........
##..........
#...........
]],[[
###########
###########
###########
###########
###########
]],[[
###########
###########
##.........
##.........
##.........
]]}

		local map = [[
..................................,,,,,,..
..,,,.............................,,,,,,,.
..,>,............................,,,,,,,,,
..,,,............................,,,,,,,,.
..................................,,,,,,..
]]
		local column = {[[
,..,.,
,####.
.####,
.####.
,..,.,
]],[[
,.,,.,
,####.
.####,
.####.
,.,,.,
]],[[
,.,.,
,###.
.###,
.###.
,.,.,
]],[[
,.,,.,
,,##,.
.####,
,####.
.,##,.
,.,,.,
]]}

		generator.place_tile( translation, map, 2, 8 )
		generator.place_symmetry_quad( table.random_pick( corners ), translation )
		generator.set_permanence( area.FULL )

		generator.scatter_put( area( 5,3,68,15 ), translation, table.random_pick( column ), "floor",8+math.random(8))
		level:transmute("water", "floor")
		generator.scatter_blood(area.FULL_SHRINKED,"floor",100)
		level.data.drop_zone = area.FULL_SHRINKED
		level.data.final_reward = {
			rocket = 3,
			bazooka = 1,
			scglobe = 1,
			barmor = 1,
			lmed = 1,
		}
		level:drop_being( player, coord( 38,10 ) )
	end,

	OnEnterLevel = function ()
		level.status = 1
		ui.continue(ui.semantic_text("message.level.hells-arena.welcome-announcement", "A devilish voice announces:\n{R\"Welcome to Hell's Arena, mortal! You are either very foolish, or very brave. Either way I like it!\"}"))
		ui.continue(ui.semantic_text("message.level.hells-arena.welcome-crowd", "{R\"And so do the crowds!\"}\nSuddenly you hear screams everywhere!\n{R\"Blood! Blood! BLOOD!\"}"))
		ui.continue(ui.semantic_text("message.level.hells-arena.first-round-objective", "The voice booms again:\n{R\"Kill all enemies and I shall reward thee!\"}"))

		level:summon("demon",3)
		level:summon("lostsoul",2)

		if DIFFICULTY > 1 then
			level:summon("cacodemon",DIFFICULTY - 1)
		end
	end,

	OnKill = function ()
		local temp = math.random(3)
		if     temp == 1 then ui.msg(ui.semantic_text("message.level.hells-arena.crowd-blood-frenzy", "The crowds go wild! \"BLOOD! BLOOD!\""))
		elseif temp == 2 then ui.msg(ui.semantic_text("message.level.hells-arena.crowd-blood-cheer", "The crowds cheer! \"Blood! Blood!\""))
		else                  ui.msg(ui.semantic_text("message.level.hells-arena.crowd-kill-cheer", "The crowds cheer! \"Kill! Kill!\"")) end
	end,

	OnKillAll = function ( wipe )
		if not wipe then return end
		if level.status == 1 then
			ui.continue(ui.semantic_text("message.level.hells-arena.first-round-cleared", "The voice booms:\n{R\"Not bad mortal! For the weakling that you are, you show some determination.\"}\nYou hear screams everywhere!\n{R\"More Blood! More BLOOD!\"}"))
			local choice = ui.query(ui.semantic_text("message.level.hells-arena.second-round-choice", "The voice continues:\n{R\"I can now let you go free, or you may try to complete the challenge!\nDo you want to continue the fight?\"}"))
			if choice then
				ui.msg(ui.semantic_text("message.level.hells-arena.second-round-accepted", "The voice booms, \"I like it! Let the show go on!\""))
				ui.msg(ui.semantic_text("message.level.hells-arena.second-round-crowd", "You hear screams everywhere! \"More Blood! More BLOOD!\""))
				level:drop("chaingun")
				level:summon("demon",3)
				level:summon("cacodemon",DIFFICULTY)
				level.status = 2
			else
				ui.msg(ui.semantic_text("message.level.hells-arena.second-round-refused", "The voice booms, \"Coward!\" "))
				ui.msg(ui.semantic_text("message.level.hells-arena.coward-crowd", "You hear screams everywhere! \"Coward! Coward! COWARD!\""))
				level.flags[ LF_NORESPAWN ] = true
			end
			return
		end

		if level.status == 2 then
			ui.continue(ui.semantic_text("message.level.hells-arena.second-round-cleared", "The voice booms:\n{R\"Impressive mortal! Your determination to survive makes me excited!\"}\nYou hear screams everywhere!\n{R\"More Blood! More BLOOD!\"}"))
			local choice = ui.query(ui.semantic_text("message.level.hells-arena.final-round-choice", "The voice continues:\n{R\"I can let you go now, and give you a small reward, or you can choose to fight the final challenge!\nDo you want to continue the fight?\"}"))
			if choice then
				ui.msg_feel(ui.semantic_feeling("message.level.hells-arena.final-round-accepted", "The voice booms, \"Excellent! May the fight begin!!!\""))
				ui.msg_feel(ui.semantic_feeling("message.level.hells-arena.final-round-crowd", "You hear screams everywhere! \"Kill, Kill, KILL!\""))

				level:drop("shell",4)
				level:drop("ammo",4)
				if CHALLENGE == "challenge_aob" then
					level:drop("lhglobe")
				end

				if DIFFICULTY == 1 then level:summon("cacodemon",2) end
				if DIFFICULTY == 2 then level:summon("cacodemon",3) end
				if DIFFICULTY == 3 then level:summon("knight",2) end
				if DIFFICULTY > 3  then level:summon("baron",2) end

				level.status = 3
			else
				ui.msg_feel(ui.semantic_feeling("message.level.hells-arena.final-round-refused", "The voice booms, \"Too bad, you won't make it far then...!\" "))
				ui.msg_feel(ui.semantic_feeling("message.level.hells-arena.final-refusal-crowd", "You hear screams everywhere! \"Boooo...\""))

				level:drop("shell",3)
				level:drop("lmed")
				level:drop("smed")
				level.flags[ LF_NORESPAWN ] = true
			end
			return
		end

		if level.status == 3 then
			ui.continue(ui.semantic_text("message.level.hells-arena.champion-announcement", "The voice booms:\n{R\"Congratulations mortal! A pity you came to destroy us, for you would make a formidable Hell warrior!\"}\nYou hear screams everywhere!\n{R\"Champion! Blood! Champion! More BLOOD!\"}\nThe voice continues:\n{R\"I grant you the title of Hell's Arena Champion!\nAnd a promise is a promise... Search the arena again!\"}"))

			for iid, amount in pairs(level.data.final_reward) do
				if amount > 0 then
					level:area_drop(level.data.drop_zone, iid, amount, false, true )
				end
			end
			
			level.status = 4
			player:add_medal("hellchampion")
			if statistics.damage_on_level == 0 then
				player:add_medal("hellchampion2")
				if player_data.count('player/medals/medal[@id="hellchampion"]') > 0 then
					player:remove_medal("hellchampion")
				end
				if DIFFICULTY >= DIFF_NIGHTMARE then
					player:add_medal("hellchampion3")
					if player_data.count('player/medals/medal[@id="hellchampion2"]') > 0 then
						player:remove_medal("hellchampion2")
					end
				end
			end
			level.flags[ LF_NORESPAWN ] = true
		end
	end,

	OnExit = function ()
		local result = level.status
			if player.nuketime > 1 then
				ui.msg(ui.semantic_text("message.level.hells-arena.exit-rejected-game", "\"To hell with your damn game.\""))
				do player:add_history( "He saw, left a present and left." ); ui.remember_semantic_history("history.arena.present", "He saw, left a present and left.", {}) end
		elseif result == 1 then do player:add_history( "He cowardly fled the Arena." ); ui.remember_semantic_history("history.arena.fled", "He cowardly fled the Arena.", {}) end
		elseif result == 2 then do player:add_history("He left the Arena before it got too hot."); ui.remember_semantic_history("history.arena.left", "He left the Arena before it got too hot.", {}) end
		elseif result == 3 then do player:add_history("He fought desperately in the Arena but didn't have what it takes."); ui.remember_semantic_history("history.arena.lost", "He fought desperately in the Arena but didn't have what it takes.", {}) end
		elseif result == 4 then do player:add_history("He left the Arena as a champion!"); ui.remember_semantic_history("history.arena.champion", "He left the Arena as a champion!", {}) end end
		ui.msg(ui.semantic_text("message.level.hells-arena.exit-taunt", "The voice laughs, \"Flee mortal, flee! There's no hiding in hell!\""))

		-- badges --
		if result == 4 then
			core.special_complete()
			player:add_badge("arena1")
			if DIFFICULTY >= DIFF_VERYHARD then
				player:add_badge("arena2")
				if core.is_challenge("challenge_aoi") or core.is_challenge("challenge_aoms") then player:add_medal("chessmaster1") end
				if core.is_challenge("challenge_aomr") then player:add_badge("arena3") end
				if DIFFICULTY >= DIFF_NIGHTMARE then
					player:add_badge("arena4")
					if core.is_challenge("challenge_aoi") or core.is_challenge("challenge_aoms") then player:add_medal("chessmaster2") end
					if core.is_challenge("challenge_aob") then player:add_badge("arena5") end
				end
			end
		end
	end,

}
