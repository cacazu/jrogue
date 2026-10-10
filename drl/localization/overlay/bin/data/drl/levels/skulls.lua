-- Modified 2026-10-02 for the DRL browser presentation/semantic text adaptation; original gameplay/domain names retained.
-- CITY OF SKULLS -------------------------------------------------------

register_level "city_of_skulls"
{
	name  = "City of Skulls",
	entry = "On @1 he found the City of Skulls.",
	welcome = "You enter a city made out of bones. You sense a certain tension.",
	level = 12,

	Create = function ()
		core.special_create()
		level:set_generator_style( 1 )
		level:fill( "rwall" )

		local translation = {
			['.'] = "floor",
			[','] = { "floor", flags = { LFBLOOD } },
			['#'] = "wall",
			['>'] = "stairs",

			['O'] = { "floor", being = core.ifdiff( 2, "pain" ) },
			['s'] = { "floor", being = "lostsoul" },

			['/'] = { "floor", item = "shell" },
			['|'] = { "floor", item = "ammo" },
			['-'] = { "floor", item = "rocket" },
			['!'] = { "floor", item = "umbazooka" },
		}

		local map = [[
............................,,,,,,,,,,....................,,,...............
...,,,,,,,,,...,,,,,,,,,....,########,.......,,,,,,,,........,,,...,,,......
...,#######,...,#######,....,#|s||s|#,.......,######,.......,,,,,,,,,.......
...,#|s.-/#,...,#|,s-/#,....,#/.s..s#,.......,#|s-/#,.....,,,#######,.......
...,#..O.s#,...,#s.,,s#,....,#s.Os..#,.......,#s.s.#,.......,#!|s-/#,.......
...,#s..s.#,...,#######,....,#.s..s.#,.......,#.s.s#,......,,#s.Os.#,.......
...,#######,...,,,,,,,,,....,########,.......,######,..,,,,.,#.s..s#,.......
...,,,,,,,,,...........,,,..,,,,,,,,,,.......,,,,,,,,.......,#######,.......
.........,,,,,.............................,,...............,,,,,,,,,.......
....,,.......,,,.......,,,.....,,..........,,,.........,,,,.................
.........,,,,,,,,,.........,,,...............................,,,..,,,....>..
..,..,,..,#######,...,,......................,....,,,,,,,,,......,,..,......
...,,....,#.s.s.#,..........,,,,,,,,,,,....,,,....,#######,...,....,........
....,,...,#s|sOs#,...,,.....,#########,...........,#/.s-.#,...,,,,..,.......
.........,#/s-s.#,..........,#s.s.s./#,.......,,..,#s.Os.#,......,,,........
..,,,....,#######,....,,,...,#.s|s-s.#,.....,,,...,#.s|.s#,.......,,........
...,,,...,,,,,,,,,.,,,......,#########,...,,,.....,#######,....,,,..........
...........,...,............,,,,,,,,,,,...........,,,,,,,,,.................
]]

		generator.place_tile( translation, map, 2,2 )
		local lever = level:drop_item( "lever_walls", coord( 35, 11 ) )
		lever.flags[ IF_NODESTROY ]	= true
		generator.set_permanence( area.FULL )
		level:drop_being( player, coord( 2,2 ) )
		level.status = 1
	end,

	OnKillAll = function ()
		if level.status == 3 then return end

		if level.status == 1 and DIFFICULTY < 2 then
			level.status = 3
			ui.msg(ui.semantic_text("message.level.city-of-skulls.first-wave-slain-comment", "That seems to be all of them, hopefully..."))
			return
		end

		if level.status == 2 then
			level.status = 3
			ui.msg(ui.semantic_text("message.level.city-of-skulls.final-wave-slain-comment", "That had damn well better be all of them!"))
			return
		end

		if DIFFICULTY == 3 then
			ui.msg(ui.semantic_text("message.level.city-of-skulls.lost-souls-arrived", "Suddenly lost souls appear out of nowhere!"))
			level:summon("lostsoul",20)
		end
		if DIFFICULTY > 3 then
			ui.msg(ui.semantic_text("message.level.city-of-skulls.pain-elementals-arrived", "Suddenly pain elementals appear out of nowhere!"))
			level:summon("pain",12)
		end

		ui.msg(ui.semantic_text("message.level.city-of-skulls.agony-howl", "You hear a howl of agony!"))
		local agony = level:summon("agony")
		for i = 1,3 do
			agony.inv:add( item.new(table.random_pick{"ufskull","ubskull","uhskull"}) )
		end
		level.status = 2
	end,

	OnExit = function ()
		if level.status == 3 then
			core.special_complete()
			do player:add_history("He wiped out the City of Skulls."); ui.remember_semantic_history("history.skulls.cleared", "He wiped out the City of Skulls.", {}) end
 	 		player:add_badge("skull1")
			if core.is_challenge("challenge_aora") then player:add_badge("skull2") end
		else
			do player:add_history("He fled the City in terror!"); ui.remember_semantic_history("history.skulls.fled", "He fled the City in terror!", {}) end
		end
	end,

}

