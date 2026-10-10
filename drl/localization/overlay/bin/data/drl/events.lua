-- Modified 2026-10-02 for the DRL browser presentation/semantic text adaptation; original gameplay/domain names retained.
function drl.register_events()

	-- Ice Event
	register_perk "event_ice"
	{
		name   = "Frozen Hell",
		desc   = "The walls of this level have turned to ice.",
		color  = LIGHTCYAN,
		min_lev = 16,
		weight  = 2,
		tags   = { "event" },

		OnAdd = function( self )
			ui.msg_feel(ui.semantic_feeling("message.feeling.hell-frozen", "Yes... Hell just froze over..."))
			do local drl_history_depth = level.index; player:add_history( "On @1, hell froze over!" ); ui.remember_semantic_history("history.event.frozen", "On level {{depth}}, hell froze over!", {{name="depth",kind="integer",value=tostring(drl_history_depth)}}) end

			generator.wall_to_ice[ generator.styles[ level.style ].wall ] = "iwall"

			for c in area.FULL:coords() do
				local cell = generator.wall_to_ice[ cells[level:get_cell( c )].id ]
				if cell then
					level:set_cell( c, cell )
				end
			end
		end,
	}

	-- Perma Event
	register_perk "event_perma"
	{
		name   = "Bulwark",
		desc   = "The walls on this level are reinforced and cannot be destroyed.",
		color  = BROWN,
		min_lev = 8,
		weight  = 4,
		tags   = { "event", "perma" },

		OnAdd = function( self )
			ui.msg_feel(ui.semantic_feeling("message.feeling.hardened-walls", "The walls here seem tough!"))
			do local drl_history_depth = level.index; player:add_history( "@1 was a hard nut to crack!" ); ui.remember_semantic_history("history.event.hard-nut", "Level {{depth}} was a hard nut to crack!", {{name="depth",kind="integer",value=tostring(drl_history_depth)}}) end
			generator.set_permanence( area.FULL )
		end,
	}

	-- Alarm Event
	register_perk "event_alarm"
	{
		name   = "Alarm",
		desc   = "An alarm has been triggered, all enemies are hunting you.",
		color  = YELLOW,
		min_lev = 8,
		weight  = 2,
		tags   = { "event", "enemy" },

		OnAdd = function( self )
			ui.msg_feel(ui.semantic_feeling("message.feeling.alarm", "As you enter, some weird alarm starts howling!"))
			do local drl_history_depth = level.index; player:add_history( "He sounded the alarm on @1!" ); ui.remember_semantic_history("history.event.alarm", "He sounded the alarm on level {{depth}}!", {{name="depth",kind="integer",value=tostring(drl_history_depth)}}) end
			for b in level:beings() do b.flags[ BF_HUNTING ] = true end
		end,
	}

	-- Deadly Air Event
	register_perk "event_deadly_air"
	{
		name   = "Deadly Air",
		desc   = "The atmosphere is toxic, dealing damage over time to beings with more than 25% health.",
		color  = LIGHTRED,
		min_lev = 16,
		min_diff   = 2,
		weight  = 2,
		tags   = { "event", "damage" },

		OnAdd = function( self )
			ui.msg_feel(ui.semantic_feeling("message.feeling.deadly-air", "The air seems deadly here, you better leave quick!"))
			do local drl_history_depth = level.index; player:add_history( "@1 blasted him with an unholy atmosphere!" ); ui.remember_semantic_history("history.event.unholy", "Level {{depth}} blasted him with an unholy atmosphere!", {{name="depth",kind="integer",value=tostring(drl_history_depth)}}) end
		end,

		OnTick = function( self, time )
			local function chill( b )
				if b.hp > b.hpmax / 4 and not b.flags[BF_INV] then
					if not b:is_player() or not b:is_perk("enviro") then
						b:msg(ui.semantic_text("message.feeling.deadly-chill", "You feel a deadly chill!"))
						b.hp = b.hp - 1
					end
				end
			end
			local step = 100 - DIFFICULTY * 5
			if time % step == 0 then
				for b in level:beings() do
					chill(b)
				end
				chill(player)
			end
		end,
	}

	-- Nuke Event
	register_perk "event_nuke"
	{
		name   = "Armed Nuke",
		desc   = "A thermonuclear bomb has been deployed on this level.",
		color  = RED,
		min_lev = 16,
		min_diff   = 2,
		weight  = 2,
		tags   = { "event", "nuke" },

		OnAdd = function( self )
			local minutes = 10 - DIFFICULTY
			ui.msg_feel(ui.semantic_feeling("message.feeling.familiar-object", "Descending the staircase you spot a familiar object..."))
			ui.msg_feel(ui.semantic_feeling("message.event.armed-nuke.countdown", "\"Thermonuclear bomb deployed. {{minutes}} minutes till explosion.\"", {{name="minutes",kind="integer",value=tostring(minutes)}}))
			do local drl_history_depth = level.index; player:add_history( "On @1 he encountered an armed nuke!" ); ui.remember_semantic_history("history.event.armed-nuke", "On level {{depth}} he encountered an armed nuke!", {{name="depth",kind="integer",value=tostring(drl_history_depth)}}) end
			player:nuke( minutes*60*10 )
		end,
	}

	-- Flood Acid Event
	register_perk "event_flood_acid"
	{
		name   = "Acid Flood",
		desc   = "Acid is flooding the level from one side.",
		color  = GREEN,
		min_lev = 8,
		weight  = 1,
		tags   = { "event", "flood", "damage" },

		OnAdd = function( self )
			ui.msg_feel(ui.semantic_feeling("message.feeling.run-urgently", "You feel the sudden need to run!!!"))
			do local drl_history_depth = level.index; player:add_history( "On @1 he ran for his life from acid!" ); ui.remember_semantic_history("history.event.acid", "On level {{depth}} he ran for his life from acid!", {{name="depth",kind="integer",value=tostring(drl_history_depth)}}) end
			generator.event_flood_setup {
				cell       = "acid",
				stairs     = "stairs",
				min_step   = 60,
				destroy    = true,
			}
		end,

		OnTick = function( self, time )
			generator.events_flood_tick()
		end,
	}

	-- Flood Lava Event
	register_perk "event_flood_lava"
	{
		name   = "Lava Flood",
		desc   = "Lava is flooding the level from one side.",
		color  = RED,
		min_lev = 17,
		min_diff   = 3,
		weight  = 4,
		tags   = { "event", "flood", "damage" },

		OnAdd = function( self )
			ui.msg_feel(ui.semantic_feeling("message.feeling.run-urgently", "You feel the sudden need to run!!!"))
			do local drl_history_depth = level.index; player:add_history( "On @1 he ran for his life from lava!" ); ui.remember_semantic_history("history.event.lava", "On level {{depth}} he ran for his life from lava!", {{name="depth",kind="integer",value=tostring(drl_history_depth)}}) end
			generator.event_flood_setup {
				cell        = "lava",
				stairs      = "stairs",
				min_step    = 40,
				destroy     = true,
				rush_danger = 20,
			}
		end,

		OnTick = function( self, time )
			generator.events_flood_tick()
		end,
	}

	-- Flood Blood Event
	register_perk "event_flood_blood"
	{
		name   = "Blood Flood",
		desc   = "Blood is flooding the level from one side.",
		color  = RED,
		min_lev = 20,
		min_diff   = 4,
		weight  = 3,
		tags   = { "event", "flood", "damage" },

		OnAdd = function( self )
			ui.msg_feel(ui.semantic_feeling("message.feeling.unholy-energy", "Unholy energy fills the air!!!"))
			do local drl_history_depth = level.index; player:add_history( "On @1 he ran for his life from blood!" ); ui.remember_semantic_history("history.event.blood", "On level {{depth}} he ran for his life from blood!", {{name="depth",kind="integer",value=tostring(drl_history_depth)}}) end
			generator.event_flood_setup {
				cell        = "blood",
				stairs      = "stairs",
				min_step    = 40,
				destroy     = false,
				rush_danger = 30,
			}
		end,

		OnTick = function( self, time )
			generator.events_flood_tick()
		end,
	}

	-- Targeted Event
	register_perk "event_targeted"
	{
		name   = "Targeted",
		desc   = "Enemies periodically teleport towards your position.",
		color  = MAGENTA,
		min_lev = 17,
		min_diff   = 3,
		weight  = 2,
		tags   = { "event", "enemy" },

		OnAdd = function( self )
			ui.msg_feel(ui.semantic_feeling("message.feeling.targeted", "You feel you're being targeted!"))
			do local drl_history_depth = level.index; player:add_history( "On @1 he was targeted for extermination!" ); ui.remember_semantic_history("history.event.extermination", "On level {{depth}} he was targeted for extermination!", {{name="depth",kind="integer",value=tostring(drl_history_depth)}}) end

			level.data.event.timer = 0
			level.data.event.step  = math.max( 100 - DIFFICULTY * 10, 50 )
		end,

		OnTick = function( self, time )
			level.data.event.timer = level.data.event.timer + 1
			if level.data.event.timer == level.data.event.step then
				level.data.event.timer = 0
				local list = {}
				local cp = player.position
				for b in level:beings() do
					if not b:is_player() and cp:distance( b.position ) > 9 then
						table.insert( list, b )
					end
				end
				if #list == 0 then return end
				local near_area = area.around( cp, 8 )
				local c
				local count = 0
				repeat
					if count > 50 then return end
					c = level:random_empty_coord( { EF_NOBEINGS, EF_NOITEMS, EF_NOSTAIRS, EF_NOBLOCK, EF_NOHARM, EF_NOSPAWN }, near_area )
					if c == nil then return end
					count = count + 1
				until c:distance( cp ) > 2 and level:eye_contact( c, cp )
				local b = table.random_pick( list )
				-- TODO We need a better way to deal with articles.  Removing this one for now.
				ui.msg(ui.semantic_text("message.event.targeted.enemy-appeared", "Suddenly, {{subject}} appears near you!", {{name="subject",kind="string",value=ui.registry_text('being',b.id,'base_game','name',b.name)}}))
				b:relocate( c )
				b:play_sound("phasing")
				b.scount = b.scount - math.max( 1000 - DIFFICULTY * 50, 500 )
				level:explosion( b.position, { range = 1, delay = 50, color = LIGHTBLUE } )
			end
		end,
	}

	-- Explosion Event
	register_perk "event_explosion"
	{
		name   = "Bombardment",
		desc   = "The level is being bombarded with hellish mortars.",
		color  = LIGHTRED,
		min_lev = 18,
		min_diff   = 2,
		weight  = 1,
		tags   = { "event", "explosion", "damage" },

		OnAdd = function( self )
			ui.msg_feel(ui.semantic_feeling("message.feeling.hell-mortars", "You hear sounds of hellish mortars!"))
			do local drl_history_depth = level.index; player:add_history( "On @1 he was bombarded!" ); ui.remember_semantic_history("history.event.bombarded", "On level {{depth}} he was bombarded!", {{name="depth",kind="integer",value=tostring(drl_history_depth)}}) end

			local data   = level.data.event
			data.enext   = math.max( 100 - DIFFICULTY * 10, 50 )
			data.hstep   = math.ceil( data.enext / 2 )
			data.size    = 2
			data.dice    = math.min( math.max( math.ceil( (level.danger_level + 2*DIFFICULTY) / 10 ), 2 ), 5 )
			data.content = nil
		end,

		OnTick = function( self, time )
			generator.events_explosion_tick()
		end,
	}

	-- Explosion Lava Event
	register_perk "event_explosion_lava"
	{
		name   = "Lava Bombardment",
		desc   = "The level is being bombarded with napalm.",
		color  = RED,
		min_lev = 25,
		min_diff   = 3,
		weight  = 1,
		tags   = { "event", "explosion", "damage" },

		OnAdd = function( self )
			ui.msg_feel(ui.semantic_feeling("message.feeling.hell-big-guns", "You hear sounds of hellish mortars! They rolled out the BIG GUNS!"))
			do local drl_history_depth = level.index; player:add_history( "On @1 he was walking in fire!" ); ui.remember_semantic_history("history.event.fire", "On level {{depth}} he was walking in fire!", {{name="depth",kind="integer",value=tostring(drl_history_depth)}}) end

			local data   = level.data.event
			data.enext   = math.max( 100 - DIFFICULTY * 10, 50 )
			data.hstep   = math.ceil( data.enext / 2 )
			data.size    = {2,3}
			data.dice    = math.min( math.max( math.ceil( (level.danger_level + 5*DIFFICULTY) / 25 ), 3 ), 6 )
			data.content = "lava"
		end,

		OnTick = function( self, time )
			generator.events_explosion_tick()
		end,
	}

	-- Darkness Event
	register_perk "event_darkness"
	{
		name   = "Pitch Black",
		desc   = "This floor is shrouded in darkness, reducing vision.",
		color  = DARKGRAY,
		min_lev = 9,
		min_diff   = 2,
		weight  = 2,
		tags   = { "event", "vision" },

		OnAdd = function( self )
			ui.msg_feel(ui.semantic_feeling("message.feeling.pitch-black", "This floor is pitch-black!"))
			do local drl_history_depth = level.index; player:add_history( "On @1 he was stumbling in the dark!" ); ui.remember_semantic_history("history.event.dark", "On level {{depth}} he was stumbling in the dark!", {{name="depth",kind="integer",value=tostring(drl_history_depth)}}) end

			local data = level.data.event
			data.old_stairsense = player.flags[ BF_STAIRSENSE ]
			data.old_darkness   = player.flags[ BF_DARKNESS ]
			player.vision = player.vision - 2
			player.flags[ BF_DARKNESS ]   = true
			player.flags[ BF_STAIRSENSE ] = false
		end,

		OnRemove = function( self, silent )
			local data = level.data.event
			if data then
				player.flags[ BF_DARKNESS ]   = data.old_darkness
				player.flags[ BF_STAIRSENSE ] = data.old_stairsense
				player.vision = player.vision + 2
			end
		end,
	}

end

function generator.events_explosion_tick()
	local data = level.data.event
	data.enext = data.enext - 1
	if data.enext == 0 then
		data.enext = data.hstep + math.random( data.hstep * 2 )
		local c = level:random_empty_coord( { EF_NOBEINGS, EF_NOITEMS, EF_NOSTAIRS, EF_NOBLOCK } )
		if not c then return end
		local range = data.size
		if type( data.size ) == "table" then
			range = math.random( data.size[1], data.size[2] )
		end
		level:explosion( c, { range = range, delay = 50, damage = data.dice.. "d6", color = LIGHTRED, sound_id = "barrel.explode", flags = { EFRANDOMCONTENT }, content = data.content } )
	end
end



